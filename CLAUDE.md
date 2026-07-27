# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install               # install dependencies
pnpm electron:dev          # start Vite dev server + Electron (HMR)
pnpm electron:build        # production build + package with electron-builder
pnpm typecheck             # vue-tsc --noEmit
pnpm lint:ci               # biome ci (CI mode, no writes)
pnpm lint                  # biome check --write (auto-fix)
pnpm format                # biome format --write
```

Pre-commit hook runs `biome check --write` on staged `.ts`/`.vue` files. OnlyOffice library files (`src/components/onlyoffice/`) are excluded from stricter lint rules via `biome.json` overrides.

### Release

```bash
git tag v0.1.0
git push origin v0.1.0     # triggers .github/workflows/build.yml
```

## Architecture

### Stack

```
Electron 34     ← main process + preload (contextBridge)
Vue 3           ← renderer (SPA)
Vite 6          ← build tool (vite-plugin-electron for main/preload)
Pinia           ← state management
vue-i18n        ← i18n (zh-CN / en)
Element Plus    ← UI components
Biome           ← linting + formatting
```

### Directory Structure

```
electron/
  main.ts          ← Electron main process (BrowserWindow, CSP, IPC registration)
  preload.ts       ← contextBridge.exposeInMainWorld('electronAPI', ...)
  ipc/             ← IPC handlers by domain (io, db, ai, sessions, mcp-client)
    index.ts       ← registerAllHandlers() — auto-registers modules + dialog handlers

src/
  main.ts          ← Vue app bootstrap (pinia, router, i18n, markstream-vue)
  router/          ← vue-router (home, chat, files, batch, office, settings/*)
  views/           ← route-level pages
  components/
    layout/        ← AppLayout, SidePanel, TopNav, StatusBar
    chat/          ← ChatMessage, ChatInput, ChatSessionList, ThinkingBlock
    office/        ← OfficeEditor.vue — OnlyOffice editor wrapper
    onlyoffice/    ← OnlyOffice SDK client-side integration (44 files, vendored)
    icons/         ← Custom SVG icon components
  composables/     ← useAiChat.ts, useCrudList.ts
  stores/          ← Pinia stores (theme.ts)
  types/           ← TypeScript types (ai.ts, models.ts, ipc.ts, theme.ts)
  i18n/            ← vue-i18n locales (zh-CN, en)
  utils/
    ipc.ts         ← Typed IPC wrapper (invokeIpc, getElectronAPI, isElectron)
    dev-mock.ts    ← Mock electronAPI for browser-only dev (no Electron)
    markstream.ts  ← markstream-vue feature initialization
  builtin-skills/  ← AI skill definitions (docx, xlsx, pdf, pptx)

public/
  packages/        ← OnlyOffice SDK assets (downloaded on demand, gitignored)
```

### IPC Pattern (Electron ↔ Renderer)

All IPC is via `contextBridge` (no `nodeIntegration`):

1. `preload.ts` exposes methods via `electronAPI` object
2. `electron/ipc/` modules implement handlers, auto-registered by `registerAllHandlers()`
3. `src/utils/ipc.ts` provides typed wrappers: `invokeIpc(cmd, args)`, `getElectronAPI()`, `isElectron()`
4. `src/utils/dev-mock.ts` provides fallback stubs when running outside Electron

### OnlyOffice Integration

The OnlyOffice editor runs entirely client-side (no backend server needed):
- **CDN mode** (default): UI loads from Cloudflare Pages, ~0MB bundle overhead
- SDK wrapper in `src/components/onlyoffice/` is vendored from electroluxcode/onlyoffice-web-comp
- Vue wrapper: `src/components/office/OfficeEditor.vue` with CDN config, file I/O via Electron IPC
- Configuration: `vite.config.ts` defines `__ONLYOFFICE_CDN__` for CSP + component
- x2t.wasm handles document conversion in a Web Worker

### OnlyOffice files are third-party library code

`src/components/onlyoffice/` should NOT be modified unless fixing a specific integration issue. Biome overrides disable several lint rules for this directory. The source is from electroluxcode/onlyoffice-web-comp.

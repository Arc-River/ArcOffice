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

## Debugging with Chrome DevTools (CDP)

`electron/main.ts` automatically enables two debugging ports in dev mode (`!app.isPackaged`):

| Port | Protocol | Use |
|------|----------|-----|
| 9229 | Node.js Inspector | Debug main process via `chrome://inspect` |
| 8315 | Chrome DevTools Protocol | Debug renderer process (DOM, console, network, JS eval) |

### Using the bundled script

```bash
node scripts/cdp.mjs pages              # list all renderer pages and their IDs
node scripts/cdp.mjs screenshot <pageId> # capture a screenshot -> scripts/screenshots/electron-<ts>.png
node scripts/cdp.mjs eval <pageId> <js>  # execute JS in the renderer (one-liner)
node scripts/cdp.mjs snap <pageId>       # accessibility tree snapshot
```

### Using Chrome DevTools MCP (Claude Code)

Configure an MCP server in `.claude/settings.json` so Claude Code can use
`mcp__chrome-devtools-electron__*` tools to control Electron directly:

```json
{
  "mcpServers": {
    "chrome-devtools-electron": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp",
        "--wsEndpoint",
        "ws://127.0.0.1:8315/devtools/browser/<browser-id>"
      ]
    }
  }
}
```

Get the `<browser-id>` from `node cdp.mjs pages` output, or from the DevTools
listening message printed at startup:

```
DevTools listening on ws://127.0.0.1:8315/devtools/browser/50af5ba4-...
```

With the MCP server connected, Claude Code can: take snapshots of the page
structure, click buttons, fill forms, read console output, inspect network
requests, execute arbitrary JS, and capture screenshots — all on the live
Electron renderer.

**Note:** Restart the Claude Code session after editing `.claude/settings.json`
for the new MCP server to be loaded. Remove the entry to revert to the default
independent Chrome instance.

### Raw CDP via curl

```bash
# list targets
curl -s http://127.0.0.1:8315/json | python3 -m json.tool
# get browser metadata
curl -s http://127.0.0.1:8315/json/version | python3 -m json.tool
```

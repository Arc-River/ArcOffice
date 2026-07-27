# ArcOffice
![logo](./logo.png)

[![Electron](https://img.shields.io/badge/Electron-34-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Biome](https://img.shields.io/badge/Biome-2-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev/)

![ArcOffice Demo](./docs/office-editor-demo.gif)

A cross-platform desktop Office tool built with **Electron + Vue 3**.
Runs locally, privacy-first.

## Stack

**Core:** Electron / Vue 3 / TypeScript / Vite 6 / Element Plus / Pinia

**AI:** @anthropic-ai/sdk / MCP (Model Context Protocol) / markstream-vue

**Office:** OnlyOffice Web SDK / exceljs

**Tools:** Biome / sql.js

## Quick Start

```bash
pnpm install
pnpm electron:dev      # development
pnpm electron:build    # build + package
pnpm typecheck         # type check
pnpm lint              # lint
```

## License

[GPLv3](./LICENSE)

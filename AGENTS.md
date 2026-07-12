# DeckCraft — Agent guide

Tauri v2 + React 19 + TypeScript 5.8 + Vite 7 + Tailwind v4 + shadcn/ui.

Early scaffold — placeholder App component, MVP not built yet. See `IDEA.md` for the full vision (Spanish).

## Commands

| Action | Command |
|--------|---------|
| Dev server | `pnpm dev` (Vite at `:1420`) |
| Build frontend | `pnpm build` (`tsc && vite build`) |
| Run Tauri app | `pnpm tauri dev` |
| Build Tauri bundle | `pnpm tauri build` |
| Add shadcn component | `pnpm tauri ui add <name>` |

## Architecture

- **Frontend**: `src/` — React SPA, Vite-bundled, served on `:1420`
- **Backend**: `src-tauri/` — Rust, Tauri v2 IPC commands (`#[tauri::command]`)
- **Entry**: `index.html` → `src/main.tsx` → `src/App.tsx`
- **Rust lib**: `src-tauri/src/lib.rs` exports `run()`, called from `main.rs`
- **Permissions**: `src-tauri/capabilities/default.json` — add new capability grants here

## Key quirks

- **Tailwind v4**: no PostCSS config — `@tailwindcss/vite` plugin in `vite.config.ts` handles it. `@theme inline` pattern in `index.css` for shadcn vars.
- **shadcn/ui**: configured (`components.json`) but **no components installed yet**. Use `pnpm tauri ui add button` to add them. Aliases: `@src/` → `src/`.
- **No linting/formatter**: no ESLint, no Prettier. `tsc` is the only static check (strict mode, `noUnusedLocals`, `noUnusedParameters`).
- **No test framework**: no tests anywhere.
- **No CI**: no GitHub Actions.
- **Single package**: pnpm workspace, but only one project. Not a monorepo.
- **HMR over network**: set `TAURI_DEV_HOST` env var for LAN/HMR access (also enables WS on port `1421`).
- **Vite ignores `src-tauri/`** in file watcher — changes to Rust files need a `pnpm tauri dev` restart.
- **Ponytail plugin** active (`opencode.json`) — prefers minimal code, stdlib, deletion over addition.

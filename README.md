# DeckCraft

Turn any programmable board into a custom Stream Deck.

DeckCraft is a Windows desktop application that detects Arduino and compatible boards over Serial or HID, maps their physical buttons to keyboard shortcuts, app launches, macros, and more -- all through a drag-and-drop interface.

Built with Tauri v2, React 19, and Rust for a native, low-latency experience.

## Features

- **Auto-detection** -- Scans Serial and HID ports, identifies connected boards, and selects the right protocol without user input.
- **Physical mapping wizard** -- Press each switch on your board; DeckCraft creates a visual node on the canvas automatically.
- **Drag-and-drop canvas** -- Arrange your buttons freely with snap-to-grid support.
- **Per-button actions** -- Assign key combinations, launch executables, open URLs, type text, run shell commands, or navigate profiles.
- **Profiles and pages** -- Organize actions into multiple profiles with pagination for unlimited buttons per board.
- **Background mode** -- For non-HID boards, DeckCraft minimizes to system tray to keep working as a keyboard bridge.
- **Protocol-agnostic** -- Uses plain-text `P:<id>` signaling to keep Arduino firmware lightweight (works within 2KB RAM).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 19, TypeScript 5.8 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 |
| UI components | shadcn/ui (Radix Primitives) |
| Drag and drop | @dnd-kit |
| HID communication | hidapi (Rust) |
| Serial communication | serialport (Rust) |
| Keyboard emulation | enigo (Rust) |
| Storage | Local JSON files |

## Project Structure

```
deckcraft/
├── src/                    # React frontend
│   ├── components/
│   │   ├── ui/             # shadcn/ui primitives
│   │   ├── views/          # App views (Welcome, Mapping, Customize)
│   │   ├── Dashboard.tsx   # Main layout after connection
│   │   ├── ButtonConfigModal.tsx
│   │   └── ActionFields.tsx
│   ├── lib/utils.ts
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Tailwind + CSS variables
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri commands (scan_apps, etc.)
│   │   └── main.rs         # Entry point
│   ├── capabilities/       # Permission grants
│   ├── tauri.conf.json     # Tauri configuration
│   └── Cargo.toml
├── public/                 # Static assets
├── index.html
├── vite.config.ts
├── components.json         # shadcn/ui configuration
└── package.json
```

## Getting Started

### Prerequisites

- Rust (latest stable)
- Node.js 20+
- pnpm

### Development

```bash
# Install dependencies
pnpm install

# Start Vite dev server (frontend only, port 1420)
pnpm dev

# Run full Tauri app
pnpm tauri dev

# Build for production
pnpm tauri build
```

### Commands

| Action | Command |
|--------|---------|
| Dev server | `pnpm dev` |
| Build frontend | `pnpm build` (`tsc && vite build`) |
| Run Tauri app | `pnpm tauri dev` |
| Build Tauri bundle | `pnpm tauri build` |
| Add shadcn component | `pnpm tauri ui add <name>` |

## Architecture

DeckCraft follows a clear split: **Rust handles all hardware interaction** (Serial/HID detection, keyboard emulation via enigo, file I/O, system tray), while **React handles only the UI**. Communication goes through Tauri's IPC (`invoke`/events).

```
┌─────────────────────────────────────────┐
│             Tauri App                    │
│  ┌──────────────────┐  ┌──────────────┐│
│  │  Frontend (React) │  │ Backend(Rust)││
│  │  - Canvas editor  │  │ - hidapi     ││
│  │  - Button mapping │  │ - serialport ││
│  │  - Profile mgmt   │  │ - enigo      ││
│  │  - Drag and drop  │  │ - System tray││
│  └────────┬─────────┘  └──────┬───────┘│
│           │  IPC (invoke)     │         │
│           └───────────────────┘         │
└─────────────────────────────────────────┘
```

### Board Protocol

The board-to-PC protocol is minimal by design: `P:<button_id>\n` over Serial. The PC auto-releases keys after 50ms, keeping Arduino firmware under 2KB RAM. PC-to-board commands use a slightly richer text format for configuration (`PAGE:<n>`, `PROFILE:<name>`, `LED:<id>:<r,g,b>`, `RESET`).

## Roadmap

- **Phase 1 -- MVP**: Serial scanning, mapping UI, drag-and-drop canvas, key recording, app launching, single profile save/load, keyboard bridge, system tray.
- **Phase 2 -- Profiles**: Multiple profiles, pages/layers, navigation buttons, import/export.
- **Phase 3 -- HID**: HID detection and communication, multi-action per button, sustain mode, text/URL/command actions, LED feedback.
- **Phase 4 -- Polish**: Auto-start, auto-reconnect, themes, i18n.

## License

MIT

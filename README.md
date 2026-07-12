# DeckCraft

Turn any programmable board into a custom Stream Deck.

DeckCraft is a Windows desktop application that detects Arduino and compatible boards over Serial or HID, maps their physical buttons to keyboard shortcuts, app launches, macros, and more — all through a simple interface.

Built with Tauri v2, React 19, and Rust for a native, low-latency experience.

## Features

- **Serial/HID scanning** — Scans ports and identifies connected programmable boards (Arduino, FTDI, CH340, ESP32, RP2040, etc.)
- **Physical mapping wizard** — Enter mapping mode, press each switch on your board; DeckCraft creates a button node automatically
- **Visual grid canvas** — Arrange and reorder buttons via drag-and-drop with configurable grid columns
- **Per-button actions** — Assign key combinations (SendInput), launch executables/`.lnk`/`.url`, open URLs, type text, or switch profiles
- **Profile system** — Create, rename, and delete profiles with independent button layouts
- **Real-time visual feedback** — Pressed buttons light up on the canvas with a CSS animation
- **Protocol-agnostic** — Uses plain-text `P:<id>\n` / `R:<id>\n` signaling; Arduino firmware is lightweight

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
| Keyboard emulation | Win32 SendInput (Rust) |

## Project Structure

```
deckcraft/
├── src/                    # React frontend
│   ├── components/
│   │   ├── ui/             # shadcn/ui primitives
│   │   ├── views/          # App views (Welcome, Mapping, Customize)
│   │   ├── lib/            # Action execution logic
│   │   ├── Dashboard.tsx   # Main layout after connection
│   │   └── ...
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Tailwind + CSS variables
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri commands (serial, HID, SendInput)
│   │   └── main.rs         # Entry point
│   ├── capabilities/       # Permission grants
│   └── Cargo.toml
├── public/
├── index.html
└── vite.config.ts
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

DeckCraft follows a clear split: **Rust handles all hardware interaction** (Serial/HID detection, keyboard emulation via Win32 SendInput) while **React handles the UI**. Communication goes through Tauri's IPC (`invoke`/events).

```
┌─────────────────────────────────────────┐
│             Tauri App                    │
│  ┌──────────────────┐  ┌──────────────┐│
│  │  Frontend (React) │  │ Backend(Rust)││
│  │  - Canvas editor  │  │ - hidapi     ││
│  │  - Button mapping │  │ - serialport ││
│  │  - Profile mgmt   │  │ - SendInput  ││
│  │  - Drag and drop  │  │ - Shell exec ││
│  └────────┬─────────┘  └──────┬───────┘│
│           │  IPC (invoke)     │         │
│           └───────────────────┘         │
└─────────────────────────────────────────┘
```

### Board Protocol

The board sends `P:<id>\n` on button press and `R:<id>\n` on button release over Serial at 115200 baud. The app uses the `id` to look up the configured action in the active profile. Arduino firmware with debounce is provided in the project.

## Roadmap

- **Phase 1 — MVP** ✅ Serial scanning, mapping wizard, drag-and-drop canvas, key recording (e.code), app launching (.exe/.lnk/.url), profiles, SendInput keyboard emulation, CSS-animated press feedback
- **Phase 2 — HID** HID detection and communication, multi-action per button
- **Phase 3 — Polish** Auto-start, auto-reconnect, themes, i18n

## License

MIT

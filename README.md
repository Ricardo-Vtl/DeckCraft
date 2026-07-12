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
- **Audio soundboard** — Assign audio files (MP3, WAV, FLAC) to buttons; plays through a virtual microphone via Voicemeeter Banana for Discord / voice chats
- **Protocol-agnostic** — Uses plain-text `P:<id>\n` / `R:<id>\n` signaling; Arduino firmware is lightweight

## Tech Stack

| Layer                | Technology                   |
| -------------------- | ---------------------------- |
| Desktop shell        | Tauri v2 (Rust)              |
| Frontend             | React 19, TypeScript 5.8     |
| Build tool           | Vite 7                       |
| Styling              | Tailwind CSS v4              |
| UI components        | shadcn/ui (Radix Primitives) |
| Drag and drop        | @dnd-kit                     |
| HID communication    | hidapi (Rust)                |
| Serial communication | serialport (Rust)            |
| Keyboard emulation   | Win32 SendInput (Rust)       |

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

| Action               | Command                            |
| -------------------- | ---------------------------------- |
| Dev server           | `pnpm dev`                         |
| Build frontend       | `pnpm build` (`tsc && vite build`) |
| Run Tauri app        | `pnpm tauri dev`                   |
| Build Tauri bundle   | `pnpm tauri build`                 |
| Add shadcn component | `pnpm tauri ui add <name>`         |

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

## Audio Soundboard

DeckCraft can play audio files (`.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`, `.aac`, `.wma`) when a button is pressed. The audio plays through the selected output device — press the same button again to stop it.

### Why Voicemeeter Banana?

To play audio through Discord, voice chats, or any application, the audio must reach your system's **microphone input**. Windows does not allow apps to inject audio directly into a microphone.

[**Voicemeeter Banana**](https://vb-audio.com/Voicemeeter/banana.htm) is a free virtual audio mixer that solves this by:

1. Receiving DeckCraft's audio through a virtual device (`Voicemeeter VAIO`)
2. Mixing it with your physical microphone
3. Sending the combined output to Discord, games, or any app

This way you can talk and trigger sound effects simultaneously — no manual switching required.

### Setup guide

#### 1. Install Voicemeeter Banana

Download and install [Voicemeeter Banana](https://vb-audio.com/Voicemeeter/banana.htm) (free, donationware). Restart your PC after installation if prompted.

#### 2. Configure Voicemeeter Banana

Open Voicemeeter Banana. You will see three input columns and output selectors:

| Section                              | What to do                                                |
| ------------------------------------ | --------------------------------------------------------- |
| **Stereo Input 1**                   | Click the device name and select your physical microphone |
| **Stereo Input 2**                   | Leave empty (not used)                                    |
| **Virtual Input - Voicemeeter VAIO** | Leave as is — DeckCraft will play here                    |

For **each** input column (Stereo Input 1 and Virtual Input), click the **B1** button at the bottom of that column. Make sure **A1**, **A2**, **B2** are **off** (dim).

```
Stereo Input 1 (your mic)    Virtual Input (DeckCraft)
┌──────────────────────┐     ┌──────────────────────┐
│  A1  A2  ●B1  B2    │     │  A1  A2  ●B1  B2    │
└──────────────────────┘     └──────────────────────┘
```

- **B1** sends audio to the virtual output that Discord will use as a microphone
- **A1/A2** would send audio to your speakers — leave them off to avoid echo

You do **not** need to configure Hardware OUT A1/A2 — your headphones stay connected directly to your PC as usual.

#### 3. Configure Discord

In Discord (or any voice app):

1. Go to **User Settings → Voice & Video**
2. **Input Device** → select `Voicemeeter Output (VB-Audio Voicemeeter VAIO)`
3. **Output Device** → keep your normal headphones/speakers
4. **Noise Suppression** → set to **None** (Krisp and other filters can degrade soundboard audio quality)
5. **Echo Cancellation** → set to **Off**
6. **Advanced → Voice Processing** → disable if available

If the audio sounds low-quality in Discord, these filters are the most likely cause — disabling them ensures the soundboard audio is heard at full quality.

#### 4. Configure DeckCraft

1. Select a button → action **Play Audio**
2. Click **Browse** and pick an audio file
3. **Output device** → select `Voicemeeter Input (VB-Audio VoiceMeeter VAIO)` or `Voicemeeter VAIO`
4. Press the physical button — the audio plays through your microphone channel

The first time you select Play Audio, DeckCraft scans for Voicemeeter devices. If not found, a banner explains the setup and links to the download page.

#### 5. Optional — Auto-start Voicemeeter in background

1. In Voicemeeter Banana, click **Menu** (☰) → **System Tray / Run at startup**
2. Enable **System Tray** (Run on close)
3. Close the window with the **X** button (not Menu → Exit) — Voicemeeter minimizes to the system tray
4. Enable **Run at startup** if you want it to launch automatically with Windows

The audio mixer runs silently in the background without cluttering your taskbar.

### Troubleshooting

| Symptom                             | Likely cause                          | Fix                                                                                 |
| ----------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| Audio sounds robotic / distorted    | Sample rate mismatch                  | DeckCraft now auto-matches the file's sample rate — rebuild and try again           |
| Audio sounds low-quality in Discord | Noise suppression / echo cancellation | Disable Krisp, noise suppression, and echo cancellation in Discord's voice settings |
| No audio in Discord                 | Wrong input device selected           | Set Discord's input to `Voicemeeter Output`                                         |
| Only voice or only soundboard heard | B1 not enabled on both inputs         | Check B1 is lit on both Stereo Input 1 and Virtual Input in Voicemeeter             |
| Voicemeeter window keeps appearing  | Closed via Exit instead of X          | Close with the X button to minimize to system tray                                  |
| Voicemeeter asks for donation       | Donationware popup (every ~4h)        | Close the popup and continue — no license required                                  |

## Roadmap

- **Phase 1 — MVP** (Completed) Serial scanning, mapping wizard, drag-and-drop canvas, key recording (e.code), app launching (.exe/.lnk/.url), profiles, SendInput keyboard emulation, CSS-animated press feedback
- **Phase 2 — HID** HID detection and communication, multi-action per button
- **Phase 3 — Polish** Auto-start, auto-reconnect, themes, i18n

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

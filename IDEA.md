# DeckCraft — Documento de Visión

## 1. Propósito

Aplicación Windows de escritorio para controlar **tarjetas programables** (Arduino, etc.) como si fueran un Stream Deck:

- **Tarjetas no-HID** (ej. Arduino Uno): comunicación bidireccional por Serial. El software actúa como puente entre Windows y la tarjeta.
- **Tarjetas HID** (ej. Arduino Leonardo, Micro, teclados programables): comunicación directa por HID. El software funciona como editor/configurador; puede cerrarse y la tarjeta opera sola.

Detección automática: el usuario no necesita saber si es HID o no. El software escanea, encuentra, y guía.

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Shell de escritorio | **Tauri v2** (Rust) |
| Frontend | **React 19 + TypeScript + Vite** |
| UI Framework | **Tailwind CSS v4** |
| Componentes | **shadcn/ui** (Radix Primitives) |
| Comunicación HID | `hidapi` crate (Rust) |
| Comunicación Serial | `serialport` crate (Rust) |
| Sistema de archivos | JSON plano para perfiles/config |
| Segundo plano | System tray nativo (Tauri v2) |
| Bundle | Instalador MSI (Windows) |

Requiere: Rust, Node.js, pnpm.

---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                   Tauri App                          │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │   Frontend (React)   │  │   Backend (Rust)     │ │
│  │                      │  │                      │ │
│  │  - UI de mapeo      │  │  - hidapi (HID)     │ │
│  │  - Editor de botones │  │  - serialport (Serial)│ │
│  │  - Gestión perfiles  │  │  - Bridge teclado    │ │
│  │  - Drag & drop       │  │  - System tray       │ │
│  │                      │  │  - File I/O (JSON)   │ │
│  └──────────┬───────────┘  └──────────┬───────────┘ │
│             │ IPC (invoke/events)      │             │
│             └──────────────────────────┘             │
└─────────────────────────────────────────────────────┘
```

**Rust** maneja todo lo pesado: detección de puertos, comunicación Serial/HID, emulación de teclado, archivos. **React** solo UI. En segundo plano, el frontend se oculta y solo corre el proceso Rust.

---

## 4. Flujo del Usuario

### 4.1 Inicio — Detección Automática

1. El software escanea:
   - Puertos Serial (COM1, COM2, ...)
   - Dispositivos HID
2. Muestra una lista tipo "Tarjetas encontradas" con nombre descriptivo.
   - Si hay 1 sola, la selecciona automáticamente.
   - Si hay múltiples, el usuario elige.
3. Detecta el tipo (HID o Serial) sin preguntar al usuario.

### 4.2 Mapeo de Botones (Detección Física)

1. Una vez conectada la tarjeta, se muestra un **lienzo vacío**.
2. El software pone la tarjeta en "modo detección". El usuario presiona **cada switch físico** en el orden que desee.
3. Cada vez que presiona un switch:
   - La tarjeta envía una señal por Serial/HID.
   - El software crea un **nodo visual** en el lienzo (numerado: "Botón 1", "Botón 2", ...).
4. Cuando termina, hace clic en **"Finalizar mapeo"**.
5. Entra en **modo diseño interactivo**.

### 4.3 Editor de Diseño (Drag & Drop Libre)

1. Los nodos aparecen sueltos en el lienzo sobre una **cuadrícula base invisible** (snap-to-grid opcional).
2. El usuario **arrastra y suelta** cada botón para colocarlo como quiera.
   - Puede alinearlos en una fila (lista lineal).
   - Puede agruparlos en una matriz 4×3.
   - Puede hacer formas libres.
3. La posición de cada botón se guarda como coordenadas (x, y) + tamaño en la cuadrícula.

### 4.4 Personalización de Botón (Modal)

Al hacer clic en un botón en el lienzo, se abre un modal con opciones:

| Acción | Descripción |
|--------|-------------|
| **Grabar tecla(s)** | El usuario presiona una combinación (ej. Ctrl+Shift+V) y se guarda. Soporte para teclas especiales (F1-F24, multimedia, etc.). |
| **Lanzar aplicación** | Selector de archivos para elegir .exe, .lnk, .bat. Soporte para argumentos. |
| **Abrir URL** | Campo de texto para una URL. |
| **Escribir texto** | Campo para texto plano a escribir carácter por carácter. |
| **Navegación** | Ir a página siguiente/anterior, o cambiar a un perfil específico. |
| **Comando personal** | Script o comando a ejecutar en shell (cmd/powershell). |

Cada botón puede tener múltiples acciones encadenadas o una sola.

### 4.5 Perfiles y Páginas

```
Perfiles (globales)
├── "General"
│   ├── Página 1 (6 botones)
│   ├── Página 2 (6 botones)
│   └── ...
├── "VS Code"
│   ├── Página 1
│   └── ...
└── "Streaming"
    ├── ...
```

- **Perfiles**: globales, aplican a cualquier tarjeta. El usuario selecciona desde un dropdown.
- **Páginas**: dentro de cada perfil. Multiplican la cantidad de funciones usando los mismos botones físicos.
- **Navegación**: un botón puede configurarse para "Siguiente página", "Página anterior", "Ir a perfil X".

### 4.6 Guardado

- Archivo JSON por perfil: `%APPDATA%/deckcraft/profiles/<nombre>.json`
- Configuración general: `settings.json` (última tarjeta, preferencias de UI)
- Posibilidad de importar/exportar perfiles.

---

## 5. Modo Segundo Plano (Background)

### 5.1 Tarjetas HID

- El software es solo editor/configurador.
- El usuario guarda configuración → la envía a la tarjeta (si la tarjeta almacena).
- El software puede **cerrarse por completo**; la tarjeta funciona autónoma.

### 5.2 Tarjetas no-HID (Arduino Uno, etc.)

- El software actúa como **puente**: recibe señal Serial → ejecuta la acción en Windows (tecla, app, etc.).
- Al cerrar ventana: el proceso se minimiza a **system tray** (icono en bandeja).
- Consumo mínimo: solo el runtime Rust, sin WebView2 visible.
- El usuario puede salir del tray para cerrar de verdad.

### 5.3 Detección de Modo

- No preguntar al usuario. El software sabe si la tarjeta es HID o Serial y decide automáticamente si puede cerrarse o debe quedar en segundo plano.

---

## 6. Comunicación con la Tarjeta (Protocolo Serial)

### 6.1 Board → PC (eventos) — MVP

La tarjeta solo envía pulsaciones. El software hace auto-release (50ms).

```
P:<id_boton>\n
```

- `P` = Press. Un único carácter seguido de `:` + ID numérico + `\n`.
- El firmware no necesita debouncing complejo, ni mantener estado, ni detectar release.
- El software en Rust recibe `P:<id>` → busca la acción configurada → la ejecuta → suelta automáticamente la tecla tras 50ms.

**¿Por qué texto plano y no `P:<id>` crudo?** `sscanf(buf, "P:%d", &id)` en el Arduino consume ~100µs. JSON ocuparía 5-10× más RAM y ciclos. Con 2KB de RAM en un Uno, texto plano mínimo es la decisión correcta para el hot path.

### 6.2 PC → Board (configuración)

Comandos menos frecuentes, sin restricción de latencia, puede ser texto más descriptivo:

```
PAGE:<n>\n
PROFILE:<nombre>\n
LED:<id>:<r,g,b>\n
RESET\n
```

### 6.3 Heartbeat

`PING\n` del PC → board responde `PONG\n`. Cada 5s. Si se pierde la conexión, el software lo detecta y puede reintentar reconexión automática.

### 6.4 Limitante conocida — Tecla sostenida

Auto-release de 50ms funciona para todas las acciones del MVP: lanzar apps, atajos de teclado, escribir texto, abrir URLs.

**No funciona para**: push-to-talk (Discord), mantener una tecla en un juego, o cualquier acción que requiera "dedo presionado sostenido".

**Solución futura (Fase 3+)**: Añadir un flag por botón en la UI: "Modo sostenido". Cuando está activo, el firmware envía `P:<id>` al presionar y `R:<id>` al soltar (requiere debouncing y detección de release en firmware). Sin overengineering para el MVP.

---

## 7. UI / UX Principios

- **Wizard inicial** que guía: conectar → detectar → mapear → diseñar.
- Interfaz limpia, oscura (modo dark por defecto por ser herramienta de productividad).
- Drag & drop nativo (HTML5 Drag & Drop o librería minimalista como `@dnd-kit`).
- Sin animaciones pesadas ni efectos innecesarios (rendimiento > estética).
- Responsive minimum: la ventana parte en 900×700, redimensionable.

---

## 8. Roadmap

### Fase 1 — MVP (Funcionalidad básica)
- [ ] Escaneo Serial + detección de tarjeta
- [ ] UI de mapeo (presionar botones → nodos en lienzo)
- [ ] Drag & drop básico (posicionamiento libre)
- [ ] Modal de botón: grabar teclas + lanzar app
- [ ] Guardar/cargar 1 perfil
- [ ] Bridge teclado (recibir Serial → emitir teclas en Windows)
- [ ] System tray para no-HID

### Fase 2 — Perfiles y páginas
- [ ] Múltiples perfiles
- [ ] Páginas/layers dentro del perfil
- [ ] Botón de navegación entre páginas/perfiles
- [ ] Importar/exportar perfiles

### Fase 3 — HID + features avanzadas
- [ ] Detección y comunicación HID
- [ ] Multiacción por botón
- [ ] Modo sostenido (push-to-talk, gaming) — requiere `R:<id>` en firmware
- [ ] Escribir texto, abrir URL, comandos
- [ ] LEDs/retroalimentación visual en tarjeta (si soporta)

### Fase 4 — Pulido
- [ ] Auto-arranque con Windows
- [ ] Detección automática de conexión/reconexión
- [ ] Temas visuales
- [ ] Internacionalización (i18n)

---

## 9. Decisiones Tomadas (Dudas Resueltas)

| Duda | Decisión | Razón |
|------|----------|-------|
| **Protocolo board→PC** | `P:<id>\n` texto plano, sin JSON | Arduino Uno tiene 2KB RAM; parsear JSON es inviable. `sscanf` corre en µs. |
| **Release vs auto-release** | Auto-release 50ms en PC para MVP | Simplifica firmware al máximo; cubre todas las acciones del MVP. |
| **Emulación de teclado** | `enigo` crate | Maduro, abstrae `SendInput` limpiamente, soporta modifiers. |
| **Almacenamiento** | JSON local en `%APPDATA%` | Privacidad, sin servidores, portable por copia manual. |
| **Seguridad comandos** | `std::process::Command` con privilegios del usuario | Estándar de la industria (Stream Deck, PowerToys). Warning visual en UI. |

### Próximos Pasos

1. **Ejemplo de firmware Arduino** para probar el MVP
2. Decidir layout inicial de UI (wizard de detección + lienzo)
3. Empezar Fase 1

---

## 10. Notas Técnicas

- **Tauri v2 + React 19**: ya scaffold, empezar desde ahí.
- **`serialport`**: testear en Windows con un Arduino conectado.
- **`hidapi`**: testear con un dispositivo HID real.
- **En segundo plano**: Tauri `Window::hide()` + `TrayIcon` + mantener el event loop de Rust.
- **Emulación de teclas**: `enigo` crate sobre `SendInput`. Para acciones atómicas: keydown + 50ms delay + keyup.
- **Lanzar aplicaciones**: `std::process::Command` (más control que `tauri-plugin-opener`).

use serde::Serialize;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

// ── Shared state ───────────────────────────────────────────────────

struct AppState {
    kill_switch: Arc<AtomicBool>,
}

// ── Device types ───────────────────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedDevice {
    pub name: String,
    pub port: String,
    pub device_type: String,
}

#[derive(Clone, Serialize)]
pub struct ButtonEvent {
    pub id: u32,
}

// ── Key map ────────────────────────────────────────────────────────

fn key_map() -> HashMap<&'static str, u16> {
    let mut m = HashMap::new();
    m.insert("Ctrl", 0x11); m.insert("Shift", 0x10);
    m.insert("Alt", 0x12); m.insert("Win", 0x5B);
    for i in 0..=9 { m.insert(Box::leak(i.to_string().into_boxed_str()), 0x30 + i); }
    for i in 0..26 { m.insert(Box::leak(char::from(b'A' + i as u8).to_string().into_boxed_str()), 0x41 + i); }
    for i in 0..=24 { m.insert(Box::leak(format!("F{}", i + 1).into_boxed_str()), 0x70 + i); }
    m.insert("Space", 0x20); m.insert("Enter", 0x0D);
    m.insert("Tab", 0x09); m.insert("Backspace", 0x08);
    m.insert("Escape", 0x1B); m.insert("Delete", 0x2E);
    m.insert("Home", 0x24); m.insert("End", 0x23);
    m.insert("PageUp", 0x21); m.insert("PageDown", 0x22);
    m.insert("Insert", 0x2D); m.insert("Up", 0x26);
    m.insert("Down", 0x28); m.insert("Left", 0x25);
    m.insert("Right", 0x27);
    m.insert("MediaPlayPause", 0xB3); m.insert("MediaStop", 0xB2);
    m.insert("MediaTrackNext", 0xB0); m.insert("MediaTrackPrevious", 0xB1);
    m.insert("VolumeMute", 0xAD); m.insert("VolumeDown", 0xAE); m.insert("VolumeUp", 0xAF);
    m.insert("AudioVolumeMute", 0xAD); m.insert("AudioVolumeDown", 0xAE); m.insert("AudioVolumeUp", 0xAF);
    m.insert("LaunchMail", 0xB4);
    m
}

// ── SendInput helpers ──────────────────────────────────────────────

const INPUT_KEYBOARD: u32 = 1;
const KEYEVENTF_KEYUP: u32 = 0x0002;
const KEYEVENTF_UNICODE: u32 = 0x0004;

#[repr(C)]
struct KEYBDINPUT { w_vk: u16, w_scan: u16, dw_flags: u32, time: u32, dw_extra_info: usize }
#[repr(C)]
struct MOUSEINPUT { dx: i32, dy: i32, mouse_data: u32, dw_flags: u32, time: u32, dw_extra_info: usize }
#[repr(C)]
union INPUT_UNION { ki: std::mem::ManuallyDrop<KEYBDINPUT>, mi: std::mem::ManuallyDrop<MOUSEINPUT> }
#[repr(C)]
struct INPUT { type_: u32, u: INPUT_UNION }

#[link(name = "user32")]
extern "system" { fn SendInput(c_inputs: u32, p_inputs: *mut INPUT, cb_size: i32) -> u32; }

fn send_keydown(vk: u16) -> INPUT { INPUT { type_: INPUT_KEYBOARD, u: INPUT_UNION { ki: std::mem::ManuallyDrop::new(KEYBDINPUT { w_vk: vk, w_scan: 0, dw_flags: 0, time: 0, dw_extra_info: 0 }) } } }
fn send_keyup(vk: u16) -> INPUT { INPUT { type_: INPUT_KEYBOARD, u: INPUT_UNION { ki: std::mem::ManuallyDrop::new(KEYBDINPUT { w_vk: vk, w_scan: 0, dw_flags: KEYEVENTF_KEYUP, time: 0, dw_extra_info: 0 }) } } }

fn send_input(input: &INPUT) -> bool {
    unsafe { SendInput(1, input as *const _ as *mut _, std::mem::size_of::<INPUT>() as i32) > 0 }
}

#[tauri::command]
fn send_keys(combo: String) -> Result<(), String> {
    let map = key_map();
    let parts: Vec<&str> = combo.split('+').map(|s| s.trim()).collect();
    let vks: Vec<u16> = parts.iter().filter_map(|p| map.get(p).copied()).collect();
    if vks.is_empty() {
        return Err(format!("No keys mapped for combo: {}", combo));
    }
    for &vk in &vks { if !send_input(&send_keydown(vk)) { return Err("SendInput modifier down failed".into()); } }
    std::thread::sleep(std::time::Duration::from_millis(30));
    for &vk in vks.iter().rev() { if !send_input(&send_keyup(vk)) { return Err("SendInput modifier up failed".into()); } }
    Ok(())
}

#[tauri::command]
fn type_text(text: String) -> Result<(), String> {
    let mut inputs = Vec::with_capacity(text.len() * 2);
    for ch in text.encode_utf16() {
        inputs.push(INPUT { type_: INPUT_KEYBOARD, u: INPUT_UNION { ki: std::mem::ManuallyDrop::new(KEYBDINPUT { w_vk: 0, w_scan: ch, dw_flags: KEYEVENTF_UNICODE, time: 0, dw_extra_info: 0 }) } });
        inputs.push(INPUT { type_: INPUT_KEYBOARD, u: INPUT_UNION { ki: std::mem::ManuallyDrop::new(KEYBDINPUT { w_vk: 0, w_scan: ch, dw_flags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, time: 0, dw_extra_info: 0 }) } });
    }
    if inputs.is_empty() { return Ok(()); }
    let sent = unsafe { SendInput(inputs.len() as u32, inputs.as_mut_ptr(), std::mem::size_of::<INPUT>() as i32) };
    if sent == 0 { return Err("SendInput (text) failed".into()); }
    Ok(())
}

// ── App scanner ────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct AppInfo { pub name: String, pub path: String }

#[tauri::command]
fn scan_apps() -> Vec<AppInfo> {
    let mut apps = Vec::new();
    let dirs = vec![
        format!(r"{}\Microsoft\Windows\Start Menu\Programs", std::env::var("APPDATA").unwrap_or_default()),
        format!(r"{}\Microsoft\Windows\Start Menu\Programs", std::env::var("PROGRAMDATA").unwrap_or_default()),
    ];
    for dir in &dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                if ext == "lnk" || ext == "url" || ext == "exe" {
                    if let Some(name) = path.file_stem().and_then(|n| n.to_str()) {
                        apps.push(AppInfo { name: name.to_string(), path: path.to_string_lossy().to_string() });
                    }
                }
                if path.is_dir() {
                    if let Ok(sub) = std::fs::read_dir(&path) {
                        for e in sub.flatten() {
                            let p = e.path();
                            let ext = p.extension().and_then(|x| x.to_str()).unwrap_or("").to_lowercase();
                            if ext == "lnk" || ext == "url" || ext == "exe" {
                                if let Some(name) = p.file_stem().and_then(|n| n.to_str()) {
                                    apps.push(AppInfo { name: name.to_string(), path: p.to_string_lossy().to_string() });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.name.eq_ignore_ascii_case(&b.name));
    apps
}

#[tauri::command]
fn shell_open(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    let ext = p.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase());
    let is_exe = matches!(ext.as_deref(), Some("exe" | "bat" | "cmd" | "com"));
    if is_exe {
        std::process::Command::new(&path)
            .spawn()
            .map_err(|e| format!("Failed to open {}: {}", path, e))?;
    } else {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| format!("Failed to open {}: {}", path, e))?;
    }
    Ok(())
}

// ── Device scanning ────────────────────────────────────────────────

const KNOWN_VIDS: &[u16] = &[
    0x2341, 0x2A03, // Arduino
    0x1B4F,         // SparkFun
    0x16D0,         // DFRobot
    0x0403,         // FTDI
    0x10C4, 0x1C4F, // Silicon Labs CP210x
    0x1A86,         // WCH CH340/CH341
    0x2E8A,         // Raspberry Pi RP2040
    0x239A,         // Adafruit
    0x303A,         // Espressif ESP32-S2/S3/C3
    0x0483,         // STMicroelectronics
];

fn is_known_board(port_name: &str) -> bool {
    if let Ok(ports) = serialport::available_ports() {
        for p in &ports {
            if p.port_name == port_name {
                if let serialport::SerialPortType::UsbPort(info) = &p.port_type {
                    return KNOWN_VIDS.contains(&info.vid);
                }
            }
        }
    }
    false
}

#[tauri::command]
fn scan_devices() -> Vec<ScannedDevice> {
    let mut devices = Vec::new();

    if let Ok(ports) = serialport::available_ports() {
        for p in &ports {
            if let serialport::SerialPortType::UsbPort(info) = &p.port_type {
                let name = info.product.clone().or_else(|| info.manufacturer.clone()).unwrap_or_else(|| format!("Device on {}", p.port_name));
                let known = KNOWN_VIDS.contains(&info.vid);
                let name = if known { name } else { format!("{} (unknown)", name) };
                devices.push(ScannedDevice { name, port: p.port_name.clone(), device_type: "serial".into() });
            }
        }
    }

    if let Ok(api) = hidapi::HidApi::new() {
        for d in api.device_list() {
            let vid = d.vendor_id();
            if !KNOWN_VIDS.contains(&vid) { continue; }
            let name = d.product_string().unwrap_or("Unknown").to_string();
            let name = if name.is_empty() { format!("HID board {:04x}:{:04x}", vid, d.product_id()) } else { name };
            let port = format!("HID:{:04x}:{:04x}", vid, d.product_id());
            devices.push(ScannedDevice { name, port, device_type: "hid".into() });
        }
    }

    devices
}

#[tauri::command]
fn connect_device(port: String, device_type: String, force: Option<bool>, app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let force = force.unwrap_or(false);
    match device_type.as_str() {
        "serial" => connect_serial(&port, force, app, state),
        "hid" => Err("HID mode not implemented yet".into()),
        _ => Err(format!("Unknown device type: {}", device_type)),
    }
}

fn connect_serial(port: &str, force: bool, app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    // Kill previous reader thread if any
    state.kill_switch.store(true, Ordering::SeqCst);
    std::thread::sleep(std::time::Duration::from_millis(300));

    let builder = serialport::new(port, 115_200)
        .timeout(std::time::Duration::from_millis(200));

    let mut serial = builder.open().map_err(|e| {
        if matches!(e.kind(), serialport::ErrorKind::Io(k) if k == std::io::ErrorKind::PermissionDenied) {
            format!("Port {} is in use. Close other programs (Arduino IDE, Serial Monitor) and try again.", port)
        } else {
            format!("Cannot open {}: {}", port, e)
        }
    })?;

    if !force && !is_known_board(port) {
        serial.write_all(b"PING\n").map_err(|e| format!("Write error: {}", e))?;
        let mut buf = [0u8; 32];
        let mut response = String::new();
        for _ in 0..25 {
            match serial.read(&mut buf) {
                Ok(n) => { response.push_str(&String::from_utf8_lossy(&buf[..n])); if response.contains("PONG") { break; } }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(e) => return Err(format!("Read error: {}", e)),
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        if !response.contains("PONG") {
            return Err("NO_PONG".into());
        }
    }

    let kill = state.kill_switch.clone();
    kill.store(false, Ordering::SeqCst);
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 64];
        let mut acc = String::new();
        loop {
            if kill.load(Ordering::SeqCst) { break; }
            match serial.read(&mut buf) {
                Ok(n) => {
                    acc.push_str(&String::from_utf8_lossy(&buf[..n]));
                    while let Some(pos) = acc.find('\n') {
                        let line = acc[..pos].trim();
                        if let Some(rest) = line.strip_prefix("P:") {
                            if let Ok(id) = rest.trim().parse::<u32>() {
                                let _ = app_clone.emit("button-down", ButtonEvent { id });
                            }
                        } else if let Some(rest) = line.strip_prefix("R:") {
                            if let Ok(id) = rest.trim().parse::<u32>() {
                                let _ = app_clone.emit("button-up", ButtonEvent { id });
                            }
                        }
                        acc.drain(..=pos);
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(_) => {
                    let _ = app_clone.emit("device-disconnected", ());
                    break;
                }
            }
        }
        // serial dropped here → port closed
    });

    Ok(())
}

#[tauri::command]
fn disconnect_device(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.kill_switch.store(true, Ordering::SeqCst);
    Ok(())
}

// ── App entry ──────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { kill_switch: Arc::new(AtomicBool::new(false)) })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_apps, type_text, send_keys,
            scan_devices, connect_device, disconnect_device,
            shell_open,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

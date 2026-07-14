use serde::Serialize;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
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

// ── Icon extraction (Windows) ─────────────────────────────────────

#[cfg(windows)]
mod icons {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use base64::Engine;

    #[repr(C)]
    struct SHFILEINFOW { hIcon: isize, iIcon: i32, dwAttributes: u32, szDisplayName: [u16; 260], szTypeName: [u16; 80] }

    const SHGFI_ICON: u32 = 0x100;

    #[link(name = "shell32")]
    extern "system" { fn SHGetFileInfoW(pszPath: *const u16, dwFileAttributes: u32, psfi: *mut SHFILEINFOW, cbFileInfo: u32, uFlags: u32) -> usize; }

    #[link(name = "user32")]
    extern "system" { fn DestroyIcon(hIcon: isize) -> i32; fn GetIconInfo(hIcon: isize, piconinfo: *mut ICONINFO) -> i32; }

    #[link(name = "gdi32")]
    extern "system" { fn CreateCompatibleDC(hdc: isize) -> isize; fn GetDIBits(hdc: isize, hbmp: isize, start: u32, lines: u32, lpvBits: *mut u8, lpbmi: *mut BITMAPINFO, usage: u32) -> i32; fn DeleteDC(hdc: isize) -> i32; fn DeleteObject(h: isize) -> i32; fn GetObjectW(h: isize, c: i32, pv: *mut std::ffi::c_void) -> i32; }

    #[repr(C)]
    struct ICONINFO { fIcon: i32, xHotspot: u32, yHotspot: u32, hbmMask: isize, hbmColor: isize }

    #[repr(C)]
    struct BITMAP { bmType: i32, bmWidth: i32, bmHeight: i32, bmWidthBytes: i32, bmPlanes: u16, bmBitsPixel: u16, bmBits: *mut std::ffi::c_void }

    #[repr(C)]
    struct BITMAPINFOHEADER { biSize: u32, biWidth: i32, biHeight: i32, biPlanes: u16, biBitCount: u16, biCompression: u32, biSizeImage: u32, biXPelsPerMeter: i32, biYPelsPerMeter: i32, biClrUsed: u32, biClrImportant: u32 }

    #[repr(C)]
    struct BITMAPINFO { bmiHeader: BITMAPINFOHEADER, bmiColors: [u32; 1] }

    pub fn extract(path: &str) -> Option<String> {
        let wide: Vec<u16> = OsStr::new(path).encode_wide().chain(std::iter::once(0)).collect();
        let mut shfi: SHFILEINFOW = unsafe { std::mem::zeroed() };
        if unsafe { SHGetFileInfoW(wide.as_ptr(), 0, &mut shfi, std::mem::size_of::<SHFILEINFOW>() as u32, SHGFI_ICON) } == 0 || shfi.hIcon == 0 {
            return None;
        }
        let hicon = shfi.hIcon;
        let result = to_png(hicon);
        unsafe { DestroyIcon(hicon); }
        result
    }

    fn to_png(hicon: isize) -> Option<String> {
        unsafe {
            let mut ii: ICONINFO = std::mem::zeroed();
            if GetIconInfo(hicon, &mut ii) == 0 { return None; }
            let mut bm: BITMAP = std::mem::zeroed();
            if GetObjectW(ii.hbmColor, std::mem::size_of::<BITMAP>() as i32, &mut bm as *mut _ as *mut _) == 0 { DeleteObject(ii.hbmColor); DeleteObject(ii.hbmMask); return None; }
            let (w, h) = (bm.bmWidth, bm.bmHeight);
            if w <= 0 || h <= 0 || w > 256 || h > 256 { DeleteObject(ii.hbmColor); DeleteObject(ii.hbmMask); return None; }
            let hdc = CreateCompatibleDC(0);
            if hdc == 0 { DeleteObject(ii.hbmColor); DeleteObject(ii.hbmMask); return None; }
            let mut bmi: BITMAPINFO = std::mem::zeroed();
            bmi.bmiHeader = BITMAPINFOHEADER { biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32, biWidth: w, biHeight: -h, biPlanes: 1, biBitCount: 32, biCompression: 0, biSizeImage: 0, biXPelsPerMeter: 0, biYPelsPerMeter: 0, biClrUsed: 0, biClrImportant: 0 };
            let stride = ((w * 32 + 31) / 32) * 4;
            let mut pixels = vec![0u8; (stride * h) as usize];
            if GetDIBits(hdc, ii.hbmColor, 0, h as u32, pixels.as_mut_ptr(), &mut bmi, 0) == 0 { DeleteDC(hdc); DeleteObject(ii.hbmColor); DeleteObject(ii.hbmMask); return None; }
            let mut rgba = vec![0u8; (w * h * 4) as usize];
            for y in 0..h { for x in 0..w { let o = (y * stride + x * 4) as usize; let d = (y * w + x) * 4; rgba[d as usize] = pixels[o + 2]; rgba[d as usize + 1] = pixels[o + 1]; rgba[d as usize + 2] = pixels[o]; rgba[d as usize + 3] = pixels[o + 3]; } }
            DeleteDC(hdc); DeleteObject(ii.hbmColor); DeleteObject(ii.hbmMask);
            let png = lodepng::encode32(&rgba, w as u32, h as u32).ok()?;
            Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)))
        }
    }
}

// ── App scanner ────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct AppInfo { pub name: String, pub path: String, pub icon: Option<String> }

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
                        let p = path.to_string_lossy().to_string();
                        let icon = icons::extract(&p);
                        apps.push(AppInfo { name: name.to_string(), path: p, icon });
                    }
                }
                if path.is_dir() {
                    if let Ok(sub) = std::fs::read_dir(&path) {
                        for e in sub.flatten() {
                            let p = e.path();
                            let ext = p.extension().and_then(|x| x.to_str()).unwrap_or("").to_lowercase();
                            if ext == "lnk" || ext == "url" || ext == "exe" {
                                if let Some(name) = p.file_stem().and_then(|n| n.to_str()) {
                                    let p_str = p.to_string_lossy().to_string();
                                    let icon = icons::extract(&p_str);
                                    apps.push(AppInfo { name: name.to_string(), path: p_str, icon });
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

// ── Audio playback ─────────────────────────────────────────────────

use cpal::traits::{DeviceTrait, HostTrait};
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};

struct PlayingAudio {
    cancel: Arc<AtomicBool>,
}

struct AudioState {
    playing: Mutex<HashMap<String, PlayingAudio>>,
}

#[tauri::command]
fn list_audio_devices() -> Vec<String> {
    cpal::default_host()
        .output_devices()
        .map(|devices| devices.filter_map(|d| d.name().ok()).collect())
        .unwrap_or_default()
}

fn find_device(name: Option<&str>) -> Result<cpal::Device, String> {
    name.and_then(|n| {
        cpal::default_host().output_devices().ok()?.find(|d| d.name().ok().as_deref() == Some(n))
    }).or_else(|| cpal::default_host().default_output_device())
      .ok_or_else(|| "No audio device available".to_string())
}

fn try_open_with(dev: &cpal::Device, rate: u32, channels: u16) -> Result<(OutputStream, OutputStreamHandle), String> {
    for fmt in [cpal::SampleFormat::F32, cpal::SampleFormat::I16] {
        let Ok(configs) = dev.supported_output_configs() else { continue };
        for c in configs {
            if c.channels() == channels && c.sample_format() == fmt
                && c.min_sample_rate() <= cpal::SampleRate(rate)
                && c.max_sample_rate() >= cpal::SampleRate(rate)
            {
                if let Ok(ok) = OutputStream::try_from_device_config(dev, c.with_sample_rate(cpal::SampleRate(rate))) {
                    return Ok(ok);
                }
            }
        }
    }
    // fallback: try stereo
    for fmt in [cpal::SampleFormat::F32, cpal::SampleFormat::I16] {
        let Ok(configs) = dev.supported_output_configs() else { continue };
        for c in configs {
            if c.channels() == 2 && c.sample_format() == fmt
                && c.min_sample_rate() <= cpal::SampleRate(rate)
                && c.max_sample_rate() >= cpal::SampleRate(rate)
            {
                if let Ok(ok) = OutputStream::try_from_device_config(dev, c.with_sample_rate(cpal::SampleRate(rate))) {
                    return Ok(ok);
                }
            }
        }
    }
    OutputStream::try_from_device(dev).map_err(|e| format!("Audio error: {}", e))
}

#[tauri::command]
fn play_audio(path: String, device: Option<String>, state: tauri::State<'_, AudioState>) -> Result<(), String> {
    let mut playing = state.playing.lock().map_err(|_| "Lock error".to_string())?;

    if let Some(audio) = playing.get(&path) {
        if !audio.cancel.load(Ordering::SeqCst) {
            audio.cancel.store(true, Ordering::SeqCst);
            playing.remove(&path);
            return Ok(());
        }
        playing.remove(&path);
    }

    let cancel = Arc::new(AtomicBool::new(false));
    let cancel_clone = cancel.clone();
    let path2 = path.clone();

    std::thread::spawn(move || {
        // Probe the file to get its sample rate & channels before opening output
        let (rate, channels) = {
            let file = match std::fs::File::open(&path2) {
                Ok(f) => f,
                Err(_) => { cancel_clone.store(true, Ordering::SeqCst); return; }
            };
            let source = match Decoder::new(std::io::BufReader::new(file)) {
                Ok(s) => s,
                Err(_) => { cancel_clone.store(true, Ordering::SeqCst); return; }
            };
            (source.sample_rate(), source.channels())
        };
        // drop(source) — the file is re-opened below

        let dev = match find_device(device.as_deref()) {
            Ok(d) => d,
            Err(_) => { cancel_clone.store(true, Ordering::SeqCst); return; }
        };
        let (_stream, handle) = match try_open_with(&dev, rate, channels) {
            Ok(s) => s,
            Err(_) => {
                // Last attempt: let rodio figure it out
                let Ok(s) = OutputStream::try_from_device(&dev) else {
                    cancel_clone.store(true, Ordering::SeqCst); return;
                };
                s
            }
        };
        let sink = match Sink::try_new(&handle) {
            Ok(s) => s,
            Err(_) => { cancel_clone.store(true, Ordering::SeqCst); return; }
        };
        let file = match std::fs::File::open(&path2) {
            Ok(f) => f,
            Err(_) => { cancel_clone.store(true, Ordering::SeqCst); return; }
        };
        if let Ok(source) = Decoder::new(std::io::BufReader::new(file)) {
            sink.append(source);
            while !sink.empty() && !cancel_clone.load(Ordering::SeqCst) {
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        }
        sink.stop();
        cancel_clone.store(true, Ordering::SeqCst);
    });

    playing.insert(path, PlayingAudio { cancel });
    Ok(())
}

#[tauri::command]
fn stop_audio(path: String, state: tauri::State<'_, AudioState>) -> Result<(), String> {
    let mut playing = state.playing.lock().map_err(|_| "Lock error".to_string())?;
    if let Some(audio) = playing.remove(&path) {
        audio.cancel.store(true, Ordering::SeqCst);
    }
    Ok(())
}

// ── App entry ──────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { kill_switch: Arc::new(AtomicBool::new(false)) })
        .manage(AudioState { playing: Mutex::new(HashMap::new()) })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_apps, type_text, send_keys,
            scan_devices, connect_device, disconnect_device,
            shell_open,
            list_audio_devices, play_audio, stop_audio,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

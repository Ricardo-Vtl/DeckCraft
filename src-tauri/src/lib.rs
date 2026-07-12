use serde::Serialize;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Mutex};
use std::thread;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
}

// ── Global keyboard hook (WinAPI) ──────────────────────────────────

#[repr(C)]
struct MSG {
    hwnd: isize,
    message: u32,
    w_param: usize,
    l_param: isize,
    time: u32,
    pt_x: i32,
    pt_y: i32,
}

type HOOKPROC = unsafe extern "system" fn(i32, usize, isize) -> isize;

#[link(name = "user32")]
extern "system" {
    fn SetWindowsHookExW(
        id_hook: i32,
        lpfn: Option<HOOKPROC>,
        hmod: isize,
        dw_thread_id: u32,
    ) -> isize;
    fn UnhookWindowsHookEx(hhk: isize) -> i32;
    fn CallNextHookEx(hhk: isize, n_code: i32, w_param: usize, l_param: isize) -> isize;
    fn GetMessageW(lp_msg: *mut MSG, h_wnd: isize, w_msg_min: u32, w_msg_max: u32) -> i32;
    fn PostThreadMessageW(id_thread: u32, msg: u32, w_param: usize, l_param: isize) -> i32;
    fn GetCurrentThreadId() -> u32;
}

#[link(name = "kernel32")]
extern "system" {
    fn GetModuleHandleW(lp_module_name: *const u16) -> isize;
}

const WH_KEYBOARD_LL: i32 = 13;
const WM_KEYDOWN: u32 = 0x0100;
const WM_SYSKEYDOWN: u32 = 0x0104;
const WM_KEYUP: u32 = 0x0101;
const WM_SYSKEYUP: u32 = 0x0105;
const WM_QUIT: u32 = 0x0012;

const VK_LCONTROL: u32 = 0xA2;
const VK_RCONTROL: u32 = 0xA3;
const VK_LSHIFT: u32 = 0xA0;
const VK_RSHIFT: u32 = 0xA1;
const VK_LMENU: u32 = 0xA4;
const VK_RMENU: u32 = 0xA5;
const VK_LWIN: u32 = 0x5B;
const VK_RWIN: u32 = 0x5C;

fn is_modifier(vk: u32) -> bool {
    matches!(
        vk,
        VK_LCONTROL | VK_RCONTROL | VK_LSHIFT | VK_RSHIFT | VK_LMENU | VK_RMENU | VK_LWIN | VK_RWIN
    )
}

fn modifier_name(vk: u32) -> Option<&'static str> {
    match vk {
        VK_LCONTROL | VK_RCONTROL => Some("Ctrl"),
        VK_LSHIFT | VK_RSHIFT => Some("Shift"),
        VK_LMENU | VK_RMENU => Some("Alt"),
        VK_LWIN | VK_RWIN => Some("Win"),
        _ => None,
    }
}

fn vk_to_name(vk: u32) -> String {
    if let Some(name) = modifier_name(vk) {
        return name.into();
    }
    match vk {
        0x08 => "Backspace".into(),
        0x09 => "Tab".into(),
        0x0D => "Enter".into(),
        0x1B => "Escape".into(),
        0x20 => "Space".into(),
        0x21 => "PageUp".into(),
        0x22 => "PageDown".into(),
        0x23 => "End".into(),
        0x24 => "Home".into(),
        0x25 => "Left".into(),
        0x26 => "Up".into(),
        0x27 => "Right".into(),
        0x28 => "Down".into(),
        0x2E => "Delete".into(),
        0x2D => "Insert".into(),
        0x2C => "PrintScreen".into(),
        0x90 => "NumLock".into(),
        0x91 => "ScrollLock".into(),
        0x30 => "0".into(),
        0x31 => "1".into(),
        0x32 => "2".into(),
        0x33 => "3".into(),
        0x34 => "4".into(),
        0x35 => "5".into(),
        0x36 => "6".into(),
        0x37 => "7".into(),
        0x38 => "8".into(),
        0x39 => "9".into(),
        0x41 => "A".into(),
        0x42 => "B".into(),
        0x43 => "C".into(),
        0x44 => "D".into(),
        0x45 => "E".into(),
        0x46 => "F".into(),
        0x47 => "G".into(),
        0x48 => "H".into(),
        0x49 => "I".into(),
        0x4A => "J".into(),
        0x4B => "K".into(),
        0x4C => "L".into(),
        0x4D => "M".into(),
        0x4E => "N".into(),
        0x4F => "O".into(),
        0x50 => "P".into(),
        0x51 => "Q".into(),
        0x52 => "R".into(),
        0x53 => "S".into(),
        0x54 => "T".into(),
        0x55 => "U".into(),
        0x56 => "V".into(),
        0x57 => "W".into(),
        0x58 => "X".into(),
        0x59 => "Y".into(),
        0x5A => "Z".into(),
        0x70 => "F1".into(),
        0x71 => "F2".into(),
        0x72 => "F3".into(),
        0x73 => "F4".into(),
        0x74 => "F5".into(),
        0x75 => "F6".into(),
        0x76 => "F7".into(),
        0x77 => "F8".into(),
        0x78 => "F9".into(),
        0x79 => "F10".into(),
        0x7A => "F11".into(),
        0x7B => "F12".into(),
        0x7C => "F13".into(),
        0x7D => "F14".into(),
        0x7E => "F15".into(),
        0x7F => "F16".into(),
        0x80 => "F17".into(),
        0x81 => "F18".into(),
        0x82 => "F19".into(),
        0x83 => "F20".into(),
        0x84 => "F21".into(),
        0x85 => "F22".into(),
        0x86 => "F23".into(),
        0x87 => "F24".into(),
        0xBA => ";".into(),
        0xBB => "=".into(),
        0xBC => ",".into(),
        0xBD => "-".into(),
        0xBE => ".".into(),
        0xBF => "/".into(),
        0xC0 => "`".into(),
        0xDB => "[".into(),
        0xDC => "\\".into(),
        0xDD => "]".into(),
        0xDE => "'".into(),
        _ => format!("VK_{vk}"),
    }
}

// ── Global hook state ──────────────────────────────────────────────

static HOOK_RUNNING: AtomicBool = AtomicBool::new(false);
static HOOK_KEYS: Mutex<Option<HashSet<u32>>> = Mutex::new(None);
static HOOK_SENDER: Mutex<Option<mpsc::Sender<String>>> = Mutex::new(None);

#[repr(C)]
struct KBDLLHOOKSTRUCT {
    vk_code: u32,
    scan_code: u32,
    flags: u32,
    time: u32,
    dw_extra_info: usize,
}

unsafe extern "system" fn keyboard_hook(n_code: i32, w_param: usize, l_param: isize) -> isize {
    if n_code >= 0 {
        let kbd = &*(l_param as *const KBDLLHOOKSTRUCT);
        let down = w_param as u32 == WM_KEYDOWN || w_param as u32 == WM_SYSKEYDOWN;
        let up = w_param as u32 == WM_KEYUP || w_param as u32 == WM_SYSKEYUP;

        let mut guard = HOOK_KEYS.lock().unwrap();
        if let Some(ref mut keys) = *guard {
            if down {
                keys.insert(kbd.vk_code);
            } else if up {
                keys.remove(&kbd.vk_code);
            }

            if down && !is_modifier(kbd.vk_code) {
                let mut mods: Vec<&str> = Vec::new();
                let mut main = String::new();
                for &vk in keys.iter() {
                    if let Some(name) = modifier_name(vk) {
                        if !mods.contains(&name) {
                            mods.push(name);
                        }
                    } else {
                        main = vk_to_name(vk);
                    }
                }
                let mut combo = String::new();
                for m in ["Ctrl", "Shift", "Alt", "Win"] {
                    if mods.contains(&m) {
                        if !combo.is_empty() { combo.push('+'); }
                        combo.push_str(m);
                    }
                }
                if !main.is_empty() {
                    if !combo.is_empty() { combo.push('+'); }
                    combo.push_str(&main);
                }
                drop(guard);

                if let Some(ref sender) = *HOOK_SENDER.lock().unwrap() {
                    let _ = sender.send(combo);
                }
                // Wake the message loop so it exits
                PostThreadMessageW(GetCurrentThreadId(), WM_QUIT, 0, 0);
            }
        }
    }

    CallNextHookEx(0, n_code, w_param, l_param)
}

/// Starts a global keyboard hook and waits until the user presses
/// a key combination (modifier + non-modifier). Returns the combo string.
#[tauri::command]
async fn capture_key_combo() -> Result<String, String> {
    if HOOK_RUNNING.swap(true, Ordering::SeqCst) {
        return Err("Ya está capturando".into());
    }

    let (tx, rx) = mpsc::channel();
    *HOOK_SENDER.lock().unwrap() = Some(tx);
    *HOOK_KEYS.lock().unwrap() = Some(HashSet::new());

    thread::spawn(move || {
        unsafe {
            let hmod = GetModuleHandleW(std::ptr::null());
            let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook as HOOKPROC), hmod, 0);
            if hook == 0 {
                HOOK_RUNNING.store(false, Ordering::SeqCst);
                let _ = HOOK_KEYS.lock().unwrap().take();
                if let Some(sender) = HOOK_SENDER.lock().unwrap().take() {
                    let _ = sender.send(String::new());
                }
                return;
            }

            // Standard message loop — blocks until WM_QUIT arrives
            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, 0, 0, 0) > 0 {
                // Hook callback fires inside GetMessageW
            }

            UnhookWindowsHookEx(hook);
            HOOK_RUNNING.store(false, Ordering::SeqCst);
            let _ = HOOK_KEYS.lock().unwrap().take();
        }
    });

    // Wait for the combo on a blocking thread
    let combo = tokio::task::spawn_blocking(move || rx.recv().ok())
        .await
        .map_err(|_| "Tarea cancelada".to_string())?
        .ok_or("No se capturó ninguna combinación".to_string())?;

    if combo.is_empty() {
        return Err("El hook no se pudo instalar".to_string());
    }

    Ok(combo)
}

// ── App scanner ────────────────────────────────────────────────────

#[tauri::command]
fn scan_apps() -> Vec<AppInfo> {
    let mut apps = Vec::new();

    let start_menu_dirs = vec![
        format!(
            r"{}\Microsoft\Windows\Start Menu\Programs",
            std::env::var("APPDATA").unwrap_or_default()
        ),
        format!(
            r"{}\Microsoft\Windows\Start Menu\Programs",
            std::env::var("PROGRAMDATA").unwrap_or_default()
        ),
    ];

    for dir in &start_menu_dirs {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if ext == "lnk" || ext == "url" || ext == "exe" {
                    if let Some(name) = path.file_stem().and_then(|n| n.to_str()) {
                        apps.push(AppInfo {
                            name: name.to_string(),
                            path: path.to_string_lossy().to_string(),
                        });
                    }
                }
            }
            if let Ok(subdirs) = std::fs::read_dir(dir) {
                for sub in subdirs.flatten() {
                    if sub.path().is_dir() {
                        if let Ok(entries) = std::fs::read_dir(sub.path()) {
                            for entry in entries.flatten() {
                                let path = entry.path();
                                let ext = path
                                    .extension()
                                    .and_then(|e| e.to_str())
                                    .unwrap_or("")
                                    .to_lowercase();
                                if ext == "lnk" || ext == "url" || ext == "exe" {
                                    if let Some(name) =
                                        path.file_stem().and_then(|n| n.to_str())
                                    {
                                        apps.push(AppInfo {
                                            name: name.to_string(),
                                            path: path.to_string_lossy().to_string(),
                                        });
                                    }
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

// ── App entry ──────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_apps, capture_key_combo])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

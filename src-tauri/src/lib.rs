use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
}

// ── Type text (SendInput) ──────────────────────────────────────────

const INPUT_KEYBOARD: u32 = 1;
const KEYEVENTF_UNICODE: u32 = 0x0004;
const KEYEVENTF_KEYUP: u32 = 0x0002;

#[repr(C)]
struct KEYBDINPUT {
    w_vk: u16,
    w_scan: u16,
    dw_flags: u32,
    time: u32,
    dw_extra_info: usize,
}

#[repr(C)]
union INPUT_UNION {
    ki: std::mem::ManuallyDrop<KEYBDINPUT>,
}

#[repr(C)]
struct INPUT {
    type_: u32,
    u: INPUT_UNION,
}

#[link(name = "user32")]
extern "system" {
    fn SendInput(c_inputs: u32, p_inputs: *mut INPUT, cb_size: i32) -> u32;
}

#[tauri::command]
fn type_text(text: String) {
    let mut inputs = Vec::with_capacity(text.len() * 2);

    for ch in text.encode_utf16() {
        inputs.push(INPUT {
            type_: INPUT_KEYBOARD,
            u: INPUT_UNION {
                ki: std::mem::ManuallyDrop::new(KEYBDINPUT {
                    w_vk: 0,
                    w_scan: ch,
                    dw_flags: KEYEVENTF_UNICODE,
                    time: 0,
                    dw_extra_info: 0,
                }),
            },
        });
        inputs.push(INPUT {
            type_: INPUT_KEYBOARD,
            u: INPUT_UNION {
                ki: std::mem::ManuallyDrop::new(KEYBDINPUT {
                    w_vk: 0,
                    w_scan: ch,
                    dw_flags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                    time: 0,
                    dw_extra_info: 0,
                }),
            },
        });
    }

    unsafe {
        SendInput(
            inputs.len() as u32,
            inputs.as_mut_ptr(),
            std::mem::size_of::<INPUT>() as i32,
        );
    }
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
        .invoke_handler(tauri::generate_handler![scan_apps, type_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

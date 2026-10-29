use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};

// Written by the host mod, matches Server.Info on the TS side
const INFO_FILE: &str = "info.json";

#[derive(Serialize, Clone)]
pub struct FileChangeEvent {
    pub file: String,
    pub kind: String,
    pub content: String,
}

// Resolves the temp directory the game actually writes to.
// On Windows, this is the normal system temp dir.
// On Linux, the game writes into its Proton prefix's fake windows temp dir instead.
fn resolve_temp_dir() -> PathBuf {
    if cfg!(target_os = "windows") {
        return std::env::temp_dir().join("ATLAS");
    }

    match std::env::var_os("HOME") {
        Some(home) => PathBuf::from(home).join(
            ".steam/steam/steamapps/compatdata/1869590/pfx/drive_c/users/steamuser/AppData/Local/Temp/ATLAS",
        ),
        None => {
            eprintln!("HOME environment variable not set, falling back to std::env::temp_dir()");
            std::env::temp_dir().join("ATLAS")
        }
    }
}

// Current contents of info.json, for the frontend to fetch on load. None if it doesn't exist yet.
#[tauri::command]
pub fn get_server_info() -> Option<String> {
    std::fs::read_to_string(resolve_temp_dir().join(INFO_FILE)).ok()
}

pub fn start_file_watcher(app: AppHandle) {
    let temp_dir = resolve_temp_dir();

    if let Err(e) = std::fs::create_dir_all(&temp_dir) {
        eprintln!("Failed to create temp directory {temp_dir:?}: {e}");
    }

    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();

        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create file watcher: {e}");
                return;
            }
        };

        if let Err(e) = watcher.watch(&temp_dir, RecursiveMode::NonRecursive) {
            eprintln!("Failed to watch temp directory: {e}");
            return;
        }

        // Only dedupe genuine repeats (e.g. Windows firing multiple Modify events for one write)
        let mut last_content: Option<String> = None;

        for result in rx {
            let event = match result {
                Ok(event) => event,
                Err(e) => {
                    eprintln!("File watcher error: {e}");
                    continue;
                }
            };

            let kind = match event.kind {
                EventKind::Create(_) => "created",
                EventKind::Modify(_) => "modified",
                // Removed files have no content to send the frontend
                _ => continue,
            };

            for path in &event.paths {
                if path.file_name().map_or(true, |name| name != INFO_FILE) {
                    continue;
                }

                // Also covers the race where the file gets removed between the event firing and this read
                let Ok(content) = std::fs::read_to_string(path) else {
                    continue;
                };

                // Skip half-written files, the next Modify event will carry the full write
                if serde_json::from_str::<serde_json::Value>(&content).is_err() {
                    continue;
                }

                if last_content.as_ref() == Some(&content) {
                    continue;
                }
                last_content = Some(content.clone());

                let _ = app.emit(
                    "onServerInfoUpdate",
                    FileChangeEvent {
                        file: INFO_FILE.to_string(),
                        kind: kind.to_string(),
                        content,
                    },
                );
            }
        }
    });
}

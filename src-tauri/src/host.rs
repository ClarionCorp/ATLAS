// Spawns the dedicated host game process and streams UE4SS.log to the frontend

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct HostState(Arc<Mutex<Option<Child>>>);

#[tauri::command]
pub fn start_host(app: AppHandle, state: State<HostState>, exe_path: String, args: Vec<String>, log_path: String) -> Result<u32, String> {
    let mut guard = state.0.lock().unwrap();
    if let Some(child) = guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            return Err("Host is already running".into());
        }
    }

    // UE4SS recreates the log on startup, remove the old one so stale lines don't get streamed
    let _ = std::fs::remove_file(&log_path);

    let exe_dir = Path::new(&exe_path).parent().ok_or("Invalid exe path")?;
    let child = Command::new(&exe_path)
        .args(&args)
        .current_dir(exe_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    let pid = child.id();
    *guard = Some(child);
    drop(guard);

    let process = state.0.clone();
    std::thread::spawn(move || watch_host(app, process, pid, log_path));
    Ok(pid)
}

#[tauri::command]
pub fn stop_host(state: State<HostState>) -> Result<(), String> {
    if let Some(mut child) = state.0.lock().unwrap().take() {
        child.kill().map_err(|e| e.to_string())?;
        let _ = child.wait();
    }
    Ok(())
}

// Returns the PID if the host is still running
#[tauri::command]
pub fn host_pid(state: State<HostState>) -> Option<u32> {
    let mut guard = state.0.lock().unwrap();
    let child = guard.as_mut()?;
    match child.try_wait() {
        Ok(None) => Some(child.id()),
        _ => None,
    }
}

// Tails the log and watches for the process to exit. Emits "host-log" per line and "host-exited" with the exit code.
fn watch_host(app: AppHandle, process: Arc<Mutex<Option<Child>>>, pid: u32, log_path: String) {
    let mut offset = 0u64;
    let mut partial = String::new();

    loop {
        // Some(code) once our process is gone, whether it exited, was stopped, or replaced by a new host
        let exited = {
            let mut guard = process.lock().unwrap();
            match guard.as_mut() {
                Some(child) if child.id() == pid => match child.try_wait() {
                    Ok(None) => None,
                    Ok(Some(status)) => { *guard = None; Some(status.code()) }
                    Err(_) => { *guard = None; Some(None) }
                },
                _ => Some(None),
            }
        };

        // Read whatever was appended since last time (one final read after exit too)
        if let Ok(mut file) = File::open(&log_path) {
            let len = file.metadata().map(|m| m.len()).unwrap_or(0);
            if len < offset {
                offset = 0;
                partial.clear();
            }
            if len > offset && file.seek(SeekFrom::Start(offset)).is_ok() {
                let mut buf = Vec::new();
                if let Ok(read) = file.read_to_end(&mut buf) {
                    offset += read as u64;
                    partial.push_str(&String::from_utf8_lossy(&buf));
                    while let Some(i) = partial.find('\n') {
                        let line: String = partial.drain(..=i).collect();
                        let _ = app.emit("host-log", line.trim_end());
                    }
                }
            }
        }

        if let Some(code) = exited {
            let _ = app.emit("host-exited", code);
            break;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}

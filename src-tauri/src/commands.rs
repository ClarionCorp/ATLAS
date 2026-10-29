// Sends commands to the host mod by appending JSONL to TEMP/ATLAS/commands.jsonl

use serde::Serialize;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::LazyLock;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::file_watcher::resolve_temp_dir;

const COMMANDS_FILE: &str = "commands.jsonl";

// Seeded from the current time so IDs keep increasing across ATLAS restarts
static NEXT_ID: LazyLock<AtomicU64> = LazyLock::new(|| {
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
    AtomicU64::new(millis)
});

#[derive(Serialize)]
struct HostCommand<'a> {
    id: String,
    command: &'a str,
    #[serde(skip_serializing_if = "<[String]>::is_empty")]
    args: &'a [String],
}

// Appends one command line and returns its ID
#[tauri::command]
pub fn send_host_command(command: String, args: Option<Vec<String>>) -> Result<String, String> {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed).to_string();
    let args = args.unwrap_or_default();

    let mut line = serde_json::to_string(&HostCommand { id: id.clone(), command: &command, args: &args })
        .map_err(|e| e.to_string())?;
    line.push('\n');

    let dir = resolve_temp_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // Written in a single call so the mod never reads half a line
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join(COMMANDS_FILE))
        .and_then(|mut file| file.write_all(line.as_bytes()))
        .map_err(|e| e.to_string())?;

    Ok(id)
}

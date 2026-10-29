use tauri::Manager;

mod commands;
mod file_watcher;
mod host;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn extract_zip(zip_path: String, dest_dir: String) -> Result<(), String> {
    let file = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    archive.extract(&dest_dir).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(move |app| {
            let data_dir = app.path().app_data_dir().unwrap();
            app.handle().plugin(
                tauri_plugin_libsql::init_with_config(tauri_plugin_libsql::Config {
                    base_path: Some(data_dir),
                    encryption: None,
                })
            )?;
            file_watcher::start_file_watcher(app.handle().clone());
            Ok(())
        })

        .manage(host::HostState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            extract_zip,
            host::start_host,
            host::stop_host,
            host::host_pid,
            file_watcher::get_server_info,
            commands::send_host_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

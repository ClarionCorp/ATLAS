use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
            Ok(())
        })

        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

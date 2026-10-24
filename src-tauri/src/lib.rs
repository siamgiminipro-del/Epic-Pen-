use tauri::{Emitter, Manager};

#[tauri::command]
fn set_click_through(app: tauri::AppHandle, ignore: bool) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn broadcast_action(app: tauri::AppHandle, event: String, payload: serde_json::Value) -> Result<(), String> {
    app.emit(&event, payload).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            broadcast_action,
            close_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running epic pen application");
}

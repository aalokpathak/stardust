mod commands;
mod db;
mod error;
mod export;
mod paths;
mod reminders;
mod window;

use std::{thread, time::Duration};
use tauri::{Manager, WindowEvent};

use db::Db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    paths::isolate_portable_webview();

    tauri::Builder::default()
        // Two windows on one library would each hold a stale copy of it.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = paths::data_dir(app.path().app_data_dir()?);
            let db = Db::open(&dir).map_err(|error| error.0)?;

            if let Some(window) = app.get_webview_window("main") {
                window::restore(&window, &db)?;
            }
            app.manage(db);
            reminders::start(app.handle().clone());

            // The frontend reveals the window after first paint. This is the safety
            // net so a frontend failure can't leave an invisible running process.
            let handle = app.handle().clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_secs(4));
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.show();
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                if let (Some(webview), Some(db)) =
                    (app.get_webview_window("main"), app.try_state::<Db>())
                {
                    window::remember(&webview, &db);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::system_info,
            commands::get_library,
            commands::create_folder,
            commands::rename_folder,
            commands::move_folder,
            commands::delete_folder,
            commands::create_note,
            commands::get_note,
            commands::save_note,
            commands::move_note,
            commands::trash_note,
            commands::restore_note,
            commands::delete_note_forever,
            commands::empty_trash,
            commands::search_notes,
            commands::save_todo,
            commands::delete_todo,
            commands::clear_completed,
            commands::set_setting,
            export::export_text,
            export::export_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Stardust");
}

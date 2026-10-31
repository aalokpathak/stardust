use std::{thread, time::Duration};

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::db::Db;

const CHECK_EVERY: Duration = Duration::from_secs(15);

/// Runs on its own thread so reminders still fire while the window is minimized,
/// when the webview throttles its timers.
pub fn start(app: AppHandle) {
    thread::spawn(move || {
        loop {
            thread::sleep(CHECK_EVERY);
            let Ok(reminders) = app.state::<Db>().take_due_reminders() else {
                continue;
            };
            for reminder in reminders {
                let _ = app
                    .notification()
                    .builder()
                    .title("Stardust reminder")
                    .body(&reminder.title)
                    .show();
                let _ = app.emit("reminder", (&reminder.id, &reminder.title));
            }
        }
    });
}

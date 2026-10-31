use serde::{Deserialize, Serialize};
use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::db::Db;

const STATE_KEY: &str = "windowState";

#[derive(Serialize, Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

/// Remembers the restored size, so a maximized window comes back maximized
/// without losing the size it returns to.
pub fn remember(window: &WebviewWindow, db: &Db) {
    let maximized = window.is_maximized().unwrap_or(false);
    let previous = db
        .setting(STATE_KEY)
        .ok()
        .flatten()
        .and_then(|json| serde_json::from_str::<WindowState>(&json).ok());

    let state = match (maximized, previous) {
        (true, Some(previous)) => WindowState {
            maximized: true,
            ..previous
        },
        _ => {
            let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) else {
                return;
            };
            WindowState {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
                maximized,
            }
        }
    };
    if let Ok(json) = serde_json::to_string(&state) {
        let _ = db.set_setting(STATE_KEY, &json);
    }
}

/// A saved position can point at a monitor that has since been unplugged.
fn is_on_screen(window: &WebviewWindow, state: &WindowState) -> bool {
    let Ok(monitors) = window.available_monitors() else {
        return false;
    };
    monitors.iter().any(|monitor| {
        let area = monitor.work_area();
        let title_x = state.x + state.width as i32 / 2;
        let title_y = state.y + 16;
        title_x >= area.position.x
            && title_x < area.position.x + area.size.width as i32
            && title_y >= area.position.y
            && title_y < area.position.y + area.size.height as i32
    })
}

pub fn restore(window: &WebviewWindow, db: &Db) -> tauri::Result<()> {
    let saved = db
        .setting(STATE_KEY)
        .ok()
        .flatten()
        .and_then(|json| serde_json::from_str::<WindowState>(&json).ok())
        .filter(|state| is_on_screen(window, state));

    if let Some(state) = saved {
        window.set_size(PhysicalSize::new(state.width, state.height))?;
        window.set_position(PhysicalPosition::new(state.x, state.y))?;
        if state.maximized {
            window.maximize()?;
        }
    }
    fit_to_screen(window)
}

/// On a display smaller than the default size the window would open with its status
/// bar behind the taskbar. Shrinking first keeps Restore usable after maximizing.
fn fit_to_screen(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    let available = monitor.work_area().size;
    let size = window.outer_size()?;

    if size.width > available.width || size.height > available.height {
        window.set_size(PhysicalSize::new(
            available.width * 9 / 10,
            available.height * 9 / 10,
        ))?;
        window.center()?;
        window.maximize()?;
    }
    Ok(())
}

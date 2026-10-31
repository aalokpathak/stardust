use std::{env, fs, path::PathBuf};

const DATA_DIR_OVERRIDE: &str = "STARDUST_DATA_DIR";
const PORTABLE_DIR: &str = "Stardust Data";

/// The folder beside the executable when running as the portable build. The portable
/// copy is recognised by its file name, so renaming the exe switches modes on purpose.
pub fn portable_dir() -> Option<PathBuf> {
    let exe = env::current_exe().ok()?;
    let name = exe.file_stem()?.to_string_lossy().to_lowercase();
    if !name.contains("portable") {
        return None;
    }
    let dir = exe.parent()?.join(PORTABLE_DIR);
    // A read-only location (a locked USB stick, Program Files) can't hold the library.
    fs::create_dir_all(&dir).ok()?;
    let probe = dir.join(".write-test");
    fs::write(&probe, b"").ok()?;
    fs::remove_file(&probe).ok()?;
    Some(dir)
}

/// Keeps the portable build from leaving a browser profile in the user's AppData.
/// Has to run before the webview starts.
pub fn isolate_portable_webview() {
    if let Some(dir) = portable_dir() {
        // SAFETY: called first thing in `run`, before any other thread exists.
        unsafe { env::set_var("WEBVIEW2_USER_DATA_FOLDER", dir.join("WebView")) };
    }
}

/// Resolves the library folder: an explicit override, then portable mode, then AppData.
pub fn data_dir(app_data: PathBuf) -> PathBuf {
    env::var_os(DATA_DIR_OVERRIDE)
        .map(PathBuf::from)
        .or_else(portable_dir)
        .unwrap_or(app_data)
}

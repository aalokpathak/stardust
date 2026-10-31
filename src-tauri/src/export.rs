use std::{fs, path::PathBuf};

use tauri::WebviewWindow;
use tauri_plugin_dialog::DialogExt;

use crate::error::{AppError, AppResult};

// A4, in inches. The side margins are repeated as padding in the footer template
// because Chromium draws the footer edge to edge across the page.
const PAGE_WIDTH: f64 = 8.27;
const PAGE_HEIGHT: f64 = 11.69;
const MARGIN_TOP: f64 = 0.9;
const MARGIN_BOTTOM: f64 = 0.95;
const MARGIN_SIDE: f64 = 1.0;

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Turns a note title into a file name Windows will accept.
fn file_stem(title: &str) -> String {
    const RESERVED: &str = "<>:\"/\\|?*";
    let cleaned: String = title
        .chars()
        .filter(|c| !c.is_control() && !RESERVED.contains(*c))
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.');
    if trimmed.is_empty() {
        "Untitled".to_owned()
    } else {
        trimmed.chars().take(120).collect()
    }
}

fn ask_for_path(window: &WebviewWindow, title: &str, extension: &str) -> AppResult<Option<PathBuf>> {
    let label = match extension {
        "pdf" => "PDF document",
        "md" => "Markdown",
        _ => "Text document",
    };
    let chosen = window
        .dialog()
        .file()
        .set_parent(window)
        .set_title("Export note")
        .set_file_name(format!("{}.{extension}", file_stem(title)))
        .add_filter(label, &[extension])
        .blocking_save_file();
    chosen
        .map(|path| path.into_path().map_err(AppError::from))
        .transpose()
}

#[tauri::command(async)]
pub fn export_text(
    window: WebviewWindow,
    title: String,
    extension: String,
    contents: String,
) -> AppResult<Option<String>> {
    if !matches!(extension.as_str(), "txt" | "md") {
        return Err(AppError(format!("Can't export as .{extension}.")));
    }
    let Some(path) = ask_for_path(&window, &title, &extension)? else {
        return Ok(None);
    };
    fs::write(&path, contents)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Prints the `#print-root` element the frontend prepared. Using the webview's own
/// print engine gives real text shaping, font fallback for every script and
/// selectable text, with fonts subsetted into the PDF.
#[tauri::command(async)]
pub fn export_pdf(window: WebviewWindow, title: String) -> AppResult<Option<String>> {
    let Some(path) = ask_for_path(&window, &title, "pdf")? else {
        return Ok(None);
    };
    fs::write(&path, render_pdf(&window, &title)?)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn print_params(title: &str) -> String {
    let footer = format!(
        r#"<div style="width:100%;box-sizing:border-box;padding:0 {MARGIN_SIDE}in;display:flex;justify-content:space-between;gap:24px;font-family:'Segoe UI',sans-serif;font-size:8pt;color:#6b7280"><span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">{}</span><span style="white-space:nowrap"><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>"#,
        escape_html(title)
    );
    serde_json::json!({
        "printBackground": true,
        "displayHeaderFooter": true,
        "headerTemplate": "<span></span>",
        "footerTemplate": footer,
        "paperWidth": PAGE_WIDTH,
        "paperHeight": PAGE_HEIGHT,
        "marginTop": MARGIN_TOP,
        "marginBottom": MARGIN_BOTTOM,
        "marginLeft": MARGIN_SIDE,
        "marginRight": MARGIN_SIDE,
        "generateDocumentOutline": true,
        "generateTaggedPDF": true,
    })
    .to_string()
}

#[cfg(windows)]
fn render_pdf(window: &WebviewWindow, title: &str) -> AppResult<Vec<u8>> {
    use std::{sync::mpsc, time::Duration};

    use base64::{Engine, engine::general_purpose::STANDARD};
    use serde_json::Value;
    use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
    use windows_core::{HSTRING, w};

    let params = HSTRING::from(print_params(title));
    let (sender, receiver) = mpsc::channel::<Result<String, String>>();

    window.with_webview(move |webview| {
        let failed = sender.clone();
        let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
            move |status, response| {
                let _ = sender.send(status.map(|_| response).map_err(|error| error.to_string()));
                Ok(())
            },
        ));
        // SAFETY: `with_webview` runs this on the UI thread that owns the controller.
        let started = unsafe {
            webview.controller().CoreWebView2().and_then(|core| {
                core.CallDevToolsProtocolMethod(w!("Page.printToPDF"), &params, &handler)
            })
        };
        if let Err(error) = started {
            let _ = failed.send(Err(error.to_string()));
        }
    })?;

    let response = receiver
        .recv_timeout(Duration::from_secs(60))
        .map_err(|_| AppError("The PDF took too long to render.".into()))?
        .map_err(AppError)?;
    let response: Value = serde_json::from_str(&response)?;
    let data = response["data"]
        .as_str()
        .ok_or_else(|| AppError("The PDF renderer returned nothing.".into()))?;
    Ok(STANDARD.decode(data)?)
}

#[cfg(not(windows))]
fn render_pdf(_window: &WebviewWindow, _title: &str) -> AppResult<Vec<u8>> {
    Err(AppError("PDF export is only available on Windows.".into()))
}

use std::collections::HashMap;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::{
    db::{Db, Folder, Library, Note, NoteEdit, NoteMeta, Todo},
    error::AppResult,
    paths,
};

// Every command is `async` so storage never runs on the UI thread. Tauri
// otherwise executes commands on the thread that also pumps the window.

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Boot {
    library: Library,
    todos: Vec<Todo>,
    settings: HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    version: String,
    data_dir: String,
    library_bytes: u64,
    portable: bool,
}

#[tauri::command(async)]
pub fn bootstrap(db: State<Db>) -> AppResult<Boot> {
    Ok(Boot {
        library: db.library()?,
        todos: db.todos()?,
        settings: db.settings()?,
    })
}

#[tauri::command(async)]
pub fn system_info(app: AppHandle, db: State<Db>) -> SystemInfo {
    SystemInfo {
        version: app.package_info().version.to_string(),
        data_dir: db.dir().to_string_lossy().into_owned(),
        library_bytes: db.size_bytes(),
        portable: paths::portable_dir().is_some(),
    }
}

#[tauri::command(async)]
pub fn get_library(db: State<Db>) -> AppResult<Library> {
    db.library()
}

#[tauri::command(async)]
pub fn create_folder(db: State<Db>, name: String, parent_id: Option<String>) -> AppResult<Folder> {
    db.create_folder(&name, parent_id.as_deref())
}

#[tauri::command(async)]
pub fn rename_folder(db: State<Db>, id: String, name: String) -> AppResult<()> {
    db.rename_folder(&id, &name)
}

#[tauri::command(async)]
pub fn move_folder(db: State<Db>, id: String, parent_id: Option<String>) -> AppResult<()> {
    db.move_folder(&id, parent_id.as_deref())
}

#[tauri::command(async)]
pub fn delete_folder(db: State<Db>, id: String) -> AppResult<()> {
    db.delete_folder(&id)
}

#[tauri::command(async)]
pub fn create_note(
    db: State<Db>,
    folder_id: Option<String>,
    title: String,
    content: String,
    body: String,
) -> AppResult<NoteMeta> {
    db.create_note(folder_id.as_deref(), &title, &content, &body)
}

#[tauri::command(async)]
pub fn get_note(db: State<Db>, id: String) -> AppResult<Note> {
    db.get_note(&id)
}

#[tauri::command(async)]
pub fn save_note(db: State<Db>, id: String, edit: NoteEdit) -> AppResult<NoteMeta> {
    db.save_note(&id, edit)
}

#[tauri::command(async)]
pub fn move_note(db: State<Db>, id: String, folder_id: Option<String>) -> AppResult<()> {
    db.move_note(&id, folder_id.as_deref())
}

#[tauri::command(async)]
pub fn trash_note(db: State<Db>, id: String) -> AppResult<()> {
    db.set_note_trashed(&id, true)
}

#[tauri::command(async)]
pub fn restore_note(db: State<Db>, id: String) -> AppResult<()> {
    db.set_note_trashed(&id, false)
}

#[tauri::command(async)]
pub fn delete_note_forever(db: State<Db>, id: String) -> AppResult<()> {
    db.delete_note_forever(&id)
}

#[tauri::command(async)]
pub fn empty_trash(db: State<Db>) -> AppResult<()> {
    db.empty_trash()
}

#[tauri::command(async)]
pub fn search_notes(db: State<Db>, query: String) -> AppResult<Vec<NoteMeta>> {
    db.search_notes(&query)
}

#[tauri::command(async)]
pub fn save_todo(db: State<Db>, todo: Todo) -> AppResult<()> {
    db.save_todo(&todo)
}

#[tauri::command(async)]
pub fn delete_todo(db: State<Db>, id: String) -> AppResult<()> {
    db.delete_todo(&id)
}

#[tauri::command(async)]
pub fn clear_completed(db: State<Db>) -> AppResult<()> {
    db.clear_completed()
}

#[tauri::command(async)]
pub fn set_setting(db: State<Db>, key: String, value: String) -> AppResult<()> {
    db.set_setting(&key, &value)
}

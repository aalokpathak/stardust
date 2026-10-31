use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

const SNIPPET_LENGTH: usize = 180;

const SCHEMA: &str = "
    CREATE TABLE folders (
        id          TEXT PRIMARY KEY,
        parent_id   TEXT REFERENCES folders(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        created_at  INTEGER NOT NULL
    );
    CREATE TABLE notes (
        id          TEXT PRIMARY KEY,
        folder_id   TEXT REFERENCES folders(id) ON DELETE SET NULL,
        title       TEXT NOT NULL DEFAULT '',
        content     TEXT NOT NULL DEFAULT '',
        body        TEXT NOT NULL DEFAULT '',
        snippet     TEXT NOT NULL DEFAULT '',
        words       INTEGER NOT NULL DEFAULT 0,
        chars       INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        deleted_at  INTEGER
    );
    CREATE INDEX notes_folder ON notes(folder_id);
    CREATE INDEX notes_updated ON notes(updated_at);
    CREATE TABLE todos (
        id           TEXT PRIMARY KEY,
        parent_id    TEXT REFERENCES todos(id) ON DELETE CASCADE,
        title        TEXT NOT NULL,
        done         INTEGER NOT NULL DEFAULT 0,
        important    INTEGER NOT NULL DEFAULT 0,
        due_date     TEXT,
        due_time     TEXT,
        remind_at    INTEGER,
        reminded     INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL,
        completed_at INTEGER
    );
    CREATE INDEX todos_parent ON todos(parent_id);
    CREATE INDEX todos_reminder ON todos(remind_at) WHERE remind_at IS NOT NULL;
    CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
";

const NOTE_COLUMNS: &str =
    "id, folder_id, title, snippet, words, chars, created_at, updated_at, deleted_at";

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as i64)
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub created_at: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub snippet: String,
    pub words: i64,
    pub chars: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    #[serde(flatten)]
    pub meta: NoteMeta,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub done: bool,
    pub important: bool,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub remind_at: Option<i64>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub folders: Vec<Folder>,
    pub notes: Vec<NoteMeta>,
}

/// A saved edit. Fields left out keep their stored value, so a title change
/// doesn't have to resend the whole document.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteEdit {
    pub title: Option<String>,
    pub content: Option<String>,
    pub body: Option<String>,
}

pub struct Reminder {
    pub id: String,
    pub title: String,
}

fn note_meta(row: &Row) -> rusqlite::Result<NoteMeta> {
    Ok(NoteMeta {
        id: row.get(0)?,
        folder_id: row.get(1)?,
        title: row.get(2)?,
        snippet: row.get(3)?,
        words: row.get(4)?,
        chars: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        deleted_at: row.get(8)?,
    })
}

fn todo(row: &Row) -> rusqlite::Result<Todo> {
    Ok(Todo {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        title: row.get(2)?,
        done: row.get(3)?,
        important: row.get(4)?,
        due_date: row.get(5)?,
        due_time: row.get(6)?,
        remind_at: row.get(7)?,
        created_at: row.get(8)?,
        completed_at: row.get(9)?,
    })
}

fn snippet_of(body: &str) -> String {
    let mut snippet = String::new();
    for word in body.split_whitespace() {
        if !snippet.is_empty() {
            snippet.push(' ');
        }
        snippet.push_str(word);
        if snippet.chars().count() >= SNIPPET_LENGTH {
            return snippet.chars().take(SNIPPET_LENGTH).collect();
        }
    }
    snippet
}

fn word_count(body: &str) -> i64 {
    body.split_whitespace().count() as i64
}

fn char_count(body: &str) -> i64 {
    body.chars().filter(|c| *c != '\n').count() as i64
}

/// Escapes LIKE wildcards so a search for "100%" means the literal text.
fn like_pattern(query: &str) -> String {
    let escaped = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

pub struct Db {
    connection: Mutex<Connection>,
    path: PathBuf,
}

impl Db {
    pub fn open(dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(dir)?;
        let path = dir.join("stardust.db");
        let connection = Connection::open(&path)?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        // FULL makes each save survive a power cut. Saves run off the UI thread and
        // coalesce while one is in flight, so the fsync never slows typing down.
        connection.pragma_update(None, "synchronous", "FULL")?;
        connection.pragma_update(None, "foreign_keys", "ON")?;

        let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        if version == 0 {
            connection.execute_batch(&format!(
                "BEGIN; {SCHEMA} PRAGMA user_version = 1; COMMIT;"
            ))?;
        }

        Ok(Self {
            connection: Mutex::new(connection),
            path,
        })
    }

    fn conn(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError("The library is unavailable.".into()))
    }

    pub fn dir(&self) -> PathBuf {
        self.path.parent().map(Path::to_path_buf).unwrap_or_default()
    }

    /// Size of the database and its write-ahead log together.
    pub fn size_bytes(&self) -> u64 {
        let wal = self.path.with_extension("db-wal");
        [self.path.as_path(), wal.as_path()]
            .iter()
            .filter_map(|file| fs::metadata(file).ok())
            .map(|metadata| metadata.len())
            .sum()
    }

    pub fn library(&self) -> AppResult<Library> {
        let conn = self.conn()?;
        let folders = conn
            .prepare("SELECT id, parent_id, name, created_at FROM folders")?
            .query_map([], |row| {
                Ok(Folder {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    name: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })?
            .collect::<Result<_, _>>()?;
        let notes = conn
            .prepare(&format!(
                "SELECT {NOTE_COLUMNS} FROM notes ORDER BY updated_at DESC"
            ))?
            .query_map([], note_meta)?
            .collect::<Result<_, _>>()?;
        Ok(Library { folders, notes })
    }

    pub fn create_folder(&self, name: &str, parent_id: Option<&str>) -> AppResult<Folder> {
        let folder = Folder {
            id: new_id(),
            parent_id: parent_id.map(str::to_owned),
            name: name.to_owned(),
            created_at: now_ms(),
        };
        self.conn()?.execute(
            "INSERT INTO folders (id, parent_id, name, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![folder.id, folder.parent_id, folder.name, folder.created_at],
        )?;
        Ok(folder)
    }

    pub fn rename_folder(&self, id: &str, name: &str) -> AppResult<()> {
        self.conn()?
            .execute("UPDATE folders SET name = ?2 WHERE id = ?1", params![id, name])?;
        Ok(())
    }

    pub fn move_folder(&self, id: &str, parent_id: Option<&str>) -> AppResult<()> {
        let conn = self.conn()?;
        if let Some(parent) = parent_id {
            let into_itself: bool = conn.query_row(
                "WITH RECURSIVE subtree(id) AS (
                     SELECT ?1
                     UNION ALL
                     SELECT folders.id FROM folders JOIN subtree ON folders.parent_id = subtree.id
                 )
                 SELECT EXISTS (SELECT 1 FROM subtree WHERE id = ?2)",
                params![id, parent],
                |row| row.get(0),
            )?;
            if into_itself {
                return Err(AppError("A folder can't be moved inside itself.".into()));
            }
        }
        conn.execute(
            "UPDATE folders SET parent_id = ?2 WHERE id = ?1",
            params![id, parent_id],
        )?;
        Ok(())
    }

    /// Removes a folder and its subfolders. Their notes go to the Trash and
    /// come back to the root if restored, since their folders are gone.
    pub fn delete_folder(&self, id: &str) -> AppResult<()> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        tx.execute(
            "WITH RECURSIVE subtree(id) AS (
                 SELECT ?1
                 UNION ALL
                 SELECT folders.id FROM folders JOIN subtree ON folders.parent_id = subtree.id
             )
             UPDATE notes SET deleted_at = ?2
             WHERE deleted_at IS NULL AND folder_id IN (SELECT id FROM subtree)",
            params![id, now_ms()],
        )?;
        tx.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
        tx.commit()?;
        Ok(())
    }

    pub fn create_note(
        &self,
        folder_id: Option<&str>,
        title: &str,
        content: &str,
        body: &str,
    ) -> AppResult<NoteMeta> {
        let now = now_ms();
        let meta = NoteMeta {
            id: new_id(),
            folder_id: folder_id.map(str::to_owned),
            title: title.to_owned(),
            snippet: snippet_of(body),
            words: word_count(body),
            chars: char_count(body),
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };
        self.conn()?.execute(
            "INSERT INTO notes
                 (id, folder_id, title, content, body, snippet, words, chars, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                meta.id,
                meta.folder_id,
                meta.title,
                content,
                body,
                meta.snippet,
                meta.words,
                meta.chars,
                meta.created_at,
                meta.updated_at
            ],
        )?;
        Ok(meta)
    }

    pub fn get_note(&self, id: &str) -> AppResult<Note> {
        let conn = self.conn()?;
        conn.query_row(
            &format!("SELECT {NOTE_COLUMNS}, content FROM notes WHERE id = ?1"),
            params![id],
            |row| {
                Ok(Note {
                    meta: note_meta(row)?,
                    content: row.get(9)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError("That note no longer exists.".into()))
    }

    pub fn save_note(&self, id: &str, edit: NoteEdit) -> AppResult<NoteMeta> {
        let snippet = edit.body.as_deref().map(snippet_of);
        let words = edit.body.as_deref().map(word_count);
        let chars = edit.body.as_deref().map(char_count);
        let conn = self.conn()?;
        conn.query_row(
            &format!(
                "UPDATE notes SET
                     title      = COALESCE(?2, title),
                     content    = COALESCE(?3, content),
                     body       = COALESCE(?4, body),
                     snippet    = COALESCE(?5, snippet),
                     words      = COALESCE(?6, words),
                     chars      = COALESCE(?7, chars),
                     updated_at = ?8
                 WHERE id = ?1
                 RETURNING {NOTE_COLUMNS}"
            ),
            params![
                id,
                edit.title,
                edit.content,
                edit.body,
                snippet,
                words,
                chars,
                now_ms()
            ],
            note_meta,
        )
        .optional()?
        .ok_or_else(|| AppError("That note no longer exists.".into()))
    }

    pub fn move_note(&self, id: &str, folder_id: Option<&str>) -> AppResult<()> {
        self.conn()?.execute(
            "UPDATE notes SET folder_id = ?2 WHERE id = ?1",
            params![id, folder_id],
        )?;
        Ok(())
    }

    pub fn set_note_trashed(&self, id: &str, trashed: bool) -> AppResult<()> {
        let deleted_at = trashed.then(now_ms);
        self.conn()?.execute(
            "UPDATE notes SET deleted_at = ?2 WHERE id = ?1",
            params![id, deleted_at],
        )?;
        Ok(())
    }

    pub fn delete_note_forever(&self, id: &str) -> AppResult<()> {
        self.conn()?
            .execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn empty_trash(&self) -> AppResult<()> {
        self.conn()?
            .execute("DELETE FROM notes WHERE deleted_at IS NOT NULL", [])?;
        Ok(())
    }

    pub fn search_notes(&self, query: &str) -> AppResult<Vec<NoteMeta>> {
        let pattern = like_pattern(query);
        let conn = self.conn()?;
        let notes = conn
            .prepare(&format!(
                "SELECT {NOTE_COLUMNS} FROM notes
                 WHERE deleted_at IS NULL
                   AND (title LIKE ?1 ESCAPE '\\' OR body LIKE ?1 ESCAPE '\\')
                 ORDER BY (title LIKE ?1 ESCAPE '\\') DESC, updated_at DESC
                 LIMIT 100"
            ))?
            .query_map(params![pattern], note_meta)?
            .collect::<Result<_, _>>()?;
        Ok(notes)
    }

    pub fn todos(&self) -> AppResult<Vec<Todo>> {
        let conn = self.conn()?;
        let todos = conn
            .prepare(
                "SELECT id, parent_id, title, done, important, due_date, due_time, remind_at,
                        created_at, completed_at
                 FROM todos ORDER BY created_at",
            )?
            .query_map([], todo)?
            .collect::<Result<_, _>>()?;
        Ok(todos)
    }

    pub fn save_todo(&self, todo: &Todo) -> AppResult<()> {
        self.conn()?.execute(
            "INSERT INTO todos
                 (id, parent_id, title, done, important, due_date, due_time, remind_at,
                  created_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                 title        = excluded.title,
                 done         = excluded.done,
                 important    = excluded.important,
                 due_date     = excluded.due_date,
                 due_time     = excluded.due_time,
                 reminded     = CASE WHEN remind_at IS excluded.remind_at THEN reminded ELSE 0 END,
                 remind_at    = excluded.remind_at,
                 completed_at = excluded.completed_at",
            params![
                todo.id,
                todo.parent_id,
                todo.title,
                todo.done,
                todo.important,
                todo.due_date,
                todo.due_time,
                todo.remind_at,
                todo.created_at,
                todo.completed_at
            ],
        )?;
        Ok(())
    }

    pub fn delete_todo(&self, id: &str) -> AppResult<()> {
        self.conn()?
            .execute("DELETE FROM todos WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn clear_completed(&self) -> AppResult<()> {
        self.conn()?.execute(
            "DELETE FROM todos WHERE done = 1 AND parent_id IS NULL",
            [],
        )?;
        Ok(())
    }

    /// Claims every reminder that has come due, so each one fires exactly once.
    pub fn take_due_reminders(&self) -> AppResult<Vec<Reminder>> {
        let conn = self.conn()?;
        let reminders = conn
            .prepare(
                "UPDATE todos SET reminded = 1
                 WHERE reminded = 0 AND done = 0 AND remind_at IS NOT NULL AND remind_at <= ?1
                 RETURNING id, title",
            )?
            .query_map(params![now_ms()], |row| {
                Ok(Reminder {
                    id: row.get(0)?,
                    title: row.get(1)?,
                })
            })?
            .collect::<Result<_, _>>()?;
        Ok(reminders)
    }

    pub fn settings(&self) -> AppResult<HashMap<String, String>> {
        let conn = self.conn()?;
        let settings = conn
            .prepare("SELECT key, value FROM settings")?
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<Result<_, _>>()?;
        Ok(settings)
    }

    pub fn setting(&self, key: &str) -> AppResult<Option<String>> {
        let value = self
            .conn()?
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?;
        Ok(value)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> AppResult<()> {
        self.conn()?.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}

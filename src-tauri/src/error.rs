use serde::{Serialize, Serializer};

/// Carries any backend failure to the frontend as its message.
#[derive(Debug)]
pub struct AppError(pub String);

pub type AppResult<T> = Result<T, AppError>;

impl<E: std::error::Error> From<E> for AppError {
    fn from(error: E) -> Self {
        Self(error.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0)
    }
}

use thiserror::Error;

#[derive(Debug, Error)]
pub enum DollytError {
    #[error("URL YouTube invalide")]
    InvalidYoutubeUrl,
    #[error("yt-dlp a échoué : {0}")]
    YtdlpFailed(String),
    #[error("ffmpeg a échoué : {0}")]
    FfmpegFailed(String),
    #[error("aucun format muxé utilisable pour la preview")]
    NoMuxedFormat,
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("JSON invalide : {0}")]
    Json(#[from] serde_json::Error),
    #[error("binaire manquant : {0}")]
    BinMissing(String),
    #[error("téléchargement de binaire : {0}")]
    BinDownload(String),
    #[error("hash invalide pour {tool}")]
    BinHashMismatch { tool: String },
    #[error("opération annulée")]
    Cancelled,
    #[error("preset introuvable : {0}")]
    PresetNotFound(String),
}

pub type Result<T> = std::result::Result<T, DollytError>;

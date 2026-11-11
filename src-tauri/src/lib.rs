mod error;
mod ffmpeg;
mod url;
mod ytdlp;

use ffmpeg::CutResult;
use serde::Serialize;
use ytdlp::{DownloadResult, VideoInfo};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunCutResult {
    download: DownloadResult,
    cut: CutResult,
}

#[tauri::command]
fn load_video(raw_url: String) -> Result<VideoInfo, String> {
    let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
    ytdlp::fetch_video_info(&url).map_err(|e| e.to_string())
}

#[tauri::command]
fn download_section(
    raw_url: String,
    format_id: String,
    start_secs: f64,
    end_secs: f64,
) -> Result<DownloadResult, String> {
    let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
    ytdlp::download_section(&url, &format_id, start_secs, end_secs, 3.0).map_err(|e| e.to_string())
}

#[tauri::command]
fn run_cut_pipeline(
    raw_url: String,
    format_id: String,
    start_secs: f64,
    end_secs: f64,
) -> Result<RunCutResult, String> {
    let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
    let download = ytdlp::download_section(&url, &format_id, start_secs, end_secs, 3.0)
        .map_err(|e| e.to_string())?;
    let cut = ffmpeg::cut_exact_section(&download.path, start_secs, end_secs)
        .map_err(|e| e.to_string())?;
    Ok(RunCutResult { download, cut })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_video,
            download_section,
            run_cut_pipeline
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

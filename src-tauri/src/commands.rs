use crate::bins::{self, ToolPaths};
use crate::error::DollytError;
use crate::jobs::{JobsState, start_cut_job};
use crate::log;
use crate::presets::{self, Preset};
use crate::settings::{self, Settings};
use crate::storyboard::{self, StoryboardInfo};
use crate::url;
use crate::ytdlp::{self, DownloadResult, VideoInfo};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter, State};

fn filmstrip_gate() -> &'static Mutex<()> {
    static GATE: OnceLock<Mutex<()>> = OnceLock::new();
    GATE.get_or_init(|| Mutex::new(()))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunCutResult {
    pub download: DownloadResult,
    pub cut: crate::ffmpeg::CutResult,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinsStatus {
    pub ytdlp: String,
    pub ffmpeg: String,
    pub ffprobe: String,
    pub deno: String,
}

fn preview_job_cancel() -> &'static Mutex<Option<Arc<AtomicBool>>> {
    static SLOT: OnceLock<Mutex<Option<Arc<AtomicBool>>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

fn cancel_running_preview() {
    let mut guard = preview_job_cancel()
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    if let Some(cancel) = guard.take() {
        cancel.store(true, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn download_section(
    raw_url: String,
    format_id: String,
    start_secs: f64,
    end_secs: f64,
) -> Result<DownloadResult, String> {
    let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
    ytdlp::download_section(&url, &format_id, start_secs, end_secs, 3.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn run_cut_pipeline(
    raw_url: String,
    format_id: String,
    start_secs: f64,
    end_secs: f64,
) -> Result<RunCutResult, String> {
    let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
    let download = ytdlp::download_section(&url, &format_id, start_secs, end_secs, 3.0)
        .map_err(|e| e.to_string())?;
    let cut = crate::ffmpeg::cut_exact_section(&download.path, start_secs, end_secs)
        .map_err(|e| e.to_string())?;
    Ok(RunCutResult { download, cut })
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadVideoResponse {
    pub video: VideoInfo,
    pub storyboard: StoryboardInfo,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewLocalPayload {
    pub preview_url: String,
    pub preview_file_duration_secs: Option<f64>,
    /// Instant YouTube correspondant au début du fichier local.
    pub preview_start_secs: f64,
}

#[tauri::command]
pub async fn load_video(raw_url: String) -> Result<LoadVideoResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
        let value = ytdlp::fetch_metadata_json(&url).map_err(|e| e.to_string())?;
        let video = ytdlp::video_info_from_json(&value).map_err(|e| e.to_string())?;
        let storyboard = storyboard::parse_storyboard(&value);
        Ok(LoadVideoResponse { video, storyboard })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Preview fichier local en arrière-plan (ne bloque pas l’UI).
#[tauri::command]
pub fn cancel_local_preview() -> Result<(), String> {
    cancel_running_preview();
    Ok(())
}

#[tauri::command]
pub fn start_local_preview(
    app: AppHandle,
    raw_url: String,
    format_id: String,
    duration_secs: f64,
    start_secs: Option<f64>,
    full: Option<bool>,
) -> Result<(), String> {
    let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
    let dur = duration_secs.max(10.0);
    let full = full.unwrap_or(false);
    let (start, end) = if full {
        (0.0, dur)
    } else {
        let win = if dur <= 20.0 {
            dur.max(10.0)
        } else if start_secs.unwrap_or(0.0) < 0.5 {
            20.0
        } else {
            55.0
        };
        let want = start_secs.unwrap_or(0.0).max(0.0);
        let start = if dur <= win {
            0.0
        } else {
            (want - 3.0).max(0.0).min((dur - win).max(0.0))
        };
        let end = (start + win).min(dur).max(start + 10.0);
        (start, end)
    };
    cancel_running_preview();
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut guard = preview_job_cancel()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *guard = Some(Arc::clone(&cancel));
    }
    let _ = app.emit("preview-progress", serde_json::json!({ "percent": 2 }));
    tauri::async_runtime::spawn_blocking(move || {
        if cancel.load(Ordering::SeqCst) {
            return;
        }
        let _ = app.emit("preview-progress", serde_json::json!({ "percent": 5 }));
        let slot = Arc::new(Mutex::new(None));
        let app_p = app.clone();
        let on_progress = Arc::new(move |pct: u8| {
            let mapped = 5 + ((pct as u16).saturating_mul(90) / 100) as u8;
            let _ = app_p.emit("preview-progress", serde_json::json!({ "percent": mapped }));
        });
        let Ok(dl) = ytdlp::download_section_cancellable(
            &url,
            &format_id,
            start,
            end,
            if full { 0.0 } else { 1.0 },
            cancel.as_ref(),
            &slot,
            Some(on_progress),
        ) else {
            if cancel.load(Ordering::SeqCst) {
                return;
            }
            let _ = app.emit(
                "preview-local-failed",
                serde_json::json!({ "message": "Téléchargement preview impossible." }),
            );
            return;
        };
        if cancel.load(Ordering::SeqCst) {
            return;
        }
        let _ = app.emit("preview-progress", serde_json::json!({ "percent": 96 }));
        let Ok(mp4) = crate::ffmpeg::remux_preview_mp4(&dl.path) else {
            let _ = app.emit(
                "preview-local-failed",
                serde_json::json!({ "message": "Remux preview impossible." }),
            );
            return;
        };
        let _ = std::fs::remove_file(&dl.path);
        let preview_file_duration_secs = crate::ffmpeg::file_duration_secs(&mp4).ok();
        let _ = app.emit(
            "preview-local-ready",
            PreviewLocalPayload {
                preview_url: mp4,
                preview_file_duration_secs,
                preview_start_secs: start,
            },
        );
        let _ = app.emit("preview-progress", serde_json::json!({ "percent": 100 }));
    });
    Ok(())
}

#[tauri::command]
pub fn fetch_metadata(raw_url: String) -> Result<serde_json::Value, String> {
    let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
    ytdlp::fetch_metadata_json(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_storyboard(raw_url: String) -> Result<StoryboardInfo, String> {
    let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
    storyboard::fetch_storyboard(&url).map_err(|e| e.to_string())
}

/// Vignettes timeline depuis le fichier local (FFmpeg + cache disque).
#[tauri::command]
pub async fn resolve_preview_url(raw_url: String, format_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let url = url::validate_youtube_url(&raw_url).map_err(|e| e.to_string())?;
        ytdlp::resolve_muxed_stream_url(&url, &format_id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn release_preview_cache() -> Result<(), String> {
    crate::storage::release_preview();
    Ok(())
}

#[tauri::command]
pub async fn get_timeline_filmstrip_master(
    video_path: String,
    duration_secs: f64,
    frame_count: u32,
) -> Result<crate::filmstrip::TimelineFilmstrip, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::win_priority::deprioritize_worker_thread();
        let _lock = filmstrip_gate().lock().unwrap_or_else(|e| e.into_inner());
        crate::filmstrip::filmstrip_master(&video_path, duration_secs, frame_count)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_timeline_filmstrip(
    video_path: String,
    view_start: f64,
    view_span: f64,
    preview_start: f64,
    frame_count: u32,
) -> Result<crate::filmstrip::TimelineFilmstrip, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::win_priority::deprioritize_worker_thread();
        let _lock = filmstrip_gate().lock().unwrap_or_else(|e| e.into_inner());
        crate::filmstrip::filmstrip_for_view(
            &video_path,
            view_start,
            view_span,
            preview_start,
            frame_count,
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    settings::load().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings_cmd(settings: Settings) -> Result<(), String> {
    settings::save(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_presets() -> Result<Vec<Preset>, String> {
    let mut all = presets::list_builtin().map_err(|e| e.to_string())?;
    all.extend(presets::list_user().map_err(|e| e.to_string())?);
    Ok(all)
}

#[tauri::command]
pub fn save_preset(preset: Preset) -> Result<(), String> {
    presets::save_user(&preset).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_preset(id: String) -> Result<Preset, String> {
    presets::get_builtin(&id)
        .or_else(|_| {
            presets::list_user()?
                .into_iter()
                .find(|p| p.id == id)
                .ok_or_else(|| DollytError::PresetNotFound(id.clone()))
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn bins_status() -> Result<BinsStatus, String> {
    let t: &ToolPaths = bins::tools();
    Ok(BinsStatus {
        ytdlp: t.ytdlp.display().to_string(),
        ffmpeg: t.ffmpeg.display().to_string(),
        ffprobe: t.ffprobe.display().to_string(),
        deno: t.deno.display().to_string(),
    })
}

#[tauri::command]
pub fn update_ytdlp() -> Result<bins::YtdlpUpdateResult, String> {
    let result = bins::update_ytdlp_manual().map_err(|e| e.to_string())?;
    if result.already_latest {
        log::log_line("yt-dlp déjà à jour");
    } else {
        log::log_line("yt-dlp mis à jour");
    }
    Ok(result)
}

#[tauri::command]
pub fn start_cut_job_command(
    app: AppHandle,
    state: State<'_, Arc<JobsState>>,
    raw_url: String,
    format_id: String,
    start_secs: f64,
    end_secs: f64,
    preset_id: String,
) -> Result<u64, String> {
    start_cut_job(
        app,
        Arc::clone(state.inner()),
        raw_url,
        format_id,
        start_secs,
        end_secs,
        preset_id,
    )
}

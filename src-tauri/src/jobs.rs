use crate::ffmpeg;
use crate::log;
use crate::presets;
use crate::settings;
use crate::storage;
use crate::url;
use crate::ytdlp;
use serde::Serialize;
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub job_id: u64,
    pub stage: String,
    pub percent: u8,
}

pub struct JobsState {
    next_id: Mutex<u64>,
    active: Mutex<Option<ActiveJob>>,
}

struct ActiveJob {
    job_id: u64,
    cancel: Arc<AtomicBool>,
    child: Arc<Mutex<Option<Child>>>,
}

impl Default for JobsState {
    fn default() -> Self {
        Self {
            next_id: Mutex::new(1),
            active: Mutex::new(None),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobFinished {
    pub job_id: u64,
    pub ok: bool,
    pub message: String,
    pub output_path: Option<String>,
    pub preview_path: Option<String>,
}

#[tauri::command]
pub fn cancel_job(state: State<'_, Arc<JobsState>>) -> Result<(), String> {
    let mut guard = state.active.lock().map_err(|e| e.to_string())?;
    let Some(job) = guard.as_mut() else {
        return Ok(());
    };
    job.cancel.store(true, Ordering::SeqCst);
    if let Some(child) = job.child.lock().map_err(|e| e.to_string())?.take() {
        kill_process_tree(child.id());
    }
    log::log_line("job annulé");
    Ok(())
}

pub fn start_cut_job(
    app: AppHandle,
    state: Arc<JobsState>,
    raw_url: String,
    format_id: String,
    start_secs: f64,
    end_secs: f64,
    preset_id: String,
) -> Result<u64, String> {
    let job_id = {
        let mut next = state.next_id.lock().map_err(|e| e.to_string())?;
        let id = *next;
        *next += 1;
        id
    };
    let cancel = Arc::new(AtomicBool::new(false));
    let child_slot = Arc::new(Mutex::new(None::<Child>));
    {
        let mut active = state.active.lock().map_err(|e| e.to_string())?;
        if active.is_some() {
            return Err("Un job est déjà en cours".into());
        }
        *active = Some(ActiveJob {
            job_id,
            cancel: Arc::clone(&cancel),
            child: Arc::clone(&child_slot),
        });
    }
    let app2 = app.clone();
    let state2 = Arc::clone(&state);
    thread::spawn(move || {
        let result = run_cut_job(
            &app2,
            job_id,
            &cancel,
            &child_slot,
            &raw_url,
            &format_id,
            start_secs,
            end_secs,
            &preset_id,
        );
        let (ok, message, output_path, preview_path) = match result {
            Ok((path, preview)) => (
                true,
                "Extrait exporté.".to_string(),
                Some(path),
                Some(preview),
            ),
            Err(e) => (false, e, None, None),
        };
        let _ = app2.emit(
            "job-finished",
            JobFinished {
                job_id,
                ok,
                message,
                output_path,
                preview_path,
            },
        );
        if let Ok(mut active) = state2.active.lock()
            && active.as_ref().is_some_and(|job| job.job_id == job_id)
        {
            *active = None;
        }
    });
    Ok(job_id)
}

#[allow(clippy::too_many_arguments)]
fn run_cut_job(
    app: &AppHandle,
    job_id: u64,
    cancel: &AtomicBool,
    child_slot: &Arc<Mutex<Option<Child>>>,
    raw_url: &str,
    format_id: &str,
    start_secs: f64,
    end_secs: f64,
    preset_id: &str,
) -> Result<(String, String), String> {
    emit(app, job_id, "validation", 5)?;
    let url = url::validate_youtube_url(raw_url).map_err(|e| e.to_string())?;
    if cancel.load(Ordering::SeqCst) {
        return Err("annulé".into());
    }
    let preset = presets::get_builtin(preset_id).map_err(|e| e.to_string())?;
    let app_settings = settings::load().map_err(|e| e.to_string())?;
    if app_settings.export_dir.trim().is_empty() {
        return Err("Choisis d’abord un dossier de sortie dans Paramètres.".into());
    }
    let info = ytdlp::fetch_video_info(&url).map_err(|e| e.to_string())?;
    let dl_format = if preset_id == "quality-max" {
        ytdlp::resolve_export_format(&url, "").map_err(|e| e.to_string())?
    } else {
        ytdlp::resolve_export_format(&url, format_id).map_err(|e| e.to_string())?
    };
    let app_dl = app.clone();
    let on_progress: ytdlp::ProgressFn = Arc::new(move |raw| {
        let mapped = 20u8.saturating_add(((raw as u16).saturating_mul(48) / 100) as u8);
        let _ = emit(&app_dl, job_id, "download", mapped);
    });
    let download = ytdlp::download_section_cancellable(
        &url,
        &dl_format,
        start_secs,
        end_secs,
        3.0,
        cancel,
        child_slot,
        Some(on_progress),
    )
    .map_err(|e| e.to_string())?;
    if cancel.load(Ordering::SeqCst) {
        return Err("annulé".into());
    }
    emit(app, job_id, "encode", 70)?;
    let cut = ffmpeg::export_to_settings_path(
        &download.path,
        &info.title,
        start_secs,
        end_secs,
        &preset,
        &app_settings,
    )
    .map_err(|e| e.to_string())?;
    let preview_path = storage::copy_download_preview(&cut.path).map_err(|e| e.to_string())?;
    emit(app, job_id, "done", 100)?;
    log::log_line(&format!(
        "job {job_id} ok preset={preset_id} download_ms={} encode_ms={}",
        download.elapsed_ms, cut.elapsed_ms
    ));
    Ok((cut.path, preview_path))
}

fn emit(app: &AppHandle, job_id: u64, stage: &str, percent: u8) -> Result<(), String> {
    app.emit(
        "job-progress",
        JobProgress {
            job_id,
            stage: stage.to_string(),
            percent,
        },
    )
    .map_err(|e| e.to_string())
}

fn kill_process_tree(pid: u32) {
    let mut cmd = std::process::Command::new("taskkill");
    cmd.args(["/PID", &pid.to_string(), "/T", "/F"]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let _ = cmd.status();
}

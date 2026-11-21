use crate::ffmpeg;
use crate::format;
use crate::log;
use crate::presets;
use crate::process;
use crate::settings;
use crate::storage;
use crate::url;
use crate::ytdlp;
use serde::Serialize;
use std::collections::VecDeque;
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub job_id: u64,
    pub stage: String,
    pub percent: Option<u8>,
}

pub struct JobsState {
    next_id: Mutex<u64>,
    active: Mutex<Option<ActiveJob>>,
    queue: Mutex<Queue>,
}

struct Queue {
    items: VecDeque<JobRequest>,
    running: bool,
}

struct JobRequest {
    job_id: u64,
    raw_url: String,
    format_id: String,
    start_secs: f64,
    end_secs: f64,
    preset_id: String,
    cancel: Arc<AtomicBool>,
    child: Arc<Mutex<Option<Child>>>,
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
            queue: Mutex::new(Queue {
                items: VecDeque::new(),
                running: false,
            }),
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

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}

fn claim_next_job(state: &JobsState) -> Option<JobRequest> {
    let mut queue = lock(&state.queue);
    let request = queue.items.pop_front()?;
    let mut active = lock(&state.active);
    *active = Some(ActiveJob {
        job_id: request.job_id,
        cancel: Arc::clone(&request.cancel),
        child: Arc::clone(&request.child),
    });
    Some(request)
}

fn request_active_cancel(state: &JobsState, job_id: Option<u64>) -> Option<u64> {
    let mut active = lock(&state.active);
    let job = active.as_mut()?;
    if job_id.is_some_and(|id| id != job.job_id) {
        return None;
    }
    let cancelled_id = job.job_id;
    job.cancel.store(true, Ordering::SeqCst);
    if let Some(child) = job.child.lock().unwrap_or_else(|e| e.into_inner()).take() {
        process::kill_process_tree(child.id());
    }
    Some(cancelled_id)
}

#[tauri::command]
pub fn cancel_job(
    app: AppHandle,
    state: State<'_, Arc<JobsState>>,
    job_id: Option<u64>,
) -> Result<(), String> {
    let mut removed = false;
    if let Some(id) = job_id {
        let mut queue = lock(&state.queue);
        if let Some(pos) = queue.items.iter().position(|j| j.job_id == id) {
            queue.items.remove(pos);
            removed = true;
        }
        drop(queue);
        if removed {
            let _ = app.emit(
                "job-finished",
                JobFinished {
                    job_id: id,
                    ok: false,
                    message: "annulé".into(),
                    output_path: None,
                    preview_path: None,
                },
            );
            log::log_line(&format!("job {id} retiré de la file"));
            return Ok(());
        }
    }
    if request_active_cancel(&state, job_id).is_some() {
        // The worker owns the single terminal event for active jobs.
        log::log_line("annulation du job actif demandée");
    }
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
        let mut next = lock(&state.next_id);
        let id = *next;
        *next += 1;
        id
    };
    let cancel = Arc::new(AtomicBool::new(false));
    let child_slot = Arc::new(Mutex::new(None::<Child>));
    {
        let mut queue = lock(&state.queue);
        queue.items.push_back(JobRequest {
            job_id,
            raw_url,
            format_id,
            start_secs,
            end_secs,
            preset_id,
            cancel,
            child: child_slot,
        });
        if !queue.running {
            queue.running = true;
            let app_worker = app.clone();
            let state_worker = Arc::clone(&state);
            thread::spawn(move || worker_loop(app_worker, state_worker));
        }
    }
    Ok(job_id)
}

fn worker_loop(app: AppHandle, state: Arc<JobsState>) {
    let _guard = RunningGuard {
        queue: &state.queue,
    };
    loop {
        let request = claim_next_job(&state);
        let Some(request) = request else {
            let mut queue = lock(&state.queue);
            if queue.items.is_empty() {
                queue.running = false;
                return;
            }
            continue;
        };
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            run_cut_job(
                &app,
                request.job_id,
                &request.cancel,
                &request.child,
                &request.raw_url,
                &request.format_id,
                request.start_secs,
                request.end_secs,
                &request.preset_id,
            )
        }))
        .unwrap_or_else(|_| Err("erreur interne du moteur de traitement".into()));
        let (ok, message, output_path, preview_path) = match result {
            Ok((path, preview)) => (true, "Extrait exporté.".to_string(), Some(path), preview),
            Err(_) if request.cancel.load(Ordering::SeqCst) => {
                (false, "annulé".to_string(), None, None)
            }
            Err(e) => (false, e, None, None),
        };
        if !ok {
            log::log_line(&format!("job {} échoué: {message}", request.job_id));
        }
        let _ = app.emit(
            "job-finished",
            JobFinished {
                job_id: request.job_id,
                ok,
                message,
                output_path,
                preview_path,
            },
        );
        if let Ok(mut active) = state.active.lock()
            && active
                .as_ref()
                .is_some_and(|job| job.job_id == request.job_id)
        {
            *active = None;
        }
        if let Ok(mut child) = request.child.lock() {
            *child = None;
        }
    }
}

// Garde contre les sorties anticipées : si la boucle se termine
// anormalement, la file ne reste jamais bloquée sur running = true.
struct RunningGuard<'a> {
    queue: &'a Mutex<Queue>,
}

impl Drop for RunningGuard<'_> {
    fn drop(&mut self) {
        lock(self.queue).running = false;
    }
}

struct TempFileGuard(std::path::PathBuf);

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
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
) -> Result<(String, Option<String>), String> {
    emit(app, job_id, "validation", 5)?;
    let url = url::validate_youtube_url(raw_url).map_err(|e| e.to_string())?;
    if cancel.load(Ordering::SeqCst) {
        return Err("annulé".into());
    }
    let preset = presets::get(preset_id).map_err(|e| e.to_string())?;
    let app_settings = settings::load().map_err(|e| e.to_string())?;
    if app_settings.export_dir.trim().is_empty() {
        return Err("Choisis d’abord un dossier de sortie dans Paramètres.".into());
    }
    emit_progress(app, job_id, "metadata", None)?;
    let meta = ytdlp::fetch_metadata_json(&url).map_err(|e| e.to_string())?;
    let info = ytdlp::video_info_from_json(&meta).map_err(|e| e.to_string())?;
    if end_secs > info.duration_secs + 0.5 {
        return Err(format!(
            "La vidéo fait {:.0}s — l'extrait demandé (jusqu'à {:.0}s) dépasse cette durée.",
            info.duration_secs, end_secs
        ));
    }
    let formats = meta
        .get("formats")
        .and_then(|v| v.as_array())
        .map(|v| v.as_slice())
        .unwrap_or(&[]);
    let dl_format = if preset.video_codec == "none" {
        format::pick_audio_format_id(formats).unwrap_or_else(|| format_id.to_string())
    } else {
        format::pick_download_formats(formats)
            .map(|s| format::to_ytdlp_format(&s))
            .unwrap_or_else(|| download_fallback_format(preset_id, format_id))
    };
    let clip_type = if start_secs == 0.0 && end_secs == 0.0 {
        "vidéo entière".to_string()
    } else {
        format!("extrait {}s-{}s", start_secs, end_secs)
    };
    log::log_line(&format!(
        "job {job_id} démarré: lien={url}, qualité={dl_format}, preset={preset_id}, {clip_type}",
        url = raw_url,
    ));
    let app_dl = app.clone();
    let on_progress: ytdlp::ProgressFn = Arc::new(move |raw| {
        // Sans pourcentage mesurable, yt-dlp est encore en phase
        // d'extraction des formats : l'UI doit le dire au lieu de
        // laisser croire à un téléchargement muet.
        let stage = if raw.is_some() {
            "download"
        } else {
            "metadata"
        };
        let _ = emit_progress(&app_dl, job_id, stage, map_download_percent(raw));
    });
    let app_stage = app.clone();
    let on_stage: ytdlp::StageFn = Arc::new(move |stage: &'static str| {
        let _ = emit_progress(&app_stage, job_id, stage, None);
    });
    // Section downloads keep bandwidth proportional to the clip but report
    // no byte progress (the UI stays indeterminate). A full download reports
    // real progress, so it is kept only when the clip is nearly the whole
    // video and section mode would save almost nothing.
    let use_sections = should_use_sections(end_secs - start_secs, info.duration_secs);
    let section_duration = end_secs - start_secs + 6.0;
    // Sections DASH : les URLs du JSON -J expirent ; --load-info-json fige le
    // téléchargement sans sortie (comportement yt-dlp, non vérifié partout).
    let download = ytdlp::download_section_cancellable(
        &url,
        &dl_format,
        start_secs,
        end_secs,
        3.0,
        use_sections,
        cancel,
        child_slot,
        Some(on_progress),
        Some(on_stage),
        section_duration,
        if use_sections { None } else { Some(&meta) },
    )
    .map_err(|e| e.to_string())?;
    let _section_guard = TempFileGuard(std::path::PathBuf::from(download.path.as_str()));
    if cancel.load(Ordering::SeqCst) {
        return Err("annulé".into());
    }
    emit(app, job_id, "encode", 70)?;
    let app_enc = app.clone();
    let on_encode: ffmpeg::EncodeProgressFn = Arc::new(move |frac: f64| {
        let pct = 70u8.saturating_add((frac.clamp(0.0, 1.0) * 25.0) as u8);
        let _ = emit(&app_enc, job_id, "encode", pct);
    });
    let cut = ffmpeg::export_to_settings_path_cancellable(
        &download.path,
        &info.title,
        start_secs,
        end_secs,
        download.section_lo_secs,
        &preset,
        &app_settings,
        cancel,
        child_slot,
        Some(on_encode),
    )
    .map_err(|e| e.to_string())?;
    if cancel.load(Ordering::SeqCst) {
        return Err("annulé".into());
    }
    let is_mp4 = std::path::Path::new(&cut.path)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("mp4"));
    let preview_path = if is_mp4 {
        storage::copy_download_preview(&cut.path).ok()
    } else {
        ffmpeg::remux_download_preview(&cut.path).ok()
    };
    if preview_path.is_none() {
        log::log_line("preview indisponible pour l'export");
    }
    emit(app, job_id, "done", 100)?;
    log::log_line(&format!(
        "job {job_id} ok preset={preset_id} download_ms={} encode_ms={}",
        download.elapsed_ms, cut.elapsed_ms
    ));
    Ok((cut.path, preview_path))
}

fn should_use_sections(clip_span_secs: f64, video_duration_secs: f64) -> bool {
    clip_span_secs * 4.0 < video_duration_secs * 3.0
}

fn download_fallback_format(preset_id: &str, format_id: &str) -> String {
    if preset_id == "quality-max" && format_id.is_empty() {
        "bestvideo+bestaudio/best".into()
    } else {
        format_id.to_string()
    }
}

fn map_download_percent(raw: Option<u8>) -> Option<u8> {
    raw.map(|raw| 20u8.saturating_add(((raw as u16).saturating_mul(48) / 100) as u8))
}

fn emit(app: &AppHandle, job_id: u64, stage: &str, percent: u8) -> Result<(), String> {
    emit_progress(app, job_id, stage, Some(percent))
}

fn emit_progress(
    app: &AppHandle,
    job_id: u64,
    stage: &str,
    percent: Option<u8>,
) -> Result<(), String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claimed_job_is_visible_to_cancellation_before_worker_starts() {
        let state = JobsState::default();
        let cancel = Arc::new(AtomicBool::new(false));
        let child = Arc::new(Mutex::new(None));
        lock(&state.queue).items.push_back(JobRequest {
            job_id: 7,
            raw_url: "https://www.youtube.com/watch?v=test".into(),
            format_id: "18".into(),
            start_secs: 0.0,
            end_secs: 5.0,
            preset_id: "youtube".into(),
            cancel: Arc::clone(&cancel),
            child: Arc::clone(&child),
        });

        let request = claim_next_job(&state).expect("queued job should be claimed");
        let active = lock(&state.active);
        assert_eq!(active.as_ref().map(|job| job.job_id), Some(request.job_id));
        assert!(Arc::ptr_eq(
            &active.as_ref().unwrap().cancel,
            &request.cancel
        ));
    }

    #[test]
    fn active_cancel_is_idempotent_and_targets_only_the_requested_job() {
        let state = JobsState::default();
        let cancel = Arc::new(AtomicBool::new(false));
        lock(&state.active).replace(ActiveJob {
            job_id: 11,
            cancel: Arc::clone(&cancel),
            child: Arc::new(Mutex::new(None)),
        });

        assert_eq!(request_active_cancel(&state, Some(99)), None);
        assert!(!cancel.load(Ordering::SeqCst));
        assert_eq!(request_active_cancel(&state, Some(11)), Some(11));
        assert!(cancel.load(Ordering::SeqCst));
        assert_eq!(request_active_cancel(&state, Some(11)), Some(11));
    }

    #[test]
    fn quality_max_uses_a_valid_selector_when_no_explicit_format_is_available() {
        assert_eq!(
            download_fallback_format("quality-max", ""),
            "bestvideo+bestaudio/best"
        );
    }

    #[test]
    fn other_presets_keep_their_existing_format_fallback() {
        assert_eq!(download_fallback_format("source", "18"), "18");
    }

    #[test]
    fn clips_download_only_their_section_unless_they_cover_the_video() {
        assert!(should_use_sections(50.0, 600.0));
        assert!(should_use_sections(300.0, 600.0));
        assert!(!should_use_sections(600.0, 600.0));
        assert!(!should_use_sections(590.0, 600.0));
        assert!(!should_use_sections(450.0, 600.0));
        assert!(!should_use_sections(50.0, 51.0));
    }

    #[test]
    fn missing_download_progress_stays_indeterminate() {
        assert_eq!(map_download_percent(None), None);
        assert_eq!(map_download_percent(Some(0)), Some(20));
        assert_eq!(map_download_percent(Some(100)), Some(68));
    }
}

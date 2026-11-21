use crate::error::{DollytError, Result};
use crate::format;
use crate::process;
use serde::Serialize;
use serde_json::Value;
use std::collections::VecDeque;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Child;
use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

pub type ProgressFn = Arc<dyn Fn(Option<u8>) + Send + Sync>;
pub type StageFn = Arc<dyn Fn(&'static str) + Send + Sync>;

const METADATA_CACHE_TTL: Duration = Duration::from_secs(5 * 60);
const METADATA_CACHE_CAPACITY: usize = 8;

struct MetadataCacheEntry {
    url: String,
    value: Value,
    fetched_at: Instant,
}

#[derive(Default)]
struct MetadataCache {
    entries: VecDeque<MetadataCacheEntry>,
}

impl MetadataCache {
    fn get(&mut self, url: &str, now: Instant) -> Option<Value> {
        let index = self.entries.iter().position(|entry| entry.url == url)?;
        if now.saturating_duration_since(self.entries[index].fetched_at) >= METADATA_CACHE_TTL {
            self.entries.remove(index);
            return None;
        }
        Some(self.entries[index].value.clone())
    }

    fn insert(&mut self, url: impl Into<String>, value: Value, now: Instant) {
        let url = url.into();
        self.entries.retain(|entry| entry.url != url);
        self.entries.push_back(MetadataCacheEntry {
            url,
            value,
            fetched_at: now,
        });
        while self.entries.len() > METADATA_CACHE_CAPACITY {
            self.entries.pop_front();
        }
    }
}

fn metadata_cache() -> &'static Mutex<MetadataCache> {
    static CACHE: OnceLock<Mutex<MetadataCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(MetadataCache::default()))
}

struct TemporaryDownloadGuard {
    path: PathBuf,
    keep: bool,
}

impl TemporaryDownloadGuard {
    fn new(path: PathBuf) -> Self {
        Self { path, keep: false }
    }

    fn keep(&mut self) {
        self.keep = true;
    }
}

impl Drop for TemporaryDownloadGuard {
    fn drop(&mut self) {
        if !self.keep {
            let _ = std::fs::remove_file(&self.path);
            let mut partial = self.path.as_os_str().to_os_string();
            partial.push(".part");
            let _ = std::fs::remove_file(PathBuf::from(partial));
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub title: String,
    pub duration_secs: f64,
    pub preview_url: String,
    pub thumbnail_url: Option<String>,
    pub format_id: String,
    pub export_format_id: String,
    pub preview_fps: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_file_duration_secs: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub path: String,
    pub elapsed_ms: u64,
    pub section_lo_secs: f64,
}

pub fn fetch_metadata_json(url: &str) -> Result<Value> {
    if let Some(value) = metadata_cache()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(url, Instant::now())
    {
        crate::log::log_line("métadonnées vidéo réutilisées depuis le cache local");
        return Ok(value);
    }
    fetch_metadata_json_fresh(url)
}

/** Une extraction `-J` fraîche, pour l'export (URLs signées récentes). */
pub fn fetch_metadata_json_fresh(url: &str) -> Result<Value> {
    let value = extract_metadata_json(url)?;
    metadata_cache()
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .insert(url, value.clone(), Instant::now());
    Ok(value)
}

fn extract_metadata_json(url: &str) -> Result<Value> {
    let output = process::run_ytdlp(&["-J", url])?;
    log_stderr_lines(&output.stderr);
    if !output.status.success() {
        return Err(DollytError::YtdlpFailed(ytdlp_user_message(
            &String::from_utf8_lossy(&output.stderr),
        )));
    }
    let value: Value = serde_json::from_slice(&output.stdout)?;
    if value.is_null() {
        return Err(DollytError::YtdlpFailed(ytdlp_user_message(
            &String::from_utf8_lossy(&output.stderr),
        )));
    }
    Ok(value)
}

fn ytdlp_user_message(stderr: &str) -> String {
    let s = stderr.trim();
    if s.contains("HTTP error 403 Forbidden") || s.contains("HTTP 403") {
        return "Le serveur vidéo a refusé la requête (HTTP 403). Réessaie, mets à jour yt-dlp ou vérifie le réseau et les cookies.".into();
    }
    if s.contains("Could not copy Chrome cookie database") {
        return "Chrome et Edge verrouillent leurs cookies sous Windows : yt-dlp ne peut pas les lire. Paramètres → Firefox, ou un fichier cookies.txt (extension « Get cookies.txt LOCALLY » sur youtube.com).".into();
    }
    if s.contains("Failed to decrypt with DPAPI") {
        return "Cookies Chrome/Edge illisibles sous Windows. Utilise Firefox, ou un fichier cookies.txt, dans Paramètres.".into();
    }
    if s.contains("Sign in to confirm") || s.to_ascii_lowercase().contains("not a bot") {
        return "YouTube bloque l’accès sans session. Paramètres → Firefox (connecté à YouTube), ou colle le chemin d’un cookies.txt exporté depuis le navigateur, Enregistrer, puis relance le lien.".into();
    }
    if s.contains("Private video") {
        return "Vidéo privée ou inaccessible.".into();
    }
    let safe = crate::log::redact_secrets(s);
    let s = safe.as_str();
    if s.len() > 320 {
        let mut end = 320;
        while !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…", &s[..end])
    } else if s.is_empty() {
        "yt-dlp n'a pas renvoyé de métadonnées.".into()
    } else {
        s.to_string()
    }
}

fn log_stderr_lines(stderr: &[u8]) {
    for line in String::from_utf8_lossy(stderr).lines() {
        crate::log::log_line(&format!("yt-dlp: {line}"));
    }
}

pub fn video_info_from_json(value: &Value) -> Result<VideoInfo> {
    let title = value
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Sans titre")
        .to_string();
    let duration_secs = value
        .get("duration")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let thumbnail_url = value
        .get("thumbnail")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let formats = value
        .get("formats")
        .and_then(|v| v.as_array())
        .map(|v| v.as_slice())
        .unwrap_or(&[]);
    let (format_id, preview_url) = match format::pick_muxed_format(formats) {
        Some(p) => p,
        None if value.get("id").and_then(|v| v.as_str()).is_some() => {
            ("18".to_string(), String::new())
        }
        None => return Err(DollytError::NoMuxedFormat),
    };
    let preview_fps = muxed_fps_for_id(formats, &format_id);
    let export_format_id = format::pick_download_formats(formats)
        .map(|s| format::to_ytdlp_format(&s))
        .unwrap_or_else(|| format_id.clone());
    Ok(VideoInfo {
        title,
        duration_secs,
        preview_url,
        thumbnail_url,
        format_id,
        export_format_id,
        preview_fps,
        preview_file_duration_secs: None,
    })
}

/** URL fraîche pour la balise video (les URL du JSON -J expirent vite). */
pub fn resolve_muxed_stream_url(page_url: &str, format_id: &str) -> Result<String> {
    if !format_id.is_empty() && !valid_format_selector(format_id) {
        return Err(DollytError::YtdlpFailed(
            "sélecteur de format invalide".into(),
        ));
    }
    let fmt = if format_id.is_empty() {
        "18/b".to_string()
    } else {
        format_id.to_string()
    };
    let output = process::run_ytdlp(&["-f", &fmt, "-g", page_url])?;
    if !output.status.success() {
        log_stderr_lines(&output.stderr);
        return Err(DollytError::YtdlpFailed(ytdlp_user_message(
            &String::from_utf8_lossy(&output.stderr),
        )));
    }
    let line = String::from_utf8_lossy(&output.stdout)
        .lines()
        .find(|l| l.starts_with("http"))
        .unwrap_or("")
        .trim()
        .to_string();
    if line.is_empty() {
        return Err(DollytError::YtdlpFailed(
            "aucune URL de lecture muxée".into(),
        ));
    }
    Ok(line)
}

fn muxed_fps_for_id(formats: &[Value], format_id: &str) -> f64 {
    formats
        .iter()
        .find(|f| f.get("format_id").and_then(|v| v.as_str()) == Some(format_id))
        .and_then(|f| f.get("fps").and_then(|v| v.as_f64()))
        .unwrap_or(30.0)
        .clamp(1.0, 120.0)
}

#[allow(clippy::too_many_arguments)]
pub fn download_section_cancellable(
    url: &str,
    format_id: &str,
    start_secs: f64,
    end_secs: f64,
    margin_secs: f64,
    use_sections: bool,
    cancel: &AtomicBool,
    child_slot: &Arc<Mutex<Option<Child>>>,
    on_progress: Option<ProgressFn>,
    on_stage: Option<StageFn>,
    section_target_duration_secs: f64,
    info_json: Option<&Value>,
) -> Result<DownloadResult> {
    if !valid_format_selector(format_id) {
        return Err(DollytError::YtdlpFailed(
            "sélecteur de format invalide".into(),
        ));
    }
    if !start_secs.is_finite()
        || !end_secs.is_finite()
        || start_secs < 0.0
        || end_secs <= start_secs
        || end_secs - start_secs > 86_400.0
    {
        return Err(DollytError::YtdlpFailed(
            "plage de téléchargement invalide".into(),
        ));
    }
    let lo = (start_secs - margin_secs).max(0.0);
    let hi = end_secs + margin_secs;
    let section = format!("*{lo}-{hi}");
    let out = temp_mkv_path();
    let mut output_guard = TemporaryDownloadGuard::new(out.clone());
    let out_arg = out.to_string_lossy().into_owned();
    let start = Instant::now();
    let format_id = format_id.to_string();
    let page_url = url.to_string();
    let pct = Arc::new(AtomicU8::new(0));
    let has_progress = Arc::new(AtomicBool::new(false));
    let stderr_tail = Arc::new(Mutex::new(Vec::<String>::new()));
    let mut use_info_json = info_json.is_some();
    retry_once_on_http_403(
        || {
            cleanup_partial_download(&out);
            pct.store(0, Ordering::Relaxed);
            has_progress.store(false, Ordering::Relaxed);
            if let Ok(mut tail) = stderr_tail.lock() {
                tail.clear();
            }
            let info_guard = if use_info_json {
                use_info_json = false;
                let meta = info_json.ok_or_else(|| {
                    DollytError::YtdlpFailed("métadonnées export absentes".into())
                })?;
                Some(write_temp_info_json(meta)?)
            } else {
                None
            };
            let args = build_ytdlp_download_args(
                &format_id,
                &out_arg,
                use_sections,
                &section,
                &page_url,
                info_guard.as_ref().map(|g| g.path.as_path()),
            );
            let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
            crate::log::log_line(&format!(
                "équivalent CLI: yt-dlp {}",
                args.join(" ").replace(page_url.as_str(), "<url>")
            ));

            // yt-dlp écrit toute sa sortie d'extraction sur stdout : sans lecture
            // complète, un téléchargement peut rester muet des dizaines de
            // secondes et ressembler à un blocage dans l'interface.
            let last_output = Arc::new(Mutex::new(Instant::now()));
            let download_phase = Arc::new(AtomicBool::new(false));
            let mut child = process::spawn_ytdlp(&arg_refs)?;
            let stdout_reader = child.stdout.take().map(|stdout| {
                let pct_bg = Arc::clone(&pct);
                let has_progress_bg = Arc::clone(&has_progress);
                let activity_bg = Arc::clone(&last_output);
                let stage_bg = on_stage.clone();
                let download_phase_bg = Arc::clone(&download_phase);
                thread::spawn(move || {
                    read_ytdlp_progress(
                        stdout,
                        pct_bg,
                        has_progress_bg,
                        activity_bg,
                        stage_bg,
                        download_phase_bg,
                    )
                })
            });
            let stderr_reader = child.stderr.take().map(|stderr| {
                let pct_bg = Arc::clone(&pct);
                let has_progress_bg = Arc::clone(&has_progress);
                let tail_bg = Arc::clone(&stderr_tail);
                let section_duration = section_target_duration_secs;
                let activity_bg = Arc::clone(&last_output);
                thread::spawn(move || {
                    read_ytdlp_stderr(
                        stderr,
                        pct_bg,
                        has_progress_bg,
                        tail_bg,
                        section_duration,
                        activity_bg,
                    )
                })
            });
            let mut readers = [stdout_reader, stderr_reader]
                .into_iter()
                .flatten()
                .collect();
            *child_slot
                .lock()
                .map_err(|_| DollytError::YtdlpFailed("verrou job".into()))? = Some(child);
            if let Some(cb) = &on_progress {
                cb(None);
            }
            wait_child_slot(
                child_slot,
                cancel,
                &pct,
                &has_progress,
                Arc::clone(&stderr_tail),
                Arc::clone(&last_output),
                Arc::clone(&download_phase),
                stall_timeout(section_target_duration_secs),
                out.clone(),
                &mut readers,
                on_progress.clone(),
                on_stage.clone(),
            )
        },
        || {
            if let Some(cb) = &on_stage {
                cb("retry");
            }
        },
    )?;
    let elapsed_ms = start.elapsed().as_millis() as u64;
    if !out.exists() {
        return Err(DollytError::YtdlpFailed(
            "fichier MKV absent après téléchargement".into(),
        ));
    }
    output_guard.keep();
    Ok(DownloadResult {
        path: out.to_string_lossy().into_owned(),
        elapsed_ms,
        section_lo_secs: if use_sections { lo } else { 0.0 },
    })
}

fn retry_once_on_http_403<T>(
    mut operation: impl FnMut() -> Result<T>,
    before_retry: impl Fn(),
) -> Result<T> {
    match operation() {
        Err(error) if error.to_string().contains("HTTP 403") => {
            crate::log::log_line("HTTP 403 pendant le téléchargement, nouvelle extraction yt-dlp");
            before_retry();
            operation()
        }
        result => result,
    }
}

fn cleanup_partial_download(path: &PathBuf) {
    let _ = std::fs::remove_file(path);
    let mut partial = path.as_os_str().to_os_string();
    partial.push(".part");
    let _ = std::fs::remove_file(PathBuf::from(partial));
}

fn valid_format_selector(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with('-')
        && value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric()
                || matches!(
                    byte,
                    b'+' | b'*' | b'/' | b',' | b'.' | b'[' | b']' | b'(' | b')' | b'_' | b'-'
                )
        })
}

fn note_section_progress_from_tail(
    partial: &str,
    section_target_duration_secs: f64,
    pct: &AtomicU8,
    has_progress: &AtomicBool,
) {
    if section_target_duration_secs <= 0.0 {
        return;
    }
    let tail = if partial.len() > 1024 {
        &partial[partial.len() - 1024..]
    } else {
        partial
    };
    if let Some(time) = parse_ffmpeg_time(tail) {
        let pct_val = ((time / section_target_duration_secs).clamp(0.0, 1.0) * 100.0) as u8;
        note_percent(pct, pct_val);
        has_progress.store(true, Ordering::Relaxed);
    }
}

fn read_ytdlp_stderr(
    stderr: std::process::ChildStderr,
    pct: Arc<AtomicU8>,
    has_progress: Arc<AtomicBool>,
    tail: Arc<Mutex<Vec<String>>>,
    section_target_duration_secs: f64,
    last_output: Arc<Mutex<Instant>>,
) {
    let mut buf = [0u8; 8192];
    let mut partial = String::new();
    let mut stderr_handle = stderr;
    loop {
        match stderr_handle.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if let Ok(mut at) = last_output.lock() {
                    *at = Instant::now();
                }
                let chunk = String::from_utf8_lossy(&buf[..n]);
                partial.push_str(&chunk);
                let mut end = 0;
                for (idx, ch) in partial.char_indices() {
                    if ch != '\n' && ch != '\r' {
                        continue;
                    }
                    let line = partial[end..idx].trim();
                    end = idx + ch.len_utf8();
                    if line.is_empty() {
                        continue;
                    }
                    if let Some(value) = parse_ytdlp_percent(line) {
                        note_percent(&pct, value);
                        has_progress.store(true, Ordering::Relaxed);
                    } else if let Some(time) = parse_ffmpeg_time(line)
                        && section_target_duration_secs > 0.0
                    {
                        let pct_val =
                            ((time / section_target_duration_secs).clamp(0.0, 1.0) * 100.0) as u8;
                        note_percent(&pct, pct_val);
                        has_progress.store(true, Ordering::Relaxed);
                    }
                    crate::log::log_line(&format!("yt-dlp: {line}"));
                    if let Ok(mut t) = tail.lock() {
                        let line = line.to_string();
                        if t.len() > 12 {
                            t.remove(0);
                        }
                        t.push(line);
                    }
                }
                partial.drain(..end);
                note_section_progress_from_tail(
                    &partial,
                    section_target_duration_secs,
                    &pct,
                    &has_progress,
                );
            }
            Err(_) => break,
        }
    }
    let tail_line = partial.trim();
    if !tail_line.is_empty() {
        crate::log::log_line(&format!("yt-dlp: {tail_line}"));
    }
}

fn read_ytdlp_progress(
    stdout: std::process::ChildStdout,
    pct: Arc<AtomicU8>,
    has_progress: Arc<AtomicBool>,
    last_output: Arc<Mutex<Instant>>,
    on_stage: Option<StageFn>,
    download_phase: Arc<AtomicBool>,
) {
    let mut buf = [0u8; 8192];
    let mut partial = String::new();
    let mut stdout_handle = stdout;
    let analysis_sent = AtomicBool::new(false);
    let download_sent = AtomicBool::new(false);
    loop {
        match stdout_handle.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if let Ok(mut at) = last_output.lock() {
                    *at = Instant::now();
                }
                partial.push_str(&String::from_utf8_lossy(&buf[..n]));
                let mut end = 0;
                for (idx, ch) in partial.char_indices() {
                    if ch != '\n' && ch != '\r' {
                        continue;
                    }
                    let line = partial[end..idx].trim();
                    end = idx + ch.len_utf8();
                    if line.is_empty() {
                        continue;
                    }
                    if let Some(value) = parse_ytdlp_percent(line) {
                        note_percent(&pct, value);
                        has_progress.store(true, Ordering::Relaxed);
                    }
                    if line.starts_with("[download]") {
                        download_phase.store(true, Ordering::Relaxed);
                    }
                    if let Some(cb) = &on_stage {
                        if line.starts_with("[download]") {
                            if !download_sent.swap(true, Ordering::Relaxed) {
                                cb("download");
                            }
                        } else if (line.starts_with("[youtube]") || line.starts_with("[info]"))
                            && !analysis_sent.swap(true, Ordering::Relaxed)
                        {
                            cb("metadata");
                        }
                    }
                    crate::log::log_line(&format!("yt-dlp: {line}"));
                }
                partial.drain(..end);
            }
            Err(_) => break,
        }
    }
    let tail = partial.trim();
    if !tail.is_empty() {
        crate::log::log_line(&format!("yt-dlp: {tail}"));
    }
}

fn parse_ffmpeg_time(line: &str) -> Option<f64> {
    let mut found = None;
    for (idx, _) in line.match_indices("time=") {
        let rest = &line[idx + 5..];
        let Some(time_str) = rest.split_whitespace().next() else {
            continue;
        };
        // Un temps négatif arrive avant la première image. Le traiter
        // comme une durée positive fait reculer le pourcentage.
        if time_str.starts_with('-') {
            continue;
        }
        if let Some(secs) = parse_clock(time_str) {
            found = Some(secs);
        }
    }
    found
}

fn parse_clock(time_str: &str) -> Option<f64> {
    let mut total = 0.0;
    let mut parts = 0;
    for part in time_str.split(':') {
        let val = part.parse::<f64>().ok()?;
        total = total * 60.0 + val;
        parts += 1;
    }
    (parts > 0).then_some(total)
}

fn note_percent(pct: &AtomicU8, value: u8) {
    let mut current = pct.load(Ordering::Relaxed);
    while value > current {
        match pct.compare_exchange_weak(current, value, Ordering::Relaxed, Ordering::Relaxed) {
            Ok(_) => break,
            Err(observed) => current = observed,
        }
    }
}

fn parse_ytdlp_percent(line: &str) -> Option<u8> {
    let line = line.trim();
    let rest = if let Some(value) = line.strip_prefix("download:") {
        value.trim_start()
    } else if let Some(value) = line.strip_prefix("[download]") {
        value.trim_start()
    } else {
        line
    };
    if !rest
        .chars()
        .next()
        .is_some_and(|character| character.is_ascii_digit() || character == '.')
    {
        return None;
    }
    let before_percent = rest.split_once('%')?.0.trim_end();
    let digits = before_percent
        .rsplit(|character: char| !(character.is_ascii_digit() || character == '.'))
        .next()?;
    digits
        .parse::<f32>()
        .ok()
        .map(|v| v.clamp(0.0, 100.0) as u8)
}

const STALL_TIMEOUT_DEFAULT: Duration = Duration::from_secs(120);
const WAITING_UI_DELAY: Duration = Duration::from_secs(45);

fn stall_timeout(section_target_duration_secs: f64) -> Duration {
    if section_target_duration_secs > 0.0 {
        let secs = (section_target_duration_secs * 4.0).clamp(300.0, 900.0) as u64;
        Duration::from_secs(secs)
    } else {
        STALL_TIMEOUT_DEFAULT
    }
}

fn download_output_bytes(path: &Path) -> u64 {
    let part = {
        let mut p = path.as_os_str().to_os_string();
        p.push(".part");
        PathBuf::from(p)
    };
    for candidate in [part, path.to_path_buf()] {
        if let Ok(meta) = std::fs::metadata(&candidate) {
            return meta.len();
        }
    }
    0
}

#[allow(clippy::too_many_arguments)]
fn wait_child_slot(
    child_slot: &Arc<Mutex<Option<Child>>>,
    cancel: &AtomicBool,
    pct: &AtomicU8,
    has_progress: &AtomicBool,
    stderr_tail: Arc<Mutex<Vec<String>>>,
    last_output: Arc<Mutex<Instant>>,
    download_phase: Arc<AtomicBool>,
    stall_limit: Duration,
    watch_output: PathBuf,
    readers: &mut Vec<thread::JoinHandle<()>>,
    on_progress: Option<ProgressFn>,
    on_stage: Option<StageFn>,
) -> Result<()> {
    let mut last_pct = None;
    let mut announced_wait = false;
    let mut last_heartbeat = Instant::now();
    let mut last_disk_bytes = 0u64;
    loop {
        if cancel.load(Ordering::SeqCst) {
            if let Ok(mut guard) = child_slot.lock()
                && let Some(child) = guard.take()
            {
                process::kill_process_tree(child.id());
            }
            join_output_readers(readers);
            return Err(DollytError::Cancelled);
        }
        let bytes = download_output_bytes(&watch_output);
        if bytes > last_disk_bytes {
            last_disk_bytes = bytes;
            if let Ok(mut at) = last_output.lock() {
                *at = Instant::now();
            }
            if bytes > 4096 {
                download_phase.store(true, Ordering::Relaxed);
                has_progress.store(true, Ordering::Relaxed);
            }
        }
        let silent_for = last_output
            .lock()
            .map(|at| at.elapsed())
            .unwrap_or_default();
        let stalled = silent_for > stall_limit;
        let in_download = download_phase.load(Ordering::Relaxed);
        if !stalled && in_download && silent_for >= WAITING_UI_DELAY && !announced_wait {
            announced_wait = true;
            if let Some(cb) = &on_stage {
                cb("waiting");
            }
        } else if !stalled && announced_wait && (silent_for < WAITING_UI_DELAY || !in_download) {
            announced_wait = false;
            if let Some(cb) = &on_stage {
                cb(if has_progress.load(Ordering::Relaxed) {
                    "download"
                } else {
                    "metadata"
                });
            }
        }
        if in_download
            && !stalled
            && silent_for >= Duration::from_secs(30)
            && last_heartbeat.elapsed() >= Duration::from_secs(30)
        {
            last_heartbeat = Instant::now();
            crate::log::log_line(&format!(
                "yt-dlp actif sans ligne depuis {} s (section ou fusion en cours)",
                silent_for.as_secs()
            ));
        }
        if stalled {
            crate::log::log_line(&format!(
                "téléchargement arrêté: aucune donnée reçue depuis {} s",
                stall_limit.as_secs()
            ));
            if let Ok(mut guard) = child_slot.lock()
                && let Some(child) = guard.take()
            {
                process::kill_process_tree(child.id());
            }
            join_output_readers(readers);
            return Err(DollytError::YtdlpFailed(format!(
                "yt-dlp ne répond plus (aucune donnée depuis {} s). Réessaie ou vérifie ta connexion.",
                stall_limit.as_secs()
            )));
        }
        let status = {
            let mut guard = child_slot
                .lock()
                .map_err(|_| DollytError::YtdlpFailed("verrou job".into()))?;
            let Some(child) = guard.as_mut() else {
                return Err(DollytError::YtdlpFailed("processus absent".into()));
            };
            match child.try_wait() {
                Ok(Some(status)) => Some(status),
                Ok(None) => None,
                Err(e) => return Err(DollytError::from(e)),
            }
        };
        if let Some(cb) = &on_progress
            && has_progress.load(Ordering::Relaxed)
        {
            let current = pct.load(Ordering::Relaxed);
            if last_pct != Some(current) {
                cb(Some(current));
                last_pct = Some(current);
            }
        }
        match status {
            None => std::thread::sleep(Duration::from_millis(100)),
            Some(status) if status.success() => {
                let _ = child_slot.lock().map(|mut g| g.take());
                join_output_readers(readers);
                if let Some(cb) = &on_progress
                    && has_progress.load(Ordering::Relaxed)
                {
                    let final_pct = pct.load(Ordering::Relaxed);
                    if last_pct != Some(final_pct) {
                        cb(Some(final_pct));
                    }
                }
                return Ok(());
            }
            Some(_) => {
                let _ = child_slot.lock().map(|mut g| g.take());
                join_output_readers(readers);
                let detail = stderr_tail
                    .lock()
                    .ok()
                    .map(|t| {
                        let joined = t.join("\n");
                        if joined.is_empty() {
                            "yt-dlp s'est terminé avec une erreur".to_string()
                        } else {
                            ytdlp_user_message(&joined)
                        }
                    })
                    .unwrap_or_else(|| "yt-dlp s'est terminé avec une erreur".into());
                return Err(DollytError::YtdlpFailed(detail));
            }
        }
    }
}

fn join_output_readers(readers: &mut Vec<thread::JoinHandle<()>>) {
    for reader in readers.drain(..) {
        if reader.join().is_err() {
            crate::log::log_line("un lecteur de sortie yt-dlp s'est arrêté anormalement");
        }
    }
}

struct TempInfoJson {
    path: PathBuf,
}

impl Drop for TempInfoJson {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn write_temp_info_json(value: &Value) -> Result<TempInfoJson> {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let millis = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = crate::storage::preview_cache_dir().join(format!("_info-{millis}-{n}.json"));
    std::fs::write(&path, serde_json::to_vec(value)?)?;
    Ok(TempInfoJson { path })
}

fn build_ytdlp_download_args(
    format_id: &str,
    out: &str,
    use_sections: bool,
    section: &str,
    page_url: &str,
    info_json: Option<&Path>,
) -> Vec<String> {
    let mut args = vec![
        "-f".to_string(),
        format_id.to_string(),
        "-N".to_string(),
        "4".to_string(),
        "-o".to_string(),
        out.to_string(),
    ];
    if use_sections {
        args.push("--download-sections".to_string());
        args.push(section.to_string());
        args.push("--merge-output-format".to_string());
        args.push("mkv".to_string());
        // shortcut: FFmpeg 8.1 on Windows treats negative short_seek as UINT64_MAX; force HTTP Range seek
        args.push("--downloader-args".to_string());
        args.push("ffmpeg_i:-short_seek_size 1".to_string());
    }
    if format_id.contains('+') && !use_sections {
        args.push("--merge-output-format".to_string());
        args.push("mkv".to_string());
    }
    if let Some(path) = info_json.filter(|_| !use_sections) {
        args.push("--load-info-json".to_string());
        args.push(path.to_string_lossy().into_owned());
        crate::log::log_line(
            "téléchargement yt-dlp avec métadonnées récentes (sans deuxième extraction)",
        );
    }
    args.push(page_url.to_string());
    args
}

fn temp_mkv_path() -> PathBuf {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let millis = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let p = crate::storage::preview_cache_dir().join(format!("_download-{millis}-{n}.mkv"));
    let _ = std::fs::remove_file(&p);
    p
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn stall_timeout_grows_with_clip_duration() {
        assert_eq!(stall_timeout(0.0), Duration::from_secs(120));
        assert_eq!(stall_timeout(30.0), Duration::from_secs(300));
        assert_eq!(stall_timeout(125.0), Duration::from_secs(500));
        assert_eq!(stall_timeout(400.0), Duration::from_secs(900));
    }

    #[test]
    fn download_args_skip_info_json_with_sections() {
        let args = build_ytdlp_download_args(
            "299+251",
            "out.mkv",
            true,
            "*10-20",
            "https://example.com/watch?v=x",
            Some(Path::new("C:\\temp\\info.json")),
        );
        assert!(!args.iter().any(|a| a == "--load-info-json"));
        assert!(args.iter().any(|a| a == "--download-sections"));
        assert!(
            args.windows(2)
                .any(|w| w == ["--downloader-args", "ffmpeg_i:-short_seek_size 1"])
        );
    }

    #[test]
    fn download_args_section_short_seek_not_used_for_full_download() {
        let args = build_ytdlp_download_args(
            "299+251",
            "out.mkv",
            false,
            "*10-20",
            "https://example.com/watch?v=x",
            None,
        );
        assert!(!args.iter().any(|a| a == "--downloader-args"));
    }

    #[test]
    fn download_args_include_info_json_for_full_download() {
        let args = build_ytdlp_download_args(
            "299+251",
            "out.mkv",
            false,
            "*10-20",
            "https://example.com/watch?v=x",
            Some(Path::new("C:\\temp\\info.json")),
        );
        assert!(
            args.windows(2)
                .any(|w| w == ["--load-info-json", "C:\\temp\\info.json"])
        );
    }

    #[test]
    fn metadata_cache_reuses_recent_entries_and_expires_old_ones() {
        let mut cache = MetadataCache::default();
        let now = Instant::now();
        let value = serde_json::json!({ "title": "cached" });
        cache.insert("https://www.youtube.com/watch?v=test", value.clone(), now);

        assert_eq!(
            cache.get(
                "https://www.youtube.com/watch?v=test",
                now + Duration::from_secs(60),
            ),
            Some(value)
        );
        assert_eq!(
            cache.get(
                "https://www.youtube.com/watch?v=test",
                now + METADATA_CACHE_TTL,
            ),
            None
        );
    }

    #[test]
    fn metadata_cache_evicts_oldest_entry_when_full() {
        let mut cache = MetadataCache::default();
        let now = Instant::now();
        for index in 0..=METADATA_CACHE_CAPACITY {
            cache.insert(
                format!("https://www.youtube.com/watch?v={index}"),
                serde_json::json!({ "id": index }),
                now + Duration::from_secs(index as u64),
            );
        }

        assert_eq!(cache.entries.len(), METADATA_CACHE_CAPACITY);
        assert_eq!(
            cache.get(
                "https://www.youtube.com/watch?v=0",
                now + Duration::from_secs(METADATA_CACHE_CAPACITY as u64),
            ),
            None
        );
    }

    #[test]
    fn parses_ffmpeg_time_from_progress_line() {
        assert_eq!(parse_ffmpeg_time("time=00:00:05.20"), Some(5.2));
        assert_eq!(parse_ffmpeg_time("time=01:02:03.00"), Some(3723.0));
        assert_eq!(parse_ffmpeg_time("time=120.50"), Some(120.5));
        assert_eq!(parse_ffmpeg_time("frame=242 fps=0.0"), None);
        assert_eq!(
            parse_ffmpeg_time(
                "frame=  111 fps=0.0 q=-1.0 size=     107KiB time=-00:00:01.16 bitrate=N/A speed=N/A elapsed=0:00:00.50"
            ),
            None
        );
        assert_eq!(
            parse_ffmpeg_time("time=-00:00:01.48 bitrate=N/A time=00:00:01.11 bitrate=6.2kbits/s"),
            Some(1.11)
        );
        assert_eq!(
            parse_ffmpeg_time(
                "frame= 417 fps= 85 q=-1.0 size=   2304KiB time=00:00:13.48 bitrate=1205.5kbits/s speed=1.25x elapsed=0:00:11.15"
            ),
            Some(13.48)
        );
    }

    #[test]
    fn picks_format_18_first() {
        let json = fs::read_to_string("fixtures/m0_metadata.json").expect("fixture");
        let value: Value = serde_json::from_str(&json).expect("json");
        let formats = value["formats"].as_array().expect("formats");
        let (id, url) = format::pick_muxed_format(formats).expect("muxed");
        assert_eq!(id, "18");
        assert!(url.starts_with("https://"));
    }

    #[test]
    fn percent_never_moves_backwards() {
        let pct = AtomicU8::new(40);
        note_percent(&pct, 12);
        assert_eq!(pct.load(Ordering::Relaxed), 40);
        note_percent(&pct, 55);
        assert_eq!(pct.load(Ordering::Relaxed), 55);
    }

    #[test]
    fn parses_download_progress_percent_template() {
        assert_eq!(parse_ytdlp_percent("download: 5.0%"), Some(5));
        assert_eq!(parse_ytdlp_percent("download:100.0%"), Some(100));
        assert_eq!(parse_ytdlp_percent("  5.0%"), Some(5));
        assert_eq!(parse_ytdlp_percent("[download] 5.0% of 20 MiB"), Some(5));
        assert_eq!(
            parse_ytdlp_percent("[download] Destination: video.mp4"),
            None
        );
    }

    #[test]
    fn retries_http_403_once_with_a_fresh_extraction() {
        let attempts = std::cell::Cell::new(0);
        let result = retry_once_on_http_403(
            || {
                let attempt = attempts.get() + 1;
                attempts.set(attempt);
                if attempt == 1 {
                    Err(DollytError::YtdlpFailed(
                        "Le serveur vidéo a refusé la requête (HTTP 403).".into(),
                    ))
                } else {
                    Ok("downloaded")
                }
            },
            || {},
        );

        assert_eq!(result.unwrap(), "downloaded");
        assert_eq!(attempts.get(), 2);
    }

    #[test]
    fn does_not_retry_non_403_download_errors() {
        let attempts = std::cell::Cell::new(0);
        let result: Result<()> = retry_once_on_http_403(
            || {
                attempts.set(attempts.get() + 1);
                Err(DollytError::YtdlpFailed("offline".into()))
            },
            || {},
        );

        assert!(result.is_err());
        assert_eq!(attempts.get(), 1);
    }

    #[test]
    fn stops_after_one_retry_when_the_server_still_returns_403() {
        let attempts = std::cell::Cell::new(0);
        let result: Result<()> = retry_once_on_http_403(
            || {
                attempts.set(attempts.get() + 1);
                Err(DollytError::YtdlpFailed(
                    "Le serveur vidéo a refusé la requête (HTTP 403).".into(),
                ))
            },
            || {},
        );

        assert!(result.is_err());
        assert_eq!(attempts.get(), 2);
    }

    #[test]
    fn reports_403_without_leaking_the_signed_video_url() {
        let message = ytdlp_user_message(
            "HTTP error 403 Forbidden Error opening input file https://rr4.googlevideo.com/videoplayback?ip=192.0.2.1&sig=private",
        );

        assert!(message.contains("HTTP 403"));
        assert!(!message.contains("googlevideo"));
        assert!(!message.contains("192.0.2.1"));
        assert!(!message.contains("private"));
    }

    #[test]
    #[ignore = "réseau YouTube requis"]
    fn live_me_at_the_zoo_pipeline() {
        crate::bins::ensure_tools().expect("bins");
        let url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
        let info =
            video_info_from_json(&fetch_metadata_json(url).expect("métadonnées")).expect("infos");
        assert_eq!(info.format_id, "18");
        let progress_values = Arc::new(Mutex::new(Vec::new()));
        let progress_sink = Arc::clone(&progress_values);
        let on_progress: ProgressFn = Arc::new(move |percent| {
            if let Some(percent) = percent {
                progress_sink.lock().unwrap().push(percent);
            }
        });
        let cancel = AtomicBool::new(false);
        let child_slot = Arc::new(Mutex::new(None));
        let dl = download_section_cancellable(
            url,
            &info.format_id,
            5.0,
            12.0,
            3.0,
            false,
            &cancel,
            &child_slot,
            Some(on_progress),
            None,
            0.0,
            None,
        )
        .expect("téléchargement");
        let progress_values = progress_values.lock().unwrap();
        assert!(
            !progress_values.is_empty(),
            "le téléchargement doit publier un pourcentage"
        );
        assert!(progress_values.iter().all(|percent| *percent <= 100));
        drop(progress_values);
        let cut = crate::ffmpeg::cut_exact_section(&dl.path, 5.0, 12.0, dl.section_lo_secs)
            .expect("découpe");
        assert!((cut.output_duration_secs - 7.0).abs() < 0.75);
        eprintln!(
            "download_ms={} cut_ms={} duration={}",
            dl.elapsed_ms, cut.elapsed_ms, cut.output_duration_secs
        );
    }

    #[test]
    fn falls_back_to_other_muxed() {
        let json = fs::read_to_string("fixtures/m0_no18.json").expect("fixture");
        let value: Value = serde_json::from_str(&json).expect("json");
        let formats = value["formats"].as_array().expect("formats");
        let (id, _) = format::pick_muxed_format(formats).expect("muxed");
        assert_eq!(id, "22");
    }

    #[test]
    fn rejects_option_like_format_selectors() {
        assert!(!valid_format_selector("--exec"));
        assert!(!valid_format_selector("18\n--exec"));
        assert!(valid_format_selector("bestvideo+bestaudio"));
    }

    #[test]
    fn preview_url_rejects_option_like_format_selectors_before_spawning() {
        let error = resolve_muxed_stream_url("https://www.youtube.com/watch?v=abc", "--exec")
            .unwrap_err()
            .to_string();
        assert!(error.contains("sélecteur de format invalide"));
    }

    #[test]
    fn temporary_download_guard_removes_partial_output() {
        let path = std::env::temp_dir().join("dollyt-partial-download-test.mkv");
        fs::write(&path, b"partial").unwrap();
        {
            let _guard = TemporaryDownloadGuard::new(path.clone());
        }
        assert!(!path.exists());
    }
}

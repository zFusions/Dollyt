use crate::error::{DollytError, Result};
use crate::format;
use crate::process;
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::Child;
use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

pub type ProgressFn = Arc<dyn Fn(u8) + Send + Sync>;

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
}

/// Test rapide sans lien utilisateur (Me at the zoo).
pub fn probe_youtube() -> Result<Value> {
    fetch_metadata_json("https://www.youtube.com/watch?v=jNQXAC9IVRw")
}

pub fn fetch_metadata_json(url: &str) -> Result<Value> {
    let output = process::run_ytdlp(&["-J", url])?;
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
    if s.len() > 320 {
        format!("{}…", &s[..320])
    } else if s.is_empty() {
        "yt-dlp n'a pas renvoyé de métadonnées.".into()
    } else {
        s.to_string()
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
    let fmt = if format_id.is_empty() {
        "18/b".to_string()
    } else {
        format_id.to_string()
    };
    let output = process::run_ytdlp(&["-f", &fmt, "-g", page_url])?;
    if !output.status.success() {
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

#[cfg(test)]
pub fn download_section(
    url: &str,
    format_id: &str,
    start_secs: f64,
    end_secs: f64,
    margin_secs: f64,
) -> Result<DownloadResult> {
    let cancel = AtomicBool::new(false);
    let slot = Arc::new(Mutex::new(None::<Child>));
    download_section_cancellable(
        url,
        format_id,
        start_secs,
        end_secs,
        margin_secs,
        &cancel,
        &slot,
        None,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn download_section_cancellable(
    url: &str,
    format_id: &str,
    start_secs: f64,
    end_secs: f64,
    margin_secs: f64,
    cancel: &AtomicBool,
    child_slot: &Arc<Mutex<Option<Child>>>,
    on_progress: Option<ProgressFn>,
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
    let out_arg = out.to_str().expect("chemin temporaire UTF-8");
    let start = SystemTime::now();
    let mut args: Vec<&str> = vec![
        "-f",
        format_id,
        "-N",
        "4",
        "--download-sections",
        &section,
        "-o",
        out_arg,
    ];
    if format_id.contains('+') {
        args.extend(["--merge-output-format", "mkv"]);
    }

    args.push(url);
    let args = args.as_slice();
    let mut child = process::spawn_ytdlp(args)?;
    let stderr = child.stderr.take();
    let pct = Arc::new(AtomicU8::new(0));
    if let Some(stderr) = stderr {
        let pct_bg = Arc::clone(&pct);
        thread::spawn(move || read_ytdlp_stderr(stderr, pct_bg));
    }

    if let Ok(mut guard) = child_slot.lock() {
        *guard = Some(child);
    }
    wait_child_slot(child_slot, cancel, &pct, on_progress)?;
    let elapsed_ms = start.elapsed().unwrap_or_default().as_millis() as u64;
    if !out.exists() {
        return Err(DollytError::YtdlpFailed(
            "fichier MKV absent après téléchargement".into(),
        ));
    }
    Ok(DownloadResult {
        path: out.to_string_lossy().into_owned(),
        elapsed_ms,
    })
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

fn read_ytdlp_stderr(stderr: std::process::ChildStderr, pct: Arc<AtomicU8>) {
    let reader = BufReader::new(stderr);
    for line in reader.lines().map_while(|l| l.ok()) {
        if let Some(value) = parse_ytdlp_percent(&line) {
            pct.store(value, Ordering::Relaxed);
        }
    }
}

fn parse_ytdlp_percent(line: &str) -> Option<u8> {
    let rest = line.trim().strip_prefix("download:")?;
    let digits: String = rest
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    digits
        .parse::<f32>()
        .ok()
        .map(|v| v.clamp(0.0, 100.0) as u8)
}

fn wait_child_slot(
    child_slot: &Arc<Mutex<Option<Child>>>,
    cancel: &AtomicBool,
    pct: &AtomicU8,
    on_progress: Option<ProgressFn>,
) -> Result<()> {
    let mut last_emit = Instant::now();
    let mut last_pct = 0u8;
    loop {
        if cancel.load(Ordering::SeqCst) {
            if let Ok(mut guard) = child_slot.lock()
                && let Some(child) = guard.take()
            {
                process::kill_process_tree(child.id());
            }
            return Err(DollytError::Cancelled);
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
        if let Some(cb) = &on_progress {
            let now = Instant::now();
            let current = pct.load(Ordering::Relaxed);
            if current != last_pct && now.duration_since(last_emit) >= Duration::from_millis(100) {
                cb(current);
                last_pct = current;
                last_emit = now;
            }
        }
        match status {
            None => std::thread::sleep(Duration::from_millis(100)),
            Some(status) if status.success() => {
                let _ = child_slot.lock().map(|mut g| g.take());
                return Ok(());
            }
            Some(_) => {
                return Err(DollytError::YtdlpFailed(
                    "yt-dlp s'est terminé avec une erreur".into(),
                ));
            }
        }
    }
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
    fn picks_format_18_first() {
        let json = fs::read_to_string("fixtures/m0_metadata.json").expect("fixture");
        let value: Value = serde_json::from_str(&json).expect("json");
        let formats = value["formats"].as_array().expect("formats");
        let (id, url) = format::pick_muxed_format(formats).expect("muxed");
        assert_eq!(id, "18");
        assert!(url.starts_with("https://"));
    }

    #[test]
    #[ignore = "réseau YouTube requis"]
    fn live_me_at_the_zoo_pipeline() {
        crate::bins::ensure_tools().expect("bins");
        let url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
        let info =
            video_info_from_json(&fetch_metadata_json(url).expect("métadonnées")).expect("infos");
        assert_eq!(info.format_id, "18");
        let dl = download_section(url, &info.format_id, 5.0, 12.0, 3.0).expect("téléchargement");
        let cut = crate::ffmpeg::cut_exact_section(&dl.path, 5.0, 12.0).expect("découpe");
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
}

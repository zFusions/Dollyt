use crate::error::{DollytError, Result};
use crate::format;
use crate::process;
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub title: String,
    pub duration_secs: f64,
    pub preview_url: String,
    pub format_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub path: String,
    pub elapsed_ms: u64,
}

pub fn fetch_video_info(url: &str) -> Result<VideoInfo> {
    let output = process::run_ytdlp(&["-J", url])?;
    let value: Value = serde_json::from_slice(&output.stdout)?;
    let title = value
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Sans titre")
        .to_string();
    let duration_secs = value
        .get("duration")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let formats = value
        .get("formats")
        .and_then(|v| v.as_array())
        .map(|v| v.as_slice())
        .unwrap_or(&[]);
    let (format_id, preview_url) =
        format::pick_muxed_format(formats).ok_or(DollytError::NoMuxedFormat)?;
    Ok(VideoInfo {
        title,
        duration_secs,
        preview_url,
        format_id,
    })
}

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
    )
}

pub fn download_section_cancellable(
    url: &str,
    format_id: &str,
    start_secs: f64,
    end_secs: f64,
    margin_secs: f64,
    cancel: &AtomicBool,
    child_slot: &Arc<Mutex<Option<Child>>>,
) -> Result<DownloadResult> {
    let lo = (start_secs - margin_secs).max(0.0);
    let hi = end_secs + margin_secs;
    let section = format!("*{lo}-{hi}");
    let out = temp_mkv_path();
    let out_arg = out.to_str().expect("chemin temporaire UTF-8");
    let start = SystemTime::now();
    let args = [
        "-f",
        format_id,
        "--download-sections",
        &section,
        "-o",
        out_arg,
        url,
    ];
    if let Ok(mut guard) = child_slot.lock() {
        *guard = Some(process::spawn_ytdlp(&args)?);
    }
    wait_child_slot(child_slot, cancel)?;
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

fn wait_child_slot(child_slot: &Arc<Mutex<Option<Child>>>, cancel: &AtomicBool) -> Result<()> {
    loop {
        if cancel.load(Ordering::SeqCst) {
            if let Ok(mut guard) = child_slot.lock()
                && let Some(child) = guard.take()
            {
                kill_process_tree(child.id());
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
        match status {
            None => std::thread::sleep(Duration::from_millis(120)),
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

#[cfg(windows)]
fn kill_process_tree(pid: u32) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut cmd = std::process::Command::new("taskkill");
    cmd.args(["/PID", &pid.to_string(), "/T", "/F"]);
    cmd.creation_flags(CREATE_NO_WINDOW);
    let _ = cmd.status();
}

#[cfg(not(windows))]
fn kill_process_tree(_pid: u32) {}

fn temp_mkv_path() -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("dollyt-{stamp}.mkv"))
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
        let info = fetch_video_info(url).expect("métadonnées");
        assert_eq!(info.format_id, "18");
        let dl = download_section(&url, &info.format_id, 5.0, 12.0, 3.0).expect("téléchargement");
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
}

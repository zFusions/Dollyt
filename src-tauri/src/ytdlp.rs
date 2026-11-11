use crate::error::{DollytError, Result};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

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

pub fn pick_muxed_format(formats: &[Value]) -> Option<(String, String)> {
    for format in formats {
        if format.get("format_id").and_then(|v| v.as_str()) != Some("18") {
            continue;
        }
        let id = format.get("format_id")?.as_str()?.to_string();
        let url = format.get("url")?.as_str()?.to_string();
        return Some((id, url));
    }
    for format in formats {
        let vcodec = format
            .get("vcodec")
            .and_then(|v| v.as_str())
            .unwrap_or("none");
        let acodec = format
            .get("acodec")
            .and_then(|v| v.as_str())
            .unwrap_or("none");
        if vcodec == "none" || acodec == "none" {
            continue;
        }
        let protocol = format
            .get("protocol")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if protocol.contains("m3u8") {
            continue;
        }
        let id = format.get("format_id")?.as_str()?.to_string();
        let url = format.get("url")?.as_str()?.to_string();
        return Some((id, url));
    }
    None
}

pub fn fetch_video_info(url: &str) -> Result<VideoInfo> {
    let output = run_ytdlp(&["-J", url])?;
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
    let (format_id, preview_url) = pick_muxed_format(formats).ok_or(DollytError::NoMuxedFormat)?;
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
    let lo = (start_secs - margin_secs).max(0.0);
    let hi = end_secs + margin_secs;
    let section = format!("*{lo}-{hi}");
    let out = temp_mkv_path();
    let start = SystemTime::now();
    let output = run_ytdlp(&[
        "-f",
        format_id,
        "--download-sections",
        &section,
        "-o",
        out.to_str().expect("chemin temporaire UTF-8"),
        url,
    ])?;
    let elapsed_ms = start.elapsed().unwrap_or_default().as_millis() as u64;
    ensure_success(&output, "yt-dlp")?;
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

fn temp_mkv_path() -> PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("dollyt-m0-{stamp}.mkv"))
}

fn run_ytdlp(args: &[&str]) -> Result<Output> {
    let mut cmd = Command::new("yt-dlp");
    cmd.arg("--ignore-config");
    for arg in args {
        cmd.arg(arg);
    }
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output().map_err(DollytError::from)
}

fn ensure_success(output: &Output, tool: &str) -> Result<()> {
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let message = if stderr.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        stderr.trim().to_string()
    };
    match tool {
        "yt-dlp" => Err(DollytError::YtdlpFailed(message)),
        _ => Err(DollytError::FfmpegFailed(message)),
    }
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
        let (id, url) = pick_muxed_format(formats).expect("muxed");
        assert_eq!(id, "18");
        assert!(url.starts_with("https://"));
    }

    #[test]
    #[ignore = "réseau YouTube requis"]
    fn live_me_at_the_zoo_pipeline() {
        let url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
        let info = fetch_video_info(url).expect("métadonnées");
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
        let (id, _) = pick_muxed_format(formats).expect("muxed");
        assert_eq!(id, "22");
    }
}

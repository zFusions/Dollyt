use crate::error::{DollytError, Result};
use crate::process;
use serde::Serialize;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CutResult {
    pub path: String,
    pub output_duration_secs: f64,
    pub elapsed_ms: u64,
}

pub fn cut_exact_section(
    mkv_path: &str,
    trim_start_secs: f64,
    trim_end_secs: f64,
) -> Result<CutResult> {
    let input = Path::new(mkv_path);
    if !input.exists() {
        return Err(DollytError::FfmpegFailed(format!(
            "fichier introuvable : {mkv_path}"
        )));
    }
    let file_start = probe_start_secs(mkv_path)?;
    let relative_start = (trim_start_secs - file_start).max(0.0);
    let duration = (trim_end_secs - trim_start_secs).max(0.0);
    if duration <= 0.0 {
        return Err(DollytError::FfmpegFailed(
            "plage invalide : fin avant début".into(),
        ));
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let out = std::env::temp_dir().join(format!("dollyt-cut-{stamp}.mp4"));
    let start = SystemTime::now();
    let output = process::run_ffmpeg(&[
        "-y",
        "-ss",
        &format!("{relative_start:.3}"),
        "-i",
        mkv_path,
        "-t",
        &format!("{duration:.3}"),
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "fast",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        out.to_str().expect("chemin UTF-8"),
    ])?;
    ensure_success(&output)?;
    let elapsed_ms = start.elapsed().unwrap_or_default().as_millis() as u64;
    let output_duration_secs = probe_duration_secs(out.to_str().expect("chemin UTF-8"))?;
    Ok(CutResult {
        path: out.to_string_lossy().into_owned(),
        output_duration_secs,
        elapsed_ms,
    })
}

fn probe_start_secs(path: &str) -> Result<f64> {
    let output = process::run_ffprobe(&[
        "-v",
        "error",
        "-show_entries",
        "format=start_time",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        path,
    ])?;
    ensure_success(&output)?;
    Ok(parse_first_float(&output.stdout).unwrap_or(0.0))
}

fn probe_duration_secs(path: &str) -> Result<f64> {
    let output = process::run_ffprobe(&[
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        path,
    ])?;
    ensure_success(&output)?;
    Ok(parse_first_float(&output.stdout).unwrap_or(0.0))
}

fn parse_first_float(bytes: &[u8]) -> Option<f64> {
    let text = String::from_utf8_lossy(bytes);
    text.lines()
        .find_map(|line| line.trim().parse::<f64>().ok())
}

fn ensure_success(output: &std::process::Output) -> Result<()> {
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(DollytError::FfmpegFailed(stderr.trim().to_string()))
}

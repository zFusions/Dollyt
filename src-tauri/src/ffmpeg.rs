use crate::error::{DollytError, Result};
use crate::presets::Preset;
use crate::process;
use crate::settings::Settings;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

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
    let preset = Preset {
        id: "edition".into(),
        name: "Édition".into(),
        container: "mp4".into(),
        video_codec: "libx264".into(),
        audio_codec: "aac".into(),
        crf: Some(18),
        width: None,
        height: None,
        fps: None,
        crop: "none".into(),
        audio_bitrate_kbps: Some(192),
        name_template: "{titre}_{debut}-{fin}".into(),
        description: String::new(),
        video_max_bitrate_kbps: None,
    };
    let out = temp_mp4_path();
    export_section(
        mkv_path,
        trim_start_secs,
        trim_end_secs,
        &preset,
        &out,
        false,
        "fast",
    )
}

pub fn export_section(
    input_path: &str,
    trim_start_secs: f64,
    trim_end_secs: f64,
    preset: &Preset,
    out_path: &Path,
    hardware_encode: bool,
    x264_preset: &str,
) -> Result<CutResult> {
    let input = Path::new(input_path);
    if !input.exists() {
        return Err(DollytError::FfmpegFailed(format!(
            "fichier introuvable : {input_path}"
        )));
    }
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let file_start = probe_start_secs(input_path)?;
    let relative_start = (trim_start_secs - file_start).max(0.0);
    let duration = (trim_end_secs - trim_start_secs).max(0.0);
    if duration <= 0.0 {
        return Err(DollytError::FfmpegFailed(
            "plage invalide : fin avant début".into(),
        ));
    }
    let start = std::time::SystemTime::now();
    let ss = format!("{relative_start:.3}");
    let dur = format!("{duration:.3}");
    let maxrate = preset.video_max_bitrate_kbps.map(|k| format!("{k}k"));
    let bufsize = preset
        .video_max_bitrate_kbps
        .map(|k| format!("{}k", k.saturating_mul(2)));
    let vf = video_filter_for_preset(preset);
    let vcodec = pick_video_encoder(preset, hardware_encode).to_string();
    let crf = preset.crf.map(|c| c.to_string());
    let ab = preset
        .audio_bitrate_kbps
        .map(|k| format!("{k}k"))
        .unwrap_or_default();
    let fps = preset.fps.map(|f| f.to_string());

    let mut args: Vec<&str> = vec!["-y", "-ss", &ss, "-i", input_path, "-t", &dur];
    if let Some(filter) = vf.as_deref() {
        args.extend(["-vf", filter]);
    }
    if preset.video_codec == "copy" && preset.audio_codec == "copy" {
        args.extend(["-c", "copy"]);
    } else {
        args.extend(["-c:v", vcodec.as_str()]);
        if vcodec == "libx264" {
            if let Some(crf) = &crf {
                args.extend(["-crf", crf.as_str()]);
            }
            args.extend(["-preset", x264_preset]);
            if let (Some(m), Some(b)) = (maxrate.as_deref(), bufsize.as_deref()) {
                args.extend(["-maxrate", m, "-bufsize", b]);
            }
        }
        if let Some(fps) = &fps {
            args.push("-r");
            args.push(fps.as_str());
        }
        args.extend(["-c:a", preset.audio_codec.as_str()]);
        if !ab.is_empty() {
            args.extend(["-b:a", ab.as_str()]);
        }
    }
    let out_str = out_path.to_str().expect("chemin UTF-8");
    args.push(out_str);
    let output = process::run_ffmpeg(&args)?;
    ensure_success(&output)?;
    let elapsed_ms = start.elapsed().unwrap_or_default().as_millis() as u64;
    let output_duration_secs = probe_duration_secs(out_str)?;
    Ok(CutResult {
        path: out_path.to_string_lossy().into_owned(),
        output_duration_secs,
        elapsed_ms,
    })
}

pub fn export_to_settings_path(
    input_path: &str,
    title: &str,
    trim_start_secs: f64,
    trim_end_secs: f64,
    preset: &Preset,
    settings: &Settings,
) -> Result<CutResult> {
    let mut effective = preset.clone();
    crate::settings::apply_dev_overrides(&mut effective, settings);
    let x264_preset = crate::settings::dev_x264_preset(settings);
    let out = crate::settings::resolve_export_path(
        &effective.name_template,
        title,
        trim_start_secs,
        trim_end_secs,
        &effective.container,
    );
    export_section(
        input_path,
        trim_start_secs,
        trim_end_secs,
        &effective,
        &out,
        settings.hardware_encode,
        x264_preset,
    )
}

fn pick_video_encoder(preset: &Preset, hardware_encode: bool) -> &str {
    if hardware_encode && preset.video_codec == "libx264" {
        "h264_nvenc"
    } else {
        preset.video_codec.as_str()
    }
}

fn video_filter_for_preset(preset: &Preset) -> Option<String> {
    let w = preset.width?;
    let h = preset.height?;
    if w == 0 || h == 0 {
        return None;
    }
    if preset.crop == "center" && w < h {
        return Some("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920".into());
    }
    Some(format!(
        "scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"
    ))
}

fn temp_mp4_path() -> PathBuf {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("dollyt-cut-{stamp}.mp4"))
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

pub fn file_duration_secs(path: &str) -> Result<f64> {
    probe_duration_secs(path)
}

/** WebView2 ne lit pas le MKV yt-dlp : remux copie vers MP4. */
pub fn remux_preview_mp4(mkv_path: &str) -> Result<String> {
    let out = crate::storage::preview_mp4_path();
    let _ = fs::remove_file(&out);
    let out_str = out.to_str().expect("chemin UTF-8");
    let output = process::run_ffmpeg(&[
        "-y",
        "-i",
        mkv_path,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        out_str,
    ])?;
    ensure_success(&output)?;
    Ok(out.to_string_lossy().into_owned())
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

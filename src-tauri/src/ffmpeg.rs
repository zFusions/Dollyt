use crate::error::{DollytError, Result};
use crate::presets::Preset;
use crate::process;
use crate::settings::Settings;
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::Path;
#[cfg(test)]
use std::path::PathBuf;
use std::process::{Child, Output};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CutResult {
    pub path: String,
    pub output_duration_secs: f64,
    pub elapsed_ms: u64,
}

pub type EncodeProgressFn = Arc<dyn Fn(f64) + Send + Sync>;

#[cfg(test)]
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

#[cfg(test)]
pub fn export_section(
    input_path: &str,
    trim_start_secs: f64,
    trim_end_secs: f64,
    preset: &Preset,
    out_path: &Path,
    hardware_encode: bool,
    x264_preset: &str,
) -> Result<CutResult> {
    export_section_impl(
        input_path,
        trim_start_secs,
        trim_end_secs,
        preset,
        out_path,
        hardware_encode,
        x264_preset,
        None,
        None,
    )
}

#[allow(clippy::too_many_arguments)]
fn export_section_impl(
    input_path: &str,
    trim_start_secs: f64,
    trim_end_secs: f64,
    preset: &Preset,
    out_path: &Path,
    hardware_encode: bool,
    x264_preset: &str,
    cancel_ctx: Option<(&AtomicBool, &Arc<Mutex<Option<Child>>>)>,
    on_encode: Option<EncodeProgressFn>,
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
    let stream_copy = preset.video_codec == "copy" && preset.audio_codec == "copy";
    let vf = if preset.video_codec == "copy" {
        None
    } else {
        video_filter_for_preset(preset)
    };
    let vcodec = pick_video_encoder(preset, hardware_encode);
    let crf = preset.crf.map(|c| c.to_string());
    let ab = preset
        .audio_bitrate_kbps
        .map(|k| format!("{k}k"))
        .unwrap_or_default();
    let fps = preset.fps.map(|f| f.to_string());

    let mut args: Vec<&str> = vec!["-y", "-ss", &ss, "-i", input_path, "-t", &dur];
    args.extend(["-map", "0:v:0", "-map", "0:a:0?"]);
    if let Some(filter) = vf.as_deref() {
        args.extend(["-vf", filter]);
    }
    if stream_copy {
        args.extend(["-c", "copy"]);
    } else {
        args.extend(["-c:v", vcodec.as_str()]);
        if vcodec == "libx264" || vcodec == "h264_nvenc" {
            if let Some(crf) = &crf {
                args.extend([
                    if vcodec == "h264_nvenc" {
                        "-cq"
                    } else {
                        "-crf"
                    },
                    crf.as_str(),
                ]);
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
    let on_media_time = on_encode.map(|cb| {
        let duration = duration.max(0.001);
        Arc::new(move |secs: f64| cb((secs / duration).clamp(0.0, 1.0)))
            as Arc<dyn Fn(f64) + Send + Sync>
    });
    let output = match cancel_ctx {
        Some((cancel, slot)) => run_ffmpeg_cancellable(&args, cancel, slot, on_media_time)?,
        None => process::run_ffmpeg(&args)?,
    };
    ensure_success(&output)?;
    let elapsed_ms = start.elapsed().unwrap_or_default().as_millis() as u64;
    let output_duration_secs = probe_duration_secs(out_str)?;
    Ok(CutResult {
        path: out_path.to_string_lossy().into_owned(),
        output_duration_secs,
        elapsed_ms,
    })
}

#[allow(clippy::too_many_arguments)]
pub fn export_to_settings_path_cancellable(
    input_path: &str,
    title: &str,
    trim_start_secs: f64,
    trim_end_secs: f64,
    preset: &Preset,
    settings: &Settings,
    cancel: &AtomicBool,
    child_slot: &Arc<Mutex<Option<Child>>>,
    on_encode: Option<EncodeProgressFn>,
) -> Result<CutResult> {
    export_to_settings_path_impl(
        input_path,
        title,
        trim_start_secs,
        trim_end_secs,
        preset,
        settings,
        Some((cancel, child_slot)),
        on_encode,
    )
}

#[allow(clippy::too_many_arguments)]
fn export_to_settings_path_impl(
    input_path: &str,
    title: &str,
    trim_start_secs: f64,
    trim_end_secs: f64,
    preset: &Preset,
    settings: &Settings,
    cancel_ctx: Option<(&AtomicBool, &Arc<Mutex<Option<Child>>>)>,
    on_encode: Option<EncodeProgressFn>,
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
    export_section_impl(
        input_path,
        trim_start_secs,
        trim_end_secs,
        &effective,
        &out,
        settings.hardware_encode,
        x264_preset,
        cancel_ctx,
        on_encode,
    )
}

fn nvenc_available() -> bool {
    static OK: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *OK.get_or_init(|| {
        process::run_ffmpeg(&["-hide_banner", "-encoders"])
            .map(|o| {
                o.status.success() && String::from_utf8_lossy(&o.stdout).contains("h264_nvenc")
            })
            .unwrap_or(false)
    })
}

fn pick_video_encoder(preset: &Preset, hardware_encode: bool) -> String {
    if hardware_encode && preset.video_codec == "libx264" && nvenc_available() {
        "h264_nvenc".to_string()
    } else {
        preset.video_codec.clone()
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

#[cfg(test)]
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

/** WebView2 ne lit pas le MKV : remux copie vers MP4 pour la preview. */
pub fn remux_download_preview(source: &str) -> Result<String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let out = crate::storage::temp_cache_root()
        .join("download-preview")
        .join(format!("preview-{timestamp}.mp4"));
    if let Some(parent) = out.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::remove_file(&out);
    let out_str = out.to_str().expect("chemin UTF-8");
    let output = process::run_ffmpeg(&[
        "-y",
        "-i",
        source,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        out_str,
    ])?;
    ensure_success(&output)?;
    Ok(out.to_string_lossy().into_owned())
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
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
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

fn run_ffmpeg_cancellable(
    args: &[&str],
    cancel: &AtomicBool,
    child_slot: &Arc<Mutex<Option<Child>>>,
    on_media_time: Option<Arc<dyn Fn(f64) + Send + Sync>>,
) -> Result<Output> {
    let mut child = process::spawn_ffmpeg(args)?;
    let pid = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    {
        let mut guard = child_slot
            .lock()
            .map_err(|_| DollytError::FfmpegFailed("verrou job".into()))?;
        *guard = Some(child);
    }
    let read_out = thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut r) = stdout {
            let _ = r.read_to_end(&mut buf);
        }
        buf
    });
    let read_err = thread::spawn(move || read_ffmpeg_stderr(stderr, on_media_time));

    let status = loop {
        if cancel.load(Ordering::SeqCst) {
            process::kill_process_tree(pid);
            if let Ok(mut guard) = child_slot.lock()
                && let Some(mut child) = guard.take()
            {
                let _ = child.wait();
            }
            let _ = read_out.join();
            let _ = read_err.join();
            return Err(DollytError::Cancelled);
        }
        let polled = {
            let mut guard = child_slot
                .lock()
                .map_err(|_| DollytError::FfmpegFailed("verrou job".into()))?;
            match guard.as_mut() {
                Some(child) => child.try_wait().map_err(DollytError::from),
                None => {
                    return Err(DollytError::FfmpegFailed("processus absent".into()));
                }
            }
        }?;
        match polled {
            Some(status) => {
                if let Ok(mut guard) = child_slot.lock() {
                    guard.take();
                }
                break status;
            }
            None => thread::sleep(Duration::from_millis(100)),
        }
    };

    let stdout = read_out.join().unwrap_or_default();
    let stderr = read_err.join().unwrap_or_default();
    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

fn read_ffmpeg_stderr(
    stderr: Option<std::process::ChildStderr>,
    on_media_time: Option<Arc<dyn Fn(f64) + Send + Sync>>,
) -> Vec<u8> {
    let mut full = Vec::new();
    let Some(mut r) = stderr else {
        return full;
    };
    let mut chunk = [0u8; 8192];
    let mut tail: Vec<u8> = Vec::new();
    loop {
        match r.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                full.extend_from_slice(&chunk[..n]);
                if let Some(cb) = &on_media_time {
                    let mut data = tail.clone();
                    data.extend_from_slice(&chunk[..n]);
                    if let Some(secs) = last_ffmpeg_time(&data) {
                        cb(secs);
                    }
                    let keep = data.len().min(64);
                    tail = data[data.len() - keep..].to_vec();
                }
            }
        }
    }
    full
}

fn last_ffmpeg_time(data: &[u8]) -> Option<f64> {
    let text = String::from_utf8_lossy(data);
    let mut found = None;
    for (idx, _) in text.match_indices("time=") {
        let rest = &text[idx + 5..];
        let end = rest
            .find(|c: char| c.is_whitespace() || c == '\r' || c == '\n')
            .unwrap_or(rest.len());
        if let Some(secs) = parse_hms(&rest[..end]) {
            found = Some(secs);
        }
    }
    found
}

fn parse_hms(s: &str) -> Option<f64> {
    let s = s.trim().trim_start_matches('-');
    let mut it = s.split(':');
    let h: f64 = it.next()?.parse().ok()?;
    let m: f64 = it.next()?.parse().ok()?;
    let sec: f64 = it.next()?.parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + sec)
}

fn ensure_success(output: &std::process::Output) -> Result<()> {
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(DollytError::FfmpegFailed(stderr.trim().to_string()))
}

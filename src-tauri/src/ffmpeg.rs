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
use std::sync::{Arc, Mutex, OnceLock};
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
    section_lo_secs: f64,
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
        section_lo_secs,
        &preset,
        &out,
        false,
        false,
        "fast",
    )
}

#[cfg(test)]
pub fn export_section(
    input_path: &str,
    trim_start_secs: f64,
    trim_end_secs: f64,
    section_lo_secs: f64,
    preset: &Preset,
    out_path: &Path,
    hardware_encode: bool,
    hw_speed: bool,
    x264_preset: &str,
) -> Result<CutResult> {
    export_section_impl(
        input_path,
        trim_start_secs,
        trim_end_secs,
        section_lo_secs,
        preset,
        out_path,
        hardware_encode,
        hw_speed,
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
    section_lo_secs: f64,
    preset: &Preset,
    out_path: &Path,
    hardware_encode: bool,
    hw_speed: bool,
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
    let has_audio = probe_has_audio(input_path).unwrap_or(true);
    if preset.video_codec == "none" && !has_audio {
        return Err(DollytError::FfmpegFailed(
            "cette vidéo n'a pas de piste audio".into(),
        ));
    }
    let relative_start = (trim_start_secs - section_lo_secs + file_start).max(0.0);
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
    let amf_rate_args = encoder_rate_control_args(
        &vcodec,
        crf.as_deref(),
        maxrate.as_deref(),
        bufsize.as_deref(),
    );
    let openh264_bitrate = (vcodec == "libopenh264").then(|| {
        openh264_bitrate_argument(openh264_target_bitrate_kbps(
            preset.width,
            preset.height,
            preset.crf.unwrap_or(20),
            preset.video_max_bitrate_kbps,
        ))
    });

    let mut args: Vec<&str> = vec!["-y", "-ss", &ss, "-i", input_path, "-t", &dur];
    if preset.video_codec == "none" {
        args.extend(["-vn", "-map", "0:a:0"]);
        args.extend(["-c:a", preset.audio_codec.as_str()]);
        if !ab.is_empty() {
            args.extend(["-b:a", ab.as_str()]);
        }
    } else {
        args.extend(["-map", "0:v:0", "-map", "0:a:0?"]);
        if let Some(filter) = vf.as_deref() {
            args.extend(["-vf", filter]);
        }
        if stream_copy {
            args.extend(["-c", "copy"]);
        } else {
            args.extend(["-c:v", vcodec.as_str()]);
            let is_amf = vcodec == "h264_amf";
            if let Some(bitrate) = openh264_bitrate.as_deref() {
                args.extend(["-b:v", bitrate]);
            }
            if vcodec == "libx264" || vcodec == "h264_nvenc" || is_amf {
                if is_amf {
                    args.extend(amf_rate_args.iter().map(String::as_str));
                    args.extend(["-quality", if hw_speed { "speed" } else { "quality" }]);
                } else {
                    if let Some(crf) = &crf {
                        if vcodec == "h264_nvenc" {
                            args.extend(["-cq", crf.as_str()]);
                        } else {
                            args.extend(["-crf", crf.as_str()]);
                        }
                    }
                    // nvenc n'accepte que des presets p1-p7 : les noms x264
                    // (fast, slow…) feraient échouer l'export.
                    let preset_arg = if vcodec == "h264_nvenc" {
                        if hw_speed { "p2" } else { "p5" }
                    } else {
                        x264_preset
                    };
                    args.extend(["-preset", preset_arg]);
                    if let (Some(m), Some(b)) = (maxrate.as_deref(), bufsize.as_deref()) {
                        args.extend(["-maxrate", m, "-bufsize", b]);
                    }
                }
            }
            if let Some(fps) = &fps {
                args.push("-r");
                args.push(fps.as_str());
            }
            // -pix_fmt est impossible en stream copy : il forcerait un
            // ré-encodage que le preset copy veut justement éviter.
            if vcodec != "copy" {
                args.extend(["-pix_fmt", "yuv420p"]);
            }
            if has_audio {
                args.extend(["-c:a", preset.audio_codec.as_str()]);
                if !ab.is_empty() {
                    args.extend(["-b:a", ab.as_str()]);
                }
            }
        }
    }
    if !stream_copy && matches!(preset.container.as_str(), "mp4" | "mov" | "m4a") {
        args.extend(["-movflags", "+faststart"]);
    }
    let out_str = out_path.to_string_lossy();
    args.push(out_str.as_ref());
    let on_media_time = on_encode.map(|cb| {
        let duration = duration.max(0.001);
        Arc::new(move |secs: f64| cb((secs / duration).clamp(0.0, 1.0)))
            as Arc<dyn Fn(f64) + Send + Sync>
    });
    let output = match cancel_ctx {
        Some((cancel, slot)) => run_ffmpeg_cancellable(&args, cancel, slot, on_media_time),
        None => process::run_ffmpeg(&args),
    };
    let output = match output {
        Ok(output) => output,
        Err(error) => {
            let _ = fs::remove_file(out_path);
            return Err(error);
        }
    };
    if let Err(error) = ensure_success(&output) {
        let _ = fs::remove_file(out_path);
        return Err(error);
    }
    let elapsed_ms = start.elapsed().unwrap_or_default().as_millis() as u64;
    let output_duration_secs = probe_duration_secs(&out_str)?;
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
    section_lo_secs: f64,
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
        section_lo_secs,
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
    section_lo_secs: f64,
    preset: &Preset,
    settings: &Settings,
    cancel_ctx: Option<(&AtomicBool, &Arc<Mutex<Option<Child>>>)>,
    on_encode: Option<EncodeProgressFn>,
) -> Result<CutResult> {
    let mut effective = preset.clone();
    crate::settings::apply_dev_overrides(&mut effective, settings);
    let x264_preset = crate::settings::dev_x264_preset(settings);
    let out = crate::settings::resolve_export_path(
        crate::settings::export_name_template(&effective.name_template, settings),
        title,
        trim_start_secs,
        trim_end_secs,
        &effective.container,
    );
    export_section_impl(
        input_path,
        trim_start_secs,
        trim_end_secs,
        section_lo_secs,
        &effective,
        &out,
        settings.hardware_encode,
        settings.hardware_encode && crate::settings::encode_prefers_speed(settings),
        x264_preset,
        cancel_ctx,
        on_encode,
    )
}

fn nvenc_available() -> bool {
    static OK: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *OK.get_or_init(|| {
        let driver_present = std::path::Path::new(r"C:\Windows\System32\nvcuda.dll").exists();
        driver_present
            && process::run_ffmpeg(&[
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=0.2:size=320x240:rate=30",
                "-frames:v",
                "30",
                "-c:v",
                "h264_nvenc",
                "-f",
                "null",
                "NUL",
            ])
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
}

fn amf_available() -> bool {
    static OK: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *OK.get_or_init(|| {
        process::run_ffmpeg(&[
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=duration=0.2:size=320x240:rate=30",
            "-frames:v",
            "30",
            "-c:v",
            "h264_amf",
            "-rc",
            "cqp",
            "-qp_i",
            "20",
            "-f",
            "null",
            "NUL",
        ])
        .map(|o| o.status.success())
        .unwrap_or(false)
    })
}

fn pick_video_encoder(preset: &Preset, hardware_encode: bool) -> String {
    if hardware_encode && preset.video_codec == "libx264" {
        if nvenc_available() {
            "h264_nvenc".to_string()
        } else if amf_available() {
            "h264_amf".to_string()
        } else {
            software_h264_encoder()
        }
    } else {
        if preset.video_codec == "libx264" {
            software_h264_encoder()
        } else {
            preset.video_codec.clone()
        }
    }
}

fn software_h264_encoder() -> String {
    static ENCODER: OnceLock<String> = OnceLock::new();
    ENCODER
        .get_or_init(|| {
            process::run_ffmpeg(&["-hide_banner", "-encoders"])
                .ok()
                .map(|output| {
                    format!(
                        "{}\n{}",
                        String::from_utf8_lossy(&output.stdout),
                        String::from_utf8_lossy(&output.stderr)
                    )
                })
                .map(|output| preferred_software_h264_encoder(&output).to_string())
                .unwrap_or_else(|| "libx264".to_string())
        })
        .clone()
}

fn preferred_software_h264_encoder(output: &str) -> &'static str {
    let supports = |encoder| {
        output.lines().any(|line| {
            let mut fields = line.split_whitespace();
            fields.next().is_some_and(|flags| flags.starts_with('V'))
                && fields.next() == Some(encoder)
        })
    };
    if supports("libx264") {
        "libx264"
    } else if supports("libopenh264") {
        "libopenh264"
    } else {
        // Kept for unusual custom presets/builds. Bundled FFmpeg always has x264.
        "libx264"
    }
}

fn openh264_target_bitrate_kbps(
    width: Option<u32>,
    height: Option<u32>,
    crf: u8,
    maxrate_kbps: Option<u32>,
) -> u32 {
    if let Some(maxrate) = maxrate_kbps {
        return maxrate;
    }
    let pixels = u64::from(width.unwrap_or(1920)) * u64::from(height.unwrap_or(1080));
    let scale = pixels as f64 / (1920.0 * 1080.0) * 2.0_f64.powf((20.0 - crf as f64) / 6.0);
    (8000.0 * scale).round().clamp(500.0, 100_000.0) as u32
}

fn openh264_bitrate_argument(kbps: u32) -> String {
    format!("{kbps}k")
}

fn encoder_rate_control_args(
    encoder: &str,
    crf: Option<&str>,
    maxrate: Option<&str>,
    bufsize: Option<&str>,
) -> Vec<String> {
    if encoder != "h264_amf" {
        return Vec::new();
    }
    if let (Some(maxrate), Some(bufsize)) = (maxrate, bufsize) {
        vec![
            "-rc".into(),
            "vbr_peak".into(),
            "-b:v".into(),
            maxrate.into(),
            "-maxrate".into(),
            maxrate.into(),
            "-bufsize".into(),
            bufsize.into(),
        ]
    } else if let Some(qp) = crf {
        vec![
            "-rc".into(),
            "cqp".into(),
            "-qp_i".into(),
            qp.into(),
            "-qp_p".into(),
            qp.into(),
            "-qp_b".into(),
            qp.into(),
        ]
    } else {
        Vec::new()
    }
}

fn video_filter_for_preset(preset: &Preset) -> Option<String> {
    let Some(w) = preset.width else {
        // libx264 + yuv420p refuse une dimension impaire. On aligne sans
        // changer la taille quand elle est déjà paire.
        // force_divisible_by ne s'applique que si force_original_aspect_ratio
        // est aussi posé. Sur ce binaire, iw:ih + force_divisible_by laisse
        // une taille impaire et libx264 refuse yuv420p.
        return Some("scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p,setsar=1:1".into());
    };
    let h = preset.height.unwrap_or(0);
    if w == 0 || h == 0 {
        return None;
    }
    if preset.crop == "center" && w < h {
        return Some(format!(
            "scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},format=yuv420p,setsar=1:1"
        ));
    }
    Some(format!(
        "scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,setsar=1:1"
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
    let out_str = out.to_string_lossy();
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
        out_str.as_ref(),
    ])?;
    ensure_success(&output)?;
    Ok(out.to_string_lossy().into_owned())
}

/** WebView2 ne lit pas le MKV yt-dlp : remux copie vers MP4. */
pub fn remux_preview_mp4(mkv_path: &str) -> Result<String> {
    let out = crate::storage::preview_mp4_path();
    let _ = fs::remove_file(&out);
    let out_str = out.to_string_lossy();
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
        out_str.as_ref(),
    ])?;
    ensure_success(&output)?;
    Ok(out.to_string_lossy().into_owned())
}

fn probe_has_audio(path: &str) -> Result<bool> {
    let output = process::run_ffprobe(&[
        "-v",
        "error",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=index",
        "-of",
        "csv=p=0",
        path,
    ])?;
    ensure_success(&output)?;
    Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty())
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
    let mut log_line = Vec::new();
    loop {
        match r.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                full.extend_from_slice(&chunk[..n]);
                if full.len() > 256 * 1024 {
                    let excess = full.len() - 256 * 1024;
                    full.drain(..excess);
                }
                if let Some(cb) = &on_media_time {
                    let mut data = tail.clone();
                    data.extend_from_slice(&chunk[..n]);
                    if let Some(secs) = last_ffmpeg_time(&data) {
                        cb(secs);
                    }
                    let keep = data.len().min(64);
                    tail = data[data.len() - keep..].to_vec();
                }
                for byte in &chunk[..n] {
                    if matches!(*byte, b'\r' | b'\n') {
                        if !log_line.is_empty() {
                            crate::log::log_line(&format!(
                                "ffmpeg: {}",
                                String::from_utf8_lossy(&log_line)
                            ));
                            log_line.clear();
                        }
                    } else if log_line.len() < 8192 {
                        log_line.push(*byte);
                    }
                }
            }
        }
    }
    if !log_line.is_empty() {
        crate::log::log_line(&format!("ffmpeg: {}", String::from_utf8_lossy(&log_line)));
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
    let s = s.trim();
    if s.starts_with('-') {
        return None;
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::presets::Preset;

    #[test]
    fn prefers_x264_but_uses_openh264_when_x264_is_missing() {
        assert_eq!(
            preferred_software_h264_encoder(" V....D libopenh264 OpenH264\n V....D libx264 H.264"),
            "libx264"
        );
        assert_eq!(
            preferred_software_h264_encoder(" V....D libopenh264 OpenH264"),
            "libopenh264"
        );
        assert_eq!(
            preferred_software_h264_encoder(" V....D h264_amf AMD H.264"),
            "libx264"
        );
    }

    #[test]
    fn openh264_bitrate_respects_resolution_quality_and_cap() {
        assert_eq!(
            openh264_target_bitrate_kbps(Some(1920), Some(1080), 20, None),
            8000
        );
        assert!(openh264_target_bitrate_kbps(Some(1280), Some(720), 20, None) < 8000);
        assert_eq!(
            openh264_target_bitrate_kbps(None, None, 20, Some(4000)),
            4000
        );
        assert_eq!(openh264_target_bitrate_kbps(None, None, 20, Some(100)), 100);
    }

    #[test]
    fn openh264_bitrate_argument_uses_kilobits_per_second_units() {
        assert_eq!(openh264_bitrate_argument(8000), "8000k");
    }

    fn preset(video: &str, crop: &str, width: Option<u32>, height: Option<u32>) -> Preset {
        Preset {
            id: "t".into(),
            name: "t".into(),
            container: "mp4".into(),
            video_codec: video.into(),
            audio_codec: "aac".into(),
            crf: Some(18),
            width,
            height,
            fps: None,
            crop: crop.into(),
            audio_bitrate_kbps: Some(192),
            name_template: "{titre}".into(),
            description: String::new(),
            video_max_bitrate_kbps: None,
        }
    }

    #[test]
    fn edition_filter_forces_even_dimensions_without_resizing() {
        let filter = video_filter_for_preset(&preset("libx264", "none", None, None)).unwrap();
        assert!(filter.contains("trunc(iw/2)*2"));
        assert!(!filter.contains("force_divisible_by"));
        assert!(filter.contains("yuv420p"));
    }

    #[test]
    fn vertical_crop_uses_the_preset_size() {
        let filter =
            video_filter_for_preset(&preset("libx264", "center", Some(720), Some(1280))).unwrap();
        assert!(filter.contains("scale=720:1280"));
        assert!(filter.contains("crop=720:1280"));
        assert!(!filter.contains("1080:1920"));
    }

    #[test]
    fn encode_progress_ignores_a_negative_ffmpeg_timestamp() {
        assert_eq!(parse_hms("-00:00:01.16"), None);
        assert_eq!(parse_hms("00:00:01.16"), Some(1.16));
    }

    #[test]
    fn amf_rate_control_uses_peak_vbr_when_preset_has_a_cap() {
        let args =
            encoder_rate_control_args("h264_amf", Some("18"), Some("25000k"), Some("50000k"));
        assert!(args.windows(2).any(|pair| pair == ["-rc", "vbr_peak"]));
        assert!(args.windows(2).any(|pair| pair == ["-maxrate", "25000k"]));
        assert!(args.windows(2).any(|pair| pair == ["-bufsize", "50000k"]));
    }
}

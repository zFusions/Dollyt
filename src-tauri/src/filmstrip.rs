use crate::error::{DollytError, Result};
use crate::ffmpeg;
use crate::process;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

const CACHE_VERSION: u32 = 2;
const MASTER_CACHE_VERSION: u32 = 1;
const FRAME_HEIGHT: u32 = 108;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineFilmstrip {
    pub frames: Vec<String>,
}

pub fn filmstrip_for_view(
    video_path: &str,
    timeline_view_start: f64,
    view_span: f64,
    preview_start: f64,
    frame_count: u32,
) -> Result<TimelineFilmstrip> {
    let input = Path::new(video_path);
    if !input.exists() {
        return Err(DollytError::FfmpegFailed(
            "fichier preview introuvable".into(),
        ));
    }
    let file_dur = ffmpeg::file_duration_secs(video_path)?;
    let view_end = timeline_view_start + view_span.max(0.001);
    let file_start = (timeline_view_start - preview_start).max(0.0);
    let file_end = (view_end - preview_start).min(file_dur);
    if file_end <= file_start + 0.04 {
        return Ok(TimelineFilmstrip { frames: vec![] });
    }
    let span = file_end - file_start;
    let count = frame_count.clamp(2, 16);
    let cache_dir = cache_dir_for(video_path, file_start, span, count)?;
    let manifest = cache_dir.join("manifest.json");
    if let Ok(data) = fs::read_to_string(&manifest)
        && let Ok(paths) = serde_json::from_str::<Vec<String>>(&data)
        && paths.len() >= 2
        && paths.iter().all(|p| Path::new(p).exists())
    {
        return Ok(TimelineFilmstrip { frames: paths });
    }
    fs::create_dir_all(&cache_dir)?;
    for old in fs::read_dir(&cache_dir).into_iter().flatten().flatten() {
        let p = old.path();
        if p.extension().and_then(|e| e.to_str()) == Some("jpg") {
            let _ = fs::remove_file(p);
        }
    }
    let pattern = cache_dir.join("f%03d.jpg");
    let pattern_str = pattern.to_str().expect("chemin UTF-8");
    let ss = format!("{file_start:.3}");
    let dur = format!("{span:.6}");
    let vf = format!("fps={count}/{dur},scale=-2:{FRAME_HEIGHT}");
    let frames_s = count.to_string();
    let output = process::run_ffmpeg(&[
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        &ss,
        "-i",
        video_path,
        "-t",
        &dur,
        "-vf",
        &vf,
        "-frames:v",
        &frames_s,
        "-q:v",
        "4",
        pattern_str,
    ])?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(DollytError::FfmpegFailed(stderr.trim().to_string()));
    }
    let mut frames: Vec<String> = fs::read_dir(&cache_dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|x| x.to_str())
                .is_some_and(|x| x.eq_ignore_ascii_case("jpg"))
        })
        .map(|p| p.to_string_lossy().into_owned())
        .collect();
    frames.sort();
    if frames.len() < 2 {
        return Ok(TimelineFilmstrip { frames: vec![] });
    }
    fs::write(&manifest, serde_json::to_string(&frames)?)?;
    Ok(TimelineFilmstrip { frames })
}

pub fn filmstrip_master(
    video_path: &str,
    duration_secs: f64,
    frame_count: u32,
) -> Result<TimelineFilmstrip> {
    let input = Path::new(video_path);
    if !input.exists() {
        return Err(DollytError::FfmpegFailed(
            "fichier preview introuvable".into(),
        ));
    }
    let file_dur = ffmpeg::file_duration_secs(video_path)?;
    let span = duration_secs.max(0.5).min(file_dur);
    let count = frame_count.clamp(8, 72);
    let cache_dir = master_cache_dir(video_path, span, count)?;
    let manifest = cache_dir.join("manifest.json");
    if let Ok(data) = fs::read_to_string(&manifest)
        && let Ok(paths) = serde_json::from_str::<Vec<String>>(&data)
        && paths.len() >= 2
        && paths.iter().all(|p| Path::new(p).exists())
    {
        return Ok(TimelineFilmstrip { frames: paths });
    }
    fs::create_dir_all(&cache_dir)?;
    let pattern = cache_dir.join("m%04d.jpg");
    let pattern_str = pattern.to_str().expect("chemin UTF-8");
    let dur = format!("{span:.3}");
    let vf = format!("fps={count}/{dur},scale=-2:{FRAME_HEIGHT}");
    let frames_s = count.to_string();
    let output = process::run_ffmpeg(&[
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        video_path,
        "-t",
        &dur,
        "-vf",
        &vf,
        "-frames:v",
        &frames_s,
        "-q:v",
        "4",
        pattern_str,
    ])?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(DollytError::FfmpegFailed(stderr.trim().to_string()));
    }
    let mut frames: Vec<String> = fs::read_dir(&cache_dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|x| x.to_str())
                .is_some_and(|x| x.eq_ignore_ascii_case("jpg"))
        })
        .map(|p| p.to_string_lossy().into_owned())
        .collect();
    frames.sort();
    if frames.len() < 2 {
        return Ok(TimelineFilmstrip { frames: vec![] });
    }
    fs::write(&manifest, serde_json::to_string(&frames)?)?;
    Ok(TimelineFilmstrip { frames })
}

fn master_cache_dir(video_path: &str, span: f64, count: u32) -> Result<PathBuf> {
    let meta = fs::metadata(video_path)?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut hasher = DefaultHasher::new();
    video_path.hash(&mut hasher);
    mtime.hash(&mut hasher);
    MASTER_CACHE_VERSION.hash(&mut hasher);
    span.to_bits().hash(&mut hasher);
    count.hash(&mut hasher);
    let key = format!("master_{:016x}", hasher.finish());
    let _ = crate::storage::prune_filmstrip_cache();
    Ok(crate::storage::filmstrip_cache_root().join(key))
}

fn cache_dir_for(video_path: &str, file_start: f64, span: f64, count: u32) -> Result<PathBuf> {
    let meta = fs::metadata(video_path)?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut hasher = DefaultHasher::new();
    video_path.hash(&mut hasher);
    mtime.hash(&mut hasher);
    CACHE_VERSION.hash(&mut hasher);
    file_start.to_bits().hash(&mut hasher);
    span.to_bits().hash(&mut hasher);
    count.hash(&mut hasher);
    let key = format!("{:016x}", hasher.finish());
    let _ = crate::storage::prune_filmstrip_cache();
    Ok(crate::storage::filmstrip_cache_root().join(key))
}

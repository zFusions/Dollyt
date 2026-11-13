use crate::error::Result;
use crate::settings::dollyt_data_dir;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/** Budget disque cache vignettes (hors fichier preview unique). */
const FILMSTRIP_MAX_BYTES: u64 = 192 * 1024 * 1024;
const FILMSTRIP_MAX_DIRS: usize = 24;

pub fn temp_cache_root() -> PathBuf {
    let p = std::env::temp_dir().join("dollyt-cache");
    let _ = fs::create_dir_all(&p);
    p
}

pub fn preview_cache_dir() -> PathBuf {
    let p = temp_cache_root().join("preview");
    let _ = fs::create_dir_all(&p);
    p
}

pub fn preview_mp4_path() -> PathBuf {
    preview_cache_dir().join("current.mp4")
}

pub fn copy_download_preview(source: &str) -> Result<String> {
    let extension = Path::new(source)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("mp4");
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let target = temp_cache_root()
        .join("download-preview")
        .join(format!("preview-{timestamp}.{extension}"));
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, &target)?;
    Ok(target.to_string_lossy().into_owned())
}

pub fn filmstrip_cache_root() -> PathBuf {
    let p = temp_cache_root().join("filmstrip");
    let _ = fs::create_dir_all(&p);
    p
}

pub fn prune_on_startup() -> Result<()> {
    purge_legacy_temp();
    prune_filmstrip_cache()?;
    Ok(())
}

/** Vrai si le chemin canonique est sous %TEMP%\dollyt-cache. */
pub fn path_in_temp_cache(path: &str) -> bool {
    let Ok(root) = temp_cache_root().canonicalize() else {
        return false;
    };
    Path::new(path)
        .canonicalize()
        .map(|p| p.starts_with(&root))
        .unwrap_or(false)
}

/** Quitter l’éditeur : libère le gros fichier preview (~centaines de Mo). */
pub fn release_preview() {
    let _ = fs::remove_dir_all(preview_cache_dir());
    let _ = fs::remove_dir_all(temp_cache_root().join("download-preview"));
}

/** Anciens fichiers %TEMP% (avant cache centralisé). */
pub fn purge_legacy_temp() {
    let temp = std::env::temp_dir();
    let Ok(entries) = fs::read_dir(&temp) else {
        return;
    };
    for e in entries.flatten() {
        let path = e.path();
        let name = e.file_name().to_string_lossy().to_string();
        if (name.starts_with("dollyt-") || name.starts_with("dollyt-cut-")) && path.is_file() {
            let _ = fs::remove_file(&path);
        } else if (name == "dollyt-timeline-cache" || name == "dollyt-filmstrip-cache")
            && path.is_dir()
        {
            let _ = fs::remove_dir_all(&path);
        }
    }
    let legacy_app = dollyt_data_dir().join("cache");
    if legacy_app.is_dir() {
        let _ = fs::remove_dir_all(legacy_app);
    }
}

pub fn prune_filmstrip_cache() -> Result<()> {
    let root = filmstrip_cache_root();
    let Ok(entries) = fs::read_dir(&root) else {
        return Ok(());
    };
    let mut dirs: Vec<(u64, PathBuf, u64)> = Vec::new();
    for e in entries.flatten() {
        let p = e.path();
        if !p.is_dir() {
            continue;
        }
        let age = dir_mtime_ms(&p).unwrap_or(0);
        let size = dir_size_bytes(&p).unwrap_or(0);
        dirs.push((age, p, size));
    }
    dirs.sort_by_key(|d| d.0);
    let mut total: u64 = dirs.iter().map(|d| d.2).sum();
    while (!dirs.is_empty()) && (total > FILMSTRIP_MAX_BYTES || dirs.len() > FILMSTRIP_MAX_DIRS) {
        let (_, path, size) = dirs.remove(0);
        let _ = fs::remove_dir_all(&path);
        total = total.saturating_sub(size);
    }
    Ok(())
}

fn dir_size_bytes(dir: &Path) -> Result<u64> {
    let mut n = 0u64;
    for e in fs::read_dir(dir)?.flatten() {
        let p = e.path();
        if p.is_file() {
            n += p.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    Ok(n)
}

fn dir_mtime_ms(dir: &Path) -> Option<u64> {
    fs::metadata(dir)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

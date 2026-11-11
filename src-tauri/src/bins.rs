use crate::error::{DollytError, Result};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone, Debug)]
pub struct ToolPaths {
    pub ytdlp: PathBuf,
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
    #[allow(dead_code)]
    pub deno: PathBuf,
}

static TOOLS: OnceLock<ToolPaths> = OnceLock::new();

pub fn tools() -> &'static ToolPaths {
    TOOLS
        .get()
        .expect("binaires non initialisés : ensure_tools doit être appelé au démarrage")
}

pub fn ensure_tools() -> Result<()> {
    if TOOLS.get().is_some() {
        return Ok(());
    }
    let dir = bin_dir();
    fs::create_dir_all(&dir)?;
    let ytdlp = dir.join("yt-dlp.exe");
    if !ytdlp.exists() {
        download_ytdlp_release(&ytdlp)?;
    }
    let ffmpeg = bootstrap_tool("ffmpeg.exe", &dir.join("ffmpeg.exe"))?;
    let ffprobe = bootstrap_tool("ffprobe.exe", &dir.join("ffprobe.exe"))?;
    let deno = bootstrap_tool("deno.exe", &dir.join("deno.exe"))?;
    let paths = ToolPaths {
        ytdlp,
        ffmpeg,
        ffprobe,
        deno,
    };
    TOOLS
        .set(paths)
        .map_err(|_| DollytError::Io(std::io::Error::other("TOOLS déjà initialisé")))?;
    Ok(())
}

pub fn bin_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("Dollyt")
        .join("bin")
}

/// shortcut: copie depuis le PATH, remplacer par téléchargement officiel FFmpeg/Deno plus tard
fn bootstrap_tool(name: &str, dest: &Path) -> Result<PathBuf> {
    if dest.exists() {
        return Ok(dest.to_path_buf());
    }
    let stem = name.trim_end_matches(".exe");
    let mut cmd = Command::new("where");
    cmd.arg(stem);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd.output()?;
    if !output.status.success() {
        return Err(DollytError::BinMissing(name.to_string()));
    }
    let line = String::from_utf8_lossy(&output.stdout);
    let src = line
        .lines()
        .next()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| DollytError::BinMissing(name.to_string()))?;
    fs::copy(src, dest)?;
    Ok(dest.to_path_buf())
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    assets: Vec<GhAsset>,
}

#[derive(Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

fn download_ytdlp_release(dest: &Path) -> Result<()> {
    let body = ureq::get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .call()
        .map_err(|e| DollytError::BinDownload(e.to_string()))?
        .into_string()
        .map_err(|e| DollytError::BinDownload(e.to_string()))?;
    let release: GhRelease =
        serde_json::from_str(&body).map_err(|e| DollytError::BinDownload(e.to_string()))?;
    let tag = &release.tag_name;
    let sums_url = release
        .assets
        .iter()
        .find(|a| a.name == "SHA2-256SUMS")
        .map(|a| a.browser_download_url.as_str())
        .ok_or_else(|| DollytError::BinDownload("SHA2-256SUMS absent".into()))?;
    let exe_url = format!("https://github.com/yt-dlp/yt-dlp/releases/download/{tag}/yt-dlp.exe");
    let sums = fetch_text(sums_url)?;
    let expected = parse_ytdlp_exe_hash(&sums)?;
    let tmp = dest.with_extension("tmp");
    download_bytes(&exe_url, &tmp)?;
    verify_file_sha256(&tmp, &expected)?;
    if dest.exists() {
        fs::remove_file(dest)?;
    }
    fs::rename(&tmp, dest)?;
    Ok(())
}

fn parse_ytdlp_exe_hash(sums: &str) -> Result<String> {
    for line in sums.lines() {
        let line = line.trim();
        let Some((hash, name)) = line.split_once("  ") else {
            continue;
        };
        if name.trim() == "yt-dlp.exe" {
            return Ok(hash.trim().to_lowercase());
        }
    }
    Err(DollytError::BinDownload(
        "hash yt-dlp.exe introuvable dans SHA2-256SUMS".into(),
    ))
}

fn fetch_text(url: &str) -> Result<String> {
    ureq::get(url)
        .call()
        .map_err(|e| DollytError::BinDownload(e.to_string()))?
        .into_string()
        .map_err(|e| DollytError::BinDownload(e.to_string()))
}

fn download_bytes(url: &str, dest: &Path) -> Result<()> {
    let mut reader = ureq::get(url)
        .call()
        .map_err(|e| DollytError::BinDownload(e.to_string()))?
        .into_reader();
    let mut file = fs::File::create(dest)?;
    std::io::copy(&mut reader, &mut file)?;
    Ok(())
}

fn verify_file_sha256(path: &Path, expected: &str) -> Result<()> {
    let bytes = fs::read(path)?;
    let digest = Sha256::digest(&bytes);
    let got = hex::encode(digest);
    if got != expected {
        fs::remove_file(path).ok();
        return Err(DollytError::BinHashMismatch {
            tool: "yt-dlp.exe".into(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ytdlp_exe_hash_line() {
        let sample =
            "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d  yt-dlp.exe\n";
        let hash = parse_ytdlp_exe_hash(sample).expect("hash");
        assert_eq!(
            hash,
            "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d"
        );
    }
}

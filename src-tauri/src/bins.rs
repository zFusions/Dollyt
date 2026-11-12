use crate::error::{DollytError, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const PINNED_YTDLP_TAG: &str = "2026.10.26";
const PINNED_YTDLP_EXE_SHA256: &str =
    "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d";

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YtdlpUpdateResult {
    pub already_latest: bool,
}

pub fn ensure_ytdlp_only() -> Result<()> {
    let dir = bin_dir();
    fs::create_dir_all(&dir)?;
    let ytdlp = dir.join("yt-dlp.exe");
    download_ytdlp_release(&ytdlp)?;
    Ok(())
}

pub fn update_ytdlp_manual() -> Result<YtdlpUpdateResult> {
    fs::create_dir_all(bin_dir())?;
    let dest = bin_dir().join("yt-dlp.exe");
    let expected = latest_ytdlp_exe_hash()?;
    if dest.exists() {
        let current = file_sha256_hex(&dest)?;
        if current == expected {
            return Ok(YtdlpUpdateResult {
                already_latest: true,
            });
        }
    }
    ensure_ytdlp_only()?;
    Ok(YtdlpUpdateResult {
        already_latest: false,
    })
}

pub fn ensure_tools() -> Result<()> {
    if TOOLS.get().is_some() {
        return Ok(());
    }
    let dir = bin_dir();
    fs::create_dir_all(&dir)?;
    let ytdlp = dir.join("yt-dlp.exe");
    let ytdlp_is_verified = ytdlp.exists()
        && file_sha256_hex(&ytdlp)
            .map(|hash| hash.eq_ignore_ascii_case(PINNED_YTDLP_EXE_SHA256))
            .unwrap_or(false);
    if !ytdlp_is_verified {
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

fn latest_ytdlp_exe_hash() -> Result<String> {
    Ok(PINNED_YTDLP_EXE_SHA256.to_string())
}

fn file_sha256_hex(path: &Path) -> Result<String> {
    let bytes = fs::read(path)?;
    Ok(hex::encode(Sha256::digest(&bytes)))
}

fn download_ytdlp_release(dest: &Path) -> Result<()> {
    let exe_url =
        format!("https://github.com/yt-dlp/yt-dlp/releases/download/{PINNED_YTDLP_TAG}/yt-dlp.exe");
    let expected = PINNED_YTDLP_EXE_SHA256;
    let tmp = dest.with_extension("tmp");
    download_bytes(&exe_url, &tmp)?;
    verify_file_sha256(&tmp, expected)?;
    if dest.exists() {
        fs::remove_file(dest)?;
    }
    fs::rename(&tmp, dest)?;
    Ok(())
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
    fn uses_pinned_ytdlp_hash() {
        let hash = latest_ytdlp_exe_hash().expect("hash");
        assert_eq!(
            hash,
            "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d"
        );
    }
}

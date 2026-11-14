use crate::error::{DollytError, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::Duration;
const PINNED_YTDLP_TAG: &str = "2026.10.26";
const PINNED_YTDLP_EXE_SHA256: &str =
    "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d";
const PINNED_FFMPEG_ARCHIVE_URL: &str = "https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-11-12-15-40/ffmpeg-n8.1.3-35-gf1acb0a266-win64-lgpl-8.1.zip";
const PINNED_FFMPEG_ARCHIVE_SHA256: &str =
    "f8cd2e3a9570cc0101876569f21f130f7741cc86a97476f98132cba9f610d906";
const PINNED_DENO_ARCHIVE_URL: &str =
    "https://github.com/denoland/deno/releases/download/v2.9.8/deno-x86_64-pc-windows-msvc.zip";
const PINNED_DENO_ARCHIVE_SHA256: &str =
    "cba84b26e0df5ae7f74fc66b86a95b866872a86292ebd84fa1e959927edd93bf";

#[derive(Clone, Debug)]
pub struct ToolPaths {
    pub ytdlp: PathBuf,
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
    #[allow(dead_code)]
    pub deno: PathBuf,
}

static TOOLS: OnceLock<ToolPaths> = OnceLock::new();

pub fn tools() -> Option<&'static ToolPaths> {
    TOOLS.get()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YtdlpUpdateResult {
    pub already_latest: bool,
    pub version: Option<String>,
}

pub fn ensure_tools() -> Result<()> {
    if TOOLS.get().is_some() {
        return Ok(());
    }
    let dir = bin_dir();
    fs::create_dir_all(&dir)?;
    let ytdlp = dir.join("yt-dlp.exe");
    // Un yt-dlp déjà auto-updaté n'a plus le hash épinglé : on accepte tout
    // binaire qui répond à --version, le hash épinglé reste pour la 1re install.
    let ytdlp_is_verified = ytdlp.exists()
        && (file_sha256_hex(&ytdlp)
            .map(|hash| hash.eq_ignore_ascii_case(PINNED_YTDLP_EXE_SHA256))
            .unwrap_or(false)
            || ytdlp_reported_version(&ytdlp).is_some());
    if !ytdlp_is_verified {
        download_ytdlp_release(&ytdlp)?;
    }
    let ffmpeg = bootstrap_archive_tool(
        "ffmpeg.exe",
        &dir.join("ffmpeg.exe"),
        PINNED_FFMPEG_ARCHIVE_URL,
        PINNED_FFMPEG_ARCHIVE_SHA256,
        "/bin/ffmpeg.exe",
    )?;
    let ffprobe = bootstrap_archive_tool(
        "ffprobe.exe",
        &dir.join("ffprobe.exe"),
        PINNED_FFMPEG_ARCHIVE_URL,
        PINNED_FFMPEG_ARCHIVE_SHA256,
        "/bin/ffprobe.exe",
    )?;
    let deno = bootstrap_archive_tool(
        "deno.exe",
        &dir.join("deno.exe"),
        PINNED_DENO_ARCHIVE_URL,
        PINNED_DENO_ARCHIVE_SHA256,
        "deno.exe",
    )?;
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

fn bootstrap_archive_tool(
    name: &str,
    dest: &Path,
    url: &str,
    expected_hash: &str,
    archive_suffix: &str,
) -> Result<PathBuf> {
    if dest.exists() {
        return Ok(dest.to_path_buf());
    }
    let archive_path = dest.with_extension("zip");
    download_bytes(url, &archive_path)?;
    if let Err(error) = verify_file_sha256_value(&archive_path, expected_hash, name) {
        fs::remove_file(&archive_path).ok();
        return Err(error);
    }

    let file = fs::File::open(&archive_path)?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|error| DollytError::BinDownload(error.to_string()))?;
    let mut found = false;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| DollytError::BinDownload(error.to_string()))?;
        let entry_name = entry.name().replace('\\', "/");
        if !entry_name.ends_with(archive_suffix) || entry_name.contains("../") {
            continue;
        }
        let temporary = dest.with_extension("tmp");
        let mut output = fs::File::create(&temporary)?;
        std::io::copy(&mut entry, &mut output)?;
        if dest.exists() {
            fs::remove_file(dest)?;
        }
        fs::rename(temporary, dest)?;
        found = true;
        break;
    }
    fs::remove_file(&archive_path).ok();
    if !found {
        return Err(DollytError::BinMissing(name.to_string()));
    }
    Ok(dest.to_path_buf())
}

pub fn update_ytdlp_manual() -> Result<YtdlpUpdateResult> {
    fs::create_dir_all(bin_dir())?;
    let dest = bin_dir().join("yt-dlp.exe");
    let latest_tag = latest_ytdlp_tag()?;
    let installed = ytdlp_reported_version(&dest);
    if installed
        .as_deref()
        .and_then(version_key)
        .zip(version_key(&latest_tag))
        .is_some_and(|(have, latest)| have >= latest)
    {
        return Ok(YtdlpUpdateResult {
            already_latest: true,
            version: installed,
        });
    }
    // yt-dlp ne signe pas ses releases : on télécharge depuis GitHub et on
    // vérifie que le binaire répond --version avec le bon tag avant de swap.
    let exe_url =
        format!("https://github.com/yt-dlp/yt-dlp/releases/download/{latest_tag}/yt-dlp.exe");
    let tmp = dest.with_extension("tmp");
    download_bytes(&exe_url, &tmp)?;
    let Some(version) =
        ytdlp_reported_version(&tmp).filter(|v| version_key(v) == version_key(&latest_tag))
    else {
        fs::remove_file(&tmp).ok();
        return Err(DollytError::BinDownload(
            "binaire yt-dlp téléchargé invalide".into(),
        ));
    };
    if dest.exists() {
        fs::remove_file(&dest)?;
    }
    fs::rename(&tmp, dest)?;
    Ok(YtdlpUpdateResult {
        already_latest: false,
        version: Some(version),
    })
}

fn ytdlp_reported_version(exe: &Path) -> Option<String> {
    let output = std::process::Command::new(exe)
        .arg("--version")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .next()?
        .to_string();
    version_key(&version).map(|_| version)
}

fn version_key(version: &str) -> Option<(u64, u64, u64)> {
    let core = version
        .split(|c: char| !(c.is_ascii_digit() || c == '.'))
        .find(|s| !s.is_empty())?;
    let mut parts = core.split('.').filter_map(|p| p.parse::<u64>().ok());
    Some((
        parts.next()?,
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    ))
}

fn latest_ytdlp_tag() -> Result<String> {
    let response = ureq::get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .set("User-Agent", concat!("Dollyt/", env!("CARGO_PKG_VERSION")))
        .set("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(30))
        .call()
        .map_err(|e| DollytError::BinDownload(e.to_string()))?;
    let body: serde_json::Value = serde_json::from_reader(response.into_reader())
        .map_err(|e| DollytError::BinDownload(format!("réponse GitHub illisible : {e}")))?;
    body.get("tag_name")
        .and_then(|v| v.as_str())
        .map(|tag| tag.trim().trim_start_matches('v').to_string())
        .filter(|tag| !tag.is_empty())
        .ok_or_else(|| DollytError::BinDownload("release yt-dlp introuvable".into()))
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
        .timeout(std::time::Duration::from_secs(300))
        .call()
        .map_err(|e| DollytError::BinDownload(e.to_string()))?
        .into_reader();
    let mut file = fs::File::create(dest)?;
    std::io::copy(&mut reader, &mut file)?;
    Ok(())
}

fn verify_file_sha256(path: &Path, expected: &str) -> Result<()> {
    verify_file_sha256_value(path, expected, "yt-dlp.exe")
}

fn verify_file_sha256_value(path: &Path, expected: &str, tool: &str) -> Result<()> {
    let bytes = fs::read(path)?;
    let digest = Sha256::digest(&bytes);
    let got = hex::encode(digest);
    if got != expected {
        fs::remove_file(path).ok();
        return Err(DollytError::BinHashMismatch {
            tool: tool.to_string(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_key_orders_release_dates() {
        assert!(version_key("2026.11.01") > version_key("2026.10.26"));
        assert_eq!(version_key("2026.10.26"), version_key("2026.10.26"));
        assert!(version_key("2026.10.26.1").is_some());
        assert!(version_key("n/a").is_none());
    }
}

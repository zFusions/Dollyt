use crate::error::{DollytError, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
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
static TOOL_INIT_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static YTDLP_UPDATE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

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
    let _guard = TOOL_INIT_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    if TOOLS.get().is_some() {
        return Ok(());
    }
    let dir = bin_dir();
    fs::create_dir_all(&dir)?;
    let ytdlp = dir.join("yt-dlp.exe");
    let ytdlp_is_verified = ensure_ytdlp_install_marker(&ytdlp)?;
    if !ytdlp_is_verified {
        download_ytdlp_release(&ytdlp)?;
    }
    let (ffmpeg, ffprobe) = bootstrap_ffmpeg_tools(&dir)?;
    let deno = bootstrap_archive_tool(
        "deno.exe",
        &dir.join("deno.exe"),
        PINNED_DENO_ARCHIVE_URL,
        PINNED_DENO_ARCHIVE_SHA256,
        "deno.exe",
        "--version",
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
    version_flag: &str,
) -> Result<PathBuf> {
    if installed_tool_manifest_present(dest) || adopt_legacy_tool(dest, version_flag) {
        return Ok(dest.to_path_buf());
    }
    let hash_path = dest.with_extension("sha256");
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
        let temporary = dest.with_extension("tmp.exe");
        let mut output = fs::File::create(&temporary)?;
        std::io::copy(&mut entry, &mut output)?;
        output.sync_all()?;
        let hash = file_sha256_hex(&temporary)?;
        crate::atomic_file::replace_file(&temporary, dest)?;
        fs::write(hash_path, hash)?;
        found = true;
        break;
    }
    fs::remove_file(&archive_path).ok();
    if !found {
        return Err(DollytError::BinMissing(name.to_string()));
    }
    Ok(dest.to_path_buf())
}

fn bootstrap_ffmpeg_tools(dir: &Path) -> Result<(PathBuf, PathBuf)> {
    let ffmpeg = dir.join("ffmpeg.exe");
    let ffprobe = dir.join("ffprobe.exe");
    let need_ffmpeg =
        !(installed_tool_manifest_present(&ffmpeg) || adopt_legacy_tool(&ffmpeg, "-version"));
    let need_ffprobe =
        !(installed_tool_manifest_present(&ffprobe) || adopt_legacy_tool(&ffprobe, "-version"));
    if !need_ffmpeg && !need_ffprobe {
        return Ok((ffmpeg, ffprobe));
    }

    let archive_path = dir.join("ffmpeg.zip");
    download_bytes(PINNED_FFMPEG_ARCHIVE_URL, &archive_path)?;
    if let Err(error) = verify_file_sha256_value(
        &archive_path,
        PINNED_FFMPEG_ARCHIVE_SHA256,
        "ffmpeg archive",
    ) {
        fs::remove_file(&archive_path).ok();
        return Err(error);
    }
    let file = fs::File::open(&archive_path)?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|error| DollytError::BinDownload(error.to_string()))?;
    let mut found_ffmpeg = !need_ffmpeg;
    let mut found_ffprobe = !need_ffprobe;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| DollytError::BinDownload(error.to_string()))?;
        let entry_name = entry.name().replace('\\', "/");
        let (dest, found, suffix) =
            if need_ffmpeg && entry_name.ends_with("/bin/ffmpeg.exe") && !found_ffmpeg {
                (&ffmpeg, &mut found_ffmpeg, "/bin/ffmpeg.exe")
            } else if need_ffprobe && entry_name.ends_with("/bin/ffprobe.exe") && !found_ffprobe {
                (&ffprobe, &mut found_ffprobe, "/bin/ffprobe.exe")
            } else {
                continue;
            };
        if !entry_name.ends_with(suffix) || entry_name.contains("../") {
            continue;
        }
        let temporary = dest.with_extension("tmp.exe");
        let mut output = fs::File::create(&temporary)?;
        std::io::copy(&mut entry, &mut output)?;
        output.sync_all()?;
        let hash = file_sha256_hex(&temporary)?;
        crate::atomic_file::replace_file(&temporary, dest)?;
        fs::write(dest.with_extension("sha256"), hash)?;
        *found = true;
    }
    fs::remove_file(&archive_path).ok();
    if !found_ffmpeg {
        return Err(DollytError::BinMissing("ffmpeg.exe".into()));
    }
    if !found_ffprobe {
        return Err(DollytError::BinMissing("ffprobe.exe".into()));
    }
    Ok((ffmpeg, ffprobe))
}

fn installed_tool_manifest_present(dest: &Path) -> bool {
    if !dest.is_file() {
        return false;
    }
    let Ok(expected) = fs::read_to_string(dest.with_extension("sha256")) else {
        return false;
    };
    let expected = expected.trim();
    expected.len() == 64 && expected.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn ytdlp_marker_path(dest: &Path) -> PathBuf {
    dest.with_extension("verified")
}

fn ytdlp_install_marker_present(dest: &Path) -> bool {
    if !dest.is_file() {
        return false;
    }
    fs::read_to_string(ytdlp_marker_path(dest))
        .ok()
        .is_some_and(|version| version_key(version.trim()).is_some())
}

fn ensure_ytdlp_install_marker(dest: &Path) -> Result<bool> {
    if ytdlp_install_marker_present(dest) {
        return Ok(true);
    }
    if !dest.is_file() {
        return Ok(false);
    }
    let pinned_hash_matches =
        file_sha256_hex(dest).is_ok_and(|hash| hash.eq_ignore_ascii_case(PINNED_YTDLP_EXE_SHA256));
    if pinned_hash_matches {
        write_ytdlp_install_marker(dest, PINNED_YTDLP_TAG)?;
        return Ok(true);
    }
    if let Some(version) = ytdlp_reported_version(dest) {
        write_ytdlp_install_marker(dest, &version)?;
        return Ok(true);
    }
    Ok(false)
}

fn write_ytdlp_install_marker(dest: &Path, version: &str) -> Result<()> {
    let marker = ytdlp_marker_path(dest);
    let temporary = marker.with_extension("verified.tmp");
    fs::write(&temporary, version)?;
    crate::atomic_file::replace_file(&temporary, &marker)?;
    Ok(())
}

// Installs d'avant les manifestes : exe présent sans .sha256. On vérifie
// qu'il répond à sa commande de version puis on adopte son hash comme
// référence, sinon on retombe sur le téléchargement épinglé.
fn adopt_legacy_tool(dest: &Path, version_flag: &str) -> bool {
    if dest.with_extension("sha256").exists() || !dest.is_file() {
        return false;
    }
    let mut command = std::process::Command::new(dest);
    command.arg(version_flag);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let runs = command
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false);
    if !runs {
        return false;
    }
    let Ok(hash) = file_sha256_hex(dest) else {
        return false;
    };
    fs::write(dest.with_extension("sha256"), hash).is_ok()
}

pub fn update_ytdlp_manual() -> Result<YtdlpUpdateResult> {
    let _guard = YTDLP_UPDATE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|error| error.into_inner());
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
    let tmp = dest.with_extension("update.tmp.exe");
    download_bytes(&exe_url, &tmp)?;
    let Some(version) =
        ytdlp_reported_version(&tmp).filter(|v| version_key(v) == version_key(&latest_tag))
    else {
        fs::remove_file(&tmp).ok();
        return Err(DollytError::BinDownload(
            "binaire yt-dlp téléchargé invalide".into(),
        ));
    };
    crate::atomic_file::replace_file(&tmp, &dest)?;
    write_ytdlp_install_marker(&dest, &version)?;
    Ok(YtdlpUpdateResult {
        already_latest: false,
        version: Some(version),
    })
}

fn ytdlp_reported_version(exe: &Path) -> Option<String> {
    let mut command = std::process::Command::new(exe);
    command.arg("--version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let output = command.output().ok()?;
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
    use std::io::Read;

    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn download_ytdlp_release(dest: &Path) -> Result<()> {
    let exe_url =
        format!("https://github.com/yt-dlp/yt-dlp/releases/download/{PINNED_YTDLP_TAG}/yt-dlp.exe");
    let expected = PINNED_YTDLP_EXE_SHA256;
    let tmp = dest.with_extension("install.tmp.exe");
    download_bytes(&exe_url, &tmp)?;
    verify_file_sha256(&tmp, expected)?;
    crate::atomic_file::replace_file(&tmp, dest)?;
    write_ytdlp_install_marker(dest, PINNED_YTDLP_TAG)?;
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
    let got = file_sha256_hex(path)?;
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
    use std::time::SystemTime;

    #[test]
    fn installed_tool_requires_a_well_formed_manifest() {
        let path =
            std::env::temp_dir().join(format!("dollyt-bin-check-{}.exe", std::process::id()));
        let sidecar = path.with_extension("sha256");
        fs::write(&path, b"binary").unwrap();
        fs::write(&sidecar, "a".repeat(64)).unwrap();
        assert!(installed_tool_manifest_present(&path));
        fs::write(&sidecar, "wrong").unwrap();
        assert!(!installed_tool_manifest_present(&path));
        fs::remove_file(path).unwrap();
        fs::remove_file(sidecar).unwrap();
    }

    #[test]
    fn installed_tool_manifest_prevents_rehashing_on_later_starts() {
        let path = std::env::temp_dir().join(format!(
            "dollyt-manifest-cache-{}-{}.exe",
            std::process::id(),
            SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let sidecar = path.with_extension("sha256");
        fs::write(&path, b"verified binary").unwrap();
        fs::write(&sidecar, "a".repeat(64)).unwrap();
        fs::write(&path, b"changed after initial verification").unwrap();

        assert!(installed_tool_manifest_present(&path));

        fs::remove_file(path).unwrap();
        fs::remove_file(sidecar).unwrap();
    }

    #[test]
    fn ytdlp_install_marker_avoids_running_version_check_again() {
        let path = std::env::temp_dir().join(format!(
            "dollyt-ytdlp-marker-{}-{}.exe",
            std::process::id(),
            SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::write(&path, b"verified binary").unwrap();
        fs::write(ytdlp_marker_path(&path), "2026.10.26").unwrap();

        assert!(ensure_ytdlp_install_marker(&path).unwrap());

        fs::remove_file(&path).unwrap();
        fs::remove_file(ytdlp_marker_path(&path)).unwrap();
    }

    #[test]
    fn version_key_orders_release_dates() {
        assert!(version_key("2026.11.01") > version_key("2026.10.26"));
        assert_eq!(version_key("2026.10.26"), version_key("2026.10.26"));
        assert!(version_key("2026.10.26.1").is_some());
        assert!(version_key("n/a").is_none());
    }
}

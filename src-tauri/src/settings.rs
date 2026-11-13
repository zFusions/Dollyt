use crate::error::Result;
use crate::presets::Preset;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub export_dir: String,
    pub name_template: String,
    pub hardware_encode: bool,
    #[serde(default)]
    pub auto_update_ytdlp: bool,
    /// firefox uniquement (Chrome/Edge verrouillent la base sous Windows).
    #[serde(default)]
    pub ytdlp_cookies_browser: String,
    /// Fichier Netscape cookies.txt, prioritaire sur le navigateur.
    #[serde(default)]
    pub ytdlp_cookies_file: String,
    #[serde(default)]
    pub youtube_onboarding_done: bool,
    #[serde(default = "default_export_preset_id")]
    pub default_preset_id: String,
    #[serde(default)]
    pub developer_mode: bool,
    /// Surcharge CRF (0–51) si mode développeur actif.
    #[serde(default)]
    pub dev_crf: Option<u8>,
    #[serde(default)]
    pub dev_video_max_bitrate_kbps: Option<u32>,
    #[serde(default)]
    pub dev_fps: Option<u32>,
    #[serde(default)]
    pub dev_audio_bitrate_kbps: Option<u32>,
    #[serde(default)]
    pub dev_x264_preset: String,
    #[serde(default)]
    pub auto_update_app: bool,
    #[serde(default)]
    pub ignored_update_version: Option<String>,
}

fn default_export_preset_id() -> String {
    "tiktok".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            export_dir: String::new(),
            name_template: "{titre}_depuis-{debut}s_jusqu-a-{fin}s".to_string(),
            hardware_encode: false,
            auto_update_ytdlp: false,
            ytdlp_cookies_browser: String::new(),
            ytdlp_cookies_file: String::new(),
            youtube_onboarding_done: true,
            default_preset_id: default_export_preset_id(),
            developer_mode: false,
            dev_crf: None,
            dev_video_max_bitrate_kbps: None,
            dev_fps: None,
            dev_audio_bitrate_kbps: None,
            dev_x264_preset: String::new(),
            auto_update_app: false,
            ignored_update_version: None,
        }
    }
}

const X264_PRESETS: &[&str] = &[
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
    "slower",
    "veryslow",
];

pub fn apply_dev_overrides(preset: &mut Preset, settings: &Settings) {
    if !settings.developer_mode {
        return;
    }
    if let Some(crf) = settings.dev_crf {
        preset.crf = Some(crf.clamp(0, 51));
    }
    if let Some(kbps) = settings.dev_video_max_bitrate_kbps
        && kbps > 0
    {
        preset.video_max_bitrate_kbps = Some(kbps);
    }
    if let Some(fps) = settings.dev_fps
        && fps > 0
    {
        preset.fps = Some(fps);
    }
    if let Some(ab) = settings.dev_audio_bitrate_kbps
        && ab > 0
    {
        preset.audio_bitrate_kbps = Some(ab);
    }
}

pub fn dev_x264_preset(settings: &Settings) -> &'static str {
    if !settings.developer_mode {
        return "fast";
    }
    let p = settings.dev_x264_preset.trim().to_ascii_lowercase();
    for &name in X264_PRESETS {
        if p == name {
            return name;
        }
    }
    "fast"
}

pub fn ytdlp_cookies_browser(browser: &str) -> Option<&'static str> {
    match browser.trim().to_ascii_lowercase().as_str() {
        "firefox" => Some("firefox"),
        _ => None,
    }
}

pub fn ytdlp_cookies_file(settings: &Settings) -> Option<String> {
    let path = settings.ytdlp_cookies_file.trim();
    if path.is_empty() {
        None
    } else {
        Some(path.to_string())
    }
}

pub fn dollyt_data_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("Dollyt")
}

fn settings_path() -> PathBuf {
    dollyt_data_dir().join("settings.json")
}

fn default_export_dir() -> String {
    std::env::var("USERPROFILE")
        .map(|h| format!("{h}\\Videos\\Dollyt"))
        .unwrap_or_else(|_| dollyt_data_dir().join("exports").to_string_lossy().into())
}

pub fn load() -> Result<Settings> {
    let path = settings_path();
    if !path.exists() {
        let s = Settings::default();
        save(&s)?;
        return Ok(s);
    }
    let raw = fs::read_to_string(path)?;
    let mut settings: Settings = serde_json::from_str(&raw)?;
    if settings.export_dir == default_export_dir() {
        settings.export_dir.clear();
        save(&settings)?;
    }

    Ok(settings)
}

pub fn save(settings: &Settings) -> Result<()> {
    let dir = dollyt_data_dir();
    fs::create_dir_all(&dir)?;
    let json = serde_json::to_string_pretty(settings)?;
    let path = settings_path();
    let tmp = path.with_extension("json.tmp");
    {
        let mut file = fs::File::create(&tmp)?;
        use std::io::Write;
        file.write_all(json.as_bytes())?;
        file.sync_all()?;
    }
    if path.exists() {
        fs::remove_file(&path)?;
    }
    fs::rename(tmp, path)?;
    Ok(())
}

pub fn resolve_export_path(
    template: &str,
    title: &str,
    start: f64,
    end: f64,
    ext: &str,
) -> PathBuf {
    let safe_title = sanitize_filename(title);
    let file = template
        .replace("{titre}", &safe_title)
        .replace("{debut}", &format!("{start:.1}").replace('.', "-"))
        .replace("{fin}", &format!("{end:.1}").replace('.', "-"));
    let dir = PathBuf::from(
        load()
            .map(|s| s.export_dir)
            .unwrap_or_else(|_| default_export_dir()),
    );
    let filename = Path::new(&file)
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("clip");
    let ext = format!(".{ext}");
    let mut candidate = dir.join(format!("{filename}{ext}"));
    let mut suffix = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{filename}-{suffix}{ext}"));
        suffix += 1;
    }
    candidate
}

fn sanitize_filename(input: &str) -> String {
    let mut out = String::new();
    for ch in input.chars() {
        if ch.is_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else if ch.is_whitespace() {
            out.push('_');
        }
    }
    if out.is_empty() {
        out = "clip".into();
    }
    // Noms réservés Windows (CON, NUL, COM1…) : Windows refuse de créer le fichier.
    let upper = out.to_ascii_uppercase();
    let reserved = matches!(
        upper.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    );
    if reserved {
        out = format!("_{out}");
    }
    out.chars().take(80).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_path_keeps_template_inside_export_directory() {
        let path = resolve_export_path(r"..\outside\{titre}", "title", 1.0, 2.0, "mp4");
        assert_eq!(path.file_name().and_then(|v| v.to_str()), Some("title.mp4"));
        assert!(!path.to_string_lossy().contains("outside"));
    }
}

use crate::error::Result;
use crate::presets::Preset;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub export_dir: String,
    pub name_template: String,
    pub hardware_encode: bool,
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
}

fn default_export_preset_id() -> String {
    "tiktok".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            export_dir: default_export_dir(),
            name_template: "{titre}_depuis-{debut}s_jusqu-a-{fin}s".to_string(),
            hardware_encode: false,
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
    Ok(serde_json::from_str(&raw)?)
}

pub fn save(settings: &Settings) -> Result<()> {
    let dir = dollyt_data_dir();
    fs::create_dir_all(&dir)?;
    let json = serde_json::to_string_pretty(settings)?;
    fs::write(settings_path(), json)?;
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
    dir.join(format!("{file}.{ext}"))
}

fn sanitize_filename(input: &str) -> String {
    let mut out = String::new();
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else if ch.is_whitespace() {
            out.push('_');
        }
    }
    if out.is_empty() {
        "clip".into()
    } else {
        out.chars().take(80).collect()
    }
}

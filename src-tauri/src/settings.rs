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
    #[serde(default = "default_encode_quality")]
    pub encode_quality: String,
    #[serde(default)]
    pub auto_update_ytdlp: bool,
    #[serde(default)]
    pub ytdlp_cookies_browser: String,
    #[serde(default)]
    pub ytdlp_cookies_file: String,
    #[serde(default = "default_export_preset_id")]
    pub default_preset_id: String,
    #[serde(default)]
    pub developer_mode: bool,
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

fn default_encode_quality() -> String {
    "quality".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            export_dir: String::new(),
            name_template: "{titre}_{debut}-{fin}".to_string(),
            hardware_encode: false,
            encode_quality: default_encode_quality(),
            auto_update_ytdlp: false,
            ytdlp_cookies_browser: String::new(),
            ytdlp_cookies_file: String::new(),
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

pub fn encode_prefers_speed(settings: &Settings) -> bool {
    settings.encode_quality.trim().eq_ignore_ascii_case("speed")
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
    validate_settings(&settings)?;
    if settings.export_dir == default_export_dir() {
        settings.export_dir.clear();
        save(&settings)?;
    }

    Ok(settings)
}

pub fn save(settings: &Settings) -> Result<()> {
    validate_settings(settings)?;
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
    crate::atomic_file::replace_file(&tmp, &path)?;
    Ok(())
}

fn validate_settings(settings: &Settings) -> Result<()> {
    let invalid = |_field: &str| crate::error::DollytError::InvalidSettings;
    if settings.name_template.encode_utf16().count() > 200 {
        return Err(invalid("nameTemplate"));
    }
    if settings.default_preset_id.is_empty()
        || settings.default_preset_id.len() > 64
        || !settings
            .default_preset_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(invalid("defaultPresetId"));
    }
    if !matches!(settings.encode_quality.as_str(), "quality" | "speed") {
        return Err(invalid("encodeQuality"));
    }
    if settings.dev_crf.is_some_and(|crf| crf > 51) {
        return Err(invalid("devCrf"));
    }
    if settings
        .dev_video_max_bitrate_kbps
        .is_some_and(|rate| !(1..=500_000).contains(&rate))
    {
        return Err(invalid("devVideoMaxBitrateKbps"));
    }
    if settings
        .dev_fps
        .is_some_and(|fps| !(1..=240).contains(&fps))
    {
        return Err(invalid("devFps"));
    }
    if settings
        .dev_audio_bitrate_kbps
        .is_some_and(|rate| !(8..=1536).contains(&rate))
    {
        return Err(invalid("devAudioBitrateKbps"));
    }
    if !settings.dev_x264_preset.is_empty()
        && !X264_PRESETS.contains(&settings.dev_x264_preset.as_str())
    {
        return Err(invalid("devX264Preset"));
    }
    if !settings.ytdlp_cookies_browser.is_empty()
        && !settings
            .ytdlp_cookies_browser
            .eq_ignore_ascii_case("firefox")
    {
        return Err(invalid("ytdlpCookiesBrowser"));
    }
    if settings
        .ignored_update_version
        .as_deref()
        .is_some_and(|version| version.len() > 64)
    {
        return Err(invalid("ignoredUpdateVersion"));
    }
    Ok(())
}

const DEFAULT_NAME_TEMPLATE: &str = "{titre}_{debut}-{fin}";

pub fn export_name_template<'a>(preset_template: &'a str, settings: &'a Settings) -> &'a str {
    let configured = settings.name_template.trim();
    if configured.is_empty() || configured == DEFAULT_NAME_TEMPLATE {
        preset_template
    } else {
        configured
    }
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
        .map(sanitize_output_stem)
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "clip".to_string());
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
    if is_reserved_dos_name(&out.to_ascii_uppercase()) {
        out = format!("_{out}");
    }
    out.chars().take(80).collect()
}

fn is_reserved_dos_name(upper: &str) -> bool {
    matches!(
        upper,
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
    )
}

// Le gabarit de nom n'est pas passé par sanitize_filename (trop stricte pour
// les points) : on ne retire que ce que Windows refuse vraiment.
fn sanitize_output_stem(stem: &str) -> String {
    let cleaned: String = stem
        .chars()
        .map(|c| {
            if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || c.is_control() {
                '_'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim_end_matches(['.', ' ']).to_string();
    if trimmed.trim().is_empty() {
        return "clip".to_string();
    }
    // Windows réserve le nom avant le premier point : "con.foo" est refusé.
    let dos_part = trimmed.split('.').next().unwrap_or("");
    if is_reserved_dos_name(&dos_part.to_ascii_uppercase()) {
        return format!("_{trimmed}");
    }
    trimmed.chars().take(120).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_name_template_overrides_preset_template() {
        let settings = Settings {
            name_template: "custom_{titre}".into(),
            ..Settings::default()
        };
        assert_eq!(
            export_name_template("preset_{titre}", &settings),
            "custom_{titre}"
        );
    }

    #[test]
    fn default_name_template_keeps_preset_specific_template() {
        let settings = Settings::default();
        assert_eq!(
            export_name_template("{titre}_max", &settings),
            "{titre}_max"
        );
    }

    #[test]
    fn rejects_out_of_range_developer_settings() {
        let settings = Settings {
            dev_fps: Some(1_000),
            ..Settings::default()
        };
        assert!(validate_settings(&settings).is_err());
    }

    #[test]
    fn name_template_limit_counts_utf16_units_like_the_ui() {
        let settings = Settings {
            name_template: "é".repeat(101),
            ..Settings::default()
        };
        assert!(validate_settings(&settings).is_ok());
    }

    #[test]
    fn export_path_keeps_template_inside_export_directory() {
        let path = resolve_export_path(r"..\outside\{titre}", "title", 1.0, 2.0, "mp4");
        assert_eq!(path.file_name().and_then(|v| v.to_str()), Some("title.mp4"));
        assert!(!path.to_string_lossy().contains("outside"));
    }

    #[test]
    fn export_path_escapes_reserved_template_names() {
        let path = resolve_export_path("CON", "title", 1.0, 2.0, "mp4");
        assert_eq!(path.file_name().and_then(|v| v.to_str()), Some("_CON.mp4"));
    }
}

use crate::error::{DollytError, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub container: String,
    #[serde(rename = "videoCodec")]
    pub video_codec: String,
    #[serde(rename = "audioCodec")]
    pub audio_codec: String,
    pub crf: Option<u8>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<u32>,
    pub crop: String,
    #[serde(rename = "audioBitrateKbps")]
    pub audio_bitrate_kbps: Option<u32>,
    #[serde(rename = "nameTemplate")]
    pub name_template: String,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "videoMaxBitrateKbps", default)]
    pub video_max_bitrate_kbps: Option<u32>,
}

const BUILTIN: &[(&str, &str)] = &[
    ("source", include_str!("../presets/source.json")),
    ("edition", include_str!("../presets/edition.json")),
    ("tiktok", include_str!("../presets/tiktok.json")),
    ("reels", include_str!("../presets/reels.json")),
    ("shorts", include_str!("../presets/shorts.json")),
    ("youtube", include_str!("../presets/youtube.json")),
    ("x", include_str!("../presets/x.json")),
    ("quality-max", include_str!("../presets/quality-max.json")),
];

pub fn list_builtin() -> Result<Vec<Preset>> {
    BUILTIN.iter().map(|(_, raw)| parse_preset(raw)).collect()
}

pub fn get_builtin(id: &str) -> Result<Preset> {
    let Some((_, raw)) = BUILTIN.iter().find(|(pid, _)| *pid == id) else {
        return Err(DollytError::PresetNotFound(id.to_string()));
    };
    parse_preset(raw)
}

fn parse_preset(raw: &str) -> Result<Preset> {
    serde_json::from_str(raw).map_err(DollytError::from)
}

pub fn user_presets_dir() -> PathBuf {
    crate::settings::dollyt_data_dir().join("presets")
}

pub fn list_user() -> Result<Vec<Preset>> {
    let dir = user_presets_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        if entry.path().extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let raw = fs::read_to_string(entry.path())?;
        out.push(parse_preset(&raw)?);
    }
    Ok(out)
}

pub fn save_user(preset: &Preset) -> Result<()> {
    if !is_safe_preset_id(&preset.id) {
        return Err(DollytError::PresetNotFound(preset.id.clone()));
    }
    let dir = user_presets_dir();
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.json", preset.id));
    if !path_is_inside(&dir, &path) {
        return Err(DollytError::PresetNotFound(preset.id.clone()));
    }
    let json = serde_json::to_string_pretty(preset)?;
    fs::write(path, json)?;
    Ok(())
}

fn is_safe_preset_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn path_is_inside(root: &Path, candidate: &Path) -> bool {
    let Ok(root) = root.canonicalize() else {
        return false;
    };
    let Some(parent) = candidate.parent() else {
        return false;
    };
    let Ok(parent) = parent.canonicalize() else {
        return false;
    };
    parent == root
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_presets_parse() {
        let all = list_builtin().expect("builtin");
        assert_eq!(all.len(), 8);
        assert!(all.iter().any(|p| p.id == "edition"));
    }

    #[test]
    fn rejects_path_like_preset_ids() {
        assert!(!is_safe_preset_id("../settings"));
        assert!(!is_safe_preset_id(r"C:\settings"));
        assert!(!is_safe_preset_id(""));
        assert!(is_safe_preset_id("my-preset_1"));
    }
}

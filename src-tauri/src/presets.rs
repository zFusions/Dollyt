use crate::error::{DollytError, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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
    ("audio", include_str!("../presets/audio.json")),
    (
        "audio-lossless",
        include_str!("../presets/audio-lossless.json"),
    ),
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

pub fn get(id: &str) -> Result<Preset> {
    if BUILTIN.iter().any(|(preset_id, _)| *preset_id == id) {
        return get_builtin(id);
    }
    resolve_from_lists(id, &[], &list_user()?)
}

pub fn list_all() -> Result<Vec<Preset>> {
    let mut all = list_builtin()?;
    let builtin_ids: std::collections::HashSet<String> =
        all.iter().map(|preset| preset.id.clone()).collect();
    all.extend(
        list_user()?
            .into_iter()
            .filter(|preset| !builtin_ids.contains(&preset.id)),
    );
    Ok(all)
}

fn resolve_from_lists(id: &str, builtins: &[Preset], users: &[Preset]) -> Result<Preset> {
    builtins
        .iter()
        .find(|preset| preset.id == id)
        .or_else(|| users.iter().find(|preset| preset.id == id))
        .cloned()
        .ok_or_else(|| DollytError::PresetNotFound(id.to_string()))
}

fn parse_preset(raw: &str) -> Result<Preset> {
    let preset: Preset = serde_json::from_str(raw)?;
    validate_preset(&preset)?;
    Ok(preset)
}

const CONTAINERS: &[&str] = &[
    "mp4", "mkv", "webm", "mov", "mp3", "flac", "wav", "m4a", "aac", "opus",
];
const VIDEO_CODECS: &[&str] = &["libx264", "h264_nvenc", "h264_amf", "copy", "none"];
const AUDIO_CODECS: &[&str] = &["aac", "libmp3lame", "flac", "copy", "opus", "pcm_s16le"];
const CROPS: &[&str] = &["none", "center"];

fn validate_preset(p: &Preset) -> Result<()> {
    let bad = |field: &str| DollytError::InvalidPreset(format!("{field} non supporté"));
    if p.id.is_empty()
        || p.id.len() > 64
        || !p
            .id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(bad("id"));
    }
    if !CONTAINERS.contains(&p.container.as_str()) {
        return Err(bad("container"));
    }
    if !VIDEO_CODECS.contains(&p.video_codec.as_str()) {
        return Err(bad("videoCodec"));
    }
    if !AUDIO_CODECS.contains(&p.audio_codec.as_str()) {
        return Err(bad("audioCodec"));
    }
    if !CROPS.contains(&p.crop.as_str()) {
        return Err(bad("crop"));
    }
    if p.crf.is_some_and(|crf| crf > 51) {
        return Err(bad("crf"));
    }
    if p.width.is_some_and(|width| width == 0 || width > 7680)
        || p.height.is_some_and(|height| height == 0 || height > 4320)
        || p.width.is_some() != p.height.is_some()
    {
        return Err(bad("dimensions"));
    }
    if p.fps.is_some_and(|fps| !(1..=240).contains(&fps)) {
        return Err(bad("fps"));
    }
    if p.audio_bitrate_kbps
        .is_some_and(|rate| !(8..=1536).contains(&rate))
    {
        return Err(bad("audioBitrateKbps"));
    }
    if p.video_max_bitrate_kbps
        .is_some_and(|rate| !(1..=500_000).contains(&rate))
    {
        return Err(bad("videoMaxBitrateKbps"));
    }
    if p.name_template.len() > 200 {
        return Err(bad("nameTemplate"));
    }
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_presets_are_resolved_for_export() {
        let preset = Preset {
            id: "mine".into(),
            name: "Mine".into(),
            container: "mp4".into(),
            video_codec: "libx264".into(),
            audio_codec: "aac".into(),
            crf: Some(18),
            width: None,
            height: None,
            fps: None,
            crop: "none".into(),
            audio_bitrate_kbps: None,
            name_template: "{titre}".into(),
            description: String::new(),
            video_max_bitrate_kbps: None,
        };
        assert_eq!(
            resolve_from_lists("mine", &[], &[preset]).unwrap().id,
            "mine"
        );
    }

    #[test]
    fn builtins_take_precedence_over_colliding_user_presets() {
        let user = Preset {
            id: "source".into(),
            name: "Spoofed".into(),
            container: "mp4".into(),
            video_codec: "libx264".into(),
            audio_codec: "aac".into(),
            crf: Some(18),
            width: None,
            height: None,
            fps: None,
            crop: "none".into(),
            audio_bitrate_kbps: None,
            name_template: "{titre}".into(),
            description: String::new(),
            video_max_bitrate_kbps: None,
        };
        let resolved = resolve_from_lists("source", &list_builtin().unwrap(), &[user]).unwrap();
        assert_eq!(resolved.video_codec, "copy");
    }

    #[test]
    fn builtin_presets_parse() {
        let all = list_builtin().expect("builtin");
        assert_eq!(all.len(), 10);
        assert!(all.iter().any(|p| p.id == "edition"));
    }

    #[test]
    fn rejects_out_of_range_encoding_values() {
        let mut preset = get_builtin("source").unwrap();
        preset.crf = Some(52);
        assert!(validate_preset(&preset).is_err());
    }
}

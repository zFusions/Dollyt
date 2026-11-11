#![allow(dead_code)]

use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FormatSelection {
    pub video_id: String,
    pub audio_id: Option<String>,
}

pub fn pick_muxed_format(formats: &[Value]) -> Option<(String, String)> {
    for format in formats {
        if format.get("format_id").and_then(|v| v.as_str()) != Some("18") {
            continue;
        }
        let id = format.get("format_id")?.as_str()?.to_string();
        let url = format.get("url")?.as_str()?.to_string();
        return Some((id, url));
    }
    for format in formats {
        if !is_muxed_https(format) {
            continue;
        }
        let id = format.get("format_id")?.as_str()?.to_string();
        let url = format.get("url")?.as_str()?.to_string();
        return Some((id, url));
    }
    None
}

pub fn pick_download_formats(formats: &[Value]) -> Option<FormatSelection> {
    let video = formats
        .iter()
        .filter(|f| is_video_https(f))
        .max_by(|a, b| {
            let ra = a.get("height").and_then(|v| v.as_u64()).unwrap_or(0);
            let rb = b.get("height").and_then(|v| v.as_u64()).unwrap_or(0);
            ra.cmp(&rb).then_with(|| {
                let fa = a.get("fps").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let fb = b.get("fps").and_then(|v| v.as_f64()).unwrap_or(0.0);
                fa.partial_cmp(&fb).unwrap_or(std::cmp::Ordering::Equal)
            })
        })?;
    let video_id = video.get("format_id")?.as_str()?.to_string();
    let audio = formats
        .iter()
        .find(|f| format_id_is(f, "251"))
        .or_else(|| formats.iter().find(|f| format_id_is(f, "140")));
    let audio_id = audio
        .and_then(|f| f.get("format_id"))
        .and_then(|v| v.as_str().map(String::from));
    Some(FormatSelection { video_id, audio_id })
}

fn is_muxed_https(format: &Value) -> bool {
    let vcodec = format
        .get("vcodec")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    let acodec = format
        .get("acodec")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    if vcodec == "none" || acodec == "none" {
        return false;
    }
    let protocol = format
        .get("protocol")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    !protocol.contains("m3u8")
}

fn is_video_https(format: &Value) -> bool {
    let vcodec = format
        .get("vcodec")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    if vcodec == "none" {
        return false;
    }
    let acodec = format
        .get("acodec")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    if acodec != "none" {
        return false;
    }
    let protocol = format
        .get("protocol")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if protocol.contains("m3u8") {
        return false;
    }
    protocol.contains("https") || protocol == "http"
}

fn format_id_is(format: &Value, id: &str) -> bool {
    format.get("format_id").and_then(|v| v.as_str()) == Some(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn hq_picks_tallest_https_video_and_opus() {
        let json = fs::read_to_string("fixtures/m0_metadata.json").expect("fixture");
        let value: serde_json::Value = serde_json::from_str(&json).expect("json");
        let formats = value["formats"].as_array().expect("formats");
        let selection = pick_download_formats(formats).expect("hq");
        assert_eq!(selection.video_id, "308");
        assert_eq!(selection.audio_id.as_deref(), Some("251"));
    }

    #[test]
    fn preview_still_prefers_18() {
        let json = fs::read_to_string("fixtures/m0_metadata.json").expect("fixture");
        let value: serde_json::Value = serde_json::from_str(&json).expect("json");
        let formats = value["formats"].as_array().expect("formats");
        let (id, _) = pick_muxed_format(formats).expect("muxed");
        assert_eq!(id, "18");
    }
}

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
        if !is_muxed_streamable(format) {
            continue;
        }
        return Some(muxed_pair(format, "18"));
    }
    let mut best: Option<(u64, String, String)> = None;
    for format in formats {
        if !is_muxed_streamable(format) {
            continue;
        }
        let id = format.get("format_id")?.as_str()?.to_string();
        let height = format.get("height").and_then(|v| v.as_u64()).unwrap_or(360);
        match &best {
            Some((h, _, _)) if *h <= height => {}
            _ => best = Some((height, id, muxed_url(format))),
        }
    }
    best.map(|(_, id, url)| (id, url))
}

fn muxed_pair(format: &Value, default_id: &str) -> (String, String) {
    let id = format
        .get("format_id")
        .and_then(|v| v.as_str())
        .unwrap_or(default_id)
        .to_string();
    (id, muxed_url(format))
}

fn muxed_url(format: &Value) -> String {
    format
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

pub fn to_ytdlp_format(sel: &FormatSelection) -> String {
    match &sel.audio_id {
        Some(audio) => format!("{}+{}", sel.video_id, audio),
        None => sel.video_id.clone(),
    }
}

pub fn pick_download_formats(formats: &[Value]) -> Option<FormatSelection> {
    let video = formats
        .iter()
        .filter(|f| is_video_https(f))
        .max_by(|a, b| {
            let ra = a.get("height").and_then(|v| v.as_u64()).unwrap_or(0);
            let rb = b.get("height").and_then(|v| v.as_u64()).unwrap_or(0);
            ra.cmp(&rb)
                .then_with(|| {
                    let fa = a.get("fps").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let fb = b.get("fps").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    fa.partial_cmp(&fb).unwrap_or(std::cmp::Ordering::Equal)
                })
                .then_with(|| {
                    format_video_kbps(a)
                        .partial_cmp(&format_video_kbps(b))
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
        })?;
    let video_id = video.get("format_id")?.as_str()?.to_string();
    let audio = formats
        .iter()
        .find(|f| format_id_is(f, "251"))
        .or_else(|| formats.iter().find(|f| format_id_is(f, "140")))
        .or_else(|| best_audio_only(formats));
    let audio_id = audio
        .and_then(|f| f.get("format_id"))
        .and_then(|v| v.as_str().map(String::from));
    Some(FormatSelection { video_id, audio_id })
}

fn best_audio_only(formats: &[Value]) -> Option<&Value> {
    formats.iter().filter(|f| is_audio_https(f)).max_by(|a, b| {
        is_plain_id(a)
            .cmp(&is_plain_id(b))
            .then_with(|| is_opus(a).cmp(&is_opus(b)))
            .then_with(|| {
                audio_kbps(a)
                    .partial_cmp(&audio_kbps(b))
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    })
}

fn is_plain_id(format: &Value) -> bool {
    format
        .get("format_id")
        .and_then(|v| v.as_str())
        .is_some_and(|id| !id.contains('-'))
}

fn is_opus(format: &Value) -> bool {
    format
        .get("acodec")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .contains("opus")
}

fn audio_kbps(format: &Value) -> f64 {
    format
        .get("abr")
        .or_else(|| format.get("tbr"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
}

fn is_audio_https(format: &Value) -> bool {
    let vcodec = format
        .get("vcodec")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    if vcodec != "none" {
        return false;
    }
    let acodec = format
        .get("acodec")
        .and_then(|v| v.as_str())
        .unwrap_or("none");
    if acodec == "none" {
        return false;
    }
    let protocol = format
        .get("protocol")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    protocol.contains("https") && !protocol.contains("m3u8")
}

fn is_muxed_streamable(format: &Value) -> bool {
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
    protocol.contains("https") && !protocol.contains("m3u8")
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
    protocol.contains("https")
}

fn format_id_is(format: &Value, id: &str) -> bool {
    format.get("format_id").and_then(|v| v.as_str()) == Some(id)
}

fn format_video_kbps(format: &Value) -> f64 {
    format
        .get("tbr")
        .or_else(|| format.get("vbr"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
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
    fn audio_falls_back_to_other_audio_only_format() {
        let value: serde_json::Value = serde_json::json!({
            "formats": [
                {"format_id": "313", "vcodec": "vp9", "acodec": "none", "protocol": "https", "height": 2160, "fps": 30, "tbr": 100},
                {"format_id": "600", "vcodec": "none", "acodec": "mp4a.40.2", "protocol": "https", "abr": 128},
                {"format_id": "601", "vcodec": "none", "acodec": "opus", "protocol": "https", "abr": 160},
                {"format_id": "602-drc", "vcodec": "none", "acodec": "opus", "protocol": "https", "abr": 256}
            ]
        });
        let formats = value["formats"].as_array().expect("formats");
        let selection = pick_download_formats(formats).expect("sel");
        assert_eq!(selection.video_id, "313");
        assert_eq!(selection.audio_id.as_deref(), Some("601"));
    }

    #[test]
    fn preview_still_prefers_18() {
        let json = fs::read_to_string("fixtures/m0_metadata.json").expect("fixture");
        let value: serde_json::Value = serde_json::from_str(&json).expect("json");
        let formats = value["formats"].as_array().expect("formats");
        let (id, _) = pick_muxed_format(formats).expect("muxed");
        assert_eq!(id, "18");
    }

    #[test]
    fn preview_accepts_18_without_inline_url() {
        let json = fs::read_to_string("fixtures/format18_no_url.json").expect("fixture");
        let value: serde_json::Value = serde_json::from_str(&json).expect("json");
        let formats = value["formats"].as_array().expect("formats");
        let (id, url) = pick_muxed_format(formats).expect("muxed");
        assert_eq!(id, "18");
        assert!(url.is_empty());
    }
}

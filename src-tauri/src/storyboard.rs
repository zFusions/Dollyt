use crate::error::Result;
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryboardInfo {
    pub template_url: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub interval_secs: Option<f64>,
    pub columns: Option<u32>,
    pub rows: Option<u32>,
}

pub fn fetch_storyboard(url: &str) -> Result<StoryboardInfo> {
    let value = crate::ytdlp::fetch_metadata_json(url)?;
    Ok(parse_storyboard(&value))
}

pub fn parse_storyboard(meta: &Value) -> StoryboardInfo {
    let formats = meta
        .get("formats")
        .and_then(|v| v.as_array())
        .map(|v| v.as_slice())
        .unwrap_or(&[]);
    for format_id in ["sb3", "sb2", "sb1", "sb0"] {
        if let Some(fmt) = formats
            .iter()
            .find(|f| f.get("format_id").and_then(|v| v.as_str()) == Some(format_id))
        {
            let template = fmt
                .get("url")
                .and_then(|v| v.as_str())
                .map(String::from)
                .or_else(|| {
                    fmt.get("fragment_base_url")
                        .and_then(|v| v.as_str())
                        .map(String::from)
                });
            if template.is_some() {
                return StoryboardInfo {
                    template_url: template,
                    width: fmt.get("width").and_then(|v| v.as_u64()).map(|v| v as u32),
                    height: fmt.get("height").and_then(|v| v.as_u64()).map(|v| v as u32),
                    interval_secs: fmt.get("duration").and_then(|v| v.as_f64()),
                    columns: fmt
                        .get("columns")
                        .and_then(|v| v.as_u64())
                        .map(|v| v as u32),
                    rows: fmt.get("rows").and_then(|v| v.as_u64()).map(|v| v as u32),
                };
            }
        }
    }
    StoryboardInfo {
        template_url: None,
        width: None,
        height: None,
        interval_secs: None,
        columns: None,
        rows: None,
    }
}

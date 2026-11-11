use crate::error::{DollytError, Result};
use url::Url;

pub fn validate_youtube_url(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    let parsed = Url::parse(trimmed).map_err(|_| DollytError::InvalidYoutubeUrl)?;
    let host = parsed.host_str().ok_or(DollytError::InvalidYoutubeUrl)?;
    let allowed = matches!(
        host,
        "youtube.com" | "www.youtube.com" | "m.youtube.com" | "youtu.be"
    );
    if !allowed {
        return Err(DollytError::InvalidYoutubeUrl);
    }
    Ok(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_youtube_hosts() {
        assert!(validate_youtube_url("https://www.youtube.com/watch?v=abc").is_ok());
        assert!(validate_youtube_url("https://youtu.be/abc").is_ok());
    }

    #[test]
    fn rejects_other_hosts() {
        assert!(validate_youtube_url("https://example.com/watch?v=abc").is_err());
    }
}

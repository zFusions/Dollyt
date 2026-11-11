use std::fs::{OpenOptions, create_dir_all};
use std::io::Write;
use std::path::PathBuf;

pub fn log_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("Dollyt")
        .join("logs")
}

pub fn log_line(message: &str) {
    let safe = redact_secrets(message);
    let dir = log_dir();
    if create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("dollyt.log");
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    let _ = writeln!(file, "{} {}", time_text(), safe.replace('\n', " "));
}

fn time_text() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{now}")
}

fn redact_secrets(line: &str) -> String {
    let mut out = line.to_string();
    for needle in ["http://", "https://"] {
        while let Some(start) = out.find(needle) {
            let rest = &out[start..];
            let end = rest.find([' ', '\t', '"', '\'']).unwrap_or(rest.len());
            out.replace_range(start..start + end, "<url>");
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_urls() {
        let s = redact_secrets("erreur https://googlevideo.com/foo bar");
        assert!(!s.contains("googlevideo"));
        assert!(s.contains("<url>"));
    }
}

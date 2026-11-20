use serde::Serialize;
use std::fs::{self, OpenOptions, create_dir_all};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::Emitter;

const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024;
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticLogEvent {
    line: String,
}

pub fn initialize(app: tauri::AppHandle) {
    let _ = APP_HANDLE.set(app);
}

pub fn log_dir() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("Dollyt")
        .join("logs")
}

pub fn log_line(message: &str) {
    let safe = redact_secrets(message);
    let line = format!("{} {}", time_text(), safe.replace(['\n', '\r'], " "));
    let dir = log_dir();
    if create_dir_all(&dir).is_ok() {
        static WRITE_LOCK: OnceLock<std::sync::Mutex<()>> = OnceLock::new();
        let lock = WRITE_LOCK.get_or_init(|| std::sync::Mutex::new(()));
        let _guard = lock.lock().unwrap_or_else(|error| error.into_inner());
        let path = dir.join("dollyt.log");
        maybe_rotate(&path);
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = writeln!(file, "{line}");
        }
    }
    if let Some(app) = APP_HANDLE.get() {
        let _ = app.emit("diagnostic-log", DiagnosticLogEvent { line });
    }
}

pub fn read_all() -> String {
    let dir = log_dir();
    [dir.join("dollyt.1.log"), dir.join("dollyt.log")]
        .into_iter()
        .filter_map(|path| fs::read_to_string(path).ok())
        .filter(|content| !content.is_empty())
        .collect::<Vec<_>>()
        .join("")
}

fn maybe_rotate(path: &Path) {
    let Ok(meta) = fs::metadata(path) else {
        return;
    };
    if meta.len() <= MAX_LOG_BYTES {
        return;
    }
    let backup = path.with_extension("1.log");
    let _ = fs::rename(path, backup);
}

fn time_text() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (y, m, d) = civil_from_days(days);
    format!(
        "{y:04}-{m:02}-{d:02} {:02}:{:02}:{:02}",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

pub(crate) fn redact_secrets(line: &str) -> String {
    let mut out = line.to_string();
    for needle in ["http://", "https://"] {
        while let Some(start) = out.find(needle) {
            let rest = &out[start..];
            let end = rest.find([' ', '\t', '"', '\'']).unwrap_or(rest.len());
            out.replace_range(start..start + end, "<url>");
        }
    }
    redact_cookie_paths(&out)
}

fn redact_cookie_paths(line: &str) -> String {
    line.split_inclusive(char::is_whitespace)
        .map(|token| {
            let lower = token.to_ascii_lowercase();
            if lower.contains("cookie")
                && (lower.contains('\\') || lower.contains('/') || lower.contains(':'))
            {
                let space: String = token
                    .chars()
                    .rev()
                    .take_while(|c| c.is_whitespace())
                    .collect();
                let space: String = space.chars().rev().collect();
                format!("<cookies>{space}")
            } else {
                token.to_string()
            }
        })
        .collect()
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

    #[test]
    fn redacts_signed_video_urls_and_query_credentials() {
        let s = redact_secrets(
            "HTTP 403 https://rr4---sn.example.googlevideo.com/videoplayback?ip=192.0.2.1&sig=secret&cookie=secret",
        );
        assert!(s.contains("HTTP 403"));
        assert!(!s.contains("googlevideo"));
        assert!(!s.contains("192.0.2.1"));
        assert!(!s.contains("secret"));
    }

    #[test]
    fn redacts_a_cookies_file_path() {
        let s = redact_secrets(r"cookies introuvables C:\Users\ada\cookies.txt");
        assert!(s.contains("<cookies>"));
        assert!(!s.contains("Users"));
        assert!(!s.contains("ada"));
    }
}

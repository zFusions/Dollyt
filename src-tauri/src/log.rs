use std::fs::{self, OpenOptions, create_dir_all};
use std::io::Write;
use std::path::{Path, PathBuf};

const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024;

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
    maybe_rotate(&path);
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) else {
        return;
    };
    let _ = writeln!(file, "{} {}", time_text(), safe.replace('\n', " "));
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

/// Jours depuis l'époque → date grégorienne (algorithme civil, sans dépendance).
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

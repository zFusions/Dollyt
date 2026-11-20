use crate::bins::{self, ToolPaths};
use crate::error::{DollytError, Result};
use std::path::Path;
use std::process::{Child, Command, Output, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn tool_paths() -> Result<&'static ToolPaths> {
    bins::tools().ok_or_else(|| DollytError::BinMissing("outils Dollyt".into()))
}

pub fn run_ytdlp(args: &[&str]) -> Result<Output> {
    ytdlp_command(args)?.output().map_err(DollytError::from)
}

pub fn spawn_ytdlp(args: &[&str]) -> Result<Child> {
    let mut cmd = ytdlp_command(args)?;
    cmd.arg("--newline");
    cmd.arg("--progress-template");
    cmd.arg("download:%(progress._percent_str)s");
    // yt-dlp writes progress templates to stdout. Both pipes are drained by
    // independent readers so neither can block the child process.
    cmd.spawn().map_err(DollytError::from)
}

fn ytdlp_command(args: &[&str]) -> Result<Command> {
    let tools = tool_paths()?;
    let mut cmd = Command::new(&tools.ytdlp);
    push_ytdlp_defaults(&mut cmd);
    for arg in args {
        cmd.arg(arg);
    }
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    Ok(cmd)
}

fn push_ytdlp_defaults(cmd: &mut Command) {
    cmd.arg("--ignore-config");
    push_ytdlp_network_defaults(cmd);
    let Some(tools) = bins::tools() else {
        return;
    };
    // Sans ce chemin, yt-dlp prend le premier ffmpeg du PATH. Le binaire
    // embarqué est celui dont le hash a été vérifié.
    push_ffmpeg_location(cmd, &tools.ffmpeg);
    let deno = &tools.deno;
    if deno.is_file() {
        cmd.arg("--js-runtimes");
        cmd.arg(format!("deno:{}", deno.display()));
    }
    if let Ok(s) = crate::settings::load() {
        if let Some(path) = crate::settings::ytdlp_cookies_file(&s) {
            cmd.arg("--cookies");
            cmd.arg(path);
        } else if crate::settings::ytdlp_cookies_browser(&s.ytdlp_cookies_browser)
            == Some("firefox")
            && firefox_profile_exists()
        {
            cmd.arg("--cookies-from-browser");
            cmd.arg("firefox");
        }

        fn firefox_profile_exists() -> bool {
            let candidates = [
                std::env::var_os("APPDATA")
                    .map(std::path::PathBuf::from)
                    .map(|p| p.join("Mozilla").join("Firefox").join("Profiles")),
                std::env::var_os("LOCALAPPDATA")
                    .map(std::path::PathBuf::from)
                    .map(|p| {
                        p.join("Packages")
                            .join("Mozilla.Firefox_n80bbvh6b1yt2")
                            .join("LocalCache")
                            .join("Roaming")
                            .join("Mozilla")
                            .join("Firefox")
                            .join("Profiles")
                    }),
            ];
            candidates.into_iter().flatten().any(|profiles| {
                let Ok(entries) = std::fs::read_dir(profiles) else {
                    return false;
                };
                entries
                    .flatten()
                    .any(|entry| entry.path().join("cookies.sqlite").is_file())
            })
        }
    }
}

fn push_ffmpeg_location(cmd: &mut Command, ffmpeg: &Path) {
    if ffmpeg.is_file() {
        cmd.arg("--ffmpeg-location");
        cmd.arg(ffmpeg);
    }
}

fn push_ytdlp_network_defaults(cmd: &mut Command) {
    cmd.args([
        "--socket-timeout",
        "30",
        "--retries",
        "3",
        "--fragment-retries",
        "3",
        "--extractor-retries",
        "2",
    ]);
}

pub fn run_ffmpeg(args: &[&str]) -> Result<Output> {
    let tools = tool_paths()?;
    run_exe(&tools.ffmpeg, args, false)
}

pub fn spawn_ffmpeg(args: &[&str]) -> Result<Child> {
    let tools = tool_paths()?;
    let mut cmd = Command::new(&tools.ffmpeg);
    for arg in args {
        cmd.arg(arg);
    }
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.spawn().map_err(DollytError::from)
}

pub fn run_ffprobe(args: &[&str]) -> Result<Output> {
    let tools = tool_paths()?;
    run_exe(&tools.ffprobe, args, false)
}

fn run_exe(program: &Path, args: &[&str], ignore_config: bool) -> Result<Output> {
    let mut cmd = Command::new(program);
    if ignore_config {
        cmd.arg("--ignore-config");
    }
    for arg in args {
        cmd.arg(arg);
    }
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.output().map_err(DollytError::from)
}

pub(crate) fn kill_process_tree(pid: u32) {
    let mut cmd = Command::new("taskkill");
    cmd.args(["/PID", &pid.to_string(), "/T", "/F"]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let _ = cmd.status();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ytdlp_network_calls_have_bounded_timeouts_and_retries() {
        let mut command = Command::new("yt-dlp");
        push_ytdlp_network_defaults(&mut command);
        let args = command
            .get_args()
            .map(|value| value.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        assert_eq!(
            args,
            [
                "--socket-timeout",
                "30",
                "--retries",
                "3",
                "--fragment-retries",
                "3",
                "--extractor-retries",
                "2",
            ]
        );
    }

    #[test]
    fn ffmpeg_location_points_at_the_checked_binary() {
        let dir = std::env::temp_dir().join(format!("dollyt-ffmpeg-loc-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let ffmpeg = dir.join("ffmpeg.exe");
        std::fs::write(&ffmpeg, b"not-a-real-binary").unwrap();
        let mut command = Command::new("yt-dlp");
        push_ffmpeg_location(&mut command, &ffmpeg);
        let args = command
            .get_args()
            .map(|value| value.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(args.len(), 2);
        assert_eq!(args[0], "--ffmpeg-location");
        assert_eq!(args[1], ffmpeg.to_string_lossy());
    }
}

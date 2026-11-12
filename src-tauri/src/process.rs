use crate::bins::tools;
use crate::error::{DollytError, Result};
use std::path::Path;
use std::process::{Command, Output, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn run_ytdlp(args: &[&str]) -> Result<Output> {
    ytdlp_command(args).output().map_err(DollytError::from)
}

pub fn spawn_ytdlp(args: &[&str]) -> Result<std::process::Child> {
    let mut cmd = ytdlp_command(args);
    cmd.arg("--newline");
    cmd.arg("--progress-template");
    cmd.arg("download:%(progress._percent_str)s");
    cmd.spawn().map_err(DollytError::from)
}

fn ytdlp_command(args: &[&str]) -> Command {
    let mut cmd = Command::new(&tools().ytdlp);
    push_ytdlp_defaults(&mut cmd);
    for arg in args {
        cmd.arg(arg);
    }
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd
}

fn push_ytdlp_defaults(cmd: &mut Command) {
    cmd.arg("--ignore-config");
    let deno = &tools().deno;
    if deno.is_file() {
        cmd.arg("--js-runtimes");
        cmd.arg(format!("deno:{}", deno.display()));
    }
    cmd.arg("--extractor-args");
    cmd.arg("youtube:player_client=tv_embedded,ios,web");
    if let Ok(s) = crate::settings::load() {
        if let Some(path) = crate::settings::ytdlp_cookies_file(&s) {
            cmd.arg("--cookies");
            cmd.arg(path);
        } else if crate::settings::ytdlp_cookies_browser(&s.ytdlp_cookies_browser)
            == Some("firefox")
        {
            cmd.arg("--cookies-from-browser");
            cmd.arg("firefox");
        }
    }
}

pub fn run_ffmpeg(args: &[&str]) -> Result<Output> {
    run_exe(&tools().ffmpeg, args, false)
}

pub fn run_ffprobe(args: &[&str]) -> Result<Output> {
    run_exe(&tools().ffprobe, args, false)
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

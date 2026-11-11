use crate::bins::tools;
use crate::error::{DollytError, Result};
use std::path::Path;
use std::process::{Command, Output, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn run_ytdlp(args: &[&str]) -> Result<Output> {
    run_exe(&tools().ytdlp, args, true)
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

pub fn spawn_ytdlp(args: &[&str]) -> Result<std::process::Child> {
    let mut cmd = Command::new(&tools().ytdlp);
    cmd.arg("--ignore-config");
    cmd.arg("--newline");
    cmd.arg("--progress-template");
    cmd.arg("download:%(progress._percent_str)s");
    for arg in args {
        cmd.arg(arg);
    }
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.spawn().map_err(DollytError::from)
}

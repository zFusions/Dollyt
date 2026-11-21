!macro NSIS_HOOK_POSTINSTALL
  CreateDirectory "$LOCALAPPDATA\Dollyt\bin"
  DetailPrint "Installing Dollyt video tools to $LOCALAPPDATA\Dollyt\bin"

  ; Keep a newer yt-dlp installed through the in-app updater.
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\yt-dlp.exe" ytdlp_exists 0
  Goto install_ytdlp
ytdlp_exists:
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\yt-dlp.verified" ytdlp_done 0
install_ytdlp:
  DetailPrint "  Copying yt-dlp.exe"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\yt-dlp.exe" "$LOCALAPPDATA\Dollyt\bin\yt-dlp.exe"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\yt-dlp.exe" ytdlp_verify 0
  Goto runtime_tools_install_failed
ytdlp_verify:
  DetailPrint "  Copying yt-dlp.verified"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\yt-dlp.verified" "$LOCALAPPDATA\Dollyt\bin\yt-dlp.verified"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\yt-dlp.verified" ytdlp_done 0
  Goto runtime_tools_install_failed
ytdlp_done:

  DetailPrint "  Copying ffmpeg.exe"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffmpeg.exe" "$LOCALAPPDATA\Dollyt\bin\ffmpeg.exe"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\ffmpeg.exe" ffmpeg_verify 0
  Goto runtime_tools_install_failed
ffmpeg_verify:
  DetailPrint "  Copying ffmpeg.sha256"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffmpeg.sha256" "$LOCALAPPDATA\Dollyt\bin\ffmpeg.sha256"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\ffmpeg.sha256" ffmpeg_build 0
  Goto runtime_tools_install_failed
ffmpeg_build:
  DetailPrint "  Copying ffmpeg.build"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffmpeg.build" "$LOCALAPPDATA\Dollyt\bin\ffmpeg.build"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\ffmpeg.build" ffprobe_exe 0
  Goto runtime_tools_install_failed

ffprobe_exe:
  DetailPrint "  Copying ffprobe.exe"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffprobe.exe" "$LOCALAPPDATA\Dollyt\bin\ffprobe.exe"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\ffprobe.exe" ffprobe_verify 0
  Goto runtime_tools_install_failed
ffprobe_verify:
  DetailPrint "  Copying ffprobe.sha256"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffprobe.sha256" "$LOCALAPPDATA\Dollyt\bin\ffprobe.sha256"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\ffprobe.sha256" deno_exe 0
  Goto runtime_tools_install_failed

deno_exe:
  DetailPrint "  Copying deno.exe"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\deno.exe" "$LOCALAPPDATA\Dollyt\bin\deno.exe"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\deno.exe" deno_verify 0
  Goto runtime_tools_install_failed
deno_verify:
  DetailPrint "  Copying deno.sha256"
  CopyFiles /SILENT "$INSTDIR\runtime-tools\deno.sha256" "$LOCALAPPDATA\Dollyt\bin\deno.sha256"
  IfErrors runtime_tools_install_failed 0
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\deno.sha256" runtime_tools_install_done 0
  Goto runtime_tools_install_failed

runtime_tools_install_failed:
  DetailPrint "ERROR: Failed to copy video tools to $LOCALAPPDATA\Dollyt\bin"
  Abort "Dollyt could not install its video tools to $LOCALAPPDATA\Dollyt\bin. Check that you have write permissions and disk space, then run the installer again."
runtime_tools_install_done:
  DetailPrint "Video tools installed successfully"
!macroend

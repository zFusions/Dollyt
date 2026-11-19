!macro NSIS_HOOK_POSTINSTALL
  CreateDirectory "$LOCALAPPDATA\Dollyt\bin"

  ; Keep a newer yt-dlp installed through the in-app updater.
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\yt-dlp.exe" ytdlp_exists 0
  Goto install_ytdlp
ytdlp_exists:
  IfFileExists "$LOCALAPPDATA\Dollyt\bin\yt-dlp.verified" ytdlp_done 0
install_ytdlp:
  CopyFiles /SILENT "$INSTDIR\runtime-tools\yt-dlp.exe" "$LOCALAPPDATA\Dollyt\bin\yt-dlp.exe"
  IfErrors runtime_tools_install_failed 0
  CopyFiles /SILENT "$INSTDIR\runtime-tools\yt-dlp.verified" "$LOCALAPPDATA\Dollyt\bin\yt-dlp.verified"
  IfErrors runtime_tools_install_failed 0
ytdlp_done:

  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffmpeg.exe" "$LOCALAPPDATA\Dollyt\bin\ffmpeg.exe"
  IfErrors runtime_tools_install_failed 0
  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffmpeg.sha256" "$LOCALAPPDATA\Dollyt\bin\ffmpeg.sha256"
  IfErrors runtime_tools_install_failed 0
  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffmpeg.build" "$LOCALAPPDATA\Dollyt\bin\ffmpeg.build"
  IfErrors runtime_tools_install_failed 0

  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffprobe.exe" "$LOCALAPPDATA\Dollyt\bin\ffprobe.exe"
  IfErrors runtime_tools_install_failed 0
  CopyFiles /SILENT "$INSTDIR\runtime-tools\ffprobe.sha256" "$LOCALAPPDATA\Dollyt\bin\ffprobe.sha256"
  IfErrors runtime_tools_install_failed 0

  CopyFiles /SILENT "$INSTDIR\runtime-tools\deno.exe" "$LOCALAPPDATA\Dollyt\bin\deno.exe"
  IfErrors runtime_tools_install_failed 0
  CopyFiles /SILENT "$INSTDIR\runtime-tools\deno.sha256" "$LOCALAPPDATA\Dollyt\bin\deno.sha256"
  IfErrors runtime_tools_install_failed 0
  Goto runtime_tools_install_done

runtime_tools_install_failed:
  Abort "Dollyt could not install its video tools. Run the installer again."
runtime_tools_install_done:
!macroend

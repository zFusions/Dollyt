$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$outputDir = Join-Path $repoRoot "installer\runtime-tools"
$expected = @{
    YtdlpTag = "2026.10.26"
    YtdlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp.exe"
    YtdlpSha256 = "f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d"
    FfmpegBuild = "ffmpeg-n8.1.3-35-gf1acb0a266-win64-gpl-8.1"
    FfmpegUrl = "https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-11-12-15-40/ffmpeg-n8.1.3-35-gf1acb0a266-win64-gpl-8.1.zip"
    FfmpegSha256 = "688d6d2d33ff3b91ae15eb8be5660e7ccaec7d3170fb25f091c4972dcb447d9d"
    DenoUrl = "https://github.com/denoland/deno/releases/download/v2.9.8/deno-x86_64-pc-windows-msvc.zip"
    DenoSha256 = "cba84b26e0df5ae7f74fc66b86a95b866872a86292ebd84fa1e959927edd93bf"
}

function Get-Sha256([string] $Path) {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $digest = $algorithm.ComputeHash($stream)
        return ([System.BitConverter]::ToString($digest)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $stream.Dispose()
        $algorithm.Dispose()
    }
}

function Test-StagedTools {
    $minimumSizes = @{
        "yt-dlp.exe" = 10MB
        "ffmpeg.exe" = 100MB
        "ffprobe.exe" = 100MB
        "deno.exe" = 50MB
    }
    foreach ($entry in $minimumSizes.GetEnumerator()) {
        $path = Join-Path $outputDir $entry.Key
        if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Item -LiteralPath $path).Length -lt $entry.Value) {
            return $false
        }
    }

    foreach ($name in @("yt-dlp.verified", "ffmpeg.sha256", "ffmpeg.build", "ffprobe.sha256", "deno.sha256")) {
        if (-not (Test-Path -LiteralPath (Join-Path $outputDir $name) -PathType Leaf)) { return $false }
    }
    if ((Get-Content -LiteralPath (Join-Path $outputDir "yt-dlp.verified") -Raw).Trim() -ne $expected.YtdlpTag) { return $false }
    if ((Get-Content -LiteralPath (Join-Path $outputDir "ffmpeg.build") -Raw).Trim() -ne $expected.FfmpegBuild) { return $false }
    foreach ($name in @("ffmpeg", "ffprobe", "deno")) {
        $sidecar = (Get-Content -LiteralPath (Join-Path $outputDir "$name.sha256") -Raw).Trim()
        if ($sidecar -notmatch "^[0-9a-fA-F]{64}$") { return $false }
    }
    return $true
}

if (Test-StagedTools) {
    Write-Host "Runtime tools are already staged and verified."
    exit 0
}

$scratchName = "Dollyt-runtime-tools-$([guid]::NewGuid().ToString('N'))"
$scratchRoot = Join-Path ([System.IO.Path]::GetTempPath()) $scratchName
$scratchFull = [System.IO.Path]::GetFullPath($scratchRoot)
$tempFull = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\') + '\'
if (-not $scratchFull.StartsWith($tempFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to use a runtime staging path outside the temporary directory."
}
$null = New-Item -ItemType Directory -Path $scratchRoot

try {
    Write-Host "Downloading pinned yt-dlp, FFmpeg and Deno runtime tools..."
    $ytdlpArchive = Join-Path $scratchRoot "yt-dlp.exe"
    $ffmpegArchive = Join-Path $scratchRoot "ffmpeg.zip"
    $denoArchive = Join-Path $scratchRoot "deno.zip"
    Invoke-WebRequest -Uri $expected.YtdlpUrl -OutFile $ytdlpArchive -TimeoutSec 300
    Invoke-WebRequest -Uri $expected.FfmpegUrl -OutFile $ffmpegArchive -TimeoutSec 300
    Invoke-WebRequest -Uri $expected.DenoUrl -OutFile $denoArchive -TimeoutSec 300

    if ((Get-Sha256 $ytdlpArchive) -ne $expected.YtdlpSha256) { throw "yt-dlp SHA-256 verification failed." }
    if ((Get-Sha256 $ffmpegArchive) -ne $expected.FfmpegSha256) { throw "FFmpeg archive SHA-256 verification failed." }
    if ((Get-Sha256 $denoArchive) -ne $expected.DenoSha256) { throw "Deno archive SHA-256 verification failed." }

    $ffmpegExtract = Join-Path $scratchRoot "ffmpeg"
    $denoExtract = Join-Path $scratchRoot "deno"
    Expand-Archive -LiteralPath $ffmpegArchive -DestinationPath $ffmpegExtract
    Expand-Archive -LiteralPath $denoArchive -DestinationPath $denoExtract
    $ffmpegExe = @(Get-ChildItem -LiteralPath $ffmpegExtract -Filter "ffmpeg.exe" -File -Recurse)
    $ffprobeExe = @(Get-ChildItem -LiteralPath $ffmpegExtract -Filter "ffprobe.exe" -File -Recurse)
    $denoExe = @(Get-ChildItem -LiteralPath $denoExtract -Filter "deno.exe" -File -Recurse)
    if ($ffmpegExe.Count -ne 1 -or $ffprobeExe.Count -ne 1 -or $denoExe.Count -ne 1) {
        throw "Pinned runtime archive did not contain exactly one expected executable of each kind."
    }

    $null = New-Item -ItemType Directory -Force -Path $outputDir
    Copy-Item -LiteralPath $ytdlpArchive -Destination (Join-Path $outputDir "yt-dlp.exe") -Force
    Copy-Item -LiteralPath $ffmpegExe[0].FullName -Destination (Join-Path $outputDir "ffmpeg.exe") -Force
    Copy-Item -LiteralPath $ffprobeExe[0].FullName -Destination (Join-Path $outputDir "ffprobe.exe") -Force
    Copy-Item -LiteralPath $denoExe[0].FullName -Destination (Join-Path $outputDir "deno.exe") -Force

    Set-Content -LiteralPath (Join-Path $outputDir "yt-dlp.verified") -Value $expected.YtdlpTag -NoNewline -Encoding ascii
    Set-Content -LiteralPath (Join-Path $outputDir "ffmpeg.build") -Value $expected.FfmpegBuild -NoNewline -Encoding ascii
    foreach ($name in @("ffmpeg", "ffprobe", "deno")) {
        $exe = Join-Path $outputDir "$name.exe"
        Set-Content -LiteralPath (Join-Path $outputDir "$name.sha256") -Value (Get-Sha256 $exe) -NoNewline -Encoding ascii
    }

    if (-not (Test-StagedTools)) { throw "Staged runtime tools failed their final integrity checks." }
    Write-Host "Verified runtime tools are ready for the Dollyt Windows installer."
}
finally {
    if (Test-Path -LiteralPath $scratchFull) {
        $resolvedScratch = [System.IO.Path]::GetFullPath($scratchFull)
        if ($resolvedScratch.StartsWith($tempFull, [System.StringComparison]::OrdinalIgnoreCase) -and $resolvedScratch -match "Dollyt-runtime-tools-[a-f0-9]{32}$") {
            Remove-Item -LiteralPath $resolvedScratch -Recurse -Force
        }
    }
}

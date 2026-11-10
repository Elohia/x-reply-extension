param(
  [string]$Repo = "D:\dsh\x-reply-extension",
  [string]$Proxy = "http://127.0.0.1:7890",
  [switch]$Quiet
)
$ErrorActionPreference = "Continue"
$log = Join-Path $Repo "tools\update.log"
function Log($m) {
  $line = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + "  " + ([string]$m).Substring(0, [Math]::Min(300, ([string]$m).Length))
  Add-Content -Path $log -Value $line -Encoding utf8
  if (-not $Quiet) { Write-Host $line }
}
if (-not (Test-Path (Join-Path $Repo ".git"))) { Log "not a git repo"; exit 2 }
$env:HTTPS_PROXY = $Proxy
$env:HTTP_PROXY = $Proxy
Push-Location $Repo
try {
  $before = (git rev-parse HEAD).Trim()
  $vBefore = ((Get-Content manifest.json -Raw -Encoding UTF8) | ConvertFrom-Json).version
  git -c http.proxy=$Proxy fetch --all --prune 2>&1 | Out-Null
  git -c http.proxy=$Proxy pull --ff-only 2>&1 | Out-Null
  $after = (git rev-parse HEAD).Trim()
  $vAfter = ((Get-Content manifest.json -Raw -Encoding UTF8) | ConvertFrom-Json).version
  if ($before -ne $after) {
    Log ("updated: v" + $vBefore + " -> v" + $vAfter)
    Set-Content -Path (Join-Path $Repo "tools\NEED_RELOAD") -Value $vAfter -Encoding utf8
    $notify = Join-Path $Repo "tools\notify.ps1"
    if (Test-Path $notify) {
      Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", $notify, "-Version", $vAfter) -WindowStyle Hidden
    }
  } else {
    Log ("up to date: v" + $vAfter)
  }
} catch {
  Log ("error: " + $_.Exception.Message)
} finally {
  Pop-Location
}

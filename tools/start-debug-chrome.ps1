# 启动一个可被 CDP 接管的 Chrome（不动你日常那个 Chrome 的窗口）
# 用法：powershell -ExecutionPolicy Bypass -File tools\start-debug-chrome.ps1
# 之后 9222 端口就能被 CDP 连上，插件用 CDP 的 Extensions.loadUnpacked 装进去。
param(
  [int]$Port = 9222,
  [string]$Profile = "D:\dsh\x-reply-extension\tests\out\chrome-profile",
  [string]$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$ErrorActionPreference = "Stop"
$ext = Split-Path $PSScriptRoot -Parent
$env:TWITTER_AUTH_TOKEN = [Environment]::GetEnvironmentVariable("TWITTER_AUTH_TOKEN", "User")
$env:TWITTER_CT0 = [Environment]::GetEnvironmentVariable("TWITTER_CT0", "User")

if (-not (Test-Path $Chrome)) { throw "找不到 Chrome：$Chrome" }
if (-not (Test-Path "$Profile\Default\Cookies")) {
  Write-Host "profile 不完整，先从默认 profile 复制一份（只复制一次）"
  $src = "$env:LOCALAPPDATA\Google\Chrome\User Data"
  New-Item -ItemType Directory -Force -Path "$Profile\Default" | Out-Null
  Copy-Item "$src\Local State" "$Profile\Local State" -ErrorAction SilentlyContinue
  robocopy "$src\Default" "$Profile\Default" /E /XD Cache "Code Cache" GPUCache "Service Worker" DawnGraphiteCache DawnWebGPUCache ShaderCache "Media Cache" component_crx_cache GrShaderCache Crashpad /XF *.log /R:0 /W:0 /NFL /NDL /NJH /NJS | Out-Null
}

Get-CimInstance Win32_Process -Filter "name='chrome.exe'" |
  Where-Object { $_.CommandLine -like "*$Profile*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
@("SingletonLock", "SingletonCookie", "SingletonSocket", "lockfile", "Default\LOCK", "Default\lockfile") |
  ForEach-Object { Remove-Item -Force -Recurse (Join-Path $Profile $_) -ErrorAction SilentlyContinue }

$cmd = '"' + $Chrome + '" --remote-debugging-port=' + $Port + ' --user-data-dir="' + $Profile + '" --proxy-server=http://127.0.0.1:7890 --no-first-run --no-default-browser-check --window-size=1400,950 https://x.com/home'
# 用 WMI 起进程：父进程是 WmiPrvSE，脚本退出后浏览器不会跟着被回收
$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
Write-Host ("pid=" + $res.ProcessId)

for ($i = 0; $i -lt 40; $i++) {
  try { $v = Invoke-WebRequest "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 2; if ($v.StatusCode -eq 200) { Write-Host "CDP 就绪：http://127.0.0.1:$Port"; exit 0 } } catch {}
  Start-Sleep -Milliseconds 300
}
Write-Host "CDP 没起来：检查 Chrome 是否被其它实例占用，或 profile 路径"
exit 2

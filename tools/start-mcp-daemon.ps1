# 启动常驻 MCP 守护（只连一次 Chrome，之后一直复用）
param([int]$Port = 9777)
$ErrorActionPreference = "Stop"
$root = "D:\dsh\x-reply-extension"
$node = (Get-Command node).Source
$script = Join-Path $root "tools\mcp-daemon.mjs"

Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like "*mcp-daemon*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500

$cmd = '"' + $node + '" "' + $script + '"'
$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $root }
Write-Host ("daemon pid = " + $res.ProcessId)

for ($i = 0; $i -lt 80; $i++) {
  try { $h = Invoke-WebRequest ("http://127.0.0.1:" + $Port) -UseBasicParsing -TimeoutSec 2; if ($h.StatusCode -eq 200) { Write-Host "daemon ready"; break } } catch { }
  Start-Sleep -Milliseconds 500
}

$body = '{"name":"list_pages","args":{}}'
try {
  $r = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $Port + "/rpc") -Method Post -ContentType "application/json" -Body $body -TimeoutSec 120
  $r.text
} catch { Write-Host ("call failed: " + $_.Exception.Message) }

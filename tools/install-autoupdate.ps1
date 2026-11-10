# 注册自动更新计划任务（默认每 30 分钟）
param(
  [string]$Repo = "D:\\dsh\\x-reply-extension",
  [int]$EveryMinutes = 30
)
$ErrorActionPreference = "Stop"
$taskName = "XReplyExtension-AutoUpdate"
$script = Join-Path $Repo "tools\\auto-update.ps1"
if (-not (Test-Path $script)) { throw "找不到 $script" }
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '" -Quiet')
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "X 快速回复：每 $EveryMinutes 分钟从 GitHub 拉更新" | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host ("已注册并启动：" + $taskName + "（每 " + $EveryMinutes + " 分钟）")
Write-Host ("日志：" + (Join-Path $Repo "tools\\update.log"))

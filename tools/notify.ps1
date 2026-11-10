param([string]$Version = "")
Add-Type -AssemblyName System.Windows.Forms
$text = "X 快速回复已更新到 v" + $Version + [char]10 + [char]10 + "去 chrome://extensions 点这个扩展的 刷新，新版本就生效了。"
[System.Windows.Forms.MessageBox]::Show($text, "X 快速回复", "OK", "Information") | Out-Null

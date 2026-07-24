# เปิดเว็บดูในเครื่องตัวเอง — คลิกขวาที่ไฟล์นี้ แล้วเลือก "Run with PowerShell"
# จากนั้นเปิดเบราว์เซอร์ไปที่ http://localhost:8080
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8080

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host ""
Write-Host "  เว็บเปิดแล้วที่  http://localhost:$port" -ForegroundColor Green
Write-Host "  กด Ctrl+C เพื่อปิดเซิร์ฟเวอร์" -ForegroundColor DarkGray
Write-Host ""

$mime = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".js"="application/javascript; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".webp"="image/webp";
  ".svg"="image/svg+xml"; ".ico"="image/x-icon"; ".xml"="application/xml"; ".txt"="text/plain; charset=utf-8";
  ".yml"="text/yaml; charset=utf-8"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    if ($path.EndsWith("/")) { $path += "index.html" }
    $file = Join-Path $root ($path.TrimStart("/") -replace "/", "\")

    if (Test-Path $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - ไม่พบไฟล์ $path")
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}

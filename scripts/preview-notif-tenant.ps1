param(
  [string]$Kode,
  [string]$Pin,
  [string]$BaseUrl = 'https://danus-in4days.vercel.app'
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $Kode) { $Kode = Read-Host 'Kode tenant (contoh TP-0004)' }
if (-not $Pin) { $Pin = Read-Host 'PIN dashboard' }

$jar = Join-Path $env:TEMP 'danus-cookies.txt'
$tmp = Join-Path $env:TEMP 'danus-out.json'
$body = Join-Path $env:TEMP 'danus-login.json'

try {
  Remove-Item -LiteralPath $jar,$tmp,$body -ErrorAction SilentlyContinue
  @{ pin = $Pin } | ConvertTo-Json -Compress | Set-Content -LiteralPath $body -Encoding ASCII

  curl.exe -4 -sS --max-time 30 --fail -c $jar -H 'Content-Type: application/json' --data-binary "@$body" -o $tmp "$BaseUrl/api/auth/pin"
  if ($LASTEXITCODE -ne 0) { throw 'Login gagal. Cek PIN dan koneksi internet.' }

  curl.exe -4 -sS --max-time 30 --fail -b $jar -o $tmp "$BaseUrl/api/tenants"
  if ($LASTEXITCODE -ne 0) { throw 'Gagal mengambil daftar tenant.' }
  $tenants = Get-Content -LiteralPath $tmp -Raw -Encoding UTF8 | ConvertFrom-Json

  $tenant = $tenants | Where-Object { $_.kode_stand -eq $Kode } | Select-Object -First 1
  if (-not $tenant) {
    Write-Host "Kode $Kode tidak ditemukan. Kode tersedia: $($tenants.kode_stand -join ', ')" -ForegroundColor Red
    return
  }

  curl.exe -4 -sS --max-time 30 --fail -b $jar -o $tmp "$BaseUrl/api/tenants/$($tenant.id)/notif-preview"
  if ($LASTEXITCODE -ne 0) { throw 'Gagal mengambil preview notifikasi.' }
  $preview = Get-Content -LiteralPath $tmp -Raw -Encoding UTF8 | ConvertFrom-Json

  foreach ($item in $preview) {
    $pesan = $item.pesan.Replace([char]0x00A0, ' ').Replace([char]0x202F, ' ')
    Write-Output "`n===== $($item.jenis) =====`n$pesan`n"
  }
} finally {
  Remove-Item -LiteralPath $jar,$tmp,$body -ErrorAction SilentlyContinue
}

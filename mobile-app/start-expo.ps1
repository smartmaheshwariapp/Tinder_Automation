#!/usr/bin/env pwsh
# start-expo.ps1 — Auto-detects LAN IP and starts Expo with it
# Works on Wi-Fi, Ethernet, Mobile Hotspot, USB tethering — any adapter.
# Usage: .\start-expo.ps1 [--clear]

# Get all IPv4 addresses that are real LAN IPs (not loopback, not APIPA, not WSL/Docker virtual)
$allIPs = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -ne '127.0.0.1' -and
    $_.IPAddress -notmatch '^169\.254\.' -and          # APIPA (no DHCP)
    $_.IPAddress -notmatch '^172\.(1[6-9]|2[0-9]|3[01])\.' -and  # WSL/Docker virtual ranges
    $_.PrefixOrigin -ne 'WellKnown'                    # skip loopback
}

# Priority order: Wi-Fi > Ethernet > anything else
$wifiIp = ($allIPs | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Wireless|WLAN' } | Select-Object -First 1).IPAddress
$ethIp  = ($allIPs | Where-Object { $_.InterfaceAlias -match 'Ethernet|LAN' }       | Select-Object -First 1).IPAddress
$anyIp  = ($allIPs | Where-Object { $_.IPAddress -match '^192\.168\.|^10\.' }        | Select-Object -First 1).IPAddress

$ip = if ($wifiIp) { $wifiIp } elseif ($ethIp) { $ethIp } elseif ($anyIp) { $anyIp } else { $null }

if (-not $ip) {
    Write-Host "[start-expo] WARNING: Could not detect any LAN IP, falling back to localhost" -ForegroundColor Yellow
    Write-Host "[start-expo] Phone connection will NOT work over localhost." -ForegroundColor Yellow
    $ip = "127.0.0.1"
} else {
    Write-Host "[start-expo] Detected LAN IP: $ip" -ForegroundColor Cyan
}

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
$env:NODE_OPTIONS = "--max-old-space-size=4096"

# Pass through all arguments (--clear, etc.)
if ($args -contains "--clear") {
    npx expo start --clear
} else {
    npx expo start
}

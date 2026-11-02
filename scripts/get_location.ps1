Add-Type -AssemblyName System.Device
$watcher = New-Object System.Device.Location.GeoCoordinateWatcher(1)
$watcher.Start()
$count = 0
while (($watcher.Status -ne [System.Device.Location.GeoPositionStatus]::Ready) -and ($count -lt 60)) {
    Start-Sleep -Milliseconds 100
    $count++
}

$lat = $watcher.Position.Location.Latitude
$lon = $watcher.Position.Location.Longitude
$acc = $watcher.Position.Location.HorizontalAccuracy
$alt = $watcher.Position.Location.Altitude
$status = $watcher.Status.ToString()

$watcher.Stop()
$watcher.Dispose()

$result = [PSCustomObject]@{
    Status = $status
    Latitude = $lat
    Longitude = $lon
    Accuracy = $acc
    Altitude = $alt
}

$result | ConvertTo-Json -Compress

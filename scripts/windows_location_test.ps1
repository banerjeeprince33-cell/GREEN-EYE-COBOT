Add-Type -AssemblyName System.Device
$watcher = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::High)
$watcher.Start()
$count = 0
while ($watcher.Status -ne [System.Device.Location.GeoPositionStatus]::Ready -and $count -lt 25) {
    Start-Sleep -Milliseconds 200
    $count++
}
$loc = $watcher.Position.Location
$result = [PSCustomObject]@{
    Status = $watcher.Status.ToString()
    Permission = $watcher.Permission.ToString()
    Latitude = $loc.Latitude
    Longitude = $loc.Longitude
    Accuracy = $loc.HorizontalAccuracy
    Altitude = $loc.Altitude
    IsUnknown = $loc.IsUnknown
}
$watcher.Stop()
$result | ConvertTo-Json

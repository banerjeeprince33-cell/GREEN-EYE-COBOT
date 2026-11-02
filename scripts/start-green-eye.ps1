# Fieldwatch / Green Eye Automation Script
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host "Project Root: $ProjectRoot" -ForegroundColor DarkGray
Write-Host 'Starting Green Eye API and dashboard...' -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$ProjectRoot'; npm start"

Start-Sleep -Seconds 2

Write-Host 'Starting YOLO wildlife detector (human, lion, tiger, deer, dog, rhinoceros, leopard, monkeys)...' -ForegroundColor Green
$detector = "python .\ai_vision\yolo_detector.py --model yolov8m-worldv2.pt --world --webcam --conf 0.15 --max-det 20 --interval 0.08 --imgsz 640 --store-interval 3"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$ProjectRoot'; $detector"

Start-Process 'http://localhost:3000'
Write-Host 'Dashboard: http://localhost:3000' -ForegroundColor Cyan
Write-Host 'Close the Python window or press Q in its preview to stop detection.' -ForegroundColor Yellow

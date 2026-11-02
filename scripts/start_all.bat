@echo off
setlocal
title Fieldwatch - All Systems Start

:: Always resolve and change directory to the project root
cd /d "%~dp0\.."

echo ======================================================================
echo  STARTING FIELDWATCH DASHBOARD + YOLO OBJECT DETECTOR
echo ======================================================================
echo  Project Root: %CD%
echo ======================================================================
start "Fieldwatch Web Server" cmd /k "npm start"
timeout /t 2 /nobreak >nul
start "YOLO Wildlife & Object Detector" cmd /k "python ai_vision\yolo_detector.py --webcam --world --conf 0.20 --interval 0.05"
timeout /t 1 /nobreak >nul
start http://localhost:3000

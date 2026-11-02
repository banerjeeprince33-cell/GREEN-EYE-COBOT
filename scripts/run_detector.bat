@echo off
setlocal
title Green Eye YOLO Wildlife & Object Detector

:: Always resolve and change directory to the project root
cd /d "%~dp0\.."

echo ======================================================================
echo  STARTING GREEN EYE YOLO WILDLIFE & OBJECT DETECTOR
echo ======================================================================
echo  Detected Classes: Human, Tiger, Lion, Deer, Rhino, Leopard, Elephant, Monkeys, Dog
echo  Camera Source:    Laptop Webcam (Index 0)
echo  Stream Endpoint:  http://localhost:5001/video
echo  Project Root:     %CD%
echo ======================================================================
python ai_vision\yolo_detector.py --webcam --world --conf 0.20 --interval 0.05
pause

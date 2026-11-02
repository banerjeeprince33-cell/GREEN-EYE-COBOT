# GREEN-EYE-COBOT: Wildlife Monitoring Console

GREEN-EYE-COBOT is an AI-powered wildlife monitoring rover designed to reduce human-wildlife conflict. It uses YOLOv8 and OpenCV for real-time animal detection, ultrasonic and LiDAR sensors for obstacle avoidance, and GPS-GSM for location-based alerts. A local-first web dashboard enables wildlife monitoring, telemetry collection, and field station status in one operator console.

---

## Project Directory Structure

```
SIH/
├── .env.example                     # Environment template
├── .gitignore                       # Complete ignore configuration (node, python, os, logs)
├── index.html                       # Direct dashboard launcher entrypoint
├── package.json                     # Root workspace orchestrator and npm scripts
├── package-lock.json
├── README.md                        # Primary project documentation
│
├── ai_vision/                       # Computer Vision & YOLOv8 Engine
│   ├── dataset/                     # YOLO annotations & dataset
│   ├── weights/                     # Pre-trained & fine-tuned model checkpoints (.pt)
│   ├── yolo_detector.py             # Real-time multi-species detector & MJPEG server
│   ├── train_yolo.py                # Model training pipeline
│   ├── prepare_and_train.py         # Automated dataset download & prep
│   ├── requirements.txt             # Vision Python dependencies
│   ├── requirements-vision.txt      # Legacy alias
│   └── README.md                    # Vision setup and CLI reference
│
├── backend/                         # Node.js & Express REST API
│   ├── server.js                    # REST API, SSE telemetry stream & persistence
│   ├── package.json                 # API service package configuration
│   └── README.md                    # API endpoints & authentication documentation
│
├── database/                        # Persistence Layer & Offline Data
│   ├── data/                        # Active runtime data (offline fail-safe)
│   │   ├── detections.json
│   │   └── telemetry_logs.json
│   ├── seeds/                       # Reference seed fixtures
│   │   └── default_detections.json
│   └── README.md                    # MongoDB schemas & offline fail-safe docs
│
├── frontend/                        # Web Dashboard UI & Assets
│   ├── index.html                   # Dashboard shell and accessible controls
│   ├── style.css                    # Dashboard layout and responsive styling
│   ├── app.js                       # Frontend controller, Web Serial & radar HUD
│   ├── camera-config.js             # ESP32-CAM stream configuration
│   ├── assets/                      # Sample wildlife test images
│   └── README.md                    # Frontend documentation
│
├── hardware_iot/                    # Microcontroller Firmware & Serial Bridges
│   ├── firmware/
│   │   ├── arduino_ultrasonic_radar/
│   │   │   └── arduino_ultrasonic_radar.ino   # Arduino Uno/Nano firmware
│   │   ├── esp32_cam/
│   │   │   └── esp32_cam.ino                 # ESP32-CAM Wi-Fi streaming sketch
│   │   └── esp32_ultrasonic_radar_wifi/
│   │       └── esp32_ultrasonic_radar_wifi.ino # Battery-powered Wi-Fi radar
│   ├── bridge/
│   │   ├── ultrasonic_bridge.py               # USB-Serial to HTTP/SSE radar bridge
│   │   └── requirements.txt                   # Serial bridge dependencies
│   ├── ultrasonic_bridge.py                   # Backward-compatible entrypoint shim
│   └── README.md                              # Hardware wiring, pinouts & flashing guide
│
└── scripts/                         # Unified Automation & Launchers
    ├── start_all.bat                # 1-click launcher for dashboard + YOLO + browser
    ├── run_detector.bat             # Standalone webcam detector launcher
    └── start-green-eye.ps1          # PowerShell automation script
```

---

## Quick Start

### 1. Launch All Systems (1-Click)
Run the launcher batch file or PowerShell script:
```powershell
.\scripts\start_all.bat
```
or via PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start-green-eye.ps1
```
or via npm:
```powershell
npm run start:all
```
This automatically starts:
1. Node.js backend server (`http://localhost:3000`)
2. YOLOv8 Wildlife Object Detector on webcam (`http://localhost:5001/video`)
3. Opens the Fieldwatch dashboard in your browser.

---

## Component Setup & Manual Running

### Backend Server
```powershell
# From project root
npm install
npm start
```
* Dashboard URL: `http://localhost:3000`
* REST Endpoints: `/api/health`, `/api/detections`, `/api/telemetry`, `/api/database/status`
* Telemetry Stream (SSE): `/api/telemetry/stream`

### AI Vision Detector
```powershell
# Install vision requirements
pip install -r ai_vision/requirements.txt

# Run multi-species detector with webcam
python ai_vision/yolo_detector.py --model yolov8m-worldv2.pt --world --webcam --conf 0.15

# Or via npm script:
npm run vision
```

### Ultrasonic Radar (Arduino HC-SR04)
1. Open `hardware_iot/firmware/arduino_ultrasonic_radar/arduino_ultrasonic_radar.ino` in Arduino IDE and upload to Arduino Uno/Nano.
2. Connect HC-SR04:
   - `VCC` &rarr; `5V`
   - `GND` &rarr; `GND`
   - `TRIG` &rarr; `Pin 9`
   - `ECHO` &rarr; `Pin 10`
3. Connect SG90 180&deg; servo:
   - Signal (Orange/Yellow) &rarr; `Pin 6`
   - Servo 5V (Red) &rarr; Regulated external `5V` supply
   - Servo GND (Brown/Black) &rarr; Common Arduino + power supply `GND`
4. In the browser dashboard, click **"Connect USB Serial"** (Web Serial API at 115200 baud), OR run:
```powershell
python hardware_iot/bridge/ultrasonic_bridge.py --baud 115200
```

### ESP32-CAM Stream Setup
1. Open `hardware_iot/firmware/esp32_cam/esp32_cam.ino` in Arduino IDE. Select board **AI Thinker ESP32-CAM**, set Wi-Fi credentials, and upload.
2. Note the ESP32-CAM IP address printed in Serial Monitor, then set `useLiveCamera: true` and `esp32CamStreamUrl: 'http://CAMERA_IP:81/stream'` in `frontend/camera-config.js`.

### Battery-Powered ESP32 Ultrasonic Radar
1. Open `hardware_iot/firmware/esp32_ultrasonic_radar_wifi/esp32_ultrasonic_radar_wifi.ino` in Arduino IDE and install the **ESP32Servo** library from Library Manager.
2. Enter Wi-Fi credentials and the target laptop IP address in `TELEMETRY_URL`.
3. Wire HC-SR04 `TRIG` to GPIO 18, and `ECHO` to GPIO 19 through a 5V-to-3.3V logic level converter or resistor divider. Wire SG90 signal to GPIO 23 with external 5V power and common ground.
4. Upload sketch and start backend (`npm start`). The ESP32 will stream polar sweeps over Wi-Fi directly to the dashboard.

---

## Technical Features
* **Zero-Cloud Local Fail-Safe:** Automatically uses `database/data/*.json` when MongoDB is offline.
* **Dual AI Engine:** High-performance Python YOLOv8 + Zero-dependency in-browser TensorFlow.js edge model.
* **Acoustic Deterrence Siren:** Real-time Web Audio API synthesized alarm for apex predators (Tigers, Lions, Leopards, Bears).
* **Multi-Node Telemetry:** 180° polar radar sweep, autonomous rover mission control, and tactical Cyber HUD vector field mapping.

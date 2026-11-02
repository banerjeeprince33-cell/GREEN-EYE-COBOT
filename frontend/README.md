# Frontend Dashboard Subsystem

Fieldwatch Wildlife Monitoring Console — an operations dashboard for wildlife researchers and field officers.

---

## Directory Structure

```
frontend/
├── index.html                       # Semantic dashboard markup and control panels
├── style.css                        # Responsive dark-mode styling and animations
├── app.js                           # Dashboard application controller
├── camera-config.js                 # ESP32-CAM live stream settings
├── assets/                          # Static imagery & test samples
└── README.md                        # Subsystem documentation
```

---

## Features

- **180° Polar Radar Display:** Real-time canvas rendering of ultrasonic sweeps with obstacle detection blips, distance arc guides, and angle indicators. Supports direct browser **Web Serial API** (115200 baud) and Server-Sent Events (SSE) from the backend.
- **Dual AI Video Pipeline:**
  - **Live YOLO Stream:** High-performance MJPEG stream from the local Python YOLOv8 engine (`:5001/video`).
  - **In-Browser Fallback:** Edge client TensorFlow.js multi-species classification when Python detector is offline.
  - **ESP32-CAM Feed:** Direct hardware IP camera streaming (`http://<ESP32-CAM-IP>:81/stream`).
- **Acoustic Deterrence Siren:** Real-time Web Audio API synthesized warning siren triggered on apex predator detection (Tigers, Lions, Leopards, Bears).
- **Interactive Tactical Field Map:** Vector Cyber HUD mapping displaying wildlife sensor node locations and sector alerts.
- **Mission Control Logs:** Real-time tabular logs with sorting, filtering, and export capabilities.

---

## Configuration (`camera-config.js`)

To switch video source to an external ESP32-CAM:
```javascript
window.CAMERA_CONFIG = {
  useLiveCamera: true,
  esp32CamStreamUrl: 'http://192.168.1.100:81/stream'
};
```

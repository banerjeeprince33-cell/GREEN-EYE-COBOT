# Hardware & IoT Subsystem

Firmware sketches for microcontrollers (Arduino & ESP32) and USB-Serial bridges for the Fieldwatch wildlife console.

---

## Directory Structure

```
hardware_iot/
├── firmware/
│   ├── arduino_ultrasonic_radar/
│   │   └── arduino_ultrasonic_radar.ino       # Arduino Uno/Nano HC-SR04 + Servo radar
│   ├── esp32_cam/
│   │   └── esp32_cam.ino                     # AI Thinker ESP32-CAM MJPEG Wi-Fi streamer
│   └── esp32_ultrasonic_radar_wifi/
│       └── esp32_ultrasonic_radar_wifi.ino   # Battery-powered ESP32 Wi-Fi radar
│
├── bridge/
│   ├── ultrasonic_bridge.py                   # Host serial-to-HTTP/SSE radar bridge
│   └── requirements.txt                       # Bridge dependencies (pyserial)
│
├── ultrasonic_bridge.py                       # Backward-compatible entrypoint shim
└── README.md                                  # Hardware & wiring documentation
```

---

## Firmware Modules

### 1. Arduino Ultrasonic Radar (`firmware/arduino_ultrasonic_radar/`)
Sweeps a 180° arc using a micro-servo (SG90) while reading distance from an HC-SR04 ultrasonic sensor. Streams `angle,distance` over USB Serial at **115200 baud**.

**Wiring (Arduino Uno / Nano):**
- **HC-SR04 VCC** &rarr; Arduino `5V`
- **HC-SR04 GND** &rarr; Arduino `GND`
- **HC-SR04 TRIG** &rarr; Digital Pin `9`
- **HC-SR04 ECHO** &rarr; Digital Pin `10`
- **SG90 Servo Signal** (Orange/Yellow) &rarr; Digital Pin `6`
- **SG90 Servo Power** (Red) &rarr; External regulated `5V` supply (do not draw from Uno 5V pin directly)
- **SG90 Servo Ground** (Brown/Black) &rarr; Common GND (Arduino GND + power supply GND)

### 2. ESP32-CAM MJPEG Streamer (`firmware/esp32_cam/`)
Configures the OV2640 camera on an **AI Thinker ESP32-CAM** board to serve a low-latency MJPEG video stream at `http://<ESP32-CAM-IP>/stream`.

**Flashing Instructions:**
1. Open `firmware/esp32_cam/esp32_cam.ino` in Arduino IDE.
2. Select Board: **AI Thinker ESP32-CAM**.
3. Set your Wi-Fi SSID and password in the sketch.
4. Upload via FTDI / USB-to-TTL programmer (tie GPIO 0 to GND during flash).
5. Open Serial Monitor at 115200 baud to retrieve the assigned IP address.
6. Configure `frontend/camera-config.js` with your ESP32-CAM stream URL.

### 3. ESP32 Battery-Powered Wi-Fi Radar (`firmware/esp32_ultrasonic_radar_wifi/`)
A wireless field radar unit running on an ESP32 DevKit. Performs autonomous 0°–180° sweeps and sends JSON HTTP POST telemetry directly to `/api/telemetry` over Wi-Fi.

**Dependencies:** Install **ESP32Servo** from the Arduino Library Manager.

**Wiring (ESP32 DevKit):**
- **HC-SR04 TRIG** &rarr; GPIO `18`
- **HC-SR04 ECHO** &rarr; GPIO `19` (*via 5V-to-3.3V logic level converter or resistor divider*)
- **SG90 Signal** &rarr; GPIO `23`
- **SG90 Power** &rarr; External regulated `5V` supply with shared ground.

---

## Python Serial Bridge (`bridge/`)

For systems without browser Web Serial API support or running headless on field stations:

```powershell
# Install requirements
pip install -r hardware_iot/bridge/requirements.txt

# Run auto-detect mode (auto-discovers Arduino COM port)
python hardware_iot/bridge/ultrasonic_bridge.py

# Or run the simulated sweep generator
python hardware_iot/bridge/ultrasonic_bridge.py --sim
```

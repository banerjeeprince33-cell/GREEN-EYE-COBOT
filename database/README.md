# Database & Persistence Subsystem

Dual-mode data layer for Fieldwatch: full-featured MongoDB when connected, with an automatic zero-cloud local JSON fail-safe for offline field operations.

---

## Directory Structure

```
database/
├── data/                            # Runtime persistent JSON data (active logs)
│   ├── detections.json              # Real-time wildlife sightings log
│   └── telemetry_logs.json          # Ultrasonic radar & rover telemetry sweeps
│
├── seeds/                           # Fixtures for database initialization
│   └── default_detections.json      # Reference seed records
│
└── README.md                        # Documentation & schema reference
```

---

## Persistence Modes

### 1. MongoDB (Primary)
- **Default URI:** `mongodb://127.0.0.1:27017`
- **Database Name:** `green_eye`
- **Collections:**
  - `detections`: Wildlife identification events with timestamps, coordinates, animal species, confidence scores, and bounding telemetry.
  - `telemetry`: High-frequency ultrasonic radar sweeps, angles, obstacle flags, and sensor source IDs.

### 2. Local File-Based Fail-Safe (Zero-Cloud Mode)
- When MongoDB is unreachable, the backend automatically falls back to `database/data/detections.json` and `database/data/telemetry_logs.json`.
- All writes are asynchronously debounced to prevent disk I/O bottlenecks during 10Hz radar sweeps.
- When MongoDB comes back online, new writes continue to be saved locally as well as streamed live to connected operators.

---

## Data Schemas

### Detection Record (`detections`)
```json
{
  "_id": "det_1788766727759_blawuq",
  "animal": "Asian elephant",
  "species": "Elephas maximus",
  "symbol": "🐘",
  "location": "North trail (Node 04)",
  "latitude": "11.6824 N",
  "longitude": "76.3721 E",
  "altitude": "842 m",
  "date": "27 Aug 2026",
  "time": "09:40:52",
  "confidence": "98.4%",
  "source": "YOLO / GE-01",
  "distanceCm": 320,
  "angle": 90,
  "createdAt": "2026-08-27T09:40:52.000Z"
}
```

### Telemetry Record (`telemetry`)
```json
{
  "distanceCm": 24.5,
  "angle": 92.0,
  "obstacle": true,
  "source": "Arduino (COM3)",
  "timestamp": 1788766727.759
}
```

# Backend API Subsystem

Node.js & Express REST API server providing real-time telemetry streaming (Server-Sent Events), wildlife detection persistence, researcher authentication, and static frontend hosting.

---

## Directory Structure

```
backend/
├── server.js                        # Primary Express server & API routes
├── package.json                     # API service dependencies & scripts
└── README.md                        # API endpoints & documentation
```

---

## Running the Backend

From the project root:
```powershell
# Production mode
npm start

# Development mode (auto-reloads on changes)
npm run dev
```

---

## REST Endpoints Reference

### Authentication
- `POST /api/auth/login`: Authenticate field researcher via ID/Email and password.
- `GET /api/auth/me`: Retrieve current operator session profile.

### Wildlife Detections
- `GET /api/detections`: Fetch recent detection logs (supports `?limit=50`).
- `POST /api/detections`: Ingest a detection event from YOLO vision engine or edge client.
- `DELETE /api/detections/:id`: Remove a detection record.
- `DELETE /api/detections`: Clear all detection logs.

### Ultrasonic & Sensor Telemetry
- `GET /api/telemetry`: Get latest angle, distance, and obstacle status.
- `POST /api/telemetry`: Ingest high-frequency polar sweep telemetry from Arduino or ESP32.
- `GET /api/telemetry/stream`: Real-time Server-Sent Events (SSE) stream for live radar rendering.
- `GET /api/telemetry/history`: Fetch time-series sweep logs.

### System & Health
- `GET /api/health`: Health status, uptime, memory, and database connectivity.
- `GET /api/database/status`: Status of MongoDB connection vs local JSON fail-safe fallback.

---

## Environment Variables

Configured in the project root `.env` (or `backend/.env`):
- `PORT`: HTTP port for Express server (default: `3000`).
- `MONGODB_URI`: MongoDB connection string (default: `mongodb://127.0.0.1:27017`).
- `MONGODB_DATABASE`: Target MongoDB database (default: `green_eye`).
- `FIELD_LOCATION`: Field station descriptor.

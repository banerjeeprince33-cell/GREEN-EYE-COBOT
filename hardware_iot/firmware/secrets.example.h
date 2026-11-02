/**
 * Fieldwatch Green Eye Cobot - Hardware Firmware Secrets Template
 * 
 * Instructions:
 * 1. Copy this file as 'secrets.h' inside your specific firmware directory:
 *    - hardware_iot/firmware/esp32_ultrasonic_radar_wifi/secrets.h
 *    - hardware_iot/firmware/esp32_cam/secrets.h
 * 2. Fill in your actual field station Wi-Fi and hardware authentication credentials.
 * 3. Note: 'secrets.h' is explicitly ignored by .gitignore and will not be committed.
 */

#ifndef FIELDWATCH_SECRETS_H
#define FIELDWATCH_SECRETS_H

// Station Wi-Fi Credentials
#define WIFI_SSID "YOUR_FIELD_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_FIELD_WIFI_PASSWORD"

// Green Eye Hardware Sensor Ingestion Key (matches backend HARDWARE_KEY in .env)
#define HARDWARE_KEY "fw_node_internal_telemetry_key_2026"

// Local Backend Server Telemetry Endpoint
#define TELEMETRY_URL "http://192.168.1.50:3000/api/telemetry"

#endif // FIELDWATCH_SECRETS_H

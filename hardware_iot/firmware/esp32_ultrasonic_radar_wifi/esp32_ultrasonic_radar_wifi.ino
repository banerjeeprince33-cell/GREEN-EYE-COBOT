/*
 * Fieldwatch ESP32 Wi-Fi Ultrasonic Radar (Hardened)
 *
 * Runs on ESP32 DevKit, measures polar radar sweep via HC-SR04 + SG90 Servo,
 * and posts authenticated JSON telemetry to the Fieldwatch dashboard.
 *
 * Install "ESP32Servo" library in Arduino IDE Library Manager.
 *
 * Wiring (ESP32 DevKit):
 *   HC-SR04 VCC  -> 5V
 *   HC-SR04 GND  -> GND (common ground)
 *   HC-SR04 TRIG -> GPIO 18
 *   HC-SR04 ECHO -> GPIO 19 (via 5V-to-3.3V voltage divider)
 *   SG90 Signal  -> GPIO 23
 *   SG90 VCC     -> external regulated 5V
 *   SG90 GND     -> common ground
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

// Include local gitignored credentials if available
#if __has_include("secrets.h")
#include "secrets.h"
#endif

// Fallback placeholder credentials (override in secrets.h or build flags)
#ifndef WIFI_SSID
#define WIFI_SSID "YOUR_FIELD_WIFI_SSID"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "YOUR_FIELD_WIFI_PASSWORD"
#endif
#ifndef HARDWARE_KEY
#define HARDWARE_KEY "fw_node_internal_telemetry_key_2026"
#endif
#ifndef TELEMETRY_URL
#define TELEMETRY_URL "http://192.168.1.50:3000/api/telemetry"
#endif

const char* WIFI_SSID_STR = WIFI_SSID;
const char* WIFI_PASSWORD_STR = WIFI_PASSWORD;
const char* BACKEND_TELEMETRY_URL = TELEMETRY_URL;
const char* HARDWARE_TOKEN = HARDWARE_KEY;

const int TRIG_PIN = 18;
const int ECHO_PIN = 19;
const int SERVO_PIN = 23;

const int MIN_ANGLE = 0;
const int MAX_ANGLE = 180;
const int STEP_DEGREES = 2;
const unsigned long SERVO_SETTLE_MS = 25;
const unsigned long POST_INTERVAL_MS = 100; // Limit telemetry rate to <= 10 updates/second
const unsigned long SENSOR_TIMEOUT_US = 26000; // ~4.5m acoustic pulse timeout

Servo radarServo;
int sweepAngle = MIN_ANGLE;
int sweepDirection = STEP_DEGREES;
unsigned long lastPostAt = 0;
unsigned long rateLimitBackoffUntil = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID_STR, WIFI_PASSWORD_STR);
  Serial.print("[WiFi] Connecting to station network...");

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 8000) {
    delay(250);
    Serial.print('.');
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("\n[WiFi] Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection pending; continuing radar scan in background.");
  }
}

float measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(ECHO_PIN, HIGH, SENSOR_TIMEOUT_US);
  if (duration == 0) return 400.0;
  
  float dist = (duration * 0.0343) / 2.0;
  if (dist < 0.5 || dist > 450.0 || isnan(dist) || isinf(dist)) {
    return 400.0;
  }
  return dist;
}

void postTelemetry(float distanceCm, int angle) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (millis() < rateLimitBackoffUntil) return;

  HTTPClient http;
  http.begin(BACKEND_TELEMETRY_URL);
  http.setTimeout(1200);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Hardware-Token", HARDWARE_TOKEN);

  const bool obstacle = (distanceCm > 0.5 && distanceCm <= 40.0);
  char jsonBuffer[192];
  snprintf(jsonBuffer, sizeof(jsonBuffer),
    "{\"distanceCm\":%.1f,\"angle\":%d,\"obstacle\":%s,\"source\":\"ESP32 Wi-Fi Radar\"}",
    distanceCm, angle, obstacle ? "true" : "false"
  );

  const int statusCode = http.POST((uint8_t*)jsonBuffer, strlen(jsonBuffer));
  if (statusCode == 429) {
    rateLimitBackoffUntil = millis() + 2500;
    Serial.println("[HTTP] Rate limited (429), backing off...");
  } else if (statusCode == 401 || statusCode == 403) {
    rateLimitBackoffUntil = millis() + 5000;
    Serial.println("[SECURITY] Telemetry rejected (401/403): Verify X-Hardware-Token.");
  } else if (statusCode < 200 || statusCode >= 300) {
    // Other errors
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  radarServo.setPeriodHertz(50);
  radarServo.attach(SERVO_PIN, 500, 2400);
  radarServo.write(sweepAngle);
  delay(500);

  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 15000) {
      lastReconnectAttempt = millis();
      connectWiFi();
    }
  }

  radarServo.write(sweepAngle);
  delay(SERVO_SETTLE_MS);
  const float distanceCm = measureDistanceCm();

  // Output sanitized polar reading to local Serial for hardware debugging
  Serial.printf("%d,%.1f\n", sweepAngle, distanceCm);

  if (millis() - lastPostAt >= POST_INTERVAL_MS) {
    lastPostAt = millis();
    postTelemetry(distanceCm, sweepAngle);
  }

  sweepAngle += sweepDirection;
  if (sweepAngle >= MAX_ANGLE) {
    sweepAngle = MAX_ANGLE;
    sweepDirection = -STEP_DEGREES;
  } else if (sweepAngle <= MIN_ANGLE) {
    sweepAngle = MIN_ANGLE;
    sweepDirection = STEP_DEGREES;
  }
}

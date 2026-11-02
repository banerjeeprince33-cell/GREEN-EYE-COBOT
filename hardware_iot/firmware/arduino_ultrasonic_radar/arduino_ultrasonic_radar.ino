/*
 * Fieldwatch Ultrasonic Radar Firmware (Arduino Uno / Nano - Hardened)
 *
 * HC-SR04 connections:
 *   VCC  -> 5V
 *   GND  -> GND
 *   TRIG -> D9
 *   ECHO -> D10
 *
 * Servo connections (SG90):
 *   Signal (orange/yellow) -> D6
 *   VCC (red)              -> external regulated 5V supply
 *   GND (brown/black)      -> common ground
 *
 * Serial output format: angle,distanceCm   e.g. 90,34.7
 * Baud rate: 115200
 */

#include <Servo.h>

const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int SERVO_PIN = 6;

const int MIN_ANGLE = 0;
const int MAX_ANGLE = 180;
const int STEP_DEGREES = 2;
const unsigned long SERVO_SETTLE_MS = 25;
const unsigned long SENSOR_TIMEOUT_US = 26000; // ~4.5m maximum round trip timeout

Servo radarServo;
int sweepAngle = 90;
int sweepDirection = STEP_DEGREES;
unsigned long lastStepTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  radarServo.attach(SERVO_PIN);
  radarServo.write(sweepAngle);
  delay(500); // Settle servo to center starting position
}

float measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(ECHO_PIN, HIGH, SENSOR_TIMEOUT_US);
  if (duration == 0) {
    return 400.0; // Out of range or no acoustic echo received
  }

  float dist = (duration * 0.0343) / 2.0;
  if (dist < 0.5 || dist > 450.0) {
    return 400.0; // Clamped to max sensor boundary
  }

  return dist;
}

void processIncomingSerial() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();
    if (cmd == "PING") {
      Serial.println("PONG");
    } else if (cmd == "STOP") {
      // Safe hold
      sweepDirection = 0;
    } else if (cmd == "RESUME") {
      sweepDirection = STEP_DEGREES;
    }
  }
}

void loop() {
  processIncomingSerial();

  const unsigned long now = millis();
  if (now - lastStepTime >= SERVO_SETTLE_MS) {
    lastStepTime = now;

    // Constrain angle within physical limits
    if (sweepAngle < MIN_ANGLE) sweepAngle = MIN_ANGLE;
    if (sweepAngle > MAX_ANGLE) sweepAngle = MAX_ANGLE;

    radarServo.write(sweepAngle);

    const float distanceCm = measureDistanceCm();

    // Transmit angle,distance telemetry
    Serial.print(sweepAngle);
    Serial.print(',');
    Serial.println(distanceCm, 1);

    // Step sweep angle
    sweepAngle += sweepDirection;
    if (sweepAngle >= MAX_ANGLE) {
      sweepAngle = MAX_ANGLE;
      sweepDirection = -STEP_DEGREES;
    } else if (sweepAngle <= MIN_ANGLE) {
      sweepAngle = MIN_ANGLE;
      sweepDirection = STEP_DEGREES;
    }
  }
}

#!/usr/bin/env python3
"""
Fieldwatch Ultrasonic Sensor 180° Radar Bridge (Hardened)
---------------------------------------------------------
This script connects to an Arduino (Uno / Nano / ESP32) over USB Serial,
validates incoming angle and distance telemetry, and securely bridges it
to the Fieldwatch Web Dashboard in real time with bounded rate control
and resilient error handling.

Usage:
  python ultrasonic_bridge.py
  python ultrasonic_bridge.py --port COM3 --baud 115200
  python ultrasonic_bridge.py --sim
"""

import sys
import time
import math
import argparse
import json
import os
import http.client
import signal

# Ensure UTF-8 output if supported
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "3000"))
API_URL = f"http://{API_HOST}:{API_PORT}/api/telemetry"
HARDWARE_KEY = os.getenv("HARDWARE_KEY", "fw_node_internal_telemetry_key_2026")

_http_conn = None
_last_send_time = 0.0
_MIN_SEND_INTERVAL = 0.05  # Max 20 Hz to respect backend rate limiters (600 req/min)
_consecutive_auth_failures = 0
_rate_limit_backoff = 0.0

def get_http_conn():
    global _http_conn
    if _http_conn is None:
        _http_conn = http.client.HTTPConnection(API_HOST, API_PORT, timeout=1.0)
    return _http_conn

def close_http_conn():
    global _http_conn
    if _http_conn:
        try:
            _http_conn.close()
        except Exception:
            pass
        _http_conn = None

def validate_telemetry_values(distance_cm, angle_deg):
    """Strictly validates telemetry metrics against physical and finite bounds."""
    try:
        dist = float(distance_cm)
        ang = float(angle_deg)
        if not math.isfinite(dist) or not math.isfinite(ang):
            return None, None
        if dist < 0.0 or dist > 450.0:
            dist = 400.0  # Clamp out-of-range readings
        if ang < 0.0 or ang > 180.0:
            return None, None  # Invalid servo angle
        return round(dist, 1), round(ang, 1)
    except (ValueError, TypeError):
        return None, None

def send_telemetry(distance_cm, angle_deg=90, obstacle=False, source="Arduino"):
    """Sends JSON telemetry to the local Fieldwatch server with rate control and backoff."""
    global _http_conn, _last_send_time, _consecutive_auth_failures, _rate_limit_backoff

    clean_dist, clean_ang = validate_telemetry_values(distance_cm, angle_deg)
    if clean_dist is None or clean_ang is None:
        return False

    # Enforce minimum interval between transmissions
    now = time.monotonic()
    elapsed = now - _last_send_time
    if elapsed < _MIN_SEND_INTERVAL:
        time.sleep(_MIN_SEND_INTERVAL - elapsed)

    # Honor rate-limit backoff if previously throttled
    if _rate_limit_backoff > 0:
        time.sleep(_rate_limit_backoff)
        _rate_limit_backoff = max(0.0, _rate_limit_backoff - 0.5)

    payload = {
        "distanceCm": clean_dist,
        "angle": clean_ang,
        "obstacle": bool(obstacle),
        "source": str(source)[:100],
        "timestamp": time.time()
    }
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Connection": "keep-alive",
        "X-Hardware-Token": HARDWARE_KEY
    }

    for attempt in range(2):
        try:
            conn = get_http_conn()
            conn.request("POST", "/api/telemetry", body=data, headers=headers)
            resp = conn.getresponse()
            resp.read()  # Drain response body to allow connection reuse
            _last_send_time = time.monotonic()

            if resp.status in (200, 201, 202):
                _consecutive_auth_failures = 0
                return True
            elif resp.status in (401, 403):
                _consecutive_auth_failures += 1
                if _consecutive_auth_failures <= 2:
                    print("\n[SECURITY ALERT] Telemetry rejected: Invalid or missing X-Hardware-Token.")
                time.sleep(1.0)
                return False
            elif resp.status == 429:
                _rate_limit_backoff = 2.0
                print("\n[WARN] Server rate limit reached. Backing off...")
                return False
            else:
                return False
        except Exception:
            close_http_conn()
            time.sleep(0.1)

    return False

def find_arduino_port():
    """Attempts to auto-detect Arduino USB Serial COM port."""
    try:
        import serial.tools.list_ports
        ports = list(serial.tools.list_ports.comports())
        if not ports:
            return None
        for p in ports:
            desc = (p.description or "").lower()
            hwid = (p.hwid or "").lower()
            if any(k in desc or k in hwid for k in ["arduino", "ch340", "cp210", "ftdi", "usb serial"]):
                return p.device
        return ports[0].device
    except Exception:
        return "COM3"

def parse_serial_line(raw_line, current_angle):
    """Safely parses incoming raw serial text into valid (angle, distance) tuple."""
    if not raw_line:
        return None, None
    line = raw_line.strip().rstrip(".")
    if not line:
        return None, None

    try:
        if line.startswith("{") and line.endswith("}"):
            data = json.loads(line)
            dist = float(data.get("distance", data.get("distanceCm", 400)))
            angle = float(data.get("angle", current_angle))
            return validate_telemetry_values(dist, angle)
        elif "," in line:
            parts = line.split(",")
            if len(parts) >= 2:
                p1 = float(parts[0].strip())
                p2 = float(parts[1].strip())
                if 0 <= p1 <= 180 and p2 >= 0:
                    return validate_telemetry_values(p2, p1)
                elif 0 <= p2 <= 180 and p1 >= 0:
                    return validate_telemetry_values(p1, p2)
        else:
            dist = float(line)
            return validate_telemetry_values(dist, current_angle)
    except (ValueError, json.JSONDecodeError):
        pass

    return None, None

def run_serial_mode(port=None, baudrate=None):
    """Reads distance and angle lines from USB Serial and forwards to Web Radar."""
    try:
        import serial
        import serial.tools.list_ports
    except ImportError:
        print("[Error] pyserial is required for serial mode. Install with: pip install pyserial")
        sys.exit(1)

    if not port or port.upper() == "AUTO":
        detected_port = find_arduino_port()
        port = detected_port or "COM3"

    baud_candidates = [baudrate] if baudrate else [115200, 9600, 57600]

    print("=" * 70)
    print(" [RADAR] FIELDWATCH ARDUINO 180° ULTRASONIC RADAR BRIDGE")
    print(f" Target Serial Port: {port}")
    print(f" Forwarding to:      {API_URL}")
    print("=" * 70)

    ser = None
    for candidate_baud in baud_candidates:
        try:
            print(f"[*] Connecting to {port} @ {candidate_baud} baud...")
            ser = serial.Serial(port, candidate_baud, timeout=1.0)
            time.sleep(1.5)  # Wait for Arduino auto-reset
            print(f"[+] Connected to {port} at {candidate_baud} baud!")
            break
        except Exception as e:
            print(f"[-] Could not open {port} at {candidate_baud}: {e}")
            if ser and ser.is_open:
                ser.close()

    if not ser or not ser.is_open:
        print("\n[!] Connection Failed. Available COM ports:")
        try:
            available = list(serial.tools.list_ports.comports())
            if available:
                for p in available:
                    print(f"   -> {p.device}: {p.description}")
        except Exception:
            pass
        return

    print("\n[✓] Streaming live Arduino HC-SR04 telemetry to Web Dashboard...")
    print("    Open http://localhost:3000 to watch your 180° radar animate live!\n")

    readings_count = 0
    current_angle = 90.0

    try:
        while True:
            raw_bytes = ser.readline()
            if not raw_bytes:
                continue

            raw_line = raw_bytes.decode("utf-8", errors="ignore").strip()
            dist, angle = parse_serial_line(raw_line, current_angle)
            if dist is None or angle is None:
                continue

            current_angle = angle
            obstacle = (0.5 < dist <= 40.0)

            success = send_telemetry(dist, angle, obstacle=obstacle, source=f"Arduino ({port})")
            if success:
                readings_count += 1

            # Live Terminal Status
            status_text = " [!] OBSTACLE " if obstacle else " [OK] CLEAR    "
            dist_str = f"{dist:5.1f} cm" if dist <= 390 else "OUT OF RANGE"
            print(f"\r[Live Radar] Angle: {angle:3.0f}° | Distance: {dist_str:12s} | Status:{status_text} | Sent: #{readings_count} ", end="", flush=True)

    except KeyboardInterrupt:
        print("\n\n[Info] Serial bridge stopped by user.")
    except Exception as e:
        print(f"\n\n[Error] Serial connection lost: {e}")
    finally:
        if ser and ser.is_open:
            ser.close()
        close_http_conn()

def run_simulation_mode():
    """Runs a continuous smooth 0°-180° radar sweep with simulated obstacle clusters."""
    print("=" * 70)
    print(" [RADAR] FIELDWATCH 180° ULTRASONIC RADAR SIMULATOR")
    print(f" Streaming simulated sweep to: {API_URL}")
    print(" Open http://localhost:3000 to watch the 180° radar animate live!")
    print(" Press Ctrl+C to stop.")
    print("=" * 70)

    angle = 0
    step = 2

    try:
        while True:
            # Simulate obstacles at 65°-110° and 30°-45°
            if 65 <= angle <= 115:
                dist = 22.0 + math.sin(angle * 0.2) * 6.0
                obstacle = True
            elif 25 <= angle <= 45:
                dist = 14.5 + math.cos(angle * 0.25) * 3.0
                obstacle = True
            elif 140 <= angle <= 165:
                dist = 30.0 + math.sin(angle * 0.15) * 4.0
                obstacle = True
            else:
                dist = 400.0
                obstacle = False

            send_telemetry(dist, angle, obstacle, source="HC-SR04-Sweep-Simulator")
            status = " [!] OBSTACLE " if obstacle else " [OK] CLEAR    "
            dist_str = f"{dist:5.1f} cm" if dist <= 390 else "OUT OF RANGE"
            print(f"\r[Simulated Sweep] Angle: {angle:3d}° | Distance: {dist_str:12s} | Status:{status} ", end="", flush=True)

            angle += step
            if angle >= 180:
                angle = 180
                step = -2
            elif angle <= 0:
                angle = 0
                step = 2

            time.sleep(0.05)
    except KeyboardInterrupt:
        print("\n\n[Info] Simulator stopped.")
    finally:
        close_http_conn()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fieldwatch 180° Ultrasonic Radar Bridge")
    parser.add_argument("--port", type=str, default=None, help="USB Serial Port (default: auto-detect or COM3)")
    parser.add_argument("--baud", type=int, default=None, help="Serial Baud Rate (default: auto-detect 115200/9600)")
    parser.add_argument("--sim", action="store_true", help="Run 0°-180° radar sweep simulator")
    args = parser.parse_args()

    if args.sim:
        run_simulation_mode()
    else:
        run_serial_mode(args.port, args.baud)

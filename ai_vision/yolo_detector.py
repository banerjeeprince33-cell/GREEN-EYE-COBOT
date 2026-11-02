import argparse
import os
import time
import math
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime

import requests
import cv2
from PIL import Image
from ultralytics import YOLO

SPECIES_NAMES = {
    "human": "Homo sapiens",
    "lion": "Panthera leo",
    "tiger": "Panthera tigris",
    "deer": "Axis axis",
    "dog": "Canis lupus familiaris",
    "rhinoceros": "Rhinoceros unicornis",
    "leopard": "Panthera pardus",
    "monkeys": "Macaca radiata",
    "elephant": "Elephas maximus"
}

LABEL_ALIASES = {
    "human": "human",
    "human person": "human",
    "person": "human",
    "man": "human",
    "woman": "human",
    "lion": "lion",
    "male lion with mane": "lion",
    "male lion": "lion",
    "lioness": "lion",
    "panthera leo": "lion",
    "tiger": "tiger",
    "bengal tiger": "tiger",
    "striped tiger": "tiger",
    "panthera tigris": "tiger",
    "deer": "deer",
    "spotted deer with antlers": "deer",
    "spotted deer": "deer",
    "antelope": "deer",
    "stag": "deer",
    "dog": "dog",
    "canine dog": "dog",
    "canine": "dog",
    "pet dog": "dog",
    "rhinoceros": "rhinoceros",
    "rhino": "rhinoceros",
    "horned rhinoceros": "rhinoceros",
    "horned rhino": "rhinoceros",
    "black rhino": "rhinoceros",
    "indian rhinoceros": "rhinoceros",
    "leopard": "leopard",
    "spotted leopard with rosettes": "leopard",
    "spotted leopard": "leopard",
    "panthera pardus": "leopard",
    "cheetah": "leopard",
    "jaguar": "leopard",
    "monkeys": "monkeys",
    "monkey": "monkeys",
    "macaque monkey": "monkeys",
    "rhesus macaque": "monkeys",
    "macaque": "monkeys",
    "baboon": "monkeys",
    "langur": "monkeys",
    "elephant": "elephant",
    "asian elephant": "elephant",
    "african elephant": "elephant",
    "tusker elephant": "elephant"
}

TARGET_CLASSES = [
    "bengal tiger", "tiger", "striped tiger",
    "horned rhinoceros", "rhinoceros", "rhino",
    "asian elephant", "african elephant", "elephant",
    "male lion with mane", "lioness", "lion",
    "spotted leopard with rosettes", "leopard",
    "spotted deer with antlers", "deer",
    "macaque monkey", "rhesus macaque", "monkey",
    "canine dog", "dog",
    "human person", "person"
]

latest_jpeg = b""
jpeg_lock = threading.Lock()
latest_capture = None
capture_lock = threading.Lock()
latest_stream_boxes = []
stream_running = False

HARDWARE_KEY = os.getenv("HARDWARE_KEY", "fw_node_internal_telemetry_key_2026")
_post_session = requests.Session()
_auth_fail_logged = False

def validate_box(box: dict) -> dict:
    """Validates and sanitizes a bounding box dict."""
    try:
        x = float(box.get("x", 0.0))
        y = float(box.get("y", 0.0))
        w = float(box.get("width", 0.0))
        h = float(box.get("height", 0.0))
        if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(w) and math.isfinite(h)):
            return None
        x = max(0.0, min(1.0, x))
        y = max(0.0, min(1.0, y))
        w = max(0.0, min(1.0 - x, w))
        h = max(0.0, min(1.0 - y, h))
        return {
            "x": round(x, 4),
            "y": round(y, 4),
            "width": round(w, 4),
            "height": round(h, 4),
            "animal": str(box.get("animal", "unknown"))[:100],
            "confidence": str(box.get("confidence", "0.0%"))[:20]
        }
    except (ValueError, TypeError):
        return None

def post_boxes(api_url: str, boxes: list[dict]) -> None:
    """Publish the newest sanitized boxes to the API server."""
    global _auth_fail_logged
    valid_boxes = []
    for b in boxes[:20]:  # Cap to max 20 boxes
        v = validate_box(b)
        if v:
            valid_boxes.append(v)

    try:
        resp = _post_session.post(
            f"{api_url}/api/detection-boxes",
            json={"boxes": valid_boxes},
            headers={"X-Hardware-Token": HARDWARE_KEY},
            timeout=1.0
        )
        if resp.status_code in (401, 403) and not _auth_fail_logged:
            print("[SECURITY WARN] Detection boxes rejected: Check X-Hardware-Token configuration.")
            _auth_fail_logged = True
    except requests.RequestException:
        pass


class StreamHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0]
        if clean_path == "/health":
            with jpeg_lock:
                has_frames = bool(latest_jpeg and len(latest_jpeg) > 100)
            self.send_response(200 if has_frames else 503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            if has_frames:
                self.wfile.write(b'{"status":"ok","stream":"/video"}')
            else:
                self.wfile.write(b'{"status":"warming_up","stream":"/video"}')
            return

        if clean_path == "/video":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            try:
                while stream_running:
                    with jpeg_lock:
                        jpeg = latest_jpeg
                    if jpeg and len(jpeg) > 100:
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n" + jpeg + b"\r\n")
                        self.wfile.flush()
                    time.sleep(0.033)
            except (BrokenPipeError, ConnectionResetError, Exception):
                pass
            return

        self.send_error(404)

    def log_message(self, format, *args):
        return


def start_stream_server(port: int) -> None:
    server = ThreadingHTTPServer(("0.0.0.0", port), StreamHandler)
    server.daemon_threads = True
    server.serve_forever()


smoothed_boxes = {}
boxes_lock = threading.Lock()

def smooth_detection_boxes(new_boxes, alpha=0.55):
    """Smooth bounding box coordinates using Exponential Moving Average."""
    global smoothed_boxes
    current_time = time.monotonic()
    updated = []
    
    with boxes_lock:
        for box in new_boxes:
            key = box.get("animal", "object")
            if key in smoothed_boxes:
                prev = smoothed_boxes[key]
                sx = prev["x"] * (1 - alpha) + box["x"] * alpha
                sy = prev["y"] * (1 - alpha) + box["y"] * alpha
                sw = prev["width"] * (1 - alpha) + box["width"] * alpha
                sh = prev["height"] * (1 - alpha) + box["height"] * alpha
            else:
                sx, sy, sw, sh = box["x"], box["y"], box["width"], box["height"]
            
            item = {
                "x": sx, "y": sy, "width": sw, "height": sh,
                "animal": box["animal"],
                "confidence": box["confidence"],
                "last_seen": current_time
            }
            smoothed_boxes[key] = item
            updated.append(item)
        
        # Keep boxes alive for up to 0.4s to prevent momentary flickering
        for k in list(smoothed_boxes.keys()):
            if current_time - smoothed_boxes[k]["last_seen"] > 0.4:
                del smoothed_boxes[k]
                
    return updated


def capture_loop(camera, webcam_index: int = 0) -> None:
    global latest_capture, latest_jpeg, stream_running
    fail_count = 0
    active_camera = camera
    while stream_running:
        captured = False
        frame = None
        if active_camera is not None and active_camera.isOpened():
            try:
                captured, frame = active_camera.read()
            except Exception:
                captured = False
        
        if not captured or frame is None:
            fail_count += 1
            time.sleep(0.02)
            if fail_count > 30:
                print("[*] Camera read paused. Attempting auto-reconnect...")
                try:
                    if active_camera is not None:
                        active_camera.release()
                    time.sleep(0.5)
                    active_camera = cv2.VideoCapture(webcam_index, cv2.CAP_DSHOW)
                    if not active_camera.isOpened():
                        active_camera = cv2.VideoCapture(webcam_index)
                    if active_camera.isOpened():
                        active_camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                        active_camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                        active_camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                        print("[+] Camera reconnected successfully!")
                        fail_count = 0
                except Exception as e:
                    print(f"[-] Camera reconnect failed: {e}")
            continue
        
        fail_count = 0
        frame = cv2.flip(frame, 1)
        
        with capture_lock:
            latest_capture = frame.copy()
        
        stream_frame = frame.copy()
        h_f, w_f = stream_frame.shape[:2]
        
        with boxes_lock:
            active_boxes = list(smoothed_boxes.values()) if smoothed_boxes else latest_stream_boxes
            
        for detection in active_boxes:
            x1 = int(detection["x"] * w_f)
            y1 = int(detection["y"] * h_f)
            x2 = int((detection["x"] + detection["width"]) * w_f)
            y2 = int((detection["y"] + detection["height"]) * h_f)
            
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w_f - 1, x2), min(h_f - 1, y2)
            
            if x2 <= x1 or y2 <= y1:
                continue
                
            box_color = (157, 245, 103)
            bg_dark = (14, 30, 20)
            
            cv2.rectangle(stream_frame, (x1, y1), (x2, y2), box_color, 2, cv2.LINE_AA)
            
            c_len = min(22, (x2 - x1) // 4, (y2 - y1) // 4)
            if c_len > 4:
                cv2.line(stream_frame, (x1, y1), (x1 + c_len, y1), (255, 255, 255), 3, cv2.LINE_AA)
                cv2.line(stream_frame, (x1, y1), (x1, y1 + c_len), (255, 255, 255), 3, cv2.LINE_AA)
                cv2.line(stream_frame, (x2, y1), (x2 - c_len, y1), (255, 255, 255), 3, cv2.LINE_AA)
                cv2.line(stream_frame, (x2, y1), (x2, y1 + c_len), (255, 255, 255), 3, cv2.LINE_AA)
                cv2.line(stream_frame, (x1, y2), (x1 + c_len, y2), (255, 255, 255), 3, cv2.LINE_AA)
                cv2.line(stream_frame, (x1, y2), (x1, y2 - c_len), (255, 255, 255), 3, cv2.LINE_AA)
                cv2.line(stream_frame, (x2, y2), (x2 - c_len, y2), (255, 255, 255), 3, cv2.LINE_AA)
                cv2.line(stream_frame, (x2, y2), (x2, y2 - c_len), (255, 255, 255), 3, cv2.LINE_AA)
            
            label = f"{detection['animal'].upper()} {detection['confidence']}"
            (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
            
            badge_y1 = max(0, y1 - th - 12)
            badge_y2 = y1 if y1 - th - 12 >= 0 else th + 14
            badge_x2 = min(w_f - 1, x1 + tw + 12)
            
            cv2.rectangle(stream_frame, (x1, badge_y1), (badge_x2, badge_y2), bg_dark, -1)
            cv2.rectangle(stream_frame, (x1, badge_y1), (badge_x2, badge_y2), box_color, 1, cv2.LINE_AA)
            
            text_y = badge_y2 - 6
            cv2.putText(stream_frame, label, (x1 + 6, text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, box_color, 2, cv2.LINE_AA)
            
        success, encoded = cv2.imencode(".jpg", stream_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if success:
            with jpeg_lock:
                latest_jpeg = encoded.tobytes()
        time.sleep(0.012)


def capture_image(camera_ip: str) -> Image.Image:
    response = requests.get(f"http://{camera_ip}/capture", timeout=5)
    response.raise_for_status()
    with open("latest-esp32-frame.jpg", "wb") as frame_file:
        frame_file.write(response.content)
    return Image.open("latest-esp32-frame.jpg").convert("RGB")


def post_detection(api_url: str, detection: dict, location: dict) -> None:
    now_local = datetime.now()
    conf_val = float(detection.get("confidence", 0.95))
    if not (math.isfinite(conf_val) and 0.0 <= conf_val <= 1.0):
        conf_val = 0.95

    payload = {
        "animal": str(detection.get("animal", "unknown"))[:100],
        "species": str(SPECIES_NAMES.get(detection.get("animal", ""), detection.get("animal", "unknown")))[:100],
        "location": str(location.get("name", "Kolkata Station"))[:200],
        "latitude": str(location.get("latitude", "22.5726 N"))[:50],
        "longitude": str(location.get("longitude", "88.3639 E"))[:50],
        "altitude": str(location.get("altitude", "18 m"))[:50],
        "date": now_local.strftime("%d %b %Y"),
        "time": now_local.strftime("%H:%M:%S"),
        "confidence": f"{conf_val * 100:.1f}%",
        "source": "YOLO / GE-01",
        "box": validate_box(detection.get("box", {})) if detection.get("box") else None
    }
    try:
        response = requests.post(
            f"{api_url}/api/detections",
            json=payload,
            headers={"X-Hardware-Token": HARDWARE_KEY},
            timeout=2.0
        )
        if response.status_code in (200, 201):
            data = response.json()
            db_mode = data.get("database", "db")
            print(f"[DB STORED] {payload['animal']} ({payload['confidence']}) -> Persisted to {db_mode.upper()} Database")
        elif response.status_code in (401, 403):
            print("[SECURITY WARN] Detection rejected: Invalid X-Hardware-Token.")
        else:
            print(f"[DB WARN] Server returned {response.status_code}")
    except Exception as e:
        print(f"[DB WARN] Could not reach database server: {e}")


def resolve_model_path(name: str) -> str:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        name,
        os.path.join(script_dir, "weights", name),
        os.path.join(script_dir, "weights", os.path.basename(name)),
        os.path.join(script_dir, name),
        os.path.join(os.getcwd(), "ai_vision", "weights", os.path.basename(name)),
        os.path.join(os.getcwd(), "weights", os.path.basename(name))
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return os.path.abspath(candidate)
    return name


def run(args: argparse.Namespace) -> None:
    global stream_running
    script_dir = os.path.dirname(os.path.abspath(__file__))
    wildlife_custom = os.path.join(script_dir, "weights", "wildlife_best.pt")

    if os.path.exists(wildlife_custom) and not args.force_world:
        model_path = wildlife_custom
        print(f"[*] Loading dedicated fine-tuned wildlife model: {model_path}")
        model = YOLO(model_path)
    else:
        model_path = resolve_model_path(args.model)
        print(f"Loading YOLO model: {model_path}...")
        model = YOLO(model_path)
        if args.world or "world" in str(model_path).lower():
            labels = args.labels if args.labels else TARGET_CLASSES
            print(f"Setting target open-vocabulary classes ({len(labels)} categories)...")
            model.set_classes(labels)

    webcam = None
    if args.webcam:
        print(f"[*] Initializing webcam index {args.webcam_index} on Windows...")
        try:
            webcam = cv2.VideoCapture(args.webcam_index, cv2.CAP_DSHOW)
        except Exception:
            webcam = None

        if webcam is None or not webcam.isOpened():
            webcam = cv2.VideoCapture(args.webcam_index)

        if not webcam.isOpened() and args.webcam_index == 0:
            for fallback_idx in [1, 2]:
                print(f"[*] Trying fallback camera index {fallback_idx}...")
                webcam = cv2.VideoCapture(fallback_idx, cv2.CAP_DSHOW)
                if webcam.isOpened():
                    print(f"[+] Connected to webcam index {fallback_idx}!")
                    break

        if not webcam.isOpened():
            print("\n[ERROR] Could not open webcam. Ensure it is not locked by another application.\n")
            return

        webcam.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        try:
            webcam.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        except Exception:
            pass
        webcam.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        webcam.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        stream_running = True
        
        threading.Thread(target=start_stream_server, args=(args.stream_port,), daemon=True).start()
        print(f"[+] YOLO video stream running at: http://localhost:{args.stream_port}/video")
        threading.Thread(target=capture_loop, args=(webcam, args.webcam_index), daemon=True).start()

    location = {
        "name": os.getenv("FIELD_LOCATION", "Kolkata Station (Node 04)"),
        "latitude": os.getenv("FIELD_LATITUDE", "22.5726 N"),
        "longitude": os.getenv("FIELD_LONGITUDE", "88.3639 E"),
        "altitude": os.getenv("FIELD_ALTITUDE", "18 m")
    }
    print(f"[Station] Active Node: {location['name']}")
    last_stored = {}
    print(f"YOLO detection loop started. Conf: {args.conf}, IoU: {args.iou}, imgsz: {args.imgsz}.")

    while True:
        try:
            if webcam is not None:
                with capture_lock:
                    frame = latest_capture.copy() if latest_capture is not None else None
                if frame is None:
                    time.sleep(0.02)
                    continue
                h, w = frame.shape[:2]
                results = model(frame, imgsz=args.imgsz, conf=args.conf, iou=args.iou, max_det=args.max_det, verbose=False)
            else:
                image = capture_image(args.camera_ip)
                w, h = image.size
                results = model(image, imgsz=args.imgsz, conf=args.conf, iou=args.iou, max_det=args.max_det, verbose=False)

            frame_boxes = []

            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    raw_animal = model.names[class_id]
                    animal = LABEL_ALIASES.get(raw_animal.lower(), raw_animal)
                    conf_val = float(box.conf[0])

                    if not (math.isfinite(conf_val) and 0.0 <= conf_val <= 1.0):
                        continue

                    x1 = float(box.xyxy[0][0])
                    y1 = float(box.xyxy[0][1])
                    x2 = float(box.xyxy[0][2])
                    y2 = float(box.xyxy[0][3])

                    if not (math.isfinite(x1) and math.isfinite(y1) and math.isfinite(x2) and math.isfinite(y2)):
                        continue

                    normalized_box = {
                        "x": max(0.0, min(1.0, x1 / w)),
                        "y": max(0.0, min(1.0, y1 / h)),
                        "width": max(0.0, min(1.0, (x2 - x1) / w)),
                        "height": max(0.0, min(1.0, (y2 - y1) / h)),
                        "animal": animal,
                        "confidence": f"{conf_val * 100:.1f}%"
                    }

                    frame_boxes.append(normalized_box)

                    detection_key = f"{animal}:{round(normalized_box['x'], 1)}:{round(normalized_box['y'], 1)}"
                    now = time.monotonic()
                    if now - last_stored.get(detection_key, 0) >= args.store_interval:
                        threading.Thread(target=post_detection, args=(args.api_url, {
                            "animal": animal,
                            "confidence": conf_val,
                            "box": normalized_box
                        }, location), daemon=True).start()
                        last_stored[detection_key] = now

            global latest_stream_boxes
            latest_stream_boxes = frame_boxes
            smoothed = smooth_detection_boxes(frame_boxes)
            threading.Thread(target=post_boxes, args=(args.api_url, smoothed), daemon=True).start()

            if frame_boxes:
                detected_summary = ", ".join(f"{b['animal']} ({b['confidence']})" for b in frame_boxes)
                print(f"[DETECTED] {detected_summary}")
                
                predators = [b for b in frame_boxes if b['animal'] in ['tiger', 'lion', 'leopard', 'bear']]
                if predators:
                    try:
                        import winsound
                        threading.Thread(target=winsound.Beep, args=(1350, 300), daemon=True).start()
                    except Exception:
                        pass

        except Exception as error:
            print(f"Detection cycle error: {error}")

        if args.once:
            break
        time.sleep(args.interval)

    if webcam is not None:
        stream_running = False
        webcam.release()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run YOLO wildlife & human detection on webcam or ESP32-CAM.")
    parser.add_argument("--model", default="yolov8m-worldv2.pt")
    parser.add_argument("--world", action="store_true", help="Use YOLO-World open-vocabulary object labels")
    parser.add_argument("--force-world", action="store_true", help="Force open-vocabulary mode even if weights/wildlife_best.pt exists")
    parser.add_argument("--labels", nargs="+", default=TARGET_CLASSES)
    parser.add_argument("--camera-ip", help="ESP32-CAM IP address")
    parser.add_argument("--webcam", action="store_true", help="Read frames from laptop webcam")
    parser.add_argument("--webcam-index", type=int, default=0)
    parser.add_argument("--api-url", default="http://localhost:3000")
    parser.add_argument("--conf", type=float, default=0.12, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.40, help="IoU threshold for NMS")
    parser.add_argument("--max-det", type=int, default=20, help="Max detections per frame")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference resolution")
    parser.add_argument("--store-interval", type=float, default=3.0, help="Seconds before storing same object")
    parser.add_argument("--interval", type=float, default=0.08, help="Inference interval in seconds")
    parser.add_argument("--stream-port", type=int, default=5001, help="MJPEG stream port")
    parser.add_argument("--once", action="store_true")
    run(parser.parse_args())

ddd# AI Vision Subsystem

Real-time computer vision engine powered by YOLOv8 World open-vocabulary and fine-tuned deep learning models. Includes automated HTTP MJPEG streaming (`:5001/video`) and telemetry forwarding to the Fieldwatch console.

---

## Directory Structure

```
ai_vision/
├── dataset/                         # YOLO dataset annotations & imagery
│   ├── images/                      # Train & val split images
│   ├── labels/                      # Normalized YOLO bbox annotations
│   ├── data.yaml                    # Dataset definition configuration
│   └── README.md                    # Dataset documentation
│
├── weights/                         # Model checkpoints (.pt)
│   ├── clip/                        # Visual-text alignment checkpoints
│   ├── yolov8m-worldv2.pt           # Open-vocabulary zero-shot detector
│   ├── yolov8n.pt                   # Lightweight base checkpoint
│   └── yolo11n.pt                   # Edge-optimized lightweight checkpoint
│
├── yolo_detector.py                 # Real-time multi-species detector & MJPEG server
├── train_yolo.py                    # Model fine-tuning script
├── prepare_and_train.py             # Dataset preparation and auto-pipeline
├── requirements.txt                 # Vision dependencies
├── requirements-vision.txt          # Legacy alias
└── README.md                        # Documentation
```

---

## Quick Start

### 1. Install Dependencies
```powershell
pip install -r ai_vision/requirements.txt
```

### 2. Run Real-Time Webcam Detector
```powershell
# From project root:
python ai_vision/yolo_detector.py --model yolov8m-worldv2.pt --world --webcam --conf 0.15

# Or via npm script:
npm run vision
```

### 3. Detector Features & Arguments
- `--webcam`: Captures live video from webcam index 0.
- `--world`: Enables YOLOv8 World open-vocabulary detection mode (tracks humans, tigers, lions, elephants, rhinos, leopards, deer, dogs, monkeys).
- `--conf 0.15`: Confidence threshold filter (0.0 to 1.0).
- `--port 5001`: MJPEG stream port (stream URL: `http://localhost:5001/video`).
- `--api-url`: Target Fieldwatch backend URL for logging detections (default: `http://localhost:3000/api/detections`).
- `--store-interval 3`: Debounce rate for database writes.

---

## Training Custom Weights

```powershell
# Train custom wildlife detector on local dataset
python ai_vision/train_yolo.py --epochs 25 --batch 8 --device cpu
```
Checkpoints will be saved to `ai_vision/weights/`.

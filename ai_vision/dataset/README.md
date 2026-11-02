# Green Eye Wildlife & Human Dataset

This dataset is configured to detect **7 target classes**:

| Class ID | Class Name | Scientific / Description |
|---|---|---|
| `0` | **human** | *Homo sapiens* |
| `1` | **tiger** | *Panthera tigris* |
| `2` | **deer** | *Axis axis* |
| `3` | **lion** | *Panthera leo* |
| `4` | **elephant** | *Elephas maximus* |
| `5` | **monkey** | *Macaca radiata* |
| `6` | **rhino** | *Rhinoceros unicornis* |

## Directory Structure
```
dataset/
├── data.yaml
├── images/
│   ├── train/     # Training images (.jpg, .png)
│   └── val/       # Validation images (.jpg, .png)
└── labels/
    ├── train/     # YOLO format text files matching training images
    └── val/       # YOLO format text files matching validation images
```

## Label Format
Each line in a label `.txt` file represents one bounding box:
```
<class_id> <center_x> <center_y> <width> <height>
```
*Note: All coordinates are normalized between `0.0` and `1.0` relative to image dimensions.*

## How to Train
Run the training script:
```powershell
python train_yolo.py --epochs 50 --batch 16 --imgsz 640
```
Upon completion, the best weights will be saved to `weights/best.pt`.

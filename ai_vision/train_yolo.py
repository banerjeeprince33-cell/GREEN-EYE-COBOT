"""
Green Eye - YOLO Model Training Script
Trains YOLO11 / YOLOv8 to detect: human, tiger, deer, lion, elephant, monkey, rhino
"""

import argparse
import os
import shutil
from pathlib import Path
from ultralytics import YOLO

DEFAULT_CLASSES = ["human", "tiger", "deer", "lion", "elephant", "monkey", "rhino"]


def ensure_dataset_structure(dataset_dir: Path):
    """Ensure dataset directories exist."""
    dirs = [
        dataset_dir / "images" / "train",
        dataset_dir / "images" / "val",
        dataset_dir / "labels" / "train",
        dataset_dir / "labels" / "val",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
    return dirs


def check_dataset_images(dataset_dir: Path):
    """Count training and validation images."""
    train_imgs = list((dataset_dir / "images" / "train").glob("*.*"))
    val_imgs = list((dataset_dir / "images" / "val").glob("*.*"))
    return len(train_imgs), len(val_imgs)


def train(args):
    dataset_dir = Path(args.dataset).resolve()
    data_yaml = Path(args.data).resolve()
    weights_out_dir = Path(args.output_dir).resolve()
    weights_out_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Green Eye Wildlife Detection - YOLO Training Pipeline")
    print("=" * 60)
    print(f"Target Classes: {', '.join(DEFAULT_CLASSES)}")
    print(f"Dataset YAML  : {data_yaml}")
    print(f"Base Model    : {args.base_model}")
    print(f"Epochs        : {args.epochs}")
    print(f"Batch Size    : {args.batch}")
    print(f"Image Size    : {args.imgsz}")
    print(f"Device        : {args.device}")
    print("=" * 60)

    ensure_dataset_structure(dataset_dir)
    train_count, val_count = check_dataset_images(dataset_dir)
    print(f"Found {train_count} training images and {val_count} validation images in {dataset_dir}")

    if train_count == 0:
        print("\n[WARNING] No training images found in dataset/images/train!")
        print("\nTo train on custom images:")
        print("  1. Place training images (.jpg, .png) into: dataset/images/train/")
        print("  2. Place matching YOLO labels (.txt) into: dataset/labels/train/")
        print("  3. Place validation images into: dataset/images/val/")
        print("  4. Place matching YOLO labels into: dataset/labels/val/")
        print("\nLabel format for each line in .txt file:")
        print("  <class_id> <center_x> <center_y> <width> <height>")
        print("  Class IDs:")
        for idx, cls_name in enumerate(DEFAULT_CLASSES):
            print(f"    {idx}: {cls_name}")
        print("\nTip: If you don't have a custom annotated dataset yet, you can run")
        print("the zero-shot YOLO-World detector immediately with:")
        print("  python yolo_detector.py --model yolov8s-worldv2.pt --world --labels human tiger deer lion elephant monkey rhino --webcam")
        return

    print("\nStarting YOLO fine-tuning...")
    model = YOLO(args.base_model)

    train_results = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project=args.project,
        name=args.name,
        exist_ok=True,
        workers=args.workers,
        pretrained=True,
        verbose=True,
    )

    best_weight = Path(args.project) / args.name / "weights" / "best.pt"
    if best_weight.exists():
        dest_path = weights_out_dir / "best.pt"
        shutil.copy2(best_weight, dest_path)
        print("\n" + "=" * 60)
        print(f"Training completed successfully!")
        print(f"Best model weights saved to: {dest_path}")
        print(f"Run detector using your trained weights with:")
        print(f"  python yolo_detector.py --model {dest_path} --webcam")
        print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train YOLO model for wildlife and human detection.")
    parser.add_argument("--data", default="dataset/data.yaml", help="Path to data.yaml file")
    parser.add_argument("--dataset", default="dataset", help="Path to dataset root folder")
    parser.add_argument("--base-model", default="yolo11n.pt", help="Pretrained base model (e.g. yolo11n.pt, yolov8n.pt, yolo11s.pt)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size for training")
    parser.add_argument("--device", default="cpu", help="Device to use: 'cpu', '0', etc.")
    parser.add_argument("--project", default="runs/detect", help="Project output folder")
    parser.add_argument("--name", default="wildlife_detector", help="Experiment run name")
    parser.add_argument("--workers", type=int, default=2, help="Number of dataloader workers")
    parser.add_argument("--output-dir", default="weights", help="Directory to save final best.pt")
    args = parser.parse_args()
    train(args)

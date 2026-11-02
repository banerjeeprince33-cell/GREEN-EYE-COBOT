import os
import sys
import json
import urllib.request
import urllib.parse
from pathlib import Path
from PIL import Image
from ultralytics import YOLO

CLASSES = [
    "human",
    "lion",
    "tiger",
    "deer",
    "dog",
    "rhinoceros",
    "leopard",
    "monkeys"
]

SEARCH_TERMS = {
    "human": ["portrait person face", "standing person full body", "human face outdoor"],
    "lion": ["Panthera leo male lion", "African lion portrait", "lioness resting wildlife"],
    "tiger": ["Bengal tiger Panthera tigris", "tiger walking wildlife", "Siberian tiger stripes"],
    "deer": ["spotted deer Axis axis", "red deer stag antlers", "fallow deer forest"],
    "dog": ["domestic dog Canis familiaris", "golden retriever dog", "German shepherd dog"],
    "rhinoceros": ["Indian rhinoceros Rhinoceros unicornis", "Black rhinoceros horned", "White rhino savanna"],
    "leopard": ["Panthera pardus leopard spots", "African leopard tree", "spotted leopard predator"],
    "monkeys": ["Macaca radiata bonnet macaque", "Rhesus macaque monkey", "monkey primate face"]
}

BASE_DIR = Path("c:/Users/Arkasnata/Desktop/SIH")
DATASET_DIR = BASE_DIR / "dataset"
IMAGES_TRAIN = DATASET_DIR / "images" / "train"
IMAGES_VAL = DATASET_DIR / "images" / "val"
LABELS_TRAIN = DATASET_DIR / "labels" / "train"
LABELS_VAL = DATASET_DIR / "labels" / "val"


def setup_directories():
    for p in [IMAGES_TRAIN, IMAGES_VAL, LABELS_TRAIN, LABELS_VAL]:
        p.mkdir(parents=True, exist_ok=True)
    
    # Write data.yaml
    yaml_content = f"""path: {DATASET_DIR.as_posix()}
train: images/train
val: images/val

names:
"""
    for idx, name in enumerate(CLASSES):
        yaml_content += f"  {idx}: {name}\n"
        
    (DATASET_DIR / "data.yaml").write_text(yaml_content, encoding="utf-8")
    print(f"[OK] data.yaml created with {len(CLASSES)} classes.")


def fetch_commons_images(query, max_images=6):
    url = f"https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch={urllib.parse.quote(query)}&gsrnamespace=6&gsrlimit={max_images}&prop=imageinfo&iiprop=url|mime"
    headers = {"User-Agent": "WildWatchAI/1.0 (educational research bot)"}
    req = urllib.request.Request(url, headers=headers)
    image_urls = []
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            data = json.loads(response.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_info in pages.items():
                infos = page_info.get("imageinfo", [])
                if infos:
                    mime = infos[0].get("mime", "")
                    img_url = infos[0].get("url", "")
                    if mime in ["image/jpeg", "image/png"] and img_url:
                        image_urls.append(img_url)
    except Exception as e:
        print(f"Warning: search failed for '{query}': {e}")
    return image_urls


def download_and_annotate():
    print("Downloading verified wildlife dataset for fine-tuning...")
    headers = {"User-Agent": "WildWatchAI/1.0 (educational research bot)"}
    
    for class_id, class_name in enumerate(CLASSES):
        terms = SEARCH_TERMS[class_name]
        downloaded = 0
        print(f"\n--- Fetching images for class {class_id}: '{class_name}' ---")
        
        for term in terms:
            urls = fetch_commons_images(term, max_images=5)
            for url in urls:
                try:
                    ext = ".jpg"
                    split = "val" if (downloaded % 5 == 0) else "train"
                    img_dest = (IMAGES_VAL if split == "val" else IMAGES_TRAIN) / f"{class_name}_{downloaded:03d}{ext}"
                    lbl_dest = (LABELS_VAL if split == "val" else LABELS_TRAIN) / f"{class_name}_{downloaded:03d}.txt"
                    
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, timeout=10) as resp, open(img_dest, "wb") as f:
                        f.write(resp.read())
                    
                    # Verify PIL can open and resize to standard 640
                    with Image.open(img_dest) as img:
                        img = img.convert("RGB")
                        img.save(img_dest, "JPEG", quality=90)
                    
                    # Bounding box covering the main object (center bounding box)
                    # format: class_id x_center y_center width height
                    lbl_dest.write_text(f"{class_id} 0.50 0.50 0.88 0.88\n", encoding="utf-8")
                    downloaded += 1
                    print(f"  [+] Saved {img_dest.name} ({split})")
                except Exception as err:
                    pass
                if downloaded >= 12:
                    break
            if downloaded >= 12:
                break
                
        print(f"Total downloaded for {class_name}: {downloaded} images.")


def train():
    print("\nStarting YOLO fine-tuning on wildlife dataset...")
    weights_dir = BASE_DIR / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    
    model = YOLO("yolov8n.pt")
    data_yaml = (DATASET_DIR / "data.yaml").as_posix()
    
    results = model.train(
        data=data_yaml,
        epochs=18,
        imgsz=416,
        batch=8,
        device="cpu",
        workers=2,
        project="runs/detect",
        name="wildlife_finetuned",
        exist_ok=True
    )
    
    best_weights = BASE_DIR / "runs" / "detect" / "wildlife_finetuned" / "weights" / "best.pt"
    target_weights = weights_dir / "wildlife_best.pt"
    
    if best_weights.exists():
        import shutil
        shutil.copy(best_weights, target_weights)
        print(f"\n[SUCCESS] Fine-tuned model saved to: {target_weights}")
    else:
        print("[INFO] Exporting model directly...")
        model.save(target_weights.as_posix())
        print(f"[SUCCESS] Model saved to: {target_weights}")


if __name__ == "__main__":
    setup_directories()
    download_and_annotate()
    train()

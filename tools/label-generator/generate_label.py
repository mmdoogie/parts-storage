#!/usr/bin/env python3
"""
Generate four 1.125" x 3.5" labels with ArUco markers for case corners.

ArUco Marker Details (for detection):
- Dictionary: DICT_4X4_50 (cv2.aruco.DICT_4X4_50)
- Marker IDs:
  - TL label: ID 1 (positioned bottom-right of label) -> top-left corner of case
  - TR label: ID 3 (positioned bottom-left of label) -> top-right corner of case
  - BL label: ID 4 (positioned top-right of label) -> bottom-left corner of case
  - BR label: ID 2 (positioned top-left of label) -> bottom-right corner of case
- Marker size in image: 280x280 pixels
- Label DPI: 300

Detection code example:
    import cv2
    aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    parameters = cv2.aruco.DetectorParameters()
    detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)
    corners, ids, rejected = detector.detectMarkers(image)
"""

import cv2
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Get script directory for relative output paths
SCRIPT_DIR = Path(__file__).parent

# Label dimensions at 300 DPI (landscape orientation)
DPI = 300
WIDTH_INCHES = 3.5
HEIGHT_INCHES = 1.125
WIDTH_PX = int(WIDTH_INCHES * DPI)   # 337 pixels
HEIGHT_PX = int(HEIGHT_INCHES * DPI)  # 1050 pixels

# ArUco settings
ARUCO_DICT = cv2.aruco.DICT_4X4_50
MARKER_SIZE = 280  # pixels (fits label height with margins)
MARKER_ID_TL = 1
MARKER_ID_BR = 2
MARKER_ID_TR = 3
MARKER_ID_BL = 4

# Generate ArUco markers
aruco_dict = cv2.aruco.getPredefinedDictionary(ARUCO_DICT)
marker_tl = cv2.aruco.generateImageMarker(aruco_dict, MARKER_ID_TL, MARKER_SIZE)
marker_br = cv2.aruco.generateImageMarker(aruco_dict, MARKER_ID_BR, MARKER_SIZE)
marker_tr = cv2.aruco.generateImageMarker(aruco_dict, MARKER_ID_TR, MARKER_SIZE)
marker_bl = cv2.aruco.generateImageMarker(aruco_dict, MARKER_ID_BL, MARKER_SIZE)

# Convert markers to PIL images
marker_tl_pil = Image.fromarray(marker_tl).convert('RGB')
marker_br_pil = Image.fromarray(marker_br).convert('RGB')
marker_tr_pil = Image.fromarray(marker_tr).convert('RGB')
marker_bl_pil = Image.fromarray(marker_bl).convert('RGB')

# Try to load a nice font, fall back to default
try:
    font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
except:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()

margin = 15

# === TL Label ===
label_tl = Image.new('RGB', (WIDTH_PX, HEIGHT_PX), 'white')
draw_tl = ImageDraw.Draw(label_tl)

# Text "TL" in top-left
draw_tl.text((margin, margin), "TL", fill='black', font=font_large)

# Marker in bottom-right, vertically centered
marker_x = WIDTH_PX - MARKER_SIZE - margin
marker_y = (HEIGHT_PX - MARKER_SIZE) // 2
label_tl.paste(marker_tl_pil, (marker_x, marker_y))

# Add small ID label to the left of marker
draw_tl.text((marker_x - 40, marker_y + MARKER_SIZE // 2), f"ID:{MARKER_ID_TL}", fill='gray', font=font_small)

# Save TL label
label_tl.save(SCRIPT_DIR / "label_TL.png", dpi=(DPI, DPI))

# === BR Label ===
label_br = Image.new('RGB', (WIDTH_PX, HEIGHT_PX), 'white')
draw_br = ImageDraw.Draw(label_br)

# Marker in top-left, vertically centered
marker_x = margin
marker_y = (HEIGHT_PX - MARKER_SIZE) // 2
label_br.paste(marker_br_pil, (marker_x, marker_y))

# Add small ID label to the right of marker
draw_br.text((marker_x + MARKER_SIZE + 5, marker_y + MARKER_SIZE // 2), f"ID:{MARKER_ID_BR}", fill='gray', font=font_small)

# Text "BR" in bottom-right
br_bbox = draw_br.textbbox((0, 0), "BR", font=font_large)
br_text_width = br_bbox[2] - br_bbox[0]
br_text_height = br_bbox[3] - br_bbox[1]
text_x = WIDTH_PX - br_text_width - margin
text_y = HEIGHT_PX - br_text_height - margin - 10
draw_br.text((text_x, text_y), "BR", fill='black', font=font_large)

# Save BR label
label_br.save(SCRIPT_DIR / "label_BR.png", dpi=(DPI, DPI))

# === TR Label ===
label_tr = Image.new('RGB', (WIDTH_PX, HEIGHT_PX), 'white')
draw_tr = ImageDraw.Draw(label_tr)

# Text "TR" in top-right
tr_bbox = draw_tr.textbbox((0, 0), "TR", font=font_large)
tr_text_width = tr_bbox[2] - tr_bbox[0]
text_x = WIDTH_PX - tr_text_width - margin
draw_tr.text((text_x, margin), "TR", fill='black', font=font_large)

# Marker in bottom-left, vertically centered
marker_x = margin
marker_y = (HEIGHT_PX - MARKER_SIZE) // 2
label_tr.paste(marker_tr_pil, (marker_x, marker_y))

# Add small ID label to the right of marker
draw_tr.text((marker_x + MARKER_SIZE + 5, marker_y + MARKER_SIZE // 2), f"ID:{MARKER_ID_TR}", fill='gray', font=font_small)

# Save TR label
label_tr.save(SCRIPT_DIR / "label_TR.png", dpi=(DPI, DPI))

# === BL Label ===
label_bl = Image.new('RGB', (WIDTH_PX, HEIGHT_PX), 'white')
draw_bl = ImageDraw.Draw(label_bl)

# Text "BL" in bottom-left
bl_bbox = draw_bl.textbbox((0, 0), "BL", font=font_large)
bl_text_height = bl_bbox[3] - bl_bbox[1]
text_y = HEIGHT_PX - bl_text_height - margin - 10
draw_bl.text((margin, text_y), "BL", fill='black', font=font_large)

# Marker in top-right, vertically centered
marker_x = WIDTH_PX - MARKER_SIZE - margin
marker_y = (HEIGHT_PX - MARKER_SIZE) // 2
label_bl.paste(marker_bl_pil, (marker_x, marker_y))

# Add small ID label to the left of marker
draw_bl.text((marker_x - 40, marker_y + MARKER_SIZE // 2), f"ID:{MARKER_ID_BL}", fill='gray', font=font_small)

# Save BL label
label_bl.save(SCRIPT_DIR / "label_BL.png", dpi=(DPI, DPI))

print("Labels created:")
print(f"  - {SCRIPT_DIR / 'label_TL.png'}")
print(f"  - {SCRIPT_DIR / 'label_TR.png'}")
print(f"  - {SCRIPT_DIR / 'label_BL.png'}")
print(f"  - {SCRIPT_DIR / 'label_BR.png'}")
print(f"Dimensions: {WIDTH_PX}x{HEIGHT_PX} pixels ({WIDTH_INCHES}\"x{HEIGHT_INCHES}\" at {DPI} DPI)")
print()
print("=== ArUco Marker Detection Info ===")
print(f"Dictionary: cv2.aruco.DICT_4X4_50")
print(f"TL Marker ID: {MARKER_ID_TL} (bottom-right of label)")
print(f"TR Marker ID: {MARKER_ID_TR} (bottom-left of label)")
print(f"BL Marker ID: {MARKER_ID_BL} (top-right of label)")
print(f"BR Marker ID: {MARKER_ID_BR} (top-left of label)")
print(f"Marker size: {MARKER_SIZE}x{MARKER_SIZE} pixels")

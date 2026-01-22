#!/usr/bin/env python3
"""
Detect drawer grid and labels using image processing techniques.
"""

import cv2
import numpy as np
import json
import subprocess
import re
from pathlib import Path

INPUT_IMAGE = Path("original.png")
OUTPUT_DIR = Path(".")
GRID_ROWS = 8
GRID_COLS = 8


def find_drawer_rectangles(img):
    """
    Approach A: Find rectangles that match expected drawer shape using edge detection.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape

    expected_width = width / GRID_COLS
    expected_height = height / GRID_ROWS

    print(f"Expected drawer size: {expected_width:.0f} x {expected_height:.0f}")

    # Edge detection
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 100)

    # Dilate to connect edges
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges_dilated = cv2.dilate(edges, kernel, iterations=1)

    # Find contours
    contours, _ = cv2.findContours(edges_dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    drawer_candidates = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)

        if w < 100 or h < 100:
            continue

        aspect = w / h

        # Check if size and aspect ratio match a drawer
        width_ok = expected_width * 0.5 < w < expected_width * 1.5
        height_ok = expected_height * 0.5 < h < expected_height * 1.5
        aspect_ok = 0.8 < aspect < 2.0

        if width_ok and height_ok and aspect_ok:
            drawer_candidates.append({
                'x': x, 'y': y, 'w': w, 'h': h,
                'cx': x + w/2, 'cy': y + h/2
            })

    print(f"Found {len(drawer_candidates)} drawer candidates")
    return drawer_candidates


def cluster_positions(positions, expected_count):
    """Cluster 1D positions into expected_count groups."""
    if len(positions) < expected_count:
        return None

    positions = sorted(positions)
    min_pos = min(positions)
    max_pos = max(positions)
    span = max_pos - min_pos

    if span == 0:
        return None

    expected_spacing = span / (expected_count - 1)

    # Group nearby positions
    clusters = []
    current_cluster = [positions[0]]

    for pos in positions[1:]:
        if pos - current_cluster[-1] < expected_spacing * 0.6:
            current_cluster.append(pos)
        else:
            clusters.append(current_cluster)
            current_cluster = [pos]
    clusters.append(current_cluster)

    centers = [np.mean(c) for c in clusters]
    return centers


def find_grid_from_drawers(img):
    """
    Detect grid bounds by finding drawer-shaped rectangles and clustering their positions.
    """
    height, width = img.shape[:2]

    candidates = find_drawer_rectangles(img)

    if not candidates:
        print("No drawer candidates found")
        return None

    x_positions = [c['cx'] for c in candidates]
    y_positions = [c['cy'] for c in candidates]

    col_centers = cluster_positions(x_positions, GRID_COLS)
    row_centers = cluster_positions(y_positions, GRID_ROWS)

    if col_centers and row_centers:
        print(f"Found {len(col_centers)} column clusters, {len(row_centers)} row clusters")

        # Calculate grid bounds from cluster centers
        if len(col_centers) > 1:
            cell_w = (col_centers[-1] - col_centers[0]) / (len(col_centers) - 1)
            left = col_centers[0] - cell_w / 2
            right = col_centers[-1] + cell_w / 2
        else:
            left = min(x_positions) - 50
            right = max(x_positions) + 50

        if len(row_centers) > 1:
            cell_h = (row_centers[-1] - row_centers[0]) / (len(row_centers) - 1)
            top = row_centers[0] - cell_h / 2
            bottom = row_centers[-1] + cell_h / 2
        else:
            top = min(y_positions) - 50
            bottom = max(y_positions) + 50

        bounds = (int(left), int(top), int(right), int(bottom))
        print(f"Grid bounds: {bounds}")
        return bounds

    return None


def find_white_labels(img):
    """
    Find white label rectangles in the image.
    Labels are white rectangles typically at the bottom of each drawer.
    """
    height, width = img.shape[:2]

    # Convert to HSV for better color detection
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # White has low saturation and high value
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 40, 255])

    white_mask = cv2.inRange(hsv, lower_white, upper_white)

    # Clean up the mask
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    white_mask = cv2.morphologyEx(white_mask, cv2.MORPH_CLOSE, kernel)
    white_mask = cv2.morphologyEx(white_mask, cv2.MORPH_OPEN, kernel)

    # Find contours of white regions
    contours, _ = cv2.findContours(white_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    labels = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)

        # Filter by size and aspect ratio (labels are wider than tall)
        # Also filter out labels at the very edge of the image (false positives)
        if (w > 100 and h > 20 and h < 150 and w/h > 2 and area > 3000
            and y > 50 and y < height - 100  # Not at top/bottom edge
            and x > 50 and x < width - 100):  # Not at left/right edge
            labels.append({
                'x': x,
                'y': y,
                'w': w,
                'h': h,
                'cx': x + w/2,  # center x
                'cy': y + h/2,  # center y
                'area': area
            })

    # Sort by position (top to bottom, left to right)
    labels.sort(key=lambda l: (l['y'], l['x']))

    print(f"Found {len(labels)} potential labels")
    return labels


def find_grid_from_labels(labels, img_size):
    """
    Determine the grid structure by analyzing label positions.
    """
    if not labels:
        return None

    width, height = img_size

    # Get all y positions (rows) and x positions (cols)
    y_positions = sorted(set(l['cy'] for l in labels))
    x_positions = sorted(set(l['cx'] for l in labels))

    # Cluster positions into rows and columns
    def cluster_positions(positions, expected_count, tolerance_factor=0.05):
        if len(positions) < expected_count:
            return None

        # Use k-means-like clustering
        positions = np.array(positions)
        min_pos = positions.min()
        max_pos = positions.max()
        span = max_pos - min_pos

        # Expected spacing
        expected_spacing = span / (expected_count - 1) if expected_count > 1 else span

        # Group positions
        clusters = []
        current_cluster = [positions[0]]

        for pos in positions[1:]:
            if pos - current_cluster[-1] < expected_spacing * 0.5:
                current_cluster.append(pos)
            else:
                clusters.append(np.mean(current_cluster))
                current_cluster = [pos]
        clusters.append(np.mean(current_cluster))

        return clusters

    row_centers = cluster_positions(y_positions, GRID_ROWS)
    col_centers = cluster_positions(x_positions, GRID_COLS)

    if row_centers and col_centers:
        print(f"Detected {len(row_centers)} row clusters, {len(col_centers)} column clusters")
        return {
            'row_centers': row_centers,
            'col_centers': col_centers
        }

    return None


def assign_labels_to_grid(labels, img_size, case_bounds=None):
    """
    Assign detected labels to grid positions based on their coordinates.
    Uses case_bounds if provided, otherwise falls back to label positions.
    """
    if not labels:
        return {}, None

    width, height = img_size

    if case_bounds:
        grid_left, grid_top, grid_right, grid_bottom = case_bounds
        print(f"Using case bounds for grid: ({grid_left}, {grid_top}) to ({grid_right}, {grid_bottom})")
    else:
        # Fallback to label-based bounds
        min_x = min(l['x'] for l in labels)
        max_x = max(l['x'] + l['w'] for l in labels)
        min_y = min(l['y'] for l in labels)
        max_y = max(l['y'] + l['h'] for l in labels)

        grid_left = min_x - 50
        grid_right = max_x + 50
        grid_top = min_y - 350
        grid_bottom = max_y + 20
        print(f"Using label-based bounds for grid: ({grid_left}, {grid_top}) to ({grid_right}, {grid_bottom})")

    grid_width = grid_right - grid_left
    grid_height = grid_bottom - grid_top

    cell_width = grid_width / GRID_COLS
    cell_height = grid_height / GRID_ROWS

    print(f"Cell size: {cell_width:.1f} x {cell_height:.1f}")

    # Assign each label to a grid cell based on label center position
    grid_labels = {}
    for label in labels:
        # Use center of label
        cx = label['cx']
        cy = label['cy']

        # Calculate grid position
        col = int((cx - grid_left) / cell_width)
        row = int((cy - grid_top) / cell_height)

        # Clamp to valid range
        col = max(0, min(col, GRID_COLS - 1))
        row = max(0, min(row, GRID_ROWS - 1))

        key = (row + 1, col + 1)  # 1-indexed

        # Keep the label with the largest area for each position
        if key not in grid_labels or label['area'] > grid_labels[key]['area']:
            grid_labels[key] = label

    grid_info = {
        'left': grid_left,
        'top': grid_top,
        'right': grid_right,
        'bottom': grid_bottom,
        'cell_width': cell_width,
        'cell_height': cell_height
    }

    return grid_labels, grid_info


def clean_ocr_text(text):
    """Clean up OCR artifacts from the text."""
    if not text:
        return ""

    # Remove pipe characters from edges
    text = text.strip('| \t\n')
    text = re.sub(r'^\|+\s*', '', text)
    text = re.sub(r'\s*\|+$', '', text)

    # Fix common OCR errors
    text = text.replace('|', 'l')

    # Remove multiple spaces
    text = re.sub(r'\s+', ' ', text)

    # Remove other artifacts
    text = text.strip(' -_.,;:\'"')

    return text


def extract_and_ocr_label(img, label_info, row, col):
    """
    Extract the label region and run OCR on it.
    """
    x, y, w, h = label_info['x'], label_info['y'], label_info['w'], label_info['h']

    # Add some padding
    pad = 3
    x1 = max(0, x + pad)
    y1 = max(0, y + pad)
    x2 = min(img.shape[1], x + w - pad)
    y2 = min(img.shape[0], y + h - pad)

    label_img = img[y1:y2, x1:x2]

    # Convert to grayscale
    if len(label_img.shape) == 3:
        label_gray = cv2.cvtColor(label_img, cv2.COLOR_BGR2GRAY)
    else:
        label_gray = label_img

    # Threshold to get black text on white background
    _, label_binary = cv2.threshold(label_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Save label image
    label_path = OUTPUT_DIR / f"label_r{row}_c{col}.png"
    cv2.imwrite(str(label_path), label_binary)

    # Run OCR
    try:
        result = subprocess.run(
            ["tesseract", str(label_path), "stdout", "--psm", "7", "-l", "eng"],
            capture_output=True,
            text=True,
            timeout=10
        )
        text = result.stdout.strip()
        text = clean_ocr_text(text)
        return text
    except Exception as e:
        print(f"OCR error: {e}")
        return ""


def save_debug_image(img, labels, grid_labels, grid_info, output_path="debug_detection.png"):
    """
    Save a scaled-down debug image showing detected labels and grid assignments.
    """
    # Scale down for easier viewing
    scale = 0.25
    height, width = img.shape[:2]
    new_width = int(width * scale)
    new_height = int(height * scale)

    debug_img = cv2.resize(img, (new_width, new_height))

    # Draw all detected labels in blue
    for label in labels:
        x1 = int(label['x'] * scale)
        y1 = int(label['y'] * scale)
        x2 = int((label['x'] + label['w']) * scale)
        y2 = int((label['y'] + label['h']) * scale)
        cv2.rectangle(debug_img, (x1, y1), (x2, y2), (255, 0, 0), 1)

    # Draw grid-assigned labels in green with their grid position
    for (row, col), label in grid_labels.items():
        x1 = int(label['x'] * scale)
        y1 = int(label['y'] * scale)
        x2 = int((label['x'] + label['w']) * scale)
        y2 = int((label['y'] + label['h']) * scale)
        cv2.rectangle(debug_img, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Add grid position text
        text = f"{row},{col}"
        cv2.putText(debug_img, text, (x1, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)

    # Draw grid lines using the provided grid_info
    if grid_info:
        grid_left = grid_info['left']
        grid_right = grid_info['right']
        grid_top = grid_info['top']
        grid_bottom = grid_info['bottom']
        cell_width = grid_info['cell_width']
        cell_height = grid_info['cell_height']

        # Draw vertical grid lines
        for i in range(GRID_COLS + 1):
            x = int((grid_left + i * cell_width) * scale)
            cv2.line(debug_img, (x, int(grid_top * scale)), (x, int(grid_bottom * scale)), (0, 0, 255), 1)

        # Draw horizontal grid lines
        for i in range(GRID_ROWS + 1):
            y = int((grid_top + i * cell_height) * scale)
            cv2.line(debug_img, (int(grid_left * scale), y), (int(grid_right * scale), y), (0, 0, 255), 1)

    cv2.imwrite(str(output_path), debug_img)
    print(f"Saved debug image to {output_path}")


def main():
    print("=" * 50)
    print("Detecting drawer labels using image processing")
    print("=" * 50)

    # Load image
    img = cv2.imread(str(INPUT_IMAGE))
    if img is None:
        print(f"Error: Could not load {INPUT_IMAGE}")
        return

    height, width = img.shape[:2]
    print(f"Image size: {width} x {height}")

    # Step 1: Detect grid from drawer rectangles (Approach A)
    print("\n--- Detecting grid from drawer rectangles ---")
    case_bounds = find_grid_from_drawers(img)

    # Step 2: Find white labels
    print("\n--- Finding white labels ---")
    labels = find_white_labels(img)

    # Step 3: Analyze grid structure from labels
    print("\n--- Analyzing grid structure ---")
    label_grid_info = find_grid_from_labels(labels, (width, height))

    # Step 4: Assign labels to grid positions using case bounds
    print("\n--- Assigning labels to grid ---")
    grid_labels, grid_info = assign_labels_to_grid(labels, (width, height), case_bounds)

    print(f"Assigned {len(grid_labels)} labels to grid positions")

    # Save debug visualization
    save_debug_image(img, labels, grid_labels, grid_info, OUTPUT_DIR / "debug_detection.png")

    # Debug: print assigned positions
    for key in sorted(grid_labels.keys()):
        label = grid_labels[key]
        print(f"  Grid ({key[0]}, {key[1]}): label at ({label['x']}, {label['y']})")

    # Step 4: Extract and OCR each label
    print("\n--- Running OCR on labels ---")
    results = []

    for row in range(1, GRID_ROWS + 1):
        for col in range(1, GRID_COLS + 1):
            key = (row, col)
            if key in grid_labels:
                text = extract_and_ocr_label(img, grid_labels[key], row, col)
                print(f"Row {row}, Col {col}: '{text}'")
            else:
                text = ""
                print(f"Row {row}, Col {col}: [no label detected]")

            results.append({
                "row": row,
                "col": col,
                "text": text
            })

    # Save results
    output_file = OUTPUT_DIR / "ocr_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved results to {output_file}")

    # Summary
    detected = sum(1 for r in results if r["text"])
    print(f"\nSummary: {detected}/64 cells have detected text")


if __name__ == "__main__":
    main()

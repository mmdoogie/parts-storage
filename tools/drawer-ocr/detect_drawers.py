#!/usr/bin/env python3
"""
Detect drawer grid and labels using image processing techniques.

Uses ArUco markers at all four corners to define the case boundaries and
perform perspective correction:
- Marker ID 1 (DICT_4X4_50): Top-left corner of case frame
- Marker ID 2 (DICT_4X4_50): Bottom-right corner of case frame
- Marker ID 3 (DICT_4X4_50): Top-right corner of case frame
- Marker ID 4 (DICT_4X4_50): Bottom-left corner of case frame

Requires a layout template name to be specified via --layout argument.
Layout templates are fetched from the storage-info API.
"""

import argparse
import base64
import cv2
import numpy as np
import json
import os
import requests
import re
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(Path(__file__).parent / ".env")

# ArUco marker settings (must match label-generator)
ARUCO_DICT = cv2.aruco.DICT_4X4_50
MARKER_ID_TL = 1  # Top-left corner marker
MARKER_ID_BR = 2  # Bottom-right corner marker
MARKER_ID_TR = 3  # Top-right corner marker
MARKER_ID_BL = 4  # Bottom-left corner marker

# API settings
DEFAULT_API_URL = "http://localhost:3002"


def fetch_layout_templates(api_url):
    """Fetch all layout templates from the API."""
    try:
        response = requests.get(f"{api_url}/api/v1/layout-templates")
        response.raise_for_status()
        result = response.json()
        # API returns {"success": true, "data": [...]}
        if isinstance(result, dict) and 'data' in result:
            return result['data']
        return result
    except requests.RequestException as e:
        print(f"Error fetching layout templates: {e}")
        return None


def find_layout_by_name(templates, name):
    """Find a layout template by name (case-insensitive partial match)."""
    name_lower = name.lower()
    for template in templates:
        if name_lower in template['name'].lower():
            return template
    return None


def list_available_layouts(templates):
    """Print a list of available layout templates."""
    print("\nAvailable layout templates:")
    for t in templates:
        drawer_count = len(t.get('layoutData', []))
        print(f"  - {t['name']} ({t['columns']}x{t['rows']}, {drawer_count} drawers)")
    print()


def find_aruco_markers(img):
    """
    Detect all four ArUco markers and return the corner points.

    Marker positions on labels (marker corner used for case corner):
    - TL marker (ID 1): bottom-right of label -> use bottom-right corner of marker
    - TR marker (ID 3): bottom-left of label -> use bottom-left corner of marker
    - BL marker (ID 4): top-right of label -> use top-right corner of marker
    - BR marker (ID 2): top-left of label -> use top-left corner of marker

    Returns:
        dict with 'tl', 'tr', 'bl', 'br' corner points, or None if markers not found
    """
    aruco_dict = cv2.aruco.getPredefinedDictionary(ARUCO_DICT)
    parameters = cv2.aruco.DetectorParameters()
    detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)

    corners, ids, rejected = detector.detectMarkers(img)

    if ids is None:
        print("No ArUco markers detected")
        return None

    print(f"Detected ArUco markers: {ids.flatten().tolist()}")

    found_corners = {}

    for i, marker_id in enumerate(ids.flatten()):
        # corners[i][0] contains the 4 corners of the marker in order:
        # [top-left, top-right, bottom-right, bottom-left]
        marker_corners = corners[i][0]

        if marker_id == MARKER_ID_TL:
            # TL marker is in bottom-right of label, use its bottom-right corner
            found_corners['tl'] = marker_corners[2]  # bottom-right of marker
            print(f"  TL marker (ID {MARKER_ID_TL}) -> case TL: {found_corners['tl']}")
        elif marker_id == MARKER_ID_TR:
            # TR marker is in bottom-left of label, use its bottom-left corner
            found_corners['tr'] = marker_corners[3]  # bottom-left of marker
            print(f"  TR marker (ID {MARKER_ID_TR}) -> case TR: {found_corners['tr']}")
        elif marker_id == MARKER_ID_BL:
            # BL marker is in top-right of label, use its top-right corner
            found_corners['bl'] = marker_corners[1]  # top-right of marker
            print(f"  BL marker (ID {MARKER_ID_BL}) -> case BL: {found_corners['bl']}")
        elif marker_id == MARKER_ID_BR:
            # BR marker is in top-left of label, use its top-left corner
            found_corners['br'] = marker_corners[0]  # top-left of marker
            print(f"  BR marker (ID {MARKER_ID_BR}) -> case BR: {found_corners['br']}")

    # Check all four corners were found
    required = ['tl', 'tr', 'bl', 'br']
    missing = [c for c in required if c not in found_corners]
    if missing:
        marker_ids = {'tl': MARKER_ID_TL, 'tr': MARKER_ID_TR, 'bl': MARKER_ID_BL, 'br': MARKER_ID_BR}
        missing_str = ', '.join(f"{c.upper()} (ID {marker_ids[c]})" for c in missing)
        print(f"Missing markers: {missing_str}")
        return None

    return found_corners


def perspective_transform(img, corners, output_size=None):
    """
    Apply perspective transform to warp the image to a flat rectangle.

    Args:
        img: Input image
        corners: dict with 'tl', 'tr', 'bl', 'br' corner points
        output_size: (width, height) of output image, or None to auto-calculate

    Returns:
        tuple: (warped_image, case_bounds)
        case_bounds is (0, 0, width, height) since image is now rectified
    """
    # Source points (the detected corners in the original image)
    src_pts = np.array([
        corners['tl'],
        corners['tr'],
        corners['br'],
        corners['bl']
    ], dtype=np.float32)

    # Calculate output size if not specified
    if output_size is None:
        # Use the maximum width and height from the quadrilateral
        width_top = np.linalg.norm(corners['tr'] - corners['tl'])
        width_bottom = np.linalg.norm(corners['br'] - corners['bl'])
        height_left = np.linalg.norm(corners['bl'] - corners['tl'])
        height_right = np.linalg.norm(corners['br'] - corners['tr'])

        width = int(max(width_top, width_bottom))
        height = int(max(height_left, height_right))
    else:
        width, height = output_size

    # Destination points (rectangle)
    dst_pts = np.array([
        [0, 0],           # TL
        [width - 1, 0],   # TR
        [width - 1, height - 1],  # BR
        [0, height - 1]   # BL
    ], dtype=np.float32)

    # Compute perspective transform matrix
    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)

    # Apply the transform
    warped = cv2.warpPerspective(img, matrix, (width, height))

    print(f"Perspective transform: {img.shape[1]}x{img.shape[0]} -> {width}x{height}")

    # Case bounds are now the full rectified image
    case_bounds = (0, 0, width, height)

    return warped, case_bounds


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
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    white_mask = cv2.morphologyEx(white_mask, cv2.MORPH_OPEN, kernel)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
    white_mask = cv2.morphologyEx(white_mask, cv2.MORPH_CLOSE, kernel)

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


def assign_labels_to_grid(labels, case_bounds, layout):
    """
    Assign detected labels to grid positions based on their coordinates.
    Uses case_bounds from ArUco marker detection and layout template for grid dimensions.
    """
    if not labels:
        return {}, None

    grid_cols = layout['columns']
    grid_rows = layout['rows']
    layout_data = layout.get('layoutData', [])

    # Build set of valid drawer positions from layout
    valid_positions = {(d['row'], d['col']) for d in layout_data}

    grid_left, grid_top, grid_right, grid_bottom = case_bounds
    print(f"Using case bounds for grid: ({grid_left}, {grid_top}) to ({grid_right}, {grid_bottom})")

    grid_width = grid_right - grid_left
    grid_height = grid_bottom - grid_top

    cell_width = grid_width / grid_cols
    cell_height = grid_height / grid_rows

    print(f"Grid: {grid_cols} cols x {grid_rows} rows")
    print(f"Cell size: {cell_width:.1f} x {cell_height:.1f}")
    print(f"Layout has {len(valid_positions)} drawer positions")

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
        col = max(0, min(col, grid_cols - 1))
        row = max(0, min(row, grid_rows - 1))

        key = (row + 1, col + 1)  # 1-indexed

        # Only accept labels that fall within valid drawer positions
        if key not in valid_positions:
            continue

        # Keep the label with the largest area for each position
        if key not in grid_labels or label['area'] > grid_labels[key]['area']:
            grid_labels[key] = label

    grid_info = {
        'left': grid_left,
        'top': grid_top,
        'right': grid_right,
        'bottom': grid_bottom,
        'cell_width': cell_width,
        'cell_height': cell_height,
        'columns': grid_cols,
        'rows': grid_rows
    }

    return grid_labels, grid_info


def extract_and_ocr_label(img, label_info, row, col, output_dir):
    """
    Extract the label region and run OCR using Ollama vision model.
    """
    x, y, w, h = label_info['x'], label_info['y'], label_info['w'], label_info['h']

    # Add some padding
    pad = 3
    x1 = max(0, x + pad)
    y1 = max(0, y + pad)
    x2 = min(img.shape[1], x + w - pad)
    y2 = min(img.shape[0], y + h - pad)

    label_img = img[y1:y2, x1:x2]

    # Save label image (keep color for vision model)
    label_path = output_dir / f"label_r{row}_c{col}.png"
    cv2.imwrite(str(label_path), label_img)

    # Get Ollama configuration from environment
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama_model = os.getenv("OLLAMA_MODEL", "llava")
    ollama_prompt = os.getenv("OLLAMA_PROMPT",
        "Extract the text from this label image. Return ONLY the text content, nothing else.")

    # Encode image as base64
    _, buffer = cv2.imencode('.png', label_img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')

    # Call Ollama API
    try:
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                "model": ollama_model,
                "prompt": ollama_prompt,
                "images": [img_base64],
                "stream": False
            },
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        text = result.get("response", "").strip()
        return text
    except Exception as e:
        print(f"Ollama OCR error: {e}")
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
        cv2.rectangle(debug_img, (x1, y1), (x2, y2), (255, 0, 0), 2)

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
        grid_cols = grid_info['columns']
        grid_rows = grid_info['rows']

        # Draw vertical grid lines
        for i in range(grid_cols + 1):
            x = int((grid_left + i * cell_width) * scale)
            cv2.line(debug_img, (x, int(grid_top * scale)), (x, int(grid_bottom * scale)), (0, 0, 255), 1)

        # Draw horizontal grid lines
        for i in range(grid_rows + 1):
            y = int((grid_top + i * cell_height) * scale)
            cv2.line(debug_img, (int(grid_left * scale), y), (int(grid_right * scale), y), (0, 0, 255), 1)

    cv2.imwrite(str(output_path), debug_img)
    print(f"Saved debug image to {output_path}")


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Detect drawer labels using ArUco markers and OCR.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --layout "8x8" image.png
  %(prog)s --layout "Akro-Mils 10164" --api-url http://localhost:3000 photo.jpg
  %(prog)s --list-layouts
        """
    )
    parser.add_argument(
        "image",
        nargs="?",
        type=Path,
        help="Input image file"
    )
    parser.add_argument(
        "--layout", "-l",
        required=False,
        help="Layout template name (partial match, case-insensitive)"
    )
    parser.add_argument(
        "--api-url",
        default=DEFAULT_API_URL,
        help=f"API base URL (default: {DEFAULT_API_URL})"
    )
    parser.add_argument(
        "--list-layouts",
        action="store_true",
        help="List available layout templates and exit"
    )
    parser.add_argument(
        "--output-dir", "-o",
        type=Path,
        default=Path("."),
        help="Output directory for results (default: current directory)"
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # Fetch layout templates from API
    print(f"Fetching layout templates from {args.api_url}...")
    templates = fetch_layout_templates(args.api_url)
    if templates is None:
        print("Error: Could not fetch layout templates from API")
        sys.exit(1)

    # List layouts and exit if requested
    if args.list_layouts:
        list_available_layouts(templates)
        sys.exit(0)

    # Require --layout and image if not listing
    if not args.layout:
        print("Error: --layout is required")
        list_available_layouts(templates)
        sys.exit(1)

    if not args.image:
        print("Error: image file is required")
        sys.exit(1)

    # Find the layout template
    layout = find_layout_by_name(templates, args.layout)
    if layout is None:
        print(f"Error: No layout template matching '{args.layout}'")
        list_available_layouts(templates)
        sys.exit(1)

    print("=" * 50)
    print("Detecting drawer labels using image processing")
    print("=" * 50)
    print(f"Layout: {layout['name']} ({layout['columns']}x{layout['rows']})")

    # Load image
    img = cv2.imread(str(args.image))
    if img is None:
        print(f"Error: Could not load {args.image}")
        sys.exit(1)

    height, width = img.shape[:2]
    print(f"Image size: {width} x {height}")

    output_dir = args.output_dir

    # Step 1: Detect all four ArUco markers
    print("\n--- Detecting ArUco markers ---")
    corners = find_aruco_markers(img)
    if corners is None:
        print("Error: Could not detect all ArUco markers.")
        print("Ensure markers ID 1 (TL), ID 2 (BR), ID 3 (TR), and ID 4 (BL) are visible.")
        sys.exit(1)

    # Step 2: Apply perspective transform to rectify the image
    print("\n--- Applying perspective correction ---")
    img_rectified, case_bounds = perspective_transform(img, corners)

    # Save the rectified image for debugging
    cv2.imwrite(str(output_dir / "rectified.png"), img_rectified)
    print(f"Saved rectified image to {output_dir / 'rectified.png'}")

    # Step 3: Find white labels in the rectified image
    print("\n--- Finding white labels ---")
    labels = find_white_labels(img_rectified)

    # Step 4: Assign labels to grid positions using case bounds and layout
    print("\n--- Assigning labels to grid ---")
    grid_labels, grid_info = assign_labels_to_grid(labels, case_bounds, layout)

    print(f"Assigned {len(grid_labels)} labels to grid positions")

    # Save debug visualization (using rectified image)
    save_debug_image(img_rectified, labels, grid_labels, grid_info, output_dir / "debug_detection.png")

    # Debug: print assigned positions
    for key in sorted(grid_labels.keys()):
        label = grid_labels[key]
        print(f"  Grid ({key[0]}, {key[1]}): label at ({label['x']}, {label['y']})")

    # Step 5: Extract and OCR each label based on layout positions
    print("\n--- Running OCR on labels ---")
    results = []
    layout_data = layout.get('layoutData', [])

    for drawer in layout_data:
        row = drawer['row']
        col = drawer['col']
        key = (row, col)

        if key in grid_labels:
            text = extract_and_ocr_label(img_rectified, grid_labels[key], row, col, output_dir)
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
    output_file = output_dir / "ocr_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved results to {output_file}")

    # Summary
    total_drawers = len(layout_data)
    detected = sum(1 for r in results if r["text"])
    print(f"\nSummary: {detected}/{total_drawers} drawers have detected text")


if __name__ == "__main__":
    main()

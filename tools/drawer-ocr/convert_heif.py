import sys
from pillow_heif import register_heif_opener
from PIL import Image
register_heif_opener()
img = Image.open(sys.argv[1])
img.save(f'{sys.argv[1]}.png')
print(f'Image size: {img.size}')
print(f'Image mode: {img.mode}')

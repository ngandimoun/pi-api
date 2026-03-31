from __future__ import annotations

import base64
import io
import re

import numpy as np
from PIL import Image

_DATA_URL_RE = re.compile(r"^data:(?P<mime>[^;]+);base64,(?P<data>.+)$", re.IGNORECASE)


def decode_image_to_rgb_np(data: str) -> np.ndarray:
    """
    Decode a base64 string (optionally a data: URL) into an RGB numpy array (H, W, 3) uint8.
    """
    s = data.strip()
    m = _DATA_URL_RE.match(s)
    if m:
        s = m.group("data")

    raw = base64.b64decode(s, validate=True)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.asarray(img, dtype=np.uint8)


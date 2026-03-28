---
title: Nano Banana (Gemini native image generation) — reference for piii
last_reviewed: 2025-03-25
official:
  - https://ai.google.dev/gemini-api/docs/image-generation
  - https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview
  - https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview
  - https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image
---

# Nano Banana / Gemini native image generation

Prompt-to-image and conversational image workflows via the **Gemini API**. Try a bundled app: [Nano Banana 2 app (AI Studio)](https://aistudio.google.com/apps/bundled/pet_passport).

**Nano Banana** is the product name for Gemini’s native image generation and editing (text, images, or both). All generated images include a [SynthID watermark](https://ai.google.dev/responsible/docs/safeguards/synthid).

## Section 0 — piii policy (canonical)

| Item | Value |
|------|--------|
| **Default model for native Gemini image generation in this repo** | `gemini-3.1-flash-image-preview` (**Nano Banana 2**) |
| **Do not substitute** | `gemini-3-pro-image-preview`, `gemini-2.5-flash-image`, Imagen, or other image models **unless the task owner explicitly overrides** |
| **Rationale** | Speed, cost/latency balance, and feature set (see Google’s model selection guidance below) |
| **Other models in this file** | Documented for awareness and future product decisions only |

---

## Section 1 — Capability matrix (read before designing APIs)

| Capability | Notes |
|------------|--------|
| Text → image | `generateContent` with text `parts` |
| Image + text → image (edit) | Same API; include `inline_data` / `inlineData` image parts + text |
| Multi-turn / chat | Recommended for iteration; preserve history; SDK chat handles **thought signatures** automatically |
| Response shape | Parts may be **text** and/or **image** (`inline_data`); iterate `response.parts` or `candidates[0].content.parts` |
| `responseModalities` / `response_modalities` | Default often text+image; set `['IMAGE']` or `["IMAGE"]` for image-only |
| `imageConfig` / `image_config` | `aspectRatio`, `imageSize` (`512`, `1K`, `2K`, `4K` — use **uppercase K** for K sizes; `512` has no K suffix) |
| Resolutions | 1K default for Gemini 3 image models; 2K/4K supported; **512 (0.5K) only on 3.1 Flash** |
| Aspect ratios (3.1 Flash) | `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9` |
| Up to 14 reference images | **3.1 Flash:** up to **10** object + **4** character images; **3 Pro:** up to **6** object + **5** character (see Google’s table) |
| Google Search grounding | Tool: `google_search` / `googleSearch`; `groundingMetadata`: `searchEntryPoint`, `groundingChunks`, etc. |
| Image Search grounding | **Gemini 3.1 Flash Image only**; `searchTypes`: `webSearch` + `imageSearch`; **cannot search for people**; UI **attribution** requirements for sources |
| Thinking | Enabled by default; interim “thought” images; **3.1 Flash:** `thinkingLevel` `minimal` \| `high`; `includeThoughts`; **thinking tokens billed** whether or not thoughts are returned |
| Thought signatures | Encrypted context for multi-turn; **pass back** on manual REST history; **official SDK chat handles automatically** |
| Batch generation | [Batch API](https://ai.google.dev/gemini-api/docs/batch-api) for high volume (up to ~24h turnaround, higher limits) |
| SynthID | On all generated images |
| Limitations | Best languages listed by Google; **no audio/video** as image-gen input; exact image **count** not guaranteed; 3.1 Flash Search: **no real-world people images from web search** at this time |

---

## Table of contents

1. [Model IDs (Nano Banana family)](#model-ids-nano-banana-family)
2. [REST endpoint pattern](#rest-endpoint-pattern)
3. [Authentication](#authentication)
4. [Text-to-image](#text-to-image)
5. [Image editing (text + image)](#image-editing-text--image)
6. [Multi-turn image editing](#multi-turn-image-editing)
7. [Gemini 3 image features (summary)](#gemini-3-image-features-summary)
8. [Reference images (up to 14)](#reference-images-up-to-14)
9. [Grounding with Google Search](#grounding-with-google-search)
10. [Grounding with Google Search for Images (3.1 Flash)](#grounding-with-google-search-for-images-31-flash)
11. [Resolution and `imageSize`](#resolution-and-imagesize)
12. [Thinking process and thought signatures](#thinking-process-and-thought-signatures)
13. [Optional configurations](#optional-configurations)
14. [Aspect ratio and token tables](#aspect-ratio-and-token-tables)
15. [Model selection (when to use which)](#model-selection-when-to-use-which)
16. [Imagen](#imagen)
17. [Batch API](#batch-api)
18. [Prompting guide (templates)](#prompting-guide-templates)
19. [Prompts for editing images](#prompts-for-editing-images)
20. [Best practices and limitations](#best-practices-and-limitations)
21. [Further reading](#further-reading)

---

## Model IDs (Nano Banana family)

| Marketing name | Model ID |
|----------------|----------|
| **Nano Banana 2** | `gemini-3.1-flash-image-preview` |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` |
| **Nano Banana** (2.5 Flash Image) | `gemini-2.5-flash-image` |

---

## REST endpoint pattern

```http
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent
```

Example: `.../models/gemini-3.1-flash-image-preview:generateContent`

---

## Authentication

Header: `x-goog-api-key: $GEMINI_API_KEY` (or your env name; this repo often uses `GEMINI_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` in scripts).

---

## Text-to-image

### Python (`google.genai`)

```python
from google import genai
from google.genai import types
from PIL import Image

client = genai.Client()

prompt = "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=[prompt],
)

for part in response.parts:
    if part.text is not None:
        print(part.text)
    elif part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
```

### JavaScript (`@google/genai`)

```javascript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({});

const prompt =
  "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme";

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: prompt,
});

for (const part of response.candidates[0].content.parts) {
  if (part.text) {
    console.log(part.text);
  } else if (part.inlineData) {
    const buffer = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync("gemini-native-image.png", buffer);
  }
}
```

### Java (excerpt)

Use `GenerateContentConfig` with `.responseModalities("TEXT", "IMAGE")` when needed.

### REST

```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [
        {"text": "Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"}
      ]
    }]
  }'
```

---

## Image editing (text + image)

**Reminder:** Respect rights to uploaded images; follow [Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy).

Use **inline** image bytes (base64 in JSON). For MIME types and larger payloads, see [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding).

### Python

```python
from google import genai
from PIL import Image

client = genai.Client()
prompt = (
    "Create a picture of my cat eating a nano-banana in a "
    "fancy restaurant under the Gemini constellation"
)
image = Image.open("/path/to/cat_image.png")

response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=[prompt, image],
)
# ... same part loop as text-to-image
```

### JavaScript

```javascript
const imageData = fs.readFileSync(imagePath);
const base64Image = imageData.toString("base64");

const prompt = [
  { text: "Create a picture of my cat eating a nano-banana in a fancy restaurant under the Gemini constellation" },
  { inlineData: { mimeType: "image/png", data: base64Image } },
];

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-image-preview",
  contents: prompt,
});
```

### REST

`parts` array: `{"text": "..."}` then `{"inline_data": {"mime_type": "image/jpeg", "data": "<BASE64>"}}`.

---

## Multi-turn image editing

Use **chat** with `response_modalities` / `responseModalities` including `TEXT` and `IMAGE`, and optional tools e.g. `google_search` / `googleSearch`.

### Python (chat + follow-up with `image_config`)

```python
from google import genai
from google.genai import types

client = genai.Client()

chat = client.chats.create(
    model="gemini-3.1-flash-image-preview",
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        tools=[{"google_search": {}}]
    )
)

message = "Create a vibrant infographic that explains photosynthesis ..."
response = chat.send_message(message)
# extract image parts from response.parts

# Follow-up with aspect ratio + resolution
message2 = "Update this infographic to be in Spanish. Do not change any other elements of the image."
response2 = chat.send_message(
    message2,
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="2K",
        ),
    ),
)
```

### REST (multi-turn with prior image)

Send `contents` as an array of turns: `user` → `model` (with prior `inline_data` image) → `user` (edit instruction), plus `generationConfig` with `responseModalities` and `imageConfig` as needed.

---

## Gemini 3 image features (summary)

- High resolution: **1K**, **2K**, **4K**; **512** on **3.1 Flash** only.
- Advanced on-image text (infographics, menus, etc.); **Pro** emphasized for hardest professional text.
- Grounding with **Google Search**; **3.1 Flash** adds **Image Search** alongside web.
- **Thinking** with optional interim images; final image is the end of the thinking chain for composition.
- Up to **14** reference images (split between object vs character slots — see Google’s table).
- Extra aspect ratios on **3.1 Flash:** `1:4`, `4:1`, `1:8`, `8:1`.

---

## Reference images (up to 14)

| Model | High-fidelity objects | Character consistency |
|-------|----------------------|-------------------------|
| **Gemini 3.1 Flash Image Preview** | Up to 10 | Up to 4 |
| **Gemini 3 Pro Image Preview** | Up to 6 | Up to 5 |

Pass multiple images in `contents` / `parts` (text first or interleaved per SDK patterns) with `GenerateContentConfig` including `response_modalities` and `image_config` (`aspect_ratio`, `image_size`).

---

## Grounding with Google Search

Enables charts/graphics from **real-time** or recent information. With image generation, **image-based web results are not passed into the model** in some modes — see [Grounding with Google Search for images](https://ai.google.dev/gemini-api/docs/image-generation#image-search).

Response includes `groundingMetadata`: **`searchEntryPoint`** (HTML/CSS for required search UI), **`groundingChunks`** (e.g. top web sources).

### Python (excerpt)

```python
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_modalities=['Text', 'Image'],
        image_config=types.ImageConfig(aspect_ratio="16:9"),
        tools=[{"google_search": {}}],
    ),
)
```

---

## Grounding with Google Search for Images (3.1 Flash)

**Only** on `gemini-3.1-flash-image-preview`. Set `googleSearch` tool with `searchTypes: { webSearch: {}, imageSearch: {} }`. **Cannot** use image search for **people**. **Display:** attribute sources (link to **containing page**); if showing source images, **one-click** navigation to that page is required.

`groundingMetadata` may include **`imageSearchQueries`**, **`groundingChunks`** (with `uri`, `image_uri` for image chunks), **`groundingSupports`**, **`searchEntryPoint`**.

---

## Resolution and `imageSize`

Use **`image_size`** / **`imageSize`** in `image_config` / `imageConfig`. Values: **`512`**, **`1K`**, **`2K`**, **`4K`**. Use **uppercase K**. Lowercase (e.g. `1k`) is rejected.

---

## Thinking process and thought signatures

- Thinking runs by default; **cannot disable** in API.
- Inspect thought parts: `part.thought` (and still process final non-thought parts for production output).
- **3.1 Flash:** `thinking_config` / `thinkingConfig`: `thinking_level` / `thinkingLevel`: `minimal` | `high`; `include_thoughts` / `includeThoughts`.
- **Billing:** thinking tokens count **even if** thoughts are hidden.
- **Thought signatures:** return encrypted reasoning state for multi-turn; **round-trip** on custom REST history. **Google GenAI SDK + chat** manages signatures when you append full model responses.

Rules of thumb for signatures (REST):

- Non-thought **`inline_data`** image parts in the final response should carry signatures.
- First **text** part after thoughts may need a signature.
- Thought images **do not** use signatures.

---

## Optional configurations

### Image-only responses

```python
config=types.GenerateContentConfig(response_modalities=['Image'])
```

```json
"generationConfig": { "responseModalities": ["Image"] }
```

---

## Aspect ratio and token tables

### Gemini 3.1 Flash Image Preview

| Aspect ratio | 512 | 1K | 2K | 4K |
|--------------|-----|----|----|-----|
| 1:1 | 512×512 | 1024×1024 | 2048×2048 | 4096×4096 |
| 1:4 | 256×1024 | 512×2048 | 1024×4096 | 2048×8192 |
| 1:8 | 192×1536 | 384×3072 | 768×6144 | 1536×12288 |
| 2:3 | 424×632 | 848×1264 | 1696×2528 | 3392×5056 |
| 3:2 | 632×424 | 1264×848 | 2528×1696 | 5056×3392 |
| 3:4 | 448×600 | 896×1200 | 1792×2400 | 3584×4800 |
| 4:1 | 1024×256 | 2048×512 | 4096×1024 | 8192×2048 |
| 4:3 | 600×448 | 1200×896 | 2400×1792 | 4800×3584 |
| 4:5 | 464×576 | 928×1152 | 1856×2304 | 3712×4608 |
| 5:4 | 576×464 | 1152×928 | 2304×1856 | 4608×3712 |
| 8:1 | 1536×192 | 3072×384 | 6144×768 | 12288×1536 |
| 9:16 | 384×688 | 768×1376 | 1536×2752 | 3072×5504 |
| 16:9 | 688×384 | 1376×768 | 2752×1536 | 5504×3072 |
| 21:9 | 792×168 | 1584×672 | 3168×1344 | 6336×2688 |

(Token counts per resolution tier appear in Google’s docs — use their pricing page for billing.)

### Gemini 3 Pro Image Preview

Aspect ratios: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9` with 1K / 2K / 4K pixel sizes per Google’s table.

### Gemini 2.5 Flash Image

Fixed ~1024px-class sizes per aspect ratio (see Google’s table).

---

## Model selection (when to use which)

- **Nano Banana 2 (`gemini-3.1-flash-image-preview`):** default **go-to** for balance of quality, latency, and cost.
- **Nano Banana Pro (`gemini-3-pro-image-preview`):** professional assets, hardest instructions, **Thinking**, up to 4K.
- **Nano Banana 2.5 (`gemini-2.5-flash-image`):** speed / volume, ~1024px outputs.

**piii:** implement with **3.1 Flash** unless explicitly directed otherwise.

---

## Imagen

Specialized image model family via Gemini API — [Imagen](https://ai.google.dev/gemini-api/docs/imagen). Imagen 4 as default; Ultra for max quality (constraints per Google).

---

## Batch API

[Batch API](https://ai.google.dev/gemini-api/docs/batch-api) for large jobs; see [batch image generation](https://ai.google.dev/gemini-api/docs/batch-api#image-generation) and the [cookbook notebook](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Batch_mode.ipynb).

---

## Prompting guide (templates)

Principle: **describe the scene**, not only keywords — narrative prompts beat disconnected terms.

1. **Photorealistic:** camera, lens, lighting, mood, textures.
2. **Stylized / stickers:** style, palette, line art, **transparent or white background** if needed.
3. **Text in images:** specify copy, font style in words, layout; **Pro** for hardest professional text; consider generating text plan then image.
4. **Product / commercial:** studio lighting, surface, angle, hero detail.
5. **Negative space:** composition for overlays.
6. **Sequential art:** comic/storyboard; reference images help consistency.
7. **Grounding:** news, weather, sports graphics with Search tool.

---

## Prompts for editing images

Patterns (all with `gemini-3.1-flash-image-preview` in examples):

1. **Add/remove** elements — preserve lighting and perspective.
2. **Inpainting (semantic):** “change only X to Y; keep everything else identical.”
3. **Style transfer:** keep composition, change artistic style.
4. **Multi-image compose:** dress on model, collage, etc.
5. **High-fidelity preservation:** describe faces/logos to keep stable.
6. **Sketch to final:** rough medium → finished render.
7. **Character 360:** iterative turns; feed prior outputs back in.

---

## Best practices and limitations

**Practices:** hyper-specific descriptions; state **intent** (use case); iterate in chat; step-by-step for complex scenes; positive wording instead of “no X” lists; camera/cinematic vocabulary.

**Limitations (non-exhaustive — verify on Google’s site):**

- Supported languages include EN, ar-EG, de-DE, es-MX, fr-FR, hi-IN, id-ID, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, ua-UA, vi-VN, zh-CN (among others — check current docs).
- No **audio** or **video** inputs for this image generation path.
- Model may not return the **exact** number of images requested.
- Input image count limits differ by model (e.g. 2.5 Flash ~3 high-quality inputs; 3.x up to 14 with role split).
- For text-in-image workflows, sometimes better to **generate/copy first**, then request the visual.
- **3.1 Flash** + Search: **not** for real-world **people** images from web image search.
- **SynthID** on outputs.

---

## Other modes

- **Interleaved** text + images in and out (e.g. illustrated recipe; “change sofa color and update image”).
- **Go / Java / full REST** samples: mirror the Python/JS patterns above using `google.golang.org/genai` or `com.google.genai` — see [official libraries](https://ai.google.dev/gemini-api/docs/libraries).

---

## Further reading

- [Get started — Nano Banana notebook](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_Started_Nano_Banana.ipynb)
- [Veo (video)](https://ai.google.dev/gemini-api/docs/video)
- [Gemini models overview](https://ai.google.dev/gemini-api/docs/models/gemini)
- [Thinking](https://ai.google.dev/gemini-api/docs/thinking)
- [Thought signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)
- [Google Search tool](https://ai.google.dev/gemini-api/docs/google-search)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)

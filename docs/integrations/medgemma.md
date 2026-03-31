# MedGemma (Google — medical multimodal Gemma)

**MedGemma** is Google’s open **Gemma 3**–based family tuned for **medical text and image** understanding. Use is governed by the **[Health AI Developer Foundations terms of use](https://developers.google.com/health-ai-developer-foundations/terms)** (not interchangeable with generic Gemma terms alone — read the HAI-DEF terms before production).

> **Version note:** **MedGemma 1.5** is currently described as a **4B multimodal instruction-tuned** variant. For **MedGemma 1** (e.g. 4B / 27B variants), use Google’s **[MedGemma 1 model card](https://developers.google.com/health-ai-developer-foundations/medgemma/model-card-v1)**.

## Official documentation (source of truth)

| Resource | Link |
|----------|------|
| MedGemma hub | [developers.google.com/health-ai-developer-foundations/medgemma](https://developers.google.com/health-ai-developer-foundations/medgemma) |
| Model card (current) | [medgemma/model-card](https://developers.google.com/health-ai-developer-foundations/medgemma/model-card) |
| Vertex AI Model Garden | [MedGemma in Model Garden](https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/medgemma) |
| Hugging Face collection | [google/medgemma-release](https://huggingface.co/collections/google/medgemma-release-680aade845f90bec6a3f60c4) |
| Concept apps (HF) | [medgemma-concept-apps](https://huggingface.co/collections/google/medgemma-concept-apps-686ea036adb6d51416b0928a) |
| Code & notebooks | [github.com/google-health/medgemma](https://github.com/google-health/medgemma) |

Support channels are listed under **Get started** on the MedGemma documentation site.

## MedGemma 1.5 (4B IT) — summary

- **Role:** Developer foundation model for **multimodal** healthcare apps (text + images → text). Google expects **validation, adaptation, and fine-tuning** on your use case — not drop-in clinical deployment without that work.
- **Architecture:** **Gemma 3** decoder; **SigLIP**-style image encoder further trained on **de-identified medical** imagery (chest X-ray, dermatology, ophthalmology, histopathology, etc.); LLM trained on mixed medical text, QA, FHIR-style EHR-style data, 2D/3D imaging, documents/labs, etc. (see official **data card** for full detail).
- **Reported strengths in 1.5 vs 1.5’s predecessor (per Google’s card):** Stronger **medical text reasoning**; expanded **3D CT/MRI**, **whole-slide histopathology (WSI)** workflows, **longitudinal chest X-ray** comparison, **anatomical localization** (e.g. bounding boxes on CXR), **structured extraction from lab reports**, and **EHR-flavored text** understanding. Full benchmark tables live in the **[technical report / model card](https://developers.google.com/health-ai-developer-foundations/medgemma/model-card)**.

### When to use MedSigLIP instead

For **medical image** tasks **without** a text-generation component (e.g. data-efficient / zero-shot **classification**, **retrieval**), Google recommends **[MedSigLIP](https://developers.google.com/health-ai-developer-foundations/medsiglip/model-card)** — same encoder family as MedGemma, focused on vision.

## Hugging Face checkpoint (example)

- **`google/medgemma-1.5-4b-it`** — multimodal instruction-tuned 1.5 release.

## Local / HF quick start (high level)

- **Transformers:** Gemma 3 support starts from **transformers ≥ 4.50.0** (per Google’s docs).
- **Task type:** `image-text-to-text` pipeline or `AutoModelForImageTextToText` + `AutoProcessor` — see the official model card for full snippets.
- **Large studies:** **CT**, **MRI**, and **WSI** need **preprocessing**; follow the project notebooks, e.g. [high-dimensional CT](https://github.com/google-health/medgemma/blob/main/notebooks/high_dimensional_ct_hugging_face.ipynb) and [WSI](https://github.com/google-health/medgemma/blob/main/notebooks/high_dimensional_pathology_hugging_face.ipynb).

## Scale / production

For high volume or large studies, Google recommends **Vertex AI Model Garden**, optional **custom MedGemma serving** (DICOM / GCS workflows) and **vLLM** containers — see [model serving overview](https://developers.google.com/health-ai-developer-foundations/model-serving/overview) and [MedGemma serving API](https://developers.google.com/health-ai-developer-foundations/medgemma/serving-api). A **prebuilt Docker image** for server-side image processing is referenced from the official model card (Vertex / Artifact Registry paths change — use current Google docs).

## Intended use and limitations (Pi summary)

From Google’s materials (paraphrased; rely on the **official card** for legal/ethical text):

- **Not** for direct clinical diagnosis, treatment decisions, or patient management **without** your validation, adaptation, and compliance review.
- Outputs are **preliminary**; require **independent verification** and appropriate governance.
- Multimodal evaluation emphasis has been largely **single-image**; **multi-image** and **multi-turn** behaviors may need extra validation.
- **Bias, contamination, and prompt sensitivity** are called out — validate on data representative of your deployment setting.

## Ethics and safety

Google describes structured evaluations and assurance-style reviews (child safety, content safety, representational harms, general medical harms). **English-heavy** safety testing is noted as a limitation in the published card.

## Citation

**MedGemma Technical Report:** Sellergren et al., *arXiv:2507.05201* (2025) — [https://arxiv.org/abs/2507.05201](https://arxiv.org/abs/2507.05201)

```bibtex
@article{sellergren2025medgemma,
  title={MedGemma Technical Report},
  author={Sellergren, Andrew and Kazemzadeh, Sahar and Jaroensri, Tiam and Kiraly, Atilla and others},
  journal={arXiv preprint arXiv:2507.05201},
  year={2025}
}
```

## Pi integration

- **Env-driven only:** Model IDs, endpoints (HF, Vertex, vLLM gateway), and feature flags must **not** be hardcoded in app logic.
- **Gateway:** If exposed through Pi, use Bearer auth, **Zod**, OpenAI-compatible shapes where applicable, and **202 + jobs** for long inference.
- **Gemini coexistence:** MedGemma can complement centralized **Gemini** flows (e.g. local parsing of sensitive data before upstream calls) — design explicitly; follow [gemini-skills.mdc](../../.cursor/rules/gemini-skills.mdc) for Gemini APIs.

## See also

- [TxGemma (therapeutics)](./txgemma.md) — same HAI-DEF program, different task focus.
- [MONAI](./monai.md) — in-repo imaging pipelines / Model Zoo (orthogonal stack).
- [HuatuoGPT](./huatuogpt.md) — optional third-party medical LLMs.

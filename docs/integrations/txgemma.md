# TxGemma (Google — therapeutics / drug-discovery LLMs)

**TxGemma** is Google’s **Gemma 2**–based family **instruction-tuned** on **[Therapeutics Data Commons (TDC)](https://tdcommons.ai/)**–style tasks: classification, regression, and generation over **small molecules, proteins, nucleic acids, diseases, cell lines**, etc. It is part of **[Health AI Developer Foundations](https://developers.google.com/health-ai-developer-foundations/)** and is governed by the **[HAI-DEF terms of use](https://developers.google.com/health-ai-developer-foundations/terms)**.

## Official documentation

| Resource | Link |
|----------|------|
| TxGemma hub | [developers.google.com/.../txgemma](https://developers.google.com/health-ai-developer-foundations/txgemma) |
| Model card | [txgemma/model-card](https://developers.google.com/health-ai-developer-foundations/txgemma/model-card) |
| Vertex Model Garden | [TxGemma](https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/txgemma) |
| Hugging Face collection | [google/txgemma-release](https://huggingface.co/collections/google/txgemma-release-67dd92e931c857d15e4d1e87) |
| Notebooks & examples | [gemma-cookbook / TxGemma](https://github.com/google-gemini/gemma-cookbook/tree/main/TxGemma) |

**Get started:** [TxGemma get started](https://developers.google.com/health-ai-developer-foundations/txgemma/get-started) (local HF, Vertex online endpoint, batch jobs, contact / forum links).

## Model variants (summary)

- **Sizes:** **2B**, **9B**, **27B** (see HF for exact repo IDs).
- **Predict vs chat:** **`*-predict`** checkpoints expect **TDC-shaped prompts** (instructions + context + question + answer slot). **`*-chat`** (9B / 27B) supports **multi-turn** dialogue and **explaining** predictions, with some **tradeoff vs raw predictive accuracy** — see the **[TxGemma paper](https://arxiv.org/abs/2504.06196)**.
- **Prompt templates:** TDC task templates ship with models (e.g. `tdc_prompts.json` on the Hub for `google/txgemma-27b-predict` per Google’s docs).

## Quick usage pattern (HF)

1. Download **`tdc_prompts.json`** from the predict model repo and substitute inputs (e.g. drug **SMILES**) into the template.
2. Run **`AutoModelForCausalLM`** / **`pipeline("text-generation", ...)`** with short **`max_new_tokens`** for multiple-choice style answers.

Full code blocks: official **model card** and **[Quickstart notebook](https://github.com/google-gemini/gemma-cookbook/blob/main/TxGemma/%5BTxGemma%5DQuickstart_with_Hugging_Face.ipynb)**.

## Agentic orchestration

Google documents using TxGemma as a **tool** inside larger agents (e.g. with **Gemini** for orchestration) — see **[Agentic demo notebook](https://github.com/google-gemini/gemma-cookbook/blob/main/TxGemma/%5BTxGemma%5DAgentic_Demo_with_Hugging_Face.ipynb)** and the paper. If Pi adopts this, keep **API keys and model IDs** in env/DB.

## Intended use and limitations (Pi summary)

- **Research and development** in therapeutics — not a substitute for **regulatory**, **safety**, or **clinical** validation of your pipeline.
- Trained on **TDC-sourced** instruction data; released models use **commercial-license** subsets per Google’s documentation — confirm license fit for your use case.
- **Task-specific validation** on your data and population remains **mandatory** before any high-stakes decisioning.

## Citation

**TxGemma: Efficient and Agentic LLMs for Therapeutics** — [arXiv:2504.06196](https://arxiv.org/abs/2504.06196)

```bibtex
@article{wang2025txgemma,
  title={{TxGemma}: Efficient and Agentic {LLMs} for Therapeutics},
  author={Wang, Eric and Schmidgall, Samuel and Jaeger, Paul F. and Zhang, Fan and Pilgrim, Rory and Matias, Yossi and Barral, Joelle and Fleet, David and Azizi, Shekoofeh},
  journal={arXiv preprint arXiv:2504.06196},
  year={2025}
}
```

## Pi integration

- Same as [MedGemma](./medgemma.md): **no hardcoded** model names or endpoints; optional **self-hosted or Vertex** path alongside Pi’s default providers.
- Heavy batch inference: prefer **Vertex batch prediction** or dedicated workers, not Vercel serverless as primary compute.

## See also

- [MedGemma](./medgemma.md) — clinical multimodal text + imaging.
- [Gemini skills (Cursor rule)](../../.cursor/rules/gemini-skills.mdc) — when combining with Gemini APIs.

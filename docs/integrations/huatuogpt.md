# HuatuoGPT (medical LLMs — reference)

This note records the **HuatuoGPT** model family from **[FreedomIntelligence](https://huggingface.co/FreedomIntelligence)** for **optional** health / medical reasoning and multimodal use. These models are **not** vendored in-repo; Pi routes them only if you deploy them behind your own inference stack and wire them via **environment-driven** model configuration (same rule as other providers: no hardcoded model IDs in application logic).

## Series overview

| Model line | Focus | Typical use |
|------------|--------|-------------|
| **HuatuoGPT-o1** | Complex medical **reasoning** (verifier-guided SFT + PPO-style RL); thinks-before-answers | Stepwise clinical-style reasoning, self-critique patterns; English and/or Chinese depending on checkpoint |
| **HuatuoGPT-II (HuatuoGPT2)** | One-stage **domain adaptation**; strong Chinese medical dialogue / exams | General medical QA, dialogue, licensing-style benchmarks |
| **HuatuoGPT-Vision** | **Multimodal** medical VQA (images + text); trained with **PubMedVision** scale data | Reports, slices, pathology-style images when paired with a vision stack |

**Product ordering (when choosing among the family):** prefer **o1** when you need explicit reasoning traces and refinement; add **Vision** when the product must consume **medical images**; consider **HuatuoGPT-II** as a **lighter or Chinese-primary** dialogue layer where o1 is unnecessary. Original **HuatuoGPT** is largely superseded by later releases for new builds.

## HuatuoGPT-o1

- **Paper:** [HuatuoGPT-o1, Towards Medical Complex Reasoning with LLMs](https://arxiv.org/abs/2412.18925) (arXiv:2412.18925).
- **Repo:** [FreedomIntelligence/HuatuoGPT-o1](https://github.com/FreedomIntelligence/HuatuoGPT-o1).
- **Idea:** Verifiable medical problems (e.g. from difficult exams) plus a **medical verifier** to guide **complex reasoning trajectories** for SFT; **reinforcement learning (e.g. PPO)** with verifier-based rewards for further improvement.
- **Output style:** Models often structure generations with **`## Thinking`** (reasoning) and **`## Final Response`** (user-facing answer). Parse or display according to your UX and safety policy.

### Hugging Face checkpoints (examples)

| Checkpoint | Backbone (reported) | Languages |
|------------|---------------------|-----------|
| `FreedomIntelligence/HuatuoGPT-o1-8B` | LLaMA-3.1-8B | English |
| `FreedomIntelligence/HuatuoGPT-o1-70B` | LLaMA-3.1-70B | English |
| `FreedomIntelligence/HuatuoGPT-o1-7B` | Qwen2.5-7B | English & Chinese |
| `FreedomIntelligence/HuatuoGPT-o1-72B` | Qwen2.5-72B | English & Chinese |

### Deployment

Treat like other Hugging Face causal LMs: **vLLM**, **SGLang**, or **Transformers** `generate`. Example pattern (from upstream docs; adapt dtype / device):

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "FreedomIntelligence/HuatuoGPT-o1-8B"
model = AutoModelForCausalLM.from_pretrained(
    model_id, torch_dtype="auto", device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_id)
messages = [{"role": "user", "content": "..."}]
prompt = tokenizer.apply_chat_template(
    messages, tokenize=False, add_generation_prompt=True
)
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=2048)
```

Training and evaluation scripts (Accelerate, DeepSpeed, TRL PPO, SGLang eval) live in the **upstream repository**; do not duplicate them here.

### Related artifacts (upstream)

Examples users may pull for replication: `FreedomIntelligence/medical-o1-reasoning-SFT`, `FreedomIntelligence/medical_o1_verifier_3B`, `FreedomIntelligence/medical-o1-verifiable-problem` — names and versions **change**; confirm on Hugging Face before pinning.

## HuatuoGPT-II (HuatuoGPT2)

- **Paper:** [HuatuoGPT-II, One-stage Training for Medical Adaption of LLMs](https://arxiv.org/abs/2311.09774) (arXiv:2311.09774).
- **Focus:** Single-stage adaptation pipeline, strong **Chinese** medical benchmarks and expert evaluations in reported results.
- **Checkpoints (examples):** `FreedomIntelligence/HuatuoGPT2-7B`, `HuatuoGPT2-13B`, `HuatuoGPT2-34B` (see HF org for exact IDs and quantized variants). Inference may use `trust_remote_code=True` and project-specific chat helpers (e.g. `HuatuoChat`) — follow **current** upstream README.

## HuatuoGPT-Vision

- **Focus:** Medical **multimodal** models; **PubMedVision** (large medical VQA dataset) for visual knowledge injection.
- **Checkpoints (examples):** `FreedomIntelligence/HuatuoGPT-Vision-7B`, `FreedomIntelligence/HuatuoGPT-Vision-34B`.
- **Training:** Upstream has moved toward **Qwen2.5-VL**-style training in newer releases; prefer their latest instructions and Transformers compatibility notes when reproducing.

## Pi integration boundaries

- **No default provider:** Pi’s primary stack remains **env-routed** providers (Gemini, OpenAI, Anthropic, DeepSeek, etc.). HuatuoGPT is an **optional self-hosted** path.
- **Gateway:** If exposed via Pi API, use **Bearer auth**, **Zod** validation, **OpenAI-compatible** shapes where applicable, and **202 + jobs** for long-running inference.
- **Safety:** Outputs are **not** licensed medical advice, diagnosis, or treatment. Enforce disclaimers, human-in-the-loop for high-risk flows, and regional compliance.
- **Licensing:** Each checkpoint may carry **custom or third-party** terms (base LLaMA / Qwen / Yi / Baichuan licenses, etc.). Review **Hugging Face model cards** and org policies before production use.

## Citations

HuatuoGPT-o1 (use the paper for authoritative author list):

```bibtex
@article{huatuogpt_o1_2024,
  title={HuatuoGPT-o1, Towards Medical Complex Reasoning with {LLMs}},
  journal={arXiv preprint arXiv:2412.18925},
  year={2024}
}
```

HuatuoGPT-II (from project materials; verify spelling in your bibliography):

```bibtex
@misc{chen2023huatuogptii,
  title={{HuatuoGPT-II}, One-stage Training for Medical Adaption of {LLMs}},
  author={Junying Chen and Xidong Wang and Anningzhe Gao and Feng Jiang and Shunian Chen and Hongbo Zhang and Dingjie Song and Wenya Xie and Chuyi Kong and Jianquan Li and Xiang Wan and Haizhou Li and Benyou Wang},
  year={2023},
  eprint={2311.09774},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}
```

Original HuatuoGPT:

```bibtex
@article{huatuogpt2023,
  title={{HuatuoGPT}, Towards Taming Language Models To Be a Doctor},
  author={Hongbo Zhang and Junying Chen and Feng Jiang and Fei Yu and Zhihong Chen and Jianquan Li and Guiming Chen and Xiangbo Wu and Zhiyi Zhang and Qingying Xiao and Xiang Wan and Benyou Wang and Haizhou Li},
  journal={arXiv preprint arXiv:2305.15075},
  year={2023}
}
```

## See also

- [MedGemma](./medgemma.md) / [TxGemma](./txgemma.md) — Google **Health AI Developer Foundations** (clinical multimodal + therapeutics).
- [MONAI (medical imaging)](./monai.md) — imaging pipelines and Model Zoo (orthogonal to chat LLMs).
- [MetaBCI (neuro)](./metabci.md) — EEG / BCI Python stack.
- [Health / neuro architecture](../../architecture/health-neuro-overview.md) — bounded contexts for health-related compute.

# Braindecode — deep learning on EEG / MEG / ECoG (Python)

## Why Braindecode in Pi

[Braindecode](https://braindecode.org/) is an open-source **PyTorch** toolbox for decoding **raw electrophysiological** data (EEG, ECoG, MEG) with deep learning: dataset helpers, preprocessing, augmentations, many **torch.nn** architectures, and **Skorch**-compatible training (`EEGClassifier`, `EEGRegressor`). It builds on **MNE-Python** and aligns with the same scientific stack as MetaBCI.

In Pi’s architecture, Braindecode is the **model / training–inference layer** for neural EEG decoders, while [MetaBCI](./metabci.md) remains the broader BCI platform (pipelines, online acquisition via `brainflow`), and [MOABB](./moabb.md) supplies **benchmark** datasets/evaluations. All live in **`services/metabci-neuro/`** and are **not** imported from the Next.js app.

- **Docs:** [braindecode.org](https://braindecode.org/) (stable / dev)
- **Repository:** [github.com/braindecode/braindecode](https://github.com/braindecode/braindecode)
- **License:** primarily **BSD-3-Clause**; some components may use **CC BY-NC 4.0** — read upstream `LICENSE` / `NOTICE`. This is **not legal advice**.

## Where it lives in this repo

Pinned with MetaBCI in:

- [`services/metabci-neuro/requirements-api.in`](../../services/metabci-neuro/requirements-api.in) → [`requirements-api.lock.txt`](../../services/metabci-neuro/requirements-api.lock.txt) (CI + `Dockerfile.api`)
- [`services/metabci-neuro/requirements.in`](../../services/metabci-neuro/requirements.in) → [`requirements.lock.txt`](../../services/metabci-neuro/requirements.lock.txt) (full `Dockerfile`)
- [`services/metabci-neuro/pyproject.toml`](../../services/metabci-neuro/pyproject.toml) — editable dev (`pip install -e ".[dev]"`)

**Python:** Braindecode **1.3.x** requires **Python ≥ 3.11**. The neuro service standardizes on **3.11** for Docker and CI.

## Installation notes (upstream)

1. **PyTorch** — satisfied via locked transitive deps; for custom builds, follow [pytorch.org](https://pytorch.org/) (Braindecode also pulls **torchaudio** in our lock).
2. **MOABB** — **pinned** in Pi’s API/full locks as **`moabb==1.5.0`** (see [MOABB integration](./moabb.md)). Use `braindecode.datasets.MOABBDataset` and MOABB’s own API without a separate install.
3. **Hugging Face Hub** — optional `braindecode[hug]` for `from_pretrained` / `push_to_hub` on supported models (see upstream model zoo docs; not in default Pi locks).

## How Pi should use it

- **Training and batch inference** belong in the **Python service** or offline jobs; expose results to the gateway via **internal APIs** or **202 jobs** with Zod-validated payloads.
- Prefer **deterministic workflows** (Mastra) for fixed pipelines; use agents only for explanations or developer tooling, not silent clinical decisions.
- **Pre-trained weights** (e.g. BIOT, Labram) are upstream/community assets — verify licensing and suitability before redistributing or serving in production.

## Limitations and compliance

- **Not a medical device** by default; models require **validation**, **calibration**, and often **regulatory** work before clinical claims.
- Outputs must carry **non-diagnostic** framing in public APIs unless the product is cleared for that use.
- **EEG/MEG data** is sensitive — apply encryption, access control, retention, and regional rules (HIPAA, GDPR, etc.).

## Citation (upstream)

Cite Braindecode via Zenodo and the original **Human Brain Mapping** paper; also cite **MNE-Python** when applicable. See [How to cite Braindecode](https://braindecode.org/stable/index.html) on the project site.

## Relationship to MetaBCI and MOABB

| Layer | Role |
|-------|------|
| **MetaBCI** | Datasets, classical decoders, online `brainflow`, experiment tooling (`brainstim`). |
| **MOABB** | Benchmark datasets, paradigms, evaluations, sklearn pipelines; optional bridge via `MOABBDataset`. |
| **Braindecode** | PyTorch model zoo, Skorch training, augmentations, many DL architectures for raw signals. |

They can be composed: e.g. MOABB or MetaBCI/MNE for IO and trial definition, Braindecode for the neural module and training loop — design explicit tensor contracts between steps.

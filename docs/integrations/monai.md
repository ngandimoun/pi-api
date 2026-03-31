# MONAI (medical imaging, Python)

This note describes how **[MONAI](https://monai.io/)** fits the Pi repo: **MONAI Core**, the **Model Zoo** (bundles), and how that work stays out of the Next.js bundle.

## Where it lives

| Path | Role |
|------|------|
| [`services/monai-imaging/`](../../services/monai-imaging/) | Pinned **`monai[fire]==1.5.2`**, lockfiles, smoke script, optional Docker image. |
| Future `src/app/api/v1/...` | Bearer auth, Zod, OpenAI-style envelopes — **no** `import monai` in TypeScript. |

## Capabilities (high level)

- **MONAI Core:** PyTorch-native transforms, networks, losses, metrics, and workflows for 2D/3D/4D medical imaging (DICOM, NIfTI, common raster formats — see upstream docs).
- **MONAI Model Zoo:** Pre-trained models packaged as **MONAI Bundles**; browse at [monai.io/model-zoo](https://monai.io/model-zoo). Bundles are versioned; releases may ship **`bundle_name_version.zip`** artifacts. Source layouts live under `models/` in the upstream zoo repository.
- **`monai[fire]`:** Enables the CLI entry point used for downloads, e.g. `python -m monai.bundle download "<bundle_id>" --bundle_dir bundles/`. Run `python -m monai.bundle download -h` for options. Per-bundle usage is documented under each bundle’s `docs/` folder after download.

## Ecosystem (separate packages)

These are **not** pinned in `services/monai-imaging/`; add dedicated services or optional extras if you adopt them:

- **MONAI Label** (`monailabel`) — AI-assisted labeling with viewer integrations (e.g. 3D Slicer, OHIF).
- **MONAI Deploy** (`monai-deploy-app-sdk`) — MAP packaging and deployment orchestration for clinical-style pipelines.

## Production and deployment

- **Do not** run heavy MONAI training or large-volume inference on **Vercel serverless** as the primary runtime. Use **containers** or GPU-capable workers (see [`services/monai-imaging/README.md`](../../services/monai-imaging/README.md)).
- **Two lockfiles:**
  - **`requirements-ci.lock.txt`** — PyTorch **CPU** wheels; used by **GitHub Actions** smoke (faster on default runners). Install with `--extra-index-url https://download.pytorch.org/whl/cpu`.
  - **`requirements.lock.txt`** — Default Linux resolution (CUDA-oriented PyTorch transitive stack). Use on **GPU** hosts when you need those wheels.
- **Linux-oriented locks:** Same pattern as MetaBCI — prefer **WSL2** or **editable** `pip install -e ".[dev]"` on **native Windows** if a lock install fails.

## API and agent boundaries

- Gateway should call Python via **internal HTTP**, **queue**, or **Trigger.dev** with typed payloads.
- Long work (&gt; ~5s): **202** + job state machine per `.cursorrules`.
- **Mastra:** Prefer **workflows** for deterministic pipelines (load → preprocess → infer → format). Use **agents** only for open-ended explanation, not silent clinical decisions on raw model output.

## Safety, compliance, and licensing

- **MONAI** (PyPI) is **Apache-2.0**. The **Model Zoo** repository is also Apache-2.0; individual **bundles** may add **data** or **weight** terms — read each bundle’s **`docs/data_license.txt`** (if present) and included license files.
- The zoo **does not** claim that any model is fit for a **particular clinical use**; treat outputs as **non-diagnostic** unless your product has undergone appropriate validation and regulatory review.
- Treat medical images and derived outputs as **sensitive**; align retention and encryption with your policies.

## How to cite MONAI Core

From the MONAI project (example — verify against the latest author list for publications):

```bibtex
@article{cardoso2022monai,
  title={MONAI: An open-source framework for deep learning in healthcare},
  author={Cardoso, M Jorge and Li, Wenqi and Brown, Richard and Ma, Nic and Kerfoot, Eric and Wang, Yiheng and others},
  journal={arXiv:2211.02701},
  year={2022}
}
```

## How to cite MONAI Deploy

If you use MONAI Deploy in research:

```bibtex
@article{gupta2024monai,
  title={Current State of Community-Driven Radiological AI Deployment in Medical Imaging},
  author={Gupta, Vikash and Erdal, Barbaros and Ramirez, Carolina and others},
  journal={JMIR AI},
  volume={3},
  pages={e55833},
  year={2024},
  doi={10.2196/55833}
}
```

## Related Pi docs

- [MetaBCI (neuro)](./metabci.md) — separate Python service; different modality stack.
- [Health / neuro architecture note](../../architecture/health-neuro-overview.md) — includes imaging row for `services/monai-imaging/`.

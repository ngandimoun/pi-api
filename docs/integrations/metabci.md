# MetaBCI — neuro / BCI stack (Python)

## Why MetaBCI in Pi

[MetaBCI](https://github.com/TBC-TJU/MetaBCI) is an open-source platform for **non-invasive brain–computer interfaces (BCI)**, focused on **EEG**: datasets, preprocessing, decoding algorithms, online pipelines, and experiment paradigms. It is led by researchers at Tianjin University (see the [PyPI project](https://pypi.org/project/metabci/) and [documentation](https://metabci.readthedocs.io/)).

In Pi’s architecture, MetaBCI is a **vertical capability** for **neuro signal intelligence** — not a general health record system, not clinical middleware by default, and **not** something that runs inside the Next.js serverless runtime.

## Components (upstream)

| Module | Role |
|--------|------|
| **brainda** | Dataset loaders (MOABB-oriented), preprocessing hooks, classical and deep decoders (e.g. CSP, CCA family, EEGNet, ShallowConvNet), transfer learning helpers. |
| **brainflow** | Higher-speed **online** EEG processing; uses **PyLSL** for Lab Streaming Layer acquisition when hardware exposes LSL. |
| **brainstim** | Stimulus / paradigm tooling (builds on **PsychoPy**); relevant for lab experiments and sandboxes, not typical API-only production paths. |

### Related: Braindecode (deep learning model layer)

Pi also pins **[Braindecode](https://braindecode.org/)** in the same Python environment for **PyTorch** architectures, Skorch training wrappers, and augmentations on raw EEG/MEG/ECoG. See [Braindecode integration](./braindecode.md).

### Related: MOABB (benchmarking layer)

**[MOABB](https://moabb.neurotechx.com/)** is pinned for **standardized BCI benchmarks** (datasets, paradigms, evaluations, sklearn pipelines). It overlaps partially with MetaBCI **brainda**’s dataset story — pick one orchestration path per product feature. See [MOABB integration](./moabb.md).

**License mix:** MetaBCI is **GPL-2.0**; Braindecode and MOABB are **BSD-3-Clause** (Braindecode has optional NC components upstream) — review compliance when packaging combined images.

## Where it lives in this repo

All Python packaging and runtime notes are under:

- [`services/metabci-neuro/`](../../services/metabci-neuro/)

### Reminder for anyone building health / neuro APIs

- **`requirements.lock.txt` is Linux-only.** A quick install on **native Windows** against that lock often fails (platform-specific Qt / PsychoPy wheels). Use **WSL2** or **`pip install -e ".[dev]"`** from `services/metabci-neuro` on Windows (see the service README).
- **CI** runs the import smoke on **`ubuntu-latest`** using the **slim** lock [`requirements-api.lock.txt`](../../services/metabci-neuro/requirements-api.lock.txt) (faster, less disk).
- **Production API containers** should default to **`requirements-api.lock.txt`** (`metabci[brainda,brainflow]` — no PsychoPy). Keep **`requirements.lock.txt`** for full **brainstim** / lab parity when you need it.

Conventions:

- **Do not** `import brainda` / MetaBCI from `src/app` or Route Handlers. The TypeScript gateway should talk to this layer via **internal HTTP**, **queues**, or **Trigger.dev** tasks that invoke the Python service.
- Pin versions with committed locks: **[`requirements-api.lock.txt`](../../services/metabci-neuro/requirements-api.lock.txt)** (decode / online API) or **[`requirements.lock.txt`](../../services/metabci-neuro/requirements.lock.txt)** (full stack). Regenerate with `uv` — see service README.

## How developers install and verify

Short path (see [`services/metabci-neuro/README.md`](../../services/metabci-neuro/README.md) for details):

```bash
cd services/metabci-neuro
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python scripts/smoke_imports.py
```

Locked install (matches Docker):

```bash
pip install -r requirements.lock.txt
python scripts/smoke_imports.py
```

### Minimal vs full extras

Upstream supports modular installs (`metabci[brainda]`, `metabci[brainflow]`, `metabci[brainstim]`, `metabci[all]`). This repo ships:

- **[`requirements.in`](../../services/metabci-neuro/requirements.in)** → **[`requirements.lock.txt`](../../services/metabci-neuro/requirements.lock.txt)** — **`metabci[all]`** (includes **brainstim** / PsychoPy transitive deps).
- **[`requirements-api.in`](../../services/metabci-neuro/requirements-api.in)** → **[`requirements-api.lock.txt`](../../services/metabci-neuro/requirements-api.lock.txt)** — **`metabci[brainda,brainflow]`** for **slimmer API / worker images** without PsychoPy.

Use [`Dockerfile.api`](../../services/metabci-neuro/Dockerfile.api) for the API lock; [`Dockerfile`](../../services/metabci-neuro/Dockerfile) for the full lock.

## How Pi will use it (future HTTP / agents)

Recommended pattern:

1. **Next.js Route Handlers** validate requests with **Zod**, enforce **Unkey** auth, and return **OpenAI-style** envelopes where applicable ([`.cursorrules`](../../.cursorrules)).
2. Work expected to exceed ~**5 seconds** should return **202** and a **job id** (Trigger.dev or an internal job table), consistent with the rest of Pi.
3. Workers or a private service call into Python (MetaBCI) with **typed inputs** (e.g. file refs, preprocessing spec, decoder id) and return **structured outputs** + **explicit uncertainty / limitations** in JSON.

Orchestration:

- Prefer **Mastra workflows** for deterministic pipelines (load → preprocess → decode → post-process).
- Use **agents** only for open-ended reasoning *around* results (e.g. summarization for developers), not for silent clinical decision-making.

## Operational notes

- **Sizing:** EEG + deep models can be **RAM-heavy**; PyTorch and MOABB-style workloads benefit from **CPU cores**; **GPU** optional (training / some decoders). Treat the Python service like any other compute-heavy microservice.
- **Caching:** First use may download **datasets** or assets via **pooch** / MOABB; plan disk and egress. Mount a volume for caches in production if you need read-only images.
- **Timeouts:** Bound internal calls; stream or chunk long jobs via the job machine.
- **Observability:** Structured logs from the Python service; correlate with Pi `request_id` / job ids at the gateway.

### PyTorch: CUDA vs CPU

The committed [`requirements.lock.txt`](../../services/metabci-neuro/requirements.lock.txt) is resolved for **Linux** and currently pulls **PyTorch with CUDA-related wheels** (suitable for GPU nodes with NVIDIA runtime). For **CPU-only** deployment, recompile the lock using PyTorch’s **CPU** wheel index (documented in the service README).

### Docker

Build from repository root:

```bash
docker build -f services/metabci-neuro/Dockerfile -t pi-metabci-neuro .
docker build -f services/metabci-neuro/Dockerfile.api -t pi-metabci-neuro-api .
```

Use **NVIDIA Container Toolkit** on hosts where GPU-backed PyTorch is required. **Vercel serverless** is not an appropriate runtime for this stack; run the container (or VM) where long-lived processes and large dependencies are supported.

## Limitations and compliance

### Not a medical device by default

MetaBCI is a **research and engineering** toolkit. Decoder outputs are **not** validated for diagnosis, treatment, or monitoring in regulated clinical settings unless **you** run the appropriate studies, risk management, and **regulatory** processes (e.g. FDA, MDR, local rules).

APIs and agents must **not** present raw decoder outputs as clinical truth. Surface **limitations**, **confidence**, and **non-diagnostic** language in developer-facing contracts.

### Hardware and protocols

Quality depends on **EEG hardware**, **electrode layout**, **sampling rate**, **impedance**, and **task design**. LSL availability varies by vendor SDK.

### License (upstream)

MetaBCI is distributed under **GNU General Public License v2.0**. This has implications for **distribution** of combined or derivative works. SaaS-only deployment still warrants **legal review** of how you package, modify, and link components. This document is **not legal advice**.

### Privacy and health data

EEG and related metadata can be **sensitive**. Apply **encryption in transit and at rest**, **access control**, **retention limits**, **consent**, and regional requirements (**HIPAA**, **GDPR**, etc.) at the product and infrastructure layers.

## Real-world use cases (responsible framing)

**Appropriate to explore**

- Neuroscience and BCI **research** pipelines.
- **Assistive technology** prototypes (e.g. communication BCI) under proper ethics and safety review.
- **Lab and hospital research** workflows (non-diagnostic) with approved protocols.

**Not appropriate without full clinical and regulatory programs**

- Automated **diagnosis** of seizures, stroke, psychiatric conditions, or consciousness level.
- **Real-time patient monitoring** marketed as clinical decision support.

## References

- MetaBCI paper: Mei, J., Luo, R., Xu, L., Zhao, W., Wen, S., Wang, K., … & Ming, D. (2023). *MetaBCI: An open-source platform for brain–computer interfaces. Computers in Biology and Medicine*, 107806. [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0010482523012714)
- Upstream contact (handbook): see PyPI / GitHub project pages for maintainer email.

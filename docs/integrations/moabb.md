# MOABB — Mother of All BCI Benchmarks (Python)

## What MOABB is

[MOABB](https://moabb.neurotechx.com/) (**Mother of All BCI Benchmarks**) is an open-science Python library under [NeuroTechX](https://neurotechx.com/) for **reproducible benchmarking** of BCI algorithms on many **public EEG datasets**. It standardizes **dataset access**, **paradigms** (how raw data become trials), **evaluations** (cross-session, cross-subject, within-session, …), and **sklearn-style pipelines**, and can run **full benchmark** workflows from a single entry point.

- **Documentation:** [moabb.neurotechx.com](https://moabb.neurotechx.com/docs/index.html)
- **Repository:** [github.com/NeuroTechX/moabb](https://github.com/NeuroTechX/moabb)
- **License:** **BSD-3-Clause** (see upstream `LICENSE`).

MOABB is a **research and benchmarking** tool. It is **not** a clinical product, **not** validated medical software, and **not** a substitute for your own study design, statistics, and regulatory process if you ever make health claims.

## Where it lives in Pi

MOABB is pinned in the same environment as MetaBCI and Braindecode:

- [`services/metabci-neuro/requirements-api.in`](../../services/metabci-neuro/requirements-api.in) → [`requirements-api.lock.txt`](../../services/metabci-neuro/requirements-api.lock.txt)
- [`services/metabci-neuro/requirements.in`](../../services/metabci-neuro/requirements.in) → [`requirements.lock.txt`](../../services/metabci-neuro/requirements.lock.txt)
- [`services/metabci-neuro/pyproject.toml`](../../services/metabci-neuro/pyproject.toml) (editable install)

**Do not** import `moabb` from Next.js. Use **`services/metabci-neuro`** (container/worker) and expose results via internal APIs or **202 jobs**, consistent with [`.cursorrules`](../../.cursorrules).

## Core concepts (mental model)

MOABB organizes work into four main ideas (plus helpers):

| Concept | Role |
|--------|------|
| **Datasets** | Typed accessors for public BCI data; download/cache; expose **MNE** `Raw` / epochs-style workflows. Large catalog: motor imagery, P300/ERP, SSVEP, c-VEP, resting-state, compound sets, and more. |
| **Paradigms** | Define how continuous or epoched data become **trials** and labels (e.g. `LeftRightImagery`, `P300`, `SSVEP`, filter-bank variants, fixed-interval windows). |
| **Evaluations** | Define **generalization settings**: e.g. `WithinSessionEvaluation`, `CrossSessionEvaluation`, `CrossSubjectEvaluation`, with splitters and scoring. |
| **Pipelines** | **`sklearn`** `Pipeline`s: transformers (e.g. `LogVariance`, Riemannian blocks) + classifiers; MOABB also ships SSVEP-oriented classifiers (CCA/TRCA family wrappers) aligned with the literature. |

Additional modules include **statistics / meta-analysis**, **plotting** (score plots, paired comparisons, dataset bubbles), **utilities** (`set_log_level`, `set_download_dir`, dataset search), and a **`benchmark`** package to orchestrate multi-dataset runs from config (pipelines on disk, selected paradigms/datasets, parallel jobs, optional plots).

## Capabilities (what you can build)

- **Standardized benchmarks** across algorithms and datasets (within-session, cross-session, cross-subject).
- **Riemannian and classical pipelines** via **pyRiemann**-compatible features and sklearn estimators.
- **Integration with MNE** ecosystem (MOABB outputs/uses MNE structures; aligns with [Braindecode](./braindecode.md) and [MetaBCI](./metabci.md) for preprocessing and DL).
- **Result aggregation** as **pandas** `DataFrame`s for analysis and publication-style plots.
- **Braindecode integration (optional upstream extra):** `moabb[deeplearning]` pulls a **braindecode** dependency range for DL pipelines in benchmarks (Pi already pins **braindecode** separately; you do not need the extra unless you want upstream’s optional version pin).

For the **authoritative, up-to-date list** of dataset classes, paradigms, and API details, browse the [MOABB documentation](https://moabb.neurotechx.com/docs/index.html) (API reference sections).

## How to use (minimal patterns)

### Imports and logging

```python
import moabb
from moabb.datasets import BNCI2014_001
from moabb.evaluations import CrossSessionEvaluation
from moabb.paradigms import LeftRightImagery
from moabb.pipelines.features import LogVariance

from sklearn.discriminant_analysis import LinearDiscriminantAnalysis as LDA
from sklearn.pipeline import make_pipeline

moabb.set_log_level("info")
```

### Small evaluation (subset subjects for dev)

```python
pipelines = {"LogVar+LDA": make_pipeline(LogVariance(), LDA())}

dataset = BNCI2014_001()
dataset.subject_list = dataset.subject_list[:2]  # dev only

paradigm = LeftRightImagery(fmin=8, fmax=35)
evaluation = CrossSessionEvaluation(paradigm=paradigm, datasets=[dataset])
results = evaluation.process(pipelines)
print(results.head())
```

### Downloads and disk

First access **downloads** dataset files (often large). Control cache location with MOABB/MNE patterns, e.g.:

```python
from moabb.download import set_download_dir

set_download_dir("/path/to/large/disk/moabb")
```

Plan **egress**, **persistent volumes** in Kubernetes/VMs, and **CI** that does not fetch full corpora on every run (mock data, `FakeDataset`, or tiny subject lists).

### High-level benchmark runner

The **`moabb.benchmark.benchmark()`** function can run configured pipelines from disk across selected evaluations/paradigms/datasets, write results, and optionally plot. Suitable for **offline jobs** (Trigger.dev / batch workers), not for synchronous HTTP without strict timeouts.

## Limitations and caveats

| Topic | Notes |
|--------|--------|
| **Not clinical** | Benchmark scores are **research metrics**. Do not present them as patient diagnoses or device performance without full validation and regulation. |
| **Reproducibility** | Published numbers depend on preprocessing, sklearn/MOABB versions, random seeds, and hardware. Pin versions (Pi uses **committed lockfiles**). |
| **Implementation details** | MOABB’s own motivation text notes that **unreported preprocessing tricks** historically hurt reproducibility; MOABB reduces that, but your **custom** steps must still be documented. |
| **Cost** | Full benchmarks are **CPU/time/disk** heavy; **CodeCarbon**-style tracking exists as an **optional extra** (`carbonemission`) — not enabled in Pi’s default lock. |
| **Dependency weight** | Upstream declares **pytest**, **coverage**, and related tooling as **runtime** dependencies in recent releases; our lock reflects that (larger images). Accept or fork/vendor only with maintenance cost. |
| **Network** | Dataset hosts can change; corporate proxies may need configuration (see MOABB troubleshooting docs). |
| **Overlap with MetaBCI** | MetaBCI’s **brainda** layer also wraps MOABB-style dataset access with its own hooks. Prefer **one clear ownership** per pipeline step in Pi (either MOABB evaluation or MetaBCI/brainda utilities) to avoid double accounting. |

## Relationship to MetaBCI and Braindecode

- **MetaBCI / brainda:** Broader BCI platform (datasets, classical + some DL decoders, online `brainflow`). Overlaps conceptually with MOABB on **dataset standardization**; choose a single source of truth per product feature.
- **Braindecode:** `MOABBDataset` and tutorials integrate MOABB-named data into PyTorch/Braindecode training loops. You can **benchmark** with MOABB and **train DL** with Braindecode on compatible representations—define explicit tensor contracts between steps.

## Citation

Cite MOABB using the **Zenodo software record** and the **benchmark / original MOABB papers** listed in the [project citation guide](https://moabb.neurotechx.com/docs/index.html). Include **dataset papers** when you report results on specific corpora.

## Pi-specific reminder

- **Linux lockfiles** for containers/CI; **native Windows** may still be problematic for the full stack — see [`services/metabci-neuro/README.md`](../../services/metabci-neuro/README.md).
- Prefer **`requirements-api.lock.txt`** for API/worker images; full **`requirements.lock.txt`** when **brainstim** / lab stack is required.

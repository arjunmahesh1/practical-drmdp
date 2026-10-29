# Practical DR-MDP Results Explorer

Static paper-results website for GitHub Pages. No build service, backend, account, or paid domain is required.

## Run and test

```sh
python3 -m http.server 8765 --bind 127.0.0.1
node --test tests/*.test.mjs
```

Open `http://localhost:8765`. All asset URLs are relative, including study JSON and PDF links, so project-subdirectory Pages hosting works.

## Data and interpretation

### October 29 PickCube PPO Addition

The separate `ppo_tv_pickcube_20261028` branch contains the October 28
joint-delta PPO cohort. Standard and eight TV caps each have all thirty
training seeds (1000-1029), all 38 conditions, and fifty episodes per
policy-condition, validated from 270 files and 513,000 finite episodes.
The six non-nominal grids retain their actual arm-command axis names.
Cap 4 has the highest full-grid mean among the eight caps on every axis.
This is ex-post descriptive selection, not held-out confirmation.
The near-overlapping return curves show no clear improvement across the
suite; SD overlap is not a significance or equivalence test.

The new branch supports fixed caps, best-per-axis selection, all-cap SD
overlays, CSV export, and seven downloadable PDFs in the paper archive.
Historical study files and their recordings are unchanged. No videos are
linked for this new cohort, and older PickCube videos are never substituted.

Open `?study=ppo_tv_pickcube_20261028&setting=best#returns` for the new curves.

`data/catalog.json` records source-table names and SHA256 hashes. The 19 study groups contain 328 study-specific axes. The paper archive contains 272 referenced PDF panels. Environment versions, controls, and distinct cohorts stay separate.

Each curve is a mean of policy-level episode means, not a pooled-episode estimate. Bands are one sample standard deviation across policies, not confidence intervals. The standard cohort is fixed; setting controls highlight one evaluated candidate while keeping others visible. No unmeasured severity is fabricated. Failed policies have no imputed return; measured policy counts remain visible.

`Best on this axis` chooses the active setting with the largest arithmetic mean across that axis's full displayed severity grid. Inactive controls are excluded. This is ex-post descriptive selection, not the three-seed nominal training-selection rule or held-out validation. Best mode can choose a different cap/beta for each axis; fixed-setting mode remains available. All Returns can show every setting together, each with its own SD band.

Some historical paper panels select a robust setting and reference independently by axis. Those original PDFs are preserved rather than silently relabeled. The interactive explorer always uses its named standard cohort. Interactive setting choice is descriptive, not held-out confirmation.

The website uses only previously completed local summary tables. `tools/export_results.py` can export those tables from the research checkout; it does not launch experiments or fetch cluster results. Do not run it on active experiment artifacts.

## Environment visuals

Where linked, MP4 recordings are new deterministic rollouts of the actual completed checkpoints with the archived perturbation wrapper. Normalization is frozen where used by the original evaluation; legacy CleanRL TD3 uses raw observations and is labeled accordingly. Recordings use a named, fixed training seed and episode seed; they are not recovered original videos or cohort-average episodes. Changing the setting or severity selects a different matching recording. The cumulative-return trace describes that one recording; the main curve retains the paper's saved cohort means. Archived individual returns are compared where available, and mismatches are disclosed without overwriting research data.

Published explorer coverage before the October 23 expansion (366 clips):

| Study | Coverage | Clips |
| --- | --- | ---: |
| Pusher PPO-TV | Standard, cap -1, cap 0; all six axes and their full grids | 111 |
| Walker2d SAC-TV | All six settings; mass grid only | 90 |
| Walker2d SAC-KL | All six settings; mass grid only | 90 |
| HalfCheetah SAC-TV | All three settings; mass grid only | 45 |
| HalfCheetah SAC-KL | Both settings; mass grid only | 30 |

Pusher uses training seed 1000 and episode seed 100000. Legacy SAC uses training seed 0 and episode seed 0. All 111 Pusher recordings reproduce their archived individual episode returns within tolerance. Legacy aggregate tables do not establish individual-episode identity. PickCube, Delta Pusher SAC/TD3, and the remaining study/axis combinations are not recorded by this package. Checkpoint weights and frozen normalization remain in a private cache outside the public repository.

### October 23 recording expansion

The expansion contains 1,821 recordings across twelve study groups, including the original 366. `data/recording_coverage_20261023.json` records each actual selection and the missing combinations; `data/recording_qa_v2.json` records encoded-video checks. `data/recording_publication_v1.json` records the release-hosted files and exact hashes, not a live-deployment check. Do not claim full coverage of the 28,151 displayed selections.

| Study coverage | Clips |
| --- | ---: |
| Walker PPO-TV: all eleven settings, mass | 165 |
| HalfCheetah PPO-TV: all fifteen settings, mass | 225 |
| Walker TD3: all TV, physical-KL and context-KL settings, mass | 345 |
| Walker/HalfCheetah RSC-SAC: all settings, mass | 90 |
| Walker SAC-TV: standard and cap 60, all twenty axes; other settings, mass and friction | 720 |
| Other SAC TV/KL mass recordings, unchanged | 165 |
| Pusher PPO-TV, unchanged, all six axes | 111 |

The user explicitly approved public video uploads to this repository on October 23. All 1,455 additions, including the pilot, are publicly hosted in GitHub Releases `recordings-20261023-01` (900 files) and `recordings-20261023-02` (555 files). Every uploaded file's size, content type and GitHub SHA-256 digest matched the verified local recording before its URL was linked. The original 366 videos remain hosted with the Pages assets. No checkpoint weights or credentials were uploaded.

The exact completed actor/normalization fetcher now supports all eleven legacy MuJoCo study groups. It chooses the smallest available training seed covering every displayed condition, never a seed chosen by return. PPO/TD3/RSC-SAC source loaders follow the canonical evaluator; displayed RSC-SAC controls can use the ordinary SAC loader where their archived source specifies it. This is not retraining or a change to published outcomes.

New MP4s are ignored by Git to avoid growing the Pages branch. `tools/package_release_recordings.py` prepares video-only batches for an explicitly approved public upload to the same repository's GitHub Releases. Its `--apply` step reads public release metadata and verifies every asset's size, content type, and SHA-256 before changing any recording URL. `--missing-output` reconciles absent files without blindly re-uploading a batch. New local recordings are not automatically public.

PickCube still requires an original Linux ManiSkill/SAPIEN runtime with a working RGB renderer. LunarLander requires Box2D/pygame and verified matching final actors, not just summary returns. Delta Pusher SAC/TD3 actor availability remains unresolved; no Delta authentication or cluster jobs are performed by these tools.

Official Gymnasium and ManiSkill documentation media remain linked and attributed for selections without a recording. **They are not our evaluated policies and do not show the selected perturbation.** Missing playback is never replaced with another cap or policy. Episode totals alone cannot reconstruct motion. PickCube needs the original Linux ManiSkill/SAPIEN runtime; it is not a MuJoCo task.

The dormant state-replay adapter accepts a study `replays[setting][axis + '|' + value]` URL. Its current renderer is LunarLander-specific and requires explicit `trainingSeed`, `episodeSeed`, `return`, `terrain`, `padY`, and polygon `frames`. It must not be used for another environment. A newly rendered checkpoint episode must be labeled separately from an archived evaluation episode; do not imply reproduction without a verified return match. Other environments require a recorded video or an environment-specific recorded-state renderer.

## Publish

GitHub Pages: deploy the `main` branch, `/ (root)`. `.nojekyll` keeps static assets untouched. The public site contains summaries and paper figures, not checkpoints, credentials, or raw private files. A custom `.site` domain is optional and must be acquired separately; the default `github.io` URL is free.

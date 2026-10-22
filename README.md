# Practical DR-MDP Results Explorer

Static paper-results website for GitHub Pages. No build service, backend, account, or paid domain is required.

## Run and test

```sh
python3 -m http.server 8765 --bind 127.0.0.1
node --test tests/*.test.mjs
```

Open `http://localhost:8765`. All asset URLs are relative, including study JSON and PDF links, so project-subdirectory Pages hosting works.

## Data and interpretation

`data/catalog.json` records source-table names and SHA256 hashes. The 19 study groups contain 328 study-specific axes. The paper archive contains 272 referenced PDF panels. Environment versions, controls, and distinct cohorts stay separate.

Each curve is a mean of policy-level episode means, not a pooled-episode estimate. Bands are one sample standard deviation across policies, not confidence intervals. The standard cohort is fixed; setting controls highlight one evaluated candidate while keeping others visible. No unmeasured severity is fabricated. Failed policies have no imputed return; measured policy counts remain visible.

`Best on this axis` chooses the active setting with the largest arithmetic mean across that axis's full displayed severity grid. Inactive controls are excluded. This is ex-post descriptive selection, not the three-seed nominal training-selection rule or held-out validation. Best mode can choose a different cap/beta for each axis; fixed-setting mode remains available. All Returns can show every setting together, each with its own SD band.

Some historical paper panels select a robust setting and reference independently by axis. Those original PDFs are preserved rather than silently relabeled. The interactive explorer always uses its named standard cohort. Interactive setting choice is descriptive, not held-out confirmation.

The website uses only previously completed local summary tables. `tools/export_results.py` can export those tables from the research checkout; it does not launch experiments or fetch cluster results. Do not run it on active experiment artifacts.

## Environment visuals

Where linked, MP4 recordings are new deterministic rollouts of the actual completed checkpoints with frozen normalization and the archived perturbation wrapper. They use a named, fixed training seed and episode seed; they are not recovered original videos or cohort-average episodes. Changing the setting or severity selects a different matching recording. The cumulative-return trace describes that one recording; the main curve retains the paper's saved cohort means. Archived individual returns are compared where available, and mismatches are disclosed without overwriting research data.

Current recording coverage (366 clips):

| Study | Coverage | Clips |
| --- | --- | ---: |
| Pusher PPO-TV | Standard, cap -1, cap 0; all six axes and their full grids | 111 |
| Walker2d SAC-TV | All six settings; mass grid only | 90 |
| Walker2d SAC-KL | All six settings; mass grid only | 90 |
| HalfCheetah SAC-TV | All three settings; mass grid only | 45 |
| HalfCheetah SAC-KL | Both settings; mass grid only | 30 |

Pusher uses training seed 1000 and episode seed 100000. Legacy SAC uses training seed 0 and episode seed 0. All 111 Pusher recordings reproduce their archived individual episode returns within tolerance. Legacy aggregate tables do not establish individual-episode identity. PickCube, Delta Pusher SAC/TD3, and the remaining study/axis combinations are not recorded by this package. Checkpoint weights and frozen normalization remain in a private cache outside the public repository.

Official Gymnasium and ManiSkill documentation media remain linked and attributed for selections without a recording. **They are not our evaluated policies and do not show the selected perturbation.** Missing playback is never replaced with another cap or policy. Episode totals alone cannot reconstruct motion. PickCube needs the original Linux ManiSkill/SAPIEN runtime; it is not a MuJoCo task.

The dormant state-replay adapter accepts a study `replays[setting][axis + '|' + value]` URL. Its current renderer is LunarLander-specific and requires explicit `trainingSeed`, `episodeSeed`, `return`, `terrain`, `padY`, and polygon `frames`. It must not be used for another environment. A newly rendered checkpoint episode must be labeled separately from an archived evaluation episode; do not imply reproduction without a verified return match. Other environments require a recorded video or an environment-specific recorded-state renderer.

## Publish

GitHub Pages: deploy the `main` branch, `/ (root)`. `.nojekyll` keeps static assets untouched. The public site contains summaries and paper figures, not checkpoints, credentials, or raw private files. A custom `.site` domain is optional and must be acquired separately; the default `github.io` URL is free.

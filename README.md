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

Some historical paper panels select a robust setting and reference independently by axis. Those original PDFs are preserved rather than silently relabeled. The interactive explorer always uses its named standard cohort. Interactive setting choice is descriptive, not held-out confirmation.

The website uses only previously completed local summary tables. `tools/export_results.py` can export those tables from the research checkout; it does not launch experiments or fetch cluster results. Do not run it on active experiment artifacts.

## Environment visuals

Official Gymnasium and ManiSkill documentation media are linked and attributed as task references. **They are not our evaluated policies and do not show the selected perturbation.** No matched rollout videos or simulator-state trajectories were present in the supplied package. Playback remains disabled until matching evidence is linked. Episode totals alone cannot reconstruct motion.

The dormant state-replay adapter accepts a study `replays[setting][axis + '|' + value]` URL. Its current renderer is LunarLander-specific and requires explicit `trainingSeed`, `episodeSeed`, `return`, `terrain`, `padY`, and polygon `frames`. It must not be used for another environment. A newly rendered checkpoint episode must be labeled separately from an archived evaluation episode; do not imply reproduction without a verified return match. Other environments require a recorded video or an environment-specific recorded-state renderer.

## Publish

GitHub Pages: deploy the `main` branch, `/ (root)`. `.nojekyll` keeps static assets untouched. The public site contains summaries and paper figures, not checkpoints, credentials, or raw private files. A custom `.site` domain is optional and must be acquired separately; the default `github.io` URL is free.

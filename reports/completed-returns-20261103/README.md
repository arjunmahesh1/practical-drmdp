# Completed 30-Seed Return Curves

Direct-human local delivery, November 3, 2026. This uses the fetched Mac
snapshot, described by the human as the 08:10 Pacific fetch. It is not a
fresh cluster status query or new experiment. No source study is overwritten.

Open [the local gallery](index.html), [the combined PDF atlas](completed_30seed_return_atlas.pdf),
or [the Overleaf ZIP](returns_overleaf.zip). The ZIP includes the individual
panels, overview PDFs, standalone `main.tex`, `returns_insert.tex` and CSVs.
The insert uses `graphicx` and `subcaption`. The standalone source compiled
successfully with the desktop editor's compiler.

## Coverage

There are 49 individual axis PDFs, eight overview PDFs and one eight-page
combined atlas: 58 PDF files and 65 PDF pages in total. Every plotted point
contains exactly 30 training seeds, 1000-1029.

| Comparison | Complete Active Settings Used | Declared Grid |
| --- | --- | --- |
| Pusher PPO-TV | All eight caps | Complete |
| Pusher SAC-TV | All eight caps | Complete |
| Pusher TD3-TV | All eight caps | Complete |
| PickCube SAC-KL | Beta 1, 3, 10, 30; bypass shown separately | Incomplete |
| ANYmal PPO-TV | Caps 0, 1, 1.5, 2 | 4/7 caps complete |
| Ant SAC-TV | Caps 50, 75, 100, 150, 200, 300 | Complete |
| Ant TD3-TV | Caps 10, 15 | 2/6 caps complete |
| Drawer PPO-TV | Cap 6 | 1/6 caps complete |

The package contains 1,500 policy slots across 50 settings, including
standards and the bypass reference, and 50,520 original policy-condition
means. These are not 1,500 newly trained policies. The matching ordinary
PickCube SAC standard is reused from the already validated October 28
end-effector-delta cohort; it is not the historical translation-controller
study or the joint-delta PPO cohort.

Lift is a three-seed pilot and is excluded. No new 30-seed Humanoid or
Ant PPO reference exists in this fetched snapshot. Incomplete PickCube
TD3-KL and Pusher KL are not promoted to completed comparisons. PPO-KL
remains blocked and is not added. Previously delivered HalfCheetah and
PickCube TV packages are not regenerated as new results.

## Plotting And Accounting

Ordinary standard remains fixed. Active settings are selected separately
per axis by the arithmetic mean across the displayed level grid, including
the measured nominal point. Selection is ex post and limited to settings
with all 30 completed suites. It is not a change to the launch-selection
rule, a held-out comparison, or a single fixed policy's full-suite guarantee.
The KL bypass is never an active candidate and is not relabeled ordinary SAC.

Each curve averages policy-level episode means. Bands are one sample SD
across training policies, using n-1, not confidence intervals or episode SD.
Nominal return is folded into an axis only when that nominal point is absent.
Payload nominal is zero added mass; delay/noise/replacement nominal is zero;
physical scale factors use one. No missing policies or returns are imputed.

`outputs/seed_accounting.csv` preserves all declared slots for the comparisons
shown. For PickCube SAC-KL, beta 0.1 and beta 0.3 each have 28 completed rows
and two failed rows. Both entire settings are excluded from the 30-seed
curves; failed-slot scientific artifacts are not read. Other unfinished
settings are also excluded, not averaged over their currently available seeds.
Absence in the local snapshot is not labeled scheduler failure or completion.

## Important Caveats

**Pusher friction:** all 270 per-policy saved means in each of the three
Pusher cells are exactly identical across every friction level. These
panels are flagged. Perturbation effectiveness is unverified: flat curves
must not be cited as evidence of tolerance to a verified friction shift.
No evaluator fix or rerun was made. See `outputs/flat_axis_audit.csv`.

**Competence is not universal:** the saved Pusher standards average 47.5%
PPO, 59.17% SAC and 44.67% TD3 nominal geometric end success, each over
30 policies and 20 evaluation episodes per policy. These are not native
Gymnasium success flags and do not establish uniformly competent policies.
No low-performing training seed is removed to improve the curves.
Drawer standard averages 43.5% nominal geometric end success, while cap 6
averages 1%; completion or a return curve is not a manipulation-success
certificate. ANYmal also lacks a physical task-success certificate here.

Descriptively, Pusher PPO has small selected axis-grid mean advantages;
Pusher SAC has mixed differences and TD3 has lower selected means on all
six axes, including the flagged friction axis. PickCube SAC-KL differences
are tiny, at most about 0.063 return on an axis-grid average. Available
Ant TD3 caps and Drawer cap 6 underperform their standards on every axis
average. ANYmal's larger axis-average differences can coexist with reduced
nominal return for some selected caps; they do not certify robust locomotion.
No significance, equivalence, noninferiority, hierarchy or robust-success
claim follows from these descriptive selections.

## Validation And Provenance

All 615,600 Pusher episode rows and 285,000 completed PickCube KL/bypass
episode rows were checked for finite returns, identity and complete suites.
The reused PickCube standard uses its previously validated policy means.
Isaac's 555,000 reported episodes are represented by completed native
policy summaries; raw Isaac episodes are not reread or newly certified.
Training/evaluation completion, source digest attestations, checkpoint digest
agreement and fixed suite identities are checked where supplied. No weights
are fetched, opened or hashed. This does not clear any training gate.

Ten focused synthetic tests pass. Independent standard-library calculations
check 5,361 mean/SD/count/selection quantities, maximum error 4.55e-13.
All 5,115 source files read retain their hashes. All 58 PDFs rasterize to
65 nonblank pages; individual panels and overviews have visual-review
contact sheets. The ZIP passes CRC checks. Receipts are in `provenance/`.

The local gallery is a static index, not a live website deployment. No
remote access, Delta authentication, fetch, job launch/mutation, evaluation,
training, website publication or monitor change occurred. Launcher ownership
and the existing daily monitor remain unchanged. This completed delivery
does not authorize repeated analysis, tests or QA on daily heartbeats.

Sources: `sweeps/package_completed_returns_20261103.py` and
`sweeps/verify_completed_returns_20261103.py`. The plotting style and
policy-mean summarizer reuse the existing return atlas. Source hashes,
policy means, every setting's condition summaries and seed accounting
are retained for independent inspection.

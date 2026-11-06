# Return advantages: descriptive curve audit

Declared before the scan on November 6, 2026. This is a direct-human local
analysis of published policy summaries, not new training or evaluation.

- Scan every active setting on every axis in the 36 visible website method
  configurations and all four supplied inverted-pendulum evaluation sets.
  Preserve archived custom TD3-KL exclusions. Do not pool evaluation sets.
- Fix the comparator to ordinary vanilla/standard (supplied non-robust), not
  an inactive cap, weakest available reference, or an axis-dependent reference.
- Recompute mean and sample SD from each setting's policy-level returns and
  check against published curves. Retain negative native returns as-is.
- Higher mean: robust minus standard exceeds an arithmetic tolerance of
  1e-10 times max(1, absolute means and SDs). This suppresses roundoff only,
  not a declared practically meaningful effect-size cutoff.
- Separated SD bands: robust mean minus its sample SD exceeds standard mean
  plus its sample SD by that tolerance. This is a descriptive visual screen,
  NOT a confidence interval, hypothesis test, or statistical significance.
- A range contains at least two adjacent measured shifted levels satisfying
  the selected screen for ONE fixed setting. Nominal, nonqualifying, missing,
  incomplete-policy levels break a range. Never bridge nominal even if it is
  not sampled. Single qualifying severities remain separately available.
  Lines between samples do not establish performance at unmeasured values.
- Require all intended policies (30) in both methods for eligible highlights.
  Retain incomplete and unverified perturbations in the audit with warnings,
  but do not promote them to default return advantages.
- Best per axis means the active fixed setting with the highest full-grid
  mean return, selected ex post, separately within each supplied TV/KL family.
  It is NOT a pointwise envelope. Also offer every active setting, including
  settings that outperform standard locally but are not best over the grid.
- No L1/L2/L3 requirement; no nominal competence, physical success, held-out,
  suite-wide, or multiplicity-corrected inference follows from a local range.
  Full curves and negative comparisons stay accessible.

Publish an additive tab, exhaustive point CSV and coverage table. Do not
overwrite prior scientific values, hierarchy tests, figures, media, or packages.

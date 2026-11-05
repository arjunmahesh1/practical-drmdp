# Robustness Results

November 3, 2026. Local analysis of the two supplied return datasets.

Open [the report](index.html). It needs no server or network connection.
The first view contains all settings and their metrics.
No contributor name identifies a method.

## Presentation

Confirmed by the user on November 4, 2026 Pacific:
- **DoublePendulum** = Dataset A = original `json` folder.
- **Pendulum** = Dataset B = original `json 2` folder.

The user confirms that `perturbations.md` is wrong. Its environment description
is superseded by this mapping; the supplied originals are preserved unchanged.
Exact environment IDs/versions and simulator are not established by the names alone.
Interactive selectors and CSV dataset labels now use the confirmed names.
Existing static figures retain their Dataset A/B aliases with this explicit mapping.
No returns, numerical metrics or figure pixels were changed or recomputed.
See [the identity correction receipt](identity_correction.json).
The supplied files do not establish SAC, standard SAC, or a particular SAC variant.
TV and KL labels retain their supplied numeric values. They do not imply confirmed parameter units.

The report includes 20 settings across two datasets and 150 setting-axis combinations.
It preserves all 42,600 supplied values. The original intake remains unchanged.
The report does not combine these cohorts with earlier experiments.

## Metrics

| Metric | Definition |
| --- | --- |
| Return curves | Mean and sample SD across supplied rows at each condition. |
| Return reliability | Fraction of supplied rows above a shared normalized-return threshold. |
| Reliability AUC | Analytical mean of clipped normalized returns, with equal-level and equal-axis weights. |
| Threshold reliability | Retention at 25%, 50%, 75%, and 100% of the shared nominal reference. |
| Native-return survival | Fraction above a native-return threshold, without clipping or normalization. |
| Lower tail | Per-condition 10th percentile and mean of the lowest six of thirty rows. |
| Worst-condition mean | Minimum condition mean over the received shifted conditions. |
| Severity return AUC | Trapezoidal return average over each observed shifted magnitude interval, then equal-axis average. |
| Severity retention AUC | The same magnitude integration applied to clipped normalized return. |
| Reference differences | Setting-minus-reference differences, not paired seed effects or confidence intervals. |

For each dataset, the reference R0 is the standard nominal median from a documented pure-axis nominal column.
Every setting uses this same reference. A method cannot improve its score by lowering its own denominator.
Dataset A uses R0=500. Dataset B uses R0=4679.238082642545.

For Z=R/R0, reliability is S(t)=P(Z>=t).
Its clipped AUC over thresholds from zero to one equals E[clip(Z,0,1)].
Dataset A returns all lie between zero and R0. Its AUC therefore equals mean return divided by 500.
That AUC is a common scale, not independent evidence of improvement.
Native-return survival retains above-reference gains that clipped AUC discards.

Pure-axis nominal columns are excluded from shifted summaries.
Compound column zero remains included because its fixed physical shift is already active.
Severity AUC covers only the received shifted interval. It does not extrapolate missing magnitudes.
Its magnitude weighting differs from equal-level reliability AUC.

Lower-tail statistics summarize rows separately at each condition, then average levels and axes.
They are not CVaR of a matched full-suite policy score.
Worst-condition mean is not the mean of each policy's worst condition.
Best-per-axis display is ex post. The report disables its synthetic suite aggregation.

## Evidence Still Needed

The [metadata request](clarifications.md) lists the questions to send with the source-folder mapping.
The remaining gaps are algorithm identity, exact environment IDs/versions and simulator,
seed identity, evaluation semantics, and intervention definitions. The environment names are confirmed.

Thirty supplied rows do not establish thirty independent training runs.
Until row identities are confirmed, the report does not infer paired effects or cross-axis policy trajectories.
It also omits training reliability, robustness conditional on nominal competence, and independent-seed bootstrap intervals.
Failed or missing intended runs cannot receive invented returns.
Task success requires a recorded task-success measurement, not a return threshold.

All reported comparisons are descriptive. No dominance, significance, equivalence, noninferiority, or hierarchy certificate is claimed.
Small aggregate differences do not remove visible axis-level trade-offs.

## Files And Verification

- `outputs/setting_summary.csv`: 20 setting summaries and reference differences.
- `outputs/axis_summary.csv`: 150 setting-axis summaries.
- `outputs/reliability_curves.csv`: 2,020 threshold-reliability entries.
- `outputs/metrics.json`: all source values and interactive metrics.
- `plots/`: six PNG figures with neutral dataset titles.
- `provenance/report.json`: original payload hash and source-folder mapping.
- `provenance/intake.json`: unchanged original source-hash receipt.
- `provenance/validation.json`: independent numeric verification.

All 19 Python tests and 17 offline JavaScript tests passed, including the original intake tests.
Independent standard-library arithmetic checked 3,710 quantities; maximum absolute error was 9.1e-13.
All 17 archived source-file hashes remain unchanged. All six PNGs were visually reviewed.
Offline tests are not browser or responsive-layout verification.
The previous browser access restriction was not bypassed; no real-browser QA is claimed.

The original November 3 analysis performed no training, rollout, cluster operation,
website change, upload or deployment. The November 4 identity correction changes
labels and provenance only; the report is included in the published results website.
The daily account monitor must not repeat this analysis or its tests.

Sources: `sweeps/package_pendulum_metrics_20261103.py` and `sweeps/pendulum_metrics_report.html`.
The builder reuses the existing plotting and CSV helpers. It reads the preserved intake payload, not new scientific artifacts.

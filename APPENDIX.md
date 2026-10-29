# Interactive Paper Appendix

The appendix extends the existing GitHub Pages site. It does not replace study data or rollout assets.

## Views

- `#appendix`: completed-study index and the paper's main empirical questions.
- `#evidence`: activation, L1, L2, L3, conditional analysis, and independent confirmation.
- `#metrics`: reliability, native-return thresholds, seed distributions, severity, all-setting aggregates, and recorded task outcomes.
- `#figures`: searchable figure library with previews, PDF links, source paths, and paper labels.
- Existing `#returns`, `#explore`, and `#methods` links remain supported.

Metric links preserve the study, setting, comparator, scope, axis, condition, and conditional-population flag.
The manuscript map uses stable labels from the user's October 29 work-in-progress draft.
It does not assign final figure numbers or edit the manuscript.

## Scientific Boundaries

The export reads completed policy-summary tables only.
Every policy row is checked against its published curve's policy count and mean.
Tests independently check sample standard deviations.
All 20 pre-existing study JSON files remain byte-identical.
The five completed October 28 comparisons are separate additions.

Reliability uses the selected reference's nominal median.
Suite metrics exclude nominal conditions, average levels within each axis, and weight axes equally.
Native-return survival curves do not use this normalization.
Normalized reliability is unavailable when a required nominal reference is nonpositive.
No reward offset is added.

Missing final policies have no imputed return.
Conditional curves use each method's own nominally competent policies.
They are not replacements for all-policy comparisons.
Recorded episode outcomes are separate from reliability across trained policies.
Return-threshold competence is not physical task success.

These are descriptive metrics, not new confidence intervals or automatic hierarchy certificates.
Historical PDF intervals retain their original cohort and comparator.
In particular, cap 500 and ordinary standard TD3 are different references.
The supplied manuscript has inconsistent captions and duplicate sections; no inconsistency is silently resolved by changing source data.
Missing local manuscript PDFs appear in the figure-library coverage details.

## Reproduction

Use the existing research Python environment with NumPy, pandas, and Matplotlib.
The exporter imports existing axis-parsing helpers but does not execute scientific analyzers.
It also needs `pdftoppm` for figure previews.

```sh
python tools/export_appendix.py --root /path/to/cleanrl --site .
node --test tests/appendix.test.mjs tests/replay-chart.test.mjs tests/video-segment.test.mjs tests/pickcube-oct28.test.mjs
```

The export is idempotent. It preserves existing study files and caches figure previews by content hash.
Public CSVs contain only allowlisted policy-summary columns, never checkpoint paths or credentials.

For browser checks, use an existing local HTTP server and installed Playwright with Chrome:

```sh
node tools/check_appendix.cjs http://127.0.0.1:8766/ /tmp/appendix-browser-qa
```

`data/appendix/export-receipt.json` records source-point agreement and preservation hashes.
This task does not authorize training, simulator jobs, cluster changes, or new rollout recording.

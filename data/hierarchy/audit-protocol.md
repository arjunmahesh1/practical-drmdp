# All-Setting Hierarchy Audit

Fixed before computing the new all-setting results, November 5, 2026.

## Scope

Assess every published active setting in the 36 visible method configurations. Keep archived custom TD3-KL out of the new audit. Read only completed, published policy-level summaries, not episodes, checkpoints or cluster artifacts. No new rollouts or training.

## Comparators and Normalization

The human requests comparison against vanilla or no-op, whichever gives stronger observed evidence. Compute and retain BOTH where a no-op exists. Name the comparator in every result. Never change a comparator between axes within an L3 comparison. A gain over a no-op is not a gain over vanilla.

Use the current manuscript's formula consistently for this new audit: on each axis, R0 is that named reference's nominal median, fixed over every severity and both methods. Do not choose an R0 by looking at shifted performance. Keep earlier paper-reported results and cached tests with their original normalization intact as historical evidence, not interchangeable new results. Explicitly validate the old cached tests using their own fixed R0 separately from the new axis-specific audit.

## L1

Preserve the author's qualitative L1 rule and existing judgments. No 5% L1 tolerance is introduced. A weak no-op cannot rescue a robust method already judged nominally incompetent against its task reference. Review nominal mean/failure trade-offs for alternate references separately and mark borderline cases; do not silently promote them. Keep the original reference and its qualitative judgment visible in the audit data.

## L2

For each fixed setting and each comparator, test EVERY available side of EVERY declared axis. Split using the axis's actual nominal parameter, not hardcoded scale 1. Nonnegative corruption magnitudes with nominal 0 form one shift. Exclude nominal. Pool shifted severities equally.

Repair: lower bound of the 95% whole-policy percentile-bootstrap interval of side reliability-AUC difference is greater than zero. Return guardrail: lower bound of the whole nonnominal-axis return difference is at least -0.05 times the absolute reference whole-axis mean. One qualifying shift establishes the L2 component. The cumulative level also requires L1.

## L3

Keep one setting and one comparator fixed over the complete predefined saved suite. Average severities within each axis and axes equally. Require positive lower 95% bound for unconditional suite reliability-AUC difference AND a lower return-difference bound at least -0.05 times the absolute reference axis-balanced suite mean. Require L1 and L2 for cumulative L3. Conditional-only improvement is not L3.

## Resampling and Eligibility

10,000 whole-policy resamples, percentile 95% intervals, deterministic RNG seed 0. For the ten historical cells covered by the explicit November 3 paired protocol, use matched seed pairs for that paper comparator only. Use independent method/reference whole-policy resampling for other comparisons; equal numeric seed labels alone do not establish a paired design. Preserve every severity of a sampled policy together. No episode-level resampling.

Require all 30 intended policy identities at every included level, with consistent identities within each method. Do not drop failed/missing policies or average partial pairs. A nonpositive R0 makes this normalized metric undefined; do not invent an offset or reverse the ratio. Mark missing identities and incomplete cohorts explicitly. Supplied pendulum row matrices are not verified independent training-policy identities and receive no policy-level inference certificate.

An axis with a published perturbation-effect warning cannot establish L2. Any such axis blocks a full-suite L3 claim; full saved-suite numbers may still be provided as diagnostic numbers with the warning.

## Interpretation

This is an exploratory all-setting audit, not independent confirmation. Many settings, shifts and references are examined. Pointwise intervals follow the paper's declared rule, without a newly invented multiplicity correction; do not call the strongest observed comparison a confirmatory discovery. Report adverse and inconclusive cases as well as passes. Show the named comparator and an explicit post-hoc selection label when highlighting the strongest observed comparison.

The table reports the highest level supported by this evidence, not a proof of a setting's true robustness level or physical task success. Replace generic Not assessed with an actual test result or a concrete reason the current definition cannot be evaluated.

# Five-Dimensional Robustness Profiles

Fixed before computing this audit. Source: the human's November14 manuscript,
Deployment Shifts and Measuring Robustness, not its old Results section.

## Inputs And Scope

Use only already-published trained-policy summary vectors from the website
snapshot c3c34daa15a714ccb47fbc886067bef582805a46. No episodes, checkpoints,
cluster queries, training or new rollouts. Retain distinct task versions,
controllers, batches and comparators. Assess every currently published
nonstandard setting, including explicit inactive and KL-off controls. Keep the
three previously archived custom-support/context TD3-KL studies opt-in.
Incomplete settings remain unavailable, with no missing-result imputation.
Supplied Pendulum matrices lack verified independent policy identities and
receive descriptive profiles only, not seed-bootstrap claims.

## Comparators And Pairing

Ordinary standard is the default reference. Where an inactive or KL-off control
exists, also calculate fixed-setting versus that control and control versus
standard. Name the reference everywhere. Never choose the weakest reference or
change it within a suite. Human-confirmed common-seed design permits paired
whole-policy resampling within a study/code/cluster. PickCube SAC/TD3-KL versus
October28 standard is independent. HalfCheetah SAC-TV inactive versus standard
is cross-batch and independent. Cross-cluster comparisons are independent.
Retain independent sensitivity intervals for every paired comparison, and
historical seed-index pairing sensitivity for cross-batch comparisons. Pairing
is human design attestation, not a new initialization or RNG audit. Published
identity sets that differ without a verified matching map use independent
resampling, never pairing by sorted row position (including legacy RSC).

## Definitions

Each axis uses the named comparator's fixed nominal median R0. Ratio metrics
require R0>0. The user explicitly confirms no sign flip or arbitrary offset for
nonpositive nominal references. Native-unit mean return remains assessable.
Negative shifted returns with positive R0 remain valid and clip to zero.

Mean return is noninferior when the lower95% interval of the difference is at
least -0.05*abs(reference mean). The absolute value is human-confirmed so the
guardrail also works for negative returns. Also report strict mean improvement
(lower>0) separately. L1 uses nominal, L2 uses the entire nonnominal axis on
both sides, L3 averages levels within axes and gives axes equal weight.

Reliability is mean clip(R/R0,0,1). Catastrophe probability is mean 1{R/R0<0.5}.
L2 pools all measured levels on one side of nominal; nominal-zero nonnegative
signal axes have one side. L3 uses every declared nonnominal axis equally.
At L1, the manuscript's weaker preservation rule is reported exactly: a
reliability change passes unless its entire interval is below0, and a
catastrophe change passes unless its entire interval is above0. These are
"no demonstrated nominal harm", NOT formal equivalence or noninferiority.
L2/L3 reliability needs lower>0; catastrophe reduction needs upper<0.

Banded reliability is mean clip((R/R0-a)/(b-a),0,1), separately for failure
[0,0.5), degraded[0.5,0.8), near-nominal[0.8,1]. Positive lower95% bound is a
pass at L2/L3; L1 is not applicable. Never collapse the three bands by silently
selecting the most favorable. Width-weighted areas reproduce full reliability.

Consistency is the unweighted fraction of measured nonnominal levels whose
mean clipped retained-return difference is strictly positive. Every bootstrap
draw resamples whole policies and recomputes the level wins, rather than
resampling levels or episodes. Lower95% W>0.5 is a pass at L2/L3. Exact ties
count0 under the supplied formula and are reported separately. Numerical zero
uses absolute tolerance 1e-12 on the clipped 0-1 scale. Consequently,
identical methods have W=0, not0.5; the paper's equivalence sentence needs
qualification. L1 consistency is not applicable.

For the L3 consistency breakdown, the human confirms mild standard nominal
loss<0.2, moderate0.2 through0.5, severe>0.5. Membership uses the observed
standard median per level/R0 and is fixed during resampling. Missing bands
remain unavailable. W counts levels equally as in the manuscript, even though
the L3 mean/reliability/catastrophe/band metrics weight axes equally. Nominal
summaries average the already-saved axis-specific nominal evaluations with
axes equally weighted; repeated conditions never become additional policies.
Conditional deployment catastrophe is also shown descriptively within each
method's nominally competent subset, with its actual denominator. Different
subsets do not define a causal matched comparison.

## Uncertainty And Profile

10,000 whole-policy percentile bootstrap replicates, RNG seed0, two-sided95%
intervals. A sampled policy retains every condition, axis and feature. Fixed
R0 is not re-estimated. No L1->L2->L3 cumulative gate: each metric vertex is
the widest scope whose own rule passes. Mean-return guardrail and nominal
competence distributions remain visible beside other dimensions. A metric
signal can coexist with return harm; never advertise it as overall robustness.

Unverified perturbations cannot establish L2. A suite containing an unverified
axis cannot establish eligible L3; retain its full-suite diagnostic statistics
without silently dropping axes. Incomplete identities likewise block claims.
Measured task success and update-activation evidence are preconditions to an
attributable physical-robustness claim, not quantities inferred from returns.
Unknown activation remains explicit. Compare KL-on directly with KL-off before
attributing a gain to KL. Failure to establish a gain is not proof of no effect.

Every cap, scope, band and comparator is exploratory/post-hoc. Pointwise
intervals are not multiplicity-adjusted. The ordered website is an evidence
browser, not a confirmatory-discovery leaderboard or a pentagon-area score.
The selected cap remains fixed across all vertices. An algorithm-level
best-per-dimension envelope must never masquerade as one fixed policy profile.

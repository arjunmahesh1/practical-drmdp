# Paper Placement And Interpretation

## Most Useful Addition

Add PickCube TD3-TV to the manipulation return-results subsection, next to
the newer PPO and SAC cohorts. Cap 3 is selected on all six axes, so this
particular displayed comparison uses one fixed setting even though the
selection procedure allowed different settings per axis. The six
axis-grid mean improvements are 1.06%-1.91%. This is a modest descriptive
gain, not a confirmed robustness result.

Suggested wording follows.

> In the end-effector-delta PickCube cohort, TD3 cap 3 has the largest
> full-grid mean among the eight tested caps on every axis. Its axis-average
> returns exceed ordinary TD3 by 0.43-0.61, or 1.06%-1.91%. Nominal return
> also increases from 40.45 to 41.15. These results suggest a small return
> improvement for this cohort, but do not separate nominal learning quality
> from improved shift tolerance. The setting is selected on the displayed
> evaluation data and the bands show across-policy standard deviation.

Use `td3_tv_pickcube_20261029/all_axes.pdf` in that discussion. Keep the
complete six-axis comparison in the appendix rather than selecting only
the favorable action-replacement panel. A claim about physical success
would require a separate analysis of the recorded outcome fields.

## KL Control Result

Place the HalfCheetah physical-support KL result in the KL implementation
or control-ablation discussion, with its complete return curves in the
appendix. Do not merge it with the new native-GAE moment-bootstrap KL gate.
Its parameter is a physical-support radius, not the new beta parameter.

Suggested wording follows.

> The selected physical-support KL settings improve on ordinary
> HalfCheetah TD3 on all 36 axis-average comparisons. The equal-axis mean
> of the selected full-grid curves is 8,369, compared with 8,119 for
> ordinary TD3. However, the radius-zero ensemble reaches 8,445 on the
> same summary. Even the per-axis selected active settings exceed that
> control on only 10 of 36 axes. The ordinary-TD3 comparison therefore
> does not identify the KL penalty as the source of the return gain.

These averages weight axes equally and levels equally within each axis,
including the nominal level where measured. They are not pooled-episode
means. The per-axis oracle is not a deployable single setting. The
fixed-setting summaries, including the zero-radius control, are in
`outputs/fixed_setting_suite_summary.csv`. No inferential comparison was
performed.

The 36-axis counts retain twelve localized mass/friction axes with exactly
flat saved per-policy returns. Do not interpret those panels as tolerance
to a verified physical shift. On the other 24 axes, the selected active
KL settings still exceed ordinary TD3 on all axis-grid means and exceed
the radius-zero control on 10. The accompanying table reports the
24-axis sensitivity summaries separately rather than silently removing
the flat panels. Current-local XML/source inspection suggests inherited
density/friction values may have been skipped, but the archived runtime
was not audited. Any claim about physically effective localized shifts
requires that separate verification.

## Negative Comparisons

Keep HalfCheetah TD3-TV and PickCube SAC-TV in the appendix coverage table
and mention them briefly in the results discussion. They help delimit the
scope of the method rather than supply another positive example.

> TV clipping does not yield a general return improvement across these
> additional cells. HalfCheetah TD3 selects cap 900 on all 36 axes but
> exceeds ordinary TD3 on only two axis averages. PickCube SAC selects
> cap 4.5 throughout and remains essentially unchanged, with axis-average
> differences between -0.025 and +0.052 return.

The small-severity and high-severity levels remain visible even when they
weaken a favorable pattern. Overlapping SD bands are not an equivalence
test, and a lack of a favorable descriptive mean is not a powered proof
of no effect.

## Required Labels

The new HalfCheetah gravity axis varies the horizontal component,
`gx = -x m/s^2`, while downward gravity stays unchanged. Zero horizontal
gravity is nominal. The raw scenario labels do not describe a downward
gravity multiplier. Use the corrected labels from this delivery, not the
older generic gravity-scale caption.

PickCube SAC and TD3 use end-effector-delta commands. The October 28 PPO
cohort uses joint-delta commands. The older historical PickCube policies
are also separate. Do not pool their training seeds, comparator means,
return distributions, or physical-success estimates.

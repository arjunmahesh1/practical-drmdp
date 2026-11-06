# Upper SD edge: corrected advantage definition

The human explicitly corrected the definition on November 6, 2026:

    robust mean + robust sample SD > standard mean + standard sample SD

Overlapping shaded bands qualify. Do NOT require the robust lower edge to
exceed the standard upper edge. Do NOT silently add a higher-mean requirement.
A larger robust SD can satisfy this criterion despite a lower robust mean;
show the mean difference and upper-edge gap separately. This is descriptive,
not statistical significance, a confidence interval, or a risk-adjusted gain.

Reclassify the immutable published cc1dbae snapshot. Preserve all original
means, sample SDs, counts, source hashes, references, settings and best-fixed
full-grid-mean selections. No new source episodes, training, or evaluations.

Keep the original completeness, flagged-perturbation and nominal exclusions.
Ranges contain at least two adjacent qualifying shifted measurements of one
fixed setting; offer isolated severities separately. Nominal, incomplete and
nonqualifying points break ranges. Do not claim unmeasured interpolated gains.
Use the original roundoff tolerance 1e-10 * max(1, absolute means and SDs).

Make the corrected rule the website default. Retain higher-mean and strict
non-overlapping-band screens as explicitly labeled optional views. Original
scientific files, hierarchy tests and the previous delivery remain unchanged.

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

## Gain-size display filter (November 6)

The underlying upper-edge criterion and all 1,147 original adjacent-range
comparisons remain unchanged. All matches exposes them, including small and
spread-led matches. The default view now prioritizes Noticeable gains.

This is an adjustable descriptive display filter, not a significance test or
a new hierarchy assessment. Default cutoff: 5%, with 2% and 10% alternatives.
The normalization range is max(mean + SD) - min(mean - SD) over BOTH complete
full curves, including nominal. This avoids dividing by near-zero returns at
one severity. In upper-edge mode, EACH selected shifted measurement needs
both its mean gain AND upper-edge gap to reach the cutoff times that range.
The same adjacency, completeness, nominal and warning exclusions still apply.

Small differences have an adjacent range with both higher mean and higher
upper edge, but no range meeting the display cutoff. Spread-led comparisons
have upper-edge ranges but no adjacent qualifying higher-mean range. This
does not mean every point in the comparison has a lower mean. The tiers are
exclusive per comparison; a comparison with a noticeable range can also have
small differences elsewhere. Only above-cutoff ranges are highlighted in the
Noticeable view; All matches retains all originally qualifying ranges.

Within tiers, rank by the strongest range: average max(0, min(mean gain,
upper-edge gap)) / normalization range, multiplied by that range's number of measured
levels / all complete shifted levels. No continuous interval weighting or
interpolation is implied. In optional higher-mean / non-overlapping screens,
use mean difference / robust-lower-minus-standard-upper gap, respectively.
Within Spread-led, use the positive upper-edge gap alone for ordering, not
the mean gain. This ranking does not promote a spread-led case to Noticeable.
Negative nominal outcomes, incomplete studies and source warnings remain
visible. Repeated evaluations are still not independent new training runs.

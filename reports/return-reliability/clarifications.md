# Result Metadata Request

We can compute descriptive return metrics from the supplied files now.
Please confirm these details so the final labels and seed-level analysis are correct.

1. **Algorithm and environments:** Did standard SAC generate both folders? If not, name the exact variant.
   Please give the code revision and environment IDs/versions for `json` and `json 2`.
   Both notes say `InvertedDoublePendulum-v5`, but the tentative folder mapping says Double Pendulum and Pendulum.
2. **Rows and completeness:** Are the 30 rows independent training seeds, evaluation seeds, or episodes?
   Please provide seed IDs, row order across files/settings, and any failed or missing intended runs.
3. **Evaluation and selection:** What does each entry aggregate, and over how many episodes?
   Please give the horizon, reward scaling, deterministic/stochastic evaluation, normalization handling, and checkpoint-selection rule.
   Also identify any development data used to choose the TV/KL settings.
4. **Interventions:** What do TV-75 and KL-70 mean mathematically and in the implementation?
   Please provide the clipping/penalty location, units, and exact perturbation code/configuration.
   In particular, confirm motor-gear/mass factors and whether compound column zero already includes the fixed physical shift.

A configuration file, code commit, seed list, and evaluation script can answer most of this without a long written explanation.
No rerun is requested here.

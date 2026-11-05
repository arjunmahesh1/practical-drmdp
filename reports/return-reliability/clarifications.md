# Confirmed Mapping And Remaining Metadata

The user confirmed on November 4, 2026 Pacific:
- Dataset A / original `json` folder is **DoublePendulum**.
- Dataset B / original `json 2` folder is **Pendulum**.

The user also confirms `perturbations.md` is wrong. Its environment description
is superseded; the original supplied files remain preserved as received.
This resolves the environment names, not the following implementation details.

1. **Algorithm and exact versions:** Did standard SAC generate both folders? If not, name the exact variant.
   Please give the code revision and environment IDs/versions for `json` and `json 2`.
   Please confirm the simulator/backend. The incorrect notes do not establish these details.
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

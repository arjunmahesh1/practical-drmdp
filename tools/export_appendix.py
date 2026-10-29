"""Export completed policy summaries and a provenance-preserving figure index.

No episode files, checkpoints, simulator calls, or inferential analyses are used.
Existing study JSON files are never rewritten.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n')


def export(root, site):
    sys.path.insert(0, str(root))
    from sweeps.generate_return_atlas import parse_axis_and_factor, axis_title

    catalog_path = site / 'data/catalog.json'
    catalog = json.loads(catalog_path.read_text())
    original = {s['file']: digest(site / 'data' / s['file']) for s in catalog['studies']}
    receipt_path = site / 'data/appendix/export-receipt.json'
    preserved = json.loads(receipt_path.read_text())['preservedStudies'] if receipt_path.exists() else original
    source_cache, sources = {}, {}

    def load(relative):
        if relative not in source_cache:
            path = root / relative
            source_cache[relative] = pd.read_csv(path, low_memory=False)
            sources[relative] = dict(path=relative, sha256=digest(path))
        return source_cache[relative].copy()

    # New return-only deliveries are added without replacing any existing cohort.
    newer = 'sweeps/results/ROBOTICS_RETURN_UPDATE_20261028/outputs/'
    newer_frame = load(newer + 'policy_mean_returns.csv')
    metadata = load(newer + 'condition_summary.csv')
    for cell, frame in newer_frame.groupby('cell', sort=False):
        if cell in {s['id'] for s in catalog['studies']}:
            continue
        row = metadata[metadata.cell == cell].iloc[0]
        models = sorted(frame.variant.unique(), key=lambda m: (m != 'vanilla', m))
        axes = []
        for name, part in frame.groupby('axis', sort=True):
            if name == 'nominal':
                continue
            curves = {}
            for model, values in part.groupby('variant', sort=False):
                curves[model] = [dict(x=float(x), mean=float(v.mean_return.mean()),
                                      sd=float(v.mean_return.std(ddof=1)), n=len(v))
                                 for x, v in values.groupby('value', sort=True)]
            nominal = -10 if name == 'gravity' else (0 if row.environment.startswith('Lunar') or name in {'action_replacement', 'gaussian_action_noise'} else 1)
            axes.append(dict(id=name, title=axis_title(name), nominal=nominal, curves=curves))
        study = dict(id=cell, environment=row.environment, algorithm=row.algorithm,
                     family=row.family, branch=row.family, models=models, baseline='vanilla',
                     axes=axes, source=newer+'policy_mean_returns.csv', paper='returns_updated.tex',
                     note='Completed October 28 delivery. Same-cluster standard; 30 training seeds per setting and 50 episodes per condition. Paper settings selected descriptively ex post; not independent confirmation.',
                     statistic='Mean of policy-level episode means; bands are across-policy sample SD, not confidence intervals.', playback=None)
        write_json(site / 'data' / (cell+'.json'), study)
        catalog['studies'].append({k: v for k, v in study.items() if k != 'axes'} | dict(axisCount=len(axes), file=cell+'.json'))

    entries, agreements, gaps = [], 0, []
    for meta in catalog['studies']:
        study = json.loads((site / 'data' / meta['file']).read_text())
        relative = meta['source']
        if meta['id'] == 'ppo_tv_pickcube_20261028':
            relative = relative.replace('condition_summary.csv', 'policy_mean_returns.csv')
        if meta['id'].startswith('lunar_sac_'):
            family = 'TV' if meta['id'].endswith('tv') else 'KL'
            relative = f'sweeps/results/SAC_{family}_LunarLander_v3_full30_20261009/outputs/combined_metrics.csv'
        frame = load(relative)
        if 'cell' in frame:
            frame = frame[frame.cell == meta['id']]
        if 'env_id' in frame:
            frame = frame[frame.env_id == meta['environment']]
        frame = frame.rename(columns={'variant': 'model_label', 'model': 'model_label', 'training_seed': 'seed', 'value': 'factor'})
        if 'scenario_label' in frame:
            frame = parse_axis_and_factor(frame)
        frame = frame[frame.model_label.isin(study['models'])]
        assert not frame.duplicated(['model_label', 'seed', 'axis', 'factor']).any(), meta['id']
        assert np.isfinite(frame.mean_return).all(), meta['id']
        exported_axes = []
        study_ok = True
        for axis in study['axes']:
            part = frame[frame.axis == axis['id']]
            values = {}
            for model in study['models']:
                rows = []
                for point in axis['curves'][model]:
                    found = part[(part.model_label == model) & np.isclose(part.factor, point['x'], rtol=0, atol=1e-10)]
                    if len(found) != point['n'] or not np.isclose(found.mean_return.mean(), point['mean'], rtol=1e-10, atol=1e-7):
                        study_ok = False
                        gaps.append(dict(study=meta['id'], axis=axis['id'], model=model, value=point['x'], reason='Source policy rows do not reproduce the published curve.'))
                    rows.append(dict(x=point['x'], seeds=[[int(r.seed), float(r.mean_return)] for r in found.sort_values('seed').itertuples()]))
                    agreements += 1
                values[model] = rows
                outcome_columns = [c for c in ['episode_return_ge200','unsafe_terminal_fraction','crash_fraction','out_of_bounds_fraction','settled_fraction','timeout_fraction','other_terminal_fraction'] if c in part]
                for point in rows:
                    observed = part[(part.model_label == model) & np.isclose(part.factor, point['x'], rtol=0, atol=1e-10)]
                    if outcome_columns:
                        point['outcomes'] = {c: float(observed[c].mean()) for c in outcome_columns}
            # Some saved grids omit the nominal point for signal axes. Use only
            # a same-cohort nominal grid, and declare which axis supplies it.
            nominal_part = part[np.isclose(part.factor, axis['nominal'], rtol=0, atol=1e-10)]
            nominal_source = axis['id']
            if nominal_part.empty:
                nominal_part = frame[frame.axis == 'nominal']
                nominal_source = 'nominal'
            if nominal_part.empty:
                for candidate in study['axes']:
                    candidate_rows = frame[(frame.axis == candidate['id']) & np.isclose(frame.factor, candidate['nominal'], rtol=0, atol=1e-10)]
                    if not candidate_rows.empty:
                        nominal_part, nominal_source = candidate_rows, candidate['id']
                        break
            nominal = {m: [[int(r.seed), float(r.mean_return)] for r in nominal_part[nominal_part.model_label == m].sort_values('seed').itertuples()] for m in study['models']}
            exported_axes.append(dict(id=axis['id'], title=axis['title'], nominal=axis['nominal'], values=values, nominalSeeds=nominal, nominalSource=nominal_source))
        entry = dict(id=meta['id'], environment=meta['environment'], algorithm=meta['algorithm'], family=meta['family'], branch=meta['branch'], models=study['models'], baseline=study['baseline'], axes=exported_axes, source=relative, sourceSha256=sources[relative]['sha256'], validated=study_ok,
                     intendedPolicies=10 if meta['id']=='td3_kl_context_walker' else 30,
                     note=study['note'], inference='Descriptive empirical metrics. No new bootstrap, significance test, noninferiority test, or L1/L2/L3 certification.')
        if study_ok:
            write_json(site / 'data/appendix' / (meta['id']+'.json'), entry)
            # Public columns are strictly allowlisted; never copy checkpoint paths.
            public = frame[['model_label', 'seed', 'axis', 'factor', 'mean_return']].copy()
            public.to_csv(site / 'data/appendix' / (meta['id']+'.csv'), index=False)
        entries.append({k: entry[k] for k in ['id','environment','algorithm','family','branch','models','baseline','source','sourceSha256','validated','intendedPolicies','note']} | dict(axisCount=len(exported_axes), file='data/appendix/'+meta['id']+'.json' if study_ok else None))

    figures, seen = [], {}
    out = site / 'assets/appendix'
    out.mkdir(exist_ok=True)

    def add_figure(path, section, studies=None, paper_label=None, status='Published archive; original caption and comparator apply'):
        sha = digest(path)
        if sha in seen:
            if paper_label:
                seen[sha]['paperLabel'] = paper_label
            return
        name = sha[:16] + '.pdf'
        shutil.copyfile(path, out / name)
        preview = out / (sha[:16]+'.jpg')
        if not preview.exists():
            subprocess.run(['pdftoppm','-f','1','-singlefile','-scale-to','950','-jpeg',str(path),str(preview.with_suffix(''))], check=True, capture_output=True)
        figure = dict(id=sha[:16], title=path.stem.replace('_',' '), section=section, studies=studies or [],
                      pdf='assets/appendix/'+name, preview='assets/appendix/'+preview.name,
                      source=str(path.relative_to(root)), sha256=sha, paperLabel=paper_label, status=status)
        figures.append(figure)
        seen[sha] = figure

    # These are figure collections, not claims of matching modern cohorts.
    archive = root / 'overleaf_figures_update_20261005/Results/AllExperiments'
    for path in sorted((archive/'advanced').rglob('*.pdf')):
        study_id = path.parent.name.replace('td3_context_kl_walker', 'td3_kl_context_walker')
        add_figure(path, 'Reliability & failure diagnostics', [study_id], status='Historical advanced analysis. Its control, seed count and intervals are not transferred to the current interactive cohort.')
    for path in sorted((archive/'return_rows').glob('*.pdf')):
        add_figure(path, 'Paper return comparisons', [path.stem.replace('td3_context_kl_walker','td3_kl_context_walker')])
    for path in sorted((root/'Results').rglob('*.pdf')):
        if 'CompletedFull30' in path.parts:
            add_figure(path, 'Task outcomes & reliability', [path.parent.name])
        else:
            add_figure(path, 'SAC KL Walker diagnostics', ['sac_kl_walker'], status='Published archive. Check the original policy count; current KL beta50 has only 29 measured finals.')
    paper_figures = [
        ('fig:walker-ppo-full30-single-axis','ppo_vanilla_global_shift_severity.pdf','ppo_tv_walker','Shift severity'),
        ('fig:bimodal-policy-returns','bimodal_returns_friction_damping_0p7.pdf','ppo_tv_walker','Seed distributions'),
        ('fig:walker-td3-tv-intervention','td3_tv_cap_intervention_main.pdf','td3_tv_walker','Activation'),
        ('fig:rsc-sac-final-nominal-main','rsc_sac_final_nominal_return.pdf','rsc_sac_walker','L1: nominal competence'),
        ('fig:ppo-best-cap-return-curves','ppo_best_cap_return_curves.pdf','ppo_tv_walker','L2: shift-specific evidence'),
        ('fig:walker-ppo-mass-reliability','ppo_mass_0p5_reliability_main.pdf','ppo_tv_walker','L2: shift-specific evidence'),
        ('fig:walker-ppo-l2-l3-matched','ppo_l2_l3_matched_c2p95.pdf','ppo_tv_walker','L2 versus L3'),
        ('fig:walker-ppo-seed-conditioned','ppo_seed_conditioned_absolute_returns.pdf','ppo_tv_walker','Seed distributions'),
        ('fig:sac-td3-shift-reliability','sac_td3_shift_reliability.pdf','sac_kl_halfcheetah','L2: shift-specific evidence'),
        ('fig:level3-sac-kl-conditional','level3_sac_kl_full_suite_conditional.pdf','sac_kl_halfcheetah','L3: suite-wide evidence'),
        ('fig:level3-td3-full-suite','level3_td3_tv_full_suite.pdf','td3_tv_walker','L3: suite-wide evidence'),
        ('fig:walker-td3-kl-confirmation','td3_kl_confirmation_reliability_difference.pdf','td3_kl_physical_walker','Independent confirmation'),
        ('fig:td3-tv-nominal-competence','level1_td3_tv_nominal_competence.pdf','td3_tv_walker','L1: nominal competence'),
        ('fig:sac-kl-representative-curves','sac_kl_halfcheetah.pdf','sac_kl_halfcheetah','Paper return comparisons'),
        ('fig:td3-tv-representative-curves','td3_tv_walker_fixed_c400.pdf','td3_tv_walker','Paper return comparisons')]
    search_roots = [root/'sweeps/results/PAPER_RESULTS_COMMENTS_20261014/Results', root/'overleaf_figures_update_20261005/Results']
    missing_figures = []
    for paper_label, name, study_id, section in paper_figures:
        matches = [p for directory in search_roots for p in directory.rglob(name)]
        if matches:
            add_figure(matches[0], section, [study_id], paper_label, 'Referenced by the supplied work-in-progress manuscript; original caption and comparator apply.')
        else:
            missing_figures.append(dict(label=paper_label, filename=name))
    for figure in catalog['gallery']:
        path = site / figure['pdf']
        sha = digest(path)
        preview = out / (sha[:16]+'.jpg')
        if not preview.exists():
            subprocess.run(['pdftoppm','-f','1','-singlefile','-scale-to','950','-jpeg',str(path),str(preview.with_suffix(''))], check=True, capture_output=True)
        matching = [s['id'] for s in entries if s['id'] in Path(figure['source']).parts]
        figures.append(figure | dict(id='returns-'+str(len(figures)), section='Return atlas', studies=matching, paperLabel=None, sha256=sha, preview='assets/appendix/'+preview.name, status='Historical return panel; original reference and ex-post selection apply.'))
        seen[sha] = figures[-1]
    for path in sorted((root / 'sweeps/results/ROBOTICS_RETURN_UPDATE_20261028/Results').rglob('*.pdf')):
        matching = [s['id'] for s in entries if s['id'] in path.parts]
        if any(s in {'ppo_tv_lunar','td3_tv_lunar','td3_kl_lunar','sac_kl_pusher','td3_kl_pusher'} for s in matching):
            add_figure(path, 'October 28 completed returns', matching)
    for path in sorted((archive/'source_studies').rglob('*.pdf')):
        add_figure(path, 'Historical source studies / 10 seeds', status='Separate ten-seed source bundle, not part of the 30-seed confirmation cohorts. No newer cohort is assigned these intervals.')

    # This directory is exporter-owned. Remove only unreferenced hash-named
    # generated copies; original scientific figures and all video assets stay put.
    used = {Path(f[key]).name for f in figures for key in ['pdf','preview'] if key in f and f[key].startswith('assets/appendix/')}
    for path in out.iterdir():
        if re.fullmatch(r'[0-9a-f]{16}\.(pdf|jpg)', path.name) and path.name not in used:
            path.unlink()

    write_json(site/'data/appendix/index.json', dict(updated='2026-10-29', studies=entries, figures=figures, sources=list(sources.values()), gaps=gaps, missingPaperFigures=missing_figures,
        manuscript='Scaling Robust Markov Decision Processes for Deep Reinforcement Learning (user-supplied work in progress, October 29)',
        methods='Per-policy episode means. Standard nominal median reference. Nonnominal severities averaged within axes, then equal weight per axis. Reliability uses R/R0 only when every required nominal reference is positive. Failed training seeds are missing, not zero-valued. Descriptive recomputation is not statistical confirmation.'))
    catalog['updated'] = '2026-10-29'
    for source in sources.values():
        if source['path'] not in {s['path'] for s in catalog['sources']}:
            catalog['sources'].append(source)
    write_json(catalog_path, catalog)
    assert all(digest(site/'data'/name) == sha for name, sha in original.items()), 'Existing studies changed'
    receipt = dict(studies=len(entries), validStudies=sum(s['validated'] for s in entries), comparedCurvePoints=agreements,
                   gaps=gaps, figures=len(figures), missingPaperFigures=missing_figures, preservedStudies=preserved,
                   scope='Completed summary tables only. No new evaluation, confidence intervals, media rendering, or cluster operations.')
    write_json(site/'data/appendix/export-receipt.json', receipt)
    print(json.dumps({k:v for k,v in receipt.items() if k != 'preservedStudies'}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--site', type=Path, required=True)
    args = parser.parse_args()
    export(args.root.resolve(), args.site.resolve())

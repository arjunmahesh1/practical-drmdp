"""Export completed paper summaries without reading live jobs or changing studies."""
import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def export(root, destination):
    root=root.resolve()
    sys.path.insert(0, str(root))
    from sweeps.generate_return_atlas import STUDIES, axis_title, axis_sort_key, nominal_factor, parse_axis_and_factor
    from sweeps.generate_all_results_figures import STUDIES as ALL_STUDIES
    data = destination / 'data'
    data.mkdir(parents=True, exist_ok=True)
    sources, studies = {}, []

    def source(path):
        key = str(path.relative_to(root))
        if key not in sources:
            sources[key] = dict(path=key, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        return key

    def save(study, frame, baseline='vanilla', note=''):
        assert not frame.duplicated(['model_label', 'seed', 'axis', 'factor']).any(), study['id']
        assert np.isfinite(frame.mean_return).all(), study['id']
        axes = []
        models = sorted(frame.model_label.unique(), key=lambda x: (x != baseline, x))
        assert baseline in models, study['id']
        for axis in sorted(frame.axis.unique(), key=axis_sort_key):
            if axis == 'nominal':
                continue
            curves = {}
            for model in models:
                f = frame[(frame.axis == axis) & (frame.model_label == model)]
                points = []
                for factor, part in f.groupby('factor', sort=True):
                    values = part.mean_return.to_numpy(dtype=float)
                    points.append(dict(x=float(factor), mean=float(values.mean()), sd=float(values.std(ddof=1)) if len(values)>1 else 0.0, n=len(values)))
                curves[model] = points
            assert all(curves.values())
            assert len({tuple(p['x'] for p in points) for points in curves.values()}) == 1
            nominal = -10 if study['environment'].startswith('Lunar') and axis == 'gravity' else (0 if study['environment'].startswith('Lunar') else nominal_factor(axis))
            if axis in {'translation_noise', 'translation_replacement', 'gaussian_action_noise', 'action_replacement'}:
                nominal = 0
            axes.append(dict(id=axis, title=axis_title(axis), nominal=nominal, curves=curves))
        study.update(axes=axes, models=models, baseline=baseline, note=note,
                     statistic='Mean of policy-level episode means; bands are ±1 across-policy sample standard deviation, not confidence intervals.',
                     playback=None)
        (data / (study['id']+'.json')).write_text(json.dumps(study, separators=(',', ':'), allow_nan=False))
        studies.append({k:v for k,v in study.items() if k != 'axes'} | dict(axisCount=len(axes), file=study['id']+'.json'))

    specs = [(s.slug,s.environment,s.algorithm,s.method,s.metrics,s.description) for s in STUDIES]
    specs += [(s.slug,s.env_id,'RSC-SAC','TV',s.metrics,s.caption+' Standard SAC is a separate cohort; this is an unpaired comparison.') for s in ALL_STUDIES if s.slug.startswith('rsc_')]
    for slug, env, alg, method, path, note in specs:
        f = pd.read_csv(path, low_memory=False)
        f = parse_axis_and_factor(f[f.env_id == env])
        save(dict(id=slug,environment=env,algorithm=alg,family='KL' if 'KL' in method else 'TV',branch=method,source=source(path),paper='returns.tex'),f,note=note)

    path = root/'sweeps/results/RETURN_ONLY_ATLAS_v2_20261012/outputs/plotted_returns.csv'
    summaries = pd.read_csv(path)
    for slug in ['lunar_sac_tv','lunar_sac_kl']:
        f=summaries[summaries.study==slug]
        axes=[]
        for axis, part in f.groupby('axis',sort=False):
            curves={}
            for model, points in part.groupby('model_label',sort=False):
                curves[model]=[dict(x=float(r.value),mean=float(r.mean),sd=float(r.std),n=int(r.seeds)) for r in points.sort_values('value').itertuples()]
            axes.append(dict(id=axis,title=axis_title(axis),nominal=-10 if axis=='gravity' else 0,curves=curves))
        study=dict(id=slug,environment='LunarLander-v3',algorithm='SAC',family='KL' if slug.endswith('kl') else 'TV',branch='KL' if slug.endswith('kl') else 'TV',source=source(path),paper='returns.tex',axes=axes,models=list(axes[0]['curves']),baseline='vanilla',note='KL beta10 has 26 measured finals out of 30 intended seeds. Failed policies have no imputed returns. Other controls and settings remain distinct.',statistic='Mean ±1 across-policy sample SD, taken directly from the published return-only atlas.',playback=None)
        (data/(slug+'.json')).write_text(json.dumps(study,separators=(',',':'),allow_nan=False))
        studies.append({k:v for k,v in study.items() if k!='axes'} | dict(axisCount=len(axes),file=slug+'.json'))

    path=root/'sweeps/results/ROBOTICS_RETURN_ATLAS_20261022/outputs/policy_mean_returns.csv'
    f=pd.read_csv(path)
    metadata=pd.read_csv(path.with_name('condition_summary.csv'))
    for cell, rows in f.groupby('cell',sort=False):
        m=metadata[metadata.cell==cell].iloc[0]
        rows=rows.rename(columns={'variant':'model_label','value':'factor'})
        save(dict(id=cell,environment=m.environment,algorithm=m.algorithm,family=m.family,branch=m.family,source=source(path),paper='returns_updated.tex'), rows,
             note='30 policies per setting; 20 saved episodes per policy and condition. Standard uses the same cluster as its candidates. Paper panels select robust settings ex post per axis; the explorer lets you hold a setting fixed.')

    # Preserve every PDF referenced by the delivered returns document and its inserts.
    gallery=[]
    visited=set()
    figure_root=root/'sweeps/results/RETURN_ONLY_ATLAS_v2_20261012/returns_return_only_20261012/Results/ReturnAtlas'
    robotics=root/'sweeps/results/ROBOTICS_RETURN_ATLAS_20261022/Results/ReturnAtlas'
    pdfdir=destination/'assets/paper';pdfdir.mkdir(parents=True,exist_ok=True)
    def scan(path, section='Paper'):
        if path in visited:return
        visited.add(path)
        text=path.read_text()
        token=re.compile(r'\\(?:subsection|section)\{([^}]+)\}|\\input\{([^}]+)\}|\\includegraphics(?:\[[^]]*\])?\{(\\detokenize\{[^}]+\}|[^}]+)\}')
        for match in token.finditer(text):
            sec,insert,image=match.groups()
            if sec:section=sec
            elif insert:
                p=root/insert
                if p.exists():scan(p,section)
            elif image:
                image=image.removeprefix('\\detokenize{').removesuffix('}')
                if image.startswith('\\ReturnFigureRoot/'):
                    suffix=image.split('/',1)[1]
                    p=robotics/suffix
                    if not p.exists():p=figure_root/suffix
                else:p=root/image
                if not p.exists():raise FileNotFoundError(p)
                key=hashlib.sha256(str(p.relative_to(root)).encode()).hexdigest()[:12]+'-'+p.name
                shutil.copyfile(p,pdfdir/key)
                gallery.append(dict(section=section,title=axis_title(p.stem),pdf='assets/paper/'+key,source=str(p.relative_to(root))))
    scan(root/'sweeps/results/ROBOTICS_RETURN_ATLAS_20261022/returns_updated.tex')
    # All completed-source settings are exported. Never select the weakest control.
    catalog=dict(updated='2026-10-22',studies=studies,sources=list(sources.values()),gallery=gallery,
                 scientificNote='Descriptive saved evaluation results. Missing settings have no data. Policy variability is not a confidence interval. Environment versions and distinct control cohorts are never pooled.')
    (data/'catalog.json').write_text(json.dumps(catalog,separators=(',',':'),allow_nan=False))
    print(json.dumps(dict(studies=len(studies),axes=sum(s['axisCount'] for s in studies),paperPanels=len(gallery),sources=len(sources))))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,required=True);parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args();export(args.root,args.out)

"""Summarize actual playback coverage and missing execution inputs."""
import argparse
import datetime
import json
from pathlib import Path


def coverage(site, caches):
    inputs = {(item['cell'], item['model']) for cache in caches
        for item in json.loads((cache / 'manifest.json').read_text()) if item['status'] == 'ready'}
    studies = []
    for meta in json.loads((site / 'data/catalog.json').read_text())['studies']:
        study = json.loads((site / 'data' / meta['file']).read_text())
        models = []
        for model in study['models']:
            axes = []
            for axis in study['axes']:
                values = [point['x'] for point in axis['curves'][model]]
                recorded = [value for value in values
                    if axis['id'] + '|' + format(value, 'g') in study.get('replays', {}).get(model, {})]
                axes.append(dict(axis=axis['id'], expected=len(values), recorded=len(recorded),
                    missing=[value for value in values if value not in recorded]))
            ready = (study['id'], model) in inputs
            if study['environment'] == 'PickCube-v1':
                requirement = 'Original Linux ManiSkill/SAPIEN runtime with working RGB renderer'
            elif study['environment'] == 'LunarLander-v3':
                requirement = 'Exact archived actor/normalization and Box2D/pygame recording runtime'
            elif not ready:
                requirement = 'Exact completed actor and normalization, not only return tables'
            else:
                requirement = 'Remaining local recordings and QA; scalable video hosting for full matrix'
            models.append(dict(model=model, privateInputsVerified=ready,
                recorded=sum(a['recorded'] for a in axes), expected=sum(a['expected'] for a in axes),
                remainingRequirement=requirement if any(a['missing'] for a in axes) else None, axes=axes))
        studies.append(dict(study=study['id'], environment=study['environment'], algorithm=study['algorithm'],
            recorded=sum(m['recorded'] for m in models), expected=sum(m['expected'] for m in models), models=models))
    return dict(generatedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        recorded=sum(s['recorded'] for s in studies), expected=sum(s['expected'] for s in studies), studies=studies,
        interpretation='One illustrative recording per displayed selection, not all training seeds. Missing selections remain unavailable.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', type=Path, required=True)
    parser.add_argument('--cache', type=Path, action='append', default=[])
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = coverage(args.site, args.cache)
    with args.output.open('x') as stream:
        json.dump(result, stream, indent=2)
    print(json.dumps({key: value for key, value in result.items() if key != 'studies'}, indent=2))


if __name__ == '__main__':
    main()

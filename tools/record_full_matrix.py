"""Render missing selections with isolated policy indexes; merge only complete jobs."""
import argparse
import concurrent.futures
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys


def jobs(site, caches):
    available = {}
    for cache in caches:
        for item in json.loads((cache / 'manifest.json').read_text()):
            if item['status'] == 'ready':
                available[(item['cell'], item['model'])] = (cache, item)
    result = []
    for meta in json.loads((site / 'data/catalog.json').read_text())['studies']:
        study = json.loads((site / 'data' / meta['file']).read_text())
        if study['environment'] not in ['Walker2d-v4', 'Walker2d-v5', 'HalfCheetah-v4']:
            continue
        for model in study['models']:
            expected = sum(len(axis['curves'][model]) for axis in study['axes'])
            existing = len(study.get('replays', {}).get(model, {}))
            if expected == existing:
                continue
            cache, item = available[(study['id'], model)]
            result.append(dict(cell=study['id'], model=model, cache=str(cache),
                expected=expected, existing=existing, checkpoint_sha256=item['checkpoint_sha256']))
    return result


def merge(site, directory, plan):
    changed = {}
    for job in plan:
        index = json.loads((directory / (job['cell'] + '__' + job['model'] + '.json')).read_text())
        if index['cell'] != job['cell'] or index['model'] != job['model'] or len(index['replays']) != job['expected']:
            raise ValueError('Incomplete policy recording index')
        study = changed.setdefault(job['cell'], json.loads((site / 'data' / (job['cell'] + '.json')).read_text()))
        expected = {axis['id'] + '|' + format(point['x'], 'g')
            for axis in study['axes'] for point in axis['curves'][job['model']]}
        if set(index['replays']) != expected:
            raise ValueError('Recorded grid differs from saved results')
        for key, relative in index['replays'].items():
            path = site / relative
            record = json.loads(path.read_text())
            if (record['study'] != job['cell'] or record['model'] != job['model']
                    or record['checkpointSha256'] != job['checkpoint_sha256']
                    or record['axis'] + '|' + format(record['value'], 'g') != key
                    or not path.with_suffix('.mp4').is_file()):
                raise ValueError('Recording missing or identity mismatch')
        study.setdefault('replays', {})[job['model']] = index['replays']
    for cell, study in changed.items():
        path = site / 'data' / (cell + '.json')
        path.write_text(json.dumps(study, separators=(',', ':'), allow_nan=False))
    return len(changed)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--site', type=Path, required=True)
    parser.add_argument('--cache', type=Path, action='append', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--run', action='store_true')
    parser.add_argument('--merge', action='store_true')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    plan_path = args.output / 'plan.json'
    plan = json.loads(plan_path.read_text()) if plan_path.exists() else jobs(args.site, args.cache)
    if not plan_path.exists():
        plan_path.write_text(json.dumps(plan, indent=2))
    print(json.dumps(dict(policies=len(plan), missing=sum(j['expected']-j['existing'] for j in plan))), flush=True)
    if args.run:
        def run(job):
            name = job['cell'] + '__' + job['model']
            command = [sys.executable, str(args.site / 'tools/record_mujoco.py'), '--root', str(args.root),
                '--site', str(args.site), '--cache', job['cache'], '--cell', job['cell'], '--model', job['model'],
                '--index-output', str(args.output / (name + '.json'))]
            with (args.output / (name + '.log')).open('a') as stream:
                process = subprocess.run(command, stdout=stream, stderr=subprocess.STDOUT,
                    env={**os.environ, 'OMP_NUM_THREADS':'1', 'OPENBLAS_NUM_THREADS':'1'})
            result = dict(cell=job['cell'], model=job['model'], returncode=process.returncode,
                finished_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
            (args.output / (name + '.result.json')).write_text(json.dumps(result, indent=2))
            print(json.dumps(result), flush=True)
            return result
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
            results = list(pool.map(run, plan))
        if any(result['returncode'] for result in results):
            raise RuntimeError('Some recording workers failed; inspect their exact logs before resuming')
    if args.merge:
        print(json.dumps(dict(merged_studies=merge(args.site, args.output, plan))))


if __name__ == '__main__':
    main()

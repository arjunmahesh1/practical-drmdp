"""Fetch only selected completed actors/norms, never jobs, logs, or learner sources."""
import argparse
import hashlib
import json
import shlex
import subprocess
import tarfile
from pathlib import Path
from recording_sources import policy_candidates


REMOTE = r'''
import hashlib,io,json,sys,tarfile
from pathlib import Path
requests=json.load(sys.stdin)
files=[];manifest=[]
for request in requests:
    item=dict(request)
    try:
        if request['kind']=='robotics':
            directory=Path(request['directory'])
            complete=json.loads((directory/'complete.json').read_text())
            if (directory/'failure.json').exists() or complete.get('smoke'):
                raise ValueError('Not a completed final policy')
            paths=[p for p in (directory/'learner').rglob('*.cleanrl_model') if 'checkpoints' not in p.parts]
            if len(paths)!=1:raise ValueError('Expected one final actor')
            actor=paths[0];norm=Path(str(actor)+'.norm_stats.npz') if request['algorithm']=='PPO' else actor
        else:
            actor=Path(request['checkpoint'])
            norm=Path(request['normalization']) if request.get('normalization') else actor
            if max(actor.stat().st_mtime,norm.stat().st_mtime)>request['evaluated_timestamp']:
                raise ValueError('Actor or normalization changed after archived evaluation')
        hashes={}
        for name,path in [('checkpoint',actor),('normalization',norm)]:
            digest=hashlib.sha256(path.read_bytes()).hexdigest()
            expected=request.get('expected_hashes',{}).get(name+'_sha256')
            if expected and expected!=digest:raise ValueError(name+' does not match archived episode hash')
            hashes[name+'_sha256']=digest
            files.append((path,request['key']+'/'+name+'.bin'))
        item.update(hashes,status='ready')
    except Exception as exc:
        item.update(status='unavailable',error=str(exc))
    manifest.append(item)
payload=json.dumps(manifest,indent=2).encode()
with tarfile.open(fileobj=sys.stdout.buffer,mode='w|') as archive:
    for path,name in files:archive.add(path,arcname=name,recursive=False)
    info=tarfile.TarInfo('manifest.json');info.size=len(payload);archive.addfile(info,io.BytesIO(payload))
'''


def plan(root, site, cells=None):
    requests=[]
    catalog=json.loads((site/'data/catalog.json').read_text())
    for meta in catalog['studies']:
        cell=meta['id']
        if cells and cell not in cells:continue
        if meta['environment'] not in ['Walker2d-v4','Walker2d-v5','HalfCheetah-v4']:continue
        study=json.loads((site/'data'/meta['file']).read_text())
        for model,(seed,row) in policy_candidates(root,study).items():
            algo=row['algo']
            if algo not in ['ppo_cont','td3','yiting_sac','yiting_td3','rsc_sac']:
                raise ValueError('Unsupported archived algorithm: '+algo)
            mode='none' if algo=='td3' else 'embedded' if algo in ['yiting_td3','rsc_sac'] else 'sidecar'
            expected={}
            if algo=='ppo_cont':
                expected['ppo_definition_sha256']=hashlib.sha256((root/'cleanrl/ppo_continuous_action.py').read_bytes()).hexdigest()
            requests.append(dict(key=cell+'__'+model,cell=cell,model=model,kind='legacy',loader=algo,
                algorithm=study['algorithm'],environment=study['environment'],training_seed=seed,
                checkpoint=row['model_path'],normalization=row['norm_stats_path'] if mode=='sidecar' else None,
                normalization_mode=mode,evaluated_timestamp=float(row['timestamp']),expected_hashes=expected,
                definition_evidence='Current canonical loader; strict saved-state compatibility, not an archived source hash'))
    validation=json.loads((root/'sweeps/results/ROBOTICS_RETURN_ATLAS_20261022/provenance/validation.json').read_text())
    for cell in ['ppo_tv_pickcube','td3_tv_pickcube','td3_kl_pickcube','ppo_tv_pusher']:
        if cells and cell not in cells:continue
        study=json.loads((site/'data'/f'{cell}.json').read_text())
        for model in study['models']:
            identity=dict(environment=study['environment'],algorithm=study['algorithm'],variant=model,training_seed=1000)
            evidence=next(item for item in validation['inputs'] if item['identity']==identity)
            source=Path(evidence['path']).relative_to(root).parts[2]
            directory=f"/home/users/am1015/cleanrl/sweeps/results/{source}/models/calibration/{study['environment']}/{study['algorithm']}/{model}/seed_1000"
            requests.append(dict(key=cell+'__'+model,cell=cell,model=model,kind='robotics',
                algorithm=study['algorithm'],environment=study['environment'],training_seed=1000,
                directory=directory,expected_hashes=evidence['saved_hashes'],reference_file=evidence['path']))
    return requests


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--remote',required=True)
    parser.add_argument('--cells',nargs='+')
    args=parser.parse_args()
    args.cache.mkdir(parents=True,exist_ok=True)
    if (args.cache/'manifest.json').exists():
        raise FileExistsError('Recording input cache already exists; do not replay a fetch blindly')
    requests=plan(args.root.resolve(),args.site.resolve(),args.cells)
    command=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlias=login.cs.duke.edu',
        '-o','ConnectTimeout=10','-o','ConnectionAttempts=1',args.remote,
        '/home/users/am1015/cleanrl/sweeps/results/ROBOTICS_TV_KL_20261008/venv/bin/python -c '+shlex.quote(REMOTE)]
    archive_path=args.cache/'inputs.tar'
    with archive_path.open('xb') as output:
        subprocess.run(command,input=json.dumps(requests).encode(),stdout=output,check=True,timeout=180)
    with tarfile.open(archive_path) as archive:
        for member in archive:
            path=Path(member.name)
            if path.is_absolute() or '..' in path.parts or not member.isfile():
                raise ValueError('Unexpected recording-input archive member')
            target=args.cache/path;target.parent.mkdir(parents=True,exist_ok=True)
            with target.open('xb') as stream:stream.write(archive.extractfile(member).read())
    items=json.loads((args.cache/'manifest.json').read_text())
    for item in items:
        if item['status']=='ready':
            for name in ['checkpoint','normalization']:
                path=args.cache/item['key']/(name+'.bin')
                if hashlib.sha256(path.read_bytes()).hexdigest()!=item[name+'_sha256']:
                    raise ValueError('Downloaded file hash mismatch')
    print(json.dumps(dict(ready=sum(i['status']=='ready' for i in items),
        unavailable=[dict(cell=i['cell'],model=i['model'],error=i['error']) for i in items if i['status']!='ready']),indent=2))


if __name__=='__main__':main()

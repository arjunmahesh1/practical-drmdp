"""Record exact completed PickCube policies in the existing authorized Linux runtime."""
import argparse
import hashlib
import json
from pathlib import Path
import shlex
import subprocess
import sys


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def worker(request):
    import importlib.metadata
    import resource
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    sys.path.insert(0, request['source'])
    import gymnasium as gym
    import numpy as np
    import torch
    from experiments.robotics_robustness.envs import make_task
    from experiments.robotics_robustness.pickcube_deployment import PickCubeDeployment
    from experiments.robotics_robustness.saved_policy import SavedPolicy
    torch.set_num_threads(1)
    output = Path(request['output'])
    if not output.is_relative_to(Path(request['root']) / 'sweeps/results/WEBSITE_RECORDINGS_ALL_20261023'):
        raise ValueError('Recording output must stay outside protected studies')
    output.mkdir(parents=True, exist_ok=True)
    contract = output / 'request.json'
    if contract.exists() and json.loads(contract.read_text()) != request:
        raise ValueError('Existing recording request differs')
    contract.write_text(json.dumps(request, indent=2))
    versions = {name:importlib.metadata.version(name) for name in ['gymnasium','torch','mani_skill','sapien']}
    count = 0
    for item in request['items']:
        directory = Path(item['directory'])
        completion = json.loads((directory / 'complete.json').read_text())
        policy = SavedPolicy(directory, completion['row'],
            gym.spaces.Box(-np.inf,np.inf,(42,),dtype=np.float32),gym.spaces.Box(-1,1,(4,),dtype=np.float32))
        for field in ['checkpoint_sha256','normalization_sha256']:
            if policy.hashes[field] != item[field]:
                raise ValueError('Saved policy differs from verified recording input')
        for condition in item['conditions']:
            axis, value = condition['axis'], condition['value']
            stem = axis + '-' + str(value).replace('.','p').replace('-','m')
            relative = Path('assets/replays') / item['cell'] / item['model'] / (stem + '.mp4')
            movie = output / relative
            metadata = movie.with_suffix('.json')
            movie.parent.mkdir(parents=True, exist_ok=True)
            if metadata.exists():
                saved = json.loads(metadata.read_text())
                if (not movie.is_file() or saved['checkpointSha256'] != item['checkpoint_sha256']
                        or saved['episodeSeed'] != 100000 or saved['axis'] != axis or saved['value'] != value
                        or sha256(movie) != saved['videoSha256']):
                    raise ValueError('Existing PickCube recording identity differs')
                continue
            env = PickCubeDeployment(make_task('PickCube-v1',record_metrics=False,
                render_mode='rgb_array',render_backend='gpu'),axis=axis,value=value)
            writer = None
            try:
                observation,_ = env.reset(seed=100000)
                initial = np.asarray(env.render())
                if initial.shape != (512,512,3) or initial.dtype != np.uint8 or initial.std() < 1:
                    raise ValueError('Invalid PickCube camera frame')
                fps = int(env.unwrapped.control_freq)
                command = ['ffmpeg','-nostdin','-n','-loglevel','error','-f','rawvideo','-pixel_format','rgb24',
                    '-video_size','512x512','-framerate',str(fps),'-i','pipe:0','-c:v','libx264','-crf','24',
                    '-threads','1','-pix_fmt','yuv420p',str(movie)]
                writer = subprocess.Popen(command,stdin=subprocess.PIPE)
                timeline = [dict(step=0,time=0,reward=0)]
                writer.stdin.write(initial.tobytes())
                total, motion = 0., 0
                for step in range(1,51):
                    observation,reward,terminated,truncated,_ = env.step(policy.action(observation))
                    if terminated or truncated != (step == 50):
                        raise ValueError('PickCube horizon differs from archived task')
                    total += float(reward)
                    pixels = np.asarray(env.render())
                    if pixels.shape != initial.shape or not np.isfinite(total):
                        raise ValueError('Invalid recorded PickCube episode')
                    motion += int(np.mean(np.abs(pixels.astype(float)-initial.astype(float))) > .1)
                    writer.stdin.write(pixels.tobytes())
                    timeline.append(dict(step=step,time=step/fps,reward=total))
                writer.stdin.close()
                if writer.wait(timeout=30) != 0:
                    raise ValueError('PickCube video encoder failed')
                reference = condition['reference_return']
                record = dict(kind='video',video=str(relative),environment='PickCube-v1',study=item['cell'],
                    model=item['model'],axis=axis,value=value,trainingSeed=item['training_seed'],episodeSeed=100000,
                    checkpointSha256=item['checkpoint_sha256'],normalizationSha256=item['normalization_sha256'],
                    normalizationMode='sidecar' if item['algorithm']=='PPO' else 'embedded',loader=item['algorithm'],
                    fps=fps,steps=50,horizon=50,returnValue=total,referenceReturn=reference,
                    referenceMatched=abs(total-reference)<=max(.001,abs(reference)*1e-5),
                    referenceEpisodeAvailable=True,deterministic=True,observationNormalizationFrozen=True,
                    timeline=timeline,movingFrames=motion,videoSha256=sha256(movie),runtime=versions,
                    interpretation='New deterministic checkpoint replay, not a recovered video or cohort-average episode.')
                metadata.write_text(json.dumps(record,separators=(',',':'),allow_nan=False))
                count += 1
                print(json.dumps(dict(cell=item['cell'],model=item['model'],axis=axis,value=value,
                    recordings=count,referenceMatched=record['referenceMatched'])),flush=True)
            finally:
                if writer and writer.poll() is None:
                    writer.kill();writer.wait()
                env.close()
    print(json.dumps(dict(complete=True,new_recordings=count)),flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--worker',action='store_true')
    parser.add_argument('--root',type=Path)
    parser.add_argument('--site',type=Path)
    parser.add_argument('--cache',type=Path)
    parser.add_argument('--remote')
    args = parser.parse_args()
    if args.worker:
        worker(json.load(sys.stdin));return
    items = []
    for item in json.loads((args.cache/'manifest.json').read_text()):
        if item['environment'] != 'PickCube-v1' or item['status'] != 'ready':continue
        study = json.loads((args.site/'data'/(item['cell']+'.json')).read_text())
        reference = {}
        with Path(item['reference_file']).open() as stream:
            for line in stream:
                row = json.loads(line)
                if row['episode_seed']==100000:
                    reference[(row['axis'],float(row['value']))] = row['return']
        conditions = [dict(axis=axis['id'],value=point['x'],reference_return=reference[(axis['id'],point['x'])])
            for axis in study['axes'] for point in axis['curves'][item['model']]]
        items.append({**item,'conditions':conditions})
    if len(items)!=9 or sum(len(x['conditions']) for x in items)!=333:
        raise ValueError('Unexpected PickCube recording matrix')
    root = '/home/users/am1015/cleanrl'
    request = dict(root=root,source=root+'/sweeps/results/ROBOTICS_TV_KL_20261008/source_v2',
        output=root+'/sweeps/results/WEBSITE_RECORDINGS_ALL_20261023/pickcube',items=items)
    bundle = dict(code=Path(__file__).read_text(),request=request)
    launcher = """import json,os,pathlib,subprocess,sys
b=json.load(sys.stdin)
e=os.environ.copy();e.update(CUDA_VISIBLE_DEVICES='',OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',LP_NUM_THREADS='1',MS_ASSET_DIR='/home/users/am1015/cleanrl/sweeps/results/ROBOTICS_TV_KL_20261008/assets',MS_SKIP_ASSET_DOWNLOAD_PROMPT='1',LD_PRELOAD='/usr/lib/x86_64-linux-gnu/libstdc++.so.6')
e['LD_LIBRARY_PATH']=':'.join(str(p) for p in pathlib.Path('/home/users/am1015/cleanrl/.venv/lib/python3.11/site-packages/nvidia').glob('*/lib'))
p=subprocess.run([sys.executable,'-c',b['code'],'--worker'],input=json.dumps(b['request']).encode(),env=e,timeout=7200)
sys.exit(p.returncode)
"""
    command = ['ssh','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',
        '-o','HostKeyAlias=login.cs.duke.edu','-o','ConnectTimeout=15',args.remote,
        root+'/sweeps/results/ROBOTICS_TV_KL_20261008/venv/bin/python -c '+shlex.quote(launcher)]
    subprocess.run(command,input=json.dumps(bundle).encode(),check=True,timeout=7250)


if __name__ == '__main__':main()

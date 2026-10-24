"""Render the saved Lunar SAC TV/KL matrix with its frozen original evaluator."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import shutil
import sys

os.environ.setdefault('SDL_VIDEODRIVER','dummy')
os.environ.setdefault('SDL_AUDIODRIVER','dummy')
import gymnasium as gym
import numpy as np
import torch
from record_mujoco import record


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Replacement(gym.Wrapper):
    def __init__(self, env, probability):
        super().__init__(env)
        self.probability = probability

    def reset(self, *, seed=None, options=None):
        self.rng = np.random.default_rng(seed + 1000000)
        return self.env.reset(seed=seed,options=options)

    def step(self, action):
        if self.probability > 0 and self.rng.random() < self.probability:
            action = self.rng.uniform(-1,1,size=2).astype(np.float32)
        return self.env.step(action)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    torch.set_num_threads(1)
    study_root = args.root/'sweeps/results/SAC_LunarLander_v3_pilot_20261008'
    kl_root = args.root/'sweeps/results/SAC_KL_LunarLander_v3_full30_20261009'
    sys.path.insert(0,str(study_root/'source'))
    evaluation = runpy.run_path(str(study_root/'source/evaluate_lunar.py'))
    tv_validation = json.loads((args.root/'sweeps/results/SAC_TV_LunarLander_v3_full30_20261009/provenance/input_validation.json').read_text())
    kl_validation = json.loads((kl_root/'provenance/input_validation.json').read_text())
    for relative,expected_hash in tv_validation['source_hashes'].items():
        if digest(study_root/relative)!=expected_hash:raise ValueError('Frozen Lunar source differs from published provenance')
    conditions = {(c['axis'],float(c['value'])):c for c in evaluation['scenarios']()}
    manifest = []
    args.cache.mkdir(parents=True,exist_ok=True)
    args.output.mkdir(parents=True,exist_ok=True)
    for cell in ['lunar_sac_tv','lunar_sac_kl']:
        study = json.loads((args.site/'data'/(cell+'.json')).read_text())
        for model in study['models']:
            selected = None
            for seed in range(30):
                directory = study_root/'models/pilot'/model/f'seed_{seed}'
                complete = directory/'complete.json'
                if not complete.exists() or (directory/'failure.json').exists():continue
                config = json.loads((directory/'config.json').read_text())
                checkpoint = directory/f"actor_{config['max_steps']}.pth"
                raw = (kl_root if cell.endswith('kl') and model!='vanilla' else study_root)/'raw_metrics'/f'{model}_seed_{seed}.jsonl'
                if not raw.is_file():continue
                if (config['seed']!=seed or config['env_id']!='LunarLander-v3'
                        or config['max_steps']!=300000 or json.loads(complete.read_text())['steps']!=300000):
                    raise ValueError('Unexpected Lunar training identity')
                actor_hash = digest(checkpoint)
                references = {}
                with raw.open() as stream:
                    for line in stream:
                        row = json.loads(line)
                        if row['episode_seed']!=100000:continue
                        if row['checkpoint_sha256']!=actor_hash or row['training_seed']!=seed:
                            raise ValueError('Lunar actor does not match archived evaluation')
                        references[(row['axis'],float(row['value']))] = row
                expected = {(axis['id'],float(p['x'])) for axis in study['axes'] for p in axis['curves'][model]}
                if expected <= references.keys():
                    selected = directory,checkpoint,config,references,actor_hash;break
            if selected is None:raise ValueError('No exact complete Lunar recording input: '+model)
            directory,checkpoint,config,references,actor_hash = selected
            ledger = kl_validation['intended_training'] if cell.endswith('kl') else tv_validation['final_models']
            published = next(row for row in ledger if row.get('variant',row.get('model_label'))==model and row['seed']==config['seed'])
            if (published['state']!='complete' or published['checkpoint_sha256']!=actor_hash
                    or published['normalization_sha256']!=digest(directory/'norm.npy')):
                raise ValueError('Lunar actor/normalization differs from published provenance')
            key = cell+'__'+model
            private = args.cache/key;private.mkdir(exist_ok=True)
            for source,name in [(checkpoint,'checkpoint.bin'),(directory/'norm.npy','normalization.bin')]:
                target = private/name
                if target.exists() and digest(target)!=digest(source):raise ValueError('Lunar cache changed')
                if not target.exists():shutil.copyfile(source,target)
            item = dict(cell=cell,model=model,key=key,environment='LunarLander-v3',algorithm='SAC',kind='lunar',
                loader='yiting_sac',training_seed=config['seed'],checkpoint_sha256=actor_hash,
                normalization_sha256=digest(directory/'norm.npy'),normalization_mode='sidecar',status='ready')
            manifest.append(item)
            mean,std = np.load(directory/'norm.npy')
            if mean.shape!=(8,) or std.shape!=(8,) or not np.isfinite([mean,std]).all() or (std<=0).any():
                raise ValueError('Invalid Lunar frozen normalization')
            actor = evaluation['YitingSACActor'](8,2)
            actor.load_state_dict(torch.load(checkpoint,map_location='cpu',weights_only=True),strict=True)
            actor.eval().requires_grad_(False)
            def action(observation):
                with torch.inference_mode():
                    state = torch.as_tensor((observation-mean)/std,dtype=torch.float32)
                    return actor.deterministic_unit_action(state).numpy()
            index = dict(cell=cell,model=model,replays={})
            for axis in study['axes']:
                for point in axis['curves'][model]:
                    value = point['x'];condition = conditions[(axis['id'],float(value))]
                    env = Replacement(gym.make('LunarLander-v3',continuous=True,render_mode='rgb_array',
                        **condition['kwargs']),condition['replacement'])
                    try:
                        path = record(item,axis['id'],value,env,args.cache,args.root,args.site,100000,
                            references[(axis['id'],float(value))],action=action,dt=.02)
                    finally:env.close()
                    index['replays'][axis['id']+'|'+format(value,'g')] = path
                    (args.output/(key+'.json')).write_text(json.dumps(index,separators=(',',':')))
                    print(json.dumps(dict(cell=cell,model=model,axis=axis['id'],value=value)),flush=True)
    path = args.cache/'manifest.json'
    if path.exists() and json.loads(path.read_text())!=manifest:raise ValueError('Existing Lunar manifest differs')
    path.write_text(json.dumps(manifest,indent=2))


if __name__ == '__main__':main()

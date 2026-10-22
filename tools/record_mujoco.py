"""Record completed paper checkpoints locally, without changing evaluation tables."""
import argparse
import contextlib
import csv
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path
from types import SimpleNamespace

import gymnasium as gym
import imageio_ffmpeg
import mujoco
import numpy as np
import torch


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def import_file(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module)
    return module


def load_actor(item,cache,root,env):
    actor_path=cache/item['key']/'checkpoint.bin';norm_path=cache/item['key']/'normalization.bin'
    if digest(actor_path)!=item['checkpoint_sha256'] or digest(norm_path)!=item['normalization_sha256']:
        raise ValueError('Recording input changed after verification')
    if item['algorithm']=='PPO':
        source=root/'cleanrl/ppo_continuous_action.py'
        if digest(source)!=item['expected_hashes']['ppo_definition_sha256']:
            raise ValueError('PPO actor definition differs from archived evaluation')
        module=import_file('_recording_ppo',source)
        actor=module.Agent(SimpleNamespace(single_observation_space=env.observation_space,single_action_space=env.action_space))
        norm=np.load(norm_path);mean=norm['obs_mean'];std=np.sqrt(norm['obs_var']+1e-8)
        actor.load_state_dict(torch.load(actor_path,map_location='cpu',weights_only=True),strict=True)
        def action(observation):
            x=torch.as_tensor(np.clip((observation-mean)/std,-10,10),dtype=torch.float32)
            return actor.actor_mean(x).numpy().clip(env.action_space.low,env.action_space.high)
    elif item['algorithm']=='SAC':
        from experiments.yiting_sac30.eval_model import YitingSACActor
        mean,std=np.load(norm_path)
        actor=YitingSACActor(env.observation_space.shape[0],env.action_space.shape[0])
        actor.load_state_dict(torch.load(actor_path,map_location='cpu',weights_only=True),strict=True)
        def action(observation):
            x=torch.as_tensor((observation-mean)/std,dtype=torch.float32)
            unit=actor.deterministic_unit_action(x).numpy()
            return ((1-unit)*env.action_space.low/2+(1+unit)*env.action_space.high/2).clip(env.action_space.low,env.action_space.high)
    else:
        raise ValueError('Unsupported recording actor; do not substitute another algorithm')
    if not np.isfinite([mean,std]).all() or (std<=0).any():raise ValueError('Invalid frozen normalization')
    actor.eval().requires_grad_(False)
    return action


def pusher_env(axis,value):
    from experiments.robotics_robustness.envs import make_task
    from experiments.robotics_robustness.pusher_deployment import PusherDeployment
    return PusherDeployment(make_task('Pusher-v5',render_mode='rgb_array',width=640,height=480),axis=axis,value=value)


def legacy_env(row,root,output):
    from cleanrl_utils.mujoco_xml_utils import make_mujoco_env
    from cleanrl_utils.perturbation_config import apply_env_perturbations
    number=lambda key,default:float(row[key]) if row.get(key) not in (None,'','nan') else default
    text=lambda key:row.get(key,'') if row.get(key,'')!='nan' else ''
    env=make_mujoco_env(row['env_id'],xml_out_dir=str(output),run_name='recording',
        total_mass_scale=number('xml_total_mass_scale',1),body_mass_scale=number('xml_body_mass_scale',1),
        body_name_selector=text('xml_body_name_selector'),geom_friction_scale=number('xml_geom_friction_scale',1),
        geom_friction_component=int(number('xml_geom_friction_component',-1)),geom_name_selector=text('xml_geom_name_selector'),
        joint_damping_scale=number('xml_joint_damping_scale',1),joint_name_selector=text('xml_joint_name_selector'),
        actuator_gain_scale=number('xml_actuator_gain_scale',1),actuator_bias_scale=number('xml_actuator_bias_scale',1),
        gravity_component_index=int(number('xml_gravity_component_index',-1)),
        gravity_component_value=number('xml_gravity_component_value',None),
        actuator_joint_selector=text('xml_actuator_joint_selector'),render_mode='rgb_array')
    return apply_env_perturbations(env,obs_noise_std=number('obs_noise_std',0),obs_noise_clip=None,
        reward_noise_std=number('reward_noise_std',0),action_noise_std=number('action_noise_std',0),action_noise_clip=None,
        action_replace_prob=number('action_replace_prob',0),param_override_spec='',param_randomize_spec='',param_strict=True,seed=int(row['seed']))


def record(item,axis,value,env,cache,root,site,episode_seed,reference=None):
    stem=axis+'-'+str(value).replace('.','p').replace('-','m')
    directory=site/'assets/replays'/item['cell']/item['model'];directory.mkdir(parents=True,exist_ok=True)
    json_path=directory/(stem+'.json');video_path=directory/(stem+'.mp4')
    if json_path.exists():
        saved=json.loads(json_path.read_text())
        if (saved['checkpointSha256']!=item['checkpoint_sha256'] or saved['episodeSeed']!=episode_seed):
            raise ValueError('Existing replay has a different policy identity')
        return str(json_path.relative_to(site))
    action=load_actor(item,cache,root,env)
    dt=float(env.unwrapped.dt);stride=max(1,math.ceil(1/(dt*12)));fps=1/(dt*stride)
    observation,_=env.reset(seed=episode_seed)
    total=0.;timeline=[];steps=0;first_frame=None;motion=0
    horizon=gym.spec(item['environment']).max_episode_steps
    if not horizon:raise ValueError('Recording requires the declared evaluation horizon')
    initial=np.asarray(env.render())
    writer=imageio_ffmpeg.write_frames(str(video_path),size=(initial.shape[1],initial.shape[0]),fps=fps,codec='libx264',quality=6,macro_block_size=16,ffmpeg_log_level='error')
    writer.send(None)
    with contextlib.closing(writer):
        def frame():
            nonlocal first_frame,motion
            pixels=np.ascontiguousarray(env.render())
            if pixels.ndim!=3 or pixels.shape[2]!=3 or pixels.std()<1:
                raise ValueError('Blank or invalid simulator frame')
            if first_frame is None:first_frame=pixels.copy()
            elif np.mean(np.abs(pixels.astype(float)-first_frame.astype(float)))>.1:motion+=1
            writer.send(pixels)
            timeline.append(dict(step=steps,time=steps*dt,reward=total))
        frame()
        with torch.inference_mode():
            while True:
                observation,reward,terminated,truncated,_=env.step(action(observation))
                total+=float(reward);steps+=1
                if steps>=horizon and not terminated:truncated=True
                if not np.isfinite(total) or not np.isfinite(observation).all():raise ValueError('Nonfinite replay')
                if steps%stride==0 or terminated or truncated:frame()
                if terminated or truncated:break
    expected=reference.get('return') if reference else None
    matched=bool(expected is not None and abs(total-expected)<=max(.001,abs(expected)*1e-5))
    payload=dict(kind='video',video=str(video_path.relative_to(site)),environment=item['environment'],study=item['cell'],
        model=item['model'],trainingSeed=item['training_seed'],episodeSeed=episode_seed,axis=axis,value=value,
        checkpointSha256=item['checkpoint_sha256'],normalizationSha256=item['normalization_sha256'],
        fps=fps,steps=steps,horizon=horizon,returnValue=total,referenceReturn=expected,referenceMatched=matched,
        referenceEpisodeAvailable=expected is not None,deterministic=True,observationNormalizationFrozen=True,
        timeline=timeline,movingFrames=motion,runtime=dict(gymnasium=gym.__version__,mujoco=mujoco.__version__,torch=torch.__version__),
        interpretation='New deterministic checkpoint replay, not a recovered video or cohort-average episode.')
    json_path.write_text(json.dumps(payload,separators=(',',':'),allow_nan=False))
    return str(json_path.relative_to(site))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,required=True);parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--cache',type=Path,required=True);parser.add_argument('--cell',required=True)
    parser.add_argument('--axis',default='all');parser.add_argument('--model',default='all')
    args=parser.parse_args();args.root=args.root.resolve();sys.path.insert(0,str(args.root))
    torch.set_num_threads(1);torch.set_num_interop_threads(1)
    study_path=args.site/'data'/f'{args.cell}.json';study=json.loads(study_path.read_text())
    items=[item for item in json.loads((args.cache/'manifest.json').read_text()) if item['cell']==args.cell and item['status']=='ready' and (args.model=='all' or item['model']==args.model)]
    if not items:raise ValueError('No verified completed policy inputs for this selection')
    rows={}
    if study['environment'] not in ['Pusher-v5','PickCube-v1']:
        with (args.root/study['source']).open() as stream:
            for row in csv.DictReader(stream):
                if row['seed']=='0':rows[(row['model_label'],row['axis'],float(row['factor']))]=row
    count=0
    for item in items:
        reference={}
        if item['kind']=='robotics':
            with Path(item['reference_file']).open() as stream:
                for line in stream:
                    row=json.loads(line)
                    if row['episode_seed']==100000:reference[(row['axis'],float(row['value']))]=row
        for axis in study['axes']:
            if args.axis!='all' and axis['id']!=args.axis:continue
            for point in axis['curves'][item['model']]:
                value=point['x'];condition=(axis['id'],value)
                if study['environment']=='PickCube-v1':raise RuntimeError('PickCube requires original Linux ManiSkill/SAPIEN runtime; no simulator substitution')
                if study['environment']=='Pusher-v5':
                    env=pusher_env(*condition);seed=100000
                else:
                    env=legacy_env(rows[(item['model'],*condition)],args.root,args.cache/'xml');seed=item['training_seed']
                try:path=record(item,*condition,env,args.cache,args.root,args.site,seed,reference.get(condition))
                finally:env.close()
                study.setdefault('replays',{}).setdefault(item['model'],{})[axis['id']+'|'+format(value,'g')]=path
                study_path.write_text(json.dumps(study,separators=(',',':'),allow_nan=False))
                count+=1;print(json.dumps(dict(cell=item['cell'],model=item['model'],axis=axis['id'],value=value,recordings=count)),flush=True)


if __name__=='__main__':main()

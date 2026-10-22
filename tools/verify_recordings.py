"""Verify decoded recordings and record coverage without revisiting research inputs."""
import argparse
import collections
import contextlib
import datetime
import hashlib
import json
from pathlib import Path

import imageio_ffmpeg
import numpy as np


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    coverage=collections.Counter();matched=0;with_reference=0;max_error=0.;records=[]
    catalog=json.loads((args.site/'data/catalog.json').read_text())
    for meta in catalog['studies']:
        study=json.loads((args.site/'data'/meta['file']).read_text())
        for model,entries in study.get('replays',{}).items():
            for key,path in entries.items():
                record=json.loads((args.site/path).read_text());movie=args.site/record['video']
                if (record['study']!=study['id'] or record['model']!=model or key!=record['axis']+'|'+str(record['value']).removesuffix('.0')):
                    raise ValueError('Recording identity mismatch')
                with contextlib.closing(imageio_ffmpeg.read_frames(str(movie))) as reader:
                    video_meta=next(reader);frame=np.frombuffer(next(reader),dtype=np.uint8)
                    if frame.std()<1:raise ValueError('Blank encoded video frame')
                if record['steps']>({'Pusher-v5':100,'Walker2d-v5':1000,'HalfCheetah-v4':1000}[record['environment']]):
                    raise ValueError('Replay exceeds declared horizon')
                if record['timeline'][-1]['step']!=record['steps'] or record['timeline'][-1]['reward']!=record['returnValue']:
                    raise ValueError('Recording timeline mismatch')
                if record['referenceEpisodeAvailable']:
                    with_reference+=1;matched+=record['referenceMatched']
                    max_error=max(max_error,abs(record['returnValue']-record['referenceReturn']))
                coverage[study['id']]+=1
                records.append(dict(metadata=path,video=record['video'],
                    video_sha256=hashlib.sha256(movie.read_bytes()).hexdigest(),decoded_size=video_meta['size'],
                    training_seed=record['trainingSeed'],episode_seed=record['episodeSeed']))
    payload=dict(verified_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        recordings=len(records),coverage=dict(coverage),recordings_with_archived_individual_return=with_reference,
        archived_individual_returns_matched=matched,max_absolute_return_error=max_error,
        interpretation='New deterministic replays. Original cohort curves and failed-seed accounting unchanged.',
        unrecorded_selections='Remain explicitly unavailable; no other model or simulator is substituted.',records=records)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x') as stream:json.dump(payload,stream,indent=2)
    print(json.dumps({k:v for k,v in payload.items() if k!='records'},indent=2))


if __name__=='__main__':main()

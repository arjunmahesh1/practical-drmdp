"""Check lossless episode boundaries against decoded source frames before upload."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import subprocess

from package_video_segments import digest


def first_frame(movie, time=0):
    result = subprocess.run(['ffmpeg','-v','error','-nostdin','-threads','1',
        '-ss',format(time,'.6f'),'-i',str(movie),'-frames:v','1','-pix_fmt','rgb24',
        '-f','rawvideo','pipe:1'],capture_output=True,check=True,timeout=30)
    if not result.stdout:raise ValueError('Missing decoded segment frame')
    return hashlib.sha256(result.stdout).hexdigest()


def verify(site, manifest, output):
    package = json.loads(manifest.read_text())
    checked = []
    for container in package['records']:
        movie = manifest.with_suffix('')/container['name']
        if digest(movie)!=container['sha256'] or movie.stat().st_size!=container['size']:
            raise ValueError('Packaged container changed')
        segments = container['segments']
        for index in sorted({0,len(segments)//2,len(segments)-1}):
            segment = segments[index]
            source = (site/segment['metadata']).with_suffix('.mp4')
            if digest(source)!=segment['clip_sha256']:raise ValueError('Source episode changed')
            expected = first_frame(source)
            actual = first_frame(movie,segment['start'])
            if expected!=actual:raise ValueError('Indexed segment does not start on the source episode')
            checked.append(dict(container=container['name'],metadata=segment['metadata'],
                start=segment['start'],decoded_frame_sha256=actual))
    receipt = dict(verifiedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        manifestSha256=digest(manifest),containers=len(package['records']),
        episodes=sum(len(record['segments']) for record in package['records']),
        scope='Exact decoded first frame at first, middle and last episode boundaries of each lossless container.',
        boundaries=checked)
    with output.open('x') as stream:json.dump(receipt,stream,indent=2)
    print(json.dumps({key:value for key,value in receipt.items() if key!='boundaries'}),flush=True)


if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--manifest',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    verify(args.site,args.manifest,args.output)

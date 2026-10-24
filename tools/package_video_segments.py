"""Losslessly bundle episode MP4s into seekable checkpoint videos with exact indexes."""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import subprocess
from package_release_recordings import public_json, REPOSITORY


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):result.update(block)
    return result.hexdigest()


def probe(path):
    result = subprocess.run(['ffprobe','-v','error','-select_streams','v:0',
        '-show_entries','stream=width,height,avg_frame_rate,nb_frames,duration,time_base','-of','json',str(path)],
        capture_output=True,text=True,check=True,timeout=30)
    return json.loads(result.stdout)['streams'][0]


def segment_offsets(movie, segments):
    stream = probe(movie)
    result = subprocess.run(['ffprobe','-v','error','-select_streams','v:0',
        '-show_entries','packet=pts','-of','json',str(movie)],capture_output=True,text=True,check=True,timeout=60)
    timestamps = sorted(int(packet['pts']) for packet in json.loads(result.stdout)['packets'])
    if len(timestamps)!=sum(segment['frames'] for segment in segments):
        raise ValueError('Bundled packet count differs from episode frame counts')
    scale = Fraction(stream['time_base'])
    def floor_microseconds(value):
        return float((value*1000000).__floor__()/1000000)
    indexed, cursor = [], 0
    for segment in segments:
        end = cursor+segment['frames']
        start_time = floor_microseconds(timestamps[cursor]*scale)
        end_time = floor_microseconds(timestamps[end]*scale if end<len(timestamps)
            else timestamps[-1]*scale+1/Fraction(segment['fps']))
        indexed.append({**segment,'start':start_time,'duration':end_time-start_time,'first_frame':cursor})
        cursor = end
    return indexed


def build(site, output, indexes, tag):
    output.mkdir(parents=True,exist_ok=False)
    private = output.with_name(output.name+'-private')
    private.mkdir(parents=True,exist_ok=False)
    records = []
    for index_path in indexes:
        index = json.loads(index_path.read_text())
        parts, part, size = [], [], 0
        for key, relative in sorted(index['replays'].items()):
            metadata = site/relative
            record = json.loads(metadata.read_text())
            movie = metadata.with_suffix('.mp4')
            if (record['study']!=index['cell'] or record['model']!=index['model']
                    or record['axis']+'|'+format(record['value'],'g')!=key):
                raise ValueError('Segment identity differs from its exact selection')
            stream = probe(movie)
            frames = int(stream['nb_frames'])
            if frames!=len(record['timeline']):raise ValueError('Encoded frame count differs from recorded timeline')
            info = dict(metadata=relative,clip_sha256=digest(movie),frames=frames,
                identity={key:record[key] for key in ['study','model','axis','value','checkpointSha256','trainingSeed','episodeSeed']},
                fps=stream['avg_frame_rate'],width=stream['width'],height=stream['height'])
            if part and size+movie.stat().st_size>1500000000:
                parts.append(part);part=[];size=0
            part.append((movie,info));size+=movie.stat().st_size
        if part:parts.append(part)
        for number, part in enumerate(parts,1):
            identity = {(info['fps'],info['width'],info['height']) for _,info in part}
            if len(identity)!=1:raise ValueError('Cannot copy-concatenate incompatible encoded videos')
            name = index['cell']+'__'+index['model']+'__part'+str(number).zfill(2)+'.mp4'
            movie = output/name
            listing = private/(name+'.concat')
            # MP4 format durations round to milliseconds; explicit frame durations prevent cumulative seek drift.
            listing.write_text(''.join("file '"+str(path.resolve()).replace("'","'\\''")+"'\nduration "+
                format(float(Fraction(info['frames'])/Fraction(info['fps'])),'.9f')+'\n' for path,info in part))
            subprocess.run(['ffmpeg','-nostdin','-n','-v','error','-f','concat','-safe','0',
                '-i',str(listing),'-map','0:v:0','-c','copy','-movflags','+faststart',str(movie)],check=True)
            offset = Fraction(0)
            segments = []
            for _,info in part:
                fps = Fraction(info['fps']);duration = Fraction(info['frames'])/fps
                segments.append({**info,'start':float(offset),'duration':float(duration)})
                offset += duration
            result = probe(movie)
            if int(result['nb_frames'])!=sum(info['frames'] for _,info in part):
                raise ValueError('Bundled video lost or gained frames')
            if abs(float(result['duration'])-float(offset))>.02:
                raise ValueError('Bundled video timestamps differ from the episode index')
            if movie.stat().st_size>=2*1024**3:raise ValueError('Video exceeds GitHub asset limit')
            segments = segment_offsets(movie,segments)
            records.append(dict(name=name,size=movie.stat().st_size,sha256=digest(movie),segments=segments))
            print(json.dumps(dict(video=name,episodes=len(segments),bytes=movie.stat().st_size)),flush=True)
    manifest = output.with_suffix('.json')
    with manifest.open('x') as stream:
        json.dump(dict(repository=REPOSITORY,tag=tag,records=records),stream,indent=2)


def apply(site, manifest):
    package = json.loads(manifest.read_text())
    if package['repository']!=REPOSITORY:raise ValueError('Unexpected public repository')
    release = public_json(f"https://api.github.com/repos/{REPOSITORY}/releases/tags/{package['tag']}")
    if release['draft']:raise ValueError('Video release is not public')
    assets = {asset['name']:asset for asset in release['assets']}
    updates = []
    for item in package['records']:
        asset = assets.get(item['name'])
        if (not asset or asset['state']!='uploaded' or asset['size']!=item['size']
                or asset.get('digest')!='sha256:'+item['sha256'] or asset['content_type']!='video/mp4'):
            raise ValueError('Public bundled recording hash differs or upload is absent')
        url = f"https://github.com/{REPOSITORY}/releases/download/{package['tag']}/{item['name']}"
        if asset['browser_download_url']!=url:raise ValueError('Unexpected public recording URL')
        for segment in item['segments']:
            path = site/segment['metadata']
            if digest(path.with_suffix('.mp4'))!=segment['clip_sha256']:
                raise ValueError('Original episode changed after packaging')
            record = json.loads(path.read_text())
            if any(record.get(key)!=value for key,value in segment['identity'].items()):
                raise ValueError('Episode metadata identity changed after packaging')
            record.update(video=url,videoSha256=segment['clip_sha256'],videoContainerSha256=item['sha256'],
                hostedRelease=package['tag'],releaseAssetId=asset['id'],
                videoSegment=dict(start=segment['start'],duration=segment['duration'],fps=float(Fraction(segment['fps']))))
            updates.append((path,record))
    for path,record in updates:
        path.write_text(json.dumps(record,separators=(',',':'),allow_nan=False))
    print(json.dumps(dict(verified_containers=len(package['records']),linked_episodes=len(updates))),flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--index',type=Path,action='append',default=[])
    parser.add_argument('--tag')
    parser.add_argument('--apply',type=Path)
    args = parser.parse_args()
    if args.apply:apply(args.site,args.apply)
    elif args.output and args.tag and args.index:build(args.site,args.output,args.index,args.tag)
    else:parser.error('Choose --apply or --output/--tag/--index')


if __name__=='__main__':main()

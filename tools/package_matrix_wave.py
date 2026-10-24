"""Package only complete policy indexes; expose a video-only upload directory."""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
from package_video_segments import build, digest, REPOSITORY


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--plan-dir',type=Path)
    parser.add_argument('--indexes-dir',type=Path,action='append',default=[])
    parser.add_argument('--include-manifest',type=Path,action='append',default=[])
    parser.add_argument('--exclude-manifest',type=Path,action='append',default=[])
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--tag',required=True)
    args = parser.parse_args()
    indexes = []
    if args.plan_dir:
        for job in json.loads((args.plan_dir/'plan.json').read_text()):
            name = job['cell']+'__'+job['model']
            result = args.plan_dir/(name+'.result.json')
            if result.is_file() and json.loads(result.read_text())['returncode']==0:
                indexes.append(args.plan_dir/(name+'.json'))
    for directory in args.indexes_dir:
        indexes.extend(directory.glob('*.json'))
    excluded = set()
    included = []
    for manifest in args.exclude_manifest+args.include_manifest:
        package = json.loads(manifest.read_text())
        if package['repository']!=REPOSITORY:raise ValueError('Unexpected upload repository')
        for item in package['records']:
            identity = item['segments'][0]['identity']
            excluded.add((identity['study'],identity['model']))
            if manifest in args.include_manifest:
                movie = manifest.with_suffix('')/item['name']
                if digest(movie)!=item['sha256']:raise ValueError('Included container changed')
                included.append((movie,item))
    selected = {}
    for path in indexes:
        index = json.loads(path.read_text())
        key = index['cell'],index['model']
        if key in excluded:continue
        study = json.loads((args.site/'data'/(key[0]+'.json')).read_text())
        expected = {a['id']+'|'+format(p['x'],'g') for a in study['axes'] for p in a['curves'][key[1]]}
        if set(index['replays'])!=expected:raise ValueError('Only complete recording indexes may be packaged')
        selected[key] = path
    args.output.mkdir(parents=True,exist_ok=False)
    private = args.output.with_name(args.output.name+'-private')
    private.mkdir(parents=True,exist_ok=False)
    def package_one(pair):
        key,index = pair
        output = private/('__'.join(key))
        build(args.site,output,[index],args.tag)
        package = json.loads(output.with_suffix('.json').read_text())
        return [(output/item['name'],item) for item in package['records']]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for batch in pool.map(package_one,sorted(selected.items())):
            included.extend(batch)
    records = []
    for movie,item in included:
        with movie.open('rb') as stream:header = stream.read(8)
        if movie.suffix!='.mp4' or header[4:8]!=b'ftyp':
            raise ValueError('Upload directory accepts only verified MP4 containers')
        os.link(movie,args.output/item['name'])
        records.append(item)
    with args.output.with_suffix('.json').open('x') as stream:
        json.dump(dict(repository=REPOSITORY,tag=args.tag,records=records),stream,indent=2)
    print(json.dumps(dict(upload_videos=len(records),episodes=sum(len(x['segments']) for x in records),
        bytes=sum(x['size'] for x in records))),flush=True)


if __name__=='__main__':main()

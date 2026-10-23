"""Package new MP4s for UI upload; link only after public SHA-256 verification."""
import argparse
import hashlib
import json
import shutil
import subprocess
import urllib.request
from pathlib import Path

REPOSITORY = 'arjunmahesh1/practical-drmdp'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def public_json(url):
    request = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'checkpoint-recording-verification'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def prepare(site, output, tag, limit, metadata, excluded_manifests=()):
    output.mkdir(parents=True, exist_ok=False)
    tracked = set(subprocess.check_output(['git', 'ls-files', '--', 'assets/replays'], cwd=site, text=True).splitlines())
    paths = [site / path for path in metadata] if metadata else sorted((site / 'assets/replays').rglob('*.json'))
    records = []
    assigned = {record['metadata'] for manifest in excluded_manifests
        for record in json.loads(manifest.read_text())['records']}
    for path in paths:
        if str(path.relative_to(site)) in assigned:
            continue
        record = json.loads(path.read_text())
        if record.get('kind') != 'video' or record['video'].startswith('https:'):
            continue
        movie = site / record['video']
        if not movie.resolve().is_relative_to((site / 'assets/replays').resolve()) or movie.suffix != '.mp4':
            raise ValueError('Only generated replay MP4s may be packaged')
        with movie.open('rb') as stream:
            if stream.read(8)[4:8] != b'ftyp':
                raise ValueError('Not an MP4 recording')
        if record['video'] in tracked:
            continue
        name = '__'.join(movie.relative_to(site / 'assets/replays').parts)
        if movie.stat().st_size >= 2 * 1024**3:
            raise ValueError('Release asset exceeds the per-file limit')
        if (output / name).exists():
            raise ValueError('Ambiguous release asset name: ' + name)
        shutil.copyfile(movie, output / name)
        records.append(dict(metadata=str(path.relative_to(site)), name=name, sha256=digest(movie), size=movie.stat().st_size))
        if len(records) == limit:
            break
    result = dict(tag=tag, repository=REPOSITORY, records=records)
    manifest = output.with_suffix('.json')
    with manifest.open('x') as stream:
        json.dump(result, stream, indent=2)
    print(json.dumps(dict(manifest=str(manifest), assets=len(records), bytes=sum(r['size'] for r in records))))


def apply(site, manifest):
    package = json.loads(manifest.read_text())
    if package['repository'] != REPOSITORY:
        raise ValueError('Unexpected video-host repository')
    release = public_json(f"https://api.github.com/repos/{REPOSITORY}/releases/tags/{package['tag']}")
    if release['draft']:
        raise ValueError('Release is not public')
    assets = {asset['name']: asset for asset in release.get('assets', [])}
    if 'assets' not in release:
        for page in range(1, 12):
            batch = public_json(release['assets_url'] + f'?per_page=100&page={page}')
            assets.update({asset['name']: asset for asset in batch})
            if len(batch) < 100:
                break
    verified = []
    for item in package['records']:
        asset = assets.get(item['name'])
        path = site / item['metadata']
        movie = path.with_suffix('.mp4')
        if (digest(movie) != item['sha256'] or not asset or asset['state'] != 'uploaded'
                or asset['size'] != item['size'] or asset.get('digest') != 'sha256:' + item['sha256']
                or asset['content_type'] != 'video/mp4'):
            raise ValueError('Upload missing or different from local verified recording: ' + item['name'])
        expected = f"https://github.com/{REPOSITORY}/releases/download/{package['tag']}/{item['name']}"
        if asset['browser_download_url'] != expected:
            raise ValueError('Unexpected public asset URL')
        record = json.loads(path.read_text())
        record.update(video=expected, videoSha256=item['sha256'], hostedRelease=package['tag'], releaseAssetId=asset['id'])
        verified.append((path, record))
    # Validate the entire batch before publishing any of its links.
    for path, record in verified:
        path.write_text(json.dumps(record, separators=(',', ':'), allow_nan=False))
    print(json.dumps(dict(verified=len(verified), release=release['html_url'])))


def missing_uploads(site, manifest, output):
    package = json.loads(manifest.read_text())
    if package['repository'] != REPOSITORY:
        raise ValueError('Unexpected video-host repository')
    release = public_json(f"https://api.github.com/repos/{REPOSITORY}/releases/tags/{package['tag']}")
    assets = {asset['name']: asset for asset in release['assets']}
    missing = []
    for item in package['records']:
        asset = assets.get(item['name'])
        if asset:
            if (asset['state'] != 'uploaded' or asset['size'] != item['size']
                    or asset.get('digest') != 'sha256:' + item['sha256']):
                raise ValueError('Existing upload is incomplete or different: ' + item['name'])
        else:
            movie = (site / item['metadata']).with_suffix('.mp4')
            if digest(movie) != item['sha256']:
                raise ValueError('Local recording changed: ' + item['name'])
            missing.append((movie, item))
    output.mkdir(parents=True, exist_ok=False)
    for movie, item in missing:
        shutil.copyfile(movie, output / item['name'])
    result = dict(repository=REPOSITORY, tag=package['tag'], records=[item for _, item in missing])
    with output.with_suffix('.json').open('x') as stream:
        json.dump(result, stream, indent=2)
    print(json.dumps(dict(existing=len(assets), missing=len(missing), directory=str(output))))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--site', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--tag')
    parser.add_argument('--limit', type=int, default=900)
    parser.add_argument('--metadata', action='append', default=[])
    parser.add_argument('--exclude-manifest', type=Path, action='append', default=[])
    parser.add_argument('--apply', type=Path)
    parser.add_argument('--missing-output', type=Path)
    args = parser.parse_args()
    if args.apply and args.missing_output:
        missing_uploads(args.site, args.apply, args.missing_output)
    elif args.apply:
        apply(args.site, args.apply)
    elif args.output and args.tag and 0 < args.limit <= 1000:
        prepare(args.site, args.output, args.tag, args.limit, args.metadata, args.exclude_manifest)
    else:
        parser.error('Choose --apply MANIFEST, or --output DIRECTORY --tag TAG with at most 1000 assets')


if __name__ == '__main__':
    main()

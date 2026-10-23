import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import package_release_recordings as release


class ReleaseRecordingsTest(unittest.TestCase):
    def test_repair_packages_only_absent_matching_local_files(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            records = []
            for name in ['one', 'two']:
                movie = site / (name + '.mp4')
                movie.write_bytes(b'\x00\x00\x00\x18ftyp' + name.encode())
                records.append(dict(metadata=name + '.json', name=movie.name,
                    size=movie.stat().st_size, sha256=release.digest(movie)))
            manifest = site / 'package.json'
            manifest.write_text(json.dumps(dict(repository=release.REPOSITORY, tag='test', records=records)))
            existing = dict(records[0], state='uploaded', digest='sha256:' + records[0]['sha256'])
            with patch.object(release, 'public_json', return_value=dict(assets=[existing])):
                release.missing_uploads(site, manifest, site / 'missing')
            self.assertEqual([path.name for path in (site / 'missing').iterdir()], ['two.mp4'])
            existing['digest'] = 'sha256:wrong'
            with patch.object(release, 'public_json', return_value=dict(assets=[existing])):
                with self.assertRaisesRegex(ValueError, 'Existing upload'):
                    release.missing_uploads(site, manifest, site / 'bad')
            self.assertFalse((site / 'bad').exists())

    def test_no_links_change_until_every_upload_matches(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            records, assets = [], []
            for name in ['one', 'two']:
                movie = site / (name + '.mp4')
                movie.write_bytes(b'\x00\x00\x00\x18ftyp' + name.encode())
                path = movie.with_suffix('.json')
                path.write_text(json.dumps(dict(video=movie.name)))
                digest = hashlib.sha256(movie.read_bytes()).hexdigest()
                records.append(dict(metadata=path.name, name=movie.name, size=movie.stat().st_size, sha256=digest))
                assets.append(dict(id=len(assets) + 1, name=movie.name, state='uploaded',
                    size=movie.stat().st_size, digest='sha256:' + digest, content_type='video/mp4',
                    browser_download_url=f'https://github.com/{release.REPOSITORY}/releases/download/test/{movie.name}'))
            manifest = site / 'package.json'
            manifest.write_text(json.dumps(dict(repository=release.REPOSITORY, tag='test', records=records)))
            info = dict(draft=False, assets_url='https://api.github.com/fixture/assets', html_url='https://github.com/fixture')
            with patch.object(release, 'public_json', side_effect=[info, assets[:1]]):
                with self.assertRaisesRegex(ValueError, 'Upload missing'):
                    release.apply(site, manifest)
            self.assertEqual(json.loads((site / 'one.json').read_text()), dict(video='one.mp4'))
            with patch.object(release, 'public_json', side_effect=[info, assets]):
                release.apply(site, manifest)
            self.assertEqual(json.loads((site / 'two.json').read_text())['releaseAssetId'], 2)


if __name__ == '__main__':
    unittest.main()

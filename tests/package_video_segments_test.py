import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import package_video_segments as package


class VideoSegmentsTest(unittest.TestCase):
    def test_offsets_use_actual_presentation_timestamps_not_rounded_file_durations(self):
        packets = dict(packets=[dict(pts=value) for value in [0,2001,1000,3001]])
        with patch.object(package,'probe',return_value=dict(time_base='1/10000')):
            with patch.object(package.subprocess,'run',return_value=SimpleNamespace(stdout=json.dumps(packets))):
                offsets = package.segment_offsets(Path('fixture.mp4'),[dict(frames=2,fps='10/1')]*2)
        self.assertEqual(offsets[1]['first_frame'],2)
        self.assertEqual(offsets[1]['start'],.2001)
        self.assertAlmostEqual(offsets[1]['duration'],.2)

    def test_linking_checks_every_hash_and_identity_before_any_write(self):
        with tempfile.TemporaryDirectory() as temporary:
            site = Path(temporary)
            clip = site/'episode.mp4';clip.write_bytes(b'video')
            record = dict(study='fixture',video='episode.mp4')
            (site/'episode.json').write_text(json.dumps(record))
            manifest = dict(repository=package.REPOSITORY,tag='fixture',records=[dict(name='bundle.mp4',size=5,
                sha256='container',segments=[dict(metadata='episode.json',clip_sha256=hashlib.sha256(b'video').hexdigest(),
                    identity=dict(study='wrong'),start=12,duration=1,fps='10/1')])])
            path = site/'package.json';path.write_text(json.dumps(manifest))
            asset = dict(id=1,name='bundle.mp4',state='uploaded',size=5,digest='sha256:container',
                content_type='video/mp4',browser_download_url=f'https://github.com/{package.REPOSITORY}/releases/download/fixture/bundle.mp4')
            with patch.object(package,'public_json',return_value=dict(draft=False,assets=[asset])):
                with self.assertRaisesRegex(ValueError,'identity changed'):package.apply(site,path)
            self.assertEqual(json.loads((site/'episode.json').read_text()),record)
            manifest['records'][0]['segments'][0]['identity']['study']='fixture'
            path.write_text(json.dumps(manifest))
            with patch.object(package,'public_json',return_value=dict(draft=False,assets=[asset])):package.apply(site,path)
            linked = json.loads((site/'episode.json').read_text())
            self.assertEqual(linked['videoSegment'],dict(start=12,duration=1,fps=10))
            self.assertEqual(linked['videoContainerSha256'],'container')


if __name__=='__main__':unittest.main()

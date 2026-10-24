import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import verify_video_segments as verification
from package_video_segments import digest


class SegmentVerificationTest(unittest.TestCase):
    def test_wrong_boundary_never_gets_a_success_receipt(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary);movies = root/'wave';movies.mkdir()
            source = root/'episode.mp4';source.write_bytes(b'episode')
            movie = movies/'bundle.mp4';movie.write_bytes(b'container')
            manifest = root/'wave.json'
            manifest.write_text(json.dumps(dict(records=[dict(name=movie.name,
                sha256=digest(movie),size=movie.stat().st_size,segments=[dict(
                    metadata='episode.json',clip_sha256=digest(source),start=12)])])))
            output = root/'qa.json'
            with patch.object(verification,'first_frame',side_effect=['source','wrong']):
                with self.assertRaisesRegex(ValueError,'source episode'):
                    verification.verify(root,manifest,output)
            self.assertFalse(output.exists())
            with patch.object(verification,'first_frame',return_value='same'):
                verification.verify(root,manifest,output)
            self.assertEqual(json.loads(output.read_text())['episodes'],1)


if __name__=='__main__':unittest.main()

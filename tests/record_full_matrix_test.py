import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from record_full_matrix import merge


class MatrixMergeTest(unittest.TestCase):
    def test_exact_grid_and_identity_required_before_any_study_write(self):
        with tempfile.TemporaryDirectory() as temporary:
            site = Path(temporary)
            (site / 'data').mkdir()
            (site / 'indexes').mkdir()
            study = dict(axes=[dict(id='friction', curves={'cap': [dict(x=1, mean=7)]})],
                replays={}, original_evaluation='unchanged')
            path = site / 'data' / 'example.json'
            path.write_text(json.dumps(study))
            index = site / 'indexes' / 'example__cap.json'
            index.write_text(json.dumps(dict(cell='example', model='cap', replays={})))
            plan = [dict(cell='example', model='cap', expected=1, checkpoint_sha256='exact')]
            with self.assertRaisesRegex(ValueError, 'Incomplete'):
                merge(site, site / 'indexes', plan)
            self.assertEqual(json.loads(path.read_text()), study)
            record = dict(study='example', model='cap', axis='friction', value=1, checkpointSha256='wrong')
            (site / 'clip.json').write_text(json.dumps(record))
            (site / 'clip.mp4').write_bytes(b'fixture')
            index.write_text(json.dumps(dict(cell='example', model='cap', replays={'friction|1':'clip.json'})))
            with self.assertRaisesRegex(ValueError, 'identity mismatch'):
                merge(site, site / 'indexes', plan)
            self.assertEqual(json.loads(path.read_text()), study)
            record['checkpointSha256'] = 'exact'
            (site / 'clip.json').write_text(json.dumps(record))
            self.assertEqual(merge(site, site / 'indexes', plan), 1)
            result = json.loads(path.read_text())
            self.assertEqual(result['axes'], study['axes'])
            self.assertEqual(result['original_evaluation'], 'unchanged')
            self.assertEqual(result['replays']['cap'], {'friction|1':'clip.json'})


if __name__ == '__main__':
    unittest.main()

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from recording_sources import condition, policy_candidates


class RecordingSourcesTest(unittest.TestCase):
    def test_scenario_tokens(self):
        self.assertEqual(condition({'scenario_label': 'joint_damping_m0p5'}), ('joint_damping', -.5))
        self.assertEqual(condition({'scenario_label': 'mass_1p0', 'axis': 'mass', 'factor': '2'}), ('mass', 2))
        self.assertEqual(condition({'scenario_label': 'mass_1p0', 'axis': 'nan', 'factor': 'nan'}), ('mass', 1))

    def test_seed_is_chosen_by_complete_coverage_not_return(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            study = dict(id='fixture', source='metrics.csv', environment='Walker2d-v4', models=['vanilla'],
                axes=[dict(id='mass', curves={'vanilla': [dict(x=1), dict(x=2)]})])
            fields = ['env_id', 'model_label', 'seed', 'algo', 'model_path', 'norm_stats_path',
                'timestamp', 'scenario_label', 'mean_return']
            rows = []
            for seed, values in [(0, [1]), (1, [1, 2]), (2, [1, 2])]:
                for value in values:
                    rows.append(dict(env_id='Walker2d-v4', model_label='vanilla', seed=seed,
                        algo='ppo_cont', model_path=f'actor_{seed}', norm_stats_path=f'norm_{seed}',
                        timestamp=100, scenario_label=f'mass_{value}', mean_return=seed * 100))
            rows.append(dict(rows[-1], env_id='HalfCheetah-v4', model_path='wrong_environment'))
            with (root / 'metrics.csv').open('w') as stream:
                writer = csv.DictWriter(stream, fieldnames=fields)
                writer.writeheader(); writer.writerows(rows)
            seed, row = policy_candidates(root, study)['vanilla']
            self.assertEqual(seed, 1)
            self.assertEqual(row['model_path'], 'actor_1')
            study['axes'][0]['curves']['vanilla'].append(dict(x=3))
            with self.assertRaisesRegex(ValueError, 'No single archived policy'):
                policy_candidates(root, study)


if __name__ == '__main__':
    unittest.main()

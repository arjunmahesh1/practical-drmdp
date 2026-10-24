import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import record_mujoco


class RecordingXMLIsolationTest(unittest.TestCase):
    def test_each_worker_has_its_own_xml_path(self):
        row = dict(env_id='Walker2d-v4',seed='0')
        with patch('cleanrl_utils.mujoco_xml_utils.make_mujoco_env') as make:
            with patch('cleanrl_utils.perturbation_config.apply_env_perturbations'):
                for pid in [123,456]:
                    with patch.object(os,'getpid',return_value=pid):
                        record_mujoco.legacy_env(row,Path('.'),Path('/tmp/recording-fixture'))
        paths = [call.kwargs['xml_out_dir'] for call in make.call_args_list]
        self.assertEqual(paths,['/tmp/recording-fixture/workers/123','/tmp/recording-fixture/workers/456'])


if __name__=='__main__':unittest.main()

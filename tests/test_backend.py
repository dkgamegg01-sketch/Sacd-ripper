import sys
import unittest
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from app.config import ConfigManager
from app.engine import build_command_args
from app.inspector import parse_disc_output
from app.network import check_player_connection


class TestSACDBackend(unittest.TestCase):
    def test_build_command_args(self):
        cmd = build_command_args(
            program_path="sacd_extract.exe",
            source_input="test.iso",
            output_mode="dsf",
            stereo=True,
            multichannel=True,
            dst_decompress=True,
            dsf_nopad=False,
            export_cue=True,
            selected_tracks="1,3,5",
            output_dir1="C:/output",
            output_dir2=""
        )
        self.assertIn("-2", cmd)
        self.assertIn("-m", cmd)
        self.assertIn("-s", cmd)
        self.assertIn("-c", cmd)
        self.assertIn("-C", cmd)
        self.assertIn("-t", cmd)
        self.assertIn("1,3,5", cmd)
        self.assertIn("-itest.iso", cmd)
        self.assertIn("-oC:/output", cmd)

    def test_print_summary_and_none_mode(self):
        cmd = build_command_args(
            program_path="sacd_extract.exe",
            source_input="test.iso",
            output_mode="none",
            print_summary=True
        )
        self.assertIn("-P", cmd)
        self.assertNotIn("-s", cmd)
        self.assertNotIn("-p", cmd)
        self.assertNotIn("-2", cmd)

    def test_concurrent_mode_args(self):
        cmd = build_command_args(
            program_path="sacd_extract.exe",
            source_input="192.168.1.50:2002",
            output_mode="iso_dsf",
            stereo=True,
            multichannel=False,
            dst_decompress=False,
            dsf_nopad=True,
            selected_tracks="",
            output_dir1="C:/iso_out",
            output_dir2="C:/dsf_out"
        )
        self.assertIn("-w", cmd)
        self.assertIn("-s", cmd)
        self.assertIn("-I", cmd)
        self.assertIn("-z", cmd)
        self.assertIn("-i192.168.1.50:2002", cmd)
        self.assertIn("-oC:/iso_out", cmd)
        self.assertIn("-yC:/dsf_out", cmd)

    def test_parse_disc_output(self):
        sample = """
TITLE "Dark Side of the Moon"
PERFORMER "Pink Floyd"
REM GENRE Progressive Rock
REM DATE 1973
Stereo (2ch)
TRACK 01 AUDIO
  TITLE "Speak to Me"
  INDEX 01 00:00:00
TRACK 02 AUDIO
  TITLE "Breathe"
  INDEX 01 01:30:00
TRACK 03 AUDIO
  TITLE "On the Run"
  INDEX 01 04:13:00
"""
        res = parse_disc_output(sample)
        self.assertEqual(res["title"], "Dark Side of the Moon")
        self.assertEqual(res["artist"], "Pink Floyd")
        self.assertEqual(res["genre"], "Progressive Rock")
        self.assertEqual(res["year"], "1973")
        self.assertEqual(len(res["tracks"]), 3)
        self.assertEqual(res["tracks"][0]["title"], "Speak to Me")
        self.assertEqual(res["tracks"][0]["duration"], "01:30")
        self.assertEqual(res["tracks"][1]["title"], "Breathe")
        self.assertEqual(res["tracks"][1]["duration"], "02:43")

    def test_empty_host(self):
        res = check_player_connection("")
        self.assertFalse(res["success"])
        self.assertIn("empty", res["message"])


if __name__ == "__main__":
    unittest.main()

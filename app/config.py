import os
import json
from pathlib import Path

DEFAULT_CONFIG = {
    "program_path": "sacd_extract.exe",
    "input_mode": "file",  # "file" | "batch" | "server"
    "file_path": "",
    "batch_files": [],
    "server_ip": "192.168.1.100",
    "server_port": 2002,
    "server_history": ["192.168.1.100"],
    "output_mode": "dsf",  # "dsf" | "dsdiff" | "dsdiff_em" | "iso" | "iso_dsf" | "iso_dsdiff"
    "stereo": True,
    "multichannel": False,
    "dst_decompress": True,
    "dsf_nopad": False,
    "export_cue": True,
    "print_summary": False,
    "select_tracks_enabled": False,
    "selected_tracks": "",
    "output_dir1": "",
    "output_dir2": "",
    "theme": "dark"
}

CONFIG_FILE = Path(__file__).resolve().parent.parent / "config.json"


class ConfigManager:
    def __init__(self, config_file: Path = CONFIG_FILE):
        self.config_file = config_file
        self.config = dict(DEFAULT_CONFIG)
        self.load()

    def load(self) -> dict:
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    self.config.update(saved)
            except Exception as e:
                print(f"[WARN] Failed to load config, using defaults: {e}")
        return self.config

    def save(self, new_data: dict = None) -> bool:
        if new_data:
            self.config.update(new_data)
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"[ERROR] Failed to save config: {e}")
            return False

    def get(self, key: str, default=None):
        return self.config.get(key, default)

    def set(self, key: str, value):
        self.config[key] = value
        self.save()

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Optional
import webview

from app.config import ConfigManager
from app.network import check_player_connection
from app.inspector import inspect_source
from app.engine import ExtractionEngine, build_command_args


class AppApi:
    def __init__(self, config_manager: ConfigManager):
        # All internal instances MUST be prefixed with an underscore
        # to prevent pywebview's dir() reflection from recursively inspecting
        # the native Window/AccessibilityObject (which causes infinite recursion).
        self._config_manager = config_manager
        self._engine = ExtractionEngine()
        self._window: Optional[webview.Window] = None

    def _set_window(self, window: webview.Window):
        self._window = window

    def _emit_event(self, event_name: str, data: dict):
        """
        Send a real-time event directly into the Webview JavaScript context.
        """
        if self._window:
            js_code = f"window.dispatchEvent(new CustomEvent('{event_name}', {{ detail: {json.dumps(data, ensure_ascii=False)} }}));"
            try:
                self._window.evaluate_js(js_code)
            except Exception as e:
                print(f"[WARN] Failed to dispatch event {event_name}: {e}")

    def get_config(self) -> dict:
        return self._config_manager.load()

    def save_config(self, new_config: dict) -> dict:
        ok = self._config_manager.save(new_config)
        return {"success": ok}

    def check_executable(self, path: Optional[str] = None) -> dict:
        prog = path or self._config_manager.get("program_path", "sacd_extract.exe")
        p = Path(prog)
        if not p.is_absolute():
            p = Path(__file__).resolve().parent.parent / prog

        if not p.exists():
            return {
                "success": False,
                "version": "Not Found",
                "path": str(p),
                "error": f"Executable not found at {p}"
            }

        try:
            is_win = sys.platform.startswith("win")
            res = subprocess.run(
                [str(p), "-v"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW if is_win else 0
            )
            v_text = res.stdout.strip() or res.stderr.strip()
            return {
                "success": res.returncode == 0,
                "version": v_text,
                "path": str(p),
                "error": None
            }
        except Exception as e:
            return {
                "success": False,
                "version": "Error",
                "path": str(p),
                "error": str(e)
            }

    def select_file(self) -> Optional[str]:
        """
        Open a native file selection dialog for a single SACD ISO.
        """
        if not self._window:
            return None
        file_types = ("SACD ISO Files (*.iso)", "All Files (*.*)")
        res = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=file_types
        )
        if res and len(res) > 0:
            chosen = res[0]
            self._config_manager.set("file_path", chosen)
            return chosen
        return None

    def select_files(self) -> list[str]:
        """
        Open a native file selection dialog for multiple SACD ISOs.
        """
        if not self._window:
            return []
        file_types = ("SACD ISO Files (*.iso)", "All Files (*.*)")
        res = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=True,
            file_types=file_types
        )
        return list(res) if res else []

    def select_folder(self, target_key: str = "output_dir1") -> Optional[str]:
        """
        Open a native directory chooser dialog.
        """
        if not self._window:
            return None
        res = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if res and len(res) > 0:
            chosen = res[0]
            self._config_manager.set(target_key, chosen)
            return chosen
        return None

    def open_folder(self, folder_path: str) -> dict:
        """
        Open folder in Windows Explorer or system file manager.
        """
        if not folder_path or not os.path.exists(folder_path):
            return {"success": False, "error": "Folder does not exist"}

        try:
            if sys.platform.startswith("win"):
                os.startfile(folder_path)
            elif sys.platform.startswith("darwin"):
                subprocess.Popen(["open", folder_path])
            else:
                subprocess.Popen(["xdg-open", folder_path])
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def test_connection(self, host: str, port: int = 2002) -> dict:
        """
        Test network Blu-ray player connectivity.
        """
        res = check_player_connection(host, port)
        if res.get("success"):
            # Update server history
            history = self._config_manager.get("server_history", [])
            if host not in history:
                history.append(host)
                self._config_manager.set("server_history", history)
            self._config_manager.set("server_ip", host)
            self._config_manager.set("server_port", port)
        return res

    def inspect_disc(self, source_input: str) -> dict:
        """
        Inspect disc metadata using sacd_extract -P.
        """
        prog = self._config_manager.get("program_path", "sacd_extract.exe")
        return inspect_source(prog, source_input)

    def start_rip(self, params: dict) -> dict:
        """
        Start the extraction process with given parameters.
        """
        if self._engine.is_running:
            return {"success": False, "error": "Extraction already running"}

        prog = params.get("program_path") or self._config_manager.get("program_path", "sacd_extract.exe")
        source = params.get("source_input")
        if not source:
            return {"success": False, "error": "Source input is required"}

        cmd_args = build_command_args(
            program_path=prog,
            source_input=source,
            output_mode=params.get("output_mode", "dsf"),
            stereo=params.get("stereo", True),
            multichannel=params.get("multichannel", False),
            dst_decompress=params.get("dst_decompress", False),
            dsf_nopad=params.get("dsf_nopad", False),
            export_cue=params.get("export_cue", False),
            print_summary=params.get("print_summary", False),
            selected_tracks=params.get("selected_tracks", ""),
            output_dir1=params.get("output_dir1", ""),
            output_dir2=params.get("output_dir2", "")
        )

        def log_cb(line: str):
            self._emit_event("rip-log", {"line": line})

        def progress_cb(prog_data: dict):
            self._emit_event("rip-progress", prog_data)

        def finished_cb(code: int, err: str):
            self._emit_event("rip-finished", {"returncode": code, "error": err})

        ok, err = self._engine.start(
            cmd_args=cmd_args,
            on_log=log_cb,
            on_progress=progress_cb,
            on_finished=finished_cb
        )

        return {"success": ok, "error": err, "command": " ".join(cmd_args)}

    def stop_rip(self) -> dict:
        """
        Stop the currently running extraction.
        """
        if not self._engine.is_running:
            return {"success": False, "error": "No extraction currently running"}

        self._engine.stop()
        return {"success": True}

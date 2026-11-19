import os
import re
import sys
import time
import subprocess
import threading
from pathlib import Path
from typing import Callable, Optional


def build_command_args(
    program_path: str,
    source_input: str,
    output_mode: str = "dsf",  # "dsf", "dsdiff", "dsdiff_em", "iso", "iso_dsf", "iso_dsdiff"
    stereo: bool = True,
    multichannel: bool = False,
    dst_decompress: bool = False,
    dsf_nopad: bool = False,
    export_cue: bool = False,
    print_summary: bool = False,
    selected_tracks: str = "",
    output_dir1: str = "",
    output_dir2: str = ""
) -> list[str]:
    """
    Construct the command-line argument list for sacd_extract.
    """
    prog = Path(program_path)
    if not prog.is_absolute() and not prog.exists():
        prog = Path(__file__).resolve().parent.parent / program_path

    cmd = [str(prog)]

    # Channels (only if extracting audio)
    if output_mode != "none":
        if stereo:
            cmd.append("-2")
        if multichannel:
            cmd.append("-m")

    # Format mode
    if output_mode == "dsf":
        cmd.append("-s")
    elif output_mode == "dsdiff":
        cmd.append("-p")
    elif output_mode == "dsdiff_em":
        cmd.append("-e")
    elif output_mode == "iso":
        cmd.append("-I")
    elif output_mode == "iso_dsf":
        cmd.extend(["-w", "-s", "-I"])
    elif output_mode == "iso_dsdiff":
        cmd.extend(["-w", "-p", "-I"])
    elif output_mode == "none":
        # None mode: only inspect / print
        pass

    # Print disc summary (-P)
    if print_summary or output_mode == "none":
        cmd.append("-P")

    # Processing options
    if dst_decompress and output_mode != "none":
        cmd.append("-c")

    # Track selection
    selected_clean = selected_tracks.strip() if selected_tracks else ""
    if selected_clean:
        cmd.extend(["-t", selected_clean])
    elif dsf_nopad and output_mode in ["dsf", "iso_dsf"]:
        # -z cannot be used with -t according to sacd_extract manual
        cmd.append("-z")

    if export_cue and output_mode != "none":
        cmd.append("-C")

    # Input source
    cmd.append(f"-i{source_input}")

    # Output directory 1 (Primary / ISO dir)
    if output_dir1 and output_dir1.strip():
        cmd.append(f"-o{output_dir1.strip()}")

    # Output directory 2 (DSF/DSDIFF dir in concurrent mode)
    if output_dir2 and output_dir2.strip() and output_mode in ["iso_dsf", "iso_dsdiff"]:
        cmd.append(f"-y{output_dir2.strip()}")

    return cmd


class ExtractionEngine:
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.is_running = False
        self._stop_requested = False
        self.thread: Optional[threading.Thread] = None

        # Callbacks
        self.on_log: Optional[Callable[[str], None]] = None
        self.on_progress: Optional[Callable[[dict], None]] = None
        self.on_finished: Optional[Callable[[int, str], None]] = None

        # Metrics
        self.current_track = 0
        self.total_tracks = 0
        self.percent = 0
        self.start_time = 0.0

    def start(
        self,
        cmd_args: list[str],
        on_log: Optional[Callable[[str], None]] = None,
        on_progress: Optional[Callable[[dict], None]] = None,
        on_finished: Optional[Callable[[int, str], None]] = None
    ) -> tuple[bool, str]:
        """
        Start sacd_extract in a background thread and stream outputs.
        """
        if self.is_running:
            return False, "Extraction is already in progress."

        self.on_log = on_log
        self.on_progress = on_progress
        self.on_finished = on_finished
        self._stop_requested = False
        self.is_running = True
        self.current_track = 0
        self.percent = 0
        self.start_time = time.time()

        def worker():
            is_win = sys.platform.startswith("win")
            creationflags = subprocess.CREATE_NO_WINDOW if is_win else 0

            try:
                if self.on_log:
                    self.on_log(f"[INFO] Launching: {' '.join(cmd_args)}")

                self.process = subprocess.Popen(
                    cmd_args,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                    creationflags=creationflags
                )

                while True:
                    if self._stop_requested:
                        break

                    line = self.process.stdout.readline()
                    if not line:
                        if self.process.poll() is not None:
                            break
                        time.sleep(0.02)
                        continue

                    clean_line = line.rstrip("\r\n")
                    if not clean_line:
                        continue

                    # Log callback
                    if self.on_log:
                        self.on_log(clean_line)

                    # Parse progress & track hints
                    self._parse_line(clean_line)

                self.process.wait()
                rc = self.process.returncode

                if self._stop_requested:
                    rc = -1
                    if self.on_log:
                        self.on_log("[WARN] Extraction was cancelled by user.")

                if self.on_finished:
                    err_msg = "" if rc == 0 else f"Process exited with code {rc}"
                    self.on_finished(rc, err_msg)

            except Exception as e:
                if self.on_log:
                    self.on_log(f"[ERROR] Subprocess exception: {e}")
                if self.on_finished:
                    self.on_finished(-1, str(e))
            finally:
                self.is_running = False
                self.process = None

        self.thread = threading.Thread(target=worker, daemon=True)
        self.thread.start()
        return True, ""

    def stop(self):
        """
        Cleanly terminate the running sacd_extract process.
        """
        if not self.is_running or not self.process:
            return

        self._stop_requested = True
        pid = self.process.pid

        try:
            if sys.platform.startswith("win"):
                # Force kill process tree on Windows to ensure no lingering child handles
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=subprocess.CREATE_NO_WINDOW
                )
            else:
                self.process.kill()
        except Exception:
            pass

        self.is_running = False

    def _parse_line(self, line: str):
        """
        Parse stdout line for progress percentages, track numbers, and status.
        """
        # Example patterns in sacd_extract:
        # [ 12%] or [100%]
        # Queuing: ..., track 3
        # track 3 / 10
        m_pct = re.search(r'\[\s*([0-9]{1,3})\s*%\]', line)
        if m_pct:
            try:
                self.percent = int(m_pct.group(1))
            except ValueError:
                pass

        m_trk = re.search(r'track\s+([0-9]+)', line, re.IGNORECASE)
        if m_trk:
            try:
                self.current_track = int(m_trk.group(1))
            except ValueError:
                pass

        elapsed = max(0.1, time.time() - self.start_time)

        if self.on_progress:
            self.on_progress({
                "percent": self.percent,
                "current_track": self.current_track,
                "elapsed_seconds": round(elapsed, 1),
                "raw_line": line
            })

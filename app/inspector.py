import re
import subprocess
import platform
from pathlib import Path


def parse_disc_output(output_text: str) -> dict:
    """
    Parse the stdout/stderr of `sacd_extract -P` into a structured dictionary.
    Handles cue-style tags (TITLE, PERFORMER, TRACK, INDEX) as well as
    key-value headers.
    """
    data = {
        "title": "Unknown Album",
        "artist": "Unknown Artist",
        "genre": "",
        "year": "",
        "channels": [],
        "tracks": [],
        "raw_text": output_text
    }

    lines = output_text.splitlines()
    current_track = None
    track_indexes = []  # [(track_num, minutes, seconds, frames)]

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Look for general album metadata
        if not current_track:
            m_album_title = re.match(r'^(?:TITLE|Album(?:\s+Title)?[:=])\s*["\']?([^"\']+)["\']?', stripped, re.IGNORECASE)
            if m_album_title:
                data["title"] = m_album_title.group(1).strip()
                continue

            m_artist = re.match(r'^(?:PERFORMER|Artist[:=])\s*["\']?([^"\']+)["\']?', stripped, re.IGNORECASE)
            if m_artist:
                data["artist"] = m_artist.group(1).strip()
                continue

            m_genre = re.match(r'^(?:REM GENRE|Genre[:=])\s*["\']?([^"\']+)["\']?', stripped, re.IGNORECASE)
            if m_genre:
                data["genre"] = m_genre.group(1).strip()
                continue

            m_date = re.match(r'^(?:REM DATE|Year[:=]|Date[:=])\s*["\']?([0-9]{4}(?:-[0-9]{2}-[0-9]{2})?)["\']?', stripped, re.IGNORECASE)
            if m_date:
                data["year"] = m_date.group(1).strip()
                continue

        # Detect channel / format hints
        if "2ch" in stripped.lower() or "stereo" in stripped.lower():
            if "Stereo (2.0)" not in data["channels"]:
                data["channels"].append("Stereo (2.0)")
        if "5ch" in stripped.lower() or "5.1ch" in stripped.lower() or "multi-channel" in stripped.lower() or "mch" in stripped.lower():
            if "Multi-channel (5.1)" not in data["channels"]:
                data["channels"].append("Multi-channel (5.1)")

        # Track markers
        m_track = re.match(r'^TRACK\s+([0-9]+)\s+AUDIO', stripped, re.IGNORECASE)
        if not m_track:
            m_track = re.match(r'^Track\s+([0-9]+)[:\s]', stripped, re.IGNORECASE)

        if m_track:
            track_num = int(m_track.group(1))
            current_track = {
                "number": track_num,
                "title": f"Track {track_num:02d}",
                "artist": data["artist"],
                "duration": "--:--",
                "start_seconds": 0.0,
                "selected": True
            }
            data["tracks"].append(current_track)
            continue

        if current_track:
            m_t_title = re.match(r'^TITLE\s*["\']?([^"\']+)["\']?', stripped, re.IGNORECASE)
            if m_t_title:
                current_track["title"] = m_t_title.group(1).strip()
                continue

            m_t_perf = re.match(r'^PERFORMER\s*["\']?([^"\']+)["\']?', stripped, re.IGNORECASE)
            if m_t_perf:
                current_track["artist"] = m_t_perf.group(1).strip()
                continue

            m_index = re.match(r'^INDEX\s+01\s+([0-9]{2}):([0-9]{2}):([0-9]{2})', stripped, re.IGNORECASE)
            if m_index:
                mm, ss, ff = int(m_index.group(1)), int(m_index.group(2)), int(m_index.group(3))
                total_sec = mm * 60 + ss + (ff / 75.0)
                current_track["start_seconds"] = total_sec
                track_indexes.append((len(data["tracks"]) - 1, total_sec))
                continue

    # Calculate track durations from successive INDEX 01 points if available
    for i in range(len(track_indexes) - 1):
        idx_curr, sec_curr = track_indexes[i]
        _, sec_next = track_indexes[i + 1]
        dur_sec = max(0, sec_next - sec_curr)
        mins = int(dur_sec // 60)
        secs = int(dur_sec % 60)
        data["tracks"][idx_curr]["duration"] = f"{mins:02d}:{secs:02d}"

    # Default channel if none detected
    if not data["channels"]:
        data["channels"] = ["Stereo (2.0)"]

    return data


def inspect_source(program_path: str, source_input: str) -> dict:
    """
    Run `sacd_extract -P -i <source_input>` and return parsed disc metadata.
    """
    prog = Path(program_path)
    if not prog.is_absolute() and not prog.exists():
        # Look in workspace root
        prog = Path(__file__).resolve().parent.parent / program_path

    if not prog.exists():
        return {
            "success": False,
            "error": f"Executable not found: {prog}",
            "data": None
        }

    cmd = [str(prog), "-P", f"-i{source_input}"]
    is_win = platform.system().lower() == "windows"

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15.0,
            creationflags=subprocess.CREATE_NO_WINDOW if is_win else 0
        )
        combined_output = proc.stdout + "\n" + proc.stderr
        
        # Check for error outputs
        if "Can't open" in combined_output or "Could not open" in combined_output or "Can't stat" in combined_output:
            return {
                "success": False,
                "error": combined_output.strip(),
                "data": None
            }

        parsed = parse_disc_output(combined_output)
        return {
            "success": True,
            "error": None,
            "data": parsed
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Timed out reading disc information from source.",
            "data": None
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": None
        }

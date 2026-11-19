# SACD Extract Studio (Modern UI/UX)

A modern, ultra-lightweight, high-performance desktop interface for `sacd_extract`.

This project completely supersedes the legacy Java GUI (`SACDExtractGUI.jar`), delivering a zero-bloat, hardware-accelerated, dark audiophile aesthetic powered by Windows native Microsoft Edge WebView2 and an asynchronous Python 3 engine.

---

## Key Features & Highlights

- **Zero Bloat & Lightweight**:
  - No 200MB+ Electron bundle.
  - No archaic Java JRE installation required.
  - Utilizes Windows 10/11 built-in Edge WebView2 runtime.
  - Memory consumption is only ~40–60 MB with instant (< 0.5s) startup.

- **3 Flexible Input Modes**:
  1. **Single SACD ISO**: Direct drag-and-drop zone with instant disc inspection.
  2. **Batch ISO Queue**: Queue multiple `.iso` files with per-file status badges (`Pending`, `Ripping`, `Done`, `Error`).
  3. **Network Blu-ray Player**: Clean single IP:port input with 1-click ICMP Ping & TCP Socket latency testing.

- **Interactive Disc Inspector**:
  - Automatically reads and parses Album Title, Artist, Year, Genre, and Tracklist (`-P`).
  - Visual track checklist: select/deselect individual tracks to extract, or click "Select All" / "Invert" — eliminating manual comma-separated number entry.

- **Audiophile Format Studio**:
  - **Sony DSF (`.dsf`)**: Standard audiophile format with ID3v2 tag support.
  - **Philips DSDIFF (`.dff`)**: Pure uncompressed DSD streams.
  - **Edit Master (`.dff`)**: Single master file with cue sheet.
  - **RAW ISO (`.iso`)**: Direct 1:1 bitstream backup from Blu-ray player.
  - **Concurrent (ISO + DSF / DSDIFF)**: Simultaneous ISO dumping and track rip.
  - **None (Info Only)**: Direct `-P` disc and track summary scan without extracting audio.
  - Flexible channel mapping (Stereo 2.0 `-2`, Multi-channel 5.1 `-m`, or both).
  - Print disc summary flag (`-P`), DST decompression (`-c`), padding-less DSF (`-z`), and CUE sheet export (`-C`).
  - **Direct Manual & Interactive Track Selection (`-t`)**: Select via interactive track table or directly type track numbers (e.g. `1,4,5` or `1-8`) with automatic two-way synchronization.

- **Real-Time Execution Terminal**:
  - Direct non-blocking asynchronous stdout/stderr streaming from `sacd_extract.exe`.
  - Syntax-highlighted logs (`[INFO]`, `[WARN]`, `[ERROR]`, `track`).
  - Auto-scroll, copy to clipboard, clear, and collapsible panel.

- **Auto Configuration Persistence**:
  - Automatically preserves your last used paths, player IP, selected formats, and preferences across sessions in `config.json`.

---

## Quick Start

### 1. Launch via Windows Explorer
Double click:
```
SACD-Extract.bat
```

### 2. Launch via Command Line
```powershell
python run_gui.py
```

---

## Project Structure

```
sacd-ripper/
├── sacd_extract.exe          # Native 64-bit high-speed extraction engine
├── run_gui.py                # Main application entry point
├── SACD-Extract.bat          # 1-click Windows batch launcher
├── config.json               # Auto-saved user settings
├── app/
│   ├── config.py             # Configuration manager
│   ├── network.py            # Blu-ray player ping & socket connectivity tester
│   ├── inspector.py          # Disc info (-P) metadata parser & tracklist builder
│   ├── engine.py             # Process manager & async stdout/stderr streaming
│   └── api.py                # PyWebView JS API bridge
├── web/
│   ├── index.html            # Modern single-page app shell
│   ├── css/
│   │   ├── theme.css         # Dark audiophile palette & glassmorphism
│   │   ├── components.css    # Cards, buttons, dropzones, track tables
│   │   └── terminal.css      # Real-time console styling
│   └── js/
│       ├── bridge.js         # PyWebView API bridge
│       ├── terminal.js       # Live terminal manager
│       ├── inspector.js      # Disc inspector & track selection
│       ├── queue.js          # Batch queue manager
│       └── app.js            # Main application controller
└── legacy/
    └── SACDExtractGUI.jar    # Retired legacy Java GUI
```

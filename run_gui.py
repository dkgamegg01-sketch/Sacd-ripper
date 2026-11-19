#!/usr/bin/env python3
"""
SACD Extract Studio - Modern High-Performance Desktop UI
"""

import sys
from pathlib import Path
import webview

# Ensure project root in sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.config import ConfigManager
from app.api import AppApi


def main():
    config_mgr = ConfigManager()
    api = AppApi(config_mgr)

    index_html = ROOT_DIR / "web" / "index.html"
    if not index_html.exists():
        print(f"[ERROR] UI asset not found: {index_html}")
        sys.exit(1)

    window = webview.create_window(
        title="SACD Extract Studio",
        url=str(index_html),
        js_api=api,
        width=980,
        height=820,
        min_size=(840, 640),
        text_select=True
    )
    api._set_window(window)

    # Start PyWebView with Windows EdgeChromium
    webview.start(debug=False, gui="edgechromium")


if __name__ == "__main__":
    main()

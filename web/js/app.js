// Main Application Controller

document.addEventListener("DOMContentLoaded", async () => {
  const terminal = new TerminalManager("terminal-body");
  const inspector = new InspectorManager("disc-inspector-card", "track-table-body");
  const queue = new BatchQueueManager("batch-items-container");

  let currentMode = "file"; // "file" | "batch" | "server"
  let currentFormat = "dsf"; // "dsf" | "dsdiff" | "dsdiff_em" | "iso" | "iso_dsf" | "iso_dsdiff"
  let isRipping = false;
  let batchIndex = 0;

  // Cache DOM Elements
  const elEngineStatus = document.getElementById("engine-status-text");
  const elEngineDot = document.getElementById("engine-status-dot");
  const elSinglePath = document.getElementById("single-file-path");
  const elSingleName = document.getElementById("single-file-name");
  const elSingleBar = document.getElementById("single-file-bar");
  const elServerIp = document.getElementById("server-ip");
  const elServerPort = document.getElementById("server-port");
  const elServerStatus = document.getElementById("server-status-badge");
  const elOutputDir1 = document.getElementById("output-dir-1");
  const elOutputDir2 = document.getElementById("output-dir-2");
  const elConcurrentRow = document.getElementById("concurrent-dir-row");

  const chkStereo = document.getElementById("chk-stereo");
  const chkMulti = document.getElementById("chk-multi");
  const chkPrint = document.getElementById("chk-print");
  const chkDst = document.getElementById("chk-dst");
  const chkNoPad = document.getElementById("chk-nopad");
  const chkCue = document.getElementById("chk-cue");
  const chkSelectTracks = document.getElementById("chk-select-tracks");
  const txtSelectedTracks = document.getElementById("txt-selected-tracks");

  const btnStart = document.getElementById("btn-start-rip");
  const btnStop = document.getElementById("btn-stop-rip");
  const btnInspect = document.getElementById("btn-inspect-disc");

  const progressFill = document.getElementById("progress-bar-fill");
  const progressPercent = document.getElementById("progress-percent-text");
  const progressTrack = document.getElementById("progress-track-text");
  const progressElapsed = document.getElementById("progress-elapsed-text");

  // Initial Startup Logs
  terminal.append("[INFO] ==================================================");
  terminal.append("[INFO] SACD Extract Studio v1.0 initialized");
  terminal.append("[INFO] Ready. Select SACD ISO or enter Blu-ray player IP");
  terminal.append("[INFO] ==================================================");

  // 1. Check Engine Executable
  try {
    const engRes = await Bridge.call("check_executable");
    if (engRes.success) {
      elEngineStatus.textContent = "Engine Ready";
      elEngineDot.className = "status-dot online";
      terminal.append(`[INFO] Engine verified: ${engRes.version}`);
    } else {
      elEngineStatus.textContent = "Engine Missing";
      elEngineDot.className = "status-dot offline";
      terminal.append(`[ERROR] ${engRes.error}`);
    }
  } catch (err) {
    elEngineStatus.textContent = "Engine Error";
    elEngineDot.className = "status-dot offline";
  }

  // 2. Load Configuration
  try {
    const cfg = await Bridge.call("get_config");
    if (cfg) {
      currentMode = cfg.input_mode || "file";
      setModeTab(currentMode);

      if (cfg.file_path) {
        setSingleFile(cfg.file_path);
      }
      if (cfg.server_ip) elServerIp.value = cfg.server_ip;
      if (cfg.server_port) elServerPort.value = cfg.server_port;
      if (cfg.output_dir1) elOutputDir1.value = cfg.output_dir1;
      if (cfg.output_dir2) elOutputDir2.value = cfg.output_dir2;

      setFormat(cfg.output_mode || "dsf");

      chkStereo.checked = cfg.stereo !== false;
      chkMulti.checked = !!cfg.multichannel;
      chkPrint.checked = !!cfg.print_summary;
      chkDst.checked = !!cfg.dst_decompress;
      chkNoPad.checked = !!cfg.dsf_nopad;
      chkCue.checked = cfg.export_cue !== false;
      chkSelectTracks.checked = !!cfg.select_tracks_enabled;
      txtSelectedTracks.value = cfg.selected_tracks || "";
      txtSelectedTracks.disabled = !chkSelectTracks.checked;
    }
  } catch (err) {
    console.warn("Failed to load initial config", err);
  }

  // 3. Tab Switching
  document.querySelectorAll(".segment-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      setModeTab(mode);
      saveConfig();
    });
  });

  function setModeTab(mode) {
    currentMode = mode;
    document.querySelectorAll(".segment-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });

    document.getElementById("panel-single-file").style.display = mode === "file" ? "block" : "none";
    document.getElementById("panel-batch-queue").style.display = mode === "batch" ? "block" : "none";
    document.getElementById("panel-network-player").style.display = mode === "server" ? "block" : "none";
  }

  // 4. Format Card Selector
  document.querySelectorAll(".format-card").forEach(card => {
    card.addEventListener("click", () => {
      setFormat(card.dataset.format);
      saveConfig();
    });
  });

  function setFormat(fmt) {
    currentFormat = fmt;
    document.querySelectorAll(".format-card").forEach(c => {
      c.classList.toggle("active", c.dataset.format === fmt);
    });

    const isConcurrent = fmt === "iso_dsf" || fmt === "iso_dsdiff";
    elConcurrentRow.style.display = isConcurrent ? "flex" : "none";

    if (fmt === "none") {
      chkPrint.checked = true;
    }
  }

  // Track manual input & checkbox listeners
  chkSelectTracks.addEventListener("change", () => {
    txtSelectedTracks.disabled = !chkSelectTracks.checked;
    if (chkSelectTracks.checked) {
      txtSelectedTracks.focus();
    }
    saveConfig();
  });

  txtSelectedTracks.addEventListener("input", () => {
    inspector.setFromTrackString(txtSelectedTracks.value.trim());
    saveConfig();
  });

  // 5. Single File Selection & Drop
  const singleDropzone = document.getElementById("single-file-dropzone");
  singleDropzone.addEventListener("click", async () => {
    const chosen = await Bridge.call("select_file");
    if (chosen) {
      setSingleFile(chosen);
      saveConfig();
    }
  });

  function setSingleFile(filePath) {
    elSinglePath.value = filePath;
    const parts = filePath.replace(/\\/g, "/").split("/");
    elSingleName.textContent = parts[parts.length - 1];
    elSingleBar.style.display = "flex";
    btnInspect.disabled = false;
  }

  // 6. Batch Queue Selection & Drop
  document.getElementById("btn-batch-add").addEventListener("click", async () => {
    const files = await Bridge.call("select_files");
    if (files && files.length > 0) {
      queue.addFiles(files);
      saveConfig();
    }
  });

  document.getElementById("btn-batch-clear").addEventListener("click", () => {
    queue.clear();
  });

  // Drag & drop handlers
  ["dragenter", "dragover"].forEach(evtName => {
    singleDropzone.addEventListener(evtName, (e) => {
      e.preventDefault();
      singleDropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(evtName => {
    singleDropzone.addEventListener(evtName, (e) => {
      e.preventDefault();
      singleDropzone.classList.remove("dragover");
    });
  });

  // 7. Network Player Connection Test
  document.getElementById("btn-test-connection").addEventListener("click", async () => {
    const host = elServerIp.value.trim();
    const port = parseInt(elServerPort.value.trim(), 10) || 2002;
    if (!host) {
      alert("Please enter a valid IP address.");
      return;
    }

    elServerStatus.style.display = "inline-flex";
    elServerStatus.innerHTML = '<span class="status-dot"></span> Testing...';
    terminal.append(`[INFO] Probing Blu-ray player at ${host}:${port}...`);

    try {
      const res = await Bridge.call("test_connection", host, port);
      if (res.success) {
        elServerStatus.innerHTML = `<span class="status-dot online"></span> ${res.latency_ms} ms Online`;
        terminal.append(`[INFO] ${res.message}`);
      } else {
        elServerStatus.innerHTML = `<span class="status-dot offline"></span> Offline`;
        terminal.append(`[WARN] ${res.message}`);
      }
    } catch (err) {
      elServerStatus.innerHTML = `<span class="status-dot offline"></span> Error`;
      terminal.append(`[ERROR] Connection check failed: ${err}`);
    }
    saveConfig();
  });

  // 8. Disc Inspection
  btnInspect.addEventListener("click", async () => {
    let source = "";
    if (currentMode === "file") {
      source = elSinglePath.value.trim();
    } else if (currentMode === "server") {
      source = `${elServerIp.value.trim()}:${elServerPort.value.trim() || 2002}`;
    }

    if (!source) {
      alert("Please select a valid SACD ISO file or configure server IP first.");
      return;
    }

    btnInspect.disabled = true;
    btnInspect.textContent = "Scanning...";
    terminal.append(`[INFO] Inspecting disc metadata: ${source}`);

    try {
      const res = await Bridge.call("inspect_disc", source);
      if (res.success && res.data) {
        inspector.show(res.data);
        terminal.append(`[INFO] Disc identified: "${res.data.title}" by ${res.data.artist} (${res.data.tracks.length} tracks)`);
      } else {
        alert("Failed to read disc info:\n" + (res.error || "Unknown error"));
        terminal.append(`[ERROR] Disc inspection failed: ${res.error}`);
      }
    } catch (err) {
      terminal.append(`[ERROR] Inspection exception: ${err}`);
    } finally {
      btnInspect.disabled = false;
      btnInspect.textContent = "Inspect Disc";
    }
  });

  // Track selection helpers
  document.getElementById("btn-tracks-all").addEventListener("click", () => inspector.selectAll(true));
  document.getElementById("btn-tracks-none").addEventListener("click", () => inspector.selectAll(false));
  document.getElementById("btn-tracks-invert").addEventListener("click", () => inspector.invertSelection());

  // 9. Output Directory Selectors
  document.getElementById("btn-browse-dir1").addEventListener("click", async () => {
    const chosen = await Bridge.call("select_folder", "output_dir1");
    if (chosen) {
      elOutputDir1.value = chosen;
      saveConfig();
    }
  });

  document.getElementById("btn-open-dir1").addEventListener("click", () => {
    Bridge.call("open_folder", elOutputDir1.value.trim());
  });

  document.getElementById("btn-browse-dir2").addEventListener("click", async () => {
    const chosen = await Bridge.call("select_folder", "output_dir2");
    if (chosen) {
      elOutputDir2.value = chosen;
      saveConfig();
    }
  });

  document.getElementById("btn-open-dir2").addEventListener("click", () => {
    Bridge.call("open_folder", elOutputDir2.value.trim());
  });

  // 10. Start Ripping
  btnStart.addEventListener("click", async () => {
    if (isRipping) return;

    if (currentMode === "batch") {
      if (queue.files.length === 0) {
        alert("Batch queue is empty. Add ISO files first.");
        return;
      }
      batchIndex = 0;
      runBatchNext();
    } else {
      let source = "";
      if (currentMode === "file") {
        source = elSinglePath.value.trim();
      } else {
        source = `${elServerIp.value.trim()}:${elServerPort.value.trim() || 2002}`;
      }

      if (!source) {
        alert("Please specify a valid source input.");
        return;
      }

      runSingle(source);
    }
  });

  async function runSingle(source) {
    const selectedTracksParam = inspector.getSelectedTrackParam();

    const params = {
      source_input: source,
      output_mode: currentFormat,
      stereo: chkStereo.checked,
      multichannel: chkMulti.checked,
      print_summary: chkPrint.checked || currentFormat === "none",
      dst_decompress: chkDst.checked,
      dsf_nopad: chkNoPad.checked,
      export_cue: chkCue.checked,
      selected_tracks: selectedTracksParam,
      output_dir1: elOutputDir1.value.trim(),
      output_dir2: elOutputDir2.value.trim()
    };

    setRippingState(true);
    progressPercent.textContent = "0%";
    progressFill.style.width = "0%";
    progressTrack.textContent = "Initializing...";

    terminal.append(`[INFO] Starting rip: ${source} (Mode: ${currentFormat})`);
    if (selectedTracksParam) {
      terminal.append(`[INFO] Selected tracks: ${selectedTracksParam}`);
    }

    try {
      const res = await Bridge.call("start_rip", params);
      if (!res.success) {
        alert("Failed to start rip: " + res.error);
        setRippingState(false);
      }
    } catch (err) {
      terminal.append(`[ERROR] Start rip exception: ${err}`);
      setRippingState(false);
    }
  }

  async function runBatchNext() {
    if (batchIndex >= queue.files.length) {
      setRippingState(false);
      terminal.append("[INFO] All batch tasks completed successfully!");
      return;
    }

    const currentItem = queue.files[batchIndex];
    queue.setStatus(batchIndex, "running");
    progressTrack.textContent = `Batch [${batchIndex + 1}/${queue.files.length}]: ${currentItem.name}`;

    const params = {
      source_input: currentItem.path,
      output_mode: currentFormat,
      stereo: chkStereo.checked,
      multichannel: chkMulti.checked,
      print_summary: chkPrint.checked || currentFormat === "none",
      dst_decompress: chkDst.checked,
      dsf_nopad: chkNoPad.checked,
      export_cue: chkCue.checked,
      selected_tracks: "",
      output_dir1: elOutputDir1.value.trim(),
      output_dir2: elOutputDir2.value.trim()
    };

    setRippingState(true);
    const res = await Bridge.call("start_rip", params);
    if (!res.success) {
      queue.setStatus(batchIndex, "error");
      batchIndex++;
      runBatchNext();
    }
  }

  // 11. Stop Ripping
  btnStop.addEventListener("click", async () => {
    if (!isRipping) return;
    btnStop.disabled = true;
    terminal.append("[WARN] Stopping extraction process...");
    await Bridge.call("stop_rip");
  });

  function setRippingState(ripping) {
    isRipping = ripping;
    btnStart.disabled = ripping;
    btnStop.disabled = !ripping;
    if (!ripping) {
      btnStop.disabled = true;
    }
  }

  // 12. Real-time Event Listeners
  window.addEventListener("rip-log", (e) => {
    const line = e.detail.line;
    terminal.append(line);
  });

  window.addEventListener("rip-progress", (e) => {
    const d = e.detail;
    if (d.percent !== undefined && d.percent >= 0) {
      progressFill.style.width = `${d.percent}%`;
      progressPercent.textContent = `${d.percent}%`;
    }
    if (d.current_track) {
      progressTrack.textContent = `Extracting Track ${d.current_track}`;
    }
    if (d.elapsed_seconds) {
      progressElapsed.textContent = `Elapsed: ${d.elapsed_seconds}s`;
    }
  });

  window.addEventListener("rip-finished", (e) => {
    const d = e.detail;
    terminal.append(`[INFO] Process finished with exit code ${d.returncode}`);
    
    if (currentMode === "batch" && isRipping) {
      queue.setStatus(batchIndex, d.returncode === 0 ? "done" : "error");
      batchIndex++;
      runBatchNext();
    } else {
      setRippingState(false);
      progressPercent.textContent = d.returncode === 0 ? "100%" : "Error";
      if (d.returncode === 0) {
        progressFill.style.width = "100%";
        progressTrack.textContent = "Extraction Completed!";
      } else {
        progressTrack.textContent = "Extraction Failed / Stopped";
      }
    }
  });

  // 13. Terminal Actions
  document.getElementById("btn-terminal-clear").addEventListener("click", () => terminal.clear());
  document.getElementById("btn-terminal-copy").addEventListener("click", () => terminal.copyAll());
  document.getElementById("btn-terminal-scroll").addEventListener("click", function() {
    terminal.toggleAutoScroll(this);
  });
  document.getElementById("btn-terminal-collapse").addEventListener("click", () => terminal.toggleCollapse());

  // 14. Auto-save Config Helper
  function saveConfig() {
    const configData = {
      input_mode: currentMode,
      file_path: elSinglePath.value.trim(),
      server_ip: elServerIp.value.trim(),
      server_port: parseInt(elServerPort.value.trim(), 10) || 2002,
      output_mode: currentFormat,
      stereo: chkStereo.checked,
      multichannel: chkMulti.checked,
      print_summary: chkPrint.checked,
      dst_decompress: chkDst.checked,
      dsf_nopad: chkNoPad.checked,
      export_cue: chkCue.checked,
      select_tracks_enabled: chkSelectTracks.checked,
      selected_tracks: txtSelectedTracks.value.trim(),
      output_dir1: elOutputDir1.value.trim(),
      output_dir2: elOutputDir2.value.trim()
    };
    Bridge.call("save_config", configData);
  }

  // Save on input changes
  [chkStereo, chkMulti, chkPrint, chkDst, chkNoPad, chkCue, chkSelectTracks, elServerIp, elServerPort, elOutputDir1, elOutputDir2].forEach(el => {
    el.addEventListener("change", saveConfig);
  });
});

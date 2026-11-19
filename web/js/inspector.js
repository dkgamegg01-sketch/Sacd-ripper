// Disc Inspector & Track Selection Manager

class InspectorManager {
  constructor(sectionId, tableBodyId) {
    this.sectionEl = document.getElementById(sectionId);
    this.tableBodyEl = document.getElementById(tableBodyId);
    this.tracks = [];
    this.discData = null;
  }

  show(data) {
    if (!data) return;
    this.discData = data;
    this.tracks = (data.tracks || []).map(t => ({ ...t, selected: true }));

    // Set metadata fields
    document.getElementById("meta-title").textContent = data.title || "Unknown Album";
    document.getElementById("meta-artist").textContent = data.artist || "Unknown Artist";
    document.getElementById("meta-genre").textContent = data.genre || "N/A";
    document.getElementById("meta-year").textContent = data.year || "N/A";
    document.getElementById("meta-channels").textContent = (data.channels || []).join(", ") || "Stereo";

    this.renderTracks();
    if (this.sectionEl) {
      this.sectionEl.style.display = "block";
    }
  }

  hide() {
    if (this.sectionEl) {
      this.sectionEl.style.display = "none";
    }
    this.tracks = [];
    this.discData = null;
  }

  renderTracks() {
    if (!this.tableBodyEl) return;
    this.tableBodyEl.innerHTML = "";

    this.tracks.forEach((track, idx) => {
      const tr = document.createElement("tr");

      // Checkbox
      const tdCheck = document.createElement("td");
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = !!track.selected;
      chk.addEventListener("change", (e) => {
        this.tracks[idx].selected = e.target.checked;
        this.updateSelectionSummary();
      });
      tdCheck.appendChild(chk);

      // Track #
      const tdNum = document.createElement("td");
      tdNum.textContent = String(track.number).padStart(2, "0");

      // Title
      const tdTitle = document.createElement("td");
      tdTitle.textContent = track.title || `Track ${track.number}`;

      // Duration
      const tdDur = document.createElement("td");
      tdDur.textContent = track.duration || "--:--";

      tr.appendChild(tdCheck);
      tr.appendChild(tdNum);
      tr.appendChild(tdTitle);
      tr.appendChild(tdDur);

      this.tableBodyEl.appendChild(tr);
    });

    this.updateSelectionSummary();
  }

  selectAll(selected = true) {
    this.tracks.forEach(t => t.selected = selected);
    this.renderTracks();
  }

  invertSelection() {
    this.tracks.forEach(t => t.selected = !t.selected);
    this.renderTracks();
  }

  updateSelectionSummary() {
    const total = this.tracks.length;
    const selectedCount = this.tracks.filter(t => t.selected).length;
    const summaryEl = document.getElementById("track-selection-summary");
    if (summaryEl) {
      summaryEl.textContent = `${selectedCount} of ${total} tracks selected`;
    }

    const txtTracks = document.getElementById("txt-selected-tracks");
    const chkTracks = document.getElementById("chk-select-tracks");
    if (txtTracks && chkTracks) {
      if (selectedCount < total && selectedCount > 0) {
        chkTracks.checked = true;
        txtTracks.disabled = false;
        txtTracks.value = this.tracks.filter(t => t.selected).map(t => t.number).join(",");
      } else if (selectedCount === total) {
        chkTracks.checked = false;
        txtTracks.disabled = true;
        txtTracks.value = "";
      }
    }
  }

  setFromTrackString(str) {
    if (!this.tracks || this.tracks.length === 0) return;
    if (!str || !str.trim()) {
      this.selectAll(true);
      return;
    }
    const nums = new Set();
    str.split(",").forEach(part => {
      const p = part.trim();
      if (p.includes("-")) {
        const [start, end] = p.split("-").map(x => parseInt(x.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let n = start; n <= end; n++) nums.add(n);
        }
      } else {
        const n = parseInt(p, 10);
        if (!isNaN(n)) nums.add(n);
      }
    });
    this.tracks.forEach(t => {
      t.selected = nums.has(t.number);
    });
    this.renderTracks();
  }

  getSelectedTrackParam() {
    const chkTracks = document.getElementById("chk-select-tracks");
    const txtTracks = document.getElementById("txt-selected-tracks");
    if (chkTracks && chkTracks.checked && txtTracks && txtTracks.value.trim()) {
      return txtTracks.value.trim();
    }
    if (this.tracks.length === 0) return "";
    const selected = this.tracks.filter(t => t.selected);
    if (selected.length === this.tracks.length) {
      // All tracks selected, no need for -t parameter
      return "";
    }
    return selected.map(t => t.number).join(",");
  }
}

window.InspectorManager = InspectorManager;

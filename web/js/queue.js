// Batch Queue Manager

class BatchQueueManager {
  constructor(listElId) {
    this.listEl = document.getElementById(listElId);
    this.files = []; // [{ path: string, name: string, status: 'pending'|'running'|'done'|'error' }]
  }

  addFiles(filePaths) {
    if (!filePaths || filePaths.length === 0) return;

    filePaths.forEach(fp => {
      if (!this.files.some(f => f.path === fp)) {
        const parts = fp.replace(/\\/g, "/").split("/");
        const name = parts[parts.length - 1];
        this.files.push({
          path: fp,
          name: name,
          status: "pending"
        });
      }
    });

    this.render();
  }

  removeFile(index) {
    if (index >= 0 && index < this.files.length) {
      this.files.splice(index, 1);
      this.render();
    }
  }

  clear() {
    this.files = [];
    this.render();
  }

  setStatus(index, status) {
    if (index >= 0 && index < this.files.length) {
      this.files[index].status = status;
      this.render();
    }
  }

  render() {
    if (!this.listEl) return;
    this.listEl.innerHTML = "";

    if (this.files.length === 0) {
      this.listEl.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">Queue is empty. Drag and drop .iso files or click Add.</div>';
      return;
    }

    this.files.forEach((f, idx) => {
      const item = document.createElement("div");
      item.className = "batch-item";

      const left = document.createElement("div");
      left.className = "batch-item-path";
      left.title = f.path;
      left.textContent = `${idx + 1}. ${f.name}`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      const badge = document.createElement("span");
      badge.className = `batch-item-status ${f.status}`;
      badge.textContent = f.status.toUpperCase();

      const btnDel = document.createElement("button");
      btnDel.className = "terminal-btn";
      btnDel.textContent = "✕";
      btnDel.title = "Remove from queue";
      btnDel.addEventListener("click", () => this.removeFile(idx));

      right.appendChild(badge);
      right.appendChild(btnDel);

      item.appendChild(left);
      item.appendChild(right);
      this.listEl.appendChild(item);
    });
  }
}

window.BatchQueueManager = BatchQueueManager;

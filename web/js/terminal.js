// Terminal Console Manager

class TerminalManager {
  constructor(bodyId) {
    this.bodyEl = document.getElementById(bodyId);
    this.autoScroll = true;
    this.maxLines = 1500;
    this.lines = [];
  }

  append(text) {
    if (!this.bodyEl) return;

    const div = document.createElement("div");
    div.className = "log-line " + this._getLineClass(text);
    div.textContent = text;

    this.bodyEl.appendChild(div);
    this.lines.push(text);

    if (this.lines.length > this.maxLines) {
      this.lines.shift();
      if (this.bodyEl.firstChild) {
        this.bodyEl.removeChild(this.bodyEl.firstChild);
      }
    }

    if (this.autoScroll) {
      this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
    }
  }

  clear() {
    if (!this.bodyEl) return;
    this.bodyEl.innerHTML = "";
    this.lines = [];
  }

  copyAll() {
    const fullText = this.lines.join("\n");
    navigator.clipboard.writeText(fullText).then(() => {
      console.log("Terminal output copied to clipboard.");
    });
  }

  toggleAutoScroll(btnEl) {
    this.autoScroll = !this.autoScroll;
    if (btnEl) {
      btnEl.classList.toggle("active", this.autoScroll);
    }
  }

  toggleCollapse() {
    const wrapper = document.getElementById("terminal-wrapper");
    const icon = document.getElementById("btn-collapse-icon");
    if (wrapper) {
      wrapper.classList.toggle("collapsed");
      const isCollapsed = wrapper.classList.contains("collapsed");
      if (icon) {
        icon.textContent = isCollapsed ? "▲ Expand" : "▼ Collapse";
      }
    }
  }

  _getLineClass(text) {
    const lower = text.toLowerCase();
    if (lower.includes("[error]") || lower.includes("failed") || lower.includes("exception") || lower.includes("can't stat")) {
      return "log-error";
    }
    if (lower.includes("[warn]") || lower.includes("warning")) {
      return "log-warn";
    }
    if (lower.includes("track ") || lower.includes("queuing")) {
      return "log-track";
    }
    if (lower.includes("%]") || lower.includes("processing")) {
      return "log-progress";
    }
    if (lower.includes("[info]")) {
      return "log-info";
    }
    return "";
  }
}

window.TerminalManager = TerminalManager;

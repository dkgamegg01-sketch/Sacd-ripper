// Bridge layer between PyWebView API and Frontend JS

const Bridge = {
  async call(methodName, ...args) {
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api[methodName] === 'function') {
      try {
        return await window.pywebview.api[methodName](...args);
      } catch (err) {
        console.error(`[API Error] ${methodName}:`, err);
        throw err;
      }
    } else {
      console.warn(`[Mock API] ${methodName} called with`, args);
      // Fallback mocks for development in standard browser
      return this._mockResponse(methodName, args);
    }
  },

  _mockResponse(methodName, args) {
    switch (methodName) {
      case 'get_config':
        return {
          program_path: "sacd_extract.exe",
          input_mode: "file",
          file_path: "D:/Music/SACD_Isos/Sample_Album.iso",
          server_ip: "192.168.1.50",
          server_port: 2002,
          server_history: ["192.168.1.50"],
          output_mode: "dsf",
          stereo: true,
          multichannel: false,
          dst_decompress: true,
          dsf_nopad: false,
          export_cue: true,
          output_dir1: "D:/Music/Flac",
          output_dir2: ""
        };
      case 'check_executable':
        return { success: true, version: "sacd_extract version 0.3.9@setmind", path: "sacd_extract.exe" };
      case 'test_connection':
        return { success: true, latency_ms: 2.4, message: "Connected to player (2.4 ms)" };
      case 'inspect_disc':
        return {
          success: true,
          data: {
            title: "Dark Side of the Moon",
            artist: "Pink Floyd",
            genre: "Progressive Rock",
            year: "1973",
            channels: ["Stereo (2.0)", "Multi-channel (5.1)"],
            tracks: [
              { number: 1, title: "Speak to Me", artist: "Pink Floyd", duration: "01:30", selected: true },
              { number: 2, title: "Breathe", artist: "Pink Floyd", duration: "02:43", selected: true },
              { number: 3, title: "On the Run", artist: "Pink Floyd", duration: "03:36", selected: true },
              { number: 4, title: "Time", artist: "Pink Floyd", duration: "07:01", selected: true }
            ]
          }
        };
      default:
        return { success: true };
    }
  }
};

window.Bridge = Bridge;

(function () {
  const vscode = acquireVsCodeApi();
  const editor = document.getElementById("editor");

  editor.addEventListener("input", () => {
    vscode.postMessage({ type: "edit", text: editor.value });
  });

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg && msg.type === "update") {
      if (editor.value !== msg.text) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = msg.text;
        try {
          editor.setSelectionRange(start, end);
        } catch (_) {
          // selection out of range after external edit; ignore.
        }
      }
    }
  });

  vscode.postMessage({ type: "ready" });
})();

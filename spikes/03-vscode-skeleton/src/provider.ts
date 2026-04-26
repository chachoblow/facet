import * as vscode from "vscode";

export class FacetSpikeEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "facet.spike3.markdownEditor";

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new FacetSpikeEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      FacetSpikeEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
        vscode.Uri.joinPath(this.context.extensionUri, "fixtures"),
      ],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    const sendUpdate = (): void => {
      void webviewPanel.webview.postMessage({
        type: "update",
        text: document.getText(),
      });
    };

    const docSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        sendUpdate();
      }
    });

    webviewPanel.onDidDispose(() => docSubscription.dispose());

    webviewPanel.webview.onDidReceiveMessage((message: { type: string; text?: string }) => {
      if (message.type === "edit" && typeof message.text === "string") {
        void this.applyEdit(document, message.text);
      } else if (message.type === "ready") {
        sendUpdate();
      }
    });
  }

  private async applyEdit(document: vscode.TextDocument, newText: string): Promise<void> {
    if (document.getText() === newText) return;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      newText
    );
    await vscode.workspace.applyEdit(edit);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "webview.js")
    );
    const imageUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "fixtures", "sample.png")
    );
    const nonce = makeNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';" />
  <style>
    html, body { height: 100%; margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      display: flex; flex-direction: column;
    }
    textarea {
      flex: 1;
      resize: none;
      border: 0;
      padding: 12px;
      font: inherit;
      color: inherit;
      background: transparent;
      outline: none;
      tab-size: 4;
    }
    .image-probe {
      border-top: 1px solid var(--vscode-panel-border, #444);
      padding: 8px 12px;
      font-size: 12px;
      display: flex; align-items: center; gap: 8px;
      color: var(--vscode-descriptionForeground);
    }
    .image-probe img { width: 16px; height: 16px; image-rendering: pixelated; outline: 1px solid var(--vscode-panel-border, #444); }
  </style>
</head>
<body>
  <textarea id="editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea>
  <div class="image-probe">
    <img src="${imageUri}" alt="probe" />
    <span>asWebviewUri probe — if you see a 1×1 pixel above, the URI scheme works.</span>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

import * as vscode from "vscode";

export class FacetEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "facet.markdownEditor";

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new FacetEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(FacetEditorProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
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
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), newText);
    await vscode.workspace.applyEdit(edit);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview", "main.js"),
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
    }
    #editor, .cm-editor { height: 100%; }
    .cm-editor.cm-focused { outline: none; }
    .cm-scroller { font-family: inherit; font-size: inherit; }
    .facet-strong { font-weight: bold; }
    .facet-emphasis { font-style: italic; }
    .facet-link { color: var(--vscode-textLink-foreground); text-decoration: underline; }
  </style>
</head>
<body>
  <div id="editor"></div>
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

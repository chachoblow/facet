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

    .facet-heading-line-1 { font-size: 1.6em; font-weight: 700; line-height: 1.2; }
    .facet-heading-line-2 { font-size: 1.4em; font-weight: 700; line-height: 1.2; }
    .facet-heading-line-3 { font-size: 1.2em; font-weight: 700; line-height: 1.2; }
    .facet-heading-line-4 { font-size: 1.1em; font-weight: 600; line-height: 1.2; }
    .facet-heading-line-5 { font-size: 1em;   font-weight: 600; line-height: 1.2; }
    .facet-heading-line-6 { font-size: 1em;   font-weight: 600; line-height: 1.2; opacity: 0.8; }

    .facet-blockquote-line {
      border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-textLink-foreground));
      background: var(--vscode-textBlockQuote-background, transparent);
      padding-left: 0.6em;
      color: var(--vscode-descriptionForeground, inherit);
    }

    .facet-list-line {}

    .facet-bullet { color: var(--vscode-textLink-foreground); }

    .facet-task-checkbox {
      vertical-align: middle;
      margin: 0 0.4em 0 0;
      cursor: pointer;
    }

    .facet-code-line, .facet-code-fence-line {
      font-family: var(--vscode-editor-font-family, monospace);
      background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.08));
    }
    .facet-code-fence-line { opacity: 0.55; }
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

import * as vscode from "vscode";
import { findHeadingLineForAnchor } from "@facet/core";
import { classifyLinkTarget } from "./classify-link-target.js";

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
    const docDir = vscode.Uri.joinPath(document.uri, "..");
    const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri;
    const imageRoot = workspaceRoot ?? docDir;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist"), imageRoot],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    const baseUri = webviewPanel.webview.asWebviewUri(docDir).toString();

    const sendUpdate = (): void => {
      void webviewPanel.webview.postMessage({
        type: "update",
        text: document.getText(),
        baseUri,
      });
    };

    const docSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        sendUpdate();
      }
    });

    webviewPanel.onDidDispose(() => docSubscription.dispose());

    webviewPanel.webview.onDidReceiveMessage(
      (message: { type: string; text?: string; url?: string }) => {
        if (message.type === "edit" && typeof message.text === "string") {
          void this.applyEdit(document, message.text);
        } else if (message.type === "ready") {
          sendUpdate();
        } else if (message.type === "openLink" && typeof message.url === "string") {
          void this.openLink(document, message.url);
        }
      },
    );
  }

  private async openLink(document: vscode.TextDocument, rawUrl: string): Promise<void> {
    const target = classifyLinkTarget(rawUrl);
    if (target.kind === "remote") {
      await vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(target.url));
      return;
    }
    const targetUri =
      target.path === "" ? document.uri : vscode.Uri.joinPath(document.uri, "..", target.path);
    const targetDoc = await vscode.workspace.openTextDocument(targetUri);
    const editor = await vscode.window.showTextDocument(targetDoc);
    if (target.anchor !== null) {
      const line = findHeadingLineForAnchor(targetDoc.getText(), target.anchor);
      if (line !== null) {
        const range = new vscode.Range(line, 0, line, 0);
        editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
        editor.selection = new vscode.Selection(line, 0, line, 0);
      }
    }
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
    .facet-link { color: var(--vscode-textLink-foreground); text-decoration: underline; cursor: pointer; }

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

    .facet-code-lang-badge {
      display: inline-block;
      padding: 1px 8px;
      margin: 0;
      background: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.08));
      border: 1px solid var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.3));
      border-radius: 4px 4px 0 0;
      color: var(--vscode-descriptionForeground, inherit);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.8em;
      user-select: none;
    }

    .facet-table-line {
      font-family: var(--vscode-editor-font-family, monospace);
      border-top: 1px solid var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.3));
      border-bottom: 1px solid var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.3));
      padding: 2px 0;
    }
    .facet-table-header-line {
      font-weight: 600;
      background: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.04));
    }
    .facet-table-alignment-line {
      opacity: 0.55;
      font-size: 0.85em;
    }
    .facet-table-cell-left   { display: inline-block; text-align: left; }
    .facet-table-cell-center { display: inline-block; text-align: center; }
    .facet-table-cell-right  { display: inline-block; text-align: right; }

    .facet-frontmatter-widget {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.08));
      border: 1px solid var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.3));
      color: var(--vscode-descriptionForeground, inherit);
      font-size: 0.85em;
      cursor: pointer;
      user-select: none;
    }
    .facet-frontmatter-widget:hover {
      background: var(--vscode-list-hoverBackground, rgba(127, 127, 127, 0.16));
    }

    .facet-image {
      display: block;
      max-width: 100%;
      height: auto;
    }

    .facet-mermaid {
      display: block;
      padding: 8px 0;
      text-align: center;
      color: var(--vscode-descriptionForeground, inherit);
      cursor: pointer;
      border-radius: 4px;
    }
    .facet-mermaid:hover {
      background: var(--vscode-list-hoverBackground, rgba(127, 127, 127, 0.08));
    }
    .facet-mermaid svg {
      max-width: 100%;
      height: auto;
    }
    .facet-mermaid-error {
      color: var(--vscode-errorForeground, #f48771);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.85em;
      text-align: left;
      padding: 8px;
      border: 1px solid var(--vscode-editorWidget-border, rgba(127, 127, 127, 0.3));
      border-radius: 4px;
      background: var(--vscode-editorWidget-background, rgba(127, 127, 127, 0.08));
    }
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

import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("facet.hello", () => {
    vscode.window.showInformationMessage("Facet — scaffold loaded.");
  });
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}

import * as vscode from "vscode";
import { FacetEditorProvider } from "./provider.js";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(FacetEditorProvider.register(context));
}

export function deactivate(): void {}

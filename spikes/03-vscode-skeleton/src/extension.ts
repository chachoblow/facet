import * as vscode from "vscode";
import { FacetSpikeEditorProvider } from "./provider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(FacetSpikeEditorProvider.register(context));
}

export function deactivate(): void {}

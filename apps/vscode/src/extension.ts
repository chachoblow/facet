import * as vscode from "vscode";
import { registerCommands } from "./commands.js";
import { FacetEditorProvider } from "./provider.js";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(FacetEditorProvider.register(context));
  registerCommands(context);
}

export function deactivate(): void {}

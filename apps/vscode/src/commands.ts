import * as vscode from "vscode";
import { FacetEditorProvider } from "./provider.js";
import {
  buildEditorAssociationsRemoval,
  buildEditorAssociationsUpdate,
  type EditorAssociations,
} from "./editor-associations.js";

const CONFIG_KEY = "workbench.editorAssociations";
const PATTERN = "*.md";

type Scope = "user" | "workspace";

interface ScopeQuickPickItem extends vscode.QuickPickItem {
  scope: Scope;
}

async function pickScope(placeHolder: string): Promise<Scope | undefined> {
  const items: ScopeQuickPickItem[] = [
    {
      label: "User settings",
      description: "Apply to all workspaces",
      scope: "user",
    },
  ];
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    items.push({
      label: "Workspace settings",
      description: "Apply to this workspace only (writes to .vscode/settings.json)",
      scope: "workspace",
    });
  }
  const picked = await vscode.window.showQuickPick(items, { placeHolder });
  return picked?.scope;
}

function configurationTargetFor(scope: Scope): vscode.ConfigurationTarget {
  return scope === "user"
    ? vscode.ConfigurationTarget.Global
    : vscode.ConfigurationTarget.Workspace;
}

function readAssociationsAtScope(scope: Scope): EditorAssociations | undefined {
  const inspected = vscode.workspace.getConfiguration().inspect<EditorAssociations>(CONFIG_KEY);
  if (!inspected) return undefined;
  return scope === "user" ? inspected.globalValue : inspected.workspaceValue;
}

async function setAsDefaultMarkdownEditor(): Promise<void> {
  const scope = await pickScope("Apply Facet as default markdown editor where?");
  if (!scope) return;
  const current = readAssociationsAtScope(scope);
  const next = buildEditorAssociationsUpdate(current, PATTERN, FacetEditorProvider.viewType);
  await vscode.workspace.getConfiguration().update(CONFIG_KEY, next, configurationTargetFor(scope));
  void vscode.window.showInformationMessage(
    scope === "user"
      ? "Facet is now your default markdown editor."
      : "Facet is now this workspace's default markdown editor.",
  );
}

async function restoreDefaultMarkdownEditor(): Promise<void> {
  const scope = await pickScope("Restore the default markdown editor where?");
  if (!scope) return;
  const current = readAssociationsAtScope(scope);
  const next = buildEditorAssociationsRemoval(current, PATTERN);
  await vscode.workspace.getConfiguration().update(CONFIG_KEY, next, configurationTargetFor(scope));
  void vscode.window.showInformationMessage(
    scope === "user"
      ? "Restored the default markdown editor for all workspaces."
      : "Restored the default markdown editor for this workspace.",
  );
}

async function viewSource(): Promise<void> {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = tab?.input;
  if (
    !input ||
    typeof input !== "object" ||
    !("uri" in input) ||
    !("viewType" in input) ||
    (input as { viewType: unknown }).viewType !== FacetEditorProvider.viewType
  ) {
    void vscode.window.showInformationMessage("View source: no Facet document is active.");
    return;
  }
  await vscode.commands.executeCommand(
    "vscode.openWith",
    (input as { uri: vscode.Uri }).uri,
    "default",
  );
}

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("facet.setAsDefaultMarkdownEditor", setAsDefaultMarkdownEditor),
    vscode.commands.registerCommand(
      "facet.restoreDefaultMarkdownEditor",
      restoreDefaultMarkdownEditor,
    ),
    vscode.commands.registerCommand("facet.viewSource", viewSource),
  );
}

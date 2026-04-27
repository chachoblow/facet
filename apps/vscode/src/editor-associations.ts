export type EditorAssociations = Record<string, string>;

export function buildEditorAssociationsUpdate(
  current: EditorAssociations | undefined,
  pattern: string,
  viewType: string,
): EditorAssociations {
  return { ...(current ?? {}), [pattern]: viewType };
}

export function buildEditorAssociationsRemoval(
  current: EditorAssociations | undefined,
  pattern: string,
): EditorAssociations | undefined {
  if (!current || !(pattern in current)) return current;
  const next: EditorAssociations = { ...current };
  delete next[pattern];
  return Object.keys(next).length === 0 ? undefined : next;
}

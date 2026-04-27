export function resolveImageUrl(rawUrl: string, baseWebviewUri: string): string {
  // Without a trailing slash, URL() treats the final segment as a file and
  // strips it during resolution — so we'd resolve "logo.png" against the
  // document's parent dir instead of its own dir.
  const base = baseWebviewUri.endsWith("/") ? baseWebviewUri : baseWebviewUri + "/";
  return new URL(rawUrl, base).toString();
}

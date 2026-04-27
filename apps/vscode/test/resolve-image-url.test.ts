import { describe, expect, it } from "vitest";
import { resolveImageUrl } from "../src/webview/resolve-image-url.js";

const base = "vscode-webview://abc/path/dir/";

describe("resolveImageUrl", () => {
  it("returns an https url unchanged", () => {
    expect(resolveImageUrl("https://example.com/logo.png", base)).toBe(
      "https://example.com/logo.png",
    );
  });

  it("returns an http url unchanged", () => {
    expect(resolveImageUrl("http://example.com/logo.png", base)).toBe(
      "http://example.com/logo.png",
    );
  });

  it("returns a data uri unchanged", () => {
    const data = "data:image/png;base64,iVBORw0KGgoAAA";
    expect(resolveImageUrl(data, base)).toBe(data);
  });

  it("joins a bare relative path onto the base directory", () => {
    expect(resolveImageUrl("logo.png", base)).toBe("vscode-webview://abc/path/dir/logo.png");
  });

  it("joins a ./relative path onto the base directory", () => {
    expect(resolveImageUrl("./logo.png", base)).toBe("vscode-webview://abc/path/dir/logo.png");
  });

  it("joins a subdirectory relative path", () => {
    expect(resolveImageUrl("images/logo.png", base)).toBe(
      "vscode-webview://abc/path/dir/images/logo.png",
    );
  });

  it("resolves a ../up-one-level relative path", () => {
    expect(resolveImageUrl("../logo.png", base)).toBe("vscode-webview://abc/path/logo.png");
  });

  it("treats the base directory as a directory even without a trailing slash", () => {
    // Without normalization, URL() would treat the final segment as a file.
    expect(resolveImageUrl("logo.png", "vscode-webview://abc/path/dir")).toBe(
      "vscode-webview://abc/path/dir/logo.png",
    );
  });
});

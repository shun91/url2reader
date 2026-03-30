import { describe, expect, it } from "vitest";
import { isSupportedHttpUrl, pathToTargetUrl, pickHomeRedirectPath } from "../public/lib/url.js";

describe("pathToTargetUrl", () => {
  it("生URL風パスを復元できる", () => {
    expect(pathToTargetUrl("/https://example.com/a/b")).toBe("https://example.com/a/b");
  });

  it("URLエンコード形式も復元できる", () => {
    expect(pathToTargetUrl("/https%3A%2F%2Fexample.com%2Farticle")).toBe("https://example.com/article");
  });

  it("ルートパスはnull", () => {
    expect(pathToTargetUrl("/")).toBeNull();
  });

  it("不正URLはnull", () => {
    expect(pathToTargetUrl("/javascript:alert(1)")).toBeNull();
  });
});

describe("isSupportedHttpUrl", () => {
  it("http/httpsのみ許可", () => {
    expect(isSupportedHttpUrl("http://example.com")).toBe(true);
    expect(isSupportedHttpUrl("https://example.com")).toBe(true);
    expect(isSupportedHttpUrl("ftp://example.com")).toBe(false);
  });
});

describe("pickHomeRedirectPath", () => {
  it("?url= が有効URLなら記事パスへリダイレクト先を返す", () => {
    expect(pickHomeRedirectPath("/", "?url=https://example.com/a")).toBe(
      "/https%3A%2F%2Fexample.com%2Fa"
    );
  });

  it("生URL風パスならエンコード形式へのリダイレクト先を返す", () => {
    expect(pickHomeRedirectPath("/https://example.com/a", "")).toBe(
      "/https%3A%2F%2Fexample.com%2Fa"
    );
  });

  it("リダイレクト不要ならnull", () => {
    expect(pickHomeRedirectPath("/", "")).toBeNull();
    expect(pickHomeRedirectPath("/", "?url=javascript:alert(1)")).toBeNull();
    expect(pickHomeRedirectPath("/https%3A%2F%2Fexample.com%2Fa", "")).toBeNull();
  });
});

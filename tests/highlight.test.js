import { describe, expect, it } from "vitest";
import {
  buildXIntentText,
  normalizeSelectedText,
  pickClosestRangeCandidate,
  shouldRegisterHighlight,
  upsertHighlight
} from "../src/lib/highlight.js";

describe("highlight helpers", () => {
  it("選択テキストをtrimして正規化する", () => {
    expect(normalizeSelectedText("  テキスト  ")).toBe("テキスト");
  });

  it("空選択は登録しない", () => {
    expect(
      shouldRegisterHighlight({
        rawText: "テキスト",
        isCollapsed: true,
        isInsideArticle: true,
        isInsideUi: false
      })
    ).toBe(false);
  });

  it("UI領域の選択は登録しない", () => {
    expect(
      shouldRegisterHighlight({
        rawText: "テキスト",
        isCollapsed: false,
        isInsideArticle: true,
        isInsideUi: true
      })
    ).toBe(false);
  });

  it("条件を満たす選択は登録対象", () => {
    expect(
      shouldRegisterHighlight({
        rawText: " テキスト ",
        isCollapsed: false,
        isInsideArticle: true,
        isInsideUi: false
      })
    ).toBe(true);
  });

  it("同一テキストを重複追加せず更新する", () => {
    const first = upsertHighlight(
      [],
      {
        id: "a",
        text: "引用",
        startPath: "0.1",
        startOffset: 0,
        endPath: "0.1",
        endOffset: 2,
        anchorY: 100
      },
      "2026-03-30T00:00:00.000Z"
    );
    const second = upsertHighlight(
      first,
      {
        id: "b",
        text: "引用",
        startPath: "0.2",
        startOffset: 1,
        endPath: "0.2",
        endOffset: 3,
        anchorY: 320
      },
      "2026-03-30T01:00:00.000Z"
    );

    expect(second).toHaveLength(1);
    expect(second[0].id).toBe("a");
    expect(second[0].startPath).toBe("0.2");
    expect(second[0].updatedAt).toBe("2026-03-30T01:00:00.000Z");
  });

  it("X投稿文面を引用符付きで組み立てる", () => {
    const text = buildXIntentText({
      text: "引用文",
      title: "記事タイトル",
      url: "https://example.com/article"
    });
    expect(text).toBe(`"引用文"\n\n記事タイトル\nhttps://example.com/article`);
  });

  it("anchorYに最も近い候補を返す", () => {
    const selected = pickClosestRangeCandidate(
      [
        { id: "a", anchorY: 100 },
        { id: "b", anchorY: 220 },
        { id: "c", anchorY: 480 }
      ],
      240
    );
    expect(selected?.id).toBe("b");
  });
});

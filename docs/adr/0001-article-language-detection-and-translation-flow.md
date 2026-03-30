# ADR 0001: 記事言語判定と翻訳リダイレクト導線の設計

- Status: Accepted
- Date: 2026-03-28
- Decision Makers: 開発者、実装担当AI

## Context

このセッションでは、以下の要求が段階的に追加・変更された。

1. 記事の言語判定を追加したい
2. `ja` 以外は Google 翻訳で日本語表示したい
3. 依存ライブラリ追加なしで実現したい
4. 翻訳対象は「元記事URL」ではなく「このアプリURL」にしたい
5. `Can't translate this page` / リダイレクトループが発生した
6. SPA を廃止して MPA にしたい
7. スクロール位置保存/復元は MPA のまま復元したい
8. 見た目は初期デザインを維持したい
9. 未エンコードURL入力でも動くようにしたい

要件の変更が多く、翻訳プロキシ（`*.translate.goog`）の挙動とローカル開発時のルーティング差が問題を複雑化させた。

## Decisions

### 1) 言語判定は Functions 側で実施する

#### Decision
- 言語判定はサーバー（Pages Functions）で行う。

#### Rationale
- 既に記事抽出（Readability）が Functions 側で実行されており、判定データ（本文テキスト・HTMLメタ情報）が揃う。
- クライアント側判定より情報量が多く、実装の一元化ができる。

---

### 2) 依存ライブラリを追加せずに判定する

#### Decision
- メタ情報優先 + 本文文字種ヒューリスティックで判定する。

#### Rationale
- 「依存追加なし」が明示要件だった。
- `html[lang]` / `og:locale` / `content-language` がある場合は精度が高い。
- 欠損時は本文文字種比率で `ja` / `en` / `unknown` を推定することで最低限の実用性を確保できる。

#### Implemented in
- `src/lib/language.js`

---

### 3) 非`ja`時は Google 翻訳へ遷移する

#### Decision
- 判定結果が `ja` 以外かつ `unknown` 以外のときのみ翻訳導線を有効化する。

#### Rationale
- `unknown` を翻訳対象にすると誤判定由来の不要遷移が増えるため。

---

### 4) 翻訳対象は「このアプリURL」にする

#### Decision
- Google翻訳へ渡す `u` は元記事URLではなく、アプリの正規URL（`/<encoded targetUrl>`）とする。

#### Rationale
- ユーザー要件に合わせるため。
- アプリ経由の表示統一（サニタイズ済み本文・同一UI）を維持するため。

---

### 5) SPA を廃止し、MPA（サーバーHTML返却）に統一する

#### Decision
- クライアントで `/api/extract` を叩いて描画する方式を廃止。
- `functions/[[path]].js` で `/` と記事ページをサーバー生成HTMLで返す。

#### Rationale
- SPAだと翻訳クローラが本文を取得できず `Can't translate this page` が発生しやすい。
- MPA化で翻訳クローラに本文HTMLを直接提供できる。
- ユーザーから「完全なMPA・SPA廃止」の明示要求があった。

#### Implemented in
- `functions/[[path]].js`
- `public/index.html`（静的フォールバック）
- `public/app.js` 削除

---

### 6) 翻訳時の再帰リダイレクトを防止する

#### Decision
- 翻訳コンテキストでは翻訳URL生成・クライアント再遷移を抑止する。

#### Rationale
- `?url=` 形式で `translate.goog` 経由アクセス時にループが再現したため。
- ホスト名判定だけでは不十分で、`_x_tr_*` パラメータ等を併用する必要があった。

#### Guard Conditions
- `hostname.endsWith(".translate.goog")`
- `_x_tr_sl/_x_tr_tl/_x_tr_hl` クエリ存在
- `referer` / `origin` / `x-forwarded-host` に `translate.goog` を含む

---

### 7) 未エンコード生パスは正規化リダイレクトする

#### Decision
- `/https://...` / `/http://...` で来た場合は `/${encodeURIComponent(url)}` へ正規化する。
- `/?url=https://...` でホームが返る経路でも、クライアント側フォールバックで `/${encodeURIComponent(url)}` へ遷移する。
- サーバー側302に加えて、ホームHTMLにクライアントフォールバックも持たせる。

#### Rationale
- 一部環境で生パスが Functions まで届かず静的ホームが返るケースが確認されたため。
- 同様に、`?url=` 付きルートアクセスでも静的ホーム経由になる環境差を吸収するため。
- 2段構え（サーバー + フォールバックJS）で安定化した。

---

### 8) スクロール位置保存/復元は MPA のまま復元する

#### Decision
- 記事ページHTMLに最小JSを埋め込み、旧 `app.js` 相当の保存/復元を復活。

#### Rationale
- UX要件として維持したかったため。
- SPAは廃止しつつ機能のみ残す方針が最小変更だった。

#### Covered Events
- `scroll`（rAFで間引き）
- `beforeunload`
- `visibilitychange`
- `pagehide`
- 初期描画後 `scrollTo` で復元

---

### 9) 見た目は初期寄りに戻す

#### Decision
- 追加したカード風デザイン・背景色変更・余白拡張を取り消し、元のスタイル方針へ戻した。

#### Rationale
- UI変更は要求外であり、既存体験維持が優先だった。

## Consequences

### Positive
- 言語判定〜翻訳導線がサーバー中心で一貫した。
- 翻訳クローラ互換性が向上し、SPA起因の翻訳不可を回避しやすくなった。
- 生パス入力や翻訳経由アクセスでのループ耐性が上がった。

### Negative / Trade-offs
- 記事ページには最小JS（翻訳遷移・スクロール保存）が残るため、完全JSゼロではない。
- ヒューリスティック判定のため、言語判定精度は専用ライブラリ採用時より低い。
- `translate.goog` 側の挙動は外部依存であり、将来的な仕様変更影響を受ける。

## Related Files

- `functions/[[path]].js`
- `functions/api/extract.js`
- `src/lib/article.js`
- `src/lib/language.js`
- `public/index.html`
- `public/styles.css`

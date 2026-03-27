# url2reader

指定URLの記事から「タイトル + 本文」だけを抽出して表示する、読書集中向けWebアプリです。  
現在は Cloudflare Pages Functions で HTML を返す MPA 構成です（SPAは使用しません）。

## URL形式

- `https://<your-domain>/https://example.com/article`

## 開発

```bash
npm install --cache .npm-cache
npm run dev
```

## テスト

```bash
npm run test run
```

## デプロイ (Cloudflare Pages + Workers free枠)

1. Cloudflare Dashboard で Pages プロジェクトを作成
2. このリポジトリを接続
3. Build command: なし
4. Build output directory: `public`
5. Functions directory: `functions`
6. デプロイ後、`https://<pages-domain>/https://example.com/article` 形式でアクセス

CLIから行う場合:

```bash
npm run deploy
```

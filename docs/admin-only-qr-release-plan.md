# 管理者専用QRへの切り替え — 実装・本番反映手順

作業ブランチ: `feature/admin-only-qr-security`
対象: https://kdaido-kanri.vercel.app / Supabase `rhjnrguhnkfotggzxjfs`

**履歴文書（2026-10-28現在）：QRの管理者専用化は既に本番で適用・権限を検証済みです。** 以下の「未実施」「本番切替前」の記載は切替当時の計画・手順として保持しており、現在の未完了作業を意味しません。最新のアクセス制御は [security.md](security.md) と [security-audit-20261027.md](security-audit-20261027.md) を参照してください。旧匿名公開経路を有効化し直さないこと。

## 目的・保持事項

- 印刷済みの `/?asset=<UUID>` リンクと備品UUIDは変更しない。
- QRからは管理者ログインを求め、認証後にその備品の詳細を開く。
- QRからの写真編集は、管理者画面の既存の写真更新を使う。
- 一般社員・実習生・第三者が備品詳細や写真を閲覧できないよう、**DB/API/Storage** で禁止する。
- 既存の備品と写真を削除しない。状態4種は変更しない。
- 日常管理＋詳細編集の2段階、管理番号付番、返却管理は別PRで実装する。

## 現状の問題点（調査時点）

1. `public.get_public_asset(uuid)` は `anon` が実行可能（SECURITY DEFINER）。備品情報が返却される。
2. `public-photo-update` Edge Function は `verify_jwt:false`、関数内で認証せず service role で写真を書き換える。
3. `storage.buckets.id='asset-photos'` の `public=true` により、既知の公開画像URLを認証なしで参照できる。
4. `js/public-asset.js` が未ログインQR画面を起動していた。
5. フロントの旧「使用者変更」補助画面には氏名文字列だけを変更する経路が残る。第2工程で統一する（今回の対象外）。

## PRに含むフロント変更

- `js/public-asset.js` を無動作化、`index.html` で読み込み終了。
- `js/app.js` でQRパラメーターを認証後に解決。必ず管理者プロフィール判定とRLSを経由。
- 未ログインなら従来の管理者ログイン画面へ。QR URLはそのまま維持。
- `js/config.js` はプレビューURLで本番に転送しない。QRにエンコードするURLは固定の本番URL。
- 旧写真更新エンドポイントの**停止用**関数コードを `supabase/functions/public-photo-update/index.ts` に保持。

## 本番切替前に必ず実施

- Supabase `assets`, `asset_users`, `asset_history`, `loans` のバックアップと復旧手順を確認。
- 既存写真の `photo_path`, `label_photo_path` と Storage バケット全体の退避方法を確認。
- 作業ブランチのVercel Previewでログイン後の対象備品表示をテスト。Previewは本番Supabaseに接続するため、実データを編集しない。
- 本番切替時間を決め、短時間のQR旧経路停止を許容する。
- 下記SQL、Edge Function公開停止、最終的な本番反映は、事前レビュー後に実施する。

## サーバー側の本番変更案（未実行）

### 1. 旧写真更新エンドポイントを停止

`supabase/functions/public-photo-update/index.ts` の内容を Edge Function `public-photo-update` にデプロイする。全POSTリクエストに410を返し、service role での書き込みを廃止する。元のコードを再公開しない。

### 2. 公開RPCの実行権限を剥奪し、画像バケットを非公開へ

**レビュー用SQL（本番で未実行）:**

```sql
begin;

revoke execute on function public.get_public_asset(uuid)
  from public, anon, authenticated;

update storage.buckets
set public = false
where id = 'asset-photos';

commit;
```

現在の管理者用 `assets` RLS と `storage.objects` の管理者用 SELECT/INSERT/UPDATE/DELETE ポリシーは保持する。既存の `js/photo-update.js` は期限つき署名URLを利用しており、バケット非公開後も管理者に許可される設計。

### 3. 本番フロントをデプロイ

Previewを確認したPRだけ `main` にマージしてVercelを更新する。

### 4. サーバー適用後の確認用読み取りSQL

```sql
select
  has_function_privilege('anon', 'public.get_public_asset(uuid)', 'execute')
    as anon_can_read_qr_rpc,
  has_function_privilege('authenticated', 'public.get_public_asset(uuid)', 'execute')
    as authenticated_can_read_qr_rpc;

select id, public from storage.buckets where id = 'asset-photos';
```

期待値: 前者は両方 false。後者は `public=false`。

さらに、匿名認証で `rpc/get_public_asset` を呼んでも拒否されること、旧 `public-photo-update` に認証なしでPOSTしても410となることを確認。

## テスト項目

1. 未ログインで既存QR URLを開く: 認証画面のみ・備品名や使用者情報は表示しない。
2. 通常社員（非管理者）でログイン: 備品情報を拒否。
3. 有効管理者でログイン: URLパラメーターの同じ備品詳細を開ける。
4. 存在しないUUID/不正パラメーター: 情報を公開せずエラー表示。
5. 管理者の「編集」「写真更新」: 既存機能が利用できる。
6. 旧公開RPC、旧公開Edge、画像公開URL: 認証なしでは利用できない。
7. 一覧・検索・管理画面・写真署名URLが正常動作。
8. 既存QRの読み取り、PC・スマホでの表示。
9. `main` デプロイREADY・Supabaseの権限を再取得し確認。

注意: 既存の署名付きURLは期限まで有効な可能性がある。以前の公開画像がCDN等に一時的にキャッシュされることも考慮する。最高レベルの即時秘匿が必要なら、画像のパス更新と公開キャッシュ対応を別途検討。

## 障害時

- 新たに public RPC や匿名写真アップロードを有効化して緊急回避しない。
- まず管理者ログイン・権限・署名URL・プレビューとの差分を確認する。
- 必要ならフロントのリリースをロールバックしつつ、公開APIは閉じたままにする。
- DB更新の復旧は事前のバックアップと確認結果に基づいて個別検討する。大量削除しない。

## 既存文書の整合性

`AGENTS.md`, `docs/security.md`, `docs/architecture.md`, `docs/operations.md` の旧「匿名QR許可」規定は、本切替後に管理者専用とする。旧公開経路を再開しない。

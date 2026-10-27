# Supabase セキュリティ点検・権限見直し提案（2026-10-27）

> **本番適用記録：2026-10-27。** 利用者の承認後、不要なテーブル権限の縮小を本番Supabaseに適用済み。SQL実行対象は9つの業務テーブルの `anon` / `authenticated` ロール、および `public.assets` の `anon` へのDML権限のみ。備品・写真・ユーザーの実データは編集していない。

## 対象
- 熊本大同青果 備品管理システム
- Supabase Project: `rhjnrguhnkfotggzxjfs`
- 管理者のみが業務画面・QR・写真を閲覧／更新できる仕様
- 検査は本番プロジェクトの読み取り・コード照合によるもの。認証済み／未認証の実HTTP通信を伴う受入テストは別途必要

## 実際に確認できた点
- public 内の基礎業務テーブルは全件 RLS 有効。
- assets / asset_users / profiles / asset_history / loans / locations / categories / departments / inventory_checks / asset_exit_sessions / asset_exit_items の許可条件は `private.is_admin()` を中心に構成。
- `private.is_admin()` は `auth.uid()` に対応する、`is_active = true` の profile の role が `admin` である場合に限り真。
- 公開時代の `public.get_public_asset(uuid)` は、現存する `SECURITY DEFINER` 定義だが、anon / authenticated 両ロールで実行不可。
- 利用者用RPC（QR操作・返却・直接引継ぎ・写真更新等）は anon 実行不可。authenticated からの呼び出しについても関数内で管理者判定を実装。
- 公開View `asset_dashboard` / `overdue_loans` は `security_invoker=true`、anon・authenticated いずれにも SELECT 権限なし。
- Storage `asset-photos` は非公開。許可MIME・最大10MiB設定あり。Storageオブジェクトの SELECT / INSERT / UPDATE / DELETE は authenticated + `private.is_admin()`。
- Edge Function `admin-users` は `verify_jwt=true`、内部でSupabase Auth本人確認＋有効な管理者profileを照会し、非管理者を拒否。新規／リセットパスワードは12文字以上かつ英大小・数字・記号を必要とする。
- Edge Function `public-photo-update` は `ACTIVE`, `verify_jwt=false` だが、実際にデプロイ済みのコードはHTTP 410を返す廃止通知のみ。アップロード／更新処理は存在しない。
- 現在の有効管理者profileは12件。10件が過去30日に作成。承認されているアカウントか社内で棚卸し推奨。
- Security Advisor警告は `auth_leaked_password_protection` の1件。

## 権限変更の実施結果と残る対応

### 1. RLSでは制御できない不要なテーブル権限
変更前は下記9つの実テーブルに対して、`anon` と `authenticated` の両ロールに `TRUNCATE`, `REFERENCES`, `TRIGGER` 権限が付与されていた。**これらは承認後の変更で削除済み。**

`assets`, `asset_history`, `asset_users`, `categories`, `departments`, `inventory_checks`, `loans`, `locations`, `profiles`。

PostgreSQLは `TRUNCATE` と `REFERENCES` をRLSの対象外としている。
通常のSupabase REST APIに汎用TRUNCATE呼出しはないが、権限が不要なら将来の新規RPC・SQL実行経路に備えて撤去する。
`assets` の匿名向け SELECT/INSERT/UPDATE/DELETE 権限も承認後に削除済み。2026-10-27の再照会で、11業務テーブルのRLS有効、anonのDML権限なし、両ロールのTRUNCATE・REFERENCES・TRIGGER権限なしを確認した。

#### 適用済みSQL（記録用）
```sql
-- 2026-10-27に承認を受けて本番適用済み。記録用であり、再実行は不要
begin;

-- ログイン有無にかかわらず不要な非行単位の権限を撤去
revoke truncate, references, trigger
on table public.assets, public.asset_history, public.asset_users,
         public.categories, public.departments, public.inventory_checks,
         public.loans, public.locations, public.profiles
from anon, authenticated;

-- 業務用のassetsに匿名アクセスを許可しない（RLSに加えてGRANTも最小化）
revoke select, insert, update, delete
on table public.assets
from anon;

commit;
```
- `authenticated` のSELECT/INSERT/UPDATE/DELETE権限や、`service_role`・所有者権限は変更しない。
- TRIGGER権限を剥奪しても、既存のトリガーが発火しなくなるわけではない。
- トランザクション全体を中断すれば未コミットの操作はロールバック可能。適用後に問題が判明した場合は、事前保存したGRANT情報から**必要な特定ロール・特定テーブル・特定操作のみ**戻す。危険な権限の一括再付与は避ける。
- 影響評価対象: 管理者ログイン、備品一覧、登録、通常編集、貸出、返却、引継ぎ、廃棄、写真更新、履歴、管理者追加。実機のQRからの表示も確認。
- 上記対象権限の変更は2026-10-27に承認・適用済み。追加変更は別途レビューすること。

#### 適用前後の検証結果と再検証SQL（読み取り）
```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'TRUNCATE') as anon_truncate,
  has_table_privilege('authenticated', c.oid, 'TRUNCATE') as authenticated_truncate,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
order by c.relname;
```
検証済み：適用後の業務テーブルの両ロール `TRUNCATE` / `REFERENCES` / `TRIGGER` はすべて `false`、`assets` の `anon` SELECT/INSERT/UPDATE/DELETEはすべて `false`、RLSは以前と同じ有効状態。
`authenticated` のSELECT/INSERT/UPDATE権限と、QR・引継ぎ・写真更新のRPC権限は維持。

適用直前と直後のデータ件数は一致：assets 171件、asset_users 38件、asset_history 651件、profiles 12件、storage.objects（asset-photos）88件。
なお件数一致はデータ全内容が不変であることの完全な証明ではない。
サービス側で匿名・非管理者・管理者の各ログイン／API呼び出しの受入テストは引き続き必要。

### 2. 漏えいパスワード保護
Security Advisor: `Leaked Password Protection Disabled`。
Supabase公式では Pro プラン以上の機能。**2026-10-27の組織プラン照会で Free（tier_free）を確認**。よって現在のプランでは漏えいパスワード保護の有効化はできない。
Pro以上への移行を会社として判断した場合のみ、DashboardのAuth設定で有効化してSecurity Advisorを再実行する。
Freeプランでは既存の12文字＋文字種チェック、長い固有パスワード、MFA、管理者アカウント棚卸しを優先する。

### 3. 実機とAPIの受入確認（未完了）
- ログアウト状態でQRを開く→ログイン画面だけが出る
- 匿名クライアント: assets, asset_users, asset_history, Storage写真の取得・更新ができない
- 非管理者の認証済みアカウント: 上記アクセスができない
- 管理者: 同一操作ができ、貸出・返却・写真更新履歴が正しく残る
- `public-photo-update` POSTで410を返し、Storage更新も発生しない
- `get_public_asset` のanon/authenticated EXECUTE拒否が維持される
- 管理者12件の在籍・権限・実際の使用状況を確認

## 関連資料
- docs/security.md
- docs/admin-only-qr-release-plan.md
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS grants](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase leaked password protection](https://supabase.com/docs/guides/auth/password-security)

## 判定
**9業務テーブルの不要なGRANTの削除は本番適用済み。** 残る項目は漏えいパスワード保護の警告と、実際の未ログイン・非管理者・管理者による手動受入テスト。
本書の記載変更はGitHub PRでレビュー待ち。DBでの適用完了とPRマージ完了は別事項。

## 継続受入確認（2026-10-27）
- 公開クライアントキーのみを用いた匿名HTTP試験: assets / profiles / asset_users / asset_history のSELECTは全件401。データを返さないことを確認。
- 旧 get_public_asset はダミーUUIDでPOSTして401。DB権限照会でもanon / authenticatedのEXECUTEはfalse。
- public-photo-updateへ画像なしの空JSONをPOSTし410。業務データを変更するリクエストは行っていない。
- 既存写真の旧public URLは400で取得不可。Storageの署名URL・認証済み取得は未検証。
- PR #11 / #12 のPreview URLはVercel認証画面に転送。最終HTTP 200はアプリ表示成功を意味しない。Vercel連携APIも対象team/projectに403、ローカルVercel CLIなしのため、最新配信コミット・PC/スマホ画面操作は未確認。
- PR #11はローカルで31テスト通過。古い文言・RPC名の期待値と模擬ブラウザーの不足を修正した。製品コードは変更していない。
- 実際の非管理者・管理者ログイン、登録・編集・貸出・返却・写真更新の成功／拒否は未検証。ユーザーの認証情報、既存セッション、既存ユーザーのJWT偽装を使用していない。
- 匿名の更新拒否はGRANT/RLSの静的照会で確認した範囲。実データへのDMLは送信していない。
- PR #10の2ページ実機印刷は指示どおり保留。#11/#12もマージ・本番反映していない。

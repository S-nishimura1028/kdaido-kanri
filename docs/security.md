# セキュリティ・権限

## 原則（新仕様）
業務画面も備品QRも管理者専用。
現場でQRを読み取った場合も管理者ログインを要求し、管理者権限をサーバー側で検証する。
サーバー側の切替状況は docs/admin-only-qr-release-plan.md の適用記録で管理する。

## 管理者
profiles.role = 'admin' かつ is_active = true のユーザーのみ業務画面へ入れる。

管理者が扱う情報:
- 全備品
- 取得年月日
- 取得方法
- 取得単価
- 購入部署
- 使用・保管場所
- 使用者
- 状態
- 備考
- 写真
- 履歴
- 分析
- 管理設定

## QR利用（管理者専用）
QRは備品IDへのショートカットであり、公開権限を与えない。
匿名利用者と非管理者には備品情報を返却せず、写真の更新も禁止する。
管理者だけが既存の備品詳細・編集・写真更新へ進める。

## RLS
通常の業務テーブルは private.is_admin() を基本条件とする。

重要:
フロント側でボタンを隠すだけでは権限制御にならない。
必ずSupabase RLS側でも拒否する。

現在の管理者限定RLS変更は:
supabase/migrations/20261010_admin_qr_only.sql

## 旧Public RPC
public.get_public_asset(uuid) は関数の定義は残るが、2026-10-27時点で
anon / authenticated 両ロールの EXECUTE 権限が無いことを確認済み。
SECURITY DEFINERのため、将来も公開実行権限を戻さない。
切替手順・検証SQLは docs/admin-only-qr-release-plan.md。

## 写真
Storage bucket:
asset-photos

旧 public-photo-update Edge Function は2026-10-27時点で ACTIVE / verify_jwt=false だが、
現行の処理は旧エンドポイントの呼び出しに HTTP 410 を返す廃止通知のみ。
画像アップロード・DB更新処理は一切含まれていない。管理者用では使用しない。
Storage asset-photos バケットは非公開へ変更し、管理者用署名URLを利用する。
Storage RLS の private.is_admin() による管理者制限を保持する。

## 秘密情報
以下をGitHubへコミットしない。
- service_role key
- Vercel token
- GitHub token
- 管理者パスワード
- API秘密鍵
- 個人用認証情報

## 変更レビュー
次の変更は特に慎重に扱う。
- RLS
- Auth
- Edge Functions
- Storage policy
- public RPC
- 管理者判定
- データ削除
- 一括更新

本番DB変更前に、影響対象・ロールバック方法・確認SQLを用意する。

## 点検記録（2026-10-27）
- 本番のRLS・権限・Edge Functionsの設定を読み取りで照合。
- **承認後の本番変更により修正済み。** 9つのpublic業務テーブルから、anon / authenticated への TRUNCATE・REFERENCES・TRIGGER 権限を削除。public.assetsからanonへのSELECT/INSERT/UPDATE/DELETE権限も削除。変更後にRLSと管理者向けSELECT/INSERT/UPDATE権限維持を再検証した。
- Supabase Security Advisor の「Leaked Password Protection Disabled」は未対応。Pro以上で利用可能。
- 本番DBでは上述の権限削除のみ2026-10-27に適用済み。Auth、Storage、Edge Functions、備品データは変更していない。
- 詳細・検証手順・SQL案: docs/security-audit-20261027.md。

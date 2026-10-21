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

## 旧Public RPC（停止対象）
public.get_public_asset(uuid) の匿名実行権限を剥奪する。
SECURITY DEFINERの公開経路を残さない。
レビュードキュメントと検証用SQL: docs/admin-only-qr-release-plan.md。

## 写真
Storage bucket:
asset-photos

旧 public-photo-update Edge Function を停止し、匿名アップロードを受け付けない。
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

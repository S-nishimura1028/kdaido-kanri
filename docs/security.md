# セキュリティ・権限

## 原則
業務画面は管理者専用。
現場利用はログイン不要のQR画面に限定する。

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

## QR利用者
ログイン不要。

公開する情報:
- 管理No.
- 備品名
- カテゴリ
- メーカー
- 型番
- 製造番号
- 部署
- 使用・保管場所
- 現在の使用者
- ステータス
- 外観写真
- ラベル写真

公開しない情報:
- 取得単価
- 取得年月日
- 取得方法
- 管理者向け備考
- 履歴
- 分析画面
- 他の備品一覧

更新可能:
- 外観写真
- ラベル写真

更新不可:
- 備品名
- 使用者
- 保管場所
- 部署
- ステータス
- 取得情報
- 備考
- その他の管理項目

## RLS
通常の業務テーブルは private.is_admin() を基本条件とする。

重要:
フロント側でボタンを隠すだけでは権限制御にならない。
必ずSupabase RLS側でも拒否する。

現在の管理者限定RLS変更は:
supabase/migrations/20261010_admin_qr_only.sql

## Public RPC
public.get_public_asset(uuid) は公開QR専用。
Security Definerを使用しているため、返却カラムを増やす時は必ず公開可否を確認する。

## 写真
Storage bucket:
asset-photos

QRからの写真更新は public-photo-update Edge Function を経由する。

public-photo-update はservice roleを内部で使用するため、
処理対象を写真2項目以外へ広げない。

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

# システム構成

## 全体像

利用者
- 管理者 → 通常URL → Vercel → Supabase Auth / Database / Storage
- QR利用者 → 備品QR → Vercel公開画面 → 限定RPC / 写真更新Edge Function

ソースコードはGitHubで管理し、mainの更新をVercelが本番へデプロイします。

## GitHub
Repository:
S-nishimura1028/kdaido-kanri

主なファイル:
- index.html
- js/app.js
- js/public-asset.js
- js/photo-update.js
- js/admin-master.js
- js/admin-analysis.js
- js/qr-print.js
- js/config.js
- vercel.json
- supabase/migrations/

## Vercel
本番URL:
https://kdaido-kanri.vercel.app

現行構成は静的サイト中心。
mainブランチの変更が本番デプロイにつながるため、機能変更は原則として作業ブランチとPreviewで確認する。

## Supabase
Production project ref:
rhjnrguhnkfotggzxjfs

主な用途:
- Auth
- PostgreSQL
- Storage
- Edge Functions

### 主なテーブル
#### assets
備品本体。
代表的な項目:
- id
- asset_no
- name
- manufacturer
- model
- purchase_date
- purchase_price
- location
- department
- user_name
- quantity
- status
- note / notes
- photo_path
- label_photo_path
- acquisition_method
- is_deleted
- deleted_at

#### profiles
管理者アカウント情報。
Auth users と紐づく。

#### categories
カテゴリマスタ。

#### locations
保管場所マスタ。

#### departments
部署マスタ。

#### asset_history
備品変更履歴。

### その他
loans / inventory_checks 等の既存テーブルがある。
現在の中心運用ではないため、用途確認なしに削除・再設計しない。

## 公開QR
URLの asset パラメータで対象備品を指定する。

公開取得:
public.get_public_asset(uuid)

公開画面:
js/public-asset.js

公開写真更新:
Supabase Edge Function public-photo-update

QR利用者は通常の assets SELECT 権限を持たず、限定された公開経路だけを使用する。

## QRラベル
js/qr-print.js

用紙:
インクファクトリー LBLA4-WPG-27
A4 / 27面 / 3×9 / 62×31mm

## 重要
この文書は構成概要。
実際の権限判断はSupabaseのRLS・Function定義を正とする。

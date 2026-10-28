# システム構成

## 全体像

利用者（切替後）
- 管理者 → 通常URL → Vercel → Supabase Auth / Database / Storage
- 管理者 → 備品QR（固定 ?asset=UUID）→ ログイン → 該当備品の詳細 / 編集
- 未ログイン・非管理者のQR情報取得は禁止

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

## 管理者専用QR（サーバー切替後）
URLの asset パラメータで対象備品を指定する。
js/app.js が通常の管理者ログインと RLS を経由して備品を開く。
js/public-asset.js は廃止し、匿名取得RPCと公開写真更新Edge Functionを使用しない。
実際の本番API/Storage停止手順は docs/admin-only-qr-release-plan.md を参照。

## QRラベル
js/qr-print.js

用紙:
- 標準：エーワン 31373（A4／27面／3×9／62×31mm）。従来のインクファクトリー LBLA4-WPG-27と同じ面付寸法。
- 屋外用：エーワン 31071（A4／24面／3×8／64×33.86mm）。
- 本番コードの印刷画面では31373が初期選択。機器・用紙の適合と印刷位置は、実機での試験が必要。

## 重要
この文書は構成概要。
実際の権限判断はSupabaseのRLS・Function定義を正とする。

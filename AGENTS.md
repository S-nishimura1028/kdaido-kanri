# AGENTS.md — 熊本大同青果 備品管理システム

## このファイルの目的
このリポジトリを扱うAI・開発者向けの最優先ルールです。
変更前に README.md と docs/ 配下も確認してください。

## システムの目的
外国人実習生向けを中心とした社内備品を一元管理し、
回収 → 状態確認 → 保管・修理 → 再利用 → 次の使用者への引継ぎ
を継続できるようにする。

## 現在の基本構成
- フロントエンド: 静的 HTML / JavaScript
- ホスティング: Vercel
- データベース / Auth / Storage / Edge Functions: Supabase
- ソース管理: GitHub
- 本番URL: https://kdaido-kanri.vercel.app
- Supabase project ref: rhjnrguhnkfotggzxjfs

## 利用者モデル
利用者は原則2種類だけ。
1. 管理者
   - ログイン必須
   - ダッシュボード、備品一覧、登録・編集、履歴、分析、管理設定を利用
2. QR利用者
   - ログイン不要
   - QRで指定された備品1点の限定情報を閲覧
   - 更新可能なのは外観写真とラベル写真のみ

一般社員用・管理担当者用のログイン運用は行わない。

## ステータス
次の4種類を固定で使う。
- 使用中
- 未使用
- 修理中
- 廃棄

勝手に新しいステータスを追加しない。

## 重要な安全ルール
- main ブランチへ大きな機能変更を直接入れない。
- 機能変更は作業ブランチ → Preview → 確認 → main の順を基本とする。
- 本番Supabaseへの破壊的変更を勝手に実行しない。
- DROP / TRUNCATE / 大量DELETE / Authユーザー一括変更 / Storage一括削除は禁止。
- 本番DB変更が必要な場合は、SQL案を先に提示し、人間が内容を確認してから適用する。
- service_role key、アクセストークン、パスワード、秘密鍵をGitHubへ保存しない。
- RLSを無効化して問題を回避しない。
- public QRの公開項目を増やす場合は個人情報・取得単価・備考・履歴を公開しない。
- 公開QRから備品名、使用者、場所、状態などを変更できるようにしない。
- 既存のQRラベル仕様を変える場合は実物印刷との整合を確認する。

## QRラベル
現在の用紙:
- インクファクトリー LBLA4-WPG-27
- A4
- 27面
- 3列 × 9行
- 62mm × 31mm

関連コード: js/qr-print.js

## 主なコード
- index.html: 画面構造・スタイル・各画面
- js/app.js: ログイン、備品一覧、登録編集、履歴、QR生成
- js/public-asset.js: 未ログインQR画面
- js/photo-update.js: 写真更新UI
- js/admin-master.js: 管理者・マスタ管理
- js/admin-analysis.js: 管理分析
- js/qr-print.js: QR印刷
- supabase/migrations/: DB/RLS変更の履歴

## 変更時の確認
最低限、以下を確認する。
1. 管理者ログインができる
2. 非管理者アカウントで業務画面に入れない
3. 備品一覧・検索・状態絞り込みが動く
4. 備品登録・編集が動く
5. QR URLを未ログインで開ける
6. QR画面に管理者専用情報が出ない
7. QRから変更できるのは写真だけ
8. Vercel PreviewでPC・スマホ双方を確認
9. Supabase RLSを変更した場合は実際のpolicyを再取得して確認

## 将来の引継ぎ
このシステムは特定個人のChatGPTやCodexアカウントに依存させない。
GitHub、Vercel、Supabaseは将来会社管理へ移管できる状態を維持する。
詳細は docs/handover.md を参照。

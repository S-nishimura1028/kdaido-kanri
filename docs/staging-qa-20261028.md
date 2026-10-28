# 検証環境（本番と分離）— 2026-10-28

> **STAGING ONLY / このブランチ・PR #17 は main へマージしないこと。**

## 接続先と区別
- Supabase staging: `jhcurtjtjzrbsvptkpuz`（Freeプラン・追加見積月額 $0）
- Supabase production: `rhjnrguhnkfotggzxjfs`（参照・変更・コピーしない）
- Vercel staging branch: `staging/isolated-supabase-20261028`
- 検証専用Previewの固定ブランチURL:
  `https://kdaido-kanri-auto-git-staging-28a335-tr6dqmrwjx-3964s-projects.vercel.app/`
- `js/config.js` はこの固定ホスト以外で実行しない安全装置を設置。
- QRのURLも検証専用Previewを指す。本番のQRシールを検証用に印刷・貼付しない。
- 公開ブラウザキーは staging 用の publishable key のみ。service_role と秘密鍵は保存しない。

## 複製した構造（実データは未複製）
- public 業務テーブル 11個（すべてRLS有効）
- 制約57、索引37、関数25、業務トリガー10、auth.users新規作成トリガー1
- 業務ポリシー27、Storageポリシー4、非公開の `asset-photos` バケット
- 参照元: 本番データベースのカタログを読み取り、構造だけを staging の3つの migration に適用
- 本番管理者・社員・実習生・部屋割り・写真データは staging に一切コピーしていない

## 架空の検証用データ
- `【検証専用】電子レンジ`（未使用） — KD-0002
- `【検証専用】冷蔵庫`（修理中） — KD-0003
- `【検証専用】架空の使用者`
- `【検証専用】テスト部署`、`【検証専用】テスト倉庫`、`【検証専用】テスト家電`
- 2026-10-28: 備品2、履歴2、利用者1、Authアカウント0、写真0。
- 連番のKD-0001はロールバックしたDB内テストで消費（PostgreSQL sequenceはロールバックで戻らない）。本番の管理番号とは無関係。

## 実施した機能検証
- 管理番号の自動採番・登録履歴
- admin JWTを模擬した貸出・返却・履歴
- 写真パス更新のチェック付きRPC・競合時の拒否
- 非管理者JWTを模擬した備品読み取り拒否
- 上記トランザクションテストはロールバック。現在の本番DB/認証/写真に変更なし。
- Vercel Previewのビルド成功とGitHub ActionsのCI成功を確認。

## 残りの受入試験（実ブラウザ）
1. stagingだけに新しいテスト管理者アカウントを作る（本番アカウントをコピーしない）
2. 検証用Previewで管理者ログインし、架空の電子レンジの一覧→詳細→編集→保存を確認
3. 写真1枚（架空の画像）をstaging Storageに保存、更新後の画像/履歴と競合復旧を確認
4. 架空の使用者へ貸出、現物確認の模擬後に返却し履歴を確認
5. QRを読み込んだ際、検証用Preview内で正しい備品詳細が開くか確認
6. 未ログイン／非管理者のDB・写真アクセス拒否を実ブラウザで確認
7. 最後に検証専用レコードと写真の整理。**本番プロジェクトには一切触れない**

## 注意
- stagingであっても、写真や氏名は実在の社員・実習生のものを使わない。
- 本番シールの複数ページ実機試験は別件として保留を維持。
- staging Preview は Vercel Deployment Protection によりサインイン要求が出る可能性がある。
- 本番へのマイグレーション適用・認証設定変更・PR #17 のmainマージは禁止。

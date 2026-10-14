# 会社への引継ぎ・完全移管

## 目的
現在の開発者個人に依存せず、将来会社の情報システム担当者へ完全に引き継げる状態を維持する。

最終的には、元の開発者アカウントを削除しても運用・保守できることを目標とする。

## 移管対象
### GitHub
現在:
S-nishimura1028/kdaido-kanri

将来:
会社所有のGitHub OrganizationへRepository Transfer。

移管後:
- 会社担当者をOwner/Adminへ
- Branch protectionやGitHub Appを再確認
- 個人アカウント依存を削除

### Vercel
現在のプロジェクトを会社Vercel TeamへTransferする。

確認項目:
- Production domain
- Git連携
- Environment Variables
- Integrations
- Monitoring / Logs
- Deployment設定
- Billing

### Supabase
現在のProjectを会社Supabase OrganizationへTransferする。

確認項目:
- Database
- Auth
- Storage
- Edge Functions
- RLS
- API設定
- Billing
- GitHub Integration等の外部連携

### Codex / AI
Codex環境自体をシステムの必須要件にしない。

会社担当者は、会社側のGitHub権限でこのRepositoryをCodex等へ接続できる。
AIがなくても通常のWebシステムとして保守可能な状態を維持する。

## 移管前チェックリスト
- [ ] GitHubに最新コードがある
- [ ] DB変更がsupabase/migrationsに記録されている
- [ ] README / docsが最新
- [ ] パスワードや秘密鍵がコードにない
- [ ] Vercelの環境変数一覧を会社担当者が把握
- [ ] Supabase Edge Functionsを把握
- [ ] RLS一覧を確認
- [ ] 管理者アカウントを会社メール中心へ変更
- [ ] 請求先を会社へ変更
- [ ] ドメイン所有者を会社へ統一
- [ ] バックアップを取得
- [ ] 移管後に管理者ログインを確認
- [ ] QR閲覧・写真更新を確認
- [ ] 旧個人アカウントを最後に削除

## 引継ぎ方針
個人のChatGPT会話や記憶を正式な仕様書として扱わない。
重要な仕様・変更は必ずRepository内へ記録する。

コードの理由が分かりにくい変更にはコメントまたは文書を残す。

## 緊急時
担当者が不明でも、まず以下を見る。
1. README.md
2. AGENTS.md
3. docs/architecture.md
4. docs/security.md
5. docs/operations.md
6. supabase/migrations/

これだけでシステムの全体像を把握できる状態を維持する。

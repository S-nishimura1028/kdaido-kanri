# メール6桁コードによる管理者ログイン（テスト環境）

## 目的
Vercel Preview の保護画面など、Magic Linkのブラウザ遷移がうまく動作しない場合でも、
既存管理者が **同じブラウザで** 6桁のコードを入力してSupabase Authへログインできるようにする。
パスワードログインは残す。新規ユーザー登録はしない。
ログイン成功後は `profiles.role = 'admin'` と `is_active = true` が必要（`js/app.js`）。

## アプリ（このPRのPreview版）
- メール入力 → 「6桁コードをメールで送信」 → コード入力欄 → 「認証コードでログイン」
- `supabase.auth.signInWithOtp({email, options:{shouldCreateUser:false}})`
- `supabase.auth.verifyOtp({email,token,type:'email'})`
- メールから別ドメインに戻る必要はない。認証成功イベントでアプリを表示する。
- OTPの入力間違い・期限切れ・Supabaseの429送信制限は画面に表示する。

## リリース前に必須：Supabase Authメールテンプレートを変更
この設定はSupabase MCPから編集できないため、**Supabaseの管理画面かWorkのブラウザ操作で変更**する。

1. Supabaseプロジェクト `rhjnrguhnkfotggzxjfs` を開く。
2. Authentication → Email Templates → **Magic Link** を開く。
3. 既存テンプレートは削除せず、メール本文に次のHTMLを**追加**する。

   ```html
   <p>熊本大同青果 備品管理システムのログイン確認コード:</p>
   <p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>この6桁コードを、元の備品管理サイトの画面に入力してください。</p>
   ```

   `{{ .Token }}` はSupabase公式のテンプレート変数。実際のトークン値を手入力・固定しない。
   既存の `{{ .ConfirmationURL }}` を使うリンクを残してよい。
   **Magic Link以外のメールテンプレートは変更しない。**
4. 保存後、テンプレートに `{{ .Token }}` が残っていることを再確認する。
5. 必要ならAuthentication → Rate Limitsも参照する。安易に制限を解除しない。

## 実機テスト
- Vercelプレビューを本人のブラウザで開く。PreviewのVercel認証が必要な場合は、先にVercelへ正規ログインする。
- 既存の管理者メールアドレスを入力し、「6桁コードをメールで送信」を**1回だけ**押す。
- 新しく届いたメールに6桁の数字が表示されることを確認する。
- **メールのリンクを押さず、**画面のコード入力欄へ6桁数字を入力して認証する。
- 管理者ダッシュボードが表示され、備品一覧が読み込まれることを確認する。
- QRパラメータ付きURLの場合は、該当備品の詳細まで開くか確認する。
- コードをチャットやスクリーンショットに含めない。古いメールのコードは使わない。
- 429の場合は送信制限解除を待つ。繰り返し送信しない。

## 制限と注意点
- **このPRはまだDraft。Productionへマージしていない。**
- テンプレート変更はSupabaseプロジェクト全体のMagic Linkメールに影響するので、変更前の本文を保存し既存の案内リンクを維持する。
- GitHub Actionsの成功はSupabase Authの実メール送信やログイン画面のE2E成功を保証しない。
- 既存の公開RPC / 公開写真バケット / 匿名写真更新などの切替は別件。本PRのログイン動作確認が完了するまで切替を開始しない。

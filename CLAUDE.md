# ブランチ/worktreeでの並行作業ルール

- このプロジェクトはGitHub Pagesが`main`ブランチを直接見て自動ビルド・公開する構成（`https://a3design-aminagata.github.io/merge-smith-calculator/`）。つまり**pushがそのままデプロイ**になる
- **ブランチ側セッション**：修正してコミットし、GitHub PRを作成してmerge、pushまで自分の判断で確認なしに進めてよい。理由：
  - `main`は別worktree（リポジトリ直下）にcheckout中のため、ローカルの`git merge`では取り込めない → GitHub PR経由でmergeする
  - PRのmergeはgitが差分を見て安全に取り込む操作で、他セッションが既にmainに反映した変更を上書きで消すことがない（flashcards等の`firebase deploy`のような無条件上書きとは性質が違う）
  - mainブランチは保護設定なし、個人用の低リスクなツールであるため
- **mainセッション**：自分の変更はコミット→pushまで自由に進めてよい（確認不要）
  - 作業前の`git pull`は`.claude/hooks/git-sync.sh`（SessionStartフック）が自動実行するので手で叩く必要はない。fast-forwardできる時だけpullし、分岐時・未コミット変更がある時はpullせず警告を出す
  - 上流ブランチが無いブランチ（detached HEADのworktree含む）ではスキップされる
- ブランチ側セッションはUI変更を行ったら、Previewでスクリーンショットを撮り、画像として（テキスト説明だけでなく）必ずチャットに添付する
- `worker/`（Cloudflare Worker, gemini-proxy）はGitHub Pagesの対象外。Cloudflare側にGit連携は無いが、`.github/workflows/deploy-worker.yml`（GitHub Actions）が`worker/**`の変更を含むmainへのpushを検知して`wrangler deploy`を実行する。**手動デプロイは不要**
  - 必要なGitHub Secrets: `CLOUDFLARE_API_TOKEN`（Edit Cloudflare Workers権限）、`CLOUDFLARE_ACCOUNT_ID`
  - `GEMINI_API_KEY`はCloudflare側のSecretとして保持されており、`wrangler deploy`では消えない。ワークフローでは触らない
  - 手動で再デプロイしたい時はGitHubのActionsタブから`Deploy Cloudflare Worker`を`workflow_dispatch`で実行する（iPhoneのGitHubアプリからも可能）

# キャッシュ対策（スマホで古い版が出る問題）

- `scripts/stamp-assets.py` がHTML内のCSS/JS参照に `?v=<内容ハッシュ>` を付け直す。`.githooks/pre-commit` から自動実行されるので、手で叩く必要はない（`?v=`を手編集もしない）
- フック本体は`.githooks/`（**Git管理下**）にあり、`core.hooksPath=.githooks` で参照される。フックの作り直しは不要
  - `core.hooksPath`はローカル設定なので新規クローンでは未設定だが、`.claude/hooks/ensure-git-hooks.sh`（SessionStartフック）が自動で設定する
  - worktreeは親リポジトリのgit configを共有するため、そのまま効く（`.git/hooks`時代も共有されていた）
  - Claude Codeを通さずに使うクローンでのみ、1回だけ `git config core.hooksPath .githooks` が必要
- 新しいCSS/JSファイルを追加したら、`scripts/stamp-assets.py` の `ASSETS` に追記する
- `app.js` の `DIGIT_DEFAULTS` を変えたら `DIGIT_DEFAULTS_VERSION` を、`DEFAULT_GOAL_ROWS` を変えたら `GOAL_ROWS_VERSION` を必ず+1する。上げないと、既存ユーザーのlocalStorageに残った古い設定が使われ続けて間違った数字が出る

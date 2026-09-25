# merge-smith-calculator プロジェクト指示

- GitHub Pages が `main` ブランチを直接見て自動ビルド・公開する構成（`https://a3design-aminagata.github.io/merge-smith-calculator/`）。**main への push がそのままデプロイ**になる
- 作業前の同期は `.claude/hooks/git-sync.sh`（SessionStart フック）が自動で行う。fast-forward できる時だけ pull し、分岐時・未コミット変更がある時は pull せず警告を出す
- UI を変えたら Preview でスクリーンショットを撮り、画像としてチャットに添付する
- `worker/`（Cloudflare Worker, gemini-proxy）はGitHub Pagesの対象外。Cloudflare側にGit連携は無いが、`.github/workflows/deploy-worker.yml`（GitHub Actions）が`worker/**`の変更を含むmainへのpushを検知して`wrangler deploy`を実行する。**手動デプロイは不要**
  - 必要なGitHub Secrets: `CLOUDFLARE_API_TOKEN`（Edit Cloudflare Workers権限）、`CLOUDFLARE_ACCOUNT_ID`
  - `GEMINI_API_KEY`はCloudflare側のSecretとして保持されており、`wrangler deploy`では消えない。ワークフローでは触らない
  - 手動で再デプロイしたい時はGitHubのActionsタブから`Deploy Cloudflare Worker`を`workflow_dispatch`で実行する（iPhoneのGitHubアプリからも可能）

## ブランチ運用（PC・iPhone のどのセッションも共通）

2026-09-25 ユーザー指定。**main に直接コミットしない。毎回ブランチで作業し、確認が通ったらユーザーに聞かずに自分で main へ入れて push する。** main への push で GitHub Pages が公開され、`worker/` を触った時は GitHub Actions が Cloudflare Worker をデプロイする。

1. 開始時に `git fetch origin` で最新の main を取る
2. 作業ブランチを切る: `git switch -c <内容が分かる名前> origin/main`
   - クラウドセッション（iPhone / claude.ai/code）で最初から付いている `claude/...` ブランチ、PC でアプリが作った worktree のブランチは、そのまま使ってよい
   - **PC の本体フォルダ（`~/apps/merge-smith-calculator`）は main のまま置いておき、そこでブランチを切り替えない**（他のセッションが同じフォルダを使っているため）。PC で本体フォルダから始まったセッションは `git worktree add .claude/worktrees/<名前> -b <名前> origin/main` で worktree を作ってそこで作業する
3. 修正して「merge 前の確認」を通す: 画面を触った時は Preview / ローカルで開いてコンソールエラーが無く、変えた所が意図どおり表示されること
4. 最新の main を取り込む: `git fetch origin && git merge origin/main`
5. conflict は自分で解消する（両方の意図を残す。どちらを取るか判断できない時だけユーザーに聞く）。解消したら 3 の確認をもう一度
6. main へ入れる: `git push origin HEAD:main`（4 で取り込み済みなので fast-forward で入る）。**拒否されたら（他のセッションが先に入れた）4 からやり直す**
7. PC では本体フォルダの main も進めておく: `git -C ~/apps/merge-smith-calculator merge --ff-only origin/main`（本体フォルダに未コミットの変更がある時は触らない。次のセッション開始時に同期フックが追いつかせる）
8. **force push 禁止。** 入れ終わったらブランチを消す（ローカル・リモート・worktree。クラウドからはリモートを消せないのでローカルだけ）
- **例外: ユーザーが「見てから決めたい」「どっちか選びたい」と言った変更**は 6 の前で止め、スクリーンショット等を見せて OK をもらってから入れる
- GitHub の PR は作らない（Actions の分数を使い、手間が増えるだけ）
- 下の「ブランチ側セッションが PR を作って merge」は廃止。この節が優先する

# キャッシュ対策（スマホで古い版が出る問題）

- `scripts/stamp-assets.py` がHTML内のCSS/JS参照に `?v=<内容ハッシュ>` を付け直す。`.githooks/pre-commit` から自動実行されるので、手で叩く必要はない（`?v=`を手編集もしない）
- フック本体は`.githooks/`（**Git管理下**）にあり、`core.hooksPath=.githooks` で参照される。フックの作り直しは不要
  - `core.hooksPath`はローカル設定なので新規クローンでは未設定だが、`.claude/hooks/ensure-git-hooks.sh`（SessionStartフック）が自動で設定する
  - worktreeは親リポジトリのgit configを共有するため、そのまま効く（`.git/hooks`時代も共有されていた）
  - セッション開始フックを通さずに使うクローンでのみ、1回だけ `git config core.hooksPath .githooks` が必要
- 新しいCSS/JSファイルを追加したら、`scripts/stamp-assets.py` の `ASSETS` に追記する
- `app.js` の `DIGIT_DEFAULTS` を変えたら `DIGIT_DEFAULTS_VERSION` を、`DEFAULT_GOAL_ROWS` を変えたら `GOAL_ROWS_VERSION` を必ず+1する。上げないと、既存ユーザーのlocalStorageに残った古い設定が使われ続けて間違った数字が出る
  - これは`scripts/check-version-bumps.py`（pre-commitから実行）が強制する。上げ忘れているとコミットが止まり、どの定数をいくつにすべきか表示される
  - 判定はリテラル部分の文字列比較（空白は正規化）なので、インデントや改行位置を変えただけでは発火しない
  - 意図的に上げずにコミットしたい場合のみ`git commit --no-verify`（ただしstamp-assetsも同時に無効になる点に注意）

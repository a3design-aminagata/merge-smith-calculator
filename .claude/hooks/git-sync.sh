#!/usr/bin/env bash
# セッション開始時にリモートと同期する。
# このリポジトリは main への push がそのまま本番デプロイになる（GitHub Pages と、
# .github/workflows/deploy-worker.yml 経由の Cloudflare Worker の両方）。
# iPhone・別worktree・別セッションが並行して main を進めるため、古いローカルのまま
# 作業して push すると、他所の変更を巻き戻した状態が本番へ出てしまう。
# 安全のため fast-forward できる時だけ pull し、それ以外は警告するだけに留める。
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0

# 認証待ちでハングさせない
export GIT_TERMINAL_PROMPT=0

# gitリポジトリでない、またはoriginが無い場合は何もしない
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
git remote get-url origin >/dev/null 2>&1 || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0

# 出力用ヘルパー: $1 = モデルに渡す文脈, $2 = ユーザーに見せる一行（省略可）
emit() {
  if [ -n "${2:-}" ]; then
    jq -n --arg ctx "$1" --arg msg "$2" \
      '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx},systemMessage:$msg}'
  else
    jq -n --arg ctx "$1" \
      '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx},suppressOutput:true}'
  fi
  exit 0
}

git fetch --quiet origin 2>/dev/null || emit "git fetch に失敗した（オフラインの可能性）。origin/${BRANCH} との差分は未確認。"

# 上流が設定されていないブランチ（ローカル専用ブランチ・detached HEADのworktree）は対象外
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null) || \
  emit "ブランチ ${BRANCH} に上流ブランチが無いため同期チェックをスキップした。"

BEHIND=$(git rev-list --count "HEAD..@{u}" 2>/dev/null || echo 0)
AHEAD=$(git rev-list --count "@{u}..HEAD" 2>/dev/null || echo 0)
DIRTY=$(git status --porcelain 2>/dev/null | head -1)

if [ "$BEHIND" -gt 0 ] && [ "$AHEAD" -gt 0 ]; then
  emit "警告: ${BRANCH} は ${UPSTREAM} と分岐している（未pushが${AHEAD}件、未取得が${BEHIND}件）。自動pullはしなかった。このリポジトリはpushがそのまま本番デプロイになるため、作業を始める前にユーザーへ伝え、merge か rebase の方針を確認すること。" \
       "⚠️ ${BRANCH} が ${UPSTREAM} と分岐しています（ローカル${AHEAD}件 / リモート${BEHIND}件）"
fi

if [ "$BEHIND" -gt 0 ] && [ -n "$DIRTY" ]; then
  emit "警告: ${UPSTREAM} に未取得のコミットが${BEHIND}件あるが、作業ツリーに未コミットの変更があるため自動pullしなかった。作業を始める前にユーザーへ伝え、commit か stash してから pull すること。" \
       "⚠️ リモートに${BEHIND}件の新しいコミットがありますが、未コミットの変更があるためpullしませんでした"
fi

if [ "$BEHIND" -gt 0 ]; then
  # 引数なしで上流（@{u}）へ ff-only。BEHIND/AHEAD の計算と同じ参照を使う
  if git pull --ff-only --quiet 2>/dev/null; then
    emit "セッション開始時に ${UPSTREAM} から${BEHIND}件のコミットを自動pullした（fast-forward）。ローカルは最新。" \
         "✅ リモートから${BEHIND}件のコミットを取り込みました"
  fi
  emit "警告: ${UPSTREAM} に未取得のコミットが${BEHIND}件あるが、自動pullに失敗した。作業を始める前にユーザーへ伝えること。" \
       "⚠️ リモートに${BEHIND}件の新しいコミットがありますが、pullに失敗しました"
fi

if [ "$AHEAD" -gt 0 ]; then
  emit "注意: ${BRANCH} に未pushのコミットが${AHEAD}件ある。このリポジトリは main への push で GitHub Pages と Cloudflare Worker の両方が本番へ自動デプロイされるため、作業が一段落したら push すること。" \
       "ℹ️ 未pushのコミットが${AHEAD}件あります"
fi

emit "セッション開始時に ${UPSTREAM} と同期済みであることを確認した。"

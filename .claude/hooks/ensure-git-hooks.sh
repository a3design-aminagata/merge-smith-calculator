#!/usr/bin/env bash
# pre-commitフック（stamp-assets）が効く状態かをセッション開始時に保証する。
#
# フックの実体は .githooks/pre-commit（Git管理下）に置き、core.hooksPath で参照する。
# core.hooksPath はローカル設定なので新規クローンでは未設定になる。ここで自動で
# 設定することで「クローンしたらフックが効いていなかった」という無言の失敗を防ぐ。
# 未スタンプのままpushすると、スマホに古いCSS/JSがキャッシュされ続ける。
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -f "$ROOT/.githooks/pre-commit" ] || exit 0

# 実行ビットはGitが保存するが、念のため落ちていたら戻す
[ -x "$ROOT/.githooks/pre-commit" ] || chmod +x "$ROOT/.githooks/pre-commit" 2>/dev/null

CURRENT=$(git config --get core.hooksPath 2>/dev/null || true)
[ "$CURRENT" = ".githooks" ] && exit 0

git config core.hooksPath .githooks 2>/dev/null || exit 0

jq -n --arg ctx "core.hooksPath を .githooks に設定した（未設定だったため）。これで pre-commit の stamp-assets が効く。" \
      --arg msg "🔧 pre-commitフック（キャッシュバスティング）を有効化しました" \
  '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx},systemMessage:$msg}'

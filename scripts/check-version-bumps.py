#!/usr/bin/env python3
"""app.js のデフォルト値を変えたのにバージョン番号を上げ忘れていないか検査する。

上げ忘れると、既存ユーザーのlocalStorageに残った古い設定が使われ続け、
エラーも出さずに間違った数字が表示される（=無言で壊れる）。
pre-commit から呼ばれ、該当時は exit 1 でコミットを止める。

比較はHEAD版とステージ版の「リテラル部分の文字列」で行い、空白は正規化するので
インデント変更や改行位置の変更だけでは発火しない。
"""
import re
import subprocess
import sys

TARGET = "app.js"

# (定数名, 開き括弧, 閉じ括弧, 対応するバージョン定数名)
CHECKS = [
    ("DIGIT_DEFAULTS", "{", "}", "DIGIT_DEFAULTS_VERSION"),
    ("DEFAULT_GOAL_ROWS", "[", "]", "GOAL_ROWS_VERSION"),
]


def git(*args):
    """git コマンドを実行して stdout を返す。失敗したら None。"""
    try:
        r = subprocess.run(["git", *args], capture_output=True, text=True)
    except OSError:
        return None
    return r.stdout if r.returncode == 0 else None


def extract_literal(src, name, open_ch, close_ch):
    """`const NAME = {...}` のリテラル部分を括弧の対応を数えて切り出す。"""
    m = re.search(r"\b%s\s*=\s*\%s" % (re.escape(name), open_ch), src)
    if not m:
        return None
    start = m.end() - 1
    depth = 0
    for i in range(start, len(src)):
        c = src[i]
        if c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return re.sub(r"\s+", " ", src[start:i + 1]).strip()
    return None


def extract_version(src, name):
    """`const NAME = 3;` の数値を返す。"""
    m = re.search(r"\b%s\s*=\s*(\d+)" % re.escape(name), src)
    return m.group(1) if m else None


def main():
    # app.js がステージされていなければ何もしない
    staged = git("diff", "--cached", "--name-only")
    if staged is None or TARGET not in staged.split():
        return 0

    head = git("show", "HEAD:" + TARGET)
    new = git("show", ":" + TARGET)  # インデックス（ステージ）側
    if head is None or new is None:
        return 0  # 初回コミットなど。比較対象が無いので黙って通す

    problems = []
    for const, op, cl, ver in CHECKS:
        old_lit = extract_literal(head, const, op, cl)
        new_lit = extract_literal(new, const, op, cl)
        if old_lit is None or new_lit is None or old_lit == new_lit:
            continue
        old_ver = extract_version(head, ver)
        new_ver = extract_version(new, ver)
        if old_ver is not None and old_ver == new_ver:
            problems.append((const, ver, new_ver))

    if not problems:
        return 0

    print("", file=sys.stderr)
    print("✋ コミットを中止しました: バージョン番号の上げ忘れです", file=sys.stderr)
    for const, ver, cur in problems:
        nxt = int(cur) + 1
        print("", file=sys.stderr)
        print("  %s を変更しましたが %s が %s のままです" % (const, ver, cur), file=sys.stderr)
        print("  → app.js の `const %s = %s;` を `= %d;` にしてください" % (ver, cur, nxt), file=sys.stderr)
    print("", file=sys.stderr)
    print("  上げないと、既存ユーザーのlocalStorageに残った古い設定が使われ続け、", file=sys.stderr)
    print("  エラーも出ないまま間違った数字が表示されます。", file=sys.stderr)
    print("", file=sys.stderr)
    print("  意図的に上げたくない場合のみ: git commit --no-verify", file=sys.stderr)
    print("", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())

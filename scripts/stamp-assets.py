#!/usr/bin/env python3
"""HTMLが読み込むCSS/JSに ?v=<内容ハッシュ> を付け直す（キャッシュバスティング）。

内容が変わったファイルだけURLが変わるので、スマホのブラウザが古いapp.jsを
使い続けることがなくなる。git の pre-commit フックから自動実行される。
"""

import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ["style.css", "reference.css", "menu.js", "app.js"]
HTML_FILES = ["index.html", "reference.html"]


def short_hash(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()[:8]


def main() -> int:
    hashes = {}
    for name in ASSETS:
        path = ROOT / name
        if path.exists():
            hashes[name] = short_hash(path.read_bytes())

    # 全アセットをまとめた版数（画面右下などに表示して、どの版を見ているか確認する用）
    combined = short_hash("".join(f"{k}:{v}" for k, v in sorted(hashes.items())).encode())

    changed = []
    for html_name in HTML_FILES:
        html_path = ROOT / html_name
        if not html_path.exists():
            continue
        original = html_path.read_text(encoding="utf-8")
        updated = original

        for name, digest in hashes.items():
            # href="./style.css" / href="./style.css?v=abc12345" のどちらにも対応
            pattern = re.compile(r'((?:href|src)="\./' + re.escape(name) + r')(?:\?v=[0-9a-f]+)?(")')
            updated = pattern.sub(lambda m: f"{m.group(1)}?v={digest}{m.group(2)}", updated)

        updated = re.sub(
            r'(<span id="app-version"[^>]*>)[^<]*(</span>)',
            lambda m: f"{m.group(1)}v{combined}{m.group(2)}",
            updated,
        )

        if updated != original:
            html_path.write_text(updated, encoding="utf-8")
            changed.append(html_name)

    print(f"stamp-assets: v{combined} " + (f"updated {', '.join(changed)}" if changed else "no change"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

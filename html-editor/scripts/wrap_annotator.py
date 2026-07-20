#!/usr/bin/env python3
"""
html-editor :: wrap_annotator.py

把标注交互层（annotator-inject.js）以"注入而非改写"的方式贴进任意 HTML：
读取原 HTML，把 JS 包成 <script data-annotator="true">，插到 </body> 前
（找不到则退到 </html> 前，再找不到就直接追加）。原页面结构与逻辑一字不动。

用法:
    python3 wrap_annotator.py <input.html> [-o output.html] [--force]

不带 -o 时，默认输出到 <input>.annotated.html（不覆盖原文件）。
若 -o 与输入相同则原地覆盖。

幂等：默认对已注入过的 HTML 不重复注入。
--force / --replace：识别页面里旧的标注层 <script data-annotator="true"> 及配套
<style data-annotator="true">，剥离后重新注入最新版本（用于技能升级后更新老页面）。
"""
import argparse
import os
import re
import sys

MARKER = 'data-annotator="true"'

# 匹配已注入的标注层 <script> / <style>（含 data-annotator 标记），用于 --force 剥离
_STRIP_RE = re.compile(
    r'\s*<(script|style)\b[^>]*\bdata-annotator=(?:"true"|\'true\')[^>]*>.*?</\1>',
    re.IGNORECASE | re.DOTALL,
)


def strip_injected(html):
    """移除页面中已注入的标注层 script/style，返回 (clean_html, removed_count)。"""
    new_html, n = _STRIP_RE.subn("", html)
    return new_html, n


def read_inject_js():
    here = os.path.dirname(os.path.abspath(__file__))
    # 脚本在 scripts/，JS 在 assets/
    candidates = [
        os.path.join(here, "..", "assets", "annotator-inject.js"),
        os.path.join(here, "annotator-inject.js"),
    ]
    for path in candidates:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
    raise FileNotFoundError(
        "找不到 annotator-inject.js（预期在 assets/ 下）"
    )


def build_snippet(js_code):
    # 用独立 <script> 标记，便于识别与后续剥离
    return "\n<script " + MARKER + ">\n" + js_code + "\n</script>\n"


def inject(html, snippet):
    # 幂等：已注入过则不重复
    if MARKER in html:
        return html, "already-injected"

    lower = html.lower()
    idx = lower.rfind("</body>")
    if idx != -1:
        return html[:idx] + snippet + html[idx:], "before-body"

    idx = lower.rfind("</html>")
    if idx != -1:
        return html[:idx] + snippet + html[idx:], "before-html"

    # 连 </html> 都没有：直接追加
    return html + snippet, "appended"


def main():
    ap = argparse.ArgumentParser(description="给任意 HTML 注入可视化标注层")
    ap.add_argument("input", help="输入 HTML 文件路径")
    ap.add_argument("-o", "--output", help="输出路径，默认 <input>.annotated.html")
    ap.add_argument(
        "-f", "--force", "--replace", dest="force", action="store_true",
        help="剥离页面里旧的标注层后重新注入最新版本（用于技能升级后更新老页面）",
    )
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        print("❌ 输入文件不存在: " + args.input, file=sys.stderr)
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        html = f.read()

    try:
        js_code = read_inject_js()
    except FileNotFoundError as e:
        print("❌ " + str(e), file=sys.stderr)
        sys.exit(1)

    stripped = 0
    if args.force and MARKER in html:
        html, stripped = strip_injected(html)

    snippet = build_snippet(js_code)
    result, mode = inject(html, snippet)

    if args.output:
        out = args.output
    else:
        root, ext = os.path.splitext(args.input)
        out = root + ".annotated" + (ext or ".html")

    with open(out, "w", encoding="utf-8") as f:
        f.write(result)

    if mode == "already-injected":
        print("ℹ️  该 HTML 已包含标注层，未重复注入（可加 --force 更新到最新版）-> " + out)
    elif stripped:
        print("♻️  已剥离 " + str(stripped) + " 处旧标注层并重新注入最新版（" + mode + "）-> " + out)
    else:
        print("✅ 已注入标注层（" + mode + "）-> " + out)


if __name__ == "__main__":
    main()

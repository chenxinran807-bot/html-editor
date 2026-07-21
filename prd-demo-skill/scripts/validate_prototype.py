#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prd-demo 原型确定性校验器（门禁 B-1）。

对可【静态判定】的门禁做真实、确定性校验：
  1. 合同 Schema 校验（contract.schema.json；无 jsonschema 库时降级为轻量必填/类型校验）
  2. DOM 追踪覆盖（合同 clause <-> HTML data-prd-clause 双向映射）
  3. 素材哈希（assets[] 文件 sha256 比对 + data-prd-asset-id 引用登记校验）
  4. 零外部依赖扫描（外部 http(s)/CDN、<script src=外部>、<link href=外部>、开发服务器/包管理器痕迹）

视觉（screenshot-diff）/ 交互（interaction-test）门禁需运行时（headless 浏览器），
本脚本【不执行】，统一输出 SKIPPED，并列出各 clause 期望的 metric/minimum(或 maximum)/viewport
供运行时校验器消费，绝不输出伪造的通过。

退出码：出现确定性违规（FAIL）-> 非 0；仅有 SKIPPED -> 0（打印警示）。

用法：
  python3 scripts/validate_prototype.py --contract <合同.json> --html <原型.html|目录>
"""

import argparse
import hashlib
import json
import os
import re
import sys
from html.parser import HTMLParser

# ---------------------------------------------------------------------------
# 结果收集
# ---------------------------------------------------------------------------
PASS, FAIL, SKIPPED = "PASS", "FAIL", "SKIPPED"

_ENUM_TYPE = ["locked", "guardrail", "open", "prohibited"]
_ENUM_CATEGORY = ["layout", "visual", "field", "behavior", "asset", "copy"]
_ENUM_METHOD = ["screenshot-diff", "attr-check", "hash-check", "interaction-test"]
_ENUM_SOURCE_KIND = ["manifest", "prd", "user-confirm"]
_ENUM_ASSET_TYPE = ["svg", "png", "image"]
_REGION_WILDCARDS = {
    "*", "whole-page", "wholepage", "whole page", "全页", "整页", "all", "全部",
}


class Results:
    def __init__(self):
        self.items = []

    def add(self, group, name, status, reason=""):
        self.items.append({"group": group, "name": name, "status": status, "reason": reason})

    def has_fail(self):
        return any(i["status"] == FAIL for i in self.items)

    def has_skipped(self):
        return any(i["status"] == SKIPPED for i in self.items)

    def counts(self):
        c = {PASS: 0, FAIL: 0, SKIPPED: 0}
        for i in self.items:
            c[i["status"]] += 1
        return c


# ---------------------------------------------------------------------------
# HTML 解析（标准库 html.parser，不依赖第三方）
# ---------------------------------------------------------------------------
class PrototypeHTMLParser(HTMLParser):
    """收集 data-prd-* 追踪属性与外部资源引用。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.clause_ids = set()        # data-prd-clause 出现的值
        self.asset_ids = set()         # data-prd-asset-id 出现的值
        self.external_refs = []        # (tag, attr, value)
        self._in_style = False
        self.style_text = []

    def handle_starttag(self, tag, attrs):
        d = {k.lower(): (v or "") for k, v in attrs}
        clause = d.get("data-prd-clause")
        if clause:
            self.clause_ids.add(clause.strip())
        asset = d.get("data-prd-asset-id")
        if asset:
            self.asset_ids.add(asset.strip())

        # 资源加载类属性：任意标签的 src、<link> 的 href
        src = d.get("src")
        if src and _is_external_url(src):
            self.external_refs.append((tag, "src", src))
        if tag == "link":
            href = d.get("href", "")
            if href and _is_external_url(href):
                self.external_refs.append((tag, "href", href))
        # 内联 style 属性中的 url()/@import
        style = d.get("style", "")
        if style:
            for u in _css_external_urls(style):
                self.external_refs.append((tag, "style", u))

        if tag == "style":
            self._in_style = True

    def handle_endtag(self, tag):
        if tag == "style":
            self._in_style = False

    def handle_data(self, data):
        if self._in_style and data.strip():
            self.style_text.append(data)


def _is_external_url(value):
    v = value.strip().lower()
    return v.startswith("http://") or v.startswith("https://") or v.startswith("//")


def _css_external_urls(css_text):
    found = []
    for m in re.finditer(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", css_text, re.IGNORECASE):
        if _is_external_url(m.group(1)):
            found.append(m.group(1))
    for m in re.finditer(r"@import\s+['\"]([^'\"]+)['\"]", css_text, re.IGNORECASE):
        if _is_external_url(m.group(1)):
            found.append(m.group(1))
    return found


# 高信号的开发服务器 / 包管理器痕迹（原文扫描）
_DEV_TRACE_PATTERNS = [
    r"webpack-dev-server",
    r"@vite/client",
    r"/node_modules/",
    r"https?://localhost[:/]",
    r"https?://127\.0\.0\.1[:/]",
    r"https?://0\.0\.0\.0[:/]",
]


def _scan_html_files(html_arg):
    """返回 [(path, text), ...]；接受单文件或目录。"""
    files = []
    if os.path.isdir(html_arg):
        for root, _dirs, names in os.walk(html_arg):
            for n in names:
                if n.lower().endswith((".html", ".htm")):
                    files.append(os.path.join(root, n))
    elif os.path.isfile(html_arg):
        files.append(html_arg)
    files.sort()
    out = []
    for p in files:
        with open(p, "r", encoding="utf-8", errors="replace") as f:
            out.append((p, f.read()))
    return out


# ---------------------------------------------------------------------------
# 合同 Schema 校验
# ---------------------------------------------------------------------------
def _load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_schema(contract, schema_path, results):
    """优先用 jsonschema + contract.schema.json；无库时降级轻量校验。"""
    try:
        import jsonschema  # noqa: F401
        have_lib = True
    except Exception:
        have_lib = False

    if have_lib and os.path.isfile(schema_path):
        import jsonschema
        try:
            schema = _load_json(schema_path)
        except Exception as e:
            results.add("SCHEMA", "load contract.schema.json", FAIL, "schema 文件解析失败: %s" % e)
            return
        validator = jsonschema.Draft202012Validator(schema)
        errors = sorted(validator.iter_errors(contract), key=lambda e: list(e.path))
        if not errors:
            results.add("SCHEMA", "contract.schema.json (jsonschema)", PASS,
                        "合同结构符合 JSON Schema")
        else:
            for err in errors[:50]:
                loc = "/".join(str(p) for p in err.path) or "<root>"
                results.add("SCHEMA", "contract@%s" % loc, FAIL, err.message)
        return

    # ---- 降级：轻量必填字段 + 类型校验（不 import 失败即崩） ----
    reason_note = "jsonschema 库不可用" if not have_lib else "未找到 contract.schema.json"
    results.add("SCHEMA", "mode", SKIPPED,
                "%s，降级为轻量必填/类型校验（非完整 JSON Schema）" % reason_note)
    _lightweight_schema_check(contract, results)


def _req(obj, key, typ, path, results):
    if key not in obj:
        results.add("SCHEMA", "%s.%s" % (path, key), FAIL, "缺少必填字段")
        return False
    if typ is not None and not isinstance(obj[key], typ):
        results.add("SCHEMA", "%s.%s" % (path, key), FAIL,
                    "类型应为 %s，实际 %s" % (typ, type(obj[key]).__name__))
        return False
    return True


def _lightweight_schema_check(c, results):
    ok = True
    if not isinstance(c, dict):
        results.add("SCHEMA", "<root>", FAIL, "合同根应为对象")
        return
    ok &= _req(c, "contractSchemaVersion", str, "contract", results)
    ok &= _req(c, "contractId", str, "contract", results)
    ok &= _req(c, "version", int, "contract", results)
    ok &= _req(c, "source", dict, "contract", results)
    ok &= _req(c, "designLanguage", dict, "contract", results)
    ok &= _req(c, "assets", list, "contract", results)
    ok &= _req(c, "clauses", list, "contract", results)

    dl = c.get("designLanguage")
    if isinstance(dl, dict):
        _req(dl, "official", dict, "designLanguage", results)
        _req(dl, "observed", list, "designLanguage", results)
        _req(dl, "inferred", list, "designLanguage", results)

    for i, a in enumerate(c.get("assets", []) or []):
        p = "assets[%d]" % i
        if not isinstance(a, dict):
            results.add("SCHEMA", p, FAIL, "应为对象"); continue
        for k in ("assetId", "file", "sha256", "type", "boundNode"):
            _req(a, k, str, p, results)
        if a.get("type") not in _ENUM_ASSET_TYPE:
            results.add("SCHEMA", p + ".type", FAIL,
                        "值应属于 %s" % _ENUM_ASSET_TYPE)

    for i, cl in enumerate(c.get("clauses", []) or []):
        p = "clauses[%d]" % i
        if not isinstance(cl, dict):
            results.add("SCHEMA", p, FAIL, "应为对象"); continue
        _req(cl, "clauseId", str, p, results)
        _req(cl, "assertion", str, p, results)
        if _req(cl, "type", str, p, results) and cl.get("type") not in _ENUM_TYPE:
            results.add("SCHEMA", p + ".type", FAIL, "值应属于 %s" % _ENUM_TYPE)
        if _req(cl, "category", str, p, results) and cl.get("category") not in _ENUM_CATEGORY:
            results.add("SCHEMA", p + ".category", FAIL, "值应属于 %s" % _ENUM_CATEGORY)
        if _req(cl, "source", dict, p, results):
            s = cl["source"]
            if _req(s, "kind", str, p + ".source", results) and s.get("kind") not in _ENUM_SOURCE_KIND:
                results.add("SCHEMA", p + ".source.kind", FAIL,
                            "值应属于 %s" % _ENUM_SOURCE_KIND)
            _req(s, "ref", str, p + ".source", results)
        if _req(cl, "verify", dict, p, results):
            v = cl["verify"]
            if _req(v, "method", str, p + ".verify", results) and v.get("method") not in _ENUM_METHOD:
                results.add("SCHEMA", p + ".verify.method", FAIL,
                            "值应属于 %s" % _ENUM_METHOD)
            _req(v, "params", dict, p + ".verify", results)
            if v.get("method") == "screenshot-diff":
                _lightweight_check_screenshot_params(v.get("params"), p + ".verify.params", results)

    # knownDiffs 结构化 + region 非通配
    for i, kd in enumerate(c.get("knownDiffs", []) or []):
        p = "knownDiffs[%d]" % i
        if not isinstance(kd, dict):
            results.add("SCHEMA", p, FAIL, "应为对象（结构化，不接受自由文本）"); continue
        for k in ("page", "region", "reason", "evidence"):
            _req(kd, k, str, p, results)
        _req(kd, "effectiveVersion", int, p, results)
        region = kd.get("region")
        if isinstance(region, str) and region.strip().lower() in _REGION_WILDCARDS:
            results.add("SCHEMA", p + ".region", FAIL,
                        "禁止整页豁免/通配区域: %r" % region)

    if ok:
        results.add("SCHEMA", "lightweight required/type check", PASS, "必填字段与基本类型校验通过")


def _lightweight_check_screenshot_params(params, path, results):
    if not isinstance(params, dict):
        results.add("SCHEMA", path, FAIL, "screenshot-diff params 应为对象"); return
    metric = params.get("metric")
    if metric not in ("ssim", "pixel-diff"):
        results.add("SCHEMA", path + ".metric", FAIL, "metric 应为 ssim 或 pixel-diff")
    vp = params.get("viewport")
    if not (isinstance(vp, dict) and "width" in vp and "height" in vp):
        results.add("SCHEMA", path + ".viewport", FAIL, "viewport 应为 {width,height} 对象")
    if not params.get("browser"):
        results.add("SCHEMA", path + ".browser", FAIL, "缺少 browser")
    if metric == "ssim":
        if "minimum" not in params:
            results.add("SCHEMA", path + ".minimum", FAIL, "ssim 模式需 minimum")
        if "maximum" in params:
            results.add("SCHEMA", path + ".maximum", FAIL, "ssim 模式不应出现 maximum")
    elif metric == "pixel-diff":
        if "maximum" not in params:
            results.add("SCHEMA", path + ".maximum", FAIL, "pixel-diff 模式需 maximum")
        if "minimum" in params:
            results.add("SCHEMA", path + ".minimum", FAIL, "pixel-diff 模式不应出现 minimum")


# ---------------------------------------------------------------------------
# DOM 追踪覆盖
# ---------------------------------------------------------------------------
def _clause_has_dom_target(clause):
    """默认所有 clause 都有 DOM 目标；可用 domTarget=false 或 na=true 显式豁免。"""
    if clause.get("domTarget") is False:
        return False
    if clause.get("na") is True:
        return False
    return True


def validate_dom_tracking(contract, html_files, results):
    html_clause_ids = set()
    for _p, text in html_files:
        parser = PrototypeHTMLParser()
        parser.feed(text)
        html_clause_ids |= parser.clause_ids

    contract_clause_ids = {cl.get("clauseId") for cl in contract.get("clauses", []) if cl.get("clauseId")}

    # 1) 每个有 DOM 目标的 clause 都能在 HTML 找到 data-prd-clause
    missing = []
    for cl in contract.get("clauses", []):
        cid = cl.get("clauseId")
        if not cid:
            continue
        if _clause_has_dom_target(cl) and cid not in html_clause_ids:
            missing.append(cid)
    if missing:
        results.add("DOM-TRACKING", "clause->DOM 覆盖", FAIL,
                    "以下 clause 未在 HTML 找到 data-prd-clause: %s" % ", ".join(sorted(missing)))
    else:
        results.add("DOM-TRACKING", "clause->DOM 覆盖", PASS,
                    "有 DOM 目标的 clause 均已在 HTML 出现")

    # 2) 每个 data-prd-clause 都能映射到合同 clauseId
    orphan = sorted(html_clause_ids - contract_clause_ids)
    if orphan:
        results.add("DOM-TRACKING", "DOM->clause 映射", FAIL,
                    "以下 data-prd-clause 在合同中找不到 clauseId: %s" % ", ".join(orphan))
    else:
        results.add("DOM-TRACKING", "DOM->clause 映射", PASS,
                    "全部 data-prd-clause 均可映射到合同 clauseId")


# ---------------------------------------------------------------------------
# 素材哈希
# ---------------------------------------------------------------------------
_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def _norm_sha256(value):
    v = (value or "").strip().lower()
    if v.startswith("sha256:"):
        v = v[len("sha256:"):]
    return v


def validate_assets(contract, html_files, html_arg, results):
    assets = contract.get("assets", []) or []
    base_dir = html_arg if os.path.isdir(html_arg) else os.path.dirname(os.path.abspath(html_arg))

    registered_ids = set()
    for a in assets:
        aid = a.get("assetId")
        registered_ids.add(aid)
        rel = a.get("file", "")
        registered = _norm_sha256(a.get("sha256", ""))
        fpath = os.path.join(base_dir, rel)
        if not registered or not _HEX64.match(registered):
            results.add("ASSET-HASH", "asset %s" % aid, FAIL,
                        "登记 sha256 非法或为占位: %r" % a.get("sha256"))
            continue
        if not os.path.isfile(fpath):
            results.add("ASSET-HASH", "asset %s" % aid, FAIL,
                        "素材文件缺失: %s" % rel)
            continue
        actual = hashlib.sha256(open(fpath, "rb").read()).hexdigest()
        if actual == registered:
            results.add("ASSET-HASH", "asset %s" % aid, PASS, "sha256 一致 (%s)" % rel)
        else:
            results.add("ASSET-HASH", "asset %s" % aid, FAIL,
                        "sha256 不符 %s: 登记 %s / 实际 %s" % (rel, registered, actual))

    # HTML 中 data-prd-asset-id 引用必须是已登记 assetId
    html_asset_ids = set()
    for _p, text in html_files:
        parser = PrototypeHTMLParser()
        parser.feed(text)
        html_asset_ids |= parser.asset_ids
    orphan = sorted(html_asset_ids - registered_ids)
    if orphan:
        results.add("ASSET-HASH", "data-prd-asset-id 引用", FAIL,
                    "以下 data-prd-asset-id 未登记于 assets[]: %s" % ", ".join(orphan))
    elif html_asset_ids:
        results.add("ASSET-HASH", "data-prd-asset-id 引用", PASS,
                    "全部 data-prd-asset-id 均已登记")


# ---------------------------------------------------------------------------
# 零外部依赖扫描
# ---------------------------------------------------------------------------
def validate_no_external_deps(html_files, results):
    any_violation = False
    for path, text in html_files:
        parser = PrototypeHTMLParser()
        parser.feed(text)
        for tag, attr, val in parser.external_refs:
            any_violation = True
            results.add("EXTERNAL-DEPS", os.path.basename(path), FAIL,
                        "外部引用 <%s %s=\"%s\">" % (tag, attr, val))
        # <style> 内 CSS 外链
        for css in parser.style_text:
            for u in _css_external_urls(css):
                any_violation = True
                results.add("EXTERNAL-DEPS", os.path.basename(path), FAIL,
                            "<style> 中外部引用: %s" % u)
        # 开发服务器 / 包管理器痕迹
        for pat in _DEV_TRACE_PATTERNS:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                any_violation = True
                results.add("EXTERNAL-DEPS", os.path.basename(path), FAIL,
                            "发现开发服务器/包管理器痕迹: %s" % m.group(0))
    if not any_violation:
        results.add("EXTERNAL-DEPS", "zero-runtime-dep scan", PASS,
                    "未发现外部 http(s)/CDN 引用或开发服务器痕迹")


# ---------------------------------------------------------------------------
# 运行时门禁：SKIPPED（不执行，列出期望供运行时校验器消费）
# ---------------------------------------------------------------------------
def report_runtime_gates(contract, results):
    for cl in contract.get("clauses", []):
        cid = cl.get("clauseId", "?")
        v = cl.get("verify", {}) or {}
        method = v.get("method")
        params = v.get("params", {}) or {}
        if method == "screenshot-diff":
            metric = params.get("metric")
            thr = ("minimum=%s" % params.get("minimum")) if metric == "ssim" \
                else ("maximum=%s" % params.get("maximum"))
            vp = params.get("viewport", {})
            vp_s = "%sx%s" % (vp.get("width"), vp.get("height")) if isinstance(vp, dict) else vp
            results.add("VISUAL(screenshot-diff)", cid, SKIPPED,
                        "requires runtime (headless browser); 期望 metric=%s %s viewport=%s browser=%s"
                        % (metric, thr, vp_s, params.get("browser")))
        elif method == "interaction-test":
            results.add("INTERACTION(interaction-test)", cid, SKIPPED,
                        "requires runtime (headless browser); trigger=%s expect=%s"
                        % (params.get("trigger"), params.get("expect")))


# ---------------------------------------------------------------------------
# 输出
# ---------------------------------------------------------------------------
def print_report(results):
    groups = {}
    for i in results.items:
        groups.setdefault(i["group"], []).append(i)
    print("=" * 72)
    print("prd-demo 原型确定性校验（门禁 B-1）+ 运行时门禁清单（B-2, SKIPPED）")
    print("=" * 72)
    for g in groups:
        print("\n[%s]" % g)
        for i in groups[g]:
            line = "  %-8s %s" % (i["status"], i["name"])
            if i["reason"]:
                line += "  — " + i["reason"]
            print(line)
    c = results.counts()
    print("\n" + "-" * 72)
    print("汇总: PASS=%d  FAIL=%d  SKIPPED=%d" % (c[PASS], c[FAIL], c[SKIPPED]))
    if c[FAIL]:
        print("结果: 存在确定性违规（FAIL），退出码非 0。")
    elif c[SKIPPED]:
        print("警示: 确定性项全部通过；视觉/交互门禁为 SKIPPED，需运行时（headless）校验后方可判定还原是否达标。")
    else:
        print("结果: 全部确定性项通过。")


def main():
    ap = argparse.ArgumentParser(description="prd-demo 原型确定性校验器（门禁 B-1）")
    ap.add_argument("--contract", required=True, help="合同 JSON 路径")
    ap.add_argument("--html", required=True, help="原型 HTML 文件或目录")
    ap.add_argument("--schema", default=None,
                    help="contract.schema.json 路径（默认取脚本同级 ../references/contract.schema.json）")
    args = ap.parse_args()

    if not os.path.exists(args.contract):
        print("错误: 合同文件不存在: %s" % args.contract, file=sys.stderr)
        return 2
    if not os.path.exists(args.html):
        print("错误: HTML 路径不存在: %s" % args.html, file=sys.stderr)
        return 2

    try:
        contract = _load_json(args.contract)
    except Exception as e:
        print("错误: 合同 JSON 解析失败: %s" % e, file=sys.stderr)
        return 2

    schema_path = args.schema or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "references", "contract.schema.json")

    html_files = _scan_html_files(args.html)
    results = Results()

    if not html_files:
        results.add("DOM-TRACKING", "html 输入", FAIL, "未找到任何 .html 文件: %s" % args.html)

    validate_schema(contract, schema_path, results)
    if html_files:
        validate_dom_tracking(contract, html_files, results)
        validate_assets(contract, html_files, args.html, results)
        validate_no_external_deps(html_files, results)
    report_runtime_gates(contract, results)

    print_report(results)
    return 1 if results.has_fail() else 0


if __name__ == "__main__":
    sys.exit(main())

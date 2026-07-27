#!/usr/bin/env python3
"""Deterministic gates for prd-demo visual exploration, flow, and QA."""

import argparse
import json
import os
import pathlib
import re
import shutil
import struct
import subprocess
import tempfile
from urllib.parse import urlparse


QA_LAYERS = {"visual-fidelity", "requirements-fidelity", "interaction-flow"}
SEVERITIES = {"P0", "P1", "P2", "P3"}
FINDING_FIELDS = {
    "target",
    "reference",
    "layer",
    "severity",
    "issue",
    "expected",
    "actual",
    "action",
}


class PipelineValidationError(ValueError):
    """Pipeline artifact does not satisfy a hard gate."""


def visual_strategy(has_explicit_target, redesign_requested):
    return "reference-led" if has_explicit_target and not redesign_requested else "explore"


def validate_visual_options(options, width, height):
    if len(options) != 3:
        raise PipelineValidationError("视觉探索必须提供恰好 3 个方案")
    identifiers = [item.get("id") for item in options]
    if len(set(identifiers)) != 3 or any(not value for value in identifiers):
        raise PipelineValidationError("视觉方案 ID 必须存在且唯一")
    for item in options:
        if not item.get("artifact"):
            raise PipelineValidationError("视觉方案缺少可查看产物")
        if item.get("width") != width or item.get("height") != height:
            raise PipelineValidationError("视觉方案视口不一致")
    return options


def _png_dimensions(path):
    data = pathlib.Path(path).read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise PipelineValidationError(f"不支持或损坏的视觉产物: {path}")
    return struct.unpack(">II", data[16:24])


def validate_visual_option_files(options, base_dir, width, height):
    validate_visual_options(options, width, height)
    root = pathlib.Path(base_dir).resolve()
    for item in options:
        artifact = (root / item["artifact"]).resolve()
        if root not in artifact.parents:
            raise PipelineValidationError("视觉产物路径越界")
        if not artifact.is_file():
            raise PipelineValidationError(f"视觉产物不存在: {item['artifact']}")
        actual = _png_dimensions(artifact)
        if actual != (width, height):
            raise PipelineValidationError(
                f"方案 {item['id']} 真实尺寸为 {actual[0]}×{actual[1]}，"
                f"要求 {width}×{height}"
            )
    return options


def validate_flow(flow):
    if flow.get("schemaVersion") != "1.0" or not flow.get("nodes"):
        raise PipelineValidationError("flow.json 结构无效")
    presentation = flow.get("presentation") or {}
    if (
        presentation.get("type") != "visual-flow"
        or not presentation.get("artifact")
        or not presentation.get("layout")
    ):
        raise PipelineValidationError("flow.json 缺少可视化动线产物")
    identifiers = [node.get("id") for node in flow["nodes"]]
    if any(not value for value in identifiers) or len(set(identifiers)) != len(identifiers):
        raise PipelineValidationError("flow 节点 ID 必须存在且唯一")
    for node in flow["nodes"]:
        if not node.get("thumbnail"):
            raise PipelineValidationError(f"节点 {node['id']} 缺少缩略图")
        if not node.get("visualBindings"):
            raise PipelineValidationError(f"节点 {node['id']} 缺少 visualBindings")
        if node.get("confirmation") != "confirmed":
            raise PipelineValidationError(f"节点 {node['id']} 尚未确认")
    events = flow.get("confirmationEvents") or []
    confirmed_ids = {event.get("nodeId") for event in events}
    if confirmed_ids != set(identifiers):
        raise PipelineValidationError("节点确认缺少独立用户确认事件")
    return flow


def _is_openable_url(value):
    if not isinstance(value, str) or not value.strip() or value.strip() == "#":
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme in {"https", "http", "file"} and bool(
        parsed.netloc or parsed.scheme == "file"
    )


def validate_delivery(delivery):
    """Require final handoff links to point to real artifacts, never placeholders."""
    for field in ("prototypeUrl", "flowUrl"):
        if not _is_openable_url(delivery.get(field)):
            raise PipelineValidationError(f"{field} 必须是真实可打开链接，禁止 # 或缺失")
    return delivery


def confirm_flow_node(flow, node_id, user_message_id):
    if not user_message_id:
        raise PipelineValidationError("确认节点必须绑定用户消息")
    events = flow.setdefault("confirmationEvents", [])
    if any(event.get("userMessageId") == user_message_id for event in events):
        raise PipelineValidationError("一条用户消息只能确认一个节点")
    matches = [node for node in flow.get("nodes", []) if node.get("id") == node_id]
    if len(matches) != 1:
        raise PipelineValidationError(f"未知 flow 节点: {node_id}")
    node = matches[0]
    if node.get("confirmation") == "confirmed":
        raise PipelineValidationError(f"节点 {node_id} 已确认")
    node["confirmation"] = "confirmed"
    events.append({"nodeId": node_id, "userMessageId": user_message_id})
    return flow


def _write_json_atomic(path, value):
    target = pathlib.Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".tmp", dir=target.parent
    )
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as output:
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def confirm_flow_file(path, node_id, user_message_id):
    flow_path = pathlib.Path(path)
    flow = json.loads(flow_path.read_text(encoding="utf-8"))
    confirm_flow_node(flow, node_id, user_message_id)
    _write_json_atomic(flow_path, flow)
    pending = [
        node for node in flow.get("nodes", [])
        if node.get("confirmation") != "confirmed"
    ]
    return {
        "confirmedNodeId": node_id,
        "confirmedCount": len(flow.get("nodes", [])) - len(pending),
        "totalCount": len(flow.get("nodes", [])),
        "nextNode": pending[0] if pending else None,
        "allConfirmed": not pending,
    }


def check_browser_runtime(executable=None, timeout=10):
    browser = executable or next(
        (
            shutil.which(candidate)
            for candidate in ("chromium", "chromium-browser", "google-chrome", "chrome")
            if shutil.which(candidate)
        ),
        None,
    )
    if not browser:
        raise PipelineValidationError(
            "真实浏览器运行时不可用；禁止临时安装依赖或用 jsdom 冒充浏览器 QA"
        )
    command = [
        browser,
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--dump-dom",
        "data:text/html,<title>prd-demo-qa</title><main>OK</main>",
    ]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PipelineValidationError(
            f"真实浏览器启动失败: {error}; 禁止降级为 jsdom"
        ) from error
    if result.returncode != 0 or "OK" not in result.stdout:
        detail = (result.stderr or result.stdout or "unknown error").strip()
        raise PipelineValidationError(
            f"真实浏览器启动失败 (exit {result.returncode}): {detail[:400]}"
        )
    return {"browserExecutable": browser, "launchSucceeded": True}


def _validate_findings(findings):
    for finding in findings:
        missing = sorted(FINDING_FIELDS - set(finding))
        if missing:
            raise PipelineValidationError(f"QA finding 缺少字段: {', '.join(missing)}")
        if finding["layer"] not in QA_LAYERS:
            raise PipelineValidationError(f"未知 QA 层: {finding['layer']}")
        if finding["severity"] not in SEVERITIES:
            raise PipelineValidationError(f"未知严重程度: {finding['severity']}")


def validate_qa_report(report):
    """Require visual QA to be backed by normalized rendered screenshots."""
    if report.get("schemaVersion") != "1.0":
        raise PipelineValidationError("QA 报告版本无效")
    environment = report.get("environment") or {}
    viewport = environment.get("viewport") or {}
    if not (
        isinstance(viewport.get("width"), int)
        and isinstance(viewport.get("height"), int)
        and viewport["width"] > 0
        and viewport["height"] > 0
    ):
        raise PipelineValidationError("QA 缺少固定视口")
    for field in ("page", "state", "scroll"):
        if field not in environment:
            raise PipelineValidationError(f"QA 环境缺少 {field}")
    for field in ("fontsReady", "imagesReady", "animationsPaused"):
        if environment.get(field) is not True:
            raise PipelineValidationError(f"QA 环境未稳定: {field}")
    if environment.get("editorHidden") is not True:
        raise PipelineValidationError("视觉比较前必须隐藏 html-editor")
    comparisons = report.get("comparisons") or []
    if not comparisons:
        raise PipelineValidationError("QA 缺少真实渲染视觉比较")
    for comparison in comparisons:
        if comparison.get("method") != "rendered-screenshot":
            raise PipelineValidationError("视觉比较必须使用真实渲染截图")
        if not comparison.get("target") or not comparison.get("reference"):
            raise PipelineValidationError("视觉比较缺少目标或视觉基准")
        if not comparison.get("actualScreenshot"):
            raise PipelineValidationError("视觉比较缺少实现截图")
        reference_hash = comparison.get("referenceSha256")
        confirmed_hash = comparison.get("confirmedReferenceSha256")
        if not (
            isinstance(reference_hash, str)
            and re.fullmatch(r"[0-9a-fA-F]{64}", reference_hash)
            and isinstance(confirmed_hash, str)
            and re.fullmatch(r"[0-9a-fA-F]{64}", confirmed_hash)
            and comparison.get("confirmedByUserMessageId")
        ):
            raise PipelineValidationError("视觉比较缺少用户确认时的基准哈希")
        if reference_hash.lower() != confirmed_hash.lower():
            raise PipelineValidationError("视觉基准确认后发生变化，必须重新请用户确认")
    post_injection = report.get("postInjection") or {}
    if not (
        post_injection.get("editorInjected") is True
        and post_injection.get("interactionRetested") is True
        and post_injection.get("coreActionsPassed") is True
        and post_injection.get("evidenceScreenshot")
    ):
        raise PipelineValidationError("html-editor 注入后必须重新运行核心交互并保存证据")
    _validate_findings(report.get("findings") or [])
    return report


def finding_signature(finding):
    return "|".join(
        str(finding[key]) for key in ("layer", "severity", "target", "issue")
    )


def decide_qa_action(findings, round_number, previous_signatures=None):
    if round_number not in (1, 2, 3):
        raise PipelineValidationError("QA 轮次必须为 1–3")
    _validate_findings(findings)
    if not findings:
        return "pass"
    severities = {item["severity"] for item in findings}
    current_signatures = {finding_signature(item) for item in findings}
    repeated = bool(current_signatures & set(previous_signatures or ()))
    if severities & {"P0", "P1"}:
        return "blocked" if round_number == 3 or repeated else "fix-batch"
    if "P2" in severities and round_number < 3:
        return "fix-batch"
    return "pass-with-notes"


def main():
    parser = argparse.ArgumentParser(description="prd-demo pipeline gates")
    subparsers = parser.add_subparsers(dest="command", required=True)
    visual = subparsers.add_parser("validate-visual")
    visual.add_argument("manifest")
    visual.add_argument("--width", type=int, required=True)
    visual.add_argument("--height", type=int, required=True)
    flow = subparsers.add_parser("validate-flow")
    flow.add_argument("flow")
    confirm = subparsers.add_parser("confirm-flow")
    confirm.add_argument("flow")
    confirm.add_argument("--node", required=True)
    confirm.add_argument("--message-id", required=True)
    browser = subparsers.add_parser("check-browser")
    browser.add_argument("--executable")
    browser.add_argument("--timeout", type=int, default=10)
    args = parser.parse_args()
    try:
        if args.command == "validate-visual":
            manifest = pathlib.Path(args.manifest)
            options = json.loads(manifest.read_text(encoding="utf-8"))
            validate_visual_option_files(options, manifest.parent, args.width, args.height)
            print("OK: 3 visual options have valid real PNG dimensions")
        elif args.command == "validate-flow":
            flow_path = pathlib.Path(args.flow)
            validate_flow(json.loads(flow_path.read_text(encoding="utf-8")))
            print("OK: all flow nodes have independent confirmations")
        elif args.command == "confirm-flow":
            print(json.dumps(
                confirm_flow_file(args.flow, args.node, args.message_id),
                ensure_ascii=False,
            ))
        elif args.command == "check-browser":
            print(json.dumps(
                check_browser_runtime(args.executable, args.timeout),
                ensure_ascii=False,
            ))
    except (PipelineValidationError, json.JSONDecodeError, OSError) as error:
        parser.exit(1, f"ERROR: {error}\n")


if __name__ == "__main__":
    main()

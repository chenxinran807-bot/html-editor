#!/usr/bin/env python3
"""Persistent one-question-at-a-time state for the prd-demo workflow."""

import copy
import hashlib
import json
import os
import re
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path


CORE_QUESTIONS = ("pageScope", "primaryFlow", "frameBindings")
PHASES = {"confirming", "ready-to-generate", "generated", "receipt-written"}


class Conflict(ValueError):
    """A new answer conflicts with an already confirmed decision."""


def fingerprint_prd(text):
    lines = str(text).replace("\r\n", "\n").replace("\r", "\n").split("\n")
    normalized = "\n".join(line.rstrip() for line in lines).strip() + "\n"
    return "sha256:" + hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def new_session_id():
    return str(uuid.uuid4())


def _validate_prd_fingerprint(value):
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", value or ""):
        raise ValueError("prdFingerprint 格式错误")


@dataclass
class WorkflowState:
    schemaVersion: str
    sessionId: str
    taskId: str
    prdFingerprint: str
    answers: dict = field(default_factory=dict)
    additionalQuestions: list = field(default_factory=list)
    phase: str = "confirming"

    def __post_init__(self):
        if self.schemaVersion != "1.0":
            raise ValueError(f"不支持的 workflow schema: {self.schemaVersion}")
        if self.phase not in PHASES:
            raise ValueError(f"未知 workflow phase: {self.phase}")
        if not self.taskId:
            raise ValueError("taskId 不能为空")
        _validate_prd_fingerprint(self.prdFingerprint)

    @classmethod
    def create(cls, session_id, task_id, prd_fingerprint):
        return cls("1.0", session_id, task_id, prd_fingerprint)

    @classmethod
    def load(cls, path):
        try:
            payload = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"workflow state 无法读取: {error}") from error
        return cls(**payload)

    def save(self, root):
        if not re.fullmatch(r"[0-9A-Za-z._-]+", self.sessionId):
            raise ValueError("sessionId 含不安全字符")
        directory = Path(root) / "workflow-state"
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / f"{self.sessionId}.json"
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(asdict(self), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary, target)
        return target

    def ordered_questions(self):
        return CORE_QUESTIONS + tuple(item["key"] for item in self.additionalQuestions)

    def next_question(self):
        for key in self.ordered_questions():
            if key not in self.answers:
                return key
        return None

    def confirm(self, key, value, replace=False):
        if key in self.answers and self.answers[key] != value and not replace:
            raise Conflict(f"{key} 已确认；冲突答案必须显式 replace")
        expected = self.next_question()
        if key not in self.answers and key != expected:
            raise ValueError(f"当前必须先确认 {expected}")
        self.answers[key] = copy.deepcopy(value)
        self.phase = "ready-to-generate" if self.next_question() is None else "confirming"

    def add_question(self, key, prompt, evidence):
        if key in CORE_QUESTIONS or any(item["key"] == key for item in self.additionalQuestions):
            raise ValueError(f"问题键重复: {key}")
        if not key or not prompt or not evidence:
            raise ValueError("追加问题必须包含 key、prompt 和 evidence")
        self.additionalQuestions.append({"key": key, "prompt": prompt, "evidence": evidence})
        self.phase = "confirming"

    def change_prd(self, new_fingerprint, affected):
        _validate_prd_fingerprint(new_fingerprint)
        allowed = set(self.ordered_questions())
        unknown = set(affected) - allowed
        if unknown:
            raise ValueError(f"未知受影响决策: {sorted(unknown)}")
        self.prdFingerprint = new_fingerprint
        for key in affected:
            self.answers.pop(key, None)
        self.phase = "confirming" if self.next_question() else "ready-to-generate"

    def mark_generated(self):
        if self.phase != "ready-to-generate":
            raise ValueError("核心确认未完成，不能生成")
        self.phase = "generated"

    def mark_receipt_written(self):
        if self.phase != "generated":
            raise ValueError("Demo 尚未生成，不能写消费回执")
        self.phase = "receipt-written"


def build_receipt(state, agent_user_open_id, result, consumed_at):
    if state.phase != "generated":
        raise ValueError("Demo 尚未生成，不能构造消费回执")
    if not agent_user_open_id or not consumed_at:
        raise ValueError("消费回执缺少 Agent 用户或时间")
    return {
        "consumptionSchemaVersion": "1.0",
        "sessionId": state.sessionId,
        "taskId": state.taskId,
        "prdFingerprint": state.prdFingerprint,
        "agentUserOpenId": agent_user_open_id,
        "consumedAt": consumed_at,
        "result": copy.deepcopy(result),
        "decisions": {
            "pageScope": copy.deepcopy(state.answers["pageScope"]),
            "primaryFlow": copy.deepcopy(state.answers["primaryFlow"]),
            "frameBindings": copy.deepcopy(state.answers["frameBindings"]),
        },
    }

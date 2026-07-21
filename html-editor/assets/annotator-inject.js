/*
 * html-editor :: annotator-inject.js
 * 寄生式无侵入标注交互层。整体用 IIFE 自执行，不向全局作用域写任何变量。
 * 所有 DOM 类名统一 `annotator-` 前缀、id 统一 `ann-` 前缀，避免与用户页面冲突。
 * 设计目标：让用户在任意 HTML 预览里点选元素 / 拖拽框选区域 + 写批注，
 * 导出成 AI 可解析的结构化文本。
 *
 * v1.2.0：
 *  - 拖拽框选区域（rubber-band）：框住一片区域，自动识别区域内元素 + 公共容器
 *  - 移动端触摸支持：Pointer 事件统一鼠标/触摸/手写笔
 * v1.1.0：
 *  - localStorage 持久化（刷新/切页不丢，按页面路径隔离）
 *  - 「清空全部」按钮、批注可编辑
 *  - 导出附带页面标题/URL + 每条元素 outerHTML 片段
 *  - 批注输入框点击外部关闭、全局 Esc 退出标注模式
 */
(function () {
  "use strict";

  // 防止对同一页面重复注入
  if (window.__ANNOTATOR_LOADED__) return;
  window.__ANNOTATOR_LOADED__ = true;

  var STORAGE_KEY = "ann::" + (location.pathname || "/") + (location.search || "");
  var DRAG_THRESHOLD = 8; // 位移超过此像素判定为"拖拽框选"，否则为"点选"

  var annotations = []; // { id, type:'element'|'region', selector, tag, text, note, page, snippet, el, members, rectDoc }
  var seq = 0;
  var active = false;   // 是否处于标注模式
  var hoverEl = null;   // 当前 hover 的用户元素

  // 指针拖拽状态
  var pointerDown = false;
  var previewDraft = null;
  var dragging = false;
  var startX = 0, startY = 0;
  var dragBox = null;

  // ---------- 统一图标：内联 SVG，不依赖字体或网络 ----------
  function iconSvg(name) {
    var paths = {
      add: '<path d="M12 5v14M5 12h14"/>',
      list: '<path d="M5 7h14M5 12h14M5 17h10"/>',
      done: '<path d="m5 12 4 4L19 6"/>',
      close: '<path d="m7 7 10 10M17 7 7 17"/>',
      text: '<path d="M4 6h16M8 6v12M5 18h6"/>',
      image: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m5 17 5-5 4 4 2-2 3 3"/>',
      resize: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
      reference: '<path d="M4 15 15 4l5 5L9 20H4v-5Z"/><path d="m13 6 5 5"/>',
      attach: '<path d="m20 12-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24">' + (paths[name] || paths.add) + '</svg>';
  }

  // ---------- 工具：判断是否为标注层自身元素（避免自己点自己） ----------
  function isAnnotatorElement(el) {
    while (el) {
      if (el.nodeType === 1) {
        if (el.getAttribute && el.getAttribute("data-annotator") === "true") return true;
        if (el.id && el.id.indexOf("ann-") === 0) return true;
        if (el.classList) {
          for (var i = 0; i < el.classList.length; i++) {
            var c = el.classList[i];
            if (c.indexOf("annotator-") === 0 && c !== "annotator-hl") return true;
          }
        }
      }
      el = el.parentNode;
    }
    return false;
  }

  // ---------- 核心：生成稳定唯一的 CSS 选择器 ----------
  function computeSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id && el.id.indexOf("ann-") !== 0) {
      return "#" + cssEscape(el.id);
    }
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== "html") {
      var tag = node.tagName.toLowerCase();
      if (node.id && node.id.indexOf("ann-") !== 0) {
        parts.unshift("#" + cssEscape(node.id));
        break;
      }
      var seg = tag;
      var parent = node.parentNode;
      if (parent) {
        var sameTag = [];
        var kids = parent.children;
        for (var i = 0; i < kids.length; i++) {
          if (kids[i].tagName && kids[i].tagName.toLowerCase() === tag) sameTag.push(kids[i]);
        }
        if (sameTag.length > 1) {
          var idx = sameTag.indexOf(node) + 1;
          seg += ":nth-of-type(" + idx + ")";
        }
      }
      parts.unshift(seg);
      node = parent;
    }
    return parts.join(" > ");
  }

  function cssEscape(s) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(s);
    return String(s).replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }

  function shortText(el) {
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (t.length > 40) t = t.slice(0, 40) + "…";
    return t;
  }

  function snippetOf(el) {
    if (!el || !el.outerHTML) return "";
    var html = el.outerHTML;
    html = html.replace(/\s*class="([^"]*)"/, function (m, cls) {
      var kept = cls.split(/\s+/).filter(function (c) { return c && c !== "annotator-hl"; });
      return kept.length ? ' class="' + kept.join(" ") + '"' : "";
    });
    html = html.replace(/\s+/g, " ").trim();
    if (html.length > 220) html = html.slice(0, 220) + "…";
    return html;
  }

  function describeElement(el) {
    if (!el) return "页面内容";
    var text = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
    var tag = (el.tagName || "").toUpperCase();
    var role = tag === "IMG" ? "图片" : tag === "BUTTON" ? "按钮" : tag === "A" ? "链接" : "页面内容";
    return text ? role + "“" + text.slice(0, 24) + "”" : role;
  }

  function currentPage() {
    var p = document.querySelector("[data-prd-page].active, .page.active");
    if (p) return p.getAttribute("data-prd-page") || p.id || p.getAttribute("data-page") || "page";
    return "";
  }

  function closestAttribute(el, name) {
    var node = el;
    while (node && node.nodeType === 1) {
      var value = node.getAttribute && node.getAttribute(name);
      if (value) return { node: node, value: value };
      node = node.parentElement;
    }
    return null;
  }

  function attributeSelector(name, value) {
    var escaped = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return "[" + name + '=\"' + escaped + '\"]';
  }

  function targetMetadata(el, fallbackSelector) {
    var clause = closestAttribute(el, "data-prd-clause");
    var page = closestAttribute(el, "data-prd-page");
    return {
      targetClauseId: clause ? clause.value : null,
      targetPageId: page ? page.value : null,
      targetNodeSelector: clause ? attributeSelector("data-prd-clause", clause.value) : fallbackSelector
    };
  }

  function workflowContext() {
    var node = document.querySelector('meta[name="prd-demo-workflow"]');
    return {
      taskId: node ? node.getAttribute("data-task-id") || "" : "",
      sessionId: node ? node.getAttribute("data-session-id") || "" : "",
      prdFingerprint: node ? node.getAttribute("data-prd-fingerprint") || "" : ""
    };
  }

  // ---------- 持久化 ----------
  function buildSaveData(includeDataURL) {
    return annotations.map(function (a) {
      return {
        id: a.id, type: a.type || "element", selector: a.selector, tag: a.tag,
        text: a.text, note: a.note, page: a.page, snippet: a.snippet,
        targetClauseId: a.targetClauseId || null,
        targetPageId: a.targetPageId || null,
        targetNodeSelector: a.targetNodeSelector || a.selector,
        members: a.members, rectDoc: a.rectDoc,
        refs: (a.refs || []).map(function (r) {
          return includeDataURL ? { name: r.name, dataURL: r.dataURL } : { name: r.name };
        })
      };
    });
  }
  function save() {
    try {
      // 优先连同参考图 dataURL 一起持久化，刷新后缩略图/下载不丢
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ seq: seq, items: buildSaveData(true) }));
    } catch (e) {
      // 超出配额（参考图过大）时降级：只存文件名，避免整体保存失败
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ seq: seq, items: buildSaveData(false) }));
      } catch (e2) { /* 沙箱/隐私模式禁用 localStorage，静默降级 */ }
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var obj = JSON.parse(raw);
      if (!obj || !obj.items) return;
      seq = obj.seq || 0;
      annotations = obj.items.map(function (a) {
        if (!a.type) a.type = "element";
        if (a.type === "element") {
          var el = null;
          try { el = document.querySelector(a.selector); } catch (e2) { el = null; }
          a.el = el;
        }
        return a;
      });
    } catch (e) { /* 忽略解析失败 */ }
  }

  // ---------- 样式注入 ----------
  function injectStyle() {
    var css = [
      ":root{--ann-accent:#0A84FF;--ann-danger:#FF453A;--ann-text:#1D1D1F;--ann-secondary:#6E6E73;--ann-border:rgba(0,0,0,.13);--ann-surface:rgba(249,249,250,.96);}",
      "[data-annotator=\"true\"]{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC',sans-serif;-webkit-font-smoothing:antialiased;}",
      "[data-annotator=\"true\"] svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}",
      "#ann-inspector{position:fixed;z-index:2147483200;width:336px;box-sizing:border-box;padding:0;background:var(--ann-surface);border:1px solid var(--ann-border);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.24),0 1px 2px rgba(0,0,0,.08);overflow:hidden;color:var(--ann-text);backdrop-filter:blur(28px);}",
      "#ann-inspector .annotator-inspector-head{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 10px;}",
      "#ann-inspector h2{margin:0;font-size:15px;line-height:20px;font-weight:650;}",
      "#ann-inspector .annotator-icon-button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--ann-secondary);cursor:pointer;}",
      "#ann-inspector .annotator-context{margin:0 14px 12px;padding:9px 10px;border-radius:8px;background:rgba(0,0,0,.045);font-size:12px;color:var(--ann-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#ann-inspector .annotator-question{padding:0 14px 8px;font-size:12px;font-weight:600;color:var(--ann-secondary);}",
      "#ann-inspector .annotator-inspector-body{max-height:min(620px,72vh);overflow:auto;padding:0 8px 8px;}",
      "#ann-inspector .annotator-section{margin:0 0 8px;padding:10px;border:1px solid var(--ann-border);border-radius:10px;background:rgba(255,255,255,.64);}",
      "#ann-inspector .annotator-section h3{margin:0 0 8px;font-size:12px;line-height:16px;font-weight:650;color:var(--ann-secondary);}",
      "#ann-inspector .annotator-control-row{display:flex;align-items:center;gap:8px;}",
      "#ann-inspector .annotator-control-row button{min-width:32px;min-height:32px;border:1px solid var(--ann-border);border-radius:7px;background:#fff;color:var(--ann-text);cursor:pointer;}",
      "#ann-inspector .annotator-color-grid{display:flex;flex-wrap:wrap;align-items:center;gap:7px;}",
      "#ann-inspector .annotator-color-swatch{width:28px;height:28px;padding:0;border:1px solid rgba(0,0,0,.16);border-radius:7px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4);cursor:pointer;}",
      "#ann-inspector .annotator-color-swatch[aria-pressed=true]{outline:2px solid var(--ann-accent);outline-offset:2px;}",
      "#ann-inspector .annotator-native-color{width:32px;height:32px;padding:2px;border:1px solid var(--ann-border);border-radius:7px;background:#fff;cursor:pointer;}",
      "#ann-inspector .annotator-eyedropper{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 9px;border:1px solid var(--ann-border);border-radius:7px;background:#fff;color:var(--ann-text);font:500 12px -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC',sans-serif;cursor:pointer;}",
      "#ann-inspector details.annotator-section summary{font-size:12px;font-weight:600;color:var(--ann-secondary);cursor:pointer;}",
      "#ann-inspector .annotator-actions{margin:0 8px;border:1px solid var(--ann-border);border-radius:10px;overflow:hidden;background:rgba(255,255,255,.64);}",
      "#ann-inspector .annotator-action{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:0 11px;border:0;border-bottom:1px solid var(--ann-border);background:transparent;color:var(--ann-text);font:500 13px -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC',sans-serif;text-align:left;cursor:pointer;}",
      "#ann-inspector .annotator-action:last-child{border-bottom:0;}",
      "#ann-inspector .annotator-action:hover{background:rgba(10,132,255,.08);}",
      "#ann-inspector .annotator-secondary{display:flex;flex-wrap:wrap;gap:6px;margin:10px 14px 0;}",
      "#ann-inspector .annotator-secondary button{padding:6px 9px;border:1px solid var(--ann-border);border-radius:7px;background:#fff;color:var(--ann-text);font:500 12px -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC',sans-serif;cursor:pointer;}",
      "#ann-inspector textarea{display:block;width:calc(100% - 28px);box-sizing:border-box;min-height:76px;margin:12px 14px 0;padding:9px 10px;border:1px solid var(--ann-border);border-radius:9px;background:#fff;color:var(--ann-text);font:400 13px/1.45 -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC',sans-serif;resize:vertical;outline:none;}",
      "#ann-inspector textarea:focus{border-color:var(--ann-accent);box-shadow:0 0 0 3px rgba(10,132,255,.14);}",
      "#ann-inspector .annotator-refs{display:flex;gap:6px;margin:8px 14px 0;}",
      "#ann-inspector .annotator-thumb{position:relative;width:42px;height:42px;border:1px solid var(--ann-border);border-radius:7px;overflow:hidden;}",
      "#ann-inspector .annotator-thumb img{width:100%;height:100%;object-fit:cover;}",
      "#ann-inspector .annotator-thumb-del{position:absolute;right:2px;top:2px;display:grid;place-items:center;width:16px;height:16px;border-radius:8px;background:rgba(0,0,0,.7);color:#fff;cursor:pointer;}",
      "#ann-inspector .annotator-inspector-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 14px 14px;}",
      "#ann-inspector .annotator-inspector-foot button{min-height:32px;padding:0 12px;border:0;border-radius:8px;font:500 13px -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC',sans-serif;cursor:pointer;}",
      "#ann-inspector [data-action=cancel]{background:rgba(0,0,0,.065);color:var(--ann-text);}",
      "#ann-inspector [data-action=save]{background:var(--ann-accent);color:#fff;}",
      "@media(max-width:640px){#ann-inspector{left:8px!important;right:8px!important;top:auto!important;bottom:calc(8px + env(safe-area-inset-bottom));width:auto;max-height:72vh;overflow:auto;}#ann-inspector button{min-height:44px!important;}#ann-toolbar{bottom:calc(8px + env(safe-area-inset-bottom));gap:1px;padding:4px;}#ann-toolbar button{gap:4px;padding:0 7px;font-size:11px;}#ann-toolbar svg{width:15px;height:15px;}}",
      ".annotator-hl{outline:2px solid #2f7fff!important;outline-offset:1px!important;cursor:crosshair!important;}",
      "html.annotator-grabbing{touch-action:none!important;}",
      "#ann-toolbar{position:fixed;left:50%;bottom:18px;z-index:2147483000;display:flex;align-items:center;gap:4px;transform:translateX(-50%);padding:5px;background:var(--ann-surface);border:1px solid var(--ann-border);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.08);backdrop-filter:blur(24px);}",
      "#ann-toolbar button{appearance:none;display:flex;align-items:center;gap:7px;min-height:38px;padding:0 12px;border:0;border-radius:9px;background:transparent;color:var(--ann-text);font:500 13px/1 -apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC',sans-serif;cursor:pointer;white-space:nowrap;}",
      "#ann-toolbar button:hover{background:rgba(0,0,0,.055);}",
      "#ann-toolbar [data-action=mark][aria-pressed=true]{background:rgba(10,132,255,.12);color:var(--ann-accent);}",
      "#ann-toolbar [data-action=finish]{background:var(--ann-accent);color:#fff;}",
      "#ann-toolbar .annotator-count{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:rgba(0,0,0,.08);font-size:10px;}",
      "#ann-dragbox{position:fixed;z-index:2147482500;border:1.5px dashed #2f7fff;background:rgba(47,127,255,.12);pointer-events:none;}",
      ".annotator-region{position:absolute;z-index:2147481500;border:1.5px dashed #e23c3c;background:rgba(226,60,60,.06);pointer-events:none;border-radius:4px;}",
      ".annotator-pin{position:absolute;z-index:2147482000;min-width:18px;height:18px;line-height:18px;padding:0 4px;background:#e23c3c;color:#fff;font-size:11px;font-weight:700;text-align:center;border-radius:9px;box-shadow:0 1px 4px rgba(0,0,0,.35);transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;font-family:sans-serif;}",
      ".annotator-pin.annotator-pin-region{background:#c0392b;border:1px solid #fff;}",
      "#ann-input{position:fixed;z-index:2147483200;width:280px;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.25);padding:10px;font-family:inherit;}",
      "#ann-input textarea{width:100%;box-sizing:border-box;min-height:64px;border:1px solid #ddd;border-radius:6px;padding:8px;font-size:13px;resize:vertical;outline:none;}",
      "#ann-input .annotator-tip{font-size:11px;color:#999;margin-top:6px;}",
      "#ann-input .annotator-target{font-size:11px;color:#2f7fff;margin-bottom:6px;word-break:break-all;}",
      "#ann-list{position:fixed;right:16px;bottom:76px;z-index:2147483100;width:340px;max-height:56vh;overflow:auto;background:var(--ann-surface);border:1px solid var(--ann-border);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.22);display:none;color:var(--ann-text);backdrop-filter:blur(28px);}",
      "#ann-list header{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;align-items:center;padding:14px;background:var(--ann-surface);border-bottom:1px solid var(--ann-border);}",
      "#ann-list header h2{margin:0;font-size:15px;line-height:20px;}",
      "#ann-list .annotator-clear{appearance:none;border:0;background:transparent;color:var(--ann-danger);font-size:12px;cursor:pointer;}",
      ".annotator-item{padding:8px 12px;border-bottom:1px solid #f2f2f2;font-size:12px;color:#444;}",
      ".annotator-item .annotator-idx{display:inline-block;min-width:16px;height:16px;line-height:16px;text-align:center;background:#e23c3c;color:#fff;border-radius:8px;font-size:10px;margin-right:6px;}",
      ".annotator-item .annotator-idx.annotator-idx-region{background:#c0392b;}",
      ".annotator-item .annotator-note{color:#111;margin:4px 0;}",
      ".annotator-item .annotator-context-label{color:var(--ann-secondary);font-size:11px;}",
      ".annotator-item .annotator-ops{float:right;}",
      ".annotator-item .annotator-ops span{cursor:pointer;font-size:11px;margin-left:8px;}",
      ".annotator-item .annotator-edit{color:#2f7fff;}",
      ".annotator-item .annotator-del{color:#e23c3c;}",
      ".annotator-item.annotator-missing{opacity:.55;}",
      "#ann-modal-mask{position:fixed;inset:0;z-index:2147483400;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:inherit;}",
      "#ann-modal{width:560px;max-width:90vw;max-height:80vh;background:#fff;border-radius:10px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35);}",
      "#ann-modal header{padding:12px 16px;font-size:14px;font-weight:600;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;}",
      "#ann-modal textarea{flex:1;min-height:280px;border:none;padding:12px 16px;font-family:monospace;font-size:12px;resize:none;outline:none;white-space:pre;overflow:auto;}",
      "#ann-modal footer{padding:10px 16px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end;}",
      "#ann-modal button{border:none;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;}",
      "#ann-modal .annotator-primary{background:#2f7fff;color:#fff;}",
      "#ann-modal .annotator-ghost{background:#eee;color:#333;}",
      "#ann-input .annotator-chips{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 4px;}",
      "#ann-input .annotator-chip{background:#f1f3f5;color:#333;border:1px solid #e2e5e9;border-radius:14px;padding:3px 9px;font-size:12px;cursor:pointer;user-select:none;}",
      "#ann-input .annotator-chip:hover{background:#e6efff;border-color:#bcd4ff;}",
      "#ann-input .annotator-swatches{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0;}",
      "#ann-input .annotator-sw{width:20px;height:20px;border-radius:50%;cursor:pointer;border:1px solid rgba(0,0,0,.15);}",
      "#ann-input .annotator-refs{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0;}",
      "#ann-input .annotator-thumb{position:relative;width:44px;height:44px;border-radius:6px;overflow:hidden;border:1px solid #ddd;}",
      "#ann-input .annotator-thumb img{width:100%;height:100%;object-fit:cover;}",
      "#ann-input .annotator-thumb .annotator-thumb-del{position:absolute;top:-6px;right:-6px;width:16px;height:16px;line-height:14px;text-align:center;background:#e23c3c;color:#fff;border-radius:50%;font-size:11px;cursor:pointer;}"
    ].join("\n");
    var style = document.createElement("style");
    style.setAttribute("data-annotator", "true");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- 顶层容器与工具条 ----------
  var bar, toggleBtn, listBtn, exportBtn, listPanel, inputBox;

  function buildUI() {
    bar = document.createElement("div");
    bar.id = "ann-toolbar";
    bar.setAttribute("data-annotator", "true");
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "页面标注工具");

    toggleBtn = document.createElement("button");
    toggleBtn.id = "ann-toggle";
    toggleBtn.setAttribute("data-action", "mark");
    toggleBtn.setAttribute("aria-pressed", "false");
    toggleBtn.innerHTML = iconSvg("add") + "<span>标记修改</span>";
    toggleBtn.onclick = toggleMode;

    listBtn = document.createElement("button");
    listBtn.setAttribute("data-action", "list");
    listBtn.innerHTML = iconSvg("list") + '<span>我的修改</span><span id="ann-count" class="annotator-count">0</span>';
    listBtn.onclick = function () { toggleList(); };

    exportBtn = document.createElement("button");
    exportBtn.setAttribute("data-action", "finish");
    exportBtn.innerHTML = iconSvg("done") + "<span>完成标注</span>";
    exportBtn.onclick = openExport;

    bar.appendChild(toggleBtn);
    bar.appendChild(listBtn);
    bar.appendChild(exportBtn);
    document.body.appendChild(bar);

    listPanel = document.createElement("div");
    listPanel.id = "ann-list";
    listPanel.setAttribute("data-annotator", "true");
    document.body.appendChild(listPanel);
  }

  function refreshCount() {
    var count = document.getElementById("ann-count");
    if (count) count.textContent = annotations.length;
  }

  // ---------- 标注模式开关 ----------
  function toggleMode() {
    active = !active;
    toggleBtn.classList.toggle("on", active);
    toggleBtn.setAttribute("aria-pressed", active ? "true" : "false");
    var label = toggleBtn.querySelector("span");
    if (label) label.textContent = active ? "退出标记" : (annotations.length ? "继续标记" : "标记修改");
    if (!active) {
      clearHover();
      endDrag();
    } else {
      showToast("标注模式：点选单个元素，或拖拽框选一片区域");
    }
  }

  function clearHover() {
    if (hoverEl) {
      hoverEl.classList.remove("annotator-hl");
      hoverEl = null;
    }
  }

  // ---------- Hover 高亮（仅桌面，未拖拽时） ----------
  function onMouseOver(e) {
    if (!active || dragging || pointerDown) return;
    var el = e.target;
    if (isAnnotatorElement(el)) return;
    clearHover();
    hoverEl = el;
    el.classList.add("annotator-hl");
  }

  function onMouseOut(e) {
    if (!active) return;
    if (e.target === hoverEl) clearHover();
  }

  // 吞掉标注模式下的原生 click，避免触发页面跳转/交互
  function onClick(e) {
    if (!active) return;
    if (isAnnotatorElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  // ---------- Pointer：统一鼠标/触摸，区分点选与拖拽框选 ----------
  function onPointerDown(e) {
    if (!active) return;
    if (isAnnotatorElement(e.target)) return; // 点工具条，放行
    if (e.button !== undefined && e.button !== 0) return; // 只响应主键
    pointerDown = true;
    dragging = false;
    startX = e.clientX;
    startY = e.clientY;
    document.documentElement.classList.add("annotator-grabbing");
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!active || !pointerDown) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    if (!dragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      dragging = true;
      clearHover();
      createDragBox();
    }
    if (dragging) {
      e.preventDefault();
      updateDragBox(startX, startY, e.clientX, e.clientY);
    }
  }

  function onPointerUp(e) {
    if (!active || !pointerDown) return;
    pointerDown = false;
    document.documentElement.classList.remove("annotator-grabbing");
    if (dragging) {
      dragging = false;
      var r = boxRect(startX, startY, e.clientX, e.clientY);
      removeDragBox();
      if (r.w > 6 && r.h > 6) {
        handleRegion(r, e.clientX, e.clientY);
      }
    } else {
      // 点选单个元素
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && !isAnnotatorElement(el)) {
        openInput(el, e.clientX, e.clientY);
      }
    }
  }

  function endDrag() {
    pointerDown = false;
    dragging = false;
    removeDragBox();
    document.documentElement.classList.remove("annotator-grabbing");
  }

  function boxRect(x1, y1, x2, y2) {
    return { left: Math.min(x1, x2), top: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }

  function createDragBox() {
    if (dragBox) return;
    dragBox = document.createElement("div");
    dragBox.id = "ann-dragbox";
    dragBox.setAttribute("data-annotator", "true");
    document.body.appendChild(dragBox);
  }

  function updateDragBox(x1, y1, x2, y2) {
    if (!dragBox) return;
    var r = boxRect(x1, y1, x2, y2);
    dragBox.style.left = r.left + "px";
    dragBox.style.top = r.top + "px";
    dragBox.style.width = r.w + "px";
    dragBox.style.height = r.h + "px";
  }

  function removeDragBox() {
    if (dragBox && dragBox.parentNode) dragBox.parentNode.removeChild(dragBox);
    dragBox = null;
  }

  // ---------- 框选区域：收集区域内元素 + 公共容器 ----------
  function handleRegion(vpRect, x, y) {
    // vpRect 为视口坐标；转成文档坐标存储
    var rectDoc = {
      left: vpRect.left + window.scrollX,
      top: vpRect.top + window.scrollY,
      width: vpRect.w,
      height: vpRect.h
    };
    var members = collectMembers(vpRect);
    var container = members.length ? commonAncestor(members.map(function (m) { return m.el; })) : null;

    openRegionInput(rectDoc, members, container, x, y, null);
  }

  // 收集"大部分落在框内"的最外层元素
  function collectMembers(vpRect) {
    var all = document.body ? document.body.querySelectorAll("*") : [];
    var matched = [];
    var boxArea = vpRect.w * vpRect.h;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (isAnnotatorElement(el)) continue;
      var tag = el.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "br" || tag === "meta" || tag === "link") continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      var elArea = r.width * r.height;
      // 跳过比选框大很多的容器（避免选到 body/大 wrapper）
      if (elArea > boxArea * 2.2) continue;
      var ix = Math.max(0, Math.min(vpRect.left + vpRect.w, r.right) - Math.max(vpRect.left, r.left));
      var iy = Math.max(0, Math.min(vpRect.top + vpRect.h, r.bottom) - Math.max(vpRect.top, r.top));
      var inter = ix * iy;
      if (inter <= 0) continue;
      // 元素 60% 以上落在框内才算命中
      if (inter / elArea >= 0.6) matched.push(el);
    }
    // 去掉"祖先也在命中集"的元素，只保留最外层
    var outer = matched.filter(function (el) {
      for (var j = 0; j < matched.length; j++) {
        if (matched[j] !== el && matched[j].contains(el)) return false;
      }
      return true;
    });
    return outer.map(function (el) {
      return { el: el, selector: computeSelector(el), tag: el.tagName.toLowerCase(), text: shortText(el) };
    });
  }

  function commonAncestor(els) {
    if (!els.length) return null;
    var a = els[0];
    for (var i = 1; i < els.length; i++) {
      var b = els[i];
      while (a && !a.contains(b)) a = a.parentNode;
    }
    return (a && a.nodeType === 1) ? a : null;
  }

  // ---------- 批注输入框（元素：新增/编辑） ----------
  function openInput(el, x, y, editItem) {
    closeInput();
    var selector = editItem ? editItem.selector : computeSelector(el);
    previewDraft = createDraft(el);
    inputBox = buildInputBox(
      describeElement(el || (editItem && editItem.el)),
      editItem ? editItem.note : "",
      x, y,
      function (note, refs, changes) {
        if (editItem) {
          editItem.note = note; editItem.refs = refs; editItem.changes = changes; save(); renderList();
        } else {
          addElementAnnotation(el, selector, note, refs, changes);
        }
      },
      editItem ? editItem.refs : null,
      el
    );
  }

  // ---------- 批注输入框（区域：新增/编辑） ----------
  function openRegionInput(rectDoc, members, container, x, y, editItem) {
    closeInput();
    var label = "已框选 " + (editItem ? editItem.members.length : members.length) + " 个页面内容";
    inputBox = buildInputBox(
      label,
      editItem ? editItem.note : "",
      x, y,
      function (note, refs) {
        if (editItem) {
          editItem.note = note; editItem.refs = refs; save(); renderList();
        } else {
          addRegionAnnotation(rectDoc, members, container, note, refs);
        }
      },
      editItem ? editItem.refs : null
    );
  }

  function targetKind(el) {
    if (!el || !el.tagName) return "container";
    var tag = el.tagName.toLowerCase();
    if (tag === "img" || tag === "picture" || tag === "video") return "image";
    if (tag === "button" || tag === "a" || el.getAttribute("role") === "button") return "container";
    if (/^(p|span|h1|h2|h3|h4|h5|h6|label|strong|em)$/.test(tag)) return "text";
    return el.children.length ? "container" : "text";
  }

  function inspectorSection(name, title, disclosure) {
    var node = document.createElement(disclosure ? "details" : "section");
    node.className = "annotator-section";
    node.setAttribute("data-section", name);
    var heading = document.createElement(disclosure ? "summary" : "h3");
    heading.textContent = title;
    node.appendChild(heading);
    return node;
  }

  function renderColorControl(sectionNode, el, draft, property, category) {
    var grid = document.createElement("div");
    grid.className = "annotator-color-grid";
    var current = rgbToHex(getComputedStyle(el).getPropertyValue(property).trim()).toLowerCase();
    pageThemeColors().forEach(function (rawColor) {
      var color = rgbToHex(rawColor).toLowerCase();
      if (!/^#[0-9a-f]{6}$/i.test(color)) return;
      var swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "annotator-color-swatch";
      swatch.setAttribute("data-page-color", color);
      swatch.setAttribute("aria-label", "使用页面颜色 " + color);
      swatch.setAttribute("aria-pressed", color === current ? "true" : "false");
      swatch.style.backgroundColor = color;
      swatch.onclick = function () {
        previewStyle(draft, category, property, color, null);
        var all = grid.querySelectorAll("[data-page-color]");
        for (var i = 0; i < all.length; i++) all[i].setAttribute("aria-pressed", all[i] === swatch ? "true" : "false");
      };
      grid.appendChild(swatch);
    });
    var custom = document.createElement("input");
    custom.type = "color";
    custom.className = "annotator-native-color";
    custom.setAttribute("data-control", "custom-color");
    custom.setAttribute("aria-label", "自定义颜色");
    custom.value = /^#[0-9a-f]{6}$/i.test(current) ? current : "#000000";
    custom.oninput = function () { previewStyle(draft, category, property, custom.value, null); };
    grid.appendChild(custom);
    if (typeof window.EyeDropper === "function") {
      var picker = document.createElement("button");
      picker.type = "button";
      picker.className = "annotator-eyedropper";
      picker.setAttribute("data-control", "eyedropper");
      picker.textContent = "屏幕吸色";
      picker.onclick = function () {
        var eyeDropper = new window.EyeDropper();
        eyeDropper.open().then(function (result) {
          if (result && result.sRGBHex) {
            custom.value = result.sRGBHex;
            previewStyle(draft, category, property, result.sRGBHex, null);
          }
        }).catch(function () { /* 用户取消吸色时保持当前颜色 */ });
      };
      grid.appendChild(picker);
    }
    sectionNode.appendChild(grid);
  }

  function buildInputBox(labelText, presetNote, x, y, onSubmit, presetRefs, previewEl) {
    var box = document.createElement("div");
    box.id = "ann-inspector";
    box.setAttribute("data-annotator", "true");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "false");
    box.setAttribute("aria-label", "添加修改");
    var refs = (presetRefs || []).slice(); // [{name,dataURL}]

    var head = document.createElement("div");
    head.className = "annotator-inspector-head";
    var heading = document.createElement("h2");
    heading.textContent = presetNote ? "编辑修改" : "添加修改";
    var closeBtn = document.createElement("button");
    closeBtn.className = "annotator-icon-button";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.innerHTML = iconSvg("close");
    closeBtn.onclick = closeInput;
    head.appendChild(heading);
    head.appendChild(closeBtn);

    var target = document.createElement("div");
    target.className = "annotator-context";
    target.setAttribute("data-role", "context");
    target.textContent = "已选中：" + labelText;

    var ta = document.createElement("textarea");
    ta.placeholder = "也可以直接写下你的要求";
    if (presetNote) ta.value = presetNote;

    function appendNote(txt) {
      var v = ta.value.trim();
      ta.value = (v ? v + (/[；;。\n]$/.test(v) ? " " : "；") : "") + txt;
      ta.focus();
    }

    var body = document.createElement("div");
    body.className = "annotator-inspector-body";
    var kind = targetKind(previewEl);
    var sectionNames = kind === "text"
      ? [["text-content", "文字内容"], ["typography", "文字样式"], ["text-color", "文字颜色"]]
      : kind === "image"
        ? [["image", "图片"], ["appearance", "外观"]]
        : [["spacing", "间距"], ["appearance", "外观"]];
    var sectionNodes = {};
    sectionNames.forEach(function (item) {
      sectionNodes[item[0]] = inspectorSection(item[0], item[1], false);
      body.appendChild(sectionNodes[item[0]]);
    });

    if (kind === "text") {
      var contentInput = document.createElement("input");
      contentInput.type = "text";
      contentInput.value = previewEl ? previewEl.textContent.trim() : "";
      contentInput.setAttribute("data-control", "text-content");
      contentInput.style.cssText = "box-sizing:border-box;width:100%;min-height:32px;border:1px solid var(--ann-border);border-radius:7px;padding:0 8px;background:#fff;color:var(--ann-text);";
      sectionNodes["text-content"].appendChild(contentInput);
      var increase = document.createElement("button");
      increase.type = "button";
      increase.setAttribute("data-control", "font-size-increase");
      increase.textContent = "+";
      increase.onclick = function () {
        var current = parseFloat(getComputedStyle(previewEl).fontSize) || 16;
        previewStyle(previewDraft, "text", "font-size", (current + 1) + "px", "px");
      };
      var typeRow = document.createElement("div");
      typeRow.className = "annotator-control-row";
      typeRow.appendChild(increase);
      sectionNodes.typography.appendChild(typeRow);
      renderColorControl(sectionNodes["text-color"], previewEl, previewDraft, "color", "text");
    } else if (sectionNodes.appearance && previewEl) {
      renderColorControl(sectionNodes.appearance, previewEl, previewDraft, "background-color", "appearance");
    }

    var noteSection = inspectorSection("note", "补充说明", false);
    noteSection.appendChild(ta);
    body.appendChild(noteSection);
    var advancedSection = inspectorSection("advanced", "高级信息", true);
    var selectorInfo = document.createElement("div");
    selectorInfo.textContent = previewEl ? computeSelector(previewEl) : "区域标注";
    selectorInfo.style.cssText = "margin-top:8px;font-size:11px;color:var(--ann-secondary);word-break:break-all;";
    advancedSection.appendChild(selectorInfo);
    body.appendChild(advancedSection);

    // ——参考图附件——
    var refsWrap = document.createElement("div");
    refsWrap.className = "annotator-refs";
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.setAttribute("data-annotator", "true");
    fileInput.style.display = "none";
    fileInput.onchange = function () {
      var files = fileInput.files || [];
      for (var i = 0; i < files.length; i++) {
        (function (f) {
          var reader = new FileReader();
          reader.onload = function () { refs.push({ name: f.name, dataURL: reader.result }); renderRefs(); };
          reader.readAsDataURL(f);
        })(files[i]);
      }
      fileInput.value = "";
    };
    function addRef() { fileInput.click(); }
    function renderRefs() {
      refsWrap.innerHTML = "";
      refs.forEach(function (r, idx) {
        var t = document.createElement("div");
        t.className = "annotator-thumb";
        var img = document.createElement("img");
        img.src = r.dataURL || "";
        t.appendChild(img);
        var del = document.createElement("span");
        del.className = "annotator-thumb-del";
        del.innerHTML = iconSvg("close");
        del.setAttribute("aria-label", "移除参考图");
        del.onclick = function () { refs.splice(idx, 1); renderRefs(); };
        t.appendChild(del);
        refsWrap.appendChild(t);
      });
    }
    renderRefs();

    var footer = document.createElement("div");
    footer.className = "annotator-inspector-foot";
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.setAttribute("data-action", "cancel");
    cancelBtn.textContent = "取消";
    cancelBtn.onclick = closeInput;
    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.setAttribute("data-action", "save");
    saveBtn.textContent = "保存修改";
    saveBtn.onclick = submit;
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);

    box.appendChild(head);
    box.appendChild(target);
    noteSection.appendChild(refsWrap);
    box.appendChild(body);
    box.appendChild(fileInput);
    box.appendChild(footer);
    document.body.appendChild(box);

    var vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.min(x + 12, vw - 352);
    var top = Math.min(y + 12, vh - 480);
    box.style.left = Math.max(8, left) + "px";
    box.style.top = Math.max(8, top) + "px";
    ta.focus();
    if (presetNote) ta.select();

    function submit() {
      var note = ta.value.trim();
      var changes = previewDraft ? previewDraft.changes.slice() : [];
      if (note || refs.length || changes.length) onSubmit(note, refs.slice(), changes);
      if (previewDraft) previewDraft.committed = true;
      closeInput();
    }

    ta.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        submit();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        closeInput();
      }
    });
    return box;
  }

  // 从页面 CSS 变量/常见处采集几个主题色作为色卡候选
  function pageThemeColors() {
    var colors = [];
    try {
      var cs = getComputedStyle(document.documentElement);
      ["--brand", "--primary", "--main", "--accent", "--ink", "--color-primary"].forEach(function (v) {
        var c = cs.getPropertyValue(v).trim();
        if (c) colors.push(c);
      });
      var bodyColor = getComputedStyle(document.body).color;
      if (bodyColor) colors.push(rgbToHex(bodyColor));
    } catch (e) { /* ignore */ }
    // 常用兜底色卡
    ["#2f7fff", "#e23c3c", "#f5a623", "#2ecc71", "#111111", "#666666", "#ffffff"].forEach(function (c) {
      if (colors.indexOf(c) === -1) colors.push(c);
    });
    return colors.slice(0, 10);
  }

  function rgbToHex(rgb) {
    var m = String(rgb).match(/\d+/g);
    if (!m || m.length < 3) return rgb;
    return "#" + m.slice(0, 3).map(function (n) {
      var h = parseInt(n, 10).toString(16);
      return h.length === 1 ? "0" + h : h;
    }).join("");
  }

  function createDraft(el) {
    return { el: el, originals: {}, before: {}, changes: [], committed: false };
  }

  function previewStyle(draft, category, property, after, unit, direction) {
    if (!draft || !draft.el) return;
    if (!Object.prototype.hasOwnProperty.call(draft.originals, property)) {
      draft.originals[property] = draft.el.style.getPropertyValue(property);
      draft.before[property] = getComputedStyle(draft.el).getPropertyValue(property).trim();
    }
    draft.el.style.setProperty(property, after);
    var change = {
      category: category,
      property: property,
      before: draft.before[property],
      after: after,
      unit: unit || null,
      direction: direction || null
    };
    draft.changes = draft.changes.filter(function (item) { return item.property !== property; });
    draft.changes.push(change);
  }

  function rollbackDraft(draft) {
    if (!draft || draft.committed || !draft.el) return;
    Object.keys(draft.originals).forEach(function (property) {
      var value = draft.originals[property];
      if (value) draft.el.style.setProperty(property, value);
      else draft.el.style.removeProperty(property);
    });
  }

  function closeInput() {
    rollbackDraft(previewDraft);
    previewDraft = null;
    if (inputBox && inputBox.parentNode) inputBox.parentNode.removeChild(inputBox);
    inputBox = null;
    if (toggleBtn && typeof toggleBtn.focus === "function") toggleBtn.focus();
  }

  // ---------- 新增 / 删除 / 编辑 / 清空 ----------
  function addElementAnnotation(el, selector, note, refs, changes) {
    seq += 1;
    var target = targetMetadata(el, selector);
    annotations.push({
      id: seq, type: "element", selector: selector, tag: el.tagName.toLowerCase(),
      text: shortText(el), note: note, page: target.targetPageId || currentPage(), snippet: snippetOf(el), el: el,
      targetClauseId: target.targetClauseId,
      targetPageId: target.targetPageId,
      targetNodeSelector: target.targetNodeSelector,
      refs: refs || [], changes: changes || []
    });
    afterChange();
  }

  function addRegionAnnotation(rectDoc, members, container, note, refs) {
    seq += 1;
    var selector = container ? computeSelector(container) : "";
    var target = targetMetadata(container, selector);
    annotations.push({
      id: seq, type: "region",
      selector: selector,
      tag: container ? container.tagName.toLowerCase() : "(区域)",
      text: members.length ? members.map(function (m) { return m.text; }).filter(Boolean).slice(0, 3).join(" / ") : "空白区域",
      note: note, page: target.targetPageId || currentPage(),
      targetClauseId: target.targetClauseId,
      targetPageId: target.targetPageId,
      targetNodeSelector: target.targetNodeSelector,
      members: members.map(function (m) { return { selector: m.selector, tag: m.tag, text: m.text }; }),
      rectDoc: rectDoc, refs: refs || []
    });
    afterChange();
  }

  function afterChange() {
    save();
    refreshCount();
    renderPins();
    renderList();
  }

  function removeAnnotation(id) {
    for (var i = 0; i < annotations.length; i++) {
      if (annotations[i].id === id) { annotations.splice(i, 1); break; }
    }
    afterChange();
  }

  function editAnnotation(id) {
    var a = null;
    for (var i = 0; i < annotations.length; i++) { if (annotations[i].id === id) { a = annotations[i]; break; } }
    if (!a) return;
    var x = window.innerWidth / 2 - 140, y = window.innerHeight / 2 - 80;
    if (a.type === "region") {
      openRegionInput(a.rectDoc, a.members, null, x, y, a);
    } else {
      if (a.el && document.body.contains(a.el)) {
        var r = a.el.getBoundingClientRect(); x = r.left; y = r.top;
      }
      openInput(a.el, x, y, a);
    }
  }

  function clearAll() {
    if (!annotations.length) return;
    if (!window.confirm("确定清空全部 " + annotations.length + " 条标注？此操作不可撤销。")) return;
    annotations = [];
    seq = 0;
    afterChange();
  }

  // ---------- 区域实时矩形（优先按成员并集，回退到存储的 rectDoc） ----------
  function regionRectDoc(a) {
    if (a.members && a.members.length) {
      var union = null;
      for (var i = 0; i < a.members.length; i++) {
        var el = null;
        try { el = document.querySelector(a.members[i].selector); } catch (e) { el = null; }
        if (!el || !document.body.contains(el)) continue;
        var r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        var box = { left: r.left + window.scrollX, top: r.top + window.scrollY, right: r.right + window.scrollX, bottom: r.bottom + window.scrollY };
        if (!union) union = box;
        else {
          union.left = Math.min(union.left, box.left);
          union.top = Math.min(union.top, box.top);
          union.right = Math.max(union.right, box.right);
          union.bottom = Math.max(union.bottom, box.bottom);
        }
      }
      if (union) return { left: union.left, top: union.top, width: union.right - union.left, height: union.bottom - union.top };
    }
    return a.rectDoc || null;
  }

  // ---------- 渲染 pin 与区域轮廓 ----------
  function renderPins() {
    var old = document.querySelectorAll(".annotator-pin, .annotator-region");
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);

    var page = currentPage();
    for (var j = 0; j < annotations.length; j++) {
      var a = annotations[j];
      if (page && a.page && a.page !== page) continue;

      var px, py, isRegion = a.type === "region";
      if (isRegion) {
        var rd = regionRectDoc(a);
        if (!rd) continue;
        // 区域轮廓
        var box = document.createElement("div");
        box.className = "annotator-region";
        box.setAttribute("data-annotator", "true");
        box.style.left = rd.left + "px";
        box.style.top = rd.top + "px";
        box.style.width = rd.width + "px";
        box.style.height = rd.height + "px";
        document.body.appendChild(box);
        px = rd.left; py = rd.top;
      } else {
        var el = a.el;
        if (!el || !document.body.contains(el)) continue;
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        px = rect.left + window.scrollX + 6;
        py = rect.top + window.scrollY + 6;
      }

      var pin = document.createElement("div");
      pin.className = "annotator-pin" + (isRegion ? " annotator-pin-region" : "");
      pin.setAttribute("data-annotator", "true");
      pin.textContent = a.id;
      pin.style.left = px + "px";
      pin.style.top = py + "px";
      (function (id) {
        pin.onclick = function (e) { e.stopPropagation(); toggleList(true); highlightListItem(id); };
      })(a.id);
      document.body.appendChild(pin);
    }
  }

  // ---------- 标注列表面板 ----------
  function toggleList(forceOpen) {
    var open = forceOpen === true ? true : listPanel.style.display !== "block";
    listPanel.style.display = open ? "block" : "none";
    if (open) renderList();
  }

  function highlightListItem(id) {
    var node = listPanel.querySelector('[data-item="' + id + '"]');
    if (node) {
      node.scrollIntoView({ block: "nearest" });
      node.style.background = "#fff7d6";
      setTimeout(function () { node.style.background = ""; }, 1400);
    }
  }

  function renderList() {
    if (listPanel.style.display !== "block") return;
    var head = '<header><div><h2>我的修改</h2><div class="annotator-context-label">' + annotations.length + ' 条</div></div>' +
      (annotations.length ? '<button class="annotator-clear" data-clear="1">清空全部</button>' : '') +
      '</header>';
    var html = head;
    if (annotations.length === 0) {
      html += '<div class="annotator-item" style="color:#999;">还没有添加修改。</div>';
    } else {
      for (var i = 0; i < annotations.length; i++) {
        var a = annotations[i];
        var isRegion = a.type === "region";
        var missing = isRegion ? !regionRectDoc(a) : !(a.el && document.body.contains(a.el));
        var head2 = isRegion
          ? '框选区域（' + (a.members ? a.members.length : 0) + ' 项内容）' + escapeHtml(a.text ? " · " + a.text : "")
          : escapeHtml(describeElement(a.el));
        html += '<div class="annotator-item' + (missing ? ' annotator-missing' : '') + '" data-item="' + a.id + '">' +
          '<span class="annotator-ops">' +
            '<span class="annotator-edit" data-edit="' + a.id + '">编辑</span>' +
            '<span class="annotator-del" data-del="' + a.id + '">删除</span>' +
          '</span>' +
          '<span class="annotator-idx' + (isRegion ? ' annotator-idx-region' : '') + '">' + a.id + '</span>' +
          head2 + (missing ? ' <em style="color:#e23c3c;">原来的位置已经变化，请重新选择</em>' : '') +
          '<div class="annotator-note">' + escapeHtml(a.note) + '</div>' +
          '</div>';
      }
    }
    listPanel.innerHTML = html;

    var clear = listPanel.querySelector("[data-clear]");
    if (clear) clear.onclick = clearAll;
    var dels = listPanel.querySelectorAll("[data-del]");
    for (var k = 0; k < dels.length; k++) {
      (function (btn) { btn.onclick = function () { removeAnnotation(parseInt(btn.getAttribute("data-del"), 10)); }; })(dels[k]);
    }
    var edits = listPanel.querySelectorAll("[data-edit]");
    for (var m = 0; m < edits.length; m++) {
      (function (btn) { btn.onclick = function () { editAnnotation(parseInt(btn.getAttribute("data-edit"), 10)); }; })(edits[m]);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- 结构化导出（给 AI 看的协议格式） ----------
  function structuredAnnotations() {
    return annotations.map(function (a) {
      return {
        annId: "ann-" + a.id,
        targetClauseId: a.targetClauseId || null,
        targetPageId: a.targetPageId || null,
        targetNodeSelector: a.targetNodeSelector || a.selector || null,
        action: "modify",
        intent: a.note,
        scope: "target-only",
        changes: Array.isArray(a.changes) ? a.changes.map(function (change) {
          return {
            category: change.category,
            property: change.property,
            before: change.before,
            after: change.after,
            unit: change.unit || null,
            direction: change.direction || null
          };
        }) : []
      };
    });
  }

  function serializeAnnotations() {
    if (annotations.length === 0) return "（当前没有任何标注）";
    var lines = [];
    lines.push("页面: " + (document.title || "(无标题)") + " (" + location.href + ")");
    lines.push("");
    for (var i = 0; i < annotations.length; i++) {
      var a = annotations[i];
      if (a.type === "region") {
        lines.push("[标注 " + a.id + "] 区域框选（含 " + (a.members ? a.members.length : 0) + " 个元素）");
        if (a.page) lines.push("  页面区块: " + a.page);
        if (a.selector) lines.push("  容器选择器: " + a.selector);
        if (a.members && a.members.length) {
          lines.push("  区域内元素:");
          for (var m = 0; m < a.members.length; m++) {
            var mm = a.members[m];
            lines.push("    - <" + mm.tag + "> \"" + mm.text + "\"  选择器: " + mm.selector);
          }
        }
        lines.push("  批注: " + a.note);
      } else {
        lines.push("[标注 " + a.id + "] 元素: <" + a.tag + "> \"" + a.text + "\"");
        if (a.page) lines.push("  页面区块: " + a.page);
        lines.push("  选择器: " + a.selector);
        if (a.snippet) lines.push("  片段: " + a.snippet);
        lines.push("  批注: " + a.note);
      }
      if (a.refs && a.refs.length) {
        var names = a.refs.map(function (r, k) { return refFileName(a, r, k); });
        lines.push("  参考图: " + a.refs.length + " 张（文件名：" + names.join("、") + "；图片数据已内嵌在本文本末尾，AI 会自动解析）");
      }
      lines.push("");
    }
    lines.push("---");
    lines.push("请根据以上标注逐一修改对应元素（元素类用「选择器」定位、「片段」辅助确认；区域类需综合调整「区域内元素」整体），并输出修改后的完整 HTML。");
    var context = workflowContext();
    if (context.taskId || context.sessionId || context.prdFingerprint) {
      lines.push("");
      lines.push("```prd-demo-annotations");
      lines.push(JSON.stringify({
        schemaVersion: "1.0",
        taskId: context.taskId,
        sessionId: context.sessionId,
        prdFingerprint: context.prdFingerprint,
        annotations: structuredAnnotations()
      }, null, 2));
      lines.push("```");
    }
    return lines.join("\n");
  }

  // ---------- 参考图：文件名 & 导出下载 ----------
  function refExt(r) {
    var du = r.dataURL || "";
    var m = /^data:image\/([a-zA-Z0-9.+-]+)/.exec(du);
    var ext = m ? m[1].toLowerCase() : "";
    if (ext === "jpeg") ext = "jpg";
    if (!ext && r.name && r.name.indexOf(".") >= 0) ext = r.name.split(".").pop().toLowerCase();
    return ext || "png";
  }
  function refFileName(a, r, k) {
    return "标注" + a.id + "-参考图" + (k + 1) + "." + refExt(r);
  }
  function dataURLtoBlob(dataURL) {
    var parts = dataURL.split(",");
    var meta = parts[0] || "";
    var isB64 = meta.indexOf("base64") >= 0;
    var mime = (/data:([^;]+)/.exec(meta) || [])[1] || "image/png";
    var body = parts[1] || "";
    if (isB64) {
      var bin = atob(body);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    return new Blob([decodeURIComponent(body)], { type: mime });
  }
  // 触发浏览器下载所有带 dataURL 的参考图，返回成功下载的数量
  function downloadRefImages() {
    var n = 0;
    for (var i = 0; i < annotations.length; i++) {
      var a = annotations[i];
      if (!a.refs || !a.refs.length) continue;
      for (var k = 0; k < a.refs.length; k++) {
        var r = a.refs[k];
        if (!r || !r.dataURL) continue;
        try {
          var blob = dataURLtoBlob(r.dataURL);
          var url = URL.createObjectURL(blob);
          var link = document.createElement("a");
          link.href = url;
          link.download = refFileName(a, r, k);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(function (u) { return function () { URL.revokeObjectURL(u); }; }(url), 4000);
          n++;
        } catch (e) { /* 单张失败不阻塞其它 */ }
      }
    }
    return n;
  }
  function totalRefCount() {
    var n = 0;
    for (var i = 0; i < annotations.length; i++) n += (annotations[i].refs || []).length;
    return n;
  }

  // 压缩参考图（等比缩到 ≤1280，JPEG 0.72），减小内嵌到文本里的 base64 体积
  function compressDataURL(dataURL, cb) {
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var maxD = 1280, w = img.width || 1, h = img.height || 1;
          var scale = Math.min(1, maxD / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
          var cv = document.createElement("canvas");
          cv.width = cw; cv.height = ch;
          cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
          cb(cv.toDataURL("image/jpeg", 0.72));
        } catch (e) { cb(dataURL); }
      };
      img.onerror = function () { cb(dataURL); };
      img.src = dataURL;
    } catch (e) { cb(dataURL); }
  }

  // 异步收集所有参考图并压缩，拼成可粘贴的内嵌数据块（供 AI 自动解析）
  function buildEmbedBlock(cb) {
    var jobs = [];
    for (var i = 0; i < annotations.length; i++) {
      var a = annotations[i];
      if (!a.refs) continue;
      for (var k = 0; k < a.refs.length; k++) {
        if (a.refs[k] && a.refs[k].dataURL) {
          jobs.push({ name: refFileName(a, a.refs[k], k), dataURL: a.refs[k].dataURL });
        }
      }
    }
    if (!jobs.length) { cb("", 0); return; }
    var out = [], done = 0;
    jobs.forEach(function (job, idx) {
      compressDataURL(job.dataURL, function (cdu) {
        out[idx] = "[[[IMG:" + job.name + "]]]\n" + cdu + "\n[[[/IMG]]]";
        done++;
        if (done === jobs.length) {
          var block = "\n\n=====参考图内嵌数据（base64；AI 自动解析，用户无需手动处理）=====\n" +
                      out.join("\n") +
                      "\n=====参考图数据结束=====";
          cb(block, jobs.length);
        }
      });
    });
  }

  function openExport() {
    try {
      var baseText = serializeAnnotations();
      // 先把参考图压缩并内嵌到文本，实现"一次导出、整段粘贴即带图"
      buildEmbedBlock(function (embedBlock, embedCount) {
        var text = baseText + (embedBlock || "");
        copyText(text, function (ok) {
          if (!ok) {
            var manual = document.querySelector("#ann-modal textarea");
            if (manual) {
              manual.style.display = "block";
              manual.focus();
              manual.select();
            }
          }
          showToast(ok
            ? (embedCount ? "已复制，包含 " + embedCount + " 张参考图，回到 Agent 对话粘贴即可" : "已复制，回到 Agent 对话粘贴即可")
            : "复制受限，请在弹窗里手动全选复制");
        });
        showExportModal(text, embedCount);
      });
    } catch (err) {
      showToast("导出出错：" + (err && err.message ? err.message : err));
    }
  }

  function showExportModal(text, embedCount) {
    try {
      // 参考图同时下载为文件，作为"粘贴时图片数据被截断"的兜底
      var refCount = totalRefCount();
      var dl = refCount ? downloadRefImages() : 0;

      var mask = document.createElement("div");
      mask.id = "ann-modal-mask";
      mask.setAttribute("data-annotator", "true");

      var modal = document.createElement("div");
      modal.id = "ann-modal";
      modal.innerHTML =
        '<header><div><h2 style="margin:0;font-size:16px;">修改要求已经准备好</h2></div>' +
        '<button class="annotator-icon-button" data-action="close" aria-label="关闭">' + iconSvg("close") + '</button></header>' +
        '<div style="padding:14px 16px 2px;color:var(--ann-secondary);font-size:13px;line-height:1.6;">' +
        '系统已整理好页面位置、参考图片和你的全部要求。<br><b style="color:var(--ann-text);">下一步：回到 Agent 对话，粘贴并发送</b></div>';

      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("aria-label", "机器可读的修改要求");
      ta.style.display = "none";
      modal.appendChild(ta);

      // —— 参考图提示 + 缩略图（兜底下载）——
      if (refCount) {
        var refBar = document.createElement("div");
        refBar.style.cssText = "margin:8px 0 2px;font-size:12px;color:#237804;line-height:1.5;";
        refBar.textContent = embedCount
          ? "参考图片已经随修改要求一起准备好。"
          : "参考图片需要从下方重新添加。";
        modal.appendChild(refBar);

        var gallery = document.createElement("div");
        gallery.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 2px;";
        for (var gi = 0; gi < annotations.length; gi++) {
          var ga = annotations[gi];
          if (!ga.refs || !ga.refs.length) continue;
          for (var gk = 0; gk < ga.refs.length; gk++) {
            (function (a, r, k) {
              if (!r.dataURL) return;
              var cell = document.createElement("div");
              cell.style.cssText = "width:72px;text-align:center;font-size:10px;color:#666;";
              var im = document.createElement("img");
              im.src = r.dataURL;
              im.title = refFileName(a, r, k) + "（点击下载）";
              im.style.cssText = "width:72px;height:72px;object-fit:cover;border:1px solid #e6e6e6;border-radius:6px;cursor:pointer;display:block;";
              im.onclick = function () {
                try {
                  var b = dataURLtoBlob(r.dataURL), u = URL.createObjectURL(b),
                      lk = document.createElement("a");
                  lk.href = u; lk.download = refFileName(a, r, k);
                  document.body.appendChild(lk); lk.click(); document.body.removeChild(lk);
                  setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
                } catch (e) {}
              };
              var cap = document.createElement("div");
              cap.textContent = refFileName(a, r, k);
              cap.style.cssText = "margin-top:2px;word-break:break-all;line-height:1.2;";
              cell.appendChild(im); cell.appendChild(cap);
              gallery.appendChild(cell);
            })(ga, ga.refs[gk], gk);
          }
        }
        modal.appendChild(gallery);
      }

      var footer = document.createElement("footer");
      var copyBtn = document.createElement("button");
      copyBtn.className = "annotator-primary";
      copyBtn.setAttribute("data-action", "copy");
      copyBtn.textContent = "复制修改要求";
      var closeBtn = document.createElement("button");
      closeBtn.className = "annotator-ghost";
      closeBtn.textContent = "关闭";
      if (refCount) {
        var dlBtn = document.createElement("button");
        dlBtn.className = "annotator-ghost";
        dlBtn.textContent = "重新下载参考图";
        dlBtn.onclick = function () {
          var m = downloadRefImages();
          showToast(m ? "已重新下载 " + m + " 张参考图" : "没有可下载的参考图");
        };
        footer.appendChild(dlBtn);
      }
      footer.appendChild(copyBtn);
      footer.appendChild(closeBtn);
      modal.appendChild(footer);

      mask.appendChild(modal);
      document.body.appendChild(mask);

      ta.focus();
      ta.select();

      function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
      closeBtn.onclick = close;
      modal.querySelector('[data-action="close"]').onclick = close;
      mask.addEventListener("click", function (e) { if (e.target === mask) close(); });

      copyBtn.onclick = function () {
        ta.focus();
        ta.select();
        copyText(ta.value, function (ok) {
          copyBtn.textContent = ok ? "已复制" : "请手动复制";
          if (!ok) ta.style.display = "block";
          setTimeout(function () { copyBtn.textContent = "复制修改要求"; }, 1800);
        });
      };
    } catch (err) {
      showToast("导出出错：" + (err && err.message ? err.message : err));
    }
  }

  // ---------- 轻量 toast ----------
  function showToast(msg) {
    var t = document.createElement("div");
    t.setAttribute("data-annotator", "true");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:2147483600;background:rgba(0,0,0,.85);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-family:-apple-system,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:80vw;text-align:center;";
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }

  // ---------- 沙箱兼容复制 ----------
  function copyText(str, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(function () { cb(true); }, function () { fallbackCopy(str, cb); });
    } else {
      fallbackCopy(str, cb);
    }
  }

  function fallbackCopy(str, cb) {
    try {
      var ta = document.createElement("textarea");
      ta.value = str;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.setAttribute("data-annotator", "true");
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      cb(ok);
    } catch (e) {
      cb(false);
    }
  }

  // ---------- 全局键盘 & 点击外部关闭输入框 ----------
  function onGlobalKey(e) {
    if (e.key === "Escape" && inputBox) {
      e.preventDefault();
      closeInput();
    } else if (e.key === "Escape" && active && !dragging) {
      toggleMode();
    }
  }

  function onGlobalMouseDown(e) {
    if (inputBox && !isAnnotatorElement(e.target) && !inputBox.contains(e.target)) {
      closeInput();
    }
  }

  // ---------- 多页面 pin 跟随 ----------
  function watchPages() {
    if (typeof MutationObserver === "undefined") return;
    var pages = document.querySelectorAll(".page");
    if (!pages.length) return;
    var obs = new MutationObserver(function () { renderPins(); });
    for (var i = 0; i < pages.length; i++) {
      obs.observe(pages[i], { attributes: true, attributeFilter: ["class"] });
    }
  }

  // ---------- 启动 ----------
  function boot() {
    injectStyle();
    buildUI();
    load();
    refreshCount();
    renderPins();

    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("mousedown", onGlobalMouseDown, true);
    document.addEventListener("keydown", onGlobalKey, true);

    // Pointer 事件统一鼠标 + 触摸 + 手写笔
    if (window.PointerEvent) {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("pointermove", onPointerMove, true);
      document.addEventListener("pointerup", onPointerUp, true);
      document.addEventListener("pointercancel", endDrag, true);
    } else {
      // 老浏览器降级：鼠标事件
      document.addEventListener("mousedown", onPointerDown, true);
      document.addEventListener("mousemove", onPointerMove, true);
      document.addEventListener("mouseup", onPointerUp, true);
    }

    window.addEventListener("scroll", renderPins, true);
    window.addEventListener("resize", renderPins);
    watchPages();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

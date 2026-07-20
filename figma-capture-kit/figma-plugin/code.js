(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // shared/task-protocol.js
  var require_task_protocol = __commonJS({
    "shared/task-protocol.js"(exports, module) {
      var EXPORTABLE_TYPES2 = /* @__PURE__ */ new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "GROUP", "SECTION"]);
      function safeNodeId(nodeId) {
        return String(nodeId || "node").replace(/[^a-zA-Z0-9_-]/g, "-");
      }
      function assertRelativeTaskPath(value) {
        const path = String(value || "").replace(/\\/g, "/");
        const parts = path.split("/");
        if (!path || path.startsWith("/") || /^[a-zA-Z]:\//.test(path) || parts.some((part) => part === ".." || part === "")) {
          throw new Error(`\u4E0D\u5B89\u5168\u7684\u4EFB\u52A1\u8DEF\u5F84: ${value}`);
        }
        return path;
      }
      function createTaskId2(randomUUID) {
        var _a;
        if (typeof randomUUID === "function") return randomUUID();
        const bytes = new Uint8Array(16);
        if ((_a = globalThis.crypto) == null ? void 0 : _a.getRandomValues) globalThis.crypto.getRandomValues(bytes);
        else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
        bytes[6] = bytes[6] & 15 | 64;
        bytes[8] = bytes[8] & 63 | 128;
        const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
      function createExportModel2(nodes, options = {}) {
        const scale = Number(options.scale) || 2;
        return (nodes || []).filter((node) => EXPORTABLE_TYPES2.has(node.type)).map((node) => ({
          nodeId: node.id,
          name: node.name,
          type: node.type,
          png: `pages/${safeNodeId(node.id)}.png`,
          svg: `pages/${safeNodeId(node.id)}.svg`,
          width: Math.round(node.width * scale),
          height: Math.round(node.height * scale),
          scale
        }));
      }
      function createUnifiedManifest2(input) {
        const capabilities = ["frame-png"];
        if ((input.assets || []).length || (input.pages || []).some((page) => page.svg)) capabilities.push("svg-assets");
        if (input.tokens) capabilities.push("tokens");
        if (input.hasLayerMetadata) capabilities.push("layer-metadata");
        return {
          schemaVersion: "1.0",
          exporter: { type: "figma-plugin", version: input.exporterVersion, capabilities },
          source: input.source,
          pages: (input.pages || []).map((page, index) => {
            var _a;
            return __spreadValues(__spreadProps(__spreadValues({
              id: `page-${safeNodeId(page.nodeId)}`,
              nodeId: page.nodeId,
              layerName: page.name,
              png: assertRelativeTaskPath(page.png)
            }, page.svg ? { svg: assertRelativeTaskPath(page.svg) } : {}), {
              width: page.width,
              height: page.height,
              scale: (_a = page.scale) != null ? _a : null,
              role: page.role || "page-reference",
              fidelity: page.fidelity || "strict",
              order: index
            }), page.children ? { children: page.children } : {});
          }),
          assets: input.assets || [],
          tokens: input.tokens || {},
          constraints: input.constraints || {
            prohibited: ["redraw-provided-assets"],
            lockedRegions: [],
            editableRegions: ["content-area"]
          }
        };
      }
      function createTaskEnvelope(input) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.taskId || "")) {
          throw new Error("taskId \u5FC5\u987B\u662F UUIDv4");
        }
        const seen = /* @__PURE__ */ new Set();
        const files = (input.files || []).map((file) => {
          const path = assertRelativeTaskPath(file.path);
          if (seen.has(path)) throw new Error(`\u4EFB\u52A1\u6587\u4EF6\u8DEF\u5F84\u91CD\u590D: ${path}`);
          seen.add(path);
          if (!/^[0-9a-f]{64}$/i.test(file.sha256 || "")) throw new Error(`SHA-256 \u975E\u6CD5: ${path}`);
          return __spreadProps(__spreadValues({}, file), { path });
        });
        return {
          taskSchemaVersion: "1.0",
          taskId: input.taskId,
          createdAt: input.createdAt,
          figma: input.figma,
          files
        };
      }
      module.exports = {
        EXPORTABLE_TYPES: EXPORTABLE_TYPES2,
        safeNodeId,
        assertRelativeTaskPath,
        createTaskId: createTaskId2,
        createExportModel: createExportModel2,
        createUnifiedManifest: createUnifiedManifest2,
        createTaskEnvelope
      };
    }
  });

  // shared/figma-extraction.js
  var require_figma_extraction = __commonJS({
    "shared/figma-extraction.js"(exports, module) {
      var ASSET_TYPES = /* @__PURE__ */ new Set(["VECTOR", "BOOLEAN_OPERATION", "INSTANCE", "COMPONENT"]);
      var STYLE_KEYS = ["fillStyleId", "strokeStyleId", "textStyleId", "effectStyleId", "gridStyleId"];
      function walk(nodes, visit) {
        for (const node of nodes || []) {
          visit(node);
          if (Array.isArray(node.children)) walk(node.children, visit);
        }
      }
      function collectAssetCandidates2(nodes) {
        const result = [];
        const seen = /* @__PURE__ */ new Set();
        walk(nodes, (node) => {
          const width = Number(node.width) || 0;
          const height = Number(node.height) || 0;
          const namedAsset = /(^|[\s/_-])(icon|ic|图标|logo)([\s/_-]|$)/i.test(node.name || "");
          const compactVector = width > 0 && height > 0 && width <= 64 && height <= 64;
          if (!ASSET_TYPES.has(node.type) || width > 256 || height > 256 || !namedAsset && !compactVector || seen.has(node.id)) return;
          seen.add(node.id);
          result.push(node);
        });
        return result;
      }
      function collectVariableIds(value, output) {
        if (!value) return;
        if (Array.isArray(value)) return value.forEach((item) => collectVariableIds(item, output));
        if (typeof value !== "object") return;
        if (typeof value.id === "string" && /variable/i.test(value.id)) output.add(value.id);
        for (const child of Object.values(value)) collectVariableIds(child, output);
      }
      function collectDesignReferences2(nodes) {
        const variableIds = /* @__PURE__ */ new Set();
        const styleIds = /* @__PURE__ */ new Set();
        walk(nodes, (node) => {
          collectVariableIds(node.boundVariables, variableIds);
          for (const key of STYLE_KEYS) {
            if (typeof node[key] === "string" && node[key]) styleIds.add(node[key]);
          }
        });
        return { variableIds, styleIds };
      }
      function createTokenSet2(input) {
        return {
          variables: (input.variables || []).map((item) => __spreadProps(__spreadValues({}, item), { source: "variable" })),
          styles: (input.styles || []).map((item) => __spreadProps(__spreadValues({}, item), { source: "style" })),
          observed: []
        };
      }
      module.exports = { walk, collectAssetCandidates: collectAssetCandidates2, collectDesignReferences: collectDesignReferences2, createTokenSet: createTokenSet2 };
    }
  });

  // figma-plugin/src/main.js
  var {
    EXPORTABLE_TYPES,
    createTaskId,
    createExportModel,
    createUnifiedManifest
  } = require_task_protocol();
  var { collectAssetCandidates, collectDesignReferences, createTokenSet } = require_figma_extraction();
  var PLUGIN_VERSION = "2.0.0";
  figma.showUI(__html__, { width: 360, height: 480 });
  function selection() {
    return (figma.currentPage.selection || []).filter((node) => EXPORTABLE_TYPES.has(node.type));
  }
  function selectionInfo() {
    return selection().map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      width: Math.round(node.width),
      height: Math.round(node.height)
    }));
  }
  function pushSelection() {
    figma.ui.postMessage({ type: "selection", items: selectionInfo() });
  }
  function bytesToBase64(bytes) {
    if (figma.base64Encode) return figma.base64Encode(bytes);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 32768));
    }
    return btoa(binary);
  }
  function serializeLayers(node, depth = 0) {
    var _a;
    if (depth > 5) return void 0;
    const result = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible !== false,
      width: Math.round(node.width || 0),
      height: Math.round(node.height || 0)
    };
    if (node.type === "TEXT") {
      result.text = {
        characters: node.characters,
        fontSize: node.fontSize === figma.mixed ? null : node.fontSize,
        fontName: node.fontName === figma.mixed ? null : node.fontName,
        fontWeight: node.fontWeight === figma.mixed ? null : node.fontWeight,
        lineHeight: node.lineHeight === figma.mixed ? null : node.lineHeight,
        letterSpacing: node.letterSpacing === figma.mixed ? null : node.letterSpacing,
        textAlignHorizontal: node.textAlignHorizontal,
        textAlignVertical: node.textAlignVertical
      };
    }
    if ("children" in node && ((_a = node.children) == null ? void 0 : _a.length)) {
      result.children = node.children.map((child) => serializeLayers(child, depth + 1)).filter(Boolean);
    }
    return result;
  }
  async function exportSelection(scale) {
    const nodes = selection();
    if (!nodes.length) throw new Error("\u8BF7\u5148\u5728 Figma \u4E2D\u9009\u4E2D\u4E00\u4E2A\u6216\u591A\u4E2A Frame\u3002");
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const taskId = createTaskId();
    const models = createExportModel(nodes, { scale });
    const files = [];
    const pages = [];
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const model = models[index];
      figma.ui.postMessage({ type: "progress", current: index + 1, total: nodes.length, name: node.name });
      const pngBytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } });
      files.push({ path: model.png, kind: "page-png", nodeId: node.id, b64: bytesToBase64(pngBytes) });
      let svg;
      try {
        const svgBytes = await node.exportAsync({ format: "SVG", svgOutlineText: false, svgIdAttribute: true });
        svg = model.svg;
        files.push({ path: svg, kind: "page-svg", nodeId: node.id, b64: bytesToBase64(svgBytes) });
      } catch (e) {
      }
      pages.push(__spreadProps(__spreadValues(__spreadValues({}, model), svg ? { svg } : {}), { children: serializeLayers(node) }));
    }
    const assets = [];
    for (const assetNode of collectAssetCandidates(nodes)) {
      try {
        const bytes = await assetNode.exportAsync({ format: "SVG", svgOutlineText: false, svgIdAttribute: true });
        const path = `assets/${assetNode.id.replace(/[^a-zA-Z0-9_-]/g, "-")}.svg`;
        files.push({ path, kind: "asset-svg", nodeId: assetNode.id, b64: bytesToBase64(bytes) });
        assets.push({
          id: assetNode.id,
          name: assetNode.name,
          file: path,
          type: "svg",
          source: "figma-node",
          usage: "reference-directly"
        });
      } catch (e) {
      }
    }
    const references = collectDesignReferences(nodes);
    const variables = [];
    for (const id of references.variableIds) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (!variable) continue;
        const firstMode = Object.keys(variable.valuesByMode || {})[0];
        variables.push({
          id: variable.id,
          name: variable.name,
          resolvedType: variable.resolvedType,
          value: firstMode ? variable.valuesByMode[firstMode] : null,
          collectionId: variable.variableCollectionId
        });
      } catch (e) {
      }
    }
    const styles = [];
    for (const id of references.styleIds) {
      try {
        const style = await figma.getStyleByIdAsync(id);
        if (!style) continue;
        styles.push({ id: style.id, name: style.name, type: style.type, description: style.description || "" });
      } catch (e) {
      }
    }
    const tokens = variables.length || styles.length ? createTokenSet({ variables, styles }) : null;
    const source = {
      fileKey: figma.fileKey || null,
      fileName: figma.root.name,
      pageName: figma.currentPage.name,
      exportedAt: createdAt
    };
    const manifest = createUnifiedManifest({
      exporterVersion: PLUGIN_VERSION,
      source,
      pages,
      assets,
      tokens,
      hasLayerMetadata: true
    });
    return {
      taskId,
      createdAt,
      figma: { fileKey: source.fileKey, fileName: source.fileName, pageName: source.pageName },
      manifest,
      files
    };
  }
  figma.on("selectionchange", pushSelection);
  pushSelection();
  figma.ui.onmessage = async (message) => {
    if (message.type === "refresh") return pushSelection();
    if (message.type !== "export-task") return;
    try {
      const payload = await exportSelection(Number(message.scale) || 2);
      figma.ui.postMessage({ type: "export-ready", payload });
    } catch (error) {
      figma.ui.postMessage({ type: "error", message: String((error == null ? void 0 : error.message) || error) });
    }
  };
})();

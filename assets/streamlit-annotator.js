(function () {
  'use strict';

  if (window.__HTML_EDITOR_STREAMLIT__) return;

  var document = window.document;
  var TEXT_LIMIT = 240;

  function normalizedText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  }

  function testIdOf(element) {
    return element.getAttribute('data-testid') || '';
  }

  function componentTypeOf(element) {
    var tag = element.tagName.toLowerCase();
    var type = (element.getAttribute('type') || '').toLowerCase();
    var testId = testIdOf(element).toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag === 'input' && type === 'checkbox') return 'checkbox';
    if (tag === 'input' && type === 'radio') return 'radio';
    if (tag === 'input' && (!type || ['text', 'search', 'email', 'number', 'password', 'url', 'tel'].indexOf(type) !== -1)) return 'text input';
    if (tag === 'img') return 'image';
    if (/dataframe|table/.test(testId)) return 'dataframe';
    if (/chart|vega|plotly|pyplot|graphviz|deckgl/.test(testId)) return 'chart';
    if (/metric/.test(testId)) return 'metric';
    if (/markdown|text/.test(testId) || /^(p|h[1-6]|pre|blockquote)$/.test(tag)) return 'markdown/text';
    if (tag === 'form' || /form/.test(testId)) return 'form';
    if (/column/.test(testId)) return 'column';
    if (/sidebar/.test(testId)) return 'sidebar';
    if (/verticalblock|container|expander|tabs?/.test(testId)) return 'container';
    return 'unknown';
  }

  function visibleTextOf(element) {
    if (element.tagName.toLowerCase() === 'img') {
      return normalizedText(element.getAttribute('alt'));
    }
    if (/^(input|textarea|select)$/i.test(element.tagName)) {
      return normalizedText(element.value || element.getAttribute('placeholder'));
    }
    return normalizedText(element.textContent);
  }

  function associatedLabel(element, context) {
    var id = element.getAttribute('id');
    if (id) {
      if (context && context.labelsByFor.has(id)) return context.labelsByFor.get(id);
      var labels = document.querySelectorAll('label[for]');
      for (var i = 0; i < labels.length; i += 1) {
        if (labels[i].getAttribute('for') === id) return normalizedText(labels[i].textContent);
      }
    }
    var wrappingLabel = element.closest('label');
    return wrappingLabel ? normalizedText(wrappingLabel.textContent) : '';
  }

  function accessibleNameOf(element, context) {
    var aria = normalizedText(element.getAttribute('aria-label'));
    if (aria) return aria;
    var labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      var labelledText = labelledBy.split(/\s+/).map(function (id) {
        var node = document.getElementById(id);
        return node ? node.textContent : '';
      }).join(' ');
      if (normalizedText(labelledText)) return normalizedText(labelledText);
    }
    var label = associatedLabel(element, context);
    if (label) return label;
    var tag = element.tagName.toLowerCase();
    if (tag === 'button') return normalizedText(element.textContent);
    if (tag === 'img') {
      var alt = normalizedText(element.getAttribute('alt'));
      if (alt) return alt;
      var figure = element.closest('figure');
      var caption = figure && figure.querySelector('figcaption');
      return caption ? normalizedText(caption.textContent) : '';
    }
    return '';
  }

  function pageIdentity() {
    var heading = document.querySelector('[data-testid="stAppViewContainer"] main h1, main h1, [data-testid="stAppViewContainer"] h1');
    var current = document.querySelector('nav [aria-current="page"], nav [aria-selected="true"], [data-testid*="SidebarNav"] [aria-current="page"]');
    return [
      window.location.pathname || '/',
      heading ? normalizedText(heading.textContent) : '',
      current ? normalizedText(current.textContent) : ''
    ].join('|');
  }

  function columnIndex(column) {
    var parent = column.parentElement;
    if (!parent) return 1;
    var columns = Array.prototype.filter.call(parent.children, function (child) {
      return /column/i.test(testIdOf(child));
    });
    return Math.max(1, columns.indexOf(column) + 1);
  }

  function containerPathOf(element) {
    var entries = [];
    var ancestry = [];
    for (var node = element.parentElement; node; node = node.parentElement) ancestry.unshift(node);
    ancestry.forEach(function (ancestor) {
      var tag = ancestor.tagName.toLowerCase();
      var testId = testIdOf(ancestor);
      var lowered = testId.toLowerCase();
      var entry = '';
      if (/sidebar/.test(lowered)) entry = 'sidebar';
      else if (tag === 'main') entry = 'main';
      else if (tag === 'form' || /form/.test(lowered)) entry = 'form';
      else if (/expander/.test(lowered)) entry = 'expander';
      else if (/tabs?/.test(lowered)) entry = 'tabs';
      else if (/column/.test(lowered)) entry = 'column:' + columnIndex(ancestor);
      else if (/verticalblock|container/.test(lowered) && lowered !== 'stappviewcontainer') entry = 'container';
      if (entry && entries[entries.length - 1] !== entry) entries.push(entry);
    });
    if (!entries.length) entries.push('main');
    return entries;
  }

  function meaningfulTextNodes() {
    var root = document.querySelector('[data-testid="stAppViewContainer"] main, main') || document.body;
    return Array.prototype.filter.call(root.querySelectorAll('button,label,p,h2,h3,h4,h5,h6,li,figcaption,[data-testid="stMetric"]'), function (node) {
      return !!normalizedText(node.textContent);
    });
  }

  function neighborTextOf(element, context) {
    if (context && context.nodeIndexes.has(element)) {
      var elementIndex = context.nodeIndexes.get(element);
      var beforeNode = context.previousMeaningful[elementIndex];
      var afterNode = context.nextMeaningful[elementIndex];
      while (beforeNode && (beforeNode.contains(element) || element.contains(beforeNode))) {
        beforeNode = context.previousMeaningful[context.nodeIndexes.get(beforeNode)];
      }
      while (afterNode && (afterNode.contains(element) || element.contains(afterNode))) {
        afterNode = context.nextMeaningful[context.nodeIndexes.get(afterNode)];
      }
      return [
        beforeNode ? normalizedText(beforeNode.textContent) : '',
        afterNode ? normalizedText(afterNode.textContent) : ''
      ].filter(Boolean);
    }
    var nodes = meaningfulTextNodes();
    var before = '';
    var after = '';
    nodes.forEach(function (node) {
      if (node === element || node.contains(element) || element.contains(node)) return;
      var position = node.compareDocumentPosition(element);
      if (position & window.Node.DOCUMENT_POSITION_FOLLOWING) before = normalizedText(node.textContent);
      if (!after && position & window.Node.DOCUMENT_POSITION_PRECEDING) after = normalizedText(node.textContent);
    });
    return [before, after].filter(Boolean);
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function domSelectorOf(element) {
    var tag = element.tagName.toLowerCase();
    var testId = testIdOf(element);
    if (testId) return tag + '[data-testid="' + cssEscape(testId) + '"]';
    var id = element.getAttribute('id');
    if (id) return '#' + cssEscape(id);
    return tag;
  }

  function widgetKeyOf(element) {
    var node = element;
    while (node && node !== document.documentElement) {
      var key = node.getAttribute('data-widget-key') || node.getAttribute('data-key');
      if (key) return key;
      node = node.parentElement;
    }
    return null;
  }

  function fingerprintElementWithContext(element, context) {
    if (!element || element.nodeType !== 1) throw new TypeError('fingerprint requires an Element');
    return {
      adapter: 'streamlit',
      page: context ? context.page : pageIdentity(),
      componentType: componentTypeOf(element),
      visibleText: visibleTextOf(element),
      testId: testIdOf(element),
      accessibleName: accessibleNameOf(element, context),
      widgetKey: widgetKeyOf(element),
      containerPath: containerPathOf(element),
      neighborText: neighborTextOf(element, context),
      domSelector: domSelectorOf(element)
    };
  }

  function fingerprintElement(element) {
    return fingerprintElementWithContext(element, null);
  }

  function sameArray(left, right) {
    return JSON.stringify(left || []) === JSON.stringify(right || []);
  }

  function score(candidate, expected, context) {
    var actual = fingerprintElementWithContext(candidate, context);
    if (expected.widgetKey && actual.widgetKey !== expected.widgetKey) {
      return { total: 0, strongIdentity: false, contextualSignals: 0 };
    }
    var strongIdentity = (
      !!expected.widgetKey && actual.widgetKey === expected.widgetKey
    ) || (
      !!expected.visibleText && actual.visibleText === expected.visibleText
    ) || (
      !!expected.accessibleName && actual.accessibleName === expected.accessibleName
    ) || (
      ['chart', 'dataframe'].indexOf(expected.componentType) !== -1 &&
      !!expected.testId &&
      actual.testId === expected.testId
    );
    var total = 0;
    if (actual.componentType === expected.componentType) total += 25;
    if (expected.visibleText && actual.visibleText === expected.visibleText) total += 30;
    if (expected.accessibleName && actual.accessibleName === expected.accessibleName) total += 25;
    if (expected.testId && actual.testId === expected.testId) total += 15;
    if (expected.widgetKey && actual.widgetKey === expected.widgetKey) total += 35;
    if (sameArray(actual.containerPath, expected.containerPath)) total += 8;
    if (sameArray(actual.neighborText, expected.neighborText)) total += 5;
    if (expected.domSelector && actual.domSelector === expected.domSelector) total += 2;
    var contextualSignals = 0;
    if (expected.testId && actual.testId === expected.testId) contextualSignals += 1;
    if (sameArray(actual.containerPath, expected.containerPath)) contextualSignals += 1;
    if (
      expected.neighborText &&
      expected.neighborText.length &&
      sameArray(actual.neighborText, expected.neighborText)
    ) contextualSignals += 1;
    if (expected.domSelector && actual.domSelector === expected.domSelector) contextualSignals += 1;
    return {
      total: total,
      strongIdentity: strongIdentity,
      contextualSignals: contextualSignals,
      neighborsConflict: !!(
        expected.neighborText &&
        expected.neighborText.length &&
        !sameArray(actual.neighborText, expected.neighborText)
      )
    };
  }

  function matchingContext(root) {
    var labelsByFor = new Map();
    var allNodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
    var nodeIndexes = new Map();
    var meaningfulSelector = 'button,label,p,h2,h3,h4,h5,h6,li,figcaption,[data-testid="stMetric"]';
    allNodes.forEach(function (node, index) {
      nodeIndexes.set(node, index);
      if (node.matches('label[for]')) {
        var target = node.getAttribute('for');
        if (target && !labelsByFor.has(target)) labelsByFor.set(target, normalizedText(node.textContent));
      }
    });
    var previousMeaningful = [];
    var previous = null;
    allNodes.forEach(function (node, index) {
      previousMeaningful[index] = previous;
      if (node.matches(meaningfulSelector) && normalizedText(node.textContent)) previous = node;
    });
    var nextMeaningful = [];
    var next = null;
    for (var index = allNodes.length - 1; index >= 0; index -= 1) {
      nextMeaningful[index] = next;
      if (allNodes[index].matches(meaningfulSelector) && normalizedText(allNodes[index].textContent)) {
        next = allNodes[index];
      }
    }
    return {
      page: pageIdentity(),
      allNodes: allNodes,
      labelsByFor: labelsByFor,
      nodeIndexes: nodeIndexes,
      previousMeaningful: previousMeaningful,
      nextMeaningful: nextMeaningful
    };
  }

  function candidateSelector(type) {
    var selectors = {
      button: 'button',
      'text input': 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="number"],input[type="password"],input[type="url"],input[type="tel"]',
      textarea: 'textarea',
      select: 'select',
      checkbox: 'input[type="checkbox"]',
      radio: 'input[type="radio"]',
      image: 'img',
      dataframe: '[data-testid]',
      chart: '[data-testid]',
      metric: '[data-testid]',
      'markdown/text': 'p,h1,h2,h3,h4,h5,h6,pre,blockquote,[data-testid]',
      form: 'form,[data-testid]',
      column: '[data-testid]',
      container: '[data-testid]',
      sidebar: '[data-testid]'
    };
    return selectors[type] || '*';
  }

  function createMatchingSession() {
    var root = document.querySelector('[data-testid="stAppViewContainer"]') || document.body;
    return {
      root: root,
      context: matchingContext(root),
      candidatesByType: new Map()
    };
  }

  function matchingCandidates(session, type) {
    if (!session.candidatesByType.has(type)) {
      var selector = candidateSelector(type);
      var source = selector === '*'
        ? session.context.allNodes.slice(1)
        : session.root.querySelectorAll(selector);
      var candidates = Array.prototype.filter.call(source, function (element) {
        return componentTypeOf(element) === type;
      });
      session.candidatesByType.set(type, candidates);
    }
    return session.candidatesByType.get(type);
  }

  function matchFingerprintWithSession(fingerprint, session) {
    if (!fingerprint || fingerprint.adapter !== 'streamlit') {
      return { status: 'missing' };
    }
    var context = session.context;
    if (fingerprint.page !== context.page) return { status: 'missing' };
    var candidates = matchingCandidates(session, fingerprint.componentType);
    var ranked = candidates.map(function (element) {
      var result = score(element, fingerprint, context);
      return {
        element: element,
        score: result.total,
        strongIdentity: result.strongIdentity,
        contextualSignals: result.contextualSignals,
        neighborsConflict: result.neighborsConflict
      };
    }).filter(function (entry) {
      return entry.strongIdentity &&
        entry.score >= 50 &&
        !entry.neighborsConflict &&
        (fingerprint.widgetKey || entry.contextualSignals >= 2);
    }).sort(function (a, b) {
      return b.score - a.score;
    });
    if (!ranked.length) return { status: 'missing' };
    if (ranked.length > 1 && ranked[0].score - ranked[1].score < 10) return { status: 'ambiguous' };
    return { status: 'matched', element: ranked[0].element };
  }

  function matchFingerprint(fingerprint) {
    return matchFingerprintWithSession(fingerprint, createMatchingSession());
  }

  var ownedNodes = [];
  var listeners = [];
  var annotations = [];
  var marking = false;
  var suppressClick = false;
  var dragStart = null;
  var dragCurrent = null;
  var selected = null;
  var editingIndex = null;
  var config = window.__HTML_EDITOR_STREAMLIT_CONFIG__ || {};
  var storageAvailable = true;
  var pinFrame = null;
  var mutationObserver = null;
  var observedRoot = null;
  var destroyed = false;

  function own(node) {
    ownedNodes.push(node);
    return node;
  }

  function listen(target, type, handler, capture) {
    target.addEventListener(type, handler, capture);
    listeners.push([target, type, handler, capture]);
  }

  function storageKey() {
    return [
      'ann-st',
      window.location.origin,
      window.location.pathname,
      config.projectName || '',
      config.projectFingerprint || ''
    ].join('::');
  }

  function useStorage(action) {
    try {
      return action(window.localStorage);
    } catch (error) {
      storageAvailable = false;
      showStorageWarning();
      return null;
    }
  }

  function restoreAnnotations() {
    var raw = useStorage(function (storage) { return storage.getItem(storageKey()); });
    if (!raw) return;
    try {
      var restored = JSON.parse(raw);
      var records;
      if (Array.isArray(restored)) {
        records = restored;
      } else if (
        restored &&
        restored.schemaVersion === '1.1' &&
        restored.adapter === 'streamlit' &&
        restored.projectFingerprint === config.projectFingerprint &&
        Array.isArray(restored.annotations)
      ) {
        records = restored.annotations;
      } else {
        return;
      }
      var normalized = records.map(normalizeStoredAnnotation);
      annotations = normalized.filter(Boolean);
      if (Array.isArray(restored)) persistAnnotations();
    } catch (error) {
      annotations = [];
    }
  }

  function persistAnnotations() {
    useStorage(function (storage) {
      storage.setItem(storageKey(), JSON.stringify({
        schemaVersion: '1.1',
        adapter: 'streamlit',
        projectFingerprint: config.projectFingerprint,
        annotations: annotations
      }));
    });
  }

  function storedString(value) {
    if (typeof value !== 'string') return null;
    return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TEXT_LIMIT);
  }

  function stringArray(value) {
    if (typeof value === 'string') value = [value];
    if (!Array.isArray(value)) return [];
    return value.map(storedString).filter(function (item) { return item !== null; });
  }

  function normalizeStoredAnnotation(record) {
    if (!record || record.adapter !== 'streamlit') return null;
    var required = ['page', 'componentType', 'visibleText', 'intent'];
    if (required.some(function (field) { return typeof record[field] !== 'string'; })) return null;
    var normalized = Object.assign({}, record);
    [
      'page', 'componentType', 'visibleText', 'intent', 'testId',
      'accessibleName', 'domSelector'
    ].forEach(function (field) {
      var value = storedString(record[field] === undefined ? '' : record[field]);
      normalized[field] = value === null ? '' : value;
    });
    normalized.projectFingerprint = config.projectFingerprint;
    normalized.widgetKey = typeof record.widgetKey === 'string' ? storedString(record.widgetKey) : null;
    normalized.containerPath = stringArray(record.containerPath);
    normalized.neighborText = stringArray(record.neighborText);
    normalized.changes = Array.isArray(record.changes) ? record.changes : [];
    normalized.scope = 'target-only';
    normalized.confidence = ['high', 'medium', 'low'].indexOf(record.confidence) !== -1
      ? record.confidence
      : 'low';
    normalized.matchStatus = ['matched', 'missing', 'ambiguous'].indexOf(record.matchStatus) !== -1
      ? record.matchStatus
      : 'matched';
    if (record.componentType === 'region') {
      var region = record.region;
      var legacyBounds = normalizeBounds(region);
      if (legacyBounds) {
        normalized.region = {
          regionModel: 'legacy-coordinate',
          commonContainer: null,
          members: [],
          bounds: legacyBounds
        };
        normalized.confidence = 'low';
        normalized.matchStatus = 'missing';
        return normalized;
      }
      if (!region || !region.commonContainer || !Array.isArray(region.members) || !region.members.length) {
        return null;
      }
      var commonContainer = normalizeFingerprint(region.commonContainer);
      var members = region.members.map(normalizeFingerprint);
      var bounds = normalizeBounds(region.bounds);
      if (!commonContainer || members.some(function (member) { return !member; }) || !bounds) return null;
      normalized.region = {
        regionModel: 'semantic-v1',
        commonContainer: commonContainer,
        members: members,
        bounds: bounds
      };
    }
    return normalized;
  }

  function normalizeFingerprint(record) {
    if (!record || record.adapter !== 'streamlit') return null;
    var required = ['page', 'componentType', 'visibleText'];
    if (required.some(function (field) { return typeof record[field] !== 'string'; })) return null;
    return {
      adapter: 'streamlit',
      page: storedString(record.page) || '',
      componentType: storedString(record.componentType) || 'unknown',
      visibleText: storedString(record.visibleText) || '',
      testId: storedString(record.testId || '') || '',
      accessibleName: storedString(record.accessibleName || '') || '',
      widgetKey: typeof record.widgetKey === 'string' ? storedString(record.widgetKey) : null,
      containerPath: stringArray(record.containerPath),
      neighborText: stringArray(record.neighborText),
      domSelector: storedString(record.domSelector || '') || ''
    };
  }

  function normalizeBounds(bounds) {
    if (
      !bounds ||
      ['x', 'y', 'width', 'height'].some(function (field) {
        return typeof bounds[field] !== 'number' || !Number.isFinite(bounds[field]);
      })
    ) return null;
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }

  function isOpaqueElement(element) {
    var tag = element && element.tagName ? element.tagName.toLowerCase() : '';
    return tag === 'iframe' || tag === 'canvas' || !!(element && element.shadowRoot);
  }

  function usableRect(element) {
    var rect = element.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom
    };
  }

  function boundsOfElements(elements) {
    var rects = elements.map(usableRect).filter(Boolean);
    if (!rects.length) return null;
    var left = Math.min.apply(Math, rects.map(function (rect) { return rect.x; }));
    var top = Math.min.apply(Math, rects.map(function (rect) { return rect.y; }));
    var right = Math.max.apply(Math, rects.map(function (rect) { return rect.right; }));
    var bottom = Math.max.apply(Math, rects.map(function (rect) { return rect.bottom; }));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function commonContainerOf(elements) {
    if (!elements.length) return null;
    if (elements.length === 1) return elements[0].parentElement;
    var ancestry = [];
    for (var candidate = elements[0].parentElement; candidate; candidate = candidate.parentElement) {
      ancestry.push(candidate);
    }
    for (var index = 0; index < ancestry.length; index += 1) {
      var common = ancestry[index];
      var belongs = elements.slice(1).every(function (element) {
        for (var ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (ancestor === common) return true;
        }
        return false;
      });
      if (belongs) return common;
    }
    return null;
  }

  function semanticCandidate(element, root) {
    var fallback = null;
    for (var current = element; current && current !== root; current = current.parentElement) {
      var type = componentTypeOf(current);
      var ownKey = current.getAttribute('data-widget-key') || current.getAttribute('data-key');
      if (type !== 'unknown' || ownKey) return current;
      if (!fallback && (visibleTextOf(current) || accessibleNameOf(current))) fallback = current;
    }
    return fallback;
  }

  function semanticRegionFromDrag(region) {
    var root = document.querySelector('[data-testid="stAppViewContainer"]') || document.body;
    var right = region.x + region.width;
    var bottom = region.y + region.height;
    var semanticSelector = [
      'button', 'input', 'textarea', 'select', 'img', 'canvas', 'iframe',
      '[data-widget-key]', '[data-key]', '[data-testid]',
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'form'
    ].join(',');
    var candidateSet = new Set();
    Array.prototype.forEach.call(root.querySelectorAll(semanticSelector), function (element) {
      if (isOwned(element) || /^(script|style)$/i.test(element.tagName)) return false;
      var semantic = semanticCandidate(element, root);
      if (semantic && !isOwned(semantic)) candidateSet.add(semantic);
    });
    var candidates = Array.from(candidateSet).filter(function (element) {
      var rect = usableRect(element);
      if (!rect) return false;
      var overlapWidth = Math.max(0, Math.min(right, rect.right) - Math.max(region.x, rect.x));
      var overlapHeight = Math.max(0, Math.min(bottom, rect.bottom) - Math.max(region.y, rect.y));
      return overlapWidth * overlapHeight / (rect.width * rect.height) >= 0.6;
    });
    var selected = new Set(candidates);
    candidates.forEach(function (candidate) {
      for (var ancestor = candidate.parentElement; ancestor; ancestor = ancestor.parentElement) {
        selected.delete(ancestor);
      }
    });
    candidates = Array.from(selected);
    if (!candidates.length) {
      var fallback = document.elementFromPoint(region.x + region.width / 2, region.y + region.height / 2);
      if (fallback && !isOwned(fallback)) candidates = [fallback];
    }
    var common = commonContainerOf(candidates);
    if (!common || !candidates.length) return null;
    var fingerprintContext = matchingContext(root);
    return {
      regionModel: 'semantic-v1',
      commonContainer: fingerprintElementWithContext(common, fingerprintContext),
      members: candidates.map(function (element) {
        return fingerprintElementWithContext(element, fingerprintContext);
      }),
      bounds: boundsOfElements(candidates)
    };
  }

  function resolveRegion(annotation, session) {
    if (
      !annotation.region ||
      annotation.region.regionModel === 'legacy-coordinate' ||
      annotation.page !== pageIdentity()
    ) return { status: 'missing' };
    session = session || createMatchingSession();
    var common = matchFingerprintWithSession(annotation.region.commonContainer, session);
    if (common.status !== 'matched') return { status: common.status };
    var members = annotation.region.members.map(function (member) {
      return matchFingerprintWithSession(member, session);
    });
    if (members.some(function (result) { return result.status === 'ambiguous'; })) {
      return { status: 'ambiguous' };
    }
    if (members.some(function (result) { return result.status !== 'matched'; })) {
      return { status: 'missing' };
    }
    var bounds = boundsOfElements(members.map(function (result) { return result.element; }));
    return bounds ? { status: 'matched', bounds: bounds } : { status: 'missing' };
  }

  function node(tag, attributes, text) {
    var element = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (name) {
      if (name === 'className') element.className = attributes[name];
      else element.setAttribute(name, attributes[name]);
    });
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function remove(id) {
    var element = document.getElementById(id);
    if (element) element.remove();
  }

  function showStorageWarning() {
    if (document.getElementById('ann-st-storage-warning') || !document.body) return;
    var warning = own(node('div', {
      id: 'ann-st-storage-warning',
      role: 'status'
    }, '浏览器存储不可用：修改仅保留在当前会话，刷新后不会保留。'));
    document.body.appendChild(warning);
  }

  function renderPins(existingMatchingSession) {
    var overlay = document.getElementById('ann-st-overlay');
    if (!overlay) return;
    overlay.textContent = '';
    var matchingSession = annotations.length
      ? (existingMatchingSession || createMatchingSession())
      : null;
    annotations.forEach(function (annotation, index) {
      var left;
      var top;
      if (annotation.region) {
        var regionMatch = resolveRegion(annotation, matchingSession);
        annotation.matchStatus = regionMatch.status;
        if (regionMatch.status !== 'matched') {
          annotation.confidence = 'low';
          return;
        }
        annotation.region.bounds = regionMatch.bounds;
        left = regionMatch.bounds.x + regionMatch.bounds.width - 8;
        top = regionMatch.bounds.y - 8;
      } else {
        var matched = matchFingerprintWithSession(annotation, matchingSession);
        annotation.matchStatus = matched.status;
        if (matched.status !== 'matched') {
          annotation.confidence = 'low';
          return;
        }
        var rect = matched.element.getBoundingClientRect();
        left = rect.right - 8;
        top = rect.top - 8;
      }
      var pin = node('button', {
        type: 'button',
        'data-role': 'pin',
        'data-index': String(index),
        title: annotation.intent
      }, String(index + 1));
      pin.style.left = left + 'px';
      pin.style.top = top + 'px';
      overlay.appendChild(pin);
    });
  }

  function schedulePins() {
    if (pinFrame != null || destroyed) return;
    pinFrame = window.requestAnimationFrame(function () {
      if (destroyed) return;
      pinFrame = null;
      renderPins();
    });
  }

  function observeStreamlitRoot() {
    if (!mutationObserver) return;
    var nextRoot = document.querySelector('[data-testid="stAppViewContainer"]') || document.body;
    if (nextRoot === observedRoot) return;
    mutationObserver.disconnect();
    observedRoot = nextRoot;
    mutationObserver.observe(observedRoot, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'aria-current', 'aria-selected', 'hidden', 'data-testid', 'class', 'value'
      ]
    });
    if (observedRoot.parentNode && observedRoot !== document.body) {
      mutationObserver.observe(observedRoot.parentNode, { childList: true });
    }
  }

  function isAnnotationNode(node) {
    if (!node) return false;
    var element = node.nodeType === 1 ? node : node.parentElement;
    return !!(element && (
      (element.id && element.id.indexOf('ann-st-') === 0) ||
      (element.closest && element.closest('[id^="ann-st-"]'))
    ));
  }

  function hasBusinessMutation(records) {
    return records.some(function (record) {
      if (isAnnotationNode(record.target)) return false;
      var changed = Array.prototype.slice.call(record.addedNodes)
        .concat(Array.prototype.slice.call(record.removedNodes));
      return !changed.length || changed.some(function (changedNode) {
        return !isAnnotationNode(changedNode);
      });
    });
  }

  function closePanels() {
    remove('ann-st-inspector');
    remove('ann-st-list');
    remove('ann-st-export');
    remove('ann-st-manual-copy');
  }

  function showInspector(selection, index) {
    closePanels();
    selected = selection;
    editingIndex = index === undefined ? null : index;
    var panel = own(node('section', { id: 'ann-st-inspector', role: 'dialog' }));
    panel.appendChild(node('h2', {}, editingIndex === null ? '添加修改' : '编辑修改'));
    panel.appendChild(node('p', { 'data-role': 'context' },
      selection.region ? '已选择矩形区域' : '已选中：' + selection.visibleText));
    panel.appendChild(node('label', {}, '请用自然语言描述你希望如何修改'));
    var input = node('textarea', { placeholder: '例如：按钮文案改得更明确' });
    input.value = editingIndex === null ? '' : annotations[editingIndex].intent;
    panel.appendChild(input);
    var save = node('button', { type: 'button', 'data-action': 'save' }, '保存');
    var cancel = node('button', { type: 'button', 'data-action': 'cancel' }, '取消');
    panel.appendChild(save);
    panel.appendChild(cancel);
    save.addEventListener('click', function () {
      var intent = normalizedText(input.value);
      if (!intent) return;
      if (editingIndex === null) {
        var annotation;
        if (selection.region) {
          var commonFingerprint = selection.region.commonContainer;
          annotation = {
            adapter: 'streamlit',
            projectFingerprint: config.projectFingerprint || null,
            page: pageIdentity(),
            componentType: 'region',
            visibleText: selection.region.members.map(function (member) {
              return member.visibleText;
            }).filter(Boolean).join(' / '),
            accessibleName: commonFingerprint.accessibleName,
            testId: commonFingerprint.testId,
            widgetKey: commonFingerprint.widgetKey,
            containerPath: commonFingerprint.containerPath,
            neighborText: commonFingerprint.neighborText,
            domSelector: commonFingerprint.domSelector,
            region: selection.region
          };
        } else {
          annotation = fingerprintElement(selection.element);
          annotation.projectFingerprint = config.projectFingerprint || null;
        }
        var saveMatchingSession = selection.region ? createMatchingSession() : null;
        annotation.confidence = selection.region
          ? (selection.region.members.some(function (member) {
            var memberMatch = matchFingerprintWithSession(member, saveMatchingSession);
            return memberMatch.status !== 'matched' ||
              (memberMatch.element && isOpaqueElement(memberMatch.element));
          }) ? 'low' : 'high')
          : (isOpaqueElement(selection.element) ? 'low' : 'high');
        annotation.intent = intent;
        annotation.changes = [];
        annotation.scope = 'target-only';
        annotation.matchStatus = 'matched';
        annotations.push(annotation);
      } else {
        annotations[editingIndex].intent = intent;
      }
      persistAnnotations();
      remove('ann-st-inspector');
      selected = null;
      editingIndex = null;
      renderPins(saveMatchingSession);
    });
    cancel.addEventListener('click', function () {
      remove('ann-st-inspector');
      selected = null;
      editingIndex = null;
      suppressClick = false;
    });
    document.body.appendChild(panel);
    input.focus();
  }

  function showList() {
    closePanels();
    var panel = own(node('section', { id: 'ann-st-list', role: 'dialog' }));
    panel.appendChild(node('h2', {}, '我的修改'));
    var listMatchingSession = annotations.length ? createMatchingSession() : null;
    annotations.forEach(function (annotation, index) {
      var currentMatch = annotation.region
        ? resolveRegion(annotation, listMatchingSession)
        : matchFingerprintWithSession(annotation, listMatchingSession);
      annotation.matchStatus = currentMatch.status;
      if (currentMatch.status !== 'matched') annotation.confidence = 'low';
      var item = node('article', { 'data-index': String(index) });
      item.appendChild(node('p', {}, (index + 1) + '. ' + annotation.intent));
      item.appendChild(node('p', { 'data-role': 'match-status' },
        currentMatch.status === 'matched' ? '已匹配' :
          currentMatch.status === 'ambiguous' ? '有歧义' : '未匹配'));
      var edit = node('button', { type: 'button', 'data-action': 'edit' }, '编辑');
      var del = node('button', { type: 'button', 'data-action': 'delete' }, '删除');
      edit.addEventListener('click', function () {
        showInspector(annotation.region ? { region: annotation.region } : {
          element: currentMatch.element || null,
          visibleText: annotation.visibleText
        }, index);
      });
      del.addEventListener('click', function () {
        annotations.splice(index, 1);
        persistAnnotations();
        showList();
        renderPins();
      });
      item.appendChild(edit);
      item.appendChild(del);
      panel.appendChild(item);
    });
    var clear = node('button', { type: 'button', 'data-action': 'clear' }, '清空全部');
    clear.addEventListener('click', function () {
      annotations = [];
      persistAnnotations();
      showList();
      renderPins();
    });
    panel.appendChild(clear);
    document.body.appendChild(panel);
  }

  function readableExport() {
    var sections = annotations.map(function (annotation, index) {
      return [
        '修改 ' + (index + 1),
        '页面：' + safeExportText(annotation.page),
        '组件：' + safeExportText(annotation.componentType),
        '可见文字：' + (safeExportText(annotation.visibleText) || '无'),
        '邻近文字：' + ((annotation.neighborText || []).map(safeExportText).join(' / ') || '无'),
        '意图：' + safeExportText(annotation.intent)
      ].join('\n');
    }).join('\n\n');
    var data = {
      schemaVersion: '1.1',
      adapter: 'streamlit',
      projectFingerprint: config.projectFingerprint || null,
      annotations: annotations.map(function (annotation) {
        var exported = {
          page: safeExportText(annotation.page),
          componentType: safeExportText(annotation.componentType),
          visibleText: safeExportText(annotation.visibleText),
          testId: safeExportText(annotation.testId),
          accessibleName: safeExportText(annotation.accessibleName),
          widgetKey: annotation.widgetKey ? safeExportText(annotation.widgetKey) : null,
          containerPath: (annotation.containerPath || []).map(safeExportText),
          neighborText: (annotation.neighborText || []).map(safeExportText),
          domSelector: safeExportText(annotation.domSelector),
          scope: annotation.scope,
          matchStatus: annotation.matchStatus,
          confidence: annotation.confidence,
          intent: safeExportText(annotation.intent),
          changes: annotation.changes
        };
        if (annotation.region) {
          exported.region = {
            regionModel: annotation.region.regionModel || 'semantic-v1',
            commonContainer: annotation.region.commonContainer
              ? exportFingerprint(annotation.region.commonContainer)
              : null,
            members: annotation.region.members.map(exportFingerprint),
            bounds: annotation.region.bounds
          };
        }
        return exported;
      })
    };
    return sections + '\n\n```prd-demo-annotations\n' + JSON.stringify(data, null, 2) + '\n```';
  }

  function safeExportText(value) {
    return storedString(typeof value === 'string' ? value : '').replace(/`/g, 'ˋ');
  }

  function exportFingerprint(fingerprint) {
    return {
      adapter: 'streamlit',
      page: safeExportText(fingerprint.page),
      componentType: safeExportText(fingerprint.componentType),
      visibleText: safeExportText(fingerprint.visibleText),
      testId: safeExportText(fingerprint.testId),
      accessibleName: safeExportText(fingerprint.accessibleName),
      widgetKey: fingerprint.widgetKey ? safeExportText(fingerprint.widgetKey) : null,
      containerPath: (fingerprint.containerPath || []).map(safeExportText),
      neighborText: (fingerprint.neighborText || []).map(safeExportText),
      domSelector: safeExportText(fingerprint.domSelector)
    };
  }

  function manualCopy(text) {
    remove('ann-st-manual-copy');
    var modal = own(node('section', { id: 'ann-st-manual-copy', role: 'dialog' }));
    modal.appendChild(node('p', {}, '自动复制失败，请手动复制以下内容：'));
    var area = node('textarea');
    area.value = text;
    modal.appendChild(area);
    document.body.appendChild(modal);
    area.focus();
    area.select();
  }

  function fallbackCopy(text) {
    var area = document.getElementById('ann-st-copy-fallback');
    area.value = text;
    area.hidden = false;
    area.focus();
    area.select();
    var copied = false;
    try {
      copied = !!document.execCommand('copy');
    } catch (error) {
      copied = false;
    }
    area.hidden = true;
    if (!copied) manualCopy(text);
  }

  function copyText(text) {
    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
      window.navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function showExport() {
    closePanels();
    var panel = own(node('section', { id: 'ann-st-export', role: 'dialog' }));
    panel.appendChild(node('h2', {}, '完成标注'));
    var area = node('textarea', { readonly: 'readonly' });
    area.value = readableExport();
    panel.appendChild(area);
    var copy = node('button', { type: 'button', 'data-action': 'copy' }, '复制');
    copy.addEventListener('click', function () { copyText(area.value); });
    panel.appendChild(copy);
    document.body.appendChild(panel);
  }

  function isOwned(target) {
    return !!(target && target.closest && target.closest('[id^="ann-st-"]'));
  }

  function point(event) {
    return { x: event.clientX, y: event.clientY };
  }

  function onPointerDown(event) {
    if (!marking || isOwned(event.target) || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dragStart = point(event);
    dragCurrent = dragStart;
  }

  function onPointerMove(event) {
    if (!marking || !dragStart) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dragCurrent = point(event);
    var overlay = document.getElementById('ann-st-overlay');
    var selection = overlay && overlay.querySelector('[data-role="region-selection"]');
    if (!selection && overlay) {
      selection = node('div', { 'data-role': 'region-selection' });
      overlay.appendChild(selection);
    }
    if (selection) {
      selection.style.left = Math.min(dragStart.x, dragCurrent.x) + 'px';
      selection.style.top = Math.min(dragStart.y, dragCurrent.y) + 'px';
      selection.style.width = Math.abs(dragCurrent.x - dragStart.x) + 'px';
      selection.style.height = Math.abs(dragCurrent.y - dragStart.y) + 'px';
    }
  }

  function onPointerUp(event) {
    if (!marking || !dragStart) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var end = point(event);
    var width = Math.abs(end.x - dragStart.x);
    var height = Math.abs(end.y - dragStart.y);
    var regionSelection = document.querySelector('#ann-st-overlay [data-role="region-selection"]');
    if (regionSelection) regionSelection.remove();
    marking = false;
    suppressClick = true;
    if (width > 5 || height > 5) {
      var region = {
        x: Math.min(dragStart.x, end.x),
        y: Math.min(dragStart.y, end.y),
        width: width,
        height: height
      };
      var semanticRegion = semanticRegionFromDrag(region);
      if (semanticRegion) showInspector({ region: semanticRegion });
    } else {
      var element = document.elementFromPoint(end.x, end.y);
      if (element && !isOwned(element)) {
        showInspector({ element: element, visibleText: visibleTextOf(element) });
      }
    }
    dragStart = null;
    dragCurrent = null;
  }

  function onClick(event) {
    if (!marking && !suppressClick) return;
    if (isOwned(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }

  function initializeUi() {
    if (!document.body || document.getElementById('ann-st-toolbar')) return;
    var style = own(node('style', { id: 'ann-st-styles' }));
    style.textContent = [
      '#ann-st-toolbar,#ann-st-inspector,#ann-st-list,#ann-st-export,#ann-st-manual-copy,#ann-st-storage-warning{',
      'position:fixed;z-index:2147483646;background:#fff;color:#171717;font:14px/1.4 system-ui,sans-serif;',
      'border:1px solid #ddd;border-radius:10px;padding:12px;box-shadow:0 6px 24px #0003}',
      '#ann-st-toolbar{right:16px;bottom:16px;display:flex;gap:8px}',
      '#ann-st-inspector,#ann-st-list,#ann-st-export,#ann-st-manual-copy{right:16px;bottom:72px;width:320px}',
      '#ann-st-inspector textarea,#ann-st-export textarea,#ann-st-manual-copy textarea{width:100%;min-height:120px}',
      '#ann-st-overlay{position:fixed;inset:0;z-index:2147483645;pointer-events:none}',
      '#ann-st-overlay [data-role=pin]{position:absolute;pointer-events:auto;border:0;border-radius:50%;',
      'width:24px;height:24px;background:#5b43e8;color:white}',
      '#ann-st-overlay [data-role=region-selection]{position:absolute;border:2px solid #5b43e8;',
      'background:#5b43e81a;box-sizing:border-box}',
      '#ann-st-storage-warning{left:16px;bottom:16px;background:#fff3cd}',
      '#ann-st-copy-fallback{position:fixed;left:-9999px}'
    ].join('');
    document.head.appendChild(style);
    var toolbar = own(node('div', { id: 'ann-st-toolbar', role: 'toolbar' }));
    [
      ['mark', '标记修改'],
      ['list', '我的修改'],
      ['finish', '完成标注']
    ].forEach(function (action) {
      toolbar.appendChild(node('button', {
        type: 'button',
        'data-action': action[0]
      }, action[1]));
    });
    document.body.appendChild(toolbar);
    document.body.appendChild(own(node('div', { id: 'ann-st-overlay' })));
    document.body.appendChild(own(node('textarea', {
      id: 'ann-st-copy-fallback',
      'aria-hidden': 'true',
      hidden: 'hidden'
    })));
    toolbar.querySelector('[data-action="mark"]').addEventListener('click', function () {
      closePanels();
      marking = true;
      suppressClick = false;
    });
    toolbar.querySelector('[data-action="list"]').addEventListener('click', showList);
    toolbar.querySelector('[data-action="finish"]').addEventListener('click', showExport);
    listen(document, 'pointerdown', onPointerDown, true);
    listen(document, 'pointermove', onPointerMove, true);
    listen(document, 'pointerup', onPointerUp, true);
    listen(document, 'click', onClick, true);
    listen(window, 'scroll', schedulePins, true);
    listen(window, 'resize', schedulePins, false);
    restoreAnnotations();
    if (!storageAvailable) showStorageWarning();
    renderPins();
    if (window.MutationObserver) {
      mutationObserver = new window.MutationObserver(function (records) {
        observeStreamlitRoot();
        if (!hasBusinessMutation(records)) return;
        schedulePins();
      });
      observeStreamlitRoot();
    }
  }

  function destroyAdapter() {
    destroyed = true;
    if (pinFrame != null && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(pinFrame);
    }
    pinFrame = null;
    listeners.forEach(function (entry) {
      entry[0].removeEventListener(entry[1], entry[2], entry[3]);
    });
    listeners = [];
    if (mutationObserver) mutationObserver.disconnect();
    mutationObserver = null;
    observedRoot = null;
    ownedNodes.forEach(function (element) {
      if (element.parentNode) element.parentNode.removeChild(element);
    });
    ownedNodes = [];
    marking = false;
    suppressClick = false;
    delete window.__HTML_EDITOR_STREAMLIT__;
  }

  window.__HTML_EDITOR_STREAMLIT__ = {
    version: '1.0.0',
    fingerprint: fingerprintElement,
    match: matchFingerprint,
    annotations: function () { return JSON.parse(JSON.stringify(annotations)); },
    exportText: readableExport,
    storageKey: storageKey,
    destroy: destroyAdapter
  };
  if (
    config &&
    typeof config.projectName === 'string' &&
    /^sha256:[0-9a-f]{64}$/i.test(config.projectFingerprint || '')
  ) {
    initializeUi();
  }
}());

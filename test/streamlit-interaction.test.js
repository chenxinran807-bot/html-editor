const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'streamlit-annotator.js'),
  'utf8'
);
const fingerprintA = `sha256:${'a'.repeat(64)}`;
const fingerprintB = `sha256:${'b'.repeat(64)}`;

function app() {
  return `<div data-testid="stAppViewContainer">
    <main><h1>商品工作台</h1>
      <p id="before">商品信息</p>
      <button id="business">立即发布</button>
      <p id="after">发布后用户可见</p>
    </main>
  </div>`;
}

function boot(options = {}) {
  const dom = new JSDOM(app(), {
    url: 'https://example.test/editor?ignored=yes',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.PointerEvent = window.MouseEvent;
  const animationFrames = [];
  const cancelledAnimationFrames = new Set();
  window.requestAnimationFrame = options.queuedAnimationFrames
    ? callback => {
      const handle = animationFrames.length + 1;
      animationFrames.push({ handle, callback });
      return handle;
    }
    : callback => callback();
  window.cancelAnimationFrame = handle => { cancelledAnimationFrames.add(handle); };
  window.__HTML_EDITOR_STREAMLIT_CONFIG__ = {
    projectFingerprint: options.fingerprint || fingerprintA,
    projectName: 'fixture'
  };
  window.document.execCommand = () => options.execCommand !== false;
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: options.noClipboard ? undefined : {
      writeText: text => options.clipboardRejects
        ? Promise.reject(new Error('denied'))
        : Promise.resolve(text)
    }
  });
  if (options.localStorageThrows) {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); },
        removeItem() { throw new Error('blocked'); }
      }
    });
  }
  const storageKey = `ann-st::https://example.test::/editor::fixture::${options.fingerprint || fingerprintA}`;
  if (Object.hasOwn(options, 'storageValue')) {
    window.localStorage.setItem(storageKey, options.storageValue);
  }
  const button = window.document.querySelector('#business');
  let rect = { left: 100, top: 80, right: 220, bottom: 120, width: 120, height: 40 };
  button.getBoundingClientRect = () => rect;
  window.document.querySelector('main').getBoundingClientRect = () => ({
    left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300
  });
  window.document.elementFromPoint = () => button;
  window.eval(source);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  return {
    dom,
    window,
    document: window.document,
    setRect(next) { rect = next; },
    flushAnimationFrame() {
      const frames = animationFrames.splice(0);
      const callbacks = frames.filter(frame => !cancelledAnimationFrames.has(frame.handle));
      callbacks.forEach(frame => frame.callback());
      return callbacks.length;
    }
  };
}

function click(document, selector) {
  const node = document.querySelector(selector);
  assert.ok(node, `missing ${selector}`);
  node.dispatchEvent(new document.defaultView.MouseEvent('click', {
    bubbles: true, cancelable: true
  }));
}

function pointer(document, target, type, x, y) {
  target.dispatchEvent(new document.defaultView.MouseEvent(type, {
    bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y
  }));
}

function selectButton(document) {
  click(document, '#ann-st-toolbar [data-action="mark"]');
  const target = document.querySelector('#business');
  pointer(document, target, 'pointerdown', 110, 90);
  pointer(document, target, 'pointerup', 110, 90);
}

function save(document, intent = '按钮文案更清楚') {
  const input = document.querySelector('#ann-st-inspector textarea');
  assert.ok(input);
  input.value = intent;
  click(document, '#ann-st-inspector [data-action="save"]');
}

function exportText(document) {
  click(document, '#ann-st-toolbar [data-action="finish"]');
  return document.querySelector('#ann-st-export textarea').value;
}

function payload(text) {
  const matched = text.match(/```prd-demo-annotations\n([\s\S]*?)\n```/);
  assert.ok(matched, 'missing fenced payload');
  return JSON.parse(matched[1]);
}

function storedAnnotation(overrides = {}) {
  return {
    adapter: 'streamlit',
    projectFingerprint: fingerprintA,
    page: '/editor|商品工作台|',
    componentType: 'button',
    visibleText: '立即发布',
    testId: '',
    accessibleName: '立即发布',
    widgetKey: null,
    containerPath: ['main'],
    neighborText: ['商品信息', '发布后用户可见'],
    domSelector: '#business',
    confidence: 'high',
    intent: '原始意图',
    changes: [],
    scope: 'target-only',
    matchStatus: 'matched',
    ...overrides
  };
}

function envelope(annotations, overrides = {}) {
  return JSON.stringify({
    schemaVersion: '1.1',
    adapter: 'streamlit',
    projectFingerprint: fingerprintA,
    annotations,
    ...overrides
  });
}

test('boots an isolated prefixed toolbar with the three exact actions', () => {
  const { document } = boot();
  const toolbar = document.querySelector('#ann-st-toolbar');
  assert.ok(toolbar);
  assert.deepEqual(
    [...toolbar.querySelectorAll('button')].map(button => button.textContent.trim()),
    ['标记修改', '我的修改', '完成标注']
  );
  assert.ok(document.querySelector('#ann-st-styles').textContent.includes('214748'));
  assert.equal(document.querySelector('[id^="ann-"]:not([id^="ann-st-"])'), null);
});

test('marking intercepts the business click, saves a compound annotation, and positions a pin', () => {
  const { window, document } = boot();
  let businessClicks = 0;
  document.querySelector('#business').addEventListener('click', () => { businessClicks += 1; });

  selectButton(document);
  click(document, '#business');
  assert.equal(businessClicks, 0);
  save(document, '发布按钮改成“确认发布”');

  const annotations = window.__HTML_EDITOR_STREAMLIT__.annotations();
  assert.equal(annotations.length, 1);
  assert.equal(annotations[0].adapter, 'streamlit');
  assert.equal(annotations[0].projectFingerprint, fingerprintA);
  assert.equal(annotations[0].page, '/editor|商品工作台|');
  assert.equal(annotations[0].componentType, 'button');
  assert.equal(annotations[0].visibleText, '立即发布');
  assert.equal(annotations[0].intent, '发布按钮改成“确认发布”');
  assert.equal(JSON.stringify(annotations[0].changes), '[]');
  assert.equal(annotations[0].scope, 'target-only');
  assert.equal(annotations[0].matchStatus, 'matched');
  assert.equal(annotations[0].confidence, 'high');
  const pin = document.querySelector('#ann-st-overlay [data-role="pin"]');
  assert.equal(pin.textContent, '1');
  assert.equal(pin.style.left, '212px');
  assert.equal(pin.style.top, '72px');
});

test('dragging creates a rectangular region annotation without mutating business DOM', () => {
  const { window, document } = boot();
  const before = document.querySelector('main').innerHTML;
  click(document, '#ann-st-toolbar [data-action="mark"]');
  pointer(document, document.querySelector('main'), 'pointerdown', 20, 30);
  pointer(document, document, 'pointermove', 180, 150);
  const selection = document.querySelector('#ann-st-overlay [data-role="region-selection"]');
  assert.ok(selection);
  assert.equal(selection.style.cssText, 'left: 20px; top: 30px; width: 160px; height: 120px;');
  pointer(document, document, 'pointerup', 180, 150);
  assert.match(document.querySelector('#ann-st-inspector [data-role="context"]').textContent, /区域/);
  save(document, '这一块留更多呼吸感');
  const annotation = window.__HTML_EDITOR_STREAMLIT__.annotations()[0];
  assert.equal(annotation.componentType, 'region');
  assert.equal(annotation.region.commonContainer.componentType, 'unknown');
  assert.equal(annotation.region.members.length, 1);
  assert.equal(annotation.region.members[0].visibleText, '立即发布');
  assert.deepEqual(JSON.parse(JSON.stringify(annotation.region.bounds)),
    { x: 100, y: 80, width: 120, height: 40 });
  assert.equal(document.querySelector('main').innerHTML, before);
});

test('supports edit, delete, and clear from 我的修改', () => {
  const { window, document } = boot();
  selectButton(document);
  save(document, '初稿');
  click(document, '#ann-st-toolbar [data-action="list"]');
  click(document, '#ann-st-list [data-action="edit"]');
  document.querySelector('#ann-st-inspector textarea').value = '修订稿';
  click(document, '#ann-st-inspector [data-action="save"]');
  assert.equal(window.__HTML_EDITOR_STREAMLIT__.annotations()[0].intent, '修订稿');
  click(document, '#ann-st-toolbar [data-action="list"]');
  click(document, '#ann-st-list [data-action="delete"]');
  assert.equal(window.__HTML_EDITOR_STREAMLIT__.annotations().length, 0);
  selectButton(document);
  save(document, '再次添加');
  click(document, '#ann-st-toolbar [data-action="list"]');
  click(document, '#ann-st-list [data-action="clear"]');
  assert.equal(window.__HTML_EDITOR_STREAMLIT__.annotations().length, 0);
});

test('edits a persisted missing target by intent without fingerprinting undefined', () => {
  const fixture = boot({ storageValue: envelope([storedAnnotation({
    visibleText: '已消失',
    accessibleName: '已消失'
  })]) });
  click(fixture.document, '#ann-st-toolbar [data-action="list"]');
  assert.match(fixture.document.querySelector('#ann-st-list article').textContent, /未匹配/);
  assert.doesNotThrow(() => click(fixture.document, '#ann-st-list [data-action="edit"]'));
  fixture.document.querySelector('#ann-st-inspector textarea').value = '仍然允许修订';
  click(fixture.document, '#ann-st-inspector [data-action="save"]');
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].intent, '仍然允许修订');
});

test('edits a persisted ambiguous target by intent and displays ambiguity', () => {
  const fixture = boot({ storageValue: envelope([storedAnnotation()]) });
  const duplicate = fixture.document.querySelector('main').cloneNode(true);
  fixture.document.querySelector('[data-testid="stAppViewContainer"]').appendChild(duplicate);
  click(fixture.document, '#ann-st-toolbar [data-action="list"]');
  assert.match(fixture.document.querySelector('#ann-st-list article').textContent, /有歧义/);
  assert.doesNotThrow(() => click(fixture.document, '#ann-st-list [data-action="edit"]'));
  fixture.document.querySelector('#ann-st-inspector textarea').value = '歧义时也能改意图';
  click(fixture.document, '#ann-st-inspector [data-action="save"]');
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].intent, '歧义时也能改意图');
});

test('cancel closes the inspector, saves nothing, and restores untouched business interaction', () => {
  const { window, document } = boot();
  const business = document.querySelector('#business');
  const original = business.outerHTML;
  let businessClicks = 0;
  business.addEventListener('click', () => { businessClicks += 1; });
  selectButton(document);
  document.querySelector('#ann-st-inspector textarea').value = '不要保存';

  click(document, '#ann-st-inspector [data-action="cancel"]');

  assert.equal(document.querySelector('#ann-st-inspector'), null);
  assert.equal(window.__HTML_EDITOR_STREAMLIT__.annotations().length, 0);
  assert.equal(business.outerHTML, original);
  click(document, '#business');
  assert.equal(businessClicks, 1);
});

test('persists only for the same origin, path, project name, and project fingerprint', () => {
  const first = boot();
  selectButton(first.document);
  save(first.document, '需要持久化');
  const key = first.window.__HTML_EDITOR_STREAMLIT__.storageKey();
  assert.match(key, /^ann-st::https:\/\/example\.test::\/editor::fixture::sha256:/);
  const stored = first.window.localStorage.getItem(key);

  const same = boot();
  same.window.localStorage.setItem(key, stored);
  same.window.__HTML_EDITOR_STREAMLIT__.destroy();
  same.window.eval(source);
  same.document.dispatchEvent(new same.window.Event('DOMContentLoaded', { bubbles: true }));
  assert.equal(same.window.__HTML_EDITOR_STREAMLIT__.annotations().length, 1);

  const changed = boot({ fingerprint: fingerprintB });
  changed.window.localStorage.setItem(key, stored);
  changed.window.__HTML_EDITOR_STREAMLIT__.destroy();
  changed.window.eval(source);
  changed.document.dispatchEvent(new changed.window.Event('DOMContentLoaded', { bubbles: true }));
  assert.equal(changed.window.__HTML_EDITOR_STREAMLIT__.annotations().length, 0);
});

test('stores a 1.1 envelope and migrates a valid legacy raw array', () => {
  const fixture = boot();
  selectButton(fixture.document);
  save(fixture.document, '使用信封');
  const saved = JSON.parse(fixture.window.localStorage.getItem(
    fixture.window.__HTML_EDITOR_STREAMLIT__.storageKey()
  ));
  assert.equal(saved.schemaVersion, '1.1');
  assert.equal(saved.adapter, 'streamlit');
  assert.equal(saved.projectFingerprint, fingerprintA);
  assert.equal(saved.annotations[0].intent, '使用信封');

  const legacy = boot({ storageValue: JSON.stringify([storedAnnotation({
    neighborText: '附近',
    changes: null,
    confidence: 1,
    matchStatus: null
  })]) });
  const migrated = legacy.window.__HTML_EDITOR_STREAMLIT__.annotations()[0];
  assert.equal(JSON.stringify(migrated.neighborText), '["附近"]');
  assert.equal(JSON.stringify(migrated.changes), '[]');
  assert.equal(migrated.confidence, 'low');
  assert.equal(migrated.matchStatus, 'missing');
});

test('ignores malformed, foreign, future, null, and invalid annotation persistence', () => {
  const values = [
    '{not json',
    'null',
    envelope([storedAnnotation()], { adapter: 'html' }),
    envelope([storedAnnotation()], { projectFingerprint: fingerprintB }),
    envelope([storedAnnotation()], { schemaVersion: '9.0' }),
    envelope([null]),
    envelope([{ adapter: 'streamlit', intent: 42 }])
  ];
  values.forEach(value => {
    const fixture = boot({ storageValue: value });
    assert.equal(JSON.stringify(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()), '[]');
  });
});

test('restores valid records from a mixed 1.1 envelope and conservatively migrates coordinate regions', () => {
  const legacyRegion = storedAnnotation({
    componentType: 'region',
    visibleText: '',
    intent: '旧坐标区域仍需保留',
    region: { x: 12, y: 34, width: 56, height: 78 }
  });
  const fixture = boot({
    storageValue: envelope([
      storedAnnotation({ intent: '有效元素' }),
      legacyRegion,
      null,
      { adapter: 'streamlit', intent: 42 }
    ])
  });
  const restored = fixture.window.__HTML_EDITOR_STREAMLIT__.annotations();
  assert.equal(restored.length, 2);
  assert.equal(restored[0].intent, '有效元素');
  assert.equal(restored[1].intent, '旧坐标区域仍需保留');
  assert.equal(restored[1].confidence, 'low');
  assert.equal(restored[1].matchStatus, 'missing');
  assert.equal(restored[1].region.regionModel, 'legacy-coordinate');
  assert.deepEqual(JSON.parse(JSON.stringify(restored[1].region.bounds)),
    { x: 12, y: 34, width: 56, height: 78 });
  assert.equal(fixture.document.querySelectorAll('[data-role="pin"]').length, 1);
});

test('repositions pins once per animation frame and rematches safely after rerender', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  selectButton(fixture.document);
  save(fixture.document, '跟随目标');
  fixture.setRect({ left: 300, top: 200, right: 440, bottom: 240, width: 140, height: 40 });
  fixture.window.dispatchEvent(new fixture.window.Event('scroll'));
  fixture.window.dispatchEvent(new fixture.window.Event('resize'));
  assert.equal(fixture.flushAnimationFrame(), 1);
  assert.equal(fixture.document.querySelector('[data-role="pin"]').style.left, '432px');
  assert.equal(fixture.document.querySelector('[data-role="pin"]').style.top, '192px');

  const replacement = fixture.document.querySelector('#business').cloneNode(true);
  replacement.getBoundingClientRect = () => ({
    left: 10, top: 20, right: 90, bottom: 60, width: 80, height: 40
  });
  fixture.document.querySelector('#business').replaceWith(replacement);
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  assert.equal(fixture.flushAnimationFrame(), 1);
  assert.equal(fixture.document.querySelector('[data-role="pin"]').style.left, '82px');
  replacement.remove();
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  fixture.flushAnimationFrame();
  assert.equal(fixture.document.querySelector('[data-role="pin"]'), null);
});

test('semantic region recomputes bounds after layout and restores on an identical rerun', () => {
  const first = boot();
  click(first.document, '#ann-st-toolbar [data-action="mark"]');
  pointer(first.document, first.document.querySelector('main'), 'pointerdown', 20, 30);
  pointer(first.document, first.document, 'pointermove', 180, 150);
  pointer(first.document, first.document, 'pointerup', 180, 150);
  save(first.document, '语义区域');
  const stored = first.window.localStorage.getItem(first.window.__HTML_EDITOR_STREAMLIT__.storageKey());
  const rerun = boot({ storageValue: stored });
  rerun.setRect({ left: 240, top: 180, right: 380, bottom: 230, width: 140, height: 50 });
  rerun.window.dispatchEvent(new rerun.window.Event('scroll'));
  const restored = rerun.window.__HTML_EDITOR_STREAMLIT__.annotations()[0];
  assert.equal(restored.matchStatus, 'matched');
  assert.deepEqual(JSON.parse(JSON.stringify(restored.region.bounds)),
    { x: 240, y: 180, width: 140, height: 50 });
  assert.equal(rerun.document.querySelector('[data-role="pin"]').style.left, '372px');
});

test('semantic region is missing across pages and never falls back to stored coordinates', () => {
  const annotation = storedAnnotation({
    componentType: 'region',
    visibleText: '',
    region: {
      commonContainer: storedAnnotation({ componentType: 'unknown', visibleText: '商品工作台 商品信息 立即发布 发布后用户可见' }),
      members: [storedAnnotation()],
      bounds: { x: 1, y: 2, width: 3, height: 4 }
    }
  });
  const fixture = boot({ storageValue: envelope([annotation]) });
  fixture.window.history.pushState({}, '', '/other');
  fixture.window.dispatchEvent(new fixture.window.Event('scroll'));
  const restored = fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0];
  assert.equal(restored.matchStatus, 'missing');
  assert.equal(fixture.document.querySelector('[data-role="pin"]'), null);
});

test('semantic region reports ambiguous duplicate reruns and missing members conservatively', async () => {
  const ambiguous = boot({ queuedAnimationFrames: true });
  click(ambiguous.document, '#ann-st-toolbar [data-action="mark"]');
  pointer(ambiguous.document, ambiguous.document.querySelector('main'), 'pointerdown', 20, 30);
  pointer(ambiguous.document, ambiguous.document, 'pointermove', 180, 150);
  pointer(ambiguous.document, ambiguous.document, 'pointerup', 180, 150);
  save(ambiguous.document, '区域不猜测');
  ambiguous.document.querySelector('[data-testid="stAppViewContainer"]').appendChild(
    ambiguous.document.querySelector('main').cloneNode(true)
  );
  await new Promise(resolve => ambiguous.window.setTimeout(resolve, 0));
  ambiguous.flushAnimationFrame();
  assert.equal(ambiguous.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'ambiguous');
  assert.equal(ambiguous.document.querySelector('[data-role="pin"]'), null);

  const missing = boot({ storageValue: ambiguous.window.localStorage.getItem(
    ambiguous.window.__HTML_EDITOR_STREAMLIT__.storageKey()
  ) });
  missing.document.querySelector('#business').remove();
  missing.window.dispatchEvent(new missing.window.Event('resize'));
  assert.equal(missing.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'missing');
  assert.equal(missing.document.querySelector('[data-role="pin"]'), null);
});

test('collects region members with bounded geometry and ancestor work on a large decorative DOM', () => {
  const fixture = boot();
  const decoration = fixture.document.createElement('div');
  decoration.innerHTML = Array.from({ length: 1200 }, (_, index) =>
    `<span><svg><path data-index="${index}"></path></svg></span>`
  ).join('');
  fixture.document.querySelector('main').appendChild(decoration);
  let rectCalls = 0;
  let containsCalls = 0;
  [...fixture.document.querySelectorAll('*')].forEach(element => {
    const originalRect = element.getBoundingClientRect.bind(element);
    element.getBoundingClientRect = () => {
      rectCalls += 1;
      return originalRect();
    };
  });
  const originalContains = fixture.window.Element.prototype.contains;
  fixture.window.Element.prototype.contains = function (...args) {
    containsCalls += 1;
    return originalContains.apply(this, args);
  };

  click(fixture.document, '#ann-st-toolbar [data-action="mark"]');
  pointer(fixture.document, fixture.document.querySelector('main'), 'pointerdown', 20, 30);
  pointer(fixture.document, fixture.document, 'pointermove', 180, 150);
  pointer(fixture.document, fixture.document, 'pointerup', 180, 150);
  const dragRectCalls = rectCalls;
  const dragContainsCalls = containsCalls;
  fixture.window.Element.prototype.contains = originalContains;
  save(fixture.document, '大型页面区域');

  assert.ok(dragRectCalls < 40, `geometry calls: ${dragRectCalls}`);
  assert.ok(dragContainsCalls < 40, `contains calls: ${dragContainsCalls}`);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].region.members[0].componentType, 'button');
});

test('uses semantic button and chart ancestors instead of decorative SVG descendants across reruns', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  const button = fixture.document.querySelector('#business');
  button.innerHTML = '<span>立即发布<svg><path></path></svg></span>';
  const chart = fixture.document.createElement('div');
  chart.dataset.testid = 'stVegaLiteChart';
  chart.innerHTML = '<svg><g><path></path></g></svg>';
  chart.getBoundingClientRect = () => ({
    left: 230, top: 80, right: 350, bottom: 160, width: 120, height: 80
  });
  fixture.document.querySelector('main').appendChild(chart);
  click(fixture.document, '#ann-st-toolbar [data-action="mark"]');
  pointer(fixture.document, fixture.document.querySelector('main'), 'pointerdown', 90, 60);
  pointer(fixture.document, fixture.document, 'pointermove', 360, 170);
  pointer(fixture.document, fixture.document, 'pointerup', 360, 170);
  save(fixture.document, '按钮与图表区域');
  const initial = fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0];
  assert.equal(JSON.stringify(initial.region.members.map(member => member.componentType)),
    '["button","chart"]');
  assert.equal(initial.matchStatus, 'matched');

  const rerun = fixture.document.querySelector('main').cloneNode(true);
  rerun.querySelector('#business').getBoundingClientRect = button.getBoundingClientRect;
  rerun.querySelector('[data-testid="stVegaLiteChart"]').getBoundingClientRect =
    chart.getBoundingClientRect;
  fixture.document.querySelector('main').replaceWith(rerun);
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  fixture.flushAnimationFrame();
  const restored = fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0];
  assert.equal(restored.matchStatus, 'matched');
  assert.equal(fixture.document.querySelectorAll('[data-role="pin"]').length, 1);
});

test('reuses one matching context for many region members during save and recovery', () => {
  const fixture = boot();
  const main = fixture.document.querySelector('main');
  Array.from({ length: 24 }, (_, index) => {
    const member = fixture.document.createElement('button');
    member.textContent = `区域成员 ${index}`;
    member.getBoundingClientRect = () => ({
      left: 20 + index * 10,
      top: 140,
      right: 28 + index * 10,
      bottom: 160,
      width: 8,
      height: 20
    });
    main.appendChild(member);
    return member;
  });
  const root = fixture.document.querySelector('[data-testid="stAppViewContainer"]');
  const querySelectorAll = root.querySelectorAll.bind(root);
  let globalScans = 0;
  root.querySelectorAll = selector => {
    if (selector === '*') globalScans += 1;
    return querySelectorAll(selector);
  };
  click(fixture.document, '#ann-st-toolbar [data-action="mark"]');
  pointer(fixture.document, main, 'pointerdown', 10, 60);
  pointer(fixture.document, fixture.document, 'pointermove', 280, 180);
  pointer(fixture.document, fixture.document, 'pointerup', 280, 180);
  assert.ok(globalScans <= 2, `capture global scans: ${globalScans}`);
  globalScans = 0;
  save(fixture.document, '多成员区域');
  assert.ok(globalScans <= 2, `save global scans: ${globalScans}`);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].region.members.length, 25);

  globalScans = 0;
  fixture.window.dispatchEvent(new fixture.window.Event('resize'));
  assert.ok(globalScans <= 1, `recovery global scans: ${globalScans}`);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'matched');
});

test('reattaches mutation tracking after the Streamlit app root is replaced', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  selectButton(fixture.document);
  save(fixture.document, '跨根跟随');
  const oldRoot = fixture.document.querySelector('[data-testid="stAppViewContainer"]');
  const newRoot = oldRoot.cloneNode(true);
  newRoot.querySelector('#business').getBoundingClientRect = () => ({
    left: 20, top: 30, right: 120, bottom: 70, width: 100, height: 40
  });
  oldRoot.replaceWith(newRoot);
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  fixture.flushAnimationFrame();
  assert.equal(fixture.document.querySelector('[data-role="pin"]').style.left, '112px');

  const secondButton = newRoot.querySelector('#business').cloneNode(true);
  secondButton.getBoundingClientRect = () => ({
    left: 200, top: 100, right: 320, bottom: 140, width: 120, height: 40
  });
  newRoot.querySelector('#business').replaceWith(secondButton);
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  assert.equal(fixture.flushAnimationFrame(), 1);
  assert.equal(fixture.document.querySelector('[data-role="pin"]').style.left, '312px');
});

test('restores one matched pin after a semantically identical Streamlit main rerun', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  selectButton(fixture.document);
  save(fixture.document, '主区重跑后恢复');
  fixture.flushAnimationFrame();

  const replacement = fixture.document.querySelector('main').cloneNode(true);
  replacement.querySelector('#business').getBoundingClientRect = () => ({
    left: 40, top: 50, right: 160, bottom: 90, width: 120, height: 40
  });
  fixture.document.querySelector('main').replaceWith(replacement);
  replacement.appendChild(fixture.document.createElement('span'));
  replacement.appendChild(fixture.document.createElement('span'));
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));

  assert.equal(fixture.flushAnimationFrame(), 1, 'rerun mutations are batched into one frame');
  assert.equal(fixture.document.querySelectorAll('#ann-st-toolbar').length, 1);
  assert.equal(fixture.document.querySelectorAll('[data-role="pin"]').length, 1);
  assert.equal(fixture.document.querySelector('[data-role="pin"]').style.left, '152px');
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'matched');
});

test('marks a rerun with two equally plausible targets ambiguous and binds no pin', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  selectButton(fixture.document);
  save(fixture.document, '不应猜测重复目标');
  fixture.flushAnimationFrame();

  const first = fixture.document.querySelector('main').cloneNode(true);
  const second = first.cloneNode(true);
  fixture.document.querySelector('main').replaceWith(first);
  fixture.document.querySelector('[data-testid="stAppViewContainer"]').appendChild(second);
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  assert.equal(fixture.flushAnimationFrame(), 1);

  assert.equal(fixture.document.querySelector('[data-role="pin"]'), null);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'ambiguous');
  click(fixture.document, '#ann-st-toolbar [data-action="list"]');
  assert.match(fixture.document.querySelector('#ann-st-list article').textContent, /有歧义/);
});

test('marks a removed rerun target missing and removes its pin', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  selectButton(fixture.document);
  save(fixture.document, '目标删除后保持记录');
  fixture.flushAnimationFrame();

  fixture.document.querySelector('#business').remove();
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  assert.equal(fixture.flushAnimationFrame(), 1);

  assert.equal(fixture.document.querySelector('[data-role="pin"]'), null);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'missing');
  click(fixture.document, '#ann-st-toolbar [data-action="list"]');
  assert.match(fixture.document.querySelector('#ann-st-list article').textContent, /未匹配/);
});

test('does not bind an old annotation to the same-label target after page identity changes', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  selectButton(fixture.document);
  save(fixture.document, '只属于原页面');
  fixture.flushAnimationFrame();

  fixture.document.querySelector('h1').textContent = '订单工作台';
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  assert.equal(fixture.flushAnimationFrame(), 1);

  assert.equal(fixture.document.querySelector('[data-role="pin"]'), null);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'missing');
  click(fixture.document, '#ann-st-toolbar [data-action="list"]');
  assert.match(fixture.document.querySelector('#ann-st-list article').textContent, /未匹配/);
});

test('does not render a region annotation after navigating to another page identity', () => {
  const fixture = boot({ queuedAnimationFrames: true });
  click(fixture.document, '#ann-st-toolbar [data-action="mark"]');
  pointer(fixture.document, fixture.document.querySelector('main'), 'pointerdown', 20, 30);
  pointer(fixture.document, fixture.document, 'pointermove', 180, 150);
  pointer(fixture.document, fixture.document, 'pointerup', 180, 150);
  save(fixture.document, '区域仅属于原页面');
  fixture.flushAnimationFrame();

  fixture.window.history.pushState({}, '', '/orders');
  fixture.window.dispatchEvent(new fixture.window.Event('resize'));
  assert.equal(fixture.flushAnimationFrame(), 1);

  assert.equal(fixture.document.querySelector('[data-role="pin"]'), null);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'missing');
});

test('recovers once after attribute-only Streamlit navigation changes page identity', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  const nav = fixture.document.createElement('nav');
  nav.innerHTML = '<a aria-current="page">商品页</a><a>订单页</a>';
  fixture.document.querySelector('[data-testid="stAppViewContainer"]').prepend(nav);
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));
  fixture.flushAnimationFrame();
  selectButton(fixture.document);
  save(fixture.document, '属性导航后不误绑');
  fixture.flushAnimationFrame();

  nav.children[0].removeAttribute('aria-current');
  nav.children[1].setAttribute('aria-current', 'page');
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));

  assert.equal(fixture.flushAnimationFrame(), 1, 'attribute mutations are batched');
  assert.equal(fixture.document.querySelector('[data-role="pin"]'), null);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'missing');
});

test('recovers once after characterData changes the Streamlit page heading', async () => {
  const fixture = boot({ queuedAnimationFrames: true });
  selectButton(fixture.document);
  save(fixture.document, '标题文本变化后不误绑');
  fixture.flushAnimationFrame();

  fixture.document.querySelector('h1').firstChild.data = '订单工作台';
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));

  assert.equal(fixture.flushAnimationFrame(), 1, 'characterData mutations are batched');
  assert.equal(fixture.document.querySelector('[data-role="pin"]'), null);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations()[0].matchStatus, 'missing');
});

test('destroy cancels a queued pin frame so an old adapter cannot mutate a reinjected overlay', () => {
  const fixture = boot({ queuedAnimationFrames: true });
  selectButton(fixture.document);
  save(fixture.document, '旧实例标注');
  fixture.window.dispatchEvent(new fixture.window.Event('resize'));
  fixture.window.__HTML_EDITOR_STREAMLIT__.destroy();
  fixture.window.eval(source);
  const overlay = fixture.document.querySelector('#ann-st-overlay');
  overlay.dataset.owner = 'new-adapter';
  overlay.appendChild(fixture.document.createElement('i'));

  fixture.flushAnimationFrame();

  assert.equal(overlay.dataset.owner, 'new-adapter');
  assert.equal(overlay.querySelectorAll('i').length, 1);
  assert.equal(fixture.window.__HTML_EDITOR_STREAMLIT__.annotations().length, 1);
});

test('exports readable context and the exact 1.1 Streamlit payload', () => {
  const { document } = boot();
  selectButton(document);
  save(document, '发布前增加二次确认');
  const text = exportText(document);
  assert.match(text, /页面：\/editor\|商品工作台\|/);
  assert.match(text, /组件：button/);
  assert.match(text, /可见文字：立即发布/);
  assert.match(text, /邻近文字：商品信息 \/ 发布后用户可见/);
  assert.match(text, /意图：发布前增加二次确认/);
  const data = payload(text);
  assert.equal(data.schemaVersion, '1.1');
  assert.equal(data.adapter, 'streamlit');
  assert.equal(data.projectFingerprint, fingerprintA);
  assert.equal(data.annotations[0].confidence, 'high');
  assert.deepEqual(Object.keys(data.annotations[0]).sort(), [
    'accessibleName', 'changes', 'componentType', 'confidence', 'containerPath',
    'domSelector', 'intent', 'matchStatus', 'neighborText', 'page', 'scope',
    'testId', 'visibleText', 'widgetKey'
  ]);
});

test('exports semantic region members, common container, and current bounds', () => {
  const fixture = boot();
  click(fixture.document, '#ann-st-toolbar [data-action="mark"]');
  pointer(fixture.document, fixture.document.querySelector('main'), 'pointerdown', 20, 30);
  pointer(fixture.document, fixture.document, 'pointermove', 180, 150);
  pointer(fixture.document, fixture.document, 'pointerup', 180, 150);
  save(fixture.document, '导出区域');
  const item = payload(exportText(fixture.document)).annotations[0];
  assert.equal(item.componentType, 'region');
  assert.equal(item.region.commonContainer.adapter, 'streamlit');
  assert.deepEqual(Object.keys(item.region.commonContainer).sort(), [
    'accessibleName', 'adapter', 'componentType', 'containerPath', 'domSelector',
    'neighborText', 'page', 'testId', 'visibleText', 'widgetKey'
  ]);
  assert.equal(item.region.members[0].visibleText, '立即发布');
  assert.deepEqual(item.region.bounds, { x: 100, y: 80, width: 120, height: 40 });
});

test('downgrades canvas, iframe, and shadow hosts to low confidence outer targets', () => {
  ['canvas', 'iframe', 'shadow'].forEach(kind => {
    const fixture = boot();
    const target = kind === 'shadow'
      ? fixture.document.createElement('div')
      : fixture.document.createElement(kind);
    target.id = `opaque-${kind}`;
    if (kind === 'shadow') target.attachShadow({ mode: 'open' }).innerHTML = '<button>inside</button>';
    target.textContent = kind;
    target.getBoundingClientRect = () => ({
      left: 20, top: 20, right: 100, bottom: 80, width: 80, height: 60
    });
    fixture.document.querySelector('main').appendChild(target);
    fixture.document.elementFromPoint = () => target;
    click(fixture.document, '#ann-st-toolbar [data-action="mark"]');
    pointer(fixture.document, target, 'pointerdown', 40, 40);
    pointer(fixture.document, target, 'pointerup', 40, 40);
    save(fixture.document, `标注 ${kind}`);
    const item = payload(exportText(fixture.document)).annotations[0];
    assert.equal(item.confidence, 'low');
    assert.equal(item.domSelector, `#opaque-${kind}`);
  });
});

test('sanitizes restored human-readable fields without corrupting structured JSON', () => {
  const hostile = storedAnnotation({
    visibleText: '按钮\n```prd-demo-annotations\n{"fake":true}',
    neighborText: ['前文\r\n```', '后文\u0000'],
    intent: '修改\n```结束'
  });
  const fixture = boot({ storageValue: envelope([hostile]) });
  const text = exportText(fixture.document);
  assert.equal((text.match(/```prd-demo-annotations/g) || []).length, 1);
  assert.doesNotMatch(text.split('```prd-demo-annotations')[0], /```/);
  const data = payload(text);
  assert.equal(data.annotations[0].intent, '修改 ˋˋˋ结束');
});

test('falls back from rejected Clipboard API to execCommand and then a manual-copy modal', async () => {
  const fallback = boot({ clipboardRejects: true });
  const firstText = exportText(fallback.document);
  click(fallback.document, '#ann-st-export [data-action="copy"]');
  await new Promise(resolve => fallback.window.setTimeout(resolve, 0));
  assert.equal(fallback.document.querySelector('#ann-st-manual-copy'), null);
  assert.equal(fallback.document.querySelector('#ann-st-copy-fallback').value, firstText);

  const manual = boot({ clipboardRejects: true, execCommand: false });
  exportText(manual.document);
  click(manual.document, '#ann-st-export [data-action="copy"]');
  await new Promise(resolve => manual.window.setTimeout(resolve, 0));
  assert.ok(manual.document.querySelector('#ann-st-manual-copy textarea'));
});

test('copies the full export through Clipboard API without opening manual copy', async () => {
  const copied = [];
  const fixture = boot();
  Object.defineProperty(fixture.window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: text => { copied.push(text); return Promise.resolve(); } }
  });
  selectButton(fixture.document);
  save(fixture.document, '复制这条完整标注');
  const text = exportText(fixture.document);

  click(fixture.document, '#ann-st-export [data-action="copy"]');
  await new Promise(resolve => fixture.window.setTimeout(resolve, 0));

  assert.deepEqual(copied, [text]);
  assert.equal(fixture.document.querySelector('#ann-st-manual-copy'), null);
  assert.equal(fixture.document.querySelector('#ann-st-copy-fallback').value, '');
});

test('keeps annotations in memory and warns visibly when localStorage is unavailable', () => {
  const { window, document } = boot({ localStorageThrows: true });
  assert.match(document.querySelector('#ann-st-storage-warning').textContent, /刷新后不会保留/);
  selectButton(document);
  save(document, '仅当前会话');
  assert.equal(window.__HTML_EDITOR_STREAMLIT__.annotations()[0].intent, '仅当前会话');
  assert.equal(document.querySelector('#business').getAttribute('style'), null);
  assert.equal(document.querySelector('#business').textContent, '立即发布');
});

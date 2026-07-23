const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'streamlit-annotator.js'),
  'utf8'
);

function boot(body, url = 'https://example.test/library') {
  const dom = new JSDOM(body, { url, runScripts: 'outside-only' });
  dom.window.eval(source);
  return dom;
}

function app(content) {
  return `<div data-testid="stAppViewContainer">
    <nav aria-label="Pages"><a aria-current="page">我的收藏</a></nav>
    <main><h1>组件库</h1>${content}</main>
  </div>`;
}

test('fingerprints a Streamlit button with stable semantic context', () => {
  const dom = boot(app(`
    <div data-testid="stHorizontalBlock">
      <div data-testid="column"><p>推荐商品</p></div>
      <div data-testid="column"><button data-testid="baseButton-secondary">收藏</button><p>已选 3 件</p></div>
    </div>
  `));
  const button = dom.window.document.querySelector('button');

  assert.deepEqual(
    JSON.parse(JSON.stringify(dom.window.__HTML_EDITOR_STREAMLIT__.fingerprint(button))),
    {
      adapter: 'streamlit',
      page: '/library|组件库|我的收藏',
      componentType: 'button',
      visibleText: '收藏',
      testId: 'baseButton-secondary',
      accessibleName: '收藏',
      widgetKey: null,
      containerPath: ['main', 'column:2'],
      neighborText: ['推荐商品', '已选 3 件'],
      domSelector: 'button[data-testid="baseButton-secondary"]'
    }
  );
});

test('matches one unique candidate and reports duplicate candidates as ambiguous', () => {
  const original = boot(app('<button>收藏</button>'));
  const fingerprint = original.window.__HTML_EDITOR_STREAMLIT__.fingerprint(
    original.window.document.querySelector('button')
  );

  const unique = boot(app('<button>收藏</button>'));
  const matched = unique.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint);
  assert.equal(matched.status, 'matched');
  assert.equal(matched.element.textContent, '收藏');

  const duplicate = boot(app('<button>收藏</button><button>收藏</button>'));
  assert.deepEqual(
    JSON.parse(JSON.stringify(duplicate.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint))),
    { status: 'ambiguous' }
  );
});

test('reports missing when no plausible candidate exists', () => {
  const dom = boot(app('<button>分享</button>'));
  const result = dom.window.__HTML_EDITOR_STREAMLIT__.match({
    adapter: 'streamlit',
    page: '/library|组件库|我的收藏',
    componentType: 'button',
    visibleText: '删除',
    testId: '',
    accessibleName: '删除',
    widgetKey: null,
    containerPath: ['main'],
    neighborText: [],
    domSelector: 'button'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { status: 'missing' });
});

test('does not rebind from weak structural fields when all strong identity fields differ', () => {
  const original = boot(app('<button data-testid="baseButton-secondary">收藏</button>'));
  const fingerprint = original.window.__HTML_EDITOR_STREAMLIT__.fingerprint(
    original.window.document.querySelector('button')
  );
  const replacement = boot(app('<button data-testid="baseButton-secondary">彻底删除</button>'));

  assert.deepEqual(
    JSON.parse(JSON.stringify(replacement.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint))),
    { status: 'missing' }
  );
});

test('matching a large page performs a bounded number of global DOM scans', () => {
  const original = boot(app('<button data-testid="baseButton-secondary">目标操作</button>'));
  const fingerprint = original.window.__HTML_EDITOR_STREAMLIT__.fingerprint(
    original.window.document.querySelector('button')
  );
  const buttons = Array.from({ length: 200 }, (_, index) =>
    `<button data-testid="baseButton-secondary">操作 ${index}</button>`
  ).join('') + '<button data-testid="baseButton-secondary">目标操作</button>';
  const target = boot(app(buttons));
  const prototype = target.window.Element.prototype;
  const querySelectorAll = prototype.querySelectorAll;
  let elementScans = 0;
  prototype.querySelectorAll = function (...args) {
    elementScans += 1;
    return querySelectorAll.apply(this, args);
  };

  const result = target.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint);

  assert.equal(result.status, 'matched');
  assert.equal(result.element.textContent, '目标操作');
  assert.ok(elementScans <= 3, `expected at most 3 element-wide scans, observed ${elementScans}`);
});

test('recognizes Streamlit component types without generated class hashes', () => {
  const dom = boot(app(`
    <button>Run</button><input type="text"><textarea></textarea><select><option>A</option></select>
    <input type="checkbox"><input type="radio"><img alt="Plot">
    <div data-testid="stDataFrame">table</div><div data-testid="stVegaLiteChart">chart</div>
    <div data-testid="stMetric">42</div><div data-testid="stMarkdown">copy</div>
    <form></form><div data-testid="column"></div><div data-testid="stVerticalBlock"></div>
    <section data-testid="stSidebar"></section><div id="mystery"></div>
  `));
  const api = dom.window.__HTML_EDITOR_STREAMLIT__;
  const selectors = [
    'button', 'input[type=text]', 'textarea', 'select', 'input[type=checkbox]',
    'input[type=radio]', 'img', '[data-testid=stDataFrame]', '[data-testid=stVegaLiteChart]',
    '[data-testid=stMetric]', '[data-testid=stMarkdown]', 'form', '[data-testid=column]',
    '[data-testid=stVerticalBlock]', '[data-testid=stSidebar]', '#mystery'
  ];
  assert.deepEqual(
    selectors.map(selector => api.fingerprint(dom.window.document.querySelector(selector)).componentType),
    ['button', 'text input', 'textarea', 'select', 'checkbox', 'radio', 'image',
      'dataframe', 'chart', 'metric', 'markdown/text', 'form', 'column', 'container',
      'sidebar', 'unknown']
  );
});

test('normalizes and caps visible text at 240 characters', () => {
  const dom = boot(app(`<p>${' word '.repeat(80)}</p>`));
  const text = dom.window.__HTML_EDITOR_STREAMLIT__.fingerprint(
    dom.window.document.querySelector('p')
  ).visibleText;
  assert.equal(text.length, 240);
  assert.equal(text.includes('  '), false);
});

test('prefers aria-label, associated labels, button text, and image alt for accessible names', () => {
  const dom = boot(app(`
    <button aria-label="Save item">ignored</button>
    <label for="query">Search catalog</label><input id="query">
    <button>Checkout</button><img alt="Revenue chart">
  `));
  const api = dom.window.__HTML_EDITOR_STREAMLIT__;
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('button,input,img')].map(el => api.fingerprint(el).accessibleName),
    ['Save item', 'Search catalog', 'Checkout', 'Revenue chart']
  );
});

test('isolates matching by page identity', () => {
  const first = boot(app('<button>收藏</button>'), 'https://example.test/library');
  const fingerprint = first.window.__HTML_EDITOR_STREAMLIT__.fingerprint(first.window.document.querySelector('button'));
  const other = boot(app('<button>收藏</button>'), 'https://example.test/settings');
  assert.equal(other.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint).status, 'missing');
});

test('discovers explicit widget keys when present', () => {
  const dom = boot(app('<div data-widget-key="favorite"><button>收藏</button></div>'));
  assert.equal(
    dom.window.__HTML_EDITOR_STREAMLIT__.fingerprint(dom.window.document.querySelector('button')).widgetKey,
    'favorite'
  );
});

test('requires an exact widget key and rejects a same-label decoy after removal', () => {
  const original = boot(app('<div data-widget-key="real"><button>保存</button></div>'));
  const fingerprint = original.window.__HTML_EDITOR_STREAMLIT__.fingerprint(
    original.window.document.querySelector('button')
  );
  const decoy = boot(app('<div data-widget-key="decoy"><button>保存</button></div>'));
  assert.deepEqual(
    JSON.parse(JSON.stringify(decoy.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint))),
    { status: 'missing' }
  );
});

test('does not let a same-label decoy win without independent matching context', () => {
  const original = boot(app(`
    <div data-testid="column"><p>付款区</p><button>确认</button><p>订单合计</p></div>
  `));
  const fingerprint = original.window.__HTML_EDITOR_STREAMLIT__.fingerprint(
    original.window.document.querySelector('button')
  );
  const rerun = boot(app(`
    <div data-testid="column"><p>营销区</p><button>确认</button><p>订阅活动</p></div>
  `));
  assert.equal(rerun.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint).status, 'missing');
});

test('recovers a reordered genuine target from matching container and neighbors', () => {
  const original = boot(app(`
    <p>无关操作</p>
    <div data-testid="column"><p>付款区</p><button>确认</button><p>订单合计</p></div>
  `));
  const fingerprint = original.window.__HTML_EDITOR_STREAMLIT__.fingerprint(
    original.window.document.querySelector('button')
  );
  const rerun = boot(app(`
    <div data-testid="column"><p>付款区</p><button>确认</button><p>订单合计</p></div>
    <p>无关操作</p>
  `));
  const result = rerun.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint);
  assert.equal(result.status, 'matched');
  assert.equal(result.element.textContent, '确认');
});

test('reports ambiguity when two contextual candidates have no meaningful winner margin', () => {
  const original = boot(app(`
    <div data-testid="column"><p>付款区</p><button>确认</button><p>订单合计</p></div>
  `));
  const fingerprint = original.window.__HTML_EDITOR_STREAMLIT__.fingerprint(
    original.window.document.querySelector('button')
  );
  const rerun = boot(app(`
    <div data-testid="column"><p>付款区</p><button>确认</button><p>订单合计</p></div>
    <div data-testid="column"><p>付款区</p><button>确认</button><p>订单合计</p></div>
  `));
  assert.equal(rerun.window.__HTML_EDITOR_STREAMLIT__.match(fingerprint).status, 'ambiguous');
});

test('initialization and destruction are idempotent', () => {
  const dom = boot(app('<button>收藏</button>'));
  const first = dom.window.__HTML_EDITOR_STREAMLIT__;
  dom.window.eval(source);
  assert.equal(dom.window.__HTML_EDITOR_STREAMLIT__, first);
  assert.doesNotThrow(() => first.destroy());
  assert.doesNotThrow(() => first.destroy());
});

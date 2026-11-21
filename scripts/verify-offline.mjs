import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const code = await readFile('build/main.js', 'utf8');
const ast = ts.createSourceFile('main.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const banned = new Set(['fetch', 'request', 'requestUrl', 'sendBeacon', 'WebSocket', 'XMLHttpRequest', 'EventSource', 'Worker', 'SharedWorker', 'openExternal', 'eval', 'Function', 'insertAdjacentHTML']);
const violations = [];
const imports = new Set();
function visit(node) {
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    const expr = node.expression;
    const name = ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.name.text : '';
    if (banned.has(name)) violations.push(name);
    if (ts.isIdentifier(expr) && expr.text === 'require') {
      const argument = node.arguments?.[0];
      if (!argument || !ts.isStringLiteral(argument)) violations.push('dynamic require');
      else imports.add(argument.text);
    }
    if (expr.kind === ts.SyntaxKind.ImportKeyword) violations.push('dynamic import');
  }
  if (ts.isPropertyAccessExpression(node) && ['innerHTML', 'outerHTML'].includes(node.name.text)) violations.push(node.name.text);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.deepEqual(violations, [], 'The installed JavaScript must not use network or dynamic-code entry points.');
assert.deepEqual([...imports], ['obsidian']);

await mkdir('.test-build', {recursive: true});
await build({entryPoints: ['tests/helpers/obsidian.ts'], outfile: '.test-build/offline-host.cjs', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent'});
const require = createRequire(import.meta.url);
const host = require(resolve('.test-build/offline-host.cjs'));
const dom = new JSDOM('<div class="workspace-leaf-content"><p id="source">privacy</p></div>', {pretendToBeVisual: true});
const {workspace, app} = host.createWorkspace(dom.window.document);
const fileAccess = [], requests = [];
app.vault.adapter = {
  async exists(path) { fileAccess.push({operation: 'exists', path}); return false; },
  async read(path) { throw new Error('Unexpected file read: ' + path); },
  async write(path) { throw new Error('Unexpected file write: ' + path); }
};
function blockedNetwork(name) { return (...args) => { requests.push(name); throw new Error('Network access blocked: ' + name); }; }
const obsidian = new Proxy(host, {get(target, key) { if (['request', 'requestUrl'].includes(key)) return blockedNetwork(key); return target[key]; }});
const module = {exports: {}};
const sandbox = vm.createContext({module, exports: module.exports,
  require(name) { assert.equal(name, 'obsidian'); return obsidian; },
  fetch: blockedNetwork('fetch'), WebSocket: blockedNetwork('WebSocket'), XMLHttpRequest: blockedNetwork('XMLHttpRequest'), EventSource: blockedNetwork('EventSource'),
  console: {log() {}, warn() {}, error() {}}
}, {codeGeneration: {strings: false, wasm: false}});
new vm.Script(code, {filename: 'offline-release-main.js'}).runInContext(sandbox, {timeout: 2000});
const manifest = JSON.parse(await readFile('build/manifest.json', 'utf8'));
const plugin = new module.exports.default(app, {...manifest, dir: '.obsidian/plugins/' + manifest.id});
try {
  await plugin.onload();
  const terms = ['privacy', 'dictionary', 'running'];
  const matches = terms.map(term => ({term, matches: plugin.dictionary.query(term).length}));
  assert(matches.every(item => item.matches > 0));
  const source = dom.window.document.querySelector('#source');
  const range = dom.window.document.createRange(); range.selectNodeContents(source); dom.window.getSelection().addRange(range);
  source.dispatchEvent(new dom.window.MouseEvent('contextmenu', {bubbles: true, cancelable: true}));
  const menu = host.Menu.shown.at(-1);
  const lookup = menu.items.find(item => item.title === 'Look up');
  assert(lookup, 'The actual release must add Look up for a document selection.');
  await lookup.callback();
  assert.equal(workspace.rightSplit.collapsed, false);
  assert.equal(workspace.active.view.contentEl.querySelector('input').value, 'privacy');
  assert(workspace.active.view.contentEl.querySelectorAll('article').length > 0);
  assert.equal(source.textContent, 'privacy');
  assert.deepEqual(requests, []);
  const result = {sha256: createHash('sha256').update(code).digest('hex'), bytes: Buffer.byteLength(code), externalImports: [...imports], blockedNetworkCalls: requests.length, lookupResults: matches, contextMenuLookupWorked: true, sidebarExpanded: true, sourceDocumentUnchanged: true, fileAccess,
    scope: 'Actual built release executed with instrumented Obsidian host APIs and DOM; not a live Obsidian/Electron installation.'};
  await writeFile('build/offline-verification.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { plugin.unload(); dom.window.close(); }

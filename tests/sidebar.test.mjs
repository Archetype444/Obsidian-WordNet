import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import WordNetPlugin from '../src/main.ts';
import {DICTIONARY_VIEW, DictionaryView} from '../src/DictionaryView.ts';
import {createWorkspace} from './helpers/obsidian.ts';

async function fixture() {
	const dom = new JSDOM('', {pretendToBeVisual: true}); const {app, workspace} = createWorkspace(dom.window.document);
	const plugin = new WordNetPlugin(app, {id: 'wordnet-test', dir: 'plugin'});
	plugin.dictionary.initialize = async () => {};
	plugin.dictionary.query = word => word ? [{SearchTerm: word, Term: word, Definition: 'Local definition.'}] : [];
	await plugin.onload();
	return {plugin, workspace, dom, cleanup() { plugin.unload(); dom.window.close(); }};
}

test('Lookup creates a dictionary tab in the right sidebar, expands it and focuses its search', async () => {
	const f = await fixture();
	try { await f.plugin.openLookup('privacy'); assert.equal(f.workspace.created, 1); assert.equal(f.workspace.rightSplit.collapsed, false); const leaf = f.workspace.active; assert(leaf.view instanceof DictionaryView); assert.equal(leaf.view.getViewType(), DICTIONARY_VIEW); assert.equal(f.dom.window.document.activeElement.value, 'privacy'); assert(leaf.view.contentEl.textContent.includes('Local definition.')); }
	finally { f.cleanup(); }
});
test('Hidden dictionary tab is reused and selected when another sidebar tab was active', async () => {
	const f = await fixture();
	try { await f.plugin.openLookup('privacy'); const original = f.workspace.active; f.workspace.active = {type: 'outline'}; f.workspace.rightSplit.collapsed = true; await f.plugin.openLookup('dictionary'); assert.equal(f.workspace.created, 1); assert.equal(f.workspace.active, original); assert.equal(f.workspace.rightSplit.collapsed, false); assert.equal(original.view.contentEl.querySelector('input').value, 'dictionary'); }
	finally { f.cleanup(); }
});
test('Concurrent lookups create one tab and the latest selected word wins', async () => {
	const f = await fixture();
	try { await Promise.all([f.plugin.openLookup('first'), f.plugin.openLookup('latest')]); assert.equal(f.workspace.created, 1); assert.equal(f.workspace.active.view.contentEl.querySelector('input').value, 'latest'); }
	finally { f.cleanup(); }
});
test('Deferred dictionary views are revealed before accessing their view instance', async () => {
	const f = await fixture();
	try { const leaf = f.workspace.getRightLeaf(); leaf.type = DICTIONARY_VIEW; leaf.deferred = true; await f.plugin.openLookup('privacy'); assert(leaf.view instanceof DictionaryView); assert.equal(f.workspace.created, 1); assert.equal(f.workspace.active, leaf); }
	finally { f.cleanup(); }
});
test('Hostile dictionary strings are rendered only as text, with no links, images or scripts', async () => {
	const f = await fixture();
	try { f.plugin.dictionary.query = () => [{SearchTerm: 'word', Term: '<img src="https://example.invalid">', Definition: '<script>bad()</script> ![pixel](https://example.invalid)'}]; await f.plugin.openLookup('word'); const el = f.workspace.active.view.contentEl; assert.equal(el.querySelectorAll('img,script,a,iframe').length, 0); assert(el.textContent.includes('<script>')); }
	finally { f.cleanup(); }
});
test('Lookup does not save query/history and unloading closes views and removes hooks', async () => {
	const f = await fixture();
	try { const saved = []; f.plugin.saveData = async data => saved.push(data); await f.plugin.openLookup('privateword'); assert.equal(saved.length, 0); await f.plugin.saveSettings(); assert(!JSON.stringify(saved).includes('privateword')); f.plugin.unload(); assert.equal(f.workspace.getLeavesOfType(DICTIONARY_VIEW).length, 0); await f.plugin.openLookup('another'); assert.equal(f.workspace.created, 1); }
	finally { f.cleanup(); }
});
test('Inline shortcuts containing regex symbols are literal and use their original editor context', async () => {
	const f = await fixture();
	try { const suggest = f.workspace.app.suggest; f.plugin.settings.slashCommandShortcut = '['; const editor = {getRange: () => 'prefix [privacy', replaceRange: (...args) => { editor.replacement = args; }}; const trigger = suggest.onTrigger({line: 0, ch: 15}, editor, null); assert.equal(trigger.query, 'privacy'); suggest.context = {...trigger, editor}; suggest.selectSuggestion({Term: '$&', Definition: '![pixel](https://example.invalid)'}, {ctrlKey: false, metaKey: false}); assert(editor.replacement[0].includes('$&')); assert(editor.replacement[0].includes('\\!\\[pixel')); }
	finally { f.cleanup(); }
});

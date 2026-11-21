import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {ContextLookup} from '../src/ContextLookup.ts';
import {selectedTextAt} from '../src/selection.ts';
import {Plugin, Menu, createWorkspace} from './helpers/obsidian.ts';

function fixture(markup = '<div class="workspace-leaf-content"><p id="text">Privacy, matters.</p><p id="other">Other text</p></div>') {
	const dom = new JSDOM(markup, {pretendToBeVisual: true});
	const doc = dom.window.document;
	const {workspace, app} = createWorkspace(doc);
	const plugin = new Plugin(app, {dir: 'plugin'});
	const queries = [];
	const controller = new ContextLookup(plugin, workspace, async text => { queries.push(text); }); controller.start();
	Menu.shown.length = 0;
	function select(element = doc.querySelector('#text'), start = 0, end = 8) {
		const range = doc.createRange(); range.setStart(element.firstChild, start); range.setEnd(element.firstChild, end);
		doc.getSelection().removeAllRanges(); doc.getSelection().addRange(range);
	}
	function rightClick(element = doc.querySelector('#text')) {
		const event = new dom.window.MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 50, clientY: 70}); element.dispatchEvent(event); return event;
	}
	return {dom, doc, workspace, plugin, controller, queries, select, rightClick, cleanup() { plugin.unload(); dom.window.close(); }};
}

test('PDF-like text layer gets Look up in its existing native menu without duplicate items', async () => {
	const f = fixture('<div class="workspace-leaf-content"><div class="pdf-viewer"><div class="textLayer"><span id="text">Privacy, matters.</span></div></div></div>');
	try {
		f.select();
		f.doc.querySelector('#text').addEventListener('contextmenu', event => {
			event.preventDefault(); const menu = new Menu(); menu.addItem(item => item.setTitle('Copy link to selection')); menu.showAtMouseEvent(event);
		});
		f.rightClick();
		assert.equal(Menu.shown.length, 1);
		assert.deepEqual(Menu.shown[0].items.map(x => x.title), ['Copy link to selection', 'Look up']);
		f.doc.getSelection().removeAllRanges();
		await Menu.shown[0].items[1].callback();
		assert.deepEqual(f.queries, ['Privacy']);
	} finally { f.cleanup(); }
});
test('Reading mode and arbitrary selectable text get a fallback menu without changing the document', async () => {
	const f = fixture();
	try { f.select(); const before = f.doc.querySelector('#text').textContent; const event = f.rightClick();
		assert(event.defaultPrevented);
		assert.deepEqual(Menu.shown[0].items.map(x => x.title), ['Look up', 'Copy']);
		await Menu.shown[0].items[0].callback(); assert.deepEqual(f.queries, ['Privacy']);
		assert.equal(f.doc.querySelector('#text').textContent, before);
	} finally { f.cleanup(); }
});
test('Markdown editor-menu reads Editor selection even when DOM selection is empty', async () => {
	const f = fixture();
	try { const menu = new Menu(); f.workspace.trigger('editor-menu', menu, {getSelection: () => 'dictionary'}); await menu.items[0].callback(); assert.deepEqual(f.queries, ['dictionary']); }
	finally { f.cleanup(); }
});
test('No action appears for empty selections or right-clicks outside the selected pane', () => {
	const f = fixture();
	try { f.rightClick(); assert.equal(Menu.shown.length, 0); f.select(); f.rightClick(f.doc.querySelector('#other')); assert.equal(Menu.shown.length, 0); }
	finally { f.cleanup(); }
});
test('Selected text in file-view textareas works; password fields and dictionary panel are excluded', () => {
	const f = fixture('<div class="workspace-leaf-content"><textarea>privacy</textarea><input type="password" value="secret"><div class="wordnet-dictionary-view"><p id="text">privacy</p></div></div>');
	try { const input = f.doc.querySelector('textarea'); input.setSelectionRange(0, 7); assert.equal(selectedTextAt(f.doc, input), 'privacy'); assert.equal(selectedTextAt(f.doc, f.doc.querySelector('input')), ''); f.select(f.doc.querySelector('#text'), 0, 7); assert.equal(selectedTextAt(f.doc, f.doc.querySelector('#text')), ''); }
	finally { f.cleanup(); }
});
test('Popout windows are registered and all menu wrappers/listeners are restored on unload', () => {
	const originalMouse = Menu.prototype.showAtMouseEvent;
	const f = fixture(); const popout = new JSDOM('<div class="workspace-leaf-content"><p>privacy</p></div>');
	try {
		f.workspace.trigger('window-open', {doc: popout.window.document});
		const p = popout.window.document.querySelector('p'); const range = popout.window.document.createRange(); range.selectNodeContents(p); popout.window.getSelection().addRange(range);
		p.dispatchEvent(new popout.window.MouseEvent('contextmenu', {bubbles: true, cancelable: true}));
		assert.equal(Menu.shown[0].items[0].title, 'Look up');
		f.plugin.unload(); assert.equal(Menu.prototype.showAtMouseEvent, originalMouse);
		Menu.shown.length = 0; f.select(); f.rightClick(); assert.equal(Menu.shown.length, 0);
	} finally { f.cleanup(); popout.window.close(); }
});
test('A delayed native menu receives the action and replaces the fallback menu', async () => {
	const f = fixture();
	try { f.select(); f.rightClick(); const fallback = Menu.shown[0]; const native = new Menu(); native.addItem(item => item.setTitle('Native action')); native.showAtPosition({x: 1, y: 1}, f.doc); assert(fallback.hidden); assert.deepEqual(native.items.map(x => x.title), ['Native action', 'Look up']); }
	finally { f.cleanup(); }
});
test('Same-origin embedded documents expose selections without a workspace wrapper inside the frame', () => {
	const f = fixture('<div class="workspace-leaf-content"><iframe></iframe></div>');
	try { const doc = f.doc.querySelector('iframe').contentDocument; doc.body.innerHTML = '<p>privacy</p>'; const p = doc.querySelector('p'); const range = doc.createRange(); range.selectNodeContents(p); doc.getSelection().addRange(range); p.dispatchEvent(new doc.defaultView.MouseEvent('contextmenu', {bubbles: true, cancelable: true})); assert.equal(Menu.shown[0].items[0].title, 'Look up'); }
	finally { f.cleanup(); }
});

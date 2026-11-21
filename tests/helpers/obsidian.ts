export class Component {
	cleanups: (() => void)[] = [];
	register(fn: () => void) { this.cleanups.push(fn); }
	registerEvent(ref: { off: () => void }) { this.register(() => ref.off()); }
	unload() { (this as any).onunload?.(); for (const fn of this.cleanups.splice(0).reverse()) fn(); }
}
export class Plugin extends Component {
	app: any; manifest: any;
	constructor(app: any, manifest: any) { super(); this.app = app; this.manifest = manifest; }
	async loadData() { return {}; }
	async saveData(_data: unknown) {}
	addSettingTab(_tab: unknown) {}
	addCommand(command: any) { this.app.commands.push(command); }
	registerEditorSuggest(suggest: any) { this.app.suggest = suggest; }
	registerView(type: string, factory: any) { this.app.workspace.factories.set(type, factory); this.register(() => this.app.workspace.factories.delete(type)); }
	addRibbonIcon() { return this.app.workspace.containerEl.ownerDocument.createElement('button'); }
}
export class MarkdownView {}
export class Notice { static messages: string[] = []; constructor(text: string) { Notice.messages.push(text); } }
export class EditorSuggest extends Component { context: any = null; constructor(public app: any) { super(); } close() {} }
export class PluginSettingTab extends Component { containerEl: any; constructor(public app: any, public plugin: any) { super(); this.containerEl = app.workspace.containerEl.ownerDocument.createElement('div'); } }
export class Setting {
	constructor(_element: any) {}
	setName() { return this; } setDesc() { return this; }
	addToggle() { return this; } addText() { return this; } addTextArea() { return this; }
}
export class ItemView extends Component {
	app: any; containerEl: any; contentEl: any;
	constructor(public leaf: any) {
		super(); this.app = leaf.workspace.app;
		this.containerEl = leaf.workspace.doc.createElement('div');
		this.containerEl.className = 'workspace-leaf-content';
		this.contentEl = this.containerEl.createDiv();
		leaf.workspace.rightContainer.append(this.containerEl);
	}
}
export class SearchComponent {
	inputEl: HTMLInputElement;
	constructor(parent: HTMLElement) { this.inputEl = parent.ownerDocument.createElement('input'); parent.append(this.inputEl); }
	setPlaceholder(value: string) { this.inputEl.placeholder = value; return this; }
	setValue(value: string) { this.inputEl.value = value; return this; }
	onChange(fn: (value: string) => void) { this.inputEl.addEventListener('input', () => fn(this.inputEl.value)); return this; }
}
export class Menu extends Component {
	static shown: Menu[] = [];
	items: {title: string; callback: () => unknown; icon?: string}[] = [];
	hidden = false;
	addItem(fn: (item: any) => unknown) {
		const data = {title: '', callback: () => undefined as unknown, icon: ''};
		const item = {setTitle(value: string) { data.title = value; return item; }, setIcon(value: string) { data.icon = value; return item; }, onClick(value: () => unknown) { data.callback = value; return item; }};
		fn(item); this.items.push(data); return this;
	}
	showAtPosition(_position: any, _doc?: Document) { Menu.shown.push(this); return this; }
	showAtMouseEvent(event: MouseEvent) { return this.showAtPosition({x: event.clientX, y: event.clientY}); }
	hide() { this.hidden = true; return this; }
}
export function installDom(doc: Document) {
	const prototype = doc.defaultView!.HTMLElement.prototype as any;
	prototype.empty = function() { this.replaceChildren(); };
	prototype.addClass = function(...names: string[]) { this.classList.add(...names); };
	prototype.createEl = function(tag: string, options: any = {}) {
		const el = this.ownerDocument.createElement(tag);
		if (options.text !== undefined) el.textContent = options.text;
		if (options.cls) el.className = options.cls;
		for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, value);
		this.append(el); return el;
	};
	prototype.createDiv = function(options: any = {}) { return this.createEl('div', options); };
}
export function createWorkspace(doc: Document) {
	installDom(doc);
	const listeners = new Map<string, Set<(...args: any[]) => void>>();
	const rightContainer = doc.createElement('aside'); doc.body.append(rightContainer);
	const workspace: any = {
		doc, rightContainer, containerEl: doc.body, factories: new Map(), leaves: [], active: null, created: 0,
		rightSplit: {collapsed: true, expand() { this.collapsed = false; }},
		on(name: string, fn: (...args: any[]) => void) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(fn); return {off() { listeners.get(name)?.delete(fn); }}; },
		trigger(name: string, ...args: any[]) { for (const fn of listeners.get(name) || []) fn(...args); },
		iterateAllLeaves(fn: (leaf: any) => void) { workspace.leaves.forEach(fn); },
		onLayoutReady(fn: () => void) { fn(); },
		getLeavesOfType(type: string) { return workspace.leaves.filter((leaf: any) => leaf.type === type); },
		getRightLeaf() {
			workspace.created++;
			const leaf: any = {workspace, type: '', view: {containerEl: doc.createElement('div')}, getRoot() { return workspace.rightSplit; },
				async setViewState(state: any) { this.type = state.type; this.view = workspace.factories.get(this.type)(this); await this.view.onOpen(); }};
			workspace.leaves.push(leaf); return leaf;
		},
		async revealLeaf(leaf: any) { if (leaf.deferred) { leaf.view = workspace.factories.get(leaf.type)(leaf); await leaf.view.onOpen(); leaf.deferred = false; } workspace.revealed = leaf; workspace.rightSplit.expand(); },
		setActiveLeaf(leaf: any) { workspace.active = leaf; },
		detachLeavesOfType(type: string) { for (const leaf of workspace.leaves.filter((leaf: any) => leaf.type === type)) { void leaf.view.onClose?.(); leaf.view.containerEl.remove(); } workspace.leaves = workspace.leaves.filter((leaf: any) => leaf.type !== type); },
		getActiveViewOfType() { return null; }, getMostRecentLeaf() { return null; },
	};
	const app: any = {workspace, commands: [], vault: {adapter: {async exists() { return false; }}}}; workspace.app = app;
	return {workspace, app};
}

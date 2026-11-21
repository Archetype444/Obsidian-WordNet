import { Menu, Notice, type Editor, type Plugin, type Workspace } from "obsidian";
import { cleanSelection } from "./dictionary";
import { selectedTextAt } from "./selection";

interface SelectionContext {
	text: string;
	rawText: string;
	event: MouseEvent;
	doc: Document;
	nativeHandled: boolean;
	fallback: Menu | null;
	timer: number | null;
}

/** Extend native menus, with a selection menu for panes that do not provide one. */
export class ContextLookup {
	private documents = new Map<Document, () => void>();
	private added = new WeakSet<Menu>();
	private ownMenus = new WeakSet<Menu>();
	private pending: SelectionContext | null = null;
	private disposed = false;
	private restoreMenus: (() => void) | null = null;

	constructor(private plugin: Plugin, private workspace: Workspace, private lookup: (text: string) => Promise<void>) {}

	start(): void {
		this.patchMenus();
		this.plugin.registerEvent(this.workspace.on("editor-menu", (menu, editor) => this.editorMenu(menu, editor)));
		this.plugin.registerEvent(this.workspace.on("window-open", (win) => this.attachDocument(win.doc)));
		this.plugin.registerEvent(this.workspace.on("window-close", (win) => this.detachDocument(win.doc)));
		const attachExisting = () => {
			if (this.disposed) return;
			this.attachDocument(this.workspace.containerEl.ownerDocument);
			this.workspace.iterateAllLeaves(leaf => this.attachDocument(leaf.view.containerEl.ownerDocument));
		};
		attachExisting();
		this.workspace.onLayoutReady(attachExisting);
		this.plugin.register(() => this.destroy());
	}

	private addItem(menu: Menu, text: string): void {
		if (this.disposed || this.added.has(menu) || !text) return;
		this.added.add(menu);
		menu.addItem(item => item.setTitle("Look up").setIcon("book-open-check").onClick(() => this.lookup(text)));
	}

	editorMenu(menu: Menu, editor: Editor): void {
		const text = cleanSelection(editor.getSelection());
		if (!text) return;
		this.addItem(menu, text);
		if (this.pending) {
			this.pending.nativeHandled = true;
			this.cancelTimer(this.pending);
			this.pending = null;
		}
	}

	private inject(menu: Menu): void {
		const context = this.pending;
		if (this.disposed || !context || context.nativeHandled || this.ownMenus.has(menu)) return;
		this.addItem(menu, context.text);
		context.nativeHandled = true;
		this.cancelTimer(context);
		context.fallback?.hide();
		this.pending = null;
	}

	private patchMenus(): void {
		const controller = this;
		const originalMouse = Menu.prototype.showAtMouseEvent;
		const originalPosition = Menu.prototype.showAtPosition;
		function mouse<T extends Menu>(this: T, ...args: Parameters<Menu["showAtMouseEvent"]>): T {
			controller.inject(this);
			originalMouse.apply(this, args);
			return this;
		}
		function position<T extends Menu>(this: T, ...args: Parameters<Menu["showAtPosition"]>): T {
			controller.inject(this);
			originalPosition.apply(this, args);
			return this;
		}
		// Wrap only public methods and keep other plugins' wrappers intact on unload.
		Menu.prototype.showAtMouseEvent = mouse;
		Menu.prototype.showAtPosition = position;
		this.restoreMenus = () => {
			if (Menu.prototype.showAtMouseEvent === mouse) Menu.prototype.showAtMouseEvent = originalMouse;
			if (Menu.prototype.showAtPosition === position) Menu.prototype.showAtPosition = originalPosition;
		};
	}

	private attachDocument(doc: Document, embedded = false): void {
		if (this.disposed || this.documents.has(doc)) return;
		const win = doc.defaultView;
		if (!win) return;
		const capture = (event: MouseEvent) => {
			this.clearPending();
			const rawText = selectedTextAt(doc, event.target, embedded);
			const text = cleanSelection(rawText);
			if (!text) return;
			const context: SelectionContext = { text, rawText, event, doc, nativeHandled: false, fallback: null, timer: null };
			this.pending = context;
			// Covers views that stop propagation while building their menu asynchronously.
			context.timer = win.setTimeout(() => this.showFallback(context), 0);
		};
		const bubble = (event: MouseEvent) => {
			const context = this.pending;
			if (context?.event !== event || context.nativeHandled) return;
			event.preventDefault();
			this.showFallback(context);
		};
		const clear = () => this.clearPending();
		const frameLoaded = (event: Event) => {
			const frame = event.target as HTMLIFrameElement | null;
			if (frame?.tagName === "IFRAME") this.attachFrame(frame, embedded);
		};
		doc.addEventListener("contextmenu", capture, true);
		doc.addEventListener("contextmenu", bubble);
		doc.addEventListener("pointerdown", clear, true);
		doc.addEventListener("keydown", clear, true);
		doc.addEventListener("load", frameLoaded, true);
		this.documents.set(doc, () => {
			doc.removeEventListener("contextmenu", capture, true);
			doc.removeEventListener("contextmenu", bubble);
			doc.removeEventListener("pointerdown", clear, true);
			doc.removeEventListener("keydown", clear, true);
			doc.removeEventListener("load", frameLoaded, true);
		});
		for (const frame of doc.querySelectorAll("iframe")) this.attachFrame(frame, embedded);
	}

	private attachFrame(frame: HTMLIFrameElement, embedded = false): void {
		if (!embedded && !frame.closest(".workspace-leaf-content")) return;
		try { if (frame.contentDocument) this.attachDocument(frame.contentDocument, true); }
		catch { /* Cross-origin/isolated webviews do not expose a document selection. */ }
	}

	private showFallback(context: SelectionContext): void {
		if (this.disposed || this.pending !== context || context.nativeHandled || context.fallback) return;
		this.cancelTimer(context);
		const menu = new Menu();
		this.ownMenus.add(menu);
		this.addItem(menu, context.text);
		menu.addItem(item => item.setTitle("Copy").setIcon("copy").onClick(async () => {
			try {
				const clipboard = context.doc.defaultView?.navigator.clipboard;
				if (!clipboard) throw new Error("Clipboard unavailable");
				await clipboard.writeText(context.rawText);
			} catch { new Notice("The selected text could not be copied to the clipboard."); }
		}));
		context.fallback = menu;
		menu.showAtPosition({ x: context.event.clientX, y: context.event.clientY }, context.doc);
	}

	private cancelTimer(context: SelectionContext): void {
		if (context.timer !== null) context.doc.defaultView?.clearTimeout(context.timer);
		context.timer = null;
	}
	private clearPending(): void {
		if (this.pending) this.cancelTimer(this.pending);
		this.pending = null;
	}
	private detachDocument(doc: Document): void {
		this.documents.get(doc)?.();
		this.documents.delete(doc);
		if (this.pending?.doc === doc) this.clearPending();
	}

	destroy(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.pending?.fallback?.hide();
		this.clearPending();
		for (const cleanup of this.documents.values()) cleanup();
		this.documents.clear();
		this.restoreMenus?.();
		this.restoreMenus = null;
	}
}

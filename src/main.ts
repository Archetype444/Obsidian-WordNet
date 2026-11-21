import { MarkdownView, Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import TheEditorSuggestor from "./EditSuggest";
import { ContextLookup } from "./ContextLookup";
import { cleanSelection, DictionaryService, escapeMarkdownText } from "./dictionary";
import { DICTIONARY_VIEW, DictionaryView } from "./DictionaryView";
import { DEFAULT_SETTINGS, normalizeSettings, WordNetSettingTab, type WordNetSettings } from "./settings";

export default class WordNetPlugin extends Plugin {
	settings: WordNetSettings = { ...DEFAULT_SETTINGS };
	dictionary = new DictionaryService();
	private ribbon: HTMLElement | null = null;
	private stopped = false;
	private activation: Promise<WorkspaceLeaf> | null = null;
	private lookupSequence = 0;

	async onload(): Promise<void> {
		this.stopped = false;
		this.settings = normalizeSettings(await this.loadData());
		if (this.stopped) return;
		try {
			await this.dictionary.initialize(this.app.vault.adapter, this.manifest.dir ?? "");
		} catch {
			new Notice("The bundled WordNet dictionary could not be loaded. Reinstall this plugin from its offline release package.");
			return;
		}
		if (this.stopped) return;
		if (this.dictionary.customError) new Notice(`WordNet is using its bundled dictionary. Your custom dictionary was skipped: ${this.dictionary.customError}`);
		this.registerView(DICTIONARY_VIEW, leaf => new DictionaryView(leaf, this.dictionary));
		this.addSettingTab(new WordNetSettingTab(this.app, this));
		this.updateRibbon();
		this.addCommand({ id: "open-wordnet-suggestor", name: "Look up selected text", callback: () => {
			const doc = this.app.workspace.getMostRecentLeaf()?.view.containerEl.ownerDocument ?? this.app.workspace.containerEl.ownerDocument;
			const selection = doc.getSelection()?.toString() ?? "";
			const editorSelection = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor.getSelection() ?? "";
			void this.openLookup(editorSelection || selection);
		} });
		this.registerEditorSuggest(new TheEditorSuggestor(this));
		new ContextLookup(this, this.app.workspace, text => this.openLookup(text)).start();
	}

	updateRibbon(): void {
		this.ribbon?.remove(); this.ribbon = null;
		if (this.settings.enableRibbon && !this.stopped) this.ribbon = this.addRibbonIcon("book-open-check", "Open offline dictionary", () => { void this.openLookup(""); });
	}

	private async sidebarLeaf(): Promise<WorkspaceLeaf> {
		const workspace = this.app.workspace;
		const existing = workspace.getLeavesOfType(DICTIONARY_VIEW).find(leaf => leaf.getRoot() === workspace.rightSplit);
		if (existing) return existing;
		const leaf = workspace.getRightLeaf(false);
		if (!leaf) throw new Error("The right sidebar is unavailable.");
		await leaf.setViewState({ type: DICTIONARY_VIEW, active: true });
		return leaf;
	}

	async openLookup(text: string): Promise<void> {
		if (this.stopped) return;
		const sequence = ++this.lookupSequence;
		try {
			const pending = this.activation ??= this.sidebarLeaf();
			let leaf: WorkspaceLeaf;
			try { leaf = await pending; }
			finally { if (this.activation === pending) this.activation = null; }
			if (this.stopped || sequence !== this.lookupSequence) return;
			const workspace = this.app.workspace;
			workspace.rightSplit.expand();
			await workspace.revealLeaf(leaf);
			if (this.stopped || sequence !== this.lookupSequence) return;
			if (!(leaf.view instanceof DictionaryView)) throw new Error("The dictionary panel did not load.");
			leaf.view.setQuery(cleanSelection(text));
			workspace.setActiveLeaf(leaf, { focus: true });
			leaf.view.focusSearch();
		} catch (error) {
			if (!this.stopped) new Notice(error instanceof Error ? error.message : "Could not open the dictionary sidebar.");
		}
	}

	renderDefinitionFromTemplate(term: string, definition: string): string {
		const values = { term: escapeMarkdownText(term), definition: escapeMarkdownText(definition) };
		return this.settings.insertTemplate.replace(/\{(term|definition)\}/g, (_, key: keyof typeof values) => values[key]);
	}
	async saveSettings(): Promise<void> { await this.saveData(this.settings); }
	onunload(): void {
		this.stopped = true;
		this.lookupSequence++;
		this.ribbon?.remove(); this.ribbon = null;
		this.app.workspace.detachLeavesOfType(DICTIONARY_VIEW);
	}
}

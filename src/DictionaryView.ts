import { ItemView, SearchComponent, type WorkspaceLeaf } from "obsidian";
import type { DictionaryService } from "./dictionary";

export const DICTIONARY_VIEW = "wordnet-offline-dictionary";

export class DictionaryView extends ItemView {
	private search: SearchComponent | null = null;
	private results: HTMLElement | null = null;
	private query = "";

	constructor(leaf: WorkspaceLeaf, private dictionary: DictionaryService) { super(leaf); }
	getViewType(): string { return DICTIONARY_VIEW; }
	getDisplayText(): string { return "WordNet Dictionary"; }
	getIcon(): string { return "book-open-check"; }

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("wordnet-dictionary-view");
		this.contentEl.createEl("h2", { text: "Dictionary" });
		const searchContainer = this.contentEl.createDiv({ cls: "wordnet-search" });
		this.search = new SearchComponent(searchContainer).setPlaceholder("Look up a word or phrase").onChange(value => {
			this.query = value;
			this.renderResults();
		});
		this.search.inputEl.setAttribute("aria-label", "Dictionary search");
		this.search.inputEl.setAttribute("spellcheck", "false");
		this.search.inputEl.setAttribute("autocomplete", "off");
		this.contentEl.createEl("p", { text: "Offline · English · WordNet 3.0", cls: "wordnet-local-status" });
		this.results = this.contentEl.createDiv({ cls: "wordnet-results", attr: { "aria-live": "polite", "aria-atomic": "true" } });
		this.renderResults();
	}

	setQuery(query: string): void {
		this.query = query;
		this.search?.setValue(query);
		this.renderResults();
	}

	focusSearch(): void { this.search?.inputEl.focus(); this.search?.inputEl.select(); }

	private renderResults(): void {
		if (!this.results) return;
		this.results.empty();
		if (!this.query.trim()) {
			this.results.createEl("p", { text: "Select text in a document, right-click, and choose Look up. You can also search here.", cls: "wordnet-empty" });
			return;
		}
		const entries = this.dictionary.query(this.query, 50);
		if (!entries.length) {
			this.results.createEl("p", { text: `No entry found for “${this.query}”. Try the word's base form or a shorter prefix.`, cls: "wordnet-empty" });
			return;
		}
		for (const entry of entries) {
			const result = this.results.createEl("article", { cls: "wordnet-definition" });
			result.createEl("h3", { text: entry.Term });
			result.createEl("p", { text: entry.Definition });
		}
	}

	async onClose(): Promise<void> {
		// Do not persist queries in workspace state or plugin settings.
		this.query = "";
		this.search = null;
		this.results = null;
		this.contentEl.empty();
	}
}

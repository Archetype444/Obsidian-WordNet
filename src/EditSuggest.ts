import { EditorSuggest, type Editor, type EditorPosition, type EditorSuggestContext,
	type EditorSuggestTriggerInfo, type TFile } from "obsidian";
import type WordNetPlugin from "./main";
import type { Definition } from "./dictionary";

export default class TheEditorSuggestor extends EditorSuggest<Definition> {
	constructor(private plugin: WordNetPlugin) { super(plugin.app); }

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.slashCommandEnabled) return null;
		const line = editor.getRange({ line: cursor.line, ch: 0 }, cursor);
		const shortcut = this.plugin.settings.slashCommandShortcut;
		const start = line.lastIndexOf(shortcut);
		if (start < 0) return null;
		const query = line.slice(start + shortcut.length);
		if (!query.trim()) return null;
		return { start: { line: cursor.line, ch: start }, end: cursor, query };
	}

	getSuggestions(context: EditorSuggestContext): Definition[] {
		return this.plugin.dictionary.query(context.query);
	}

	renderSuggestion(item: Definition, el: HTMLElement): void {
		el.createEl("b", { text: item.Term });
		el.createEl("div", { text: item.Definition });
	}

	selectSuggestion(item: Definition, evt: MouseEvent | KeyboardEvent): void {
		const context = this.context;
		this.close();
		if (!context) return;
		if (evt.ctrlKey || evt.metaKey) {
			void this.plugin.openLookup(item.Term);
			return;
		}
		context.editor.replaceRange(this.plugin.renderDefinitionFromTemplate(item.Term, item.Definition), context.start, context.end);
	}
}

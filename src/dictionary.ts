import bundledDictionary from "../dict-WordNet.json";
import type { DataAdapter } from "obsidian";

export interface Definition {
	SearchTerm: string;
	Term: string;
	Definition: string;
}

/** Normalize PDF line wrapping and ordinary surrounding punctuation locally. */
export function cleanSelection(text: string): string {
	return text.normalize("NFKC")
		.replace(/\u00ad/g, "")
		.replace(/([a-z])-[ \t]*\r?\n[ \t]*([a-z])/gi, "$1$2")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^["'“”‘’()[\]{}.,;:!?]+|["'“”‘’()[\]{}.,;:!?]+$/g, "")
		.trim();
}

export function searchKey(text: string): string {
	return cleanSelection(text).replace(/_/g, " ").toLowerCase();
}

export function parseDefinitions(text: string): Definition[] {
	const data: unknown = JSON.parse(text);
	if (!Array.isArray(data)) throw new Error("The dictionary must be a JSON array.");
	return data.map((value: unknown, index: number) => {
		if (!value || typeof value !== "object") throw new Error(`Invalid dictionary entry ${index + 1}.`);
		const item = value as Record<string, unknown>;
		if (typeof item.SearchTerm !== "string" || typeof item.Term !== "string" ||
			typeof item.Definition !== "string" || !item.SearchTerm.trim() || !item.Term.trim()) {
			throw new Error(`Invalid dictionary entry ${index + 1}. Expected SearchTerm, Term and Definition strings.`);
		}
		return { SearchTerm: item.SearchTerm, Term: item.Term, Definition: item.Definition };
	});
}

export class DictionaryIndex {
	private readonly entries: { key: string; item: Definition }[];
	constructor(items: Definition[]) {
		this.entries = items.map(item => ({ key: searchKey(item.SearchTerm), item }))
			.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
	}

	query(text: string, limit = 30): Definition[] {
		const key = searchKey(text);
		if (!key || limit <= 0) return [];
		let low = 0, high = this.entries.length;
		while (low < high) {
			const mid = (low + high) >>> 1;
			if (this.entries[mid].key < key) low = mid + 1;
			else high = mid;
		}
		const results: Definition[] = [];
		for (let i = low; i < this.entries.length && results.length < limit; i++) {
			if (!this.entries[i].key.startsWith(key)) break;
			results.push(this.entries[i].item);
		}
		return results;
	}
}

export class DictionaryService {
	private base: DictionaryIndex | null = null;
	private custom: DictionaryIndex | null = null;
	customError: string | null = null;

	async initialize(adapter: DataAdapter, pluginDir: string): Promise<void> {
		this.custom = null;
		this.customError = null;
		// Bundled at build time. There is deliberately no downloader or network fallback.
		this.base = new DictionaryIndex(parseDefinitions(bundledDictionary));
		const customPath = `${pluginDir}/dict-MyDict.json`;
		try {
			if (await adapter.exists(customPath)) {
				this.custom = new DictionaryIndex(parseDefinitions(await adapter.read(customPath)));
			}
		} catch (error) {
			this.customError = error instanceof Error ? error.message : "Could not read the custom dictionary.";
		}
	}

	query(text: string, limit = 30): Definition[] {
		const custom = this.custom?.query(text, limit) ?? [];
		const base = this.base?.query(text, limit) ?? [];
		const seen = new Set<string>();
		return [...custom, ...base].filter(item => {
			const key = `${item.Term}\0${item.Definition}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		}).slice(0, limit);
	}
}

/** Treat dictionary content as text when inserting it into a Markdown note. */
export function escapeMarkdownText(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/([\\`*{}\[\]()#+.!_|~-])/g, "\\$1");
}

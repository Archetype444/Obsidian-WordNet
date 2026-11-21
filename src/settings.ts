import { PluginSettingTab, Setting, type App } from "obsidian";
import type WordNetPlugin from "./main";

export interface WordNetSettings {
	enableRibbon: boolean;
	slashCommandEnabled: boolean;
	slashCommandShortcut: string;
	insertTemplate: string;
}

export const DEFAULT_SETTINGS: WordNetSettings = {
	enableRibbon: true,
	slashCommandEnabled: true,
	slashCommandShortcut: ";;",
	insertTemplate: "**{term}**\n{definition}\n",
};

export function normalizeSettings(value: unknown): WordNetSettings {
	const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
	return {
		enableRibbon: typeof input.enableRibbon === "boolean" ? input.enableRibbon : true,
		slashCommandEnabled: typeof input.slashCommandEnabled === "boolean" ? input.slashCommandEnabled : true,
		slashCommandShortcut: typeof input.slashCommandShortcut === "string" &&
			input.slashCommandShortcut.trim().length > 0 && input.slashCommandShortcut.length <= 32 &&
			!/[\r\n]/.test(input.slashCommandShortcut) ? input.slashCommandShortcut : DEFAULT_SETTINGS.slashCommandShortcut,
		insertTemplate: typeof input.insertTemplate === "string" && input.insertTemplate.trim().length > 0 &&
			input.insertTemplate.length <= 10000 ? input.insertTemplate : DEFAULT_SETTINGS.insertTemplate,
	};
}

export class WordNetSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: WordNetPlugin) { super(app, plugin); }

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("p", { text: "The dictionary is included in the plugin. Searches stay on this device, and this plugin makes no network requests." });
		new Setting(containerEl).setName("Ribbon button").setDesc("Show a button that opens the dictionary in the right sidebar.")
			.addToggle(toggle => toggle.setValue(this.plugin.settings.enableRibbon).onChange(async value => {
				this.plugin.settings.enableRibbon = value;
				this.plugin.updateRibbon();
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl).setName("Inline definitions").setDesc("Type the shortcut followed by a word to insert a definition. Right-click lookup always opens the sidebar without changing your document.")
			.addToggle(toggle => toggle.setValue(this.plugin.settings.slashCommandEnabled).onChange(async value => {
				this.plugin.settings.slashCommandEnabled = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl).setName("Inline shortcut").setDesc("A literal shortcut, up to 32 characters. Regular-expression symbols are safe.")
			.addText(input => input.setValue(this.plugin.settings.slashCommandShortcut).onChange(async value => {
				this.plugin.settings = normalizeSettings({ ...this.plugin.settings, slashCommandShortcut: value });
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl).setName("Definition insertion template").setDesc("Use {term} and {definition}. Dictionary text is escaped before insertion; your own template can contain Markdown formatting.")
			.addTextArea(input => input.setValue(this.plugin.settings.insertTemplate).onChange(async value => {
				this.plugin.settings = normalizeSettings({ ...this.plugin.settings, insertTemplate: value });
				await this.plugin.saveSettings();
			}));
	}
}

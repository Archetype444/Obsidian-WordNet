# WordNet Dictionary Offline for Obsidian

A free, open-source English dictionary with **no runtime network requests**. The complete WordNet 3.0 data is bundled in the plugin: no first-run download, account, API key, paid service, analytics, or cloud lookup.

Fork of [TfTHacker's Obsidian WordNet](https://github.com/TfTHacker/Obsidian-WordNet), maintained as an offline edition for Archetype444.

## Select text → right-click → Look up

1. Select a word or phrase in a Markdown editor, Markdown reading view, PDF text layer, or another Obsidian pane with accessible selectable text.
2. Right-click and choose **Look up**.
3. The dictionary opens in the **right sidebar** with your selected text already searched. A collapsed sidebar expands. If another sidebar tab was selected, the dictionary tab becomes active. An existing dictionary tab is reused.

Lookup is read-only: it does not replace or edit the selected text. The sidebar also has a search box and supports English multiword entries. PDF line wrapping and soft hyphens are normalized locally. You can open it from the ribbon or the **WordNet Dictionary Offline: Look up selected text** command.

The plugin extends Obsidian's existing menus when they use its `Menu` API. A pane without such a menu gets a selection menu with **Look up** and **Copy**. Pop-out windows and accessible same-origin document frames are supported. Scanned PDFs need an existing selectable text layer; this plugin does not perform OCR. Isolated third-party webviews or cross-origin frames that do not expose their selection to Obsidian cannot be read by this plugin. Native mobile OS selection callouts are separate from desktop right-click menus.

## Install

Requires Obsidian 1.9.14 or later.

1. Download the offline release ZIP and extract it. Alternatively use the release's `main.js`, `manifest.json`, and `styles.css` assets.
2. Put the files in `YOUR_VAULT/.obsidian/plugins/wordnet-offline-dictionary/`.
3. Reload Obsidian and enable **WordNet Dictionary Offline** in Community plugins.
4. Disable the original **WordNet Dictionary** plugin if it is installed, to avoid running two editions.

The plugin has its own ID (`wordnet-offline-dictionary`), so updating the original community plugin cannot overwrite this fork. The dictionary is inside `main.js`; do not download a separate `dict-WordNet.json` file. The install files can be copied from another device for an offline installation. Downloading an installer or source initially requires a transfer; using the installed plugin does not require a connection.

## Privacy

- Searches run entirely in memory on your device.
- The only document text read for lookup is the selection you invoke and, for inline suggestions, the current editor line.
- No vault-wide content scan, telemetry, external fonts, remote images, web dictionary, browser navigation, updater, or network fallback.
- Queries are not written to plugin settings or workspace view state. Explicitly inserted definitions become part of your note.
- Definitions in the sidebar are rendered as plain text. Dictionary text inserted into Markdown is escaped to prevent data from becoming remote image/HTML markup.
- Optional custom dictionaries and settings are read locally.

This describes this plugin. Obsidian itself, Sync, other plugins, custom user-authored insertion templates, and the operating system have their own behaviour. For an enforced application-wide no-network policy, block Obsidian's network access at the operating-system level.

## Optional inline insertion

In an editable Markdown note, type `;;privacy` and choose a suggestion to insert its definition. Customize the literal shortcut and insertion template in settings. Symbols such as `[` are treated as ordinary characters, not regular expressions. Hold Ctrl (Cmd on macOS) when choosing an inline suggestion to look it up in the sidebar without changing the note.

## Optional custom dictionary

Place `dict-MyDict.json` beside `main.js`, for example:

```json
[
  {"SearchTerm": "my term", "Term": "My term", "Definition": "My local definition."}
]
```

All three fields must be strings; search terms and displayed terms must be nonempty. Custom definitions are prioritized. A malformed custom file is skipped with a notice while the bundled dictionary continues working.

## Build and test

Build-time dependencies come from npm; installed plugin use is offline. Node.js 22 or later is recommended.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
npm run verify:offline
```

The installable files are in `build/`. The build verifies the bundled dictionary SHA-256 and data schema. The JavaScript has only one runtime dependency: Obsidian's own API. No runtime third-party libraries are included.

Tests exercise selection capture, native menu injection, fallback menus, window/frame lifecycle, sidebar expansion/tab selection, deferred views, concurrent lookups, custom dictionary validation, settings migration, literal shortcuts, and safe text rendering. The offline verifier checks the generated JavaScript for network entry points and runs a real-dictionary lookup from the release bundle in an instrumented host. Automated host mocks do not replace manual testing in Obsidian on every OS/file-viewer combination.

## Licences

Plugin code: [MIT](LICENSE), including the original author's copyright and the modifications in this fork. Dictionary: [Princeton WordNet 3.0 licence](LICENSE-WordNet), which permits use, copying, modification, and distribution, including commercial use, subject to its notices. Both licences ship with the installer. No subscription or paid service is required.

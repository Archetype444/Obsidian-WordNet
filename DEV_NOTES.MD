# Development

Use Node 22+ and `npm ci --ignore-scripts`. Run `npm run check`, `npm test`, `npm run build`, and `npm run verify:offline` before publishing.

The build embeds the checked-in dictionary as a string in `main.js`; no dictionary is fetched by installed code. The expected SHA-256 and record count are verified in `esbuild.config.mjs`. Updating dictionary data requires reviewing it and explicitly updating the expected digest.

Release tags are numeric semantic versions. Keep package.json, manifest.json, and versions.json aligned. The release workflow runs checks before publishing the JavaScript, manifest, CSS, and licence files. `npm run githubaction` is an explicit maintainer command that tags and pushes the current version using argument-based process execution.

The plugin's ID differs from upstream intentionally. Never restore upstream's download path or use a web dictionary fallback. The generic document context-menu integration wraps only public Menu display methods, restores them carefully on unload, and uses snapshots of the selected text rather than reading a selection after focus changes.

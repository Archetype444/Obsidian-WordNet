# 3.0.0 — Offline sidebar edition

- Add **Look up** for selected text in editor, PDF, reading, and other accessible document panes.
- Open and focus the right-sidebar dictionary; expand hidden sidebars, reuse existing tabs, and handle deferred/concurrent activation.
- Bundle all 206,797 WordNet entries into the installer. Remove the downloader and every runtime network path.
- Give the fork a separate plugin ID to prevent upstream updates from replacing the offline edition.
- Add a local prefix index, search box, plain-text definitions, and optional custom dictionaries.
- Fix startup/readiness failures, malformed custom dictionary handling, unsafe shortcut regex interpolation, missing ribbon defaults, and editor-context failures during insertion.
- Escape inserted dictionary text and safely replace repeated template placeholders, including literal dollar signs.
- Register and clean up menu hooks, document listeners, fallback timers, popout/frame handlers, and sidebar views.
- Pin build dependencies in a lockfile, validate dictionary integrity during builds, and add regression/offline checks.
- Preserve MIT and Princeton WordNet licences and author attribution.

# 2.0.6 (upstream)
- Updated dependencies.

import test from 'node:test';
import assert from 'node:assert/strict';
import {DictionaryIndex, DictionaryService, cleanSelection, parseDefinitions, escapeMarkdownText} from '../src/dictionary.ts';
import {normalizeSettings} from '../src/settings.ts';
const row = (word, definition = word) => ({SearchTerm: word, Term: word, Definition: definition});

test('Selection normalization supports quoted words, PDF wrapping, and multiword entries', () => {
	assert.equal(cleanSelection(' “Privacy,” '), 'Privacy');
	assert.equal(cleanSelection('dic-\ntionary'), 'dictionary');
	assert.equal(cleanSelection('  free\n software  '), 'free software');
});
test('Prefix index sorts keys, returns exact senses first, and obeys limits', () => {
	const index = new DictionaryIndex([row('privacy policy'), row('private'), row('privacy', 'sense 1'), row('privacy', 'sense 2')]);
	assert.deepEqual(index.query('PRIVACY').map(x => x.Definition), ['sense 1', 'sense 2', 'privacy policy']);
	assert.equal(index.query('privacy', 1).length, 1);
	assert.deepEqual(index.query(''), []);
	assert.deepEqual(index.query('zzzzz'), []);
});
test('Invalid custom data is rejected before indexing', () => {
	for (const text of ['{invalid', '{}', '[null]', '[{"SearchTerm":null,"Term":"bad","Definition":"bad"}]']) assert.throws(() => parseDefinitions(text));
});
test('Bundled real dictionary works without any downloaded/cached WordNet file', async () => {
	const reads = [];
	const dictionary = new DictionaryService();
	assert.deepEqual(dictionary.query('privacy'), []);
	await dictionary.initialize({async exists(path) { reads.push(path); return false; }, async read() { throw new Error('Unexpected read'); }}, '.obsidian/plugins/wordnet');
	assert(dictionary.query('privacy').length > 0);
	assert(dictionary.query('dictionary').length > 0);
	assert.deepEqual(reads, ['.obsidian/plugins/wordnet/dict-MyDict.json']);
});
test('A malformed custom dictionary does not disable bundled lookups', async () => {
	const dictionary = new DictionaryService();
	await dictionary.initialize({async exists() { return true; }, async read() { return '[{"SearchTerm":null}]'; }}, 'plugin');
	assert(dictionary.customError);
	assert(dictionary.query('privacy').length > 0);
});
test('Custom definitions take precedence and duplicates are removed', async () => {
	const dictionary = new DictionaryService();
	await dictionary.initialize({async exists() { return true; }, async read() { return JSON.stringify([row('privacy', 'Custom private definition'), row('privacy', 'Custom private definition')]); }}, 'plugin');
	const matches = dictionary.query('privacy');
	assert.equal(matches[0].Definition, 'Custom private definition');
	assert.equal(matches.filter(x => x.Definition === 'Custom private definition').length, 1);
});
test('Definition text cannot insert HTML or remote Markdown image syntax', () => {
	const escaped = escapeMarkdownText('<img src="https://example.invalid"> ![pixel](https://example.invalid/pixel)');
	assert(!escaped.includes('<img'));
	assert(escaped.includes('\\!\\[pixel\\]\\('));
});
test('Settings migration uses a whitelist and restores safe defaults', () => {
	const settings = normalizeSettings(JSON.parse('{"slashCommandShortcut":"[","enableRibbon":false,"query":"secret","__proto__":{"polluted":true}}'));
	assert.equal(settings.slashCommandShortcut, '[');
	assert.equal(settings.enableRibbon, false);
	assert.equal(Object.hasOwn(settings, 'query'), false);
	assert.equal(Object.hasOwn(settings, '__proto__'), false);
	assert.equal(normalizeSettings({slashCommandShortcut: '', insertTemplate: null}).slashCommandShortcut, ';;');
});

import { build, context } from "esbuild";
import { mkdir, copyFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const production = process.argv[2] === "production";
const dictionary = await readFile("dict-WordNet.json");
const expected = "41d0b8a49750c59c5ed6ef88ea1e3b8bca675333d1f7f048d32540b7b61a9010";
if (createHash("sha256").update(dictionary).digest("hex") !== expected) throw new Error("The bundled dictionary does not match the audited WordNet data.");
const rows = JSON.parse(dictionary.toString("utf8"));
if (!Array.isArray(rows) || rows.length !== 206797 || rows.some(row => !row || ["SearchTerm", "Term", "Definition"].some(key => typeof row[key] !== "string"))) throw new Error("Invalid WordNet data.");
await mkdir("build", { recursive: true });
await Promise.all(["manifest.json", "styles.css", "LICENSE", "LICENSE-WordNet", "README.md"].map(file => copyFile(file, `build/${file}`)));
const options = { entryPoints: ["src/main.ts"], bundle: true, external: ["obsidian"], format: "cjs", target: "es2018", logLevel: "info", sourcemap: false, treeShaking: true, loader: { ".json": "text" }, outfile: "build/main.js", metafile: true };
if (production) {
	const result = await build(options);
	if (Object.values(result.metafile.outputs).some(output => output.imports.some(item => item.path !== "obsidian"))) throw new Error("Unexpected runtime dependency.");
} else { await (await context(options)).watch(); }

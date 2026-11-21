import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error("Invalid release version.");
execFileSync("git", ["tag", "-a", version, "-m", version], { stdio: "inherit" });
execFileSync("git", ["push", "origin", version], { stdio: "inherit" });

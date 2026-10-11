// Packages the built mod (run `npm run build:mod` first) into a zip for Nexus Mods:
//   dist/StarfieldCompletionist-<version>.zip
// Its contents mirror the game's Data folder, so Vortex and MO2 install it as is.
//
//   npm run package [-- --version 0.9.0]

import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Windows bsdtar (System32): Git for Windows puts GNU tar first on PATH, which can't write zips
// and treats "C:" as a remote host.
const windowsTar = () => join(process.env.SystemRoot ?? "C:/Windows", "System32/tar.exe");

const repo = fileURLToPath(new URL("../../", import.meta.url));
const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")) as { version?: string };
const { values: args } = parseArgs({ options: { version: { type: "string", default: pkg.version ?? "0.0.0" } } });

const built = join(repo, "build/mod");
for (const required of ["StarfieldCompletionist.esm", "Scripts/Completionist/QuestTracker.pex", "SFSE/Plugins/OSF/UI/views/completionist/menu/data.js"]) {
  if (!existsSync(join(built, required))) {
    console.error(`Missing build/mod/${required}. Run: npm run build:mod`);
    process.exit(1);
  }
}

const stage = join(repo, "build/package");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

copyFileSync(join(built, "StarfieldCompletionist.esm"), join(stage, "StarfieldCompletionist.esm"));
cpSync(join(built, "Scripts"), join(stage, "Scripts"), { recursive: true });
cpSync(join(built, "SFSE"), join(stage, "SFSE"), { recursive: true });

// Script sources ship with the mod (GPL-3.0 requires the source to be available).
const sources = join(stage, "Scripts/Source/Completionist");
mkdirSync(sources, { recursive: true });
cpSync(join(repo, "papyrus/Source/Completionist"), sources, { recursive: true });
copyFileSync(join(repo, "build/papyrus/Completionist/QuestData.psc"), join(sources, "QuestData.psc"));
copyFileSync(join(repo, "LICENSE"), join(sources, "LICENSE.txt"));
copyFileSync(join(repo, "EXCEPTIONS"), join(sources, "EXCEPTIONS.txt"));

const distDir = join(repo, "dist");
mkdirSync(distDir, { recursive: true });
const zip = join(distDir, `StarfieldCompletionist-${args.version}.zip`);
rmSync(zip, { force: true });
// Windows' bsdtar writes zip archives with -a and a .zip name.
// Name the top-level items (not ".") so entries have no "./" prefix, which some mod managers mishandle.
const tar = spawnSync(windowsTar(), ["-a", "-c", "-f", zip, "-C", stage, "StarfieldCompletionist.esm", "Scripts", "SFSE"], { stdio: "inherit" });
if (tar.status !== 0) {
  throw new Error("Creating the zip failed");
}
console.log(`Packaged ${zip}`);

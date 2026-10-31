// Gathers the build outputs into release/. Tauri embeds the frontend in the release
// binary, so that binary doubles as the portable app. The word "portable" in its file
// name is what switches it to keeping its library beside the exe. Pass --installers to
// also move the NSIS and MSI packages, and to fail if either one is missing.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const buildDir = join(root, "src-tauri", "target", "release");
const releaseDir = join(root, "release");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function moveInstaller(folder, suffix) {
  const dir = join(buildDir, "bundle", folder);
  const names = existsSync(dir) ? readdirSync(dir) : [];
  const name = names.find((file) => file.includes(`_${version}_`) && file.endsWith(suffix));
  if (!name) fail(`No ${suffix} for version ${version} in ${dir}. Run "npm run dist".`);

  renameSync(join(dir, name), join(releaseDir, name));
  return name;
}

function copyPortable() {
  const source = join(buildDir, "stardust.exe");
  if (!existsSync(source)) fail(`Release binary not found at ${source}. Run "tauri build" first.`);

  const name = `Stardust_${version}_x64_portable.exe`;
  copyFileSync(source, join(releaseDir, name));
  return name;
}

mkdirSync(releaseDir, { recursive: true });

const packages = process.argv.includes("--installers")
  ? [moveInstaller("nsis", "-setup.exe"), moveInstaller("msi", ".msi"), copyPortable()]
  : [copyPortable()];

for (const name of packages) {
  const megabytes = (statSync(join(releaseDir, name)).size / 1024 / 1024).toFixed(2);
  console.log(`release/${name} (${megabytes} MB)`);
}

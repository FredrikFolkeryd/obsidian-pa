import { readFileSync, writeFileSync } from "fs";

// Read package.json to get the version
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const version = packageJson.version;

// Update manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

// Update versions.json
let versions = {};
try {
  versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch {
  // File doesn't exist or is empty
}
versions[version] = manifest.minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");

console.log(`Updated manifest.json and versions.json to version ${version}`);

// scripts/copy-assets.mjs
// Stand alone script to copy npm distributed files (replacing previous reliance on "copy-files-from-to")

// Note: require.resolve(`${packageName}/package.json`) doesn't work since typically not exported,
// thus we simply try with 'node_modules' and '..' paths, which should handle both npm and npx cases.

import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceRoots = [
  "node_modules",   // normal npm install
  "..",  // module/npx case
];

async function tryAccess(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function resolveSource(from, file) {
  const candidates = sourceRoots.map(root =>
    path.join(root, from, file)
  );

  for (const candidate of candidates) {
    if (await tryAccess(candidate)) {
      return candidate;
    }
  }

  return null;
}

// The stuff we need to provide in CytoBrowser/public
// Files ending with '?' are optional 
const assets = [
  {
    from: "openseadragon/build/openseadragon",
    to: "public/js/openseadragon",
    files: [
      "openseadragon.min.js",
      "openseadragon.min.js.map?",
      "images",
    ],
  },
  {
    from: "bootstrap/dist/js",
    to: "public/js/bootstrap",
    files: [
      "bootstrap.bundle.min.js",
      "bootstrap.bundle.min.js.map?",
    ],
  },
  {
    from: "bootstrap/dist/css",
    to: "public/css",
    files: [
      "bootstrap.min.css",
      "bootstrap.min.css.map?",
    ],
  },
  {
    from: "jquery/dist",
    to: "public/js/jquery",
    files: [
      "jquery.slim.min.js",
      "jquery.slim.min.map?",
    ],
  },
  {
    from: "pixi.js/dist",
    to: "public/js/pixi",
    files: [
      "pixi.min.js",
      "pixi.min.js.map?",
    ],
  },
];


// Main
console.log("Copying assets:");

for (const { from, to, files } of assets) {
  await mkdir(to, { recursive: true });

  for (const entry of files) {
    const optional = entry.endsWith("?");
    const file = optional ? entry.slice(0, -1) : entry;

    const source = await resolveSource(from, file);

    if (!source) {
      if (optional) {
        console.log(` Optional file not found: ${file}; ignoring`);
        continue;
      }

      throw new Error(`Required file not found: ${file}`);
    }

    const destination = path.join(to, file);

    await cp(source, destination, {
      recursive: true,
      force: true,
    });

    console.log(` Copied ${source} -> ${destination}`);
  }
}

console.log("Assets copy complete.");

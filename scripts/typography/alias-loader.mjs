import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();

const resolveProjectSpecifier = (specifier) => {
  const projectRelative = specifier.slice(2);
  const absoluteBase = path.resolve(projectRoot, projectRelative);
  const candidates = [
    absoluteBase,
    `${absoluteBase}.ts`,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.js`,
    `${absoluteBase}.mjs`,
    path.join(absoluteBase, "index.ts"),
    path.join(absoluteBase, "index.tsx"),
    path.join(absoluteBase, "index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
};

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const resolvedUrl = resolveProjectSpecifier(specifier);
    if (!resolvedUrl) {
      throw new Error(`Unable to resolve aliased specifier: ${specifier}`);
    }

    return {
      shortCircuit: true,
      url: resolvedUrl,
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}

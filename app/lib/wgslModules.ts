const INCLUDE_DIRECTIVE =
  /^[ \t]*\/\/[ \t]*@include[ \t]+"([^"\r\n]+)"[ \t]*(?:\r?\n|$)/gm;

export type WgslModulePart =
  | { kind: 'source'; value: string }
  | { kind: 'include'; value: string };

export interface WgslModuleSource {
  source: string;
  canonicalPath?: string;
}

export type WgslModuleReader = (path: string) => Promise<WgslModuleSource>;

/** Split a WGSL source file into literal source and `// @include "..."` parts. */
export function parseWgslModule(source: string): WgslModulePart[] {
  const parts: WgslModulePart[] = [];
  let cursor = 0;

  INCLUDE_DIRECTIVE.lastIndex = 0;
  for (let match = INCLUDE_DIRECTIVE.exec(source); match; match = INCLUDE_DIRECTIVE.exec(source)) {
    if (match.index > cursor) {
      parts.push({ kind: 'source', value: source.slice(cursor, match.index) });
    }
    parts.push({ kind: 'include', value: match[1] });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length || parts.length === 0) {
    parts.push({ kind: 'source', value: source.slice(cursor) });
  }
  return parts;
}

function resolveModulePath(parentPath: string, includePath: string): string {
  try {
    return new URL(includePath, parentPath).toString();
  } catch {
    const separator = parentPath.lastIndexOf('/');
    const parentDirectory = separator >= 0 ? parentPath.slice(0, separator + 1) : '';
    return `${parentDirectory}${includePath.replace(/^\.\//, '')}`;
  }
}

/** Compose a WGSL module tree while rejecting circular include chains. */
export async function composeWgslModule(
  entryPath: string,
  readModule: WgslModuleReader,
  ancestors: readonly string[] = [],
): Promise<string> {
  const loaded = await readModule(entryPath);
  const canonicalPath = loaded.canonicalPath ?? entryPath;
  if (ancestors.includes(canonicalPath)) {
    throw new Error(`Circular WGSL include: ${[...ancestors, canonicalPath].join(' -> ')}`);
  }

  const nextAncestors = [...ancestors, canonicalPath];
  const chunks: string[] = [];
  for (const part of parseWgslModule(loaded.source)) {
    if (part.kind === 'source') {
      chunks.push(part.value);
    } else {
      const childPath = resolveModulePath(canonicalPath, part.value);
      chunks.push(await composeWgslModule(childPath, readModule, nextAncestors));
    }
  }
  return chunks.join('');
}

/** Fetch and compose a public WGSL entry point and any relative include modules. */
export function loadWgslSource(
  entryUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  return composeWgslModule(entryUrl, async (path) => {
    const response = await fetcher(path);
    if (!response.ok) {
      throw new Error(`Shader load failed: ${response.status} ${response.url || path}`);
    }
    return {
      source: await response.text(),
      canonicalPath: response.url || path,
    };
  });
}

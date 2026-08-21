/** Static WGSL grammar / context checks used by `scripts/validate-shaders.ts`. */

const COMMENT_LINE = /\/\/[^\n]*/g;
const COMMENT_BLOCK = /\/\*[\s\S]*?\*\//g;

export function stripWgslComments(source: string): string {
  return source.replace(COMMENT_BLOCK, '').replace(COMMENT_LINE, '');
}

export interface DeclarationHit {
  kind: 'fn' | 'struct' | 'const' | 'override' | 'var';
  name: string;
}

/** Collect module-scope fn/struct/const names. WGSL does not nest these. */
export function collectTopLevelDeclarations(source: string): DeclarationHit[] {
  const text = stripWgslComments(source);
  const hits: DeclarationHit[] = [];
  const re = /\b(fn|struct|const|override)\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    hits.push({ kind: match[1] as DeclarationHit['kind'], name: match[2] });
  }
  return hits;
}

export function findDuplicateDeclarations(source: string): string[] {
  const seen = new Map<string, DeclarationHit['kind']>();
  const errors: string[] = [];
  for (const hit of collectTopLevelDeclarations(source)) {
    const prev = seen.get(hit.name);
    if (prev) {
      errors.push(`redefinition of '${hit.name}' (${prev} then ${hit.kind})`);
    } else {
      seen.set(hit.name, hit.kind);
    }
  }
  return errors;
}

export function findEntryPointNames(source: string): { vertex: string[]; fragment: string[] } {
  const text = stripWgslComments(source);
  const vertex: string[] = [];
  const fragment: string[] = [];
  const vertexRe = /@vertex\s+(?:@[^\n]+\s+)*fn\s+(\w+)/g;
  const fragmentRe = /@fragment\s+(?:@[^\n]+\s+)*fn\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = vertexRe.exec(text))) vertex.push(match[1]);
  while ((match = fragmentRe.exec(text))) fragment.push(match[1]);
  return { vertex, fragment };
}

const POSTFIX_INCREMENT = /\b([A-Za-z_]\w*)\s*\+\+/g;
const PREFIX_INCREMENT = /\+\+\s*([A-Za-z_]\w*)/g;

/** Postfix/prefix `++` is still rejected by some WGSL front-ends (context/grammar). */
export function findIncrementOperators(source: string): string[] {
  const text = stripWgslComments(source);
  const errors: string[] = [];
  for (const re of [POSTFIX_INCREMENT, PREFIX_INCREMENT]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      errors.push(`increment operator on '${match[1]}' is not portable WGSL; use x = x + 1`);
    }
  }
  return errors;
}

/**
 * `%` is portable for integers. Float remainder is a common Tint grammar/context
 * failure (yoga-regular starPattern used `uv.x % 1.0`).
 */
export function findFloatModulo(source: string): string[] {
  const text = stripWgslComments(source);
  const errors: string[] = [];
  const re = /([^\s]+)\s*%\s*([^\s;]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const left = match[1];
    const right = match[2];
    const floaty = (s: string) =>
      /\d+\.\d+/.test(s) ||
      /\.(x|y|z|w)\b/.test(s) ||
      /\b(floor|fract|length|sin|cos|log)\s*\(/.test(s);
    const inty = (s: string) =>
      /^\d+$/.test(s) ||
      /^\d+i$/.test(s) ||
      /^\d+u$/.test(s) ||
      /\b(i32|u32)\b/.test(s);
    if (floaty(left) || floaty(right)) {
      if (!inty(left) || !inty(right)) {
        errors.push(`float remainder '${match[0]}' is not portable WGSL; use a pmod helper`);
      }
    }
  }
  return errors;
}

/** Runtime array indexes should be i32 for the widest WGSL compiler set. */
export function findU32ArrayIndexes(source: string): string[] {
  const text = stripWgslComments(source);
  const errors: string[] = [];
  const re = /(\w+)\s*\[\s*u32\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    errors.push(`array '${match[1]}' indexed with u32(...); use i32(...) for portable WGSL`);
  }
  return errors;
}

const UNPARENTHESIZED_IF =
  /(?:^|[;{}])\s*if\s+(?![(])([^{\n]+)\s*\{/g;

/** Original WGSL required `if (expr)`; unparenthesized ifs still fail some compilers. */
export function findUnparenthesizedIf(source: string): string[] {
  const text = stripWgslComments(source);
  const errors: string[] = [];
  UNPARENTHESIZED_IF.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = UNPARENTHESIZED_IF.exec(text))) {
    const cond = match[1].trim();
    if (!cond) continue;
    errors.push(`unparenthesized if condition '${cond.slice(0, 48)}'; use if ( ... )`);
  }
  return errors;
}

export function findLeftoverIncludes(source: string): string[] {
  return /\/\/[ \t]*@include[ \t]+"/.test(source)
    ? ['composed source still contains // @include directives']
    : [];
}

#!/usr/bin/env node
/**
 * Dev-time validator: ensure every active WGSL shader declares the same
 * `struct Uniforms` layout described in `app/lib/shaderContract.ts`.
 *
 * Run with:
 *   npm run validate:shaders
 */
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { TECHNIQUES } from '../app/data/techniques.ts';
import {
  GROUP1_STRUCTS,
  layoutStruct,
  UNIFORM_FIELDS,
  UNIFORM_BUFFER_SIZE,
} from '../app/lib/shaderContract.ts';
import { FIELD_MODULES } from '../app/renderer/breathField/breathField.ts';
import { parseWgslModule } from '../app/lib/wgslModules.ts';
import { buildOverlayWgsl, OVERLAY_FRAGMENT_ENTRY, OVERLAY_VERTEX_ENTRY } from '../app/renderer/overlayWgsl.ts';
import {
  findDuplicateDeclarations,
  findEntryPointNames,
  findFloatModulo,
  findFullscreenQuads,
  findIncrementOperators,
  findLeftoverIncludes,
  findU32ArrayIndexes,
  findUnparenthesizedIf,
} from '../app/lib/wgslValidate.ts';

const ROOT = process.cwd();

const ACTIVE_SHADERS = [
  'public/sacred-monk.wgsl',
  'public/sacred-lotus-final.wgsl',
  'public/sacred-ultra.wgsl',
  'public/yoga-regular.wgsl',
];

const EXPECTED_BINDING = '@group(0) @binding(0) var<uniform> u: Uniforms;';
const MAX_MODULE_LINES = 699;

interface ParsedField {
  name: string;
  type: string;
}

function parseStruct(source: string, name = 'Uniforms'): ParsedField[] | null {
  const match = source.match(new RegExp(`struct\\s+${name}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) return null;

  const body = match[1];
  const fields: ParsedField[] = [];
  const lineRegex = /^\s*(\w+)\s*:\s*([^,/]+)(?:,|\/|$)/gm;
  let m;
  while ((m = lineRegex.exec(body)) !== null) {
    const name = m[1].trim();
    const type = m[2].trim();
    if (!name || !type) continue;
    fields.push({ name, type });
  }
  return fields;
}

function normalizeType(type: string): string {
  return type.replace(/\s+/g, '');
}

interface ShaderTree {
  source: string;
  files: Map<string, string>;
}

function readShaderTree(filePath: string, ancestors: readonly string[] = []): ShaderTree {
  const normalizedPath = normalize(filePath);
  if (ancestors.includes(normalizedPath)) {
    throw new Error(`circular include: ${[...ancestors, normalizedPath].join(' -> ')}`);
  }

  const rawSource = readFileSync(join(ROOT, normalizedPath), 'utf-8');
  const files = new Map([[normalizedPath, rawSource]]);
  const source: string[] = [];
  for (const part of parseWgslModule(rawSource)) {
    if (part.kind === 'source') {
      source.push(part.value);
      continue;
    }

    const childPath = normalize(join(dirname(normalizedPath), part.value));
    if (childPath.startsWith('..') || childPath.startsWith('/')) {
      throw new Error(`include escapes the repository: ${part.value}`);
    }
    const child = readShaderTree(childPath, [...ancestors, normalizedPath]);
    source.push(child.source);
    for (const [path, childSource] of child.files) files.set(path, childSource);
  }
  return { source: source.join(''), files };
}

function lineCount(source: string): number {
  if (source.length === 0) return 0;
  const lines = source.split('\n').length;
  return source.endsWith('\n') ? lines - 1 : lines;
}

function validateShader(filePath: string): string[] {
  let tree: ShaderTree;
  try {
    tree = readShaderTree(filePath);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const errors: string[] = [];

  if (tree.files.size > 1) {
    for (const [modulePath, moduleSource] of tree.files) {
      const lines = lineCount(moduleSource);
      if (lines > MAX_MODULE_LINES) {
        errors.push(`${modulePath} has ${lines} lines; expected fewer than 700`);
      }
    }
  }

  errors.push(...validateComposedSource(tree.source));
  const entries = findEntryPointNames(tree.source);
  const relativePath = filePath.replace(/^public\//, '');
  for (const technique of TECHNIQUES) {
    if (technique.shaderPath !== relativePath) continue;
    if (!entries.vertex.includes(technique.vertexEntry)) {
      errors.push(
        `technique '${technique.id}' expects vertex '${technique.vertexEntry}' (found: ${entries.vertex.join(', ') || 'none'})`,
      );
    }
    if (!entries.fragment.includes(technique.fragmentEntry)) {
      errors.push(
        `technique '${technique.id}' expects fragment '${technique.fragmentEntry}' (found: ${entries.fragment.join(', ') || 'none'})`,
      );
    }
  }

  return errors;
}

/** The geometry overlay's WGSL is built in TS (`overlayWgsl.ts`); hold it to the same contract. */
function validateOverlay(): string[] {
  const source = buildOverlayWgsl();
  const errors = validateComposedSource(source);
  const entries = findEntryPointNames(source);
  if (!entries.vertex.includes(OVERLAY_VERTEX_ENTRY)) errors.push(`missing overlay vertex '${OVERLAY_VERTEX_ENTRY}'`);
  if (!entries.fragment.includes(OVERLAY_FRAGMENT_ENTRY)) errors.push(`missing overlay fragment '${OVERLAY_FRAGMENT_ENTRY}'`);
  return errors;
}

/** Field-by-field comparison of one parsed struct against a contract field list. */
function compareStruct(
  label: string,
  parsed: ParsedField[],
  expected: ReadonlyArray<{ name: string; type: string }>,
): string[] {
  const errors: string[] = [];
  if (parsed.length !== expected.length) {
    errors.push(`${label} field count mismatch: shader has ${parsed.length}, contract expects ${expected.length}`);
  }
  const len = Math.max(parsed.length, expected.length);
  for (let i = 0; i < len; i++) {
    const want = expected[i];
    const actual = parsed[i];
    if (!want) {
      errors.push(`${label} extra field[${i}]: ${actual.name}: ${actual.type}`);
      continue;
    }
    if (!actual) {
      errors.push(`${label} missing field[${i}]: expected ${want.name}: ${want.type}`);
      continue;
    }
    if (actual.name !== want.name) {
      errors.push(`${label} field[${i}] name mismatch: shader '${actual.name}' vs contract '${want.name}'`);
    }
    if (normalizeType(actual.type) !== normalizeType(want.type)) {
      errors.push(`${label} field[${i}] '${want.name}' type mismatch: shader '${actual.type}' vs contract '${want.type}'`);
    }
  }
  return errors;
}

/**
 * Entry points each breath-field module must export (the backend binds them by
 * name in `breathField.ts`).
 */
const FIELD_ENTRY_POINTS: Record<keyof typeof FIELD_MODULES, { compute?: string[]; vertex?: string[]; fragment?: string[] }> = {
  sim: { compute: ['field_step', 'field_cull'] },
  particles: { vertex: ['particle_vs'], fragment: ['particle_fs'] },
  post: { vertex: ['post_vs'], fragment: ['bloom_prefilter_fs', 'bloom_down_fs', 'bloom_up_fs', 'tonemap_fs'] },
};

function findComputeEntryPoints(source: string): string[] {
  const names: string[] = [];
  const re = /@compute\s+(?:@[^\n]+\s+)*fn\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source.replace(/\/\/[^\n]*/g, '')))) names.push(match[1]);
  return names;
}

/**
 * Breath-field modules (`public/breath-field/*.wgsl`): same group-0 contract
 * and grammar checks as the scenes, plus every group-1 struct in
 * `GROUP1_STRUCTS` declared exactly as the contract derives it. They are
 * compute/billboard/post shaders, so the scene-only "vertex + fragment"
 * requirement does not apply; their own entry points are checked instead.
 */
function validateFieldModule(key: keyof typeof FIELD_MODULES): string[] {
  let tree: ShaderTree;
  try {
    tree = readShaderTree(`public/${FIELD_MODULES[key]}`);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const source = tree.source;
  const errors = validateUniformsAndGrammar(source);
  for (const [name, fields] of Object.entries(GROUP1_STRUCTS)) {
    const parsed = parseStruct(source, name);
    if (parsed === null) {
      errors.push(`missing \`struct ${name}\` (group-1 contract, app/lib/shaderContract.ts)`);
      continue;
    }
    errors.push(...compareStruct(name, parsed, fields));
  }
  const entries = findEntryPointNames(source);
  const compute = findComputeEntryPoints(source);
  const expected = FIELD_ENTRY_POINTS[key];
  for (const name of expected.compute ?? []) if (!compute.includes(name)) errors.push(`missing @compute '${name}'`);
  for (const name of expected.vertex ?? []) if (!entries.vertex.includes(name)) errors.push(`missing @vertex '${name}'`);
  for (const name of expected.fragment ?? []) if (!entries.fragment.includes(name)) errors.push(`missing @fragment '${name}'`);
  return errors;
}

/** Uniform-struct, grammar, and fullscreen-triangle checks on one composed WGSL source. */
function validateComposedSource(source: string): string[] {
  const errors = validateUniformsAndGrammar(source);
  const entries = findEntryPointNames(source);
  if (entries.vertex.length === 0) errors.push('missing @vertex entry point');
  if (entries.fragment.length === 0) errors.push('missing @fragment entry point');
  return errors;
}

function validateUniformsAndGrammar(source: string): string[] {
  const errors: string[] = [];
  if (!source.includes(EXPECTED_BINDING)) {
    errors.push(`missing or unexpected binding declaration (expected: ${EXPECTED_BINDING})`);
  }

  const parsed = parseStruct(source);
  if (parsed === null) {
    errors.push('missing `struct Uniforms { ... }` declaration');
    return errors;
  }

  if (parsed.length !== UNIFORM_FIELDS.length) {
    errors.push(
      `field count mismatch: shader has ${parsed.length}, contract expects ${UNIFORM_FIELDS.length}`
    );
  }

  const len = Math.max(parsed.length, UNIFORM_FIELDS.length);
  for (let i = 0; i < len; i++) {
    const expected = UNIFORM_FIELDS[i];
    const actual = parsed[i];
    if (!expected) {
      errors.push(`extra field[${i}]: ${actual.name}: ${actual.type}`);
      continue;
    }
    if (!actual) {
      errors.push(`missing field[${i}]: expected ${expected.name}: ${expected.type}`);
      continue;
    }
    if (actual.name !== expected.name) {
      errors.push(
        `field[${i}] name mismatch: shader '${actual.name}' vs contract '${expected.name}'`
      );
    }
    if (normalizeType(actual.type) !== normalizeType(expected.type)) {
      errors.push(
        `field[${i}] '${expected.name}' type mismatch: shader '${actual.type}' vs contract '${expected.type}'`
      );
    }
  }

  errors.push(
    ...findLeftoverIncludes(source),
    ...findDuplicateDeclarations(source),
    ...findIncrementOperators(source),
    ...findFloatModulo(source),
    ...findU32ArrayIndexes(source),
    ...findUnparenthesizedIf(source),
    ...findFullscreenQuads(source),
  );
  return errors;
}

function main() {
  let failed = false;
  const results: Array<[string, string[]]> = [
    ...ACTIVE_SHADERS.map((filePath): [string, string[]] => [filePath, validateShader(filePath)]),
    ['app/renderer/overlayWgsl.ts (generated)', validateOverlay()],
    ...(Object.keys(FIELD_MODULES) as Array<keyof typeof FIELD_MODULES>).map(
      (key): [string, string[]] => [`public/${FIELD_MODULES[key]}`, validateFieldModule(key)],
    ),
  ];
  for (const [label, errors] of results) {
    if (errors.length === 0) {
      console.log(`✓ ${label}`);
    } else {
      failed = true;
      console.error(`✗ ${label}`);
      for (const err of errors) {
        console.error(`    ${err}`);
      }
    }
  }

  console.log(`\nExpected buffer size: ${UNIFORM_BUFFER_SIZE} bytes`);
  for (const [name, fields] of Object.entries(GROUP1_STRUCTS)) {
    const layout = layoutStruct(fields);
    console.log(`Group-1 ${name}: ${layout.size} bytes (align ${layout.align})`);
  }
  if (failed) {
    console.error('\nShader contract validation failed.');
    process.exit(1);
  }
  console.log('Shader contract validation passed.');
}

main();

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
import { UNIFORM_FIELDS, UNIFORM_BUFFER_SIZE } from '../app/lib/shaderContract.ts';
import { parseWgslModule } from '../app/lib/wgslModules.ts';

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

function parseStruct(source: string): ParsedField[] | null {
  const match = source.match(/struct\s+Uniforms\s*\{([\s\S]*?)\}/);
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
  const errors: string[] = [];
  let tree: ShaderTree;
  try {
    tree = readShaderTree(filePath);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const source = tree.source;

  if (tree.files.size > 1) {
    for (const [modulePath, moduleSource] of tree.files) {
      const lines = lineCount(moduleSource);
      if (lines > MAX_MODULE_LINES) {
        errors.push(`${modulePath} has ${lines} lines; expected fewer than 700`);
      }
    }
  }

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

  return errors;
}

function main() {
  let failed = false;
  for (const filePath of ACTIVE_SHADERS) {
    const errors = validateShader(filePath);
    if (errors.length === 0) {
      console.log(`✓ ${filePath}`);
    } else {
      failed = true;
      console.error(`✗ ${filePath}`);
      for (const err of errors) {
        console.error(`    ${err}`);
      }
    }
  }

  console.log(`\nExpected buffer size: ${UNIFORM_BUFFER_SIZE} bytes`);
  if (failed) {
    console.error('\nShader contract validation failed.');
    process.exit(1);
  }
  console.log('Shader contract validation passed.');
}

main();

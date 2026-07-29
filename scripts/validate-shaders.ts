#!/usr/bin/env node
/**
 * Dev-time validator: ensure every active WGSL shader declares the same
 * `struct Uniforms` layout described in `app/lib/shaderContract.ts`.
 *
 * Run with:
 *   npm run validate:shaders
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UNIFORM_FIELDS, UNIFORM_BUFFER_SIZE } from '../app/lib/shaderContract.ts';

const ROOT = process.cwd();

const ACTIVE_SHADERS = [
  'public/sacred-monk.wgsl',
  'public/sacred-lotus-final.wgsl',
  'public/sacred-ultra.wgsl',
  'public/yoga-regular.wgsl',
];

const EXPECTED_BINDING = '@group(0) @binding(0) var<uniform> u: Uniforms;';

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

function validateShader(filePath: string): string[] {
  const fullPath = join(ROOT, filePath);
  const source = readFileSync(fullPath, 'utf-8');
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

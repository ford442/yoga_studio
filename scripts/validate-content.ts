#!/usr/bin/env node
/**
 * Content validator: ensure techniques, environments, instructor clips, and
 * referenced public/ assets are consistent and present.
 *
 * Run with:
 *   node --experimental-strip-types scripts/validate-content.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TECHNIQUES } from '../app/data/techniques.ts';
import { ENVIRONMENTS } from '../app/data/environments.ts';
import { PROGRAMS } from '../app/data/programs.ts';
import {
  INSTRUCTOR_STYLES,
  type InstructorPhaseClips,
} from '../app/data/instructorVideos.ts';
import type { SessionMode } from '../app/types/sessionMode.ts';
import type { Environment } from '../app/types/environment.ts';
import type { InstructorStyle } from '../app/data/instructorVideos.ts';
import type { Program, ProgramDay } from '../app/types/program.ts';

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'public');

const VALID_GOALS = ['calm', 'focus', 'energize', 'deep'] as const;
const VALID_DIFFICULTIES = ['gentle', 'moderate', 'advanced'] as const;
const VALID_PHASES = ['inhale', 'hold1', 'exhale', 'hold2'] as const;
const VALID_RECOMMENDED_MINUTES = [5, 10, 15] as const;
const VALID_PROGRAM_DURATIONS = [5, 10, 15, 'free'] as const;
const VALID_BLEND_MODES = ['normal', 'multiply', 'soft-light', 'overlay'] as const;
const VALID_CHAKRA_FOCUS = [-1, 0, 1, 2, 3, 4, 5, 6] as const;
const VALID_FIGURE_POSES = [0, 1, 2, 3, 4, 5, 6] as const;
const VALID_MANDALA_STYLES = [0, 1, 2] as const;
const VALID_THEMES = [0, 1, 2] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNonEmptyString = (value: unknown): boolean =>
  isString(value) && value.trim().length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isInteger = (value: unknown): boolean => isNumber(value) && Number.isInteger(value);

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const inRange = (value: unknown, min: number, max: number): boolean =>
  isNumber(value) && value >= min && value <= max;

const inIntegerRange = (value: unknown, min: number, max: number): boolean =>
  isInteger(value) && value >= min && value <= max;

const isHexColor = (value: unknown): boolean =>
  isString(value) && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value);

const isEnumValue = (value: unknown, values: readonly unknown[]): boolean =>
  values.includes(value);

const publicPath = (relativePath: string): string => join(PUBLIC_DIR, relativePath);

const fileExists = (relativePath: string): boolean =>
  existsSync(publicPath(relativePath));

const formatPath = (relativePath: string): string => `public/${relativePath}`;

interface ValidationResult {
  errors: string[];
  checked: number;
}

const emptyResult = (): ValidationResult => ({ errors: [], checked: 0 });

const addError = (result: ValidationResult, message: string): void => {
  result.errors.push(message);
};

const assertRequiredKeys = (
  result: ValidationResult,
  obj: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void => {
  for (const key of keys) {
    if (!(key in obj)) {
      addError(result, `${path}: missing required key "${key}"`);
    }
  }
};

const assertNonEmptyString = (
  result: ValidationResult,
  obj: Record<string, unknown>,
  key: string,
  path: string,
): void => {
  if (key in obj && !isNonEmptyString(obj[key])) {
    addError(result, `${path}: "${key}" must be a non-empty string`);
  }
};

const assertIntegerRange = (
  result: ValidationResult,
  obj: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  path: string,
): void => {
  if (key in obj && !inIntegerRange(obj[key], min, max)) {
    addError(result, `${path}: "${key}" must be an integer between ${min} and ${max}`);
  }
};

const assertNumberRange = (
  result: ValidationResult,
  obj: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  path: string,
): void => {
  if (key in obj && obj[key] !== undefined && !inRange(obj[key], min, max)) {
    addError(result, `${path}: "${key}" must be a number between ${min} and ${max}`);
  }
};

const assertOptionalNumberMin = (
  result: ValidationResult,
  obj: Record<string, unknown>,
  key: string,
  min: number,
  path: string,
): void => {
  if (key in obj && obj[key] !== undefined && !(isNumber(obj[key]) && (obj[key] as number) >= min)) {
    addError(result, `${path}: "${key}" must be a number >= ${min}`);
  }
};

const assertEnum = (
  result: ValidationResult,
  obj: Record<string, unknown>,
  key: string,
  values: readonly unknown[],
  path: string,
): void => {
  if (key in obj && !isEnumValue(obj[key], values)) {
    addError(result, `${path}: "${key}" must be one of ${values.map(String).join(', ')}`);
  }
};

const assertArrayOfEnum = (
  result: ValidationResult,
  obj: Record<string, unknown>,
  key: string,
  values: readonly unknown[],
  path: string,
): void => {
  const arr = obj[key];
  if (!Array.isArray(arr) || arr.length === 0) {
    addError(result, `${path}: "${key}" must be a non-empty array`);
    return;
  }
  for (const item of arr) {
    if (!isEnumValue(item, values)) {
      addError(result, `${path}: "${key}" contains invalid value "${String(item)}"`);
    }
  }
};

const assertOptionalString = (
  result: ValidationResult,
  obj: Record<string, unknown>,
  key: string,
  path: string,
): void => {
  if (key in obj && obj[key] !== undefined && !isString(obj[key])) {
    addError(result, `${path}: "${key}" must be a string`);
  }
};

const assertFileExists = (
  result: ValidationResult,
  relativePath: string,
  context: string,
): void => {
  if (!fileExists(relativePath)) {
    addError(result, `${context}: referenced asset "${formatPath(relativePath)}" does not exist`);
  }
};

function validateBreath(
  result: ValidationResult,
  breath: unknown,
  path: string,
): void {
  if (!isObject(breath)) {
    addError(result, `${path}: "breath" must be an object`);
    return;
  }
  for (const phase of VALID_PHASES) {
    if (!(phase in breath)) {
      addError(result, `${path}.breath: missing phase "${phase}"`);
      continue;
    }
    const value = breath[phase];
    if (!isInteger(value) || value < 0) {
      addError(result, `${path}.breath.${phase}: must be a non-negative integer`);
    }
  }
  const hasPositive = VALID_PHASES.some(
    (phase) => phase in breath && isInteger(breath[phase]) && (breath[phase] as number) > 0,
  );
  if (!hasPositive) {
    addError(result, `${path}.breath: at least one phase must be > 0`);
  }
}

function validatePhaseCues(
  result: ValidationResult,
  cues: unknown,
  path: string,
): void {
  if (!isObject(cues)) {
    addError(result, `${path}: "phaseCues" must be an object`);
    return;
  }
  for (const phase of VALID_PHASES) {
    if (!(phase in cues)) {
      addError(result, `${path}.phaseCues: missing cue for "${phase}"`);
      continue;
    }
    if (!isNonEmptyString(cues[phase])) {
      addError(result, `${path}.phaseCues.${phase}: must be a non-empty string`);
    }
  }
}

function validateTechniqueMeta(
  result: ValidationResult,
  meta: unknown,
  path: string,
): void {
  if (!isObject(meta)) {
    addError(result, `${path}: "technique" must be an object`);
    return;
  }
  assertRequiredKeys(result, meta, [
    'sanskritName',
    'commonName',
    'tagline',
    'scienceBenefit',
    'scienceDetail',
    'goals',
    'difficulty',
    'recommendedMinutes',
    'postureFocus',
    'phaseCues',
    'tradition',
    'beginnerFriendly',
  ], path);
  assertNonEmptyString(result, meta, 'sanskritName', path);
  assertNonEmptyString(result, meta, 'commonName', path);
  assertNonEmptyString(result, meta, 'tagline', path);
  assertNonEmptyString(result, meta, 'scienceBenefit', path);
  assertNonEmptyString(result, meta, 'scienceDetail', path);
  assertNonEmptyString(result, meta, 'postureFocus', path);
  assertNonEmptyString(result, meta, 'tradition', path);
  assertEnum(result, meta, 'difficulty', VALID_DIFFICULTIES, path);
  assertArrayOfEnum(result, meta, 'goals', VALID_GOALS, path);
  assertArrayOfEnum(result, meta, 'recommendedMinutes', VALID_RECOMMENDED_MINUTES, path);
  if ('phaseCues' in meta) {
    validatePhaseCues(result, meta.phaseCues, path);
  }
  if ('beginnerFriendly' in meta && !isBoolean(meta.beginnerFriendly)) {
    addError(result, `${path}: "beginnerFriendly" must be a boolean`);
  }
  assertOptionalString(result, meta, 'bandhaFocus', path);
  assertOptionalString(result, meta, 'drishtiCue', path);
}

function validateProgram(
  result: ValidationResult,
  program: Program,
  index: number,
  seenIds: Set<string>,
  validTechniqueIds: Set<string>,
): void {
  result.checked += 1;
  const obj = program as unknown as Record<string, unknown>;
  const path = `app/data/programs.ts[${index}]: ${program.id ?? `<index ${index}>`}`;

  assertRequiredKeys(result, obj, [
    'id',
    'label',
    'emoji',
    'description',
    'goals',
    'difficulty',
    'durationDays',
    'days',
  ], path);

  assertNonEmptyString(result, obj, 'id', path);
  assertNonEmptyString(result, obj, 'label', path);
  assertNonEmptyString(result, obj, 'emoji', path);
  assertNonEmptyString(result, obj, 'description', path);
  assertEnum(result, obj, 'difficulty', VALID_DIFFICULTIES, path);
  assertArrayOfEnum(result, obj, 'goals', VALID_GOALS, path);

  if (!Array.isArray(obj.days)) {
    addError(result, `${path}: "days" must be an array`);
    return;
  }

  if (!isInteger(obj.durationDays) || obj.durationDays <= 0) {
    addError(result, `${path}: "durationDays" must be a positive integer`);
  } else if (obj.durationDays !== obj.days.length) {
    addError(result, `${path}: "durationDays" (${obj.durationDays}) does not match days.length (${obj.days.length})`);
  }

  if ('id' in obj && isString(obj.id)) {
    if (seenIds.has(obj.id)) {
      addError(result, `${path}: duplicate program id "${obj.id}"`);
    }
    seenIds.add(obj.id);
  }

  const seenDayIndices = new Set<number>();
  for (let dayIndex = 0; dayIndex < obj.days.length; dayIndex += 1) {
    const day = obj.days[dayIndex] as ProgramDay;
    const dayPath = `${path}.days[${dayIndex}]`;

    if (!isObject(day)) {
      addError(result, `${dayPath}: day must be an object`);
      continue;
    }

    if (!('type' in day) || (day.type !== 'session' && day.type !== 'rest')) {
      addError(result, `${dayPath}: "type" must be "session" or "rest"`);
      continue;
    }

    if (!isInteger(day.dayIndex)) {
      addError(result, `${dayPath}: "dayIndex" must be an integer`);
    } else {
      if (day.dayIndex < 0 || day.dayIndex >= obj.days.length) {
        addError(result, `${dayPath}: "dayIndex" ${day.dayIndex} out of range 0..${obj.days.length - 1}`);
      }
      if (seenDayIndices.has(day.dayIndex)) {
        addError(result, `${dayPath}: duplicate "dayIndex" ${day.dayIndex}`);
      }
      seenDayIndices.add(day.dayIndex);
      if (day.dayIndex !== dayIndex) {
        addError(result, `${dayPath}: "dayIndex" ${day.dayIndex} does not match array position ${dayIndex}`);
      }
    }

    if (day.type === 'session') {
      assertRequiredKeys(result, day as Record<string, unknown>, ['techniqueId', 'durationMinutes'], dayPath);
      assertNonEmptyString(result, day as Record<string, unknown>, 'techniqueId', dayPath);
      assertEnum(result, day as Record<string, unknown>, 'durationMinutes', VALID_PROGRAM_DURATIONS, dayPath);
      if ('techniqueId' in day && isString(day.techniqueId) && !validTechniqueIds.has(day.techniqueId)) {
        addError(result, `${dayPath}: techniqueId "${day.techniqueId}" does not exist`);
      }
    }
  }
}

function validateTechnique(
  result: ValidationResult,
  technique: SessionMode,
  index: number,
  seenIds: Set<string>,
  validEnvironmentIds: readonly string[],
): void {
  result.checked += 1;
  const obj = technique as unknown as Record<string, unknown>;
  const path = `app/data/techniques.ts[${index}]: ${technique.id ?? `<index ${index}>`}`;

  assertRequiredKeys(result, obj, [
    'id',
    'label',
    'emoji',
    'description',
    'chakraFocus',
    'chakraFocusIndex',
    'accentColor',
    'shaderPath',
    'vertexEntry',
    'fragmentEntry',
    'breath',
    'theme',
    'mandalaStyle',
    'figurePose',
    'technique',
  ], path);

  assertNonEmptyString(result, obj, 'id', path);
  assertNonEmptyString(result, obj, 'label', path);
  assertNonEmptyString(result, obj, 'emoji', path);
  assertNonEmptyString(result, obj, 'description', path);
  assertNonEmptyString(result, obj, 'chakraFocus', path);
  assertIntegerRange(result, obj, 'chakraFocusIndex', VALID_CHAKRA_FOCUS[0], VALID_CHAKRA_FOCUS[VALID_CHAKRA_FOCUS.length - 1], path);
  if ('accentColor' in obj && !isHexColor(obj.accentColor)) {
    addError(result, `${path}: "accentColor" must be a hex color like #rrggbb`);
  }
  assertNonEmptyString(result, obj, 'shaderPath', path);
  assertNonEmptyString(result, obj, 'vertexEntry', path);
  assertNonEmptyString(result, obj, 'fragmentEntry', path);
  assertIntegerRange(result, obj, 'theme', VALID_THEMES[0], VALID_THEMES[VALID_THEMES.length - 1], path);
  assertIntegerRange(result, obj, 'mandalaStyle', VALID_MANDALA_STYLES[0], VALID_MANDALA_STYLES[VALID_MANDALA_STYLES.length - 1], path);
  assertIntegerRange(result, obj, 'figurePose', VALID_FIGURE_POSES[0], VALID_FIGURE_POSES[VALID_FIGURE_POSES.length - 1], path);

  if ('backgroundId' in obj && obj.backgroundId !== undefined) {
    if (!validEnvironmentIds.includes(obj.backgroundId as string)) {
      addError(
        result,
        `${path}: "backgroundId" "${String(obj.backgroundId)}" is not a valid environment id`,
      );
    }
  }

  assertNumberRange(result, obj, 'strengthLevel', 0, 2, path);
  assertOptionalNumberMin(result, obj, 'geometryDensity', 0, path);
  assertNumberRange(result, obj, 'interference', 0, 1, path);
  assertIntegerRange(result, obj, 'qualityPreset', 0, 1, path);
  assertOptionalNumberMin(result, obj, 'maxDevicePixelRatio', 1, path);

  if ('shaderPath' in obj && isString(obj.shaderPath)) {
    assertFileExists(result, obj.shaderPath, path);
  }

  if ('id' in obj && isString(obj.id)) {
    if (seenIds.has(obj.id)) {
      addError(result, `${path}: duplicate technique id "${obj.id}"`);
    }
    seenIds.add(obj.id);
  }

  if ('breath' in obj) {
    validateBreath(result, obj.breath, path);
  }
  if ('technique' in obj) {
    validateTechniqueMeta(result, obj.technique, path);
  }
}

function validateEnvironment(
  result: ValidationResult,
  env: Environment,
  index: number,
  seenIds: Set<string>,
  declaredIds: readonly string[],
): void {
  result.checked += 1;
  const obj = env as unknown as Record<string, unknown>;
  const path = `app/data/environments.ts[${index}]: ${env.id ?? `<index ${index}>`}`;

  assertRequiredKeys(result, obj, ['id', 'label', 'emoji', 'opacity', 'blendMode'], path);
  assertNonEmptyString(result, obj, 'id', path);
  assertNonEmptyString(result, obj, 'label', path);
  assertNonEmptyString(result, obj, 'emoji', path);
  assertNumberRange(result, obj, 'opacity', 0, 1, path);
  assertEnum(result, obj, 'blendMode', VALID_BLEND_MODES, path);

  if ('id' in obj && isString(obj.id)) {
    if (!declaredIds.includes(obj.id)) {
      addError(result, `${path}: environment id "${obj.id}" is not declared in EnvironmentId union`);
    }
    if (seenIds.has(obj.id)) {
      addError(result, `${path}: duplicate environment id "${obj.id}"`);
    }
    seenIds.add(obj.id);
  }

  if (obj.id !== 'none') {
    assertNonEmptyString(result, obj, 'imageSrc', path);
  }

  if ('imageSrc' in obj && isString(obj.imageSrc)) {
    assertFileExists(result, obj.imageSrc, path);
  }

  if ('averageLuminance' in obj && obj.averageLuminance !== undefined && !inRange(obj.averageLuminance, 0, 1)) {
    addError(result, `${path}: "averageLuminance" must be between 0 and 1`);
  }
}

function validateInstructorStyle(
  result: ValidationResult,
  style: InstructorStyle,
  index: number,
  seenIds: Set<string>,
): void {
  result.checked += 1;
  const obj = style as unknown as Record<string, unknown>;
  const path = `app/data/instructorVideos.ts[${index}]: ${style.id ?? `<index ${index}>`}`;

  assertRequiredKeys(result, obj, ['id', 'label', 'clips'], path);
  assertNonEmptyString(result, obj, 'id', path);
  assertNonEmptyString(result, obj, 'label', path);

  if ('id' in obj && isString(obj.id)) {
    if (seenIds.has(obj.id)) {
      addError(result, `${path}: duplicate instructor style id "${obj.id}"`);
    }
    seenIds.add(obj.id);
  }

  if (!isObject(obj.clips)) {
    addError(result, `${path}: "clips" must be an object`);
    return;
  }

  const clips = obj.clips as InstructorPhaseClips;
  for (const phase of VALID_PHASES) {
    const clip = clips[phase];
    const clipPath = `${path}.clips.${phase}`;
    if (!isObject(clip)) {
      addError(result, `${clipPath}: missing or invalid clip`);
      continue;
    }
    assertRequiredKeys(result, clip as Record<string, unknown>, ['src', 'duration', 'label'], clipPath);
    assertNonEmptyString(result, clip as Record<string, unknown>, 'src', clipPath);
    assertNonEmptyString(result, clip as Record<string, unknown>, 'label', clipPath);

    if ('duration' in clip && !(isNumber(clip.duration) && clip.duration > 0)) {
      addError(result, `${clipPath}: "duration" must be a positive number`);
    }

    if ('src' in clip && isString(clip.src)) {
      assertFileExists(result, clip.src, clipPath);
    }
    if ('webm' in clip && clip.webm !== undefined) {
      if (!isString(clip.webm)) {
        addError(result, `${clipPath}: "webm" must be a string`);
      } else {
        assertFileExists(result, clip.webm, clipPath);
      }
    }
  }
}

function validateSmokeTestAssets(result: ValidationResult): void {
  // These are the shaders the smoke tests require to exist.
  const requiredShaders = [
    'sacred-monk.wgsl',
    'sacred-lotus-final.wgsl',
    'sacred-ultra.wgsl',
    'yoga-regular.wgsl',
  ];
  for (const shader of requiredShaders) {
    assertFileExists(result, shader, 'smoke-test required shader');
  }
}

function validateBackgroundManifest(result: ValidationResult): void {
  const manifestPath = publicPath('backgrounds/manifest.json');
  if (!existsSync(manifestPath)) {
    addError(result, 'public/backgrounds/manifest.json is missing');
    return;
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    addError(result, 'public/backgrounds/manifest.json could not be parsed');
    return;
  }

  if (!isObject(manifest) || !Array.isArray(manifest.plates)) {
    addError(result, 'public/backgrounds/manifest.json: missing "plates" array');
    return;
  }

  for (const plate of manifest.plates) {
    if (!isObject(plate) || !isString(plate.id)) {
      addError(result, 'public/backgrounds/manifest.json: plate missing id');
      continue;
    }
    const sources = isObject(plate.sources) ? plate.sources : {};
    for (const crop of ['16x9', '9x16', '1x1'] as const) {
      const cropSources = isObject(sources[crop]) ? sources[crop] : {};
      for (const format of ['avif', 'webp', 'jpg'] as const) {
        const relativePath = cropSources[format];
        if (isString(relativePath)) {
          assertFileExists(result, relativePath, `background manifest plate "${plate.id}"`);
        }
      }
    }
  }
}

function printSummary(name: string, result: ValidationResult): void {
  const errorCount = result.errors.length;
  console.log(`${errorCount === 0 ? '✓' : '✗'} ${name}: ${result.checked} checked, ${errorCount} error${errorCount === 1 ? '' : 's'}`);
  for (const error of result.errors) {
    console.log(`    ${error}`);
  }
}

async function main(): Promise<void> {
  const techniqueResult = emptyResult();
  const programResult = emptyResult();
  const environmentResult = emptyResult();
  const instructorResult = emptyResult();
  const assetResult = emptyResult();

  const validEnvironmentIds = ENVIRONMENTS.map((env) => env.id);

  const seenTechniqueIds = new Set<string>();
  TECHNIQUES.forEach((technique, index) => {
    validateTechnique(techniqueResult, technique, index, seenTechniqueIds, validEnvironmentIds);
  });

  const seenProgramIds = new Set<string>();
  PROGRAMS.forEach((program, index) => {
    validateProgram(programResult, program, index, seenProgramIds, seenTechniqueIds);
  });

  const seenEnvironmentIds = new Set<string>();
  ENVIRONMENTS.forEach((env, index) => {
    validateEnvironment(environmentResult, env, index, seenEnvironmentIds, validEnvironmentIds);
  });

  const seenInstructorIds = new Set<string>();
  Object.values(INSTRUCTOR_STYLES).forEach((style, index) => {
    validateInstructorStyle(instructorResult, style, index, seenInstructorIds);
  });

  validateSmokeTestAssets(assetResult);
  await validateBackgroundManifest(assetResult);

  printSummary('Techniques', techniqueResult);
  printSummary('Programs', programResult);
  printSummary('Environments', environmentResult);
  printSummary('Instructor styles', instructorResult);
  printSummary('Assets', assetResult);

  const totalErrors =
    techniqueResult.errors.length +
    programResult.errors.length +
    environmentResult.errors.length +
    instructorResult.errors.length +
    assetResult.errors.length;

  if (totalErrors > 0) {
    console.error(`\nContent validation failed with ${totalErrors} error${totalErrors === 1 ? '' : 's'}.`);
    process.exit(1);
  }

  console.log('\nContent validation passed.');
}

main();

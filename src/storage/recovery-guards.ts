export class RecoveryDecodeError extends Error {
  constructor(message: string) { super(message); this.name = 'RecoveryDecodeError'; }
}
export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RecoveryDecodeError(message);
}
export function object(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  requireValue(typeof value === 'object' && value !== null && !Array.isArray(value), 'Expected a recovery object');
  const result = value as Record<string, unknown>;
  requireValue(required.every(key => Object.prototype.hasOwnProperty.call(result, key)) && Object.keys(result).every(key => required.includes(key) || optional.includes(key)), 'Missing or unsupported recovery fields');
  return result;
}
export function array(value: unknown, min = 0, max = 1000): unknown[] {
  requireValue(Array.isArray(value) && value.length >= min && value.length <= max, 'Recovery collection exceeds its bounds');
  return value;
}
export function text(value: unknown, min = 1, max = 100000): string {
  requireValue(typeof value === 'string' && value.length >= min && value.length <= max, 'Invalid recovery text');
  return value;
}
export function id(value: unknown): string {
  const result = text(value, 1, 128);
  requireValue(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(result), 'Invalid recovery identifier');
  return result;
}
export function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number {
  requireValue(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, 'Invalid recovery integer');
  return value;
}
export function time(value: unknown): number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'Invalid recovery time');
  return value;
}
export function boolean(value: unknown): boolean {
  requireValue(typeof value === 'boolean', 'Invalid recovery boolean');
  return value;
}
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  requireValue(typeof value === 'string' && allowed.some(item => item === value), 'Unsupported recovery variant');
  return value as T;
}
export function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
export function ids(value: unknown, min = 0, max = 1000): string[] {
  const result = array(value, min, max).map(id);
  requireValue(new Set(result).size === result.length, 'Duplicate recovery identifiers');
  return result;
}
export function parseRecoveryJson(value: unknown): unknown {
  const source = text(value, 1, 16000000);
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new RecoveryDecodeError('Recovery JSON could not be parsed'); }
  const work: { value: unknown; depth: number }[] = [{ value: parsed, depth: 0 }];
  let nodes = 0;
  while (work.length) {
    const current = work.pop()!;
    nodes += 1;
    requireValue(nodes <= 250000 && current.depth <= 64, 'Recovery JSON exceeds traversal bounds');
    if (Array.isArray(current.value)) {
      requireValue(current.value.length <= 10000, 'Recovery array exceeds traversal bounds');
      for (const item of current.value) work.push({ value: item, depth: current.depth + 1 });
    } else if (typeof current.value === 'object' && current.value !== null) {
      const entries = Object.entries(current.value);
      requireValue(entries.length <= 10000, 'Recovery object exceeds traversal bounds');
      for (const [, item] of entries) work.push({ value: item, depth: current.depth + 1 });
    }
  }
  return parsed;
}

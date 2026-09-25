import { simulationConfig } from './simulation-config.js';

export const PROTOCOL = 2;
export const SIM_VERSION = 'fsd-variety-3';
export const VERSION_MESSAGE = 'Game versions differ - refresh both players';

export function canonicalJSON(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Non-finite config');
  if (['undefined', 'function', 'symbol', 'bigint'].includes(typeof value)) throw new TypeError('Non-JSON config');
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}
export async function configHash(config = simulationConfig) {
  const bytes = new TextEncoder().encode(canonicalJSON(config));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
}
export function compatible(message, hash) {
  return message?.protocol === PROTOCOL && message.simVersion === SIM_VERSION && message.configHash === hash;
}
export function compatibleSetup(message, hash, expectedMode) {
  return compatible(message, hash) && ['pixel', '3d'].includes(message.gfx)
    && (expectedMode === undefined || message.gfx === expectedMode);
}
export function compatibilityFields(hash) {
  return { protocol: PROTOCOL, simVersion: SIM_VERSION, configHash: hash };
}

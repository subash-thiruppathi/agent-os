export function object(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || JSON.stringify(value).length > 16384 || Object.keys(value).some(k => !keys.includes(k))) {
    throw new Error('Invalid or oversized payload');
  }
}

export function reportSchema(value) {
  object(value, ['checklistComplete','customerAcknowledged','amount','unresolved','warranty']);
  for (const k of ['checklistComplete','customerAcknowledged','unresolved','warranty']) {
    if (k in value && typeof value[k] !== 'boolean') throw new Error(`Invalid boolean: ${k}`);
  }
  if (!Number.isSafeInteger(value.amount) || value.amount < 1 || value.amount > 100000000) {
    throw new Error('Report amount must be a positive integer in minor units');
  }
}

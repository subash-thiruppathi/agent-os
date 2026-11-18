export function text(value, name, max = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) throw new Error(`Invalid ${name}`);
  return value;
}

export function object(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || JSON.stringify(value).length > 16384 || Object.keys(value).some(k => !keys.includes(k))) {
    throw new Error('Invalid or oversized payload');
  }
}

export function intake(value) {
  object(value, ['customer','address','appliance','technician','slot','amount']);
  const result = { ...value };
  for (const k of ['customer','address','appliance','technician','slot']) {
    if (k in result) text(result[k], k, k === 'address' ? 1024 : 256);
  }
  if ('appliance' in result && result.appliance !== 'washing-machine') throw new Error('Unsupported appliance');
  if ('slot' in result) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(result.slot) || !Number.isFinite(Date.parse(result.slot))) {
      throw new Error('Invalid slot timestamp');
    }
    const zone = result.slot.endsWith('Z') ? null : result.slot.slice(-6);
    const offset = zone ? (Number(zone.slice(1,3)) * 60 + Number(zone.slice(4))) * (zone[0] === '+' ? 1 : -1) : 0;
    if (new Date(Date.parse(result.slot) + offset * 60000).toISOString().slice(0,19) !== result.slot.slice(0,19)) {
      throw new Error('Invalid calendar timestamp');
    }
    result.slot = new Date(result.slot).toISOString();
  }
  if ('amount' in result && (!Number.isSafeInteger(result.amount) || result.amount < 1 || result.amount > 100000000)) {
    throw new Error('Invalid amount');
  }
  return result;
}

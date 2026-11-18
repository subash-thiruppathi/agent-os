import { intake } from './validation.js';

/**
 * Booker Intake Parser: Parses unstructured customer inquiry text or notes
 * into a validated intake candidate with INR/paise normalization.
 */
export function parseIntake(rawText, options = {}) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return { success: false, errors: ['Input text must be a non-empty string'], missing: ['customer', 'address', 'appliance', 'technician', 'slot', 'amount'] };
  }
  if (rawText.length > 4096) {
    return { success: false, errors: ['Input text exceeds 4096 character limit'], missing: [] };
  }

  const text = rawText.replace(/\r\n/g, '\n');
  const candidate = {};
  const errors = [];
  const warnings = [];

  // 1. Appliance detection
  if (/\b(washing[-\s]*machine|washer|front\s*loader|top\s*loader)\b/i.test(text)) {
    candidate.appliance = 'washing-machine';
  } else if (/\b(refrigerator|fridge|microwave|dishwasher|dryer|oven|ac|air\s*conditioner)\b/i.test(text)) {
    const match = text.match(/\b(refrigerator|fridge|microwave|dishwasher|dryer|oven|ac|air\s*conditioner)\b/i);
    errors.push(`Unsupported appliance detected: "${match[0]}". Pilot only supports washing-machine.`);
  }

  // 2. Customer Name extraction
  const nameMatch = text.match(/(?:(?:customer|client|name)\s*[:=-]\s*|my\s+name\s+is\s+|i\s+am\s+)([A-Z][a-zA-Z\s]{1,50})(?:\n|,|\.|$)/i);
  if (nameMatch) {
    candidate.customer = nameMatch[1].trim();
  }

  // 3. Address extraction
  const addrMatch = text.match(/(?:(?:address|location|at)\s*[:=-]\s*)([^\n]+)/i);
  if (addrMatch) {
    candidate.address = addrMatch[1].trim();
  }

  // 4. Amount / Estimate extraction (INR / Paise)
  const paiseMatch = text.match(/(\d+)\s*paise\b/i);
  const inrMatch = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rupees|inr)/i);
  if (paiseMatch) {
    candidate.amount = parseInt(paiseMatch[1], 10);
  } else if (inrMatch) {
    const numStr = (inrMatch[1] || inrMatch[2]).replace(/,/g, '');
    const inr = parseFloat(numStr);
    if (!isNaN(inr) && inr > 0) {
      candidate.amount = Math.round(inr * 100);
    }
  }

  // 5. Slot / Timestamp extraction
  const slotMatch = text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})\b/);
  if (slotMatch) {
    candidate.slot = slotMatch[0];
  }

  // 6. Technician extraction
  const techMatch = text.match(/(?:technician|tech|assigned\s+to)\s*[:=-]\s*([a-zA-Z0-9_-]+)/i);
  if (techMatch) {
    candidate.technician = techMatch[1].trim();
  }

  // Apply explicit overrides/defaults from options
  if (options.defaults) {
    for (const [k, v] of Object.entries(options.defaults)) {
      if (candidate[k] === undefined && v !== undefined) {
        candidate[k] = v;
      }
    }
  }

  const required = ['customer', 'address', 'appliance', 'technician', 'slot', 'amount'];
  const missing = required.filter(k => candidate[k] === undefined);

  try {
    const validated = intake(candidate);
    return {
      success: missing.length === 0 && errors.length === 0,
      candidate: validated,
      missing,
      errors,
      warnings
    };
  } catch (err) {
    errors.push(err.message);
    return {
      success: false,
      candidate,
      missing,
      errors,
      warnings
    };
  }
}

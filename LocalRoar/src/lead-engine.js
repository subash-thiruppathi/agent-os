/**
 * LocalRoar Lead Engine: Ingests unstructured inquiries and estimates pricing.
 * Hardened against ReDoS and oversized payload denial-of-service.
 */

export const SERVICE_CATALOG = {
  plumbing: { name: 'Plumbing Repair', baseRate: 7500, estMinutes: 60 },
  electrical: { name: 'Electrical Diagnostics', baseRate: 8500, estMinutes: 60 },
  hvac: { name: 'HVAC Tune-up & Inspection', baseRate: 12000, estMinutes: 90 },
  detailing: { name: 'Auto Detailing', baseRate: 9500, estMinutes: 120 }
};

export class LeadEngine {
  parseInquiry(rawText, channel = 'web') {
    // SEC-10: Cap input length to 2000 characters to prevent ReDoS and CPU exhaustion
    const safeText = typeof rawText === 'string' ? rawText.slice(0, 2000) : '';
    const cleaned = safeText.toLowerCase();

    let detectedService = null;
    for (const [key, details] of Object.entries(SERVICE_CATALOG)) {
      if (cleaned.includes(key) || cleaned.includes(details.name.toLowerCase())) {
        detectedService = key;
        break;
      }
    }

    // Default to plumbing if general pipe/leak mentioned
    if (!detectedService && (cleaned.includes('pipe') || cleaned.includes('leak') || cleaned.includes('clog'))) {
      detectedService = 'plumbing';
    }

    // Urgent flag
    const isUrgent = cleaned.includes('emergency') || cleaned.includes('urgent') || cleaned.includes('asap') || cleaned.includes('flooding');

    // Extract basic phone/email safely with bounded regex
    const phoneMatch = safeText.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/);
    const emailMatch = safeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/);

    const quoteAmount = detectedService ? Math.round(SERVICE_CATALOG[detectedService].baseRate * (isUrgent ? 1.5 : 1.0)) : null;

    return {
      channel,
      serviceKey: detectedService,
      serviceName: detectedService ? SERVICE_CATALOG[detectedService].name : 'Custom Service',
      estimatedAmount: quoteAmount,
      isUrgent,
      customerPhone: phoneMatch ? phoneMatch[0] : null,
      customerEmail: emailMatch ? emailMatch[0] : null,
      rawText: safeText
    };
  }
}

/**
 * ResolveX Carrier Webhook Listener & Proactive Resolution Engine
 * Ingests real-time carrier tracking webhooks (FedEx, UPS, DHL),
 * identifies transit exceptions (weather, stall >= 48h, customs hold),
 * and pre-emptively dispatches priority traces and apology loyalty credits
 * before the customer ever encounters a delivery failure or files a support ticket.
 */

export const CarrierExceptionType = Object.freeze({
  WEATHER_EXCEPTION: 'WEATHER_EXCEPTION',
  TRANSIT_STALL_48H: 'TRANSIT_STALL_48H',
  CUSTOMS_HOLD: 'CUSTOMS_HOLD',
});

const DEFAULT_BASE_CREDITS = Object.freeze({
  [CarrierExceptionType.WEATHER_EXCEPTION]: 15.0,
  [CarrierExceptionType.TRANSIT_STALL_48H]: 25.0,
  [CarrierExceptionType.CUSTOMS_HOLD]: 30.0,
});

const TIER_MULTIPLIERS = Object.freeze({
  STANDARD: 1.0,
  BRONZE: 1.1,
  SILVER: 1.25,
  GOLD: 1.5,
  PLATINUM: 2.0,
});

let traceCounter = 1;
function generateTraceId(carrier = 'CARRIER') {
  const ts = Date.now().toString(36).toUpperCase();
  const seq = (traceCounter++).toString().padStart(4, '0');
  return `TRACE-${carrier.toUpperCase()}-${ts}-${seq}`;
}

let incidentCounter = 1;
function generateProactiveIncidentId() {
  const ts = Date.now().toString(36).toUpperCase();
  const seq = (incidentCounter++).toString().padStart(4, '0');
  return `PROACTIVE-${ts}-${seq}`;
}

export class CarrierWebhookListener {
  /**
   * @param {Object} options
   * @param {Object} [options.agent] - Optional ResolveXAgent instance
   * @param {Object} [options.policyEngine] - Optional PolicyEngine instance
   * @param {Object} [options.baseCredits] - Custom base credits by exception type
   * @param {Function} [options.onProactiveDispatch] - Custom callback when proactive action fires
   */
  constructor(options = {}) {
    this.agent = options.agent || null;
    this.policyEngine = options.policyEngine || null;
    this.baseCredits = { ...DEFAULT_BASE_CREDITS, ...(options.baseCredits || {}) };
    this.onProactiveDispatch = options.onProactiveDispatch || null;

    // Idempotency cache: Set of `${carrier}:${trackingNumber}:${exceptionType}`
    this.processedExceptions = new Map();
    // Audit & telemetry logs
    this.webhookLog = [];
    this.dispatchedActions = [];
    this.proactiveIncidents = [];
  }

  /**
   * Ingests a raw webhook event from FedEx, UPS, or DHL.
   * Detects exceptions and executes proactive resolution if warranted.
   * @param {Object} rawPayload - Webhook payload from carrier
   * @returns {Object} Ingestion and proactive resolution outcome
   */
  ingestWebhook(rawPayload = {}) {
    const event = this._normalizePayload(rawPayload);
    this.webhookLog.push({
      receivedAt: new Date().toISOString(),
      raw: rawPayload,
      normalized: event,
    });

    // Check if exception detected
    const detection = this.detectException(event);
    if (!detection.detected) {
      return {
        status: 'IGNORED_NO_EXCEPTION',
        carrier: event.carrier,
        trackingNumber: event.trackingNumber,
        exceptionDetected: false,
        proactiveActionTaken: false,
        message: 'Normal transit event processed; no exception detected.',
      };
    }

    const { exceptionType, details } = detection;
    const idempotencyKey = `${event.carrier}:${event.trackingNumber}:${exceptionType}`;

    // Check if we already took proactive action for this exception on this tracking number
    if (this.processedExceptions.has(idempotencyKey)) {
      return {
        status: 'DUPLICATE_SUPPRESSED',
        carrier: event.carrier,
        trackingNumber: event.trackingNumber,
        exceptionDetected: true,
        exceptionType,
        proactiveActionTaken: false,
        message: `Proactive action was already dispatched for ${exceptionType} on tracking ${event.trackingNumber}.`,
      };
    }

    // Execute proactive remediation before customer files a ticket
    const proactiveResult = this.dispatchProactiveRemediation({
      carrier: event.carrier,
      trackingNumber: event.trackingNumber,
      customerId: event.customerId,
      orderId: event.orderId,
      customerTier: event.customerTier,
      exceptionType,
      details,
    });

    this.processedExceptions.set(idempotencyKey, {
      dispatchedAt: Date.now(),
      incidentId: proactiveResult.proactiveIncident.id,
    });

    return proactiveResult;
  }

  /**
   * Detects if an event qualifies as WEATHER_EXCEPTION, TRANSIT_STALL_48H, or CUSTOMS_HOLD.
   * @param {Object} event - Normalized event
   * @returns {Object} Detection result
   */
  detectException(event = {}) {
    const textBlob = [
      event.eventCode,
      event.eventType,
      event.status,
      event.statusDescription,
      event.details,
      event.remarks,
    ].filter(Boolean).join(' ').toLowerCase();

    // 1. WEATHER_EXCEPTION detection
    const isWeatherCode = [
      'WEATHER_EXCEPTION',
      'WEATHER_DELAY',
      'SEVERE_WEATHER',
      'NATURAL_DISASTER',
      'ACT_OF_GOD',
      'SNOW_STORM_DELAY',
    ].includes(event.eventCode?.toUpperCase()) || [
      'WEATHER_EXCEPTION',
      'WEATHER_DELAY',
    ].includes(event.eventType?.toUpperCase());

    const isWeatherText = /weather|snow|blizzard|typhoon|hurricane|storm|tornado|flood|cyclone|freeze/i.test(textBlob);

    if (isWeatherCode || isWeatherText) {
      return {
        detected: true,
        exceptionType: CarrierExceptionType.WEATHER_EXCEPTION,
        confidence: 0.95,
        details: event.details || event.statusDescription || 'Severe weather transit disruption detected',
      };
    }

    // 2. TRANSIT_STALL_48H detection
    const isStallCode = [
      'TRANSIT_STALL_48H',
      'TRANSIT_STALL',
      'STALL_48H',
      'STATIONARY_DELAY',
      'NO_MOVEMENT_48H',
    ].includes(event.eventCode?.toUpperCase()) || [
      'TRANSIT_STALL_48H',
      'TRANSIT_STALL',
    ].includes(event.eventType?.toUpperCase());

    const stallHours = event.stallHours || event.hoursStalled || event.hoursSinceLastScan || 0;
    const hasStallTimestamp = this._calculateStallHours(event) >= 48;
    const isStallText = /transit.*stall|stall.*48|no movement.*48|stuck in transit.*(48|two days|2 days)/i.test(textBlob);

    if (isStallCode || stallHours >= 48 || hasStallTimestamp || isStallText) {
      return {
        detected: true,
        exceptionType: CarrierExceptionType.TRANSIT_STALL_48H,
        confidence: 0.95,
        stallHours: Math.max(stallHours, hasStallTimestamp ? this._calculateStallHours(event) : 48),
        details: event.details || event.statusDescription || `Shipment stationary for over 48 hours without hub progression`,
      };
    }

    // 3. CUSTOMS_HOLD detection
    const isCustomsCode = [
      'CUSTOMS_HOLD',
      'CUSTOMS_CLEARANCE_DELAY',
      'REGULATORY_HOLD',
      'BORDER_INSPECTION',
      'IMPORT_CUSTOMS_DELAY',
    ].includes(event.eventCode?.toUpperCase()) || [
      'CUSTOMS_HOLD',
      'CUSTOMS_CLEARANCE_DELAY',
    ].includes(event.eventType?.toUpperCase());

    const isCustomsText = /customs.*(hold|delay|inspect|clearance|duty|doc)|border.*(hold|inspect)/i.test(textBlob);

    if (isCustomsCode || isCustomsText) {
      return {
        detected: true,
        exceptionType: CarrierExceptionType.CUSTOMS_HOLD,
        confidence: 0.95,
        details: event.details || event.statusDescription || 'Shipment held at customs / regulatory border clearance',
      };
    }

    return {
      detected: false,
      exceptionType: null,
      confidence: 0,
      details: null,
    };
  }

  /**
   * Proactively dispatches priority trace and loyalty apology credit.
   */
  dispatchProactiveRemediation({
    carrier,
    trackingNumber,
    customerId = 'CUST-PROACTIVE',
    orderId = null,
    customerTier = 'STANDARD',
    exceptionType,
    details,
  }) {
    const proactiveTicketId = generateProactiveIncidentId();
    const traceId = generateTraceId(carrier);

    // Compute loyalty credit with tier multiplier
    const baseCredit = this.baseCredits[exceptionType] || 20.0;
    const tierMultiplier = TIER_MULTIPLIERS[customerTier.toUpperCase()] || 1.0;
    const creditAmount = Number((baseCredit * tierMultiplier).toFixed(2));

    // 1. Priority Carrier Trace Action
    const traceAction = {
      actionType: 'PRIORITY_CARRIER_TRACE',
      carrier: carrier.toUpperCase(),
      trackingNumber,
      priority: 'EXPEDITED_CRITICAL',
      traceTicketId: traceId,
      dispatchedAt: new Date().toISOString(),
      status: 'DISPATCHED',
      details: `Priority escalation inquiry filed with ${carrier} due to ${exceptionType}: ${details}`,
    };

    // 2. Proactive Apology Loyalty Credit Action
    const creditAction = {
      actionType: 'PROACTIVE_LOYALTY_CREDIT',
      customerId,
      amount: creditAmount,
      currency: 'USD',
      customerTier,
      reason: `Proactive apology credit for ${exceptionType} delay`,
      creditReference: `CRED-${Date.now().toString(36).toUpperCase()}`,
      dispatchedAt: new Date().toISOString(),
      status: 'ISSUED',
      breakdown: {
        baseCredit,
        tierMultiplier,
        finalCredit: creditAmount,
      },
    };

    // 3. Proactive Customer Incident Record
    const proactiveIncident = {
      id: proactiveTicketId,
      carrier: carrier.toUpperCase(),
      trackingNumber,
      customerId,
      orderId,
      exceptionType,
      beforeCustomerTicketFiled: true,
      createdAt: new Date().toISOString(),
      actionsDispatched: [traceAction, creditAction],
      customerNotification: {
        channel: 'SMS_AND_EMAIL',
        subject: `Proactive Update: We're taking care of your ${carrier} shipment`,
        message: `We noticed an unexpected ${exceptionType} with your shipment (${trackingNumber}). Before you needed to reach out, we've already opened an expedited priority trace with ${carrier} and credited $${creditAmount.toFixed(2)} to your account as an apology.`,
      },
    };

    this.dispatchedActions.push(traceAction, creditAction);
    this.proactiveIncidents.push(proactiveIncident);

    // If external listener/callback registered, trigger it
    if (typeof this.onProactiveDispatch === 'function') {
      try {
        this.onProactiveDispatch(proactiveIncident);
      } catch (err) {
        // preserve execution
      }
    }

    return {
      status: 'PROACTIVE_RESOLUTION_DISPATCHED',
      proactiveActionTaken: true,
      exceptionDetected: true,
      exceptionType,
      trackingNumber,
      carrier: carrier.toUpperCase(),
      customerId,
      dispatchedActions: [traceAction, creditAction],
      proactiveIncident,
    };
  }

  _normalizePayload(payload = {}) {
    // Carrier identification
    const rawCarrier = payload.carrier || payload.shippingCarrier || payload.carrierCode ||
      (payload.trackingNumber?.startsWith('1Z') ? 'UPS' :
       payload.trackingNumber?.startsWith('FX') ? 'FEDEX' :
       payload.shipmentTrackingNumber ? 'DHL' : 'UNKNOWN');

    const carrier = rawCarrier.toUpperCase();

    // Tracking Number
    const trackingNumber = payload.trackingNumber ||
      payload.tracking_number ||
      payload.shipmentTrackingNumber ||
      payload.waybillNumber ||
      payload.packageId ||
      'UNKNOWN_TRACKING';

    // Customer & Order
    const customerId = payload.customerId || payload.customer?.id || payload.recipientId || 'CUST-PROACTIVE';
    const orderId = payload.orderId || payload.orderNumber || payload.referenceId || null;
    const customerTier = payload.customerTier || payload.customer?.tier || 'STANDARD';

    // Event codes & details across FedEx, UPS, DHL conventions
    const eventCode = payload.eventCode ||
      payload.exceptionCode ||
      payload.activity?.code ||
      payload.details?.statusCode ||
      payload.exception?.code ||
      null;

    const eventType = payload.eventType || payload.event || payload.type || null;

    const status = payload.status ||
      payload.activity?.status ||
      payload.details?.status ||
      null;

    const statusDescription = payload.statusDescription ||
      payload.description ||
      payload.details?.remarks ||
      payload.activity?.description ||
      payload.exception?.description ||
      null;

    const details = payload.details?.description || payload.message || payload.remarks || statusDescription;

    const stallHours = payload.stallHours ||
      payload.hoursStalled ||
      payload.hoursSinceLastScan ||
      payload.activity?.hoursStalled ||
      0;

    const lastScanTime = payload.lastScanTime ||
      payload.activity?.lastScanTime ||
      payload.lastScanTimestamp ||
      null;

    const currentScanTime = payload.currentScanTime ||
      payload.timestamp ||
      null;

    return {
      carrier,
      trackingNumber,
      customerId,
      orderId,
      customerTier,
      eventCode,
      eventType,
      status,
      statusDescription,
      details,
      stallHours,
      lastScanTime,
      currentScanTime,
      raw: payload,
    };
  }

  _calculateStallHours(event) {
    if (event.lastScanTime && event.currentScanTime) {
      const last = new Date(event.lastScanTime).getTime();
      const curr = new Date(event.currentScanTime).getTime();
      if (!isNaN(last) && !isNaN(curr) && curr > last) {
        return (curr - last) / (1000 * 60 * 60);
      }
    }
    return 0;
  }
}

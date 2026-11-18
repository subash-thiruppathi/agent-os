import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DamageVerifier,
  DamageType,
  DamageVerificationStatus,
  CarrierWebhookListener,
  CarrierExceptionType,
} from '../src/index.js';

describe('DamageVerifier - Computer Vision Damage Assessment', () => {
  const verifier = new DamageVerifier();

  it('authenticates valid cracked screen photo with genuine camera metadata', () => {
    const photo = {
      photoId: 'IMG-CRACK-01',
      width: 1920,
      height: 1080,
      fileSizeBytes: 2450000,
      clarityScore: 0.92,
      detectedDamageTypes: [DamageType.CRACKED_SCREEN],
      exif: {
        deviceModel: 'iPhone 15 Pro',
        timestamp: '2026-11-18T14:30:00Z',
        gps: { latitude: 37.7749, longitude: -122.4194 },
        software: 'iOS 18.2',
      },
    };

    const evaluation = verifier.evaluatePhoto(photo);

    assert.strictEqual(evaluation.valid, true);
    assert.strictEqual(evaluation.status, DamageVerificationStatus.AUTHENTIC);
    assert.ok(evaluation.confidenceScore >= 0.85, `Expected score >= 0.85, got ${evaluation.confidenceScore}`);
    assert.deepStrictEqual(evaluation.detectedDamageTypes, [DamageType.CRACKED_SCREEN]);
    assert.strictEqual(evaluation.details.clarityScore, 0.92);
  });

  it('evaluates all supported damage types: WATER_DAMAGE, SHATTERED_CASING, PHYSICAL_DEFORMATION', () => {
    const damageTypes = [
      DamageType.WATER_DAMAGE,
      DamageType.SHATTERED_CASING,
      DamageType.PHYSICAL_DEFORMATION,
    ];

    for (const dtype of damageTypes) {
      const evaluation = verifier.evaluatePhoto({
        photoId: `IMG-${dtype}`,
        width: 1920,
        height: 1080,
        fileSizeBytes: 1800000,
        clarityScore: 0.88,
        detectedDamageTypes: [dtype],
        exif: {
          deviceModel: 'Google Pixel 9 Pro',
          timestamp: '2026-11-18T10:15:00Z',
        },
      });

      assert.strictEqual(evaluation.valid, true);
      assert.strictEqual(evaluation.status, DamageVerificationStatus.AUTHENTIC);
      assert.ok(evaluation.detectedDamageTypes.includes(dtype));
    }
  });

  it('rejects unreadable photo with low clarity score (blur/out of focus)', () => {
    const blurryPhoto = {
      photoId: 'BLURRY-01',
      width: 1920,
      height: 1080,
      clarityScore: 0.35, // Below 0.60 threshold
      detectedDamageTypes: [DamageType.CRACKED_SCREEN],
    };

    const evaluation = verifier.evaluatePhoto(blurryPhoto);

    assert.strictEqual(evaluation.valid, false);
    assert.strictEqual(evaluation.status, DamageVerificationStatus.UNREADABLE);
    assert.ok(evaluation.confidenceScore <= 0.40);
    assert.ok(evaluation.reasons.some((r) => r.includes('clarity score')));
  });

  it('rejects low-resolution image below minimum dimension threshold', () => {
    const lowResPhoto = {
      photoId: 'TINY-01',
      width: 320, // Below 640px threshold
      height: 240,
      clarityScore: 0.85,
      detectedDamageTypes: [DamageType.CRACKED_SCREEN],
    };

    const evaluation = verifier.evaluatePhoto(lowResPhoto);

    assert.strictEqual(evaluation.valid, false);
    assert.strictEqual(evaluation.status, DamageVerificationStatus.UNREADABLE);
    assert.ok(evaluation.reasons.some((r) => r.includes('width')));
  });

  it('rejects photo with no recognized physical damage types detected', () => {
    const noDamagePhoto = {
      photoId: 'CLEAN-01',
      width: 1920,
      height: 1080,
      clarityScore: 0.95,
      detectedDamageTypes: [],
      exif: { deviceModel: 'iPhone 15' },
    };

    const evaluation = verifier.evaluatePhoto(noDamagePhoto);

    assert.strictEqual(evaluation.valid, false);
    assert.strictEqual(evaluation.status, DamageVerificationStatus.INSUFFICIENT_EVIDENCE);
    assert.ok(evaluation.reasons.some((r) => r.includes('No recognized physical damage')));
  });

  it('detects fraudulent stock photo via URL domain, metadata flags, or watermarks', () => {
    // 1. URL referencing stock agency
    const stockUrlEval = verifier.evaluatePhoto({
      photoId: 'STOCK-01',
      width: 1920,
      height: 1080,
      clarityScore: 0.95,
      url: 'https://images.shutterstock.com/image-photo/cracked-smart-phone-screen-600w.jpg',
      detectedDamageTypes: [DamageType.CRACKED_SCREEN],
    });
    assert.strictEqual(stockUrlEval.valid, false);
    assert.strictEqual(stockUrlEval.status, DamageVerificationStatus.FRAUDULENT);
    assert.ok(stockUrlEval.confidenceScore <= 0.10);

    // 2. Explicit stock photo / watermark flag
    const watermarkEval = verifier.evaluatePhoto({
      photoId: 'STOCK-02',
      width: 1920,
      height: 1080,
      clarityScore: 0.90,
      watermarkDetected: true,
      detectedDamageTypes: [DamageType.SHATTERED_CASING],
    });
    assert.strictEqual(watermarkEval.valid, false);
    assert.strictEqual(watermarkEval.status, DamageVerificationStatus.FRAUDULENT);

    // 3. Known fraudulent hash
    const fraudRepoVerifier = new DamageVerifier({
      knownFraudulentHashes: ['HASH-KNOWN-FRAUD-999'],
    });
    const hashFraudEval = fraudRepoVerifier.evaluatePhoto({
      photoId: 'FRAUD-HASH-01',
      imageHash: 'HASH-KNOWN-FRAUD-999',
      width: 1920,
      height: 1080,
      clarityScore: 0.95,
      detectedDamageTypes: [DamageType.CRACKED_SCREEN],
    });
    assert.strictEqual(hashFraudEval.valid, false);
    assert.strictEqual(hashFraudEval.status, DamageVerificationStatus.FRAUDULENT);

    // 4. Manipulation software in EXIF (Photoshop / Deepfake)
    const manipulatedEval = verifier.evaluatePhoto({
      photoId: 'PHOTOSHOP-01',
      width: 1920,
      height: 1080,
      clarityScore: 0.92,
      detectedDamageTypes: [DamageType.CRACKED_SCREEN],
      exif: {
        software: 'Adobe Photoshop 2024 (Macintosh)',
      },
    });
    assert.strictEqual(manipulatedEval.valid, false);
    assert.strictEqual(manipulatedEval.status, DamageVerificationStatus.FRAUDULENT);
  });

  it('generates automated replacement authorization payload for genuine damage', () => {
    const photo = {
      photoId: 'GENUINE-REPL-01',
      width: 2560,
      height: 1440,
      clarityScore: 0.94,
      detectedDamageTypes: [DamageType.CRACKED_SCREEN],
      exif: {
        deviceModel: 'iPhone 15 Pro Max',
        timestamp: '2026-11-18T12:00:00Z',
      },
    };

    const evaluation = verifier.evaluatePhoto(photo);
    const authorization = verifier.generateReplacementAuthorization({
      evaluation,
      claim: { id: 'CLM-7890' },
      customer: { id: 'CUST-5541' },
      item: { sku: 'PROD-SMARTPHONE-15', serialNumber: 'SN-99887766' },
    });

    assert.strictEqual(authorization.authorized, true);
    assert.strictEqual(authorization.status, 'APPROVED');
    assert.ok(authorization.authorizationCode.startsWith('AUTH-REPL-'));
    assert.strictEqual(authorization.claimId, 'CLM-7890');
    assert.strictEqual(authorization.customerId, 'CUST-5541');
    assert.strictEqual(authorization.itemSku, 'PROD-SMARTPHONE-15');
    assert.strictEqual(authorization.serialNumber, 'SN-99887766');
    assert.strictEqual(authorization.replacementOrder.shippingSpeed, 'NEXT_DAY_PRIORITY');
    assert.strictEqual(authorization.replacementOrder.action, 'EXPEDITED_REPLACEMENT');
    assert.ok(authorization.replacementOrder.returnLabelCode.startsWith('RET-LBL-'));
  });

  it('refuses automated replacement authorization and flags human review for fraudulent claim', () => {
    const photo = {
      photoId: 'STOCK-SUSPECT',
      width: 1920,
      height: 1080,
      clarityScore: 0.90,
      isStockPhoto: true,
      detectedDamageTypes: [DamageType.WATER_DAMAGE],
    };

    const evaluation = verifier.evaluatePhoto(photo);
    const authorization = verifier.generateReplacementAuthorization({
      evaluation,
      claim: { id: 'CLM-FRAUD-01' },
      customer: { id: 'CUST-FLAGGED' },
      item: { sku: 'PROD-TABLET-01' },
    });

    assert.strictEqual(authorization.authorized, false);
    assert.strictEqual(authorization.status, 'REJECTED_FRAUD_SUSPECTED');
    assert.strictEqual(authorization.authorizationCode, null);
    assert.strictEqual(authorization.replacementOrder, null);
    assert.strictEqual(authorization.requiresHumanReview, true);
  });

  it('supports verifyDamageAndAuthorize composite pipeline', () => {
    const result = verifier.verifyDamageAndAuthorize({
      photo: {
        width: 1920,
        height: 1080,
        clarityScore: 0.91,
        detectedDamageTypes: [DamageType.PHYSICAL_DEFORMATION],
        exif: { deviceModel: 'Pixel 8', timestamp: '2026-11-18T09:00:00Z' },
      },
      claim: { claimId: 'CLM-COMPOSITE-1' },
      customer: { customerId: 'CUST-COMPOSITE-1' },
      item: { itemSku: 'SKU-LAPTOP-X1' },
    });

    assert.strictEqual(result.evaluation.valid, true);
    assert.strictEqual(result.authorization.authorized, true);
    assert.strictEqual(result.authorization.claimId, 'CLM-COMPOSITE-1');
  });
});

describe('CarrierWebhookListener - Proactive Transit Tracking & Resolution', () => {
  it('detects WEATHER_EXCEPTION from FedEx and proactively dispatches trace & apology credit', () => {
    const listener = new CarrierWebhookListener();

    const fedexWebhook = {
      carrier: 'FedEx',
      trackingNumber: 'FX-9876543210',
      customerId: 'CUST-1001',
      orderId: 'ORD-501',
      eventType: 'EXCEPTION',
      exceptionCode: 'WEATHER_DELAY',
      statusDescription: 'Severe blizzard in Memphis central hub causing ground shutdown',
    };

    const result = listener.ingestWebhook(fedexWebhook);

    assert.strictEqual(result.status, 'PROACTIVE_RESOLUTION_DISPATCHED');
    assert.strictEqual(result.proactiveActionTaken, true);
    assert.strictEqual(result.exceptionType, CarrierExceptionType.WEATHER_EXCEPTION);
    assert.strictEqual(result.carrier, 'FEDEX');
    assert.strictEqual(result.trackingNumber, 'FX-9876543210');

    // Verify dispatched actions
    assert.strictEqual(result.dispatchedActions.length, 2);
    const traceAction = result.dispatchedActions.find((a) => a.actionType === 'PRIORITY_CARRIER_TRACE');
    const creditAction = result.dispatchedActions.find((a) => a.actionType === 'PROACTIVE_LOYALTY_CREDIT');

    assert.ok(traceAction, 'Expected priority carrier trace action');
    assert.strictEqual(traceAction.priority, 'EXPEDITED_CRITICAL');
    assert.ok(traceAction.traceTicketId.startsWith('TRACE-FEDEX-'));

    assert.ok(creditAction, 'Expected proactive loyalty credit action');
    assert.strictEqual(creditAction.amount, 15.0); // Base weather credit
    assert.strictEqual(creditAction.customerId, 'CUST-1001');

    // Verify pre-emptive ticket created before customer ticket
    assert.strictEqual(result.proactiveIncident.beforeCustomerTicketFiled, true);
    assert.ok(result.proactiveIncident.customerNotification.message.includes('credited $15.00'));
  });

  it('detects TRANSIT_STALL_48H from UPS and proactively dispatches trace & loyalty credit', () => {
    const listener = new CarrierWebhookListener();

    const upsWebhook = {
      carrier: 'UPS',
      trackingNumber: '1Z9999999999999999',
      customerId: 'CUST-1002',
      eventType: 'STATUS_UPDATE',
      eventCode: 'TRANSIT_STALL_48H',
      stallHours: 54,
      details: 'Package stationary at Hodgkins facility for 54 hours without departure scan',
    };

    const result = listener.ingestWebhook(upsWebhook);

    assert.strictEqual(result.status, 'PROACTIVE_RESOLUTION_DISPATCHED');
    assert.strictEqual(result.proactiveActionTaken, true);
    assert.strictEqual(result.exceptionType, CarrierExceptionType.TRANSIT_STALL_48H);
    assert.strictEqual(result.carrier, 'UPS');

    const creditAction = result.dispatchedActions.find((a) => a.actionType === 'PROACTIVE_LOYALTY_CREDIT');
    assert.strictEqual(creditAction.amount, 25.0); // Base stall credit
  });

  it('detects TRANSIT_STALL_48H from timestamp differences (> 48 hours)', () => {
    const listener = new CarrierWebhookListener();

    const webhook = {
      carrier: 'FedEx',
      trackingNumber: 'FX-STALL-TIMESTAMP',
      customerId: 'CUST-1005',
      lastScanTime: '2026-11-15T08:00:00Z',
      currentScanTime: '2026-11-18T10:00:00Z', // 74 hours gap
      statusDescription: 'In transit - awaiting sort',
    };

    const result = listener.ingestWebhook(webhook);

    assert.strictEqual(result.proactiveActionTaken, true);
    assert.strictEqual(result.exceptionType, CarrierExceptionType.TRANSIT_STALL_48H);
  });

  it('detects CUSTOMS_HOLD from DHL and proactively dispatches trace & loyalty credit', () => {
    const listener = new CarrierWebhookListener();

    const dhlWebhook = {
      carrier: 'DHL',
      shipmentTrackingNumber: 'DHL-1122334455',
      customerId: 'CUST-1003',
      eventCode: 'CUSTOMS_HOLD',
      details: {
        statusCode: 'CUSTOMS_CLEARANCE_DELAY',
        remarks: 'Package held at port of entry for international customs inspection',
      },
    };

    const result = listener.ingestWebhook(dhlWebhook);

    assert.strictEqual(result.status, 'PROACTIVE_RESOLUTION_DISPATCHED');
    assert.strictEqual(result.proactiveActionTaken, true);
    assert.strictEqual(result.exceptionType, CarrierExceptionType.CUSTOMS_HOLD);
    assert.strictEqual(result.carrier, 'DHL');
    assert.strictEqual(result.trackingNumber, 'DHL-1122334455');

    const creditAction = result.dispatchedActions.find((a) => a.actionType === 'PROACTIVE_LOYALTY_CREDIT');
    assert.strictEqual(creditAction.amount, 30.0); // Base customs credit
  });

  it('applies customer tier multiplier to proactive loyalty credit', () => {
    const listener = new CarrierWebhookListener();

    const dhlPlatinumWebhook = {
      carrier: 'DHL',
      shipmentTrackingNumber: 'DHL-PLATINUM-01',
      customerId: 'CUST-PLATINUM',
      customerTier: 'PLATINUM', // 2.0x multiplier
      eventCode: 'CUSTOMS_HOLD',
    };

    const result = listener.ingestWebhook(dhlPlatinumWebhook);
    const creditAction = result.dispatchedActions.find((a) => a.actionType === 'PROACTIVE_LOYALTY_CREDIT');

    // 30.0 * 2.0 = 60.0
    assert.strictEqual(creditAction.amount, 60.0);
    assert.strictEqual(creditAction.customerTier, 'PLATINUM');
    assert.strictEqual(creditAction.breakdown.tierMultiplier, 2.0);
  });

  it('ignores standard in-transit webhooks with no exception', () => {
    const listener = new CarrierWebhookListener();

    const normalWebhook = {
      carrier: 'FedEx',
      trackingNumber: 'FX-NORMAL-001',
      status: 'IN_TRANSIT',
      statusDescription: 'Departed FedEx location Memphis, TN',
      currentScanTime: '2026-11-18T12:00:00Z',
      lastScanTime: '2026-11-18T08:00:00Z',
    };

    const result = listener.ingestWebhook(normalWebhook);

    assert.strictEqual(result.status, 'IGNORED_NO_EXCEPTION');
    assert.strictEqual(result.exceptionDetected, false);
    assert.strictEqual(result.proactiveActionTaken, false);
    assert.strictEqual(listener.dispatchedActions.length, 0);
  });

  it('enforces idempotency and suppresses duplicate proactive actions for replayed webhooks', () => {
    const listener = new CarrierWebhookListener();

    const webhook = {
      carrier: 'UPS',
      trackingNumber: '1Z-REPLAY-TEST',
      customerId: 'CUST-DUP',
      eventCode: 'WEATHER_EXCEPTION',
      details: 'Snowstorm delay',
    };

    // First ingestion -> proactive resolution dispatched
    const firstResult = listener.ingestWebhook(webhook);
    assert.strictEqual(firstResult.status, 'PROACTIVE_RESOLUTION_DISPATCHED');
    assert.strictEqual(firstResult.proactiveActionTaken, true);

    // Second ingestion (replayed webhook) -> duplicate suppressed
    const secondResult = listener.ingestWebhook(webhook);
    assert.strictEqual(secondResult.status, 'DUPLICATE_SUPPRESSED');
    assert.strictEqual(secondResult.proactiveActionTaken, false);

    // Total dispatched actions must be exactly 2 (from first execution only)
    assert.strictEqual(listener.dispatchedActions.length, 2);
  });

  it('triggers onProactiveDispatch callback when proactive action fires', () => {
    let callbackFired = false;
    let receivedIncident = null;

    const listener = new CarrierWebhookListener({
      onProactiveDispatch: (incident) => {
        callbackFired = true;
        receivedIncident = incident;
      },
    });

    listener.ingestWebhook({
      carrier: 'FedEx',
      trackingNumber: 'FX-CALLBACK-01',
      eventCode: 'WEATHER_EXCEPTION',
    });

    assert.strictEqual(callbackFired, true);
    assert.ok(receivedIncident);
    assert.strictEqual(receivedIncident.carrier, 'FEDEX');
    assert.strictEqual(receivedIncident.exceptionType, CarrierExceptionType.WEATHER_EXCEPTION);
  });
});

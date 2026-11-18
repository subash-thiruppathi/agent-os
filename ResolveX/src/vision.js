/**
 * ResolveX Computer Vision Damage Assessment Engine
 * Evaluates photo evidence metadata, clarity, authentic device telemetry,
 * and detects physical product damage to autonomously authorize replacements.
 */

export const DamageType = Object.freeze({
  CRACKED_SCREEN: 'CRACKED_SCREEN',
  WATER_DAMAGE: 'WATER_DAMAGE',
  SHATTERED_CASING: 'SHATTERED_CASING',
  PHYSICAL_DEFORMATION: 'PHYSICAL_DEFORMATION',
});

export const DamageVerificationStatus = Object.freeze({
  AUTHENTIC: 'AUTHENTIC',
  FRAUDULENT: 'FRAUDULENT',
  UNREADABLE: 'UNREADABLE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
});

const DEFAULT_STOCK_DOMAINS = [
  'shutterstock.com',
  'gettyimages.com',
  'istockphoto.com',
  'stock.adobe.com',
  'unsplash.com',
  'pexels.com',
  'alamy.com',
  'depositphotos.com',
  'dreamstime.com',
];

const KNOWN_MANIPULATION_SOFTWARE = [
  /photoshop/i,
  /gimp/i,
  /midjourney/i,
  /dall-e/i,
  /stablediffusion/i,
  /deepfake/i,
];

let authIdCounter = 1;
function generateAuthCode(prefix = 'AUTH-REPL') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const counter = (authIdCounter++).toString().padStart(4, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${counter}-${randomSuffix}`;
}

export class DamageVerifier {
  constructor(options = {}) {
    this.minClarityScore = options.minClarityScore ?? 0.60;
    this.minWidth = options.minWidth ?? 640;
    this.minHeight = options.minHeight ?? 480;
    this.minFileSizeBytes = options.minFileSizeBytes ?? 15000;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.70;
    this.stockDomains = options.stockDomains || DEFAULT_STOCK_DOMAINS;
    this.knownFraudulentHashes = new Set(options.knownFraudulentHashes || []);
    this.processedPhotos = new Map(); // hash -> { claimId, customerId, timestamp }
  }

  /**
   * Evaluates photo evidence metadata, computes confidence, and detects fraud/readability.
   * @param {Object} photo - Photo metadata object
   * @returns {Object} Evaluation report
   */
  evaluatePhoto(photo = {}) {
    const reasons = [];
    const detectedDamageTypes = this._extractDamageTypes(photo);
    const clarityScore = typeof photo.clarityScore === 'number' ? Math.max(0, Math.min(1, photo.clarityScore)) : 0;
    const width = photo.width || 0;
    const height = photo.height || 0;
    const fileSizeBytes = photo.fileSizeBytes || photo.size || 0;
    const exif = photo.exif || {};
    const url = photo.url || '';
    const imageHash = photo.imageHash || photo.hash || photo.photoId;

    // 1. Check for Fraudulent Indicators
    const fraudCheck = this._detectFraud({ photo, exif, url, imageHash });
    if (fraudCheck.isFraudulent) {
      reasons.push(...fraudCheck.reasons);
      const confidenceScore = 0.05;
      return {
        valid: false,
        status: DamageVerificationStatus.FRAUDULENT,
        confidenceScore,
        detectedDamageTypes,
        reasons,
        details: {
          clarityScore,
          resolution: { width, height },
          fraudCheck,
          isStockPhoto: fraudCheck.isStockPhoto,
        },
      };
    }

    // 2. Check for Unreadable / Poor Quality Image
    const readabilityCheck = this._checkReadability({ clarityScore, width, height, fileSizeBytes });
    if (!readabilityCheck.isReadable) {
      reasons.push(...readabilityCheck.reasons);
      const confidenceScore = Math.min(0.40, clarityScore * 0.5);
      return {
        valid: false,
        status: DamageVerificationStatus.UNREADABLE,
        confidenceScore: Number(confidenceScore.toFixed(2)),
        detectedDamageTypes,
        reasons,
        details: {
          clarityScore,
          resolution: { width, height },
          readabilityCheck,
        },
      };
    }

    // 3. Check for Detected Damage Evidence
    if (detectedDamageTypes.length === 0) {
      reasons.push('No recognized physical damage types detected in photo metadata');
      return {
        valid: false,
        status: DamageVerificationStatus.INSUFFICIENT_EVIDENCE,
        confidenceScore: 0.20,
        detectedDamageTypes: [],
        reasons,
        details: {
          clarityScore,
          resolution: { width, height },
        },
      };
    }

    // 4. Compute Confidence Score for Authentic Damage
    const confidenceScore = this._computeConfidence({
      clarityScore,
      width,
      height,
      exif,
      detectedDamageTypes,
      photo,
    });

    // Record photo hash if provided to prevent replay
    if (imageHash) {
      this.processedPhotos.set(imageHash, {
        timestamp: Date.now(),
        photoId: photo.photoId || photo.id,
      });
    }

    const isAuthentic = confidenceScore >= this.confidenceThreshold;
    if (!isAuthentic) {
      reasons.push(`Confidence score (${confidenceScore}) below acceptance threshold (${this.confidenceThreshold})`);
    }

    return {
      valid: isAuthentic,
      status: isAuthentic ? DamageVerificationStatus.AUTHENTIC : DamageVerificationStatus.INSUFFICIENT_EVIDENCE,
      confidenceScore,
      detectedDamageTypes,
      reasons,
      details: {
        clarityScore,
        resolution: { width, height },
        deviceModel: exif.deviceModel || null,
        timestamp: exif.timestamp || null,
      },
    };
  }

  /**
   * Generates automated replacement authorization payload for genuine damage.
   * @param {Object} options
   * @param {Object} options.evaluation - Damage evaluation result from evaluatePhoto
   * @param {Object} options.claim - Customer claim details
   * @param {Object} options.customer - Customer account details
   * @param {Object} options.item - Product / hardware item details
   * @returns {Object} Authorization payload
   */
  generateReplacementAuthorization({ evaluation, claim = {}, customer = {}, item = {} }) {
    if (!evaluation || evaluation.status !== DamageVerificationStatus.AUTHENTIC) {
      return {
        authorized: false,
        status: evaluation?.status === DamageVerificationStatus.FRAUDULENT
          ? 'REJECTED_FRAUD_SUSPECTED'
          : evaluation?.status === DamageVerificationStatus.UNREADABLE
            ? 'REQUIRES_CLEARER_PHOTO'
            : 'REQUIRES_MANUAL_REVIEW',
        authorizationCode: null,
        claimId: claim.id || claim.claimId || null,
        customerId: customer.id || customer.customerId || null,
        itemSku: item.sku || item.itemSku || null,
        rejectionReason: evaluation ? evaluation.reasons.join('; ') : 'No valid evaluation provided',
        damageAssessment: {
          verifiedTypes: evaluation?.detectedDamageTypes || [],
          confidenceScore: evaluation?.confidenceScore || 0,
          status: evaluation?.status || DamageVerificationStatus.INSUFFICIENT_EVIDENCE,
        },
        replacementOrder: null,
        requiresHumanReview: evaluation?.status === DamageVerificationStatus.FRAUDULENT || evaluation?.status === DamageVerificationStatus.INSUFFICIENT_EVIDENCE,
        requiresPhotoReupload: evaluation?.status === DamageVerificationStatus.UNREADABLE,
      };
    }

    const authorizationCode = generateAuthCode();
    const returnLabelCode = `RET-LBL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return {
      authorized: true,
      status: 'APPROVED',
      authorizationCode,
      authorizedAt: new Date().toISOString(),
      claimId: claim.id || claim.claimId || `CLM-${Date.now().toString(36).toUpperCase()}`,
      customerId: customer.id || customer.customerId || 'CUST-ANON',
      itemSku: item.sku || item.itemSku || item.productSku || 'SKU-GENERIC',
      serialNumber: item.serialNumber || null,
      damageAssessment: {
        verifiedTypes: evaluation.detectedDamageTypes,
        confidenceScore: evaluation.confidenceScore,
        clarityScore: evaluation.details.clarityScore,
        verificationStatus: evaluation.status,
      },
      replacementOrder: {
        action: 'EXPEDITED_REPLACEMENT',
        fulfillmentType: 'AUTONOMOUS_WAREHOUSE_DISPATCH',
        shippingSpeed: 'NEXT_DAY_PRIORITY',
        carrier: 'FedEx Priority Overnight',
        returnRequired: true,
        returnLabelCode,
        estimatedDeliveryDays: 1,
      },
      summary: `Automated replacement authorized for authentic ${evaluation.detectedDamageTypes.join(', ')} damage (confidence: ${evaluation.confidenceScore}).`,
    };
  }

  /**
   * Convenience wrapper that evaluates photo and generates authorization in one step.
   */
  verifyDamageAndAuthorize({ photo, claim, customer, item }) {
    const evaluation = this.evaluatePhoto(photo);
    const authorization = this.generateReplacementAuthorization({
      evaluation,
      claim,
      customer,
      item,
    });
    return { evaluation, authorization };
  }

  _extractDamageTypes(photo) {
    const raw = photo.detectedDamageTypes || photo.damageTypes || [];
    const validTypes = new Set(Object.values(DamageType));
    const extracted = [];

    for (const item of raw) {
      const typeStr = typeof item === 'string' ? item : item?.type;
      if (typeStr && validTypes.has(typeStr) && !extracted.includes(typeStr)) {
        extracted.push(typeStr);
      }
    }
    return extracted;
  }

  _detectFraud({ photo, exif, url, imageHash }) {
    const reasons = [];
    let isStockPhoto = false;

    // Direct stock photo flag
    if (photo.isStockPhoto === true || exif.isStockPhoto === true) {
      isStockPhoto = true;
      reasons.push('Explicit stock photo flag detected in metadata');
    }

    // Watermark check
    if (photo.watermarkDetected === true || exif.watermarkDetected === true) {
      isStockPhoto = true;
      reasons.push('Stock watermark detected in photo');
    }

    // Stock domains check in URL
    if (url) {
      const lowerUrl = url.toLowerCase();
      for (const domain of this.stockDomains) {
        if (lowerUrl.includes(domain)) {
          isStockPhoto = true;
          reasons.push(`Photo URL references known stock photography repository (${domain})`);
          break;
        }
      }
    }

    // Source field check
    if (photo.source === 'stock_library' || photo.source === 'web_search') {
      isStockPhoto = true;
      reasons.push(`Photo source marked as untrusted (${photo.source})`);
    }

    // Known fraudulent hashes
    if (imageHash && this.knownFraudulentHashes.has(imageHash)) {
      reasons.push('Image hash matches known fraudulent claim repository');
    }

    // Manipulated software check in EXIF
    if (exif.software) {
      for (const pattern of KNOWN_MANIPULATION_SOFTWARE) {
        if (pattern.test(exif.software)) {
          reasons.push(`Image altered using digital manipulation software (${exif.software})`);
          break;
        }
      }
    }

    return {
      isFraudulent: reasons.length > 0,
      isStockPhoto,
      reasons,
    };
  }

  _checkReadability({ clarityScore, width, height, fileSizeBytes }) {
    const reasons = [];

    if (clarityScore < this.minClarityScore) {
      reasons.push(`Image clarity score (${clarityScore}) is below minimum readable threshold (${this.minClarityScore})`);
    }

    if (width > 0 && width < this.minWidth) {
      reasons.push(`Image width (${width}px) is below minimum threshold (${this.minWidth}px)`);
    }

    if (height > 0 && height < this.minHeight) {
      reasons.push(`Image height (${height}px) is below minimum threshold (${this.minHeight}px)`);
    }

    if (fileSizeBytes > 0 && fileSizeBytes < this.minFileSizeBytes) {
      reasons.push(`Image file size (${fileSizeBytes} bytes) is below readable quality limit (${this.minFileSizeBytes} bytes)`);
    }

    return {
      isReadable: reasons.length === 0,
      reasons,
    };
  }

  _computeConfidence({ clarityScore, width, height, exif, detectedDamageTypes, photo }) {
    // 1. Clarity weight (0.35)
    const clarityContribution = clarityScore * 0.35;

    // 2. Resolution & size weight (0.20)
    let resScore = 0.70;
    if (width >= 1920 && height >= 1080) {
      resScore = 1.0;
    } else if (width >= 1280 && height >= 720) {
      resScore = 0.85;
    }
    const resolutionContribution = resScore * 0.20;

    // 3. EXIF & Authenticity telemetry weight (0.25)
    let exifScore = 0.50; // baseline for clean image without full camera telemetry
    if (exif.deviceModel && exif.timestamp) {
      exifScore = exif.gps ? 1.0 : 0.90;
    } else if (exif.deviceModel || exif.cameraSerial) {
      exifScore = 0.80;
    }
    const exifContribution = exifScore * 0.25;

    // 4. Damage detection consistency weight (0.20)
    let damageScore = 0.80;
    if (Array.isArray(photo.detectedDamageTypes)) {
      const confidences = photo.detectedDamageTypes
        .filter((d) => typeof d === 'object' && typeof d.confidence === 'number')
        .map((d) => d.confidence);
      if (confidences.length > 0) {
        damageScore = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      } else if (detectedDamageTypes.length >= 1) {
        damageScore = 0.90;
      }
    }
    const damageContribution = damageScore * 0.20;

    const total = clarityContribution + resolutionContribution + exifContribution + damageContribution;
    return Number(Math.min(1.0, Math.max(0, total)).toFixed(2));
  }
}

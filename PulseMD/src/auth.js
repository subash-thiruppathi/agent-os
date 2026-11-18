import crypto from 'node:crypto';

/**
 * PulseMD Clinician Cryptographic Authentication & Token Verifier
 * Enforces non-repudiation and prevents clinician impersonation.
 */
export class ClinicianAuth {
  static DEFAULT_SECRET = 'pulsemd_secure_signing_key_internal_2026';

  /**
   * Generates a tamper-proof cryptographic signature token.
   */
  static generateToken(clinicianId, role = 'PHYSICIAN', secret = ClinicianAuth.DEFAULT_SECRET, expiresInMs = 300000) {
    const expiresAt = Date.now() + expiresInMs;
    const nonce = crypto.randomBytes(16).toString('hex');
    const payload = `${clinicianId}:${role}:${expiresAt}:${nonce}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }

  /**
   * Validates cryptographic signature token and expiration.
   */
  static verifyToken(token, expectedClinicianId, secret = ClinicianAuth.DEFAULT_SECRET) {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Signature token is missing or malformed' };
    }

    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length !== 5) {
        return { valid: false, error: 'Invalid token structure' };
      }

      const [clinicianId, role, expiresAtStr, nonce, receivedSig] = parts;
      const expiresAt = Number.parseInt(expiresAtStr, 10);

      if (clinicianId !== expectedClinicianId) {
        return { valid: false, error: `Token clinician ID '${clinicianId}' does not match claimed '${expectedClinicianId}'` };
      }

      if (Date.now() > expiresAt) {
        return { valid: false, error: 'Signature token has expired' };
      }

      if (role !== 'PHYSICIAN' && role !== 'PRACTITIONER') {
        return { valid: false, error: `Unauthorized clinical role '${role}': must be licensed PHYSICIAN or PRACTITIONER` };
      }

      const payload = `${clinicianId}:${role}:${expiresAtStr}:${nonce}`;
      const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig))) {
        return { valid: false, error: 'Cryptographic signature verification failed' };
      }

      return { valid: true, clinicianId, role };
    } catch (err) {
      return { valid: false, error: `Token verification error: ${err.message}` };
    }
  }
}

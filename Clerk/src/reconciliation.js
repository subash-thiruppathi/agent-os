import { randomUUID } from 'node:crypto';

/**
 * Clerk Settlement & Payment Reconciliation Helpers
 */
export class SettlementReconciler {
  constructor() {
    this.invoices = new Map();
    this.payments = new Map();
    this.claims = new Map();
  }

  issueInvoice(tenant, jobId, amount, currency = 'INR') {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid invoice amount');
    const invoice = {
      id: randomUUID(),
      tenant,
      jobId,
      amount,
      currency,
      issuedAt: new Date().toISOString()
    };
    this.invoices.set(`${tenant}:${jobId}`, invoice);
    return invoice;
  }

  recordPayment(tenant, jobId, invoiceId, amount, currency, reference) {
    const payment = {
      id: randomUUID(),
      tenant,
      jobId,
      invoiceId,
      amount,
      currency,
      reference,
      paidAt: new Date().toISOString()
    };
    this.payments.set(`${tenant}:${jobId}`, payment);
    return payment;
  }

  verifyPayment(tenant, jobId) {
    const invoice = this.invoices.get(`${tenant}:${jobId}`);
    const payment = this.payments.get(`${tenant}:${jobId}`);
    if (!invoice || !payment) return { verified: false, reason: 'Missing invoice or payment record' };
    if (payment.invoiceId !== invoice.id) return { verified: false, reason: 'Payment does not match invoice ID' };
    if (payment.amount !== invoice.amount || payment.currency !== invoice.currency) {
      return { verified: false, reason: 'Payment amount or currency mismatch' };
    }
    return { verified: true, payment };
  }
}

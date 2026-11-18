/**
 * CashHound Real-Time Bank Feed & Webhook Auto-Reconciler:
 * Ingests inbound ACH/wire/Stripe transfer events, extracts invoice tags from memo text,
 * and automatically reconciles accounts, terminating active dunning actions.
 */

export class BankFeedReconciler {
  constructor(agent) {
    this.agent = agent;
    this.reconciledEvents = [];
  }

  processWebhookEvent(event) {
    // event: { amount, memo: "Payment for INV-1094 ref 8923", sender: "Acme Corp", txId: "tx_ach_992" }
    const { amount, memo = '', sender = 'Unknown', txId = `tx_${Date.now()}` } = event;

    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('Event amount must be a positive number');
    }

    // Extract invoice ID matching patterns (e.g. INV-1094, INV_101, INV102)
    const match = memo.match(/\bINV[-_]?[A-Z0-9]+\b/i);
    const invoiceId = match ? match[0].toUpperCase() : null;

    if (!invoiceId) {
      return {
        matched: false,
        reason: 'No invoice tag found in bank transfer memo',
        txId,
        memo
      };
    }

    const invoice = this.agent.getInvoice(invoiceId);
    if (!invoice) {
      return {
        matched: false,
        invoiceId,
        reason: `Invoice '${invoiceId}' is not registered with CashHound`,
        txId
      };
    }

    // Reconcile payment with agent
    const paymentRecord = this.agent.recordPayment(invoiceId, {
      amount,
      method: 'ACH_BANK_TRANSFER',
      reference: txId,
      date: new Date()
    });

    const reconciliationReceipt = {
      matched: true,
      invoiceId,
      customerName: invoice.customer?.name || sender,
      amountSettled: amount,
      remainingBalance: invoice.balance,
      isFullyPaid: invoice.balance <= 0,
      cancelledPendingDunningCount: paymentRecord.cancelledActions?.length || 0,
      reconciledAt: new Date().toISOString()
    };

    this.reconciledEvents.push(reconciliationReceipt);
    return reconciliationReceipt;
  }
}

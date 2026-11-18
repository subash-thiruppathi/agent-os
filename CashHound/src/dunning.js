/**
 * CashHound - Tiered Dunning Engine & Financial Settlement Calculator
 * Generates polite-to-firm communications with fine-grained tone controls,
 * installment plan schedules, and early settlement offers.
 */

import { CustomerTier } from './invoice.js';

export const DunningTier = Object.freeze({
  TIER_1_COURTESY: 1,      // 1-14 days: Gentle courtesy check-in
  TIER_2_REMINDER: 2,      // 15-30 days: Standard professional reminder
  TIER_3_URGENT: 3,        // 31-60 days: Firm notice with payment options
  TIER_4_FINAL_DEMAND: 4,  // 61+ days: Formal final demand / pre-collections
});

export const DunningTone = Object.freeze({
  FRIENDLY: 'friendly',
  PROFESSIONAL: 'professional',
  URGENT: 'urgent',
  FORMAL: 'formal',
  EMPATHETIC: 'empathetic',
});

/**
 * Calculates a structured installment payment plan for an outstanding balance.
 * 
 * @param {number} balance - Current outstanding balance
 * @param {Object} [options={}]
 * @param {number} [options.numberOfInstallments=3] - Number of split payments (2-12)
 * @param {string} [options.frequency='monthly'] - 'weekly' | 'biweekly' | 'monthly'
 * @param {Date|string} [options.startDate=new Date()] - First payment date
 * @param {number} [options.feePercentage=0] - Surcharge or convenience fee percent (if any)
 * @returns {Object} Installment plan breakdown
 */
export function calculateInstallmentPlan(balance, options = {}) {
  const {
    numberOfInstallments = 3,
    frequency = 'monthly',
    startDate = new Date(),
    feePercentage = 0,
  } = options;

  if (typeof balance !== 'number' || !Number.isFinite(balance) || balance <= 0) {
    throw new Error('Balance must be a positive finite number to calculate an installment plan');
  }
  const installmentsCount = Math.max(2, Math.min(12, Math.round(numberOfInstallments)));
  const feeMultiplier = 1 + (Math.max(0, feePercentage) / 100);
  const totalPayable = Number((balance * feeMultiplier).toFixed(2));
  const baseInstallment = Number((totalPayable / installmentsCount).toFixed(2));

  const schedule = [];
  let remaining = totalPayable;
  let currentDate = new Date(startDate);

  for (let i = 1; i <= installmentsCount; i++) {
    // Determine the next payment date based on frequency
    if (i > 1) {
      currentDate = new Date(currentDate);
      if (frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (frequency === 'biweekly') {
        currentDate.setDate(currentDate.getDate() + 14);
      } else {
        // default monthly
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Last installment absorbs any rounding cent differences
    const amount = (i === installmentsCount)
      ? Number(remaining.toFixed(2))
      : baseInstallment;

    remaining = Number((remaining - amount).toFixed(2));

    schedule.push({
      installmentNumber: i,
      dueDate: new Date(currentDate).toISOString().split('T')[0],
      amount,
      remainingBalanceAfter: Math.max(0, remaining),
    });
  }

  return {
    originalBalance: Number(balance.toFixed(2)),
    totalPayable,
    numberOfInstallments: installmentsCount,
    frequency,
    installmentAmount: baseInstallment,
    feePercentage,
    schedule,
    summary: `${installmentsCount} payments of $${baseInstallment.toFixed(2)} (${frequency})`,
  };
}

/**
 * Calculates a lump-sum settlement discount offer for immediate recovery.
 *
 * @param {number} balance - Current outstanding balance
 * @param {Object} [options={}]
 * @param {number} [options.discountPercentage=15] - Discount percent (e.g. 10% to 30%)
 * @param {number} [options.validityDays=7] - Number of days the offer remains valid
 * @param {Date|string} [options.asOfDate=new Date()] - Offer creation date
 * @returns {Object} Settlement offer breakdown
 */
export function calculateSettlementOffer(balance, options = {}) {
  const {
    discountPercentage = 15,
    validityDays = 7,
    asOfDate = new Date(),
  } = options;

  if (balance <= 0) {
    throw new Error('Balance must be greater than zero to calculate a settlement offer');
  }

  const validPercent = Math.max(5, Math.min(50, discountPercentage));
  const discountAmount = Number(((balance * validPercent) / 100).toFixed(2));
  const settlementAmount = Number((balance - discountAmount).toFixed(2));

  const validUntil = new Date(asOfDate);
  validUntil.setDate(validUntil.getDate() + validityDays);

  const offerCode = `SETTLE-${Math.floor(balance)}-${Math.floor(Math.random() * 9000 + 1000)}`;

  return {
    originalBalance: Number(balance.toFixed(2)),
    settlementAmount,
    discountAmount,
    discountPercentage: validPercent,
    validityDays,
    validUntil: validUntil.toISOString().split('T')[0],
    offerCode,
    terms: `Pay $${settlementAmount.toFixed(2)} in full by ${validUntil.toISOString().split('T')[0]} to settle invoice in full (saves $${discountAmount.toFixed(2)}).`,
  };
}

/**
 * Determines recommended dunning tier from days past due.
 *
 * @param {number} daysPastDue
 * @returns {number} DunningTier
 */
export function getRecommendedTier(daysPastDue) {
  if (daysPastDue <= 14) return DunningTier.TIER_1_COURTESY;
  if (daysPastDue <= 30) return DunningTier.TIER_2_REMINDER;
  if (daysPastDue <= 60) return DunningTier.TIER_3_URGENT;
  return DunningTier.TIER_4_FINAL_DEMAND;
}

/**
 * Generates an appropriate tone based on tier and customer tier.
 * 
 * @param {number} tier
 * @param {string} customerTier
 * @returns {string} DunningTone
 */
export function resolveTone(tier, customerTier) {
  if (customerTier === CustomerTier.VIP) {
    // VIP customers are kept friendly or empathetic
    if (tier === DunningTier.TIER_4_FINAL_DEMAND) return DunningTone.PROFESSIONAL;
    return DunningTone.EMPATHETIC;
  }

  switch (tier) {
    case DunningTier.TIER_1_COURTESY:
      return DunningTone.FRIENDLY;
    case DunningTier.TIER_2_REMINDER:
      return DunningTone.PROFESSIONAL;
    case DunningTier.TIER_3_URGENT:
      return DunningTone.URGENT;
    case DunningTier.TIER_4_FINAL_DEMAND:
    default:
      return DunningTone.FORMAL;
  }
}

/**
 * Generates a tailored dunning follow-up message with tone controls,
 * custom formatting, and embedded payment options.
 *
 * @param {import('./invoice.js').Invoice} invoice
 * @param {Object} [options={}]
 * @param {number} [options.tier] - Override default tier
 * @param {string} [options.tone] - Override default tone
 * @param {Date|string} [options.asOfDate=new Date()]
 * @param {boolean} [options.includeInstallmentPlan=false]
 * @param {boolean} [options.includeSettlementOffer=false]
 * @param {string} [options.paymentPortalUrl='https://pay.cashhound.io']
 * @returns {Object} Structured communication artifact
 */
export function generateDunningMessage(invoice, options = {}) {
  const asOf = options.asOfDate ? new Date(options.asOfDate) : new Date();
  const daysOverdue = invoice.getDaysPastDue(asOf);
  const tier = options.tier || getRecommendedTier(daysOverdue);
  const tone = options.tone || resolveTone(tier, invoice.customer.tier);
  const portalBase = options.paymentPortalUrl || 'https://pay.cashhound.io';
  // SEC-08: Enforce HTTPS scheme and encode URI parameters to prevent open redirects and parameter pollution
  if (!portalBase.startsWith('https://')) {
    throw new Error('Insecure payment portal URL scheme: HTTPS required');
  }
  const paymentLink = `${portalBase}/pay/${encodeURIComponent(invoice.id)}?amt=${encodeURIComponent(invoice.balance)}`;

  const formattedBalance = `$${invoice.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formattedDueDate = invoice.dueDate.toISOString().split('T')[0];
  const customerName = invoice.customer.name;
  const invoiceId = invoice.id;

  let installmentPlan = null;
  if (options.includeInstallmentPlan || (tier >= DunningTier.TIER_3_URGENT && invoice.balance >= 1000)) {
    installmentPlan = calculateInstallmentPlan(invoice.balance, {
      startDate: asOf,
    });
  }

  let settlementOffer = null;
  if (options.includeSettlementOffer || (tier === DunningTier.TIER_4_FINAL_DEMAND && invoice.balance >= 500)) {
    settlementOffer = calculateSettlementOffer(invoice.balance, {
      asOfDate: asOf,
    });
  }

  let subject = '';
  let bodyLines = [];
  const suggestedActions = ['PAY_NOW'];

  switch (tier) {
    case DunningTier.TIER_1_COURTESY: {
      if (tone === DunningTone.EMPATHETIC || tone === DunningTone.FRIENDLY) {
        subject = `Friendly reminder: Invoice ${invoiceId} for ${customerName}`;
        bodyLines = [
          `Hi ${customerName},`,
          '',
          `We hope all is well! We wanted to quickly check in regarding Invoice ${invoiceId} for ${formattedBalance}, which was due on ${formattedDueDate}.`,
          `We know days get busy, so if this already crossed in the mail or was scheduled, please feel free to disregard this note.`,
          '',
          `You can view and settle your invoice conveniently here:`,
          `${paymentLink}`,
          '',
          `If you have any questions or need a copy of the original invoice, let us know!`,
          '',
          `Warm regards,`,
          `Accounts Receivable Team`,
        ];
      } else {
        subject = `Notice: Invoice ${invoiceId} payment due`;
        bodyLines = [
          `Dear ${customerName},`,
          '',
          `This is a courtesy reminder that Invoice ${invoiceId} with a balance of ${formattedBalance} was due on ${formattedDueDate}.`,
          `Please arrange for payment at your earliest convenience using our secure portal:`,
          `${paymentLink}`,
          '',
          `Thank you for your prompt attention to this matter.`,
          '',
          `Sincerely,`,
          `Finance Department`,
        ];
      }
      break;
    }

    case DunningTier.TIER_2_REMINDER: {
      suggestedActions.push('REQUEST_REVIEW');
      if (tone === DunningTone.EMPATHETIC) {
        subject = `Checking in regarding Invoice ${invoiceId} (${formattedBalance})`;
        bodyLines = [
          `Hello ${customerName},`,
          '',
          `We noticed that Invoice ${invoiceId} for ${formattedBalance} is now ${daysOverdue} days overdue (due date: ${formattedDueDate}).`,
          `We value our partnership and want to make sure there are no questions or discrepancies holding up payment.`,
          '',
          `You can make a direct payment here:`,
          `${paymentLink}`,
          '',
          `If anything is preventing payment, please reply directly so we can work together on a solution.`,
          '',
          `Best regards,`,
          `Accounts Receivable`,
        ];
      } else {
        subject = `Follow-Up: Overdue Invoice ${invoiceId} - Action Required`;
        bodyLines = [
          `Dear ${customerName},`,
          '',
          `Our records indicate that Invoice ${invoiceId} for the amount of ${formattedBalance} remains outstanding. Payment was due on ${formattedDueDate} (${daysOverdue} days ago).`,
          '',
          `Please remit payment today via the following link:`,
          `${paymentLink}`,
          '',
          `If payment has already been sent, please reply with the remittance details so we can update your account.`,
          '',
          `Sincerely,`,
          `Accounts Receivable Team`,
        ];
      }
      break;
    }

    case DunningTier.TIER_3_URGENT: {
      suggestedActions.push('PAYMENT_PLAN_REQUEST');
      subject = `Urgent: Overdue Account Alert for Invoice ${invoiceId}`;
      bodyLines = [
        `Dear ${customerName},`,
        '',
        `Invoice ${invoiceId} with an unpaid balance of ${formattedBalance} is critically past due (${daysOverdue} days overdue).`,
        `To ensure continued uninterrupted service and avoid further escalation, please settle this balance immediately:`,
        `${paymentLink}`,
      ];

      if (installmentPlan) {
        bodyLines.push(
          '',
          `Flexible Payment Plan Available:`,
          `If you are experiencing temporary cash flow challenges, we have approved a flexible payment plan:`,
          `- ${installmentPlan.summary}`,
          `- Settle in installments via: ${paymentLink}&plan=installments`
        );
      }

      bodyLines.push(
        '',
        `Please contact us immediately if there are any unresolved disputes or questions regarding this charge.`,
        '',
        `Finance & Collections Operations`,
      );
      break;
    }

    case DunningTier.TIER_4_FINAL_DEMAND:
    default: {
      suggestedActions.push('LEGAL_ESCALATION_WARNING');
      subject = `FINAL DEMAND: Immediate Payment Required for Invoice ${invoiceId}`;
      bodyLines = [
        `ATTENTION: ${customerName}`,
        '',
        `Invoice ${invoiceId} is now ${daysOverdue} days delinquent, with a remaining unpaid balance of ${formattedBalance}.`,
        `Despite multiple prior notices, this account remains unresolved. Continued non-payment will result in suspension of account privileges and referral to our legal recovery team or external collections.`,
        '',
        `IMMEDIATE RESOLUTION REQUIRED:`,
        `Please remit the outstanding balance immediately:`,
        `${paymentLink}`,
      ];

      if (settlementOffer) {
        suggestedActions.push('SETTLEMENT_OFFER');
        bodyLines.push(
          '',
          `One-Time Settlement Option:`,
          `${settlementOffer.terms}`,
          `Redeem settlement offer online: ${paymentLink}&settle=${settlementOffer.offerCode}`
        );
      }

      bodyLines.push(
        '',
        `Govern yourself accordingly.`,
        '',
        `Office of Credit and Legal Compliance`,
      );
      break;
    }
  }

  return {
    invoiceId,
    tier,
    tierName: Object.keys(DunningTier).find(key => DunningTier[key] === tier) || 'TIER_UNKNOWN',
    tone,
    daysOverdue,
    balance: invoice.balance,
    subject,
    body: bodyLines.join('\n'),
    paymentLink,
    suggestedActions,
    installmentPlan,
    settlementOffer,
    generatedAt: asOf.toISOString(),
  };
}

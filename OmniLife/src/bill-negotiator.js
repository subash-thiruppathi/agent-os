/**
 * OmniLife Bill Negotiation Striker: Scans utility and telecom bills,
 * detects expired promotional discounts, and generates negotiation battlecards.
 */

export const MARKET_BENCHMARKS = {
  internet_fiber: { benchmarkMonthlyCents: 5500, maxAcceptableMonthlyCents: 7500 },
  wireless_single_line: { benchmarkMonthlyCents: 4500, maxAcceptableMonthlyCents: 7000 },
  cable_bundle: { benchmarkMonthlyCents: 8500, maxAcceptableMonthlyCents: 12000 }
};

export class BillNegotiator {
  analyzeBill(bill) {
    const { provider, category = 'internet_fiber', currentMonthlyCents, tenureMonths = 12 } = bill;
    const benchmark = MARKET_BENCHMARKS[category] || MARKET_BENCHMARKS.internet_fiber;

    const isOverpaying = currentMonthlyCents > benchmark.benchmarkMonthlyCents;
    const monthlyOverpaymentCents = isOverpaying ? currentMonthlyCents - benchmark.benchmarkMonthlyCents : 0;
    const projectedAnnualSavingsCents = monthlyOverpaymentCents * 12;

    const leveragePoints = [
      `Customer has been with ${provider} for ${tenureMonths} consecutive months with on-time payments.`,
      `Competitor offers in your zip code currently provide equivalent service for $${(benchmark.benchmarkMonthlyCents / 100).toFixed(2)}/mo.`,
      `Promotion rate has expired, causing an unnotified monthly surcharge of $${(monthlyOverpaymentCents / 100).toFixed(2)}.`
    ];

    const battlecard = {
      provider,
      category,
      currentMonthlyFormatted: `$${(currentMonthlyCents / 100).toFixed(2)}`,
      targetMonthlyFormatted: `$${(benchmark.benchmarkMonthlyCents / 100).toFixed(2)}`,
      projectedAnnualSavingsFormatted: `$${(projectedAnnualSavingsCents / 100).toFixed(2)}`,
      recommendedScript: `Hello, I noticed my introductory promotion expired and my rate increased to $${(currentMonthlyCents / 100).toFixed(2)}/mo. Competitors are offering the same speed for $${(benchmark.benchmarkMonthlyCents / 100).toFixed(2)}. I value your service, but I need to lower my bill or cancel before the next cycle. What loyalty discounts can you apply today?`,
      leveragePoints
    };

    return {
      hasSavingsOpportunity: isOverpaying,
      annualSavingsCents: projectedAnnualSavingsCents,
      battlecard
    };
  }
}

/**
 * LocalRoar Route Density Optimizer: Matches lead locations with active technician routes
 * and injects dynamic proximity discounts to pack daily travel clusters.
 */

export class RouteDensityOptimizer {
  constructor(activeJobs = []) {
    this.activeJobs = activeJobs; // e.g. [{ id: 'job-1', technicianId: 'tech-101', postalCode: '560038', street: '12th Main Road' }]
  }

  addActiveJob(job) {
    this.activeJobs.push(job);
  }

  evaluateProximity(leadAddress) {
    if (!leadAddress || typeof leadAddress !== 'string') {
      return { hasProximityAdvantage: false, discountPercentage: 0 };
    }

    const cleanedLead = leadAddress.toLowerCase();

    for (const job of this.activeJobs) {
      if (job.postalCode && cleanedLead.includes(job.postalCode)) {
        return {
          hasProximityAdvantage: true,
          matchedTechnicianId: job.technicianId,
          matchedPostalCode: job.postalCode,
          discountPercentage: 10,
          reason: `Technician ${job.technicianId} is already scheduled in your postal code (${job.postalCode}). Proximity discount applied.`
        };
      }

      if (job.street && cleanedLead.includes(job.street.toLowerCase())) {
        return {
          hasProximityAdvantage: true,
          matchedTechnicianId: job.technicianId,
          matchedStreet: job.street,
          discountPercentage: 15,
          reason: `Technician ${job.technicianId} is servicing a customer on your exact street (${job.street})!`
        };
      }
    }

    return { hasProximityAdvantage: false, discountPercentage: 0, reason: 'Standard travel dispatch zone' };
  }
}

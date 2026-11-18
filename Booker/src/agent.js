/**
 * Booker: Booking and Dispatch Agent
 * Turns customer requests into confirmed, properly scoped technician appointments.
 */
export const bookingAgent = {
  name: 'booker',
  next(job) {
    const missing = ['customer', 'address', 'appliance', 'technician', 'slot'].filter(k => !job.input[k]);
    if (missing.length) return { wait: 'needs_information', reason: `Provide: ${missing.join(', ')}` };
    if (job.input.appliance !== 'washing-machine') return { wait: 'blocked', reason: 'Only washing-machine service is supported in this pilot' };
    if (!Number.isSafeInteger(job.input.amount) || job.input.amount <= 0) return { wait: 'needs_information', reason: 'Provide a positive estimate in minor currency units' };
    if (!job.booking) return { tool: 'book', permission: 'booking', reason: 'Reserve the requested technician slot' };
    return { transition: 'booked' };
  }
};

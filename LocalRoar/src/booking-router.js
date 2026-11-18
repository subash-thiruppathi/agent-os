/**
 * LocalRoar Booking Router: Manages local appointment slots and confirms bookings.
 * Hardened against Calendar Denial-of-Inventory (Resource Exhaustion).
 */

export class BookingRouter {
  constructor(options = {}) {
    this.bookings = [];
    this.maxActivePerCustomer = options.maxActivePerCustomer || 3;
  }

  isSlotAvailable(requestedIsoTime, durationMinutes = 60) {
    const reqStart = new Date(requestedIsoTime).getTime();
    if (Number.isNaN(reqStart)) {
      throw new Error(`Invalid ISO timestamp: ${requestedIsoTime}`);
    }

    const reqEnd = reqStart + durationMinutes * 60 * 1000;

    for (const b of this.bookings) {
      if (b.status === 'CANCELLED') continue;

      const bStart = new Date(b.slot).getTime();
      const bEnd = bStart + b.durationMinutes * 60 * 1000;

      // Overlap check
      if (reqStart < bEnd && reqEnd > bStart) {
        return false;
      }
    }
    return true;
  }

  bookSlot(bookingDetails) {
    const { slot, durationMinutes = 60, customerName, serviceKey, estimatedAmount } = bookingDetails;

    if (!customerName || typeof customerName !== 'string' || customerName.trim().length === 0) {
      throw new Error('Valid customer name required for booking');
    }

    const slotTime = new Date(slot).getTime();
    if (Number.isNaN(slotTime)) {
      throw new Error(`Invalid slot timestamp: ${slot}`);
    }

    // SEC-05: Rate-limiting & Inventory Denial-of-Service Defense
    // Prevent a single user or bot from monopolizing all calendar slots
    const activeCustomerBookings = this.bookings.filter(
      b => b.customerName.toLowerCase() === customerName.toLowerCase() && b.status === 'CONFIRMED'
    ).length;

    if (activeCustomerBookings >= this.maxActivePerCustomer) {
      throw new Error(`Booking limit exceeded: customer '${customerName}' already has ${activeCustomerBookings} active reservations`);
    }

    if (!this.isSlotAvailable(slot, durationMinutes)) {
      throw new Error(`Slot ${slot} is already booked.`);
    }

    const bookingRecord = {
      id: `book_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerName: customerName.trim(),
      serviceKey,
      slot,
      durationMinutes,
      estimatedAmount,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString()
    };

    this.bookings.push(bookingRecord);
    return bookingRecord;
  }
}

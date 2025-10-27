const BUSINESS_HOURS = {
  START_HOUR: 6,  // 9am AEST
  END_HOUR: 18,   // 6pm VN
  WORKING_HOURS: 8 * 60 * 60 * 1000,
  MS_PER_DAY: 12 * 60 * 60 * 1000
};

/**
 * Calculate business days between two dates, excluding weekends and non-business hours
 */
export function calculateBusinessDays(startTime: Date, endTime: Date): number {
  const start = new Date(startTime);
  const end = new Date(endTime);

  let totalDays = 0;
  let current = new Date(start);

  while (current < end) {
    const day = current.getDay(); // 0: Sun, 6: Sat
    
    if (day === 0 || day === 6) {
      // If weekend, move to next Monday
      current.setDate(current.getDate() + (8 - day) % 7);
      current.setHours(BUSINESS_HOURS.START_HOUR, 0, 0, 0);
      continue;
    }
    
    const businessStart = new Date(current);
    businessStart.setHours(BUSINESS_HOURS.START_HOUR, 0, 0, 0);

    const businessEnd = new Date(current);
    businessEnd.setHours(BUSINESS_HOURS.END_HOUR, 0, 0, 0);

    const intervalStart = new Date(Math.max(current.getTime(), businessStart.getTime()));
    const intervalEnd = new Date(Math.min(end.getTime(), businessEnd.getTime()));

    if (intervalEnd > intervalStart) {
      if (intervalEnd.getTime() - intervalStart.getTime() < BUSINESS_HOURS.MS_PER_DAY) {
        totalDays += (intervalEnd.getTime() - intervalStart.getTime()) / BUSINESS_HOURS.WORKING_HOURS;
      } else {
        totalDays += 1;
      }
    }

    current.setDate(current.getDate() + 1);
    current.setHours(BUSINESS_HOURS.START_HOUR, 0, 0, 0);
  }

  return totalDays;
}

/**
 * Format days as a readable string
 */
export function formatDays(days: number): string {
  if (days === 0) return '-';
  if (days < 0.1) return '<0.1d';
  return `${days.toFixed(1)}d`;
}

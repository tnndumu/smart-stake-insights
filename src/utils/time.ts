import { DateTime } from 'luxon';

export const TZ = 'America/New_York';

export function todayRangeET() {
  const startET = DateTime.now().setZone(TZ).startOf('day');
  const endET   = startET.endOf('day');
  return {
    startET,
    endET,
    // Convert to UTC for comparing against API commence_time (ISO UTC)
    startUTC: startET.toUTC(),
    endUTC: endET.toUTC(),
    label: startET.toFormat('cccc, LLL d') // e.g., "Saturday, Aug 9"
  };
}

export function tomorrowRangeET() {
  const startET = DateTime.now().setZone(TZ).plus({ days: 1 }).startOf('day');
  const endET   = startET.endOf('day');
  return {
    startET,
    endET,
    startUTC: startET.toUTC(),
    endUTC: endET.toUTC(),
    label: startET.toFormat('cccc, LLL d')
  };
}

export function isWithinUTC(iso: string, startUTC: DateTime, endUTC: DateTime) {
  const t = DateTime.fromISO(iso, { zone: 'utc' });
  return t >= startUTC && t <= endUTC;
}
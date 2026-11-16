/** Wall-clock date and minutes-of-day in a time zone, DST included. */
export function localParts(now: Date, timeZone: string): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** 'HH:MM' or 'HH:MM:SS' to minutes past midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) throw new Error(`bad time "${t}"`);
  return h! * 60 + m!;
}

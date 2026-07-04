export function getTodayBusinessDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function getUtcTimestamp(now = new Date()) {
  return now.toISOString();
}
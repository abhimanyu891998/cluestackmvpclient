/**
 * UTC DateTime utilities for consistent timestamp handling
 */

export const formatUTCTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' UTC';
};

export const formatUTCDateTime = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }) + ' ' + formatUTCTime(date);
};

export const utcNow = (): Date => {
  return new Date(); // JavaScript Date is always UTC internally
};

export const formatUTCChartTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const parseUTCString = (dateString: string): Date => {
  return new Date(dateString);
};
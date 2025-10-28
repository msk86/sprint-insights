/**
 * Format a date string or Date object to the browser's local timezone
 * 
 * @param date - Date string, timestamp, or Date object
 * @param options - Intl.DateTimeFormatOptions for customizing the output
 * @returns Formatted date string in local timezone
 */
export function formatDate(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = new Date(date);
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  // Default options for date only
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  return dateObj.toLocaleDateString(undefined, options || defaultOptions);
}

/**
 * Format a date string or Date object to include time in local timezone
 * 
 * @param date - Date string, timestamp, or Date object
 * @param options - Intl.DateTimeFormatOptions for customizing the output
 * @returns Formatted date and time string in local timezone
 */
export function formatDateTime(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = new Date(date);
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  // Default options for date and time
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return dateObj.toLocaleString(undefined, options || defaultOptions);
}

/**
 * Format a date string or Date object to show only time in local timezone
 * 
 * @param date - Date string, timestamp, or Date object
 * @param options - Intl.DateTimeFormatOptions for customizing the output
 * @returns Formatted time string in local timezone
 */
export function formatTime(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = new Date(date);
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Time';
  }
  
  // Default options for time only
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  
  return dateObj.toLocaleTimeString(undefined, options || defaultOptions);
}

/**
 * Format a date relative to now (e.g., "2 days ago", "in 3 hours")
 * 
 * @param date - Date string, timestamp, or Date object
 * @returns Relative time string (e.g., "2 days ago")
 */
export function formatRelativeTime(date: string | number | Date): string {
  const dateObj = new Date(date);
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  // Use Intl.RelativeTimeFormat if available
  if ('RelativeTimeFormat' in Intl) {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    
    if (Math.abs(diffDays) >= 1) {
      return rtf.format(diffDays, 'day');
    } else if (Math.abs(diffHours) >= 1) {
      return rtf.format(diffHours, 'hour');
    } else if (Math.abs(diffMins) >= 1) {
      return rtf.format(diffMins, 'minute');
    } else {
      return rtf.format(diffSecs, 'second');
    }
  }
  
  // Fallback for older browsers
  const absDays = Math.abs(diffDays);
  const absHours = Math.abs(diffHours);
  const absMins = Math.abs(diffMins);
  
  if (absDays >= 1) {
    return diffDays > 0 ? `in ${absDays} day${absDays > 1 ? 's' : ''}` : `${absDays} day${absDays > 1 ? 's' : ''} ago`;
  } else if (absHours >= 1) {
    return diffHours > 0 ? `in ${absHours} hour${absHours > 1 ? 's' : ''}` : `${absHours} hour${absHours > 1 ? 's' : ''} ago`;
  } else if (absMins >= 1) {
    return diffMins > 0 ? `in ${absMins} minute${absMins > 1 ? 's' : ''}` : `${absMins} minute${absMins > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

/**
 * Format date for ISO string (useful for API calls)
 * 
 * @param date - Date string, timestamp, or Date object
 * @returns ISO 8601 formatted string
 */
export function formatISO(date: string | number | Date): string {
  const dateObj = new Date(date);
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  return dateObj.toISOString();
}

/**
 * Format date range with duration (e.g., "Jan 1 - 15, 2024 (14 days)")
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted date range string with duration
 */
export function formatDateRange(
  startDate: string | number | Date,
  endDate: string | number | Date
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid Date Range';
  }
  
  // Calculate number of days
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const durationText = ` (${diffDays} day${diffDays !== 1 ? 's' : ''})`;
  
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const startMonth = start.getMonth();
  const endMonth = end.getMonth();
  
  // Same year and month
  if (startYear === endYear && startMonth === endMonth) {
    const monthDay = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endDay = end.getDate();
    const year = end.getFullYear();
    return `${monthDay} - ${endDay}, ${year}${durationText}`;
  }
  
  // Same year, different month
  if (startYear === endYear) {
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${durationText}`;
  }
  
  // Different years
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${durationText}`;
}


/**
 * Formats a file size in bytes into a human-readable string (KB, MB, GB).
 * @param bytes - The file size in bytes.
 * @param decimals - The number of decimal places to display (default: 2).
 * @returns A formatted file size string or '--' if bytes is null/undefined or 0.
 */
export const formatFileSize = (bytes: number | null | undefined, decimals = 2): string => {
  if (bytes === null || bytes === undefined || bytes === 0) return '--';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Formats a Date object or a date string into a locale-specific date and time string.
 * @param date - The Date object or date string to format.
 * @returns A formatted date/time string or '--' if the date is invalid or null/undefined.
 */
export const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return '--';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return '--';
    }
    // Example format: 'YYYY-MM-DD HH:mm' - adjust options as needed
    return dateObj.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // Use 24-hour format, set to true for AM/PM
    });
  } catch (error) {
    console.error("Error formatting date:", date, error);
    return '--';
  }
};

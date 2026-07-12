const dayjs = require('dayjs');

/**
 * Returns the previous calendar month relative to the run date.
 * @param {Date|string} runDate - The current date
 * @returns {string} - Formatted as "YYYY-MM"
 */
function getDefaultRecordMonth(runDate = new Date()) {
  return dayjs(runDate).subtract(1, 'month').format('YYYY-MM');
}

/**
 * Formats a YYYY-MM string to "Month YYYY" (e.g., "June 2026").
 * @param {string} yyyyMM - The record month
 * @returns {string}
 */
function formatRecordMonthLabel(yyyyMM) {
  return dayjs(yyyyMM + '-01').format('MMMM YYYY');
}

/**
 * Calculates the Date Completed (submission date).
 * - "on_time": 2nd day of the month immediately after the record month.
 * - "actual_filing_date": The current run date.
 * 
 * @param {string} recordMonth - Formatted "YYYY-MM"
 * @param {string} strategy - "on_time" | "actual_filing_date"
 * @param {Date|string} runDate - The current date
 * @returns {string} - Formatted as "MM/DD/YYYY"
 */
function getDateCompleted(recordMonth, strategy, runDate = new Date()) {
  if (strategy === 'actual_filing_date') {
    return dayjs(runDate).format('MM/DD/YYYY');
  }
  
  // Default to on_time
  const nextMonth = dayjs(recordMonth + '-01').add(1, 'month');
  return nextMonth.date(2).format('MM/DD/YYYY');
}

module.exports = { getDefaultRecordMonth, formatRecordMonthLabel, getDateCompleted };

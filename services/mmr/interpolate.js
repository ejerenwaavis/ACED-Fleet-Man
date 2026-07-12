const dayjs = require('dayjs');

/**
 * Interpolates mileage for missing gap months.
 * 
 * @param {string} unitId
 * @param {object} knownLatest - { month: 'YYYY-MM', mileage: number }
 * @param {object|null} knownEarliest - { month: 'YYYY-MM', mileage: number }
 * @param {string[]} gapMonths - Array of 'YYYY-MM' strings
 * @param {number|null} monthlyAverageOverride - Manual miles/month estimate
 * @returns {object} Map of { 'YYYY-MM': { mileage, mileageSource: 'interpolated' } }
 */
function interpolateMileage(unitId, knownLatest, knownEarliest, gapMonths, monthlyAverageOverride) {
  if (!knownEarliest && (monthlyAverageOverride === null || monthlyAverageOverride === undefined)) {
    throw new Error(`Unit ${unitId}: Cannot interpolate without knownEarliest or monthlyAverageOverride.`);
  }

  const results = {};

  if (knownEarliest) {
    const start = dayjs(knownEarliest.month + '-01');
    const end = dayjs(knownLatest.month + '-01');
    const totalMonths = end.diff(start, 'month');

    if (totalMonths <= 0) {
      throw new Error(`Unit ${unitId}: knownLatest must be after knownEarliest.`);
    }

    const totalMiles = knownLatest.mileage - knownEarliest.mileage;
    const perMonth = totalMiles / totalMonths;

    for (const gapMonth of gapMonths) {
      const current = dayjs(gapMonth + '-01');
      const monthsFromStart = current.diff(start, 'month');
      
      // Ensure we don't extrapolate beyond known bounds in this mode
      if (monthsFromStart <= 0 || monthsFromStart >= totalMonths) {
         continue; // Only interpolate strictly BETWEEN earliest and latest
      }

      const interpolatedMileage = Math.round(knownEarliest.mileage + (monthsFromStart * perMonth));
      results[gapMonth] = {
        mileage: interpolatedMileage,
        mileageSource: 'interpolated'
      };
    }
  } else {
    // Walk backward from knownLatest using monthlyAverageOverride
    const end = dayjs(knownLatest.month + '-01');

    for (const gapMonth of gapMonths) {
      const current = dayjs(gapMonth + '-01');
      const monthsBeforeEnd = end.diff(current, 'month');

      if (monthsBeforeEnd <= 0) {
        continue; // Only project backward
      }

      const interpolatedMileage = Math.round(knownLatest.mileage - (monthsBeforeEnd * monthlyAverageOverride));
      results[gapMonth] = {
        mileage: interpolatedMileage,
        mileageSource: 'interpolated'
      };
    }
  }

  return results;
}

module.exports = { interpolateMileage };

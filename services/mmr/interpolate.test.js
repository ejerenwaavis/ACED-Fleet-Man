import { interpolateMileage } from './interpolate.js';

describe('interpolateMileage', () => {
  it('should linearly interpolate between knownEarliest and knownLatest', () => {
    const knownEarliest = { month: '2026-01', mileage: 10000 };
    const knownLatest = { month: '2026-04', mileage: 13000 };
    const gapMonths = ['2026-02', '2026-03', '2026-05']; // 05 should be ignored because it's after latest

    const results = interpolateMileage('UNIT-1', knownLatest, knownEarliest, gapMonths);

    expect(results['2026-02']).toEqual({ mileage: 11000, mileageSource: 'interpolated' });
    expect(results['2026-03']).toEqual({ mileage: 12000, mileageSource: 'interpolated' });
    expect(results['2026-05']).toBeUndefined();
  });

  it('should backward project when knownEarliest is missing', () => {
    const knownLatest = { month: '2026-04', mileage: 13000 };
    const gapMonths = ['2026-02', '2026-03', '2026-05'];

    const results = interpolateMileage('UNIT-1', knownLatest, null, gapMonths, 1000);

    expect(results['2026-02']).toEqual({ mileage: 11000, mileageSource: 'interpolated' });
    expect(results['2026-03']).toEqual({ mileage: 12000, mileageSource: 'interpolated' });
    expect(results['2026-05']).toBeUndefined(); // Cannot backward project forward in time
  });

  it('should throw if neither knownEarliest nor override is provided', () => {
    const knownLatest = { month: '2026-04', mileage: 13000 };
    
    expect(() => {
      interpolateMileage('UNIT-1', knownLatest, null, ['2026-03'], null);
    }).toThrow(/Cannot interpolate without knownEarliest or monthlyAverageOverride/);
  });
});

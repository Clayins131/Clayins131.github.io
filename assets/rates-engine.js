/* RatesEngine: transparent annual-effective zero-curve bond calculations.
 * No market-data fetching, date conventions, accrued interest or credit spread.
 * Prices and DV01 use the bond's face amount; yield inputs are percentage points.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RatesEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TENORS = Object.freeze([0.5, 1, 2, 5, 10, 20, 30]);
  const BP = 0.0001;

  function number(value, label, minimum, maximum) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
      throw new RangeError(label + ' must be a finite number between ' + minimum + ' and ' + maximum + '.');
    }
    return value;
  }

  function validateCurve(curve) {
    if (!Array.isArray(curve) || curve.length !== TENORS.length) {
      throw new TypeError('Provide exactly seven zero-yield nodes: 0.5, 1, 2, 5, 10, 20 and 30 years.');
    }
    const normalized = curve.map(function (node) {
      if (!node || typeof node !== 'object') throw new TypeError('Each curve node needs a tenor and yield.');
      const tenor = number(node.tenor, 'Tenor', 0.5, 30);
      const yieldValue = number(node.yield, 'Zero yield (%)', -95, 50);
      if (yieldValue <= -95) throw new RangeError('Zero yields must be greater than -95%.');
      return { tenor: tenor, yield: yieldValue };
    }).sort(function (a, b) { return a.tenor - b.tenor; });
    normalized.forEach(function (node, index) {
      if (node.tenor !== TENORS[index]) {
        throw new RangeError('Curve tenors must be 0.5, 1, 2, 5, 10, 20 and 30 years, with no duplicates.');
      }
    });
    return normalized;
  }

  function normalizeBond(options) {
    if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
      throw new TypeError('Bond settings must be an object.');
    }
    const bond = Object.assign({ maturity: 10, coupon: 3, frequency: 2, face: 100 }, options);
    number(bond.maturity, 'Maturity (years)', 1, 30);
    if (!Number.isInteger(bond.maturity)) throw new RangeError('Maturity must be a whole number of years.');
    number(bond.coupon, 'Annual coupon (%)', 0, 15);
    if (bond.frequency !== 1 && bond.frequency !== 2) throw new RangeError('Coupon frequency must be 1 or 2 per year.');
    number(bond.face, 'Face amount', 1e-6, 1e10);
    return bond;
  }

  function normalizeShock(options) {
    if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
      throw new TypeError('Shock settings must be an object.');
    }
    const shock = Object.assign({ parallel: 0, steepness: 0, belly: 0 }, options);
    ['parallel', 'steepness', 'belly'].forEach(function (name) {
      number(shock[name], name + ' shock (bp)', -300, 300);
    });
    return shock;
  }

  // Linearly interpolate annual-effective zero yields; extrapolation is flat.
  function interpolate(curve, t) {
    if (t <= curve[0].tenor) return curve[0].yield;
    const last = curve[curve.length - 1];
    if (t >= last.tenor) return last.yield;
    for (let i = 1; i < curve.length; i += 1) {
      const right = curve[i];
      if (t <= right.tenor) {
        const left = curve[i - 1];
        const weight = (t - left.tenor) / (right.tenor - left.tenor);
        return left.yield + weight * (right.yield - left.yield);
      }
    }
    return last.yield;
  }

  function interpolateYield(curve, t) {
    number(t, 'Time (years)', 0, 100);
    return interpolate(validateCurve(curve), t);
  }

  function price(curve, bond) {
    const payments = bond.maturity * bond.frequency;
    const coupon = bond.face * bond.coupon / 100 / bond.frequency;
    let presentValue = 0;
    for (let period = 1; period <= payments; period += 1) {
      const t = period / bond.frequency;
      const cashFlow = coupon + (period === payments ? bond.face : 0);
      presentValue += cashFlow / Math.pow(1 + interpolate(curve, t) / 100, t);
    }
    return presentValue;
  }

  function priceBond(curve, options) {
    return price(validateCurve(curve), normalizeBond(options));
  }

  function bumped(curve, amount, selectedTenor) {
    return curve.map(function (node) {
      return {
        tenor: node.tenor,
        yield: node.yield + (selectedTenor === undefined || node.tenor === selectedTenor ? amount : 0)
      };
    });
  }

  function calculateRisk(curve, bond) {
    const basePrice = price(curve, bond);
    // 0.01 percentage points = 1 bp. Internal bumps may cross the input bound
    // by 1 bp but always remain above the mathematical -100% discount limit.
    const down = price(bumped(curve, -0.01), bond);
    const up = price(bumped(curve, 0.01), bond);
    return {
      price: basePrice,
      duration: (down - up) / (2 * basePrice * BP),
      convexity: (down + up - 2 * basePrice) / (basePrice * BP * BP),
      dv01: (down - up) / 2,
      keyRates: curve.map(function (node) {
        const keyDown = price(bumped(curve, -0.01, node.tenor), bond);
        const keyUp = price(bumped(curve, 0.01, node.tenor), bond);
        return { tenor: node.tenor, dv01: (keyDown - keyUp) / 2 };
      })
    };
  }

  function risk(curve, options) {
    return calculateRisk(validateCurve(curve), normalizeBond(options));
  }

  // Steepness has weight -1 at 0.5y and +1 at 30y, linear in tenor.
  // Belly is a triangle: zero at 0.5y/30y and +1 at 5y, linear either side.
  // All three shock inputs are bp. This is a chosen scenario basis, not PCA.
  function applyShock(curve, shock) {
    return curve.map(function (node) {
      const steepWeight = 2 * (node.tenor - 0.5) / 29.5 - 1;
      const bellyWeight = node.tenor <= 5 ? (node.tenor - 0.5) / 4.5 : (30 - node.tenor) / 25;
      const shift = shock.parallel + shock.steepness * steepWeight + shock.belly * bellyWeight;
      return { tenor: node.tenor, yield: node.yield + shift / 100 };
    });
  }

  function shockCurve(curve, options) {
    return validateCurve(applyShock(validateCurve(curve), normalizeShock(options)));
  }

  function analyze(curve, options, scenario, notional) {
    const normalized = validateCurve(curve);
    const bond = normalizeBond(options);
    const shock = normalizeShock(scenario);
    const principal = notional === undefined ? 1000000 : notional;
    number(principal, 'Notional amount', 1, 1e10);
    const shockedCurve = validateCurve(applyShock(normalized, shock));
    const base = calculateRisk(normalized, bond);
    const shockedPrice = price(shockedCurve, bond);
    const change = shockedPrice - base.price;
    const parallelChange = shock.parallel / 10000;
    return {
      base: base,
      shockedPrice: shockedPrice,
      priceChange: change,
      returnPct: change / base.price,
      pnl: principal / bond.face * change,
      shockedCurve: shockedCurve,
      approxParallelReturn: -base.duration * parallelChange + 0.5 * base.convexity * parallelChange * parallelChange
    };
  }

  return Object.freeze({
    TENORS: TENORS,
    validateCurve: validateCurve,
    interpolateYield: interpolateYield,
    priceBond: priceBond,
    risk: risk,
    shockCurve: shockCurve,
    analyze: analyze
  });
}));

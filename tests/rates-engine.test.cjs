'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const rates = require('../assets/rates-engine.js');
const flat = (yieldValue = 4) => rates.TENORS.map(tenor => ({ tenor, yield: yieldValue }));
const close = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    'Expected ' + actual + ' to be within ' + tolerance + ' of ' + expected);
};

test('annual coupon at a flat annual-effective coupon yield prices at par', () => {
  close(rates.priceBond(flat(4), { maturity: 10, coupon: 4, frequency: 1 }), 100);
});

test('semiannual cash flows use annual-effective discounting, not semiannual quoted yields', () => {
  const curve = flat(4);
  const expected = 1.5 / Math.sqrt(1.04) + 101.5 / 1.04;
  close(rates.priceBond(curve, { maturity: 1, coupon: 3, frequency: 2 }), expected);
});

test('nonflat yield curve produces the independently calculated coupon PV', () => {
  const curve = flat(4);
  curve[0].yield = 2;
  curve[1].yield = 3;
  curve[2].yield = 5;
  const expected = 2 / Math.pow(1.02, 0.5) + 2 / 1.03 + 2 / Math.pow(1.04, 1.5) + 102 / Math.pow(1.05, 2);
  close(rates.priceBond(curve, { maturity: 2, coupon: 4, frequency: 2 }), expected);
});

test('zero coupon PV, effective duration and convexity agree with analytic values', () => {
  const result = rates.risk(flat(4), { maturity: 10, coupon: 0 });
  const expectedPrice = 100 / Math.pow(1.04, 10);
  close(result.price, expectedPrice);
  close(result.duration, 10 / 1.04, 3e-6);
  close(result.convexity, 110 / Math.pow(1.04, 2), 3e-5);
  close(result.dv01, result.duration * expectedPrice / 10000);
});

test('key rate DV01s approximately sum to parallel DV01 and vanish beyond maturity', () => {
  const curve = rates.TENORS.map((tenor, index) => ({ tenor, yield: 2 + index * 0.4 }));
  const result = rates.risk(curve, { maturity: 12, coupon: 3.5 });
  close(result.keyRates.reduce((sum, node) => sum + node.dv01, 0), result.dv01, 1e-7);
  assert.ok(result.keyRates.every(node => node.dv01 >= 0));
  close(result.keyRates.find(node => node.tenor === 30).dv01, 0);
  assert.ok(result.keyRates.find(node => node.tenor === 20).dv01 > 0,
    '12-year cash flow interpolates between 10-year and 20-year nodes');
});

test('linear interpolation and flat extrapolation have known endpoint values', () => {
  const curve = flat(3);
  curve[2].yield = 2;
  curve[3].yield = 5;
  close(rates.interpolateYield(curve, 3), 3);
  close(rates.interpolateYield(curve, 0), 3);
  close(rates.interpolateYield(curve, 40), 3);
  close(rates.interpolateYield(curve, 5), 5);
});

test('curve normalization sorts and clones without changing caller input', () => {
  const reversed = flat().reverse();
  const result = rates.validateCurve(reversed);
  assert.deepEqual(result.map(node => node.tenor), [0.5, 1, 2, 5, 10, 20, 30]);
  assert.equal(reversed[0].tenor, 30);
  result[0].yield = 10;
  assert.equal(reversed[6].yield, 4);
});

test('shock definitions give exact endpoint and belly peak changes', () => {
  const curve = flat(4);
  const steep = rates.shockCurve(curve, { steepness: 100 });
  close(steep[0].yield, 3);
  close(steep[6].yield, 5);
  close(steep[3].yield, 4 + 2 * 4.5 / 29.5 - 1);
  const belly = rates.shockCurve(curve, { belly: 100 });
  close(belly[0].yield, 4);
  close(belly[3].yield, 5);
  close(belly[6].yield, 4);
  close(belly[4].yield, 4.8);
  assert.deepEqual(curve, flat(4));
});

test('parallel rise reduces price; exact P&L scales with face and notional', () => {
  const result = rates.analyze(flat(4), { maturity: 5, coupon: 0 }, { parallel: 100 }, 2000000);
  const base = 100 / Math.pow(1.04, 5);
  const shocked = 100 / Math.pow(1.05, 5);
  close(result.base.price, base);
  close(result.shockedPrice, shocked);
  close(result.priceChange, shocked - base);
  close(result.returnPct, shocked / base - 1);
  close(result.pnl, 20000 * (shocked - base));
  assert.ok(result.returnPct < 0);
  const face1000 = rates.analyze(flat(4), { maturity: 5, coupon: 0, face: 1000 }, { parallel: 100 }, 2000000);
  close(face1000.pnl, result.pnl, 1e-8);
  close(face1000.base.dv01, result.base.dv01 * 10, 1e-10);
});

test('duration-convexity approximation isolates the parallel scenario component', () => {
  const result = rates.analyze(flat(3), { maturity: 10, coupon: 3 }, { parallel: 10 });
  close(result.returnPct, result.approxParallelReturn, 1e-6);
  const nonparallel = rates.analyze(flat(3), { maturity: 10, coupon: 3 }, { steepness: 100, belly: 100 });
  close(nonparallel.approxParallelReturn, 0);
  assert.notEqual(nonparallel.returnPct, 0);
});

test('no shock yields zero change and zero P&L', () => {
  const result = rates.analyze(flat());
  close(result.priceChange, 0);
  close(result.returnPct, 0);
  close(result.pnl, 0);
  close(result.approxParallelReturn, 0);
});

test('negative yields remain valid and produce prices above par for zero coupons', () => {
  const result = rates.risk(flat(-1), { maturity: 5, coupon: 0 });
  close(result.price, 100 / Math.pow(0.99, 5));
  assert.ok(result.price > 100);
  assert.ok(result.duration > 0);
  assert.ok(result.convexity > 0);
});

test('zero yields sum undiscounted cash flows even at the maximum maturity', () => {
  close(rates.priceBond(flat(0), { maturity: 30, coupon: 3, frequency: 2 }), 190);
});

test('invalid curve values, dates-as-tenors and duplicate/missing nodes are rejected', () => {
  for (const value of [NaN, Infinity, -Infinity, -95, 50.01, '4', null]) {
    const curve = flat(); curve[2].yield = value;
    assert.throws(() => rates.validateCurve(curve));
  }
  for (const invalid of [null, {}, [], flat().slice(1), flat().concat({ tenor: 40, yield: 4 })]) {
    assert.throws(() => rates.validateCurve(invalid));
  }
  const duplicate = flat(); duplicate[2].tenor = 1;
  assert.throws(() => rates.validateCurve(duplicate));
  const wrong = flat(); wrong[2].tenor = '2';
  assert.throws(() => rates.validateCurve(wrong));
  assert.throws(() => rates.interpolateYield(flat(), -1));
  assert.throws(() => rates.interpolateYield(flat(), NaN));
});

test('invalid bond inputs fail instead of silently coercing', () => {
  const invalid = [
    { maturity: 0 }, { maturity: 31 }, { maturity: 2.5 }, { maturity: NaN },
    { coupon: -1 }, { coupon: 16 }, { coupon: '3' },
    { frequency: 0 }, { frequency: 4 }, { frequency: '2' },
    { face: 0 }, { face: -100 }, { face: Infinity }, { face: 1e11 }, { face: Number.MIN_VALUE }
  ];
  invalid.forEach(bond => assert.throws(() => rates.priceBond(flat(), bond)));
  assert.throws(() => rates.priceBond(flat(), null));
});

test('invalid shocks, shock results and notionals are rejected', () => {
  for (const shock of [{ parallel: NaN }, { parallel: 301 }, { belly: -301 }, { steepness: '10' }, null]) {
    assert.throws(() => rates.shockCurve(flat(), shock));
  }
  assert.throws(() => rates.shockCurve(flat(49), { parallel: 300 }));
  assert.throws(() => rates.shockCurve(flat(-94), { parallel: -300 }));
  for (const notional of [0, -1, 1e11, NaN, Infinity, '1000']) {
    assert.throws(() => rates.analyze(flat(), {}, {}, notional));
  }
});

test('risk remains finite at the accepted upper curve input bound', () => {
  const result = rates.risk(flat(50));
  assert.ok(Number.isFinite(result.price));
  assert.ok(Number.isFinite(result.duration));
  assert.ok(Number.isFinite(result.convexity));
});

test('browser build installs RatesEngine without requiring CommonJS', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/rates-engine.js'), 'utf8'), context);
  assert.equal(typeof context.RatesEngine.priceBond, 'function');
  close(context.RatesEngine.priceBond(flat(4), { maturity: 10, coupon: 4, frequency: 1 }), 100);
});

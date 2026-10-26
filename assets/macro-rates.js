(function () {
  'use strict';
  const E = window.RatesEngine;
  const feed = window.MacroFeed;
  const $ = id => document.getElementById(id);
  const tenors = [0.5, 1, 2, 5, 10, 20, 30];
  const markets = {
    us: { name: 'United States', currency: 'USD', yields: [4.1, 3.95, 3.8, 3.9, 4.15, 4.5, 4.55], prompts: ['Track payrolls, unemployment and real consumption. Separate demand resilience from one-off data noise.', 'Watch core services, shelter and wage growth. Distinguish monthly momentum from base effects.', 'Compare the expected Fed path with fiscal issuance and term-premium risk. Front and long ends may diverge.'], sources: [['Fed policy rate', 'https://www.federalreserve.gov/economy-at-a-glance-policy-rate.htm'], ['BLS inflation & labour', 'https://www.bls.gov/bls/newsrels.htm'], ['BEA growth & consumption', 'https://www.bea.gov/data/economic-accounts']] },
    eu: { name: 'Euro area', currency: 'EUR', yields: [2.1, 2.05, 2.1, 2.3, 2.6, 2.85, 2.95], prompts: ['Compare activity across members, industrial production and household demand. Avoid treating the region as one economy.', 'Separate services, negotiated wages and energy effects. Compare headline HICP with underlying inflation.', 'Connect the ECB path to balance-sheet policy and fiscal supply. This model excludes sovereign spread differences.'], sources: [['ECB policy rates', 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html'], ['Eurostat macro indicators', 'https://ec.europa.eu/eurostat/cache/dashboard/euro-indicators/'], ['ECB yield curves', 'https://www.ecb.europa.eu/stats/financial_markets_and_interest_rates/euro_area_yield_curves/html/index.en.html']] },
    uk: { name: 'United Kingdom', currency: 'GBP', yields: [4.1, 4.0, 3.9, 4.0, 4.3, 4.7, 4.8], prompts: ['Follow GDP, household spending and labour-market slack. Check data quality and revisions to employment estimates.', 'Focus on services CPI and private-sector pay. Test how much inflation is domestically persistent.', 'Consider Bank Rate, gilt supply and quantitative tightening together. Fiscal surprises can reprice the long end.'], sources: [['Bank Rate & decisions', 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate'], ['ONS economy', 'https://www.ons.gov.uk/economy'], ['BoE yield curves', 'https://www.bankofengland.co.uk/statistics/yield-curves']] },
    jp: { name: 'Japan', currency: 'JPY', yields: [0.5, 0.6, 0.75, 1.0, 1.4, 2.0, 2.35], prompts: ['Examine real consumption, wage settlements and external demand. Distinguish nominal growth from purchasing power.', 'Compare wage-linked services inflation with imported price pressure and exchange-rate pass-through.', 'Study policy normalisation, bond purchases and domestic demand for JGBs. An FX view requires a separate model.'], sources: [['BoJ policy meetings', 'https://www.boj.or.jp/en/mopo/mpmsche_minu/'], ['Statistics Bureau CPI', 'https://www.stat.go.jp/english/data/cpi/'], ['Cabinet Office GDP', 'https://www.esri.cao.go.jp/en/sna/menu.html']] },
    cn: { name: 'China', currency: 'CNY', yields: [1.4, 1.45, 1.5, 1.65, 1.85, 2.1, 2.2], prompts: ['Connect domestic demand, property activity and credit transmission. Separate headline output from the composition of growth.', 'Read CPI and PPI alongside capacity utilisation and demand. Consumer and producer price pressures can differ.', 'Track liquidity operations, policy rates and fiscal issuance. LPR is not directly comparable to an overnight policy target.'], sources: [['PBoC policy & liquidity', 'https://www.pbc.gov.cn/en/3688229/3688335/3730276/index.html'], ['NBS macro releases', 'https://www.stats.gov.cn/english/PressRelease/']] }
  };
  const presets = {
    unchanged: { parallel: 0, steepness: 0, belly: 0, story: 'A neutral reference: no rate change. Use it to isolate the starting bond price and risk profile.' },
    easing: { parallel: -25, steepness: 25, belly: 0, story: 'Easing hypothesis: the front end falls 50 bp and the 30Y end is unchanged. Investigate whether weaker growth and disinflation are already priced in.' },
    inflation: { parallel: 50, steepness: -15, belly: 10, story: 'Inflation hypothesis: higher rates across the curve, with a larger front-end increase. Persistent wages or services inflation could motivate this stress.' },
    premium: { parallel: 20, steepness: 20, belly: 0, story: 'Term-premium hypothesis: the front end is unchanged and the 30Y end rises 40 bp. Consider supply, uncertainty and investor demand, separately from policy expectations.' }
  };
  const blankState = key => ({ curve: tenors.map((tenor, i) => ({ tenor, yield: markets[key].yields[i] })), modified: false, curveOrigin: null, growth: 'Unassigned', inflation: 'Unassigned', policy: 'Unassigned', evidence: '', invalidation: '', date: '' });
  const state = Object.fromEntries(Object.keys(markets).map(key => [key, blankState(key)]));
  let active = 'us';
  let results = null;
  let scenarioName = 'Policy easing';
  let updateTimer;
  const fmt = (n, digits = 2) => Math.abs(n) >= 1e10 ? Number(n).toExponential(Math.max(digits, 2)) : Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (n, digits = 2) => (n > 0 ? '+' : '') + fmt(n, digits);
  const tenorLabel = t => t === 0.5 ? '6M' : t + 'Y';
  const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
  const inputValue = id => { const value = $(id).value.trim(); if (value === '') throw new Error('Please complete every bond and shock input before calculating.'); const n = Number(value); if (!Number.isFinite(n)) throw new Error('Every numeric input must be a finite number.'); return n; };
  function controls() {
    return { bond: { maturity: inputValue('maturity'), coupon: inputValue('coupon'), frequency: inputValue('frequency'), face: 100 }, shock: { parallel: inputValue('parallel'), steepness: inputValue('steepness'), belly: inputValue('belly') }, notional: inputValue('notional') };
  }
  function saveNotes() { ['growth', 'inflation', 'policy', 'evidence', 'invalidation'].forEach(id => { state[active][id] = $(id).value; }); state[active].date = $('observation-date').value; }
  const curveLabel = s => s.modified ? 'User-edited assumption' : s.curveOrigin ? s.curveOrigin.provider + ' · model curve' + (s.curveOrigin.refreshStatus === 'cached' ? ' · cached' : '') : 'Illustrative curve';
  function adoptOfficialCurves() {
    for (const key of Object.keys(markets)) { const c = feed.getCurve(key); if (c && !state[key].modified) { state[key].curve = c.points.map(p => ({...p})); state[key].date = c.date; state[key].curveOrigin = c; } }
    mountMarket();
  }
  function mountMarket() {
    feed.setMarket(active);
    const market = markets[active], data = state[active];
    document.querySelectorAll('[data-market]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.market === active)));
    $('market-name').textContent = market.name;
    $('currency-label').textContent = market.currency;
    ['growth', 'inflation', 'policy'].forEach((key, i) => { $(key + '-prompt').textContent = market.prompts[i]; });
    ['growth', 'inflation', 'policy', 'evidence', 'invalidation'].forEach(id => { $(id).value = data[id]; });
    $('observation-date').value = data.date;
    $('observation-date').readOnly = !!data.curveOrigin && !data.modified;
    const sourceLinks = market.sources.map(([label, href]) => { const a = el('a', label + ' ↗'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; });
    $('source-links').replaceChildren(...sourceLinks);
    $('curve-inputs').replaceChildren(...data.curve.map((point, i) => {
      const label = el('label', tenorLabel(point.tenor));
      const input = el('input'); input.type = 'number'; input.min = '-94.99'; input.max = '50'; input.step = '0.01'; input.value = point.yield; input.id = 'rate-' + i; input.setAttribute('aria-label', tenorLabel(point.tenor) + ' annual effective zero yield, percent'); label.htmlFor = input.id;
      input.addEventListener('input', () => { data.curve[i].yield = input.value.trim() === '' ? NaN : Number(input.value); data.modified = true; $('observation-date').readOnly = false; scheduleRender(); });
      label.append(input); return label;
    }));
    render();
  }
  const svgNode = (tag, attrs, text) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text !== undefined) n.textContent = text; return n; };
  function drawCurve(base, shocked) {
    const chart = $('curve-chart');
    chart.replaceChildren(svgNode('title', { id: 'curve-title' }, markets[active].name + ': base and scenario zero curves'), svgNode('desc', { id: 'curve-desc' }, base.map((p, i) => tenorLabel(p.tenor) + ': base ' + fmt(p.yield) + '%, scenario ' + fmt(shocked[i].yield) + '%').join('; ')));
    const all = [...base, ...shocked].map(p => p.yield), lo = Math.min(...all), hi = Math.max(...all);
    const pad = Math.max((hi - lo) * .2, .25), min = lo - pad, max = hi + pad;
    const x = t => 49 + (t - .5) / 29.5 * 607, y = rate => 245 - (rate - min) / (max - min) * 218;
    for (let i = 0; i <= 4; i++) { const value = min + (max - min) * i / 4; chart.append(svgNode('line', { x1: 49, x2: 656, y1: y(value), y2: y(value), class: 'grid-line' }), svgNode('text', { x: 40, y: y(value) + 4, 'text-anchor': 'end', class: 'axis-label' }, fmt(value, 1) + '%')); }
    // Labels are spaced in tenor-time, matching the interpolation used by pricing.
    [0.5, 5, 10, 20, 30].forEach(t => chart.append(svgNode('text', { x: x(t), y: 270, 'text-anchor': 'middle', class: 'axis-label' }, tenorLabel(t))));
    const path = curve => curve.map((p, i) => (i ? 'L' : 'M') + x(p.tenor).toFixed(2) + ',' + y(p.yield).toFixed(2)).join(' ');
    chart.append(svgNode('path', { d: path(base), class: 'base-line' }), svgNode('path', { d: path(shocked), class: 'scenario-line' }));
    base.forEach(p => chart.append(svgNode('circle', { cx: x(p.tenor), cy: y(p.yield), r: 3.8, class: 'point' })));
  }
  function renderKeyRates(risk, notional) {
    const amounts = risk.keyRates.map(p => ({ tenor: p.tenor, amount: p.dv01 * notional / 100 }));
    const max = Math.max(...amounts.map(p => Math.abs(p.amount)), .000001);
    $('key-rates').replaceChildren(...amounts.map(p => { const cell = el('div', undefined, 'key-rate'); cell.append(el('span', tenorLabel(p.tenor))); const track = el('div', undefined, 'bar-space'), bar = el('div', undefined, 'bar'); bar.style.height = Math.max(0, Math.abs(p.amount) / max * 60) + 'px'; track.append(bar); cell.append(track, el('strong', fmt(p.amount, 1))); cell.setAttribute('aria-label', tenorLabel(p.tenor) + ' DV01: ' + fmt(p.amount, 2) + ' ' + markets[active].currency); return cell; }));
  }
  function clearResults(message) {
    results = null;
    $('error').textContent = message; $('error').hidden = false;
    ['pnl', 'price-return', 'base-price', 'scenario-price', 'duration', 'convexity', 'dv01', 'slope'].forEach(id => $(id).textContent = '—');
    $('curve-chart').replaceChildren(svgNode('title', {}, 'Complete valid inputs to view the curve'));
    $('comparison-body').replaceChildren(); $('key-rates').replaceChildren(); $('interpretation').textContent = 'Complete valid inputs to calculate the scenario.'; $('approximation').textContent = '';
    $('interpretation-heading').textContent = 'Check the inputs.';
    $('curve-status').textContent = markets[active].name + ' · calculation unavailable';
    $('calculation-status').textContent = 'Calculation unavailable. ' + message;
    $('export-memo').disabled = true; $('export-csv').disabled = true;
  }
  function render() {
    try {
      const { bond, shock, notional } = controls();
      const errors = {};
      const all = Object.fromEntries(Object.keys(markets).map(key => {
        try { return [key, E.analyze(state[key].curve, bond, shock, notional)]; }
        catch (err) { errors[key] = err.message; return [key, null]; }
      }));
      if (!all[active]) throw new Error(markets[active].name + ': ' + errors[active]);
      const r = all[active], market = markets[active], data = state[active];
      results = { all, bond, shock, notional, errors };
      $('error').hidden = true; $('export-memo').disabled = false; $('export-csv').disabled = false;
      $('curve-status').textContent = curveLabel(data) + ' · ' + market.currency + (data.date ? ' · dated ' + data.date : '');
      drawCurve(data.curve, r.shockedCurve);
      $('pnl').textContent = market.currency + ' ' + signed(r.pnl, 0); $('pnl').classList.toggle('negative', r.pnl < 0);
      $('price-return').textContent = signed(r.returnPct * 100) + '% price change · face ' + fmt(notional, 0);
      $('base-price').textContent = fmt(r.base.price, 3); $('scenario-price').textContent = fmt(r.shockedPrice, 3);
      $('duration').textContent = fmt(r.base.duration) + ' yr'; $('convexity').textContent = fmt(r.base.convexity) + ' yr²';
      $('dv01').textContent = market.currency + ' ' + fmt(r.base.dv01 * notional / 100);
      $('slope').textContent = signed((data.curve[4].yield - data.curve[2].yield) * 100, 0) + ' bp';
      renderKeyRates(r.base, notional);
      const dominant = r.base.keyRates.reduce((a, b) => a.dv01 >= b.dv01 ? a : b);
      $('interpretation-heading').textContent = Math.abs(r.priceChange) < 1e-10 ? 'No curve move, no price move.' : r.priceChange > 0 ? 'This scenario lifts the bond price.' : 'This scenario lowers the bond price.';
      $('interpretation').textContent = 'The ' + bond.maturity + '-year bond changes by ' + signed(r.returnPct * 100) + '% under this curve shock. Its largest node exposure is at ' + tenorLabel(dominant.tenor) + '. A parallel 1 bp rise would reduce value by approximately ' + market.currency + ' ' + fmt(r.base.dv01 * notional / 100) + ' for this face amount.';
      $('approximation').textContent = (shock.steepness || shock.belly ? 'Parallel component only: ' : 'Duration + convexity approximation: ') + signed(r.approxParallelReturn * 100) + '%. ' + (shock.steepness || shock.belly ? 'Twist and belly effects require the full curve repricing shown above.' : 'Compare with the exact model price change above; the approximation is local.');
      $('comparison-body').replaceChildren(...Object.keys(markets).map(key => { const m = markets[key], s = state[key], v = all[key], row = el('tr'); if (key === active) row.className = 'selected'; const name = el('td', m.name + ' · ' + m.currency); name.append(el('small', v ? (curveLabel(s) + (s.date ? ' · ' + s.date : '')) : 'Invalid inputs · select market to repair')); row.append(name); if (!v) { const errorCell = el('td', 'Calculation unavailable'); errorCell.colSpan = 5; row.append(errorCell); return row; } row.append(el('td', fmt(s.curve[4].yield) + '%'), el('td', signed((s.curve[4].yield - s.curve[2].yield) * 100, 0) + ' bp'), el('td', fmt(v.base.price, 3)), el('td', fmt(v.base.duration) + ' yr'), el('td', signed(v.returnPct * 100) + '%', v.returnPct < 0 ? 'negative' : 'positive')); return row; }));
      $('calculation-status').textContent = market.name + ' scenario recalculated. ' + signed(r.returnPct * 100) + '% instantaneous price change.';
    } catch (err) { clearResults(err.message); }
  }
  function scheduleRender() { clearTimeout(updateTimer); updateTimer = setTimeout(render, 100); }
  function preset(name) { const p = presets[name]; ['parallel', 'steepness', 'belly'].forEach(id => $(id).value = p[id]); scenarioName = document.querySelector('[data-preset="' + name + '"]').textContent; $('scenario-story').textContent = p.story; document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === name))); render(); }
  function download(name, text, mime) { const blob = new Blob([text], { type: mime + ';charset=utf-8' }), url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); $('export-status').textContent = 'Export prepared: ' + name; }
  function exportMemo() {
    saveNotes(); render(); if (!results) return;
    const m = markets[active], s = state[active], r = results.all[active], { bond, shock, notional } = results;
    const lines = ['# ' + m.name + ' — Macro & Rates Research Memo', '', 'Exported: ' + new Date().toISOString(), 'Input status: ' + curveLabel(s), 'Curve observation date: ' + (s.date || 'Not supplied'), '', ...feed.memoLines(active), '', 'Curve source: ' + (s.curveOrigin?.source || 'User/example inputs'), 'Curve transformation: ' + (s.curveOrigin?.method || 'None; inputs assumed annual effective'), 'Curve retrieved: ' + (s.curveOrigin?.fetchedAt || 'Not applicable'), '', '## Macro thesis', '- Growth: ' + s.growth, '- Inflation: ' + s.inflation, '- Policy: ' + s.policy, '', '### Evidence & catalysts', s.evidence || 'Not supplied.', '', '### What would change my mind?', s.invalidation || 'Not supplied.', '', '## Scenario', 'Template: ' + scenarioName + ' (hypothetical)', '- Parallel shift: ' + shock.parallel + ' bp', '- Twist amplitude: ' + shock.steepness + ' bp (negative at 6M, positive at 30Y)', '- Belly: ' + shock.belly + ' bp (triangular peak at 5Y)', '', '| Tenor | Base zero rate (%) | Scenario zero rate (%) | Key-rate DV01 (' + m.currency + ') |', '| --- | ---: | ---: | ---: |', ...s.curve.map((p, i) => '| ' + tenorLabel(p.tenor) + ' | ' + p.yield + ' | ' + fmt(r.shockedCurve[i].yield, 4) + ' | ' + fmt(r.base.keyRates[i].dv01 * notional / 100, 4) + ' |'), '', '## Bond & risk', '- Face amount: ' + String(notional) + ' ' + m.currency, '- Maturity: ' + bond.maturity + ' years; coupon: ' + bond.coupon + '%; frequency: ' + bond.frequency, '- Base price /100: ' + fmt(r.base.price, 6), '- Scenario price /100: ' + fmt(r.shockedPrice, 6), '- Instantaneous price change: ' + signed(r.returnPct * 100, 4) + '%', '- P&L: ' + signed(r.pnl, 2) + ' ' + m.currency, '- Effective duration: ' + fmt(r.base.duration, 4) + ' years', '- Effective convexity: ' + fmt(r.base.convexity, 4) + ' years squared', '- DV01 for face amount: ' + fmt(r.base.dv01 * notional / 100, 4) + ' ' + m.currency, '', '## Conventions & limits', 'Annual-effective zero rates, linear maturity interpolation, coupon-date settlement immediately after payment, no accrued interest. Full coupon periods; par yields must be bootstrapped and converted before use. Central +/-1bp finite differences for duration, convexity and DV01. No time passage, carry, roll-down, credit spread, FX or trading cost. Macro views do not automatically determine the curve scenario. This is model sensitivity, not a return forecast.', '', '## Primary sources', ...m.sources.map(([label, href]) => '- [' + label + '](' + href + ')'), '', 'Workbench: https://tuixue.nl/fintools/macro-rates.html', 'Code: https://github.com/Clayins131/Clayins131.github.io/blob/main/assets/rates-engine.js'];
    download('macro-rates-' + active + '.md', lines.join('\n'), 'text/markdown');
  }
  function exportCSV() {
    saveNotes(); render(); if (!results) return;
    const { all, bond, shock, notional, errors } = results;
    if (Object.keys(errors).length) { $('export-status').textContent = 'CSV needs valid curves in every market. Repair: ' + Object.keys(errors).map(key => markets[key].name).join(', '); return; }
    const header = ['market', 'currency', 'input_status', 'observation_date', 'maturity_years', 'coupon_percent', 'payments_per_year', 'face_amount', 'parallel_bp', 'twist_amplitude_bp', 'belly_bp', 'base_price_per_100', 'scenario_price_per_100', 'price_change_percent', 'instantaneous_pnl_local', 'duration_years', 'convexity_years_squared', 'dv01_local', ...tenors.map(t => 'base_zero_' + t + 'y_percent'), ...tenors.map(t => 'scenario_zero_' + t + 'y_percent'), ...tenors.map(t => 'key_rate_dv01_' + t + 'y_local'), 'curve_provider', 'curve_source', 'curve_retrieved', 'curve_transformation', 'discount_convention', 'settlement_convention', 'excluded_effects'];
    const rows = Object.keys(markets).map(key => { const m = markets[key], s = state[key], r = all[key]; return [m.name, m.currency, s.modified ? 'user_edited_assumption' : s.curveOrigin ? 'published_model_curve' : 'illustrative_not_market_data', s.date, bond.maturity, bond.coupon, bond.frequency, notional, shock.parallel, shock.steepness, shock.belly, r.base.price, r.shockedPrice, r.returnPct * 100, r.pnl, r.base.duration, r.base.convexity, r.base.dv01 * notional / 100, ...s.curve.map(p => p.yield), ...r.shockedCurve.map(p => p.yield), ...r.base.keyRates.map(p => p.dv01 * notional / 100), s.curveOrigin?.provider || '', s.curveOrigin?.source || '', s.curveOrigin?.fetchedAt || '', s.curveOrigin?.method || '', 'annual_effective_zero_linear_interpolation', 'coupon_date_post_payment', 'carry_roll_down_credit_fx_costs']; });
    // Text fields are controlled labels or an ISO date; numeric fields remain numeric.
    const csvCell = v => typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '""') + '"';
    download('global-macro-rates-scenarios.csv', [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv');
  }
  document.querySelectorAll('[data-market]').forEach(button => button.addEventListener('click', () => { saveNotes(); active = button.dataset.market; mountMarket(); }));
  document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => preset(button.dataset.preset)));
  ['maturity', 'coupon', 'frequency', 'notional', 'parallel', 'steepness', 'belly'].forEach(id => $(id).addEventListener('input', () => { if (['parallel', 'steepness', 'belly'].includes(id)) { scenarioName = 'Custom scenario'; document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false')); $('scenario-story').textContent = 'Custom hypothesis. Record why you expect each part of the curve to move, and what evidence would invalidate that view.'; } scheduleRender(); }));
  ['growth', 'inflation', 'policy', 'evidence', 'invalidation'].forEach(id => $(id).addEventListener('input', saveNotes));
  $('observation-date').addEventListener('change', () => { saveNotes(); render(); });
  $('reset-market').addEventListener('click', () => { const c=feed.getCurve(active); state[active].curve=c?c.points.map(p=>({...p})):blankState(active).curve; state[active].curveOrigin=c; state[active].modified=false; state[active].date=c?.date||''; mountMarket(); $('export-status').textContent=c?'Curve restored to the latest retrieved source. Research notes were kept.':'Illustrative curve restored. Research notes were kept.'; });
  $('export-memo').addEventListener('click', exportMemo); $('export-csv').addEventListener('click', exportCSV);
  if (!E) { clearResults('The calculation engine did not load. Reload this page to try again.'); return; }
  mountMarket(); preset('easing');
  feed.init({onUpdate: adoptOfficialCurves});
})();

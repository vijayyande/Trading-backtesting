const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const COLORS = ['#47d7d1', '#f1bd56', '#b88cff', '#f27675', '#75b9ff', '#9bdc71'];
let chart, mainSeries, candles = [], interval = '5m', chartType = 'candlestick', active = [], liveTimer, loadingMore = false, noMoreHistory = false, backtestRuns = [], backtestCapital = 0, inBacktestMode = false, loadGeneration = 0, customStrategies = new Map(), customDraft = { entryConditions: [], exitConditions: [], stopLoss: 0 };
let account = { loggedIn: false, username: '', profiles: [] }, accountMode = 'login';
let pnlBadgeVisible = (() => { try { return localStorage.getItem('prism.showPnlBadge') !== '0'; } catch { return true; } })();
let indicatorPane = 0;
let indicatorPresets = {};
let mainMarkers = null;
let drawings = [], drawMode = 'select', drawColor = '#47d7d1', selectedDrawing = null, drawingDraft = null, dragState = null, drawingSeq = 0;
const intervalSeconds = () => ({ '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 }[interval] || 86400);
const defaultLimit = () => ({ '1m': 9000, '5m': 2000, '15m': 700, '1h': 200, '1d': 30 }[interval] || 30);
const ONE_MONTH_MS = 30 * 24 * 3600 * 1000;
const MIN_TRADE_QTY = 100;
const INDICATOR_PARAMS = {
  BB: [['period', 'Period', 20], ['std', 'Std dev', 2]], KC: [['period', 'EMA', 20], ['mult', 'ATR mult', 2]], DC: [['period', 'Period', 20]], ENVELOPE: [['period', 'Period', 20], ['percent', 'Width %', 2.5]],
  SAR: [['accel', 'Acceleration', .02], ['maxAccel', 'Maximum', .2]], SUPERTREND: [['atrPeriod', 'ATR period', 10], ['mult', 'Multiplier', 3]], ICHIMOKU: [['conversion', 'Conversion', 9], ['base', 'Base', 26], ['spanB', 'Span B', 52]],
  MACD: [['fast', 'Fast', 12], ['slow', 'Slow', 26], ['signal', 'Signal', 9]], PPO: [['fast', 'Fast', 12], ['slow', 'Slow', 26]], STOCH: [['k', '%K', 14], ['d', '%D', 3]],
  AO: [['fast', 'Fast', 5], ['slow', 'Slow', 34]], ROC: [['period', 'Period', 12]], ATR: [['period', 'Period', 14]], CCI: [['period', 'Period', 20]], WILLIAMS_R: [['period', 'Period', 14]], MFI: [['period', 'Period', 14]], ADX: [['period', 'Period', 14]], ADOSC: [['fast', 'Fast', 3], ['slow', 'Slow', 10]]
};
const indicatorParams = name => INDICATOR_PARAMS[name] || [['period', 'Period', 14]];
const defaultIndicatorConfig = name => Object.fromEntries(indicatorParams(name).map(([key, , value]) => [key, value]));

const CONDITION_PARAMS = {
  CLOSE: [], OPEN: [], HIGH: [], LOW: [], VOLUME: [], TYPICAL: [],
  SMA: [['period', 'Period', 14]], EMA: [['period', 'Period', 14]], WMA: [['period', 'Period', 14]],
  DEMA: [['period', 'Period', 14]], TEMA: [['period', 'Period', 14]], HMA: [['period', 'Period', 14]], KAMA: [['period', 'Period', 14]],
  SAR: [['accel', 'Acceleration', .02], ['maxAccel', 'Max accel', .2]],
  SUPERTREND: [['atrPeriod', 'ATR period', 10], ['mult', 'Multiplier', 3]],
  ICHIMOKU: [['conversion', 'Conversion', 9], ['base', 'Base', 26], ['spanB', 'Span B', 52]],
  RSI: [['period', 'Period', 14]],
  MACD: [['fast', 'Fast', 12], ['slow', 'Slow', 26], ['signal', 'Signal', 9]],
  PPO: [['fast', 'Fast', 12], ['slow', 'Slow', 26], ['signal', 'Signal', 9]],
  STOCH: [['k', '%K', 14], ['d', '%D', 3]],
  STOCHRSI: [['rsiPeriod', 'RSI period', 14], ['stochPeriod', 'Stoch period', 14], ['dSmooth', '%D smooth', 3]],
  MFI: [['period', 'Period', 14]], CCI: [['period', 'Period', 20]], WILLIAMS_R: [['period', 'Period', 14]],
  ROC: [['period', 'Period', 12]], MOM: [['period', 'Period', 12]], AO: [['fast', 'Fast', 5], ['slow', 'Slow', 34]], TRIX: [['period', 'Period', 14]], DPO: [['period', 'Period', 20]],
  ATR: [['period', 'Period', 14]], ADX: [['period', 'Period', 14]], AROON: [['period', 'Period', 14]],
  VWAP: [['period', 'Period', 20]],
  OBV: [], ADL: [], ADOSC: [['fast', 'Fast', 3], ['slow', 'Slow', 10]],
  CMF: [['period', 'Period', 20]], FI: [['period', 'Period', 13]], VORTEX: [['period', 'Period', 14]],
  BB: [['period', 'Period', 20], ['std', 'Std dev', 2]],
  DC: [['period', 'Period', 20]],
  KC: [['period', 'Period', 20], ['mult', 'Multiplier', 2]],
  ENVELOPE: [['period', 'Period', 20], ['percent', 'Width %', 2.5]],
  STDDEV: [['period', 'Period', 20]], HV: [['period', 'Period', 20]],
  VWMA: [['period', 'Period', 14]], ALMA: [['period', 'Period', 9], ['offset', 'Offset', .85], ['sigma', 'Sigma', 6]], ZLEMA: [['period', 'Period', 14]],
  LR: [['period', 'Period', 14]], LSR: [['period', 'Period', 14]],
  CMO: [['period', 'Period', 14]], UO: [['short', 'Short', 7], ['mid', 'Mid', 14], ['long', 'Long', 28]],
  KST: [['roc1', 'ROC 1', 10], ['roc2', 'ROC 2', 15], ['roc3', 'ROC 3', 20], ['roc4', 'ROC 4', 30], ['sma1', 'SMA 1', 10], ['sma2', 'SMA 2', 10], ['sma3', 'SMA 3', 10], ['sma4', 'SMA 4', 15], ['signal', 'Signal', 9]],
  RVI: [['period', 'Period', 10], ['signal', 'Signal', 4]],
  NATR: [['period', 'Period', 14]], BOP: [], PVT: [],
  CHOP: [['period', 'Period', 14]],
  PRC: [['period', 'Period', 20]], ELDER: [['period', 'Period', 13]],
  MATH: [],
};
const CONDITION_SIGNALS = {
  MACD: [['histogram', 'Histogram'], ['macd', 'MACD line'], ['signal', 'Signal']],
  STOCH: [['k', '%K'], ['d', '%D']],
  STOCHRSI: [['k', '%K'], ['d', '%D']],
  ADX: [['adx', 'ADX'], ['dip', '+DI'], ['din', '-DI']],
  AROON: [['osc', 'Oscillator'], ['up', 'Up'], ['down', 'Down']],
  BB: [['mid', 'Middle'], ['upper', 'Upper'], ['lower', 'Lower']],
  DC: [['high', 'High'], ['low', 'Low']],
  KC: [['mid', 'Middle'], ['upper', 'Upper'], ['lower', 'Lower']],
  ENVELOPE: [['mid', 'Middle'], ['upper', 'Upper'], ['lower', 'Lower']],
  ICHIMOKU: [['conversion', 'Conversion'], ['base', 'Base'], ['spanA', 'Span A'], ['spanB', 'Span B']],
  PPO: [['line', 'PPO line'], ['signal', 'Signal']],
  VORTEX: [['diff', 'VI+ − VI−'], ['vplus', 'VI+'], ['vminus', 'VI−']],
  KST: [['kst', 'KST'], ['signal', 'Signal']],
  RVI: [['rvi', 'RVI'], ['signal', 'Signal']],
  PRC: [['high', 'High'], ['low', 'Low']],
  ELDER: [['bull', 'Bull Power'], ['bear', 'Bear Power']],
};
const CONDITION_INDICATORS = [['CLOSE', 'Close'], ['OPEN', 'Open'], ['HIGH', 'High'], ['LOW', 'Low'], ['VOLUME', 'Volume'], ['TYPICAL', 'Typical price'], ['SMA', 'SMA'], ['EMA', 'EMA'], ['WMA', 'WMA'], ['VWMA', 'Volume Weighted MA'], ['ALMA', 'Arnaud Legoux MA'], ['ZLEMA', 'Zero-Lag EMA'], ['DEMA', 'Double EMA'], ['TEMA', 'Triple EMA'], ['HMA', 'Hull MA'], ['KAMA', 'Kaufman MA'], ['SAR', 'Parabolic SAR'], ['SUPERTREND', 'Supertrend'], ['ICHIMOKU', 'Ichimoku Cloud'], ['RSI', 'RSI'], ['MACD', 'MACD'], ['PPO', 'PPO'], ['STOCH', 'Stochastic'], ['STOCHRSI', 'Stoch RSI'], ['MFI', 'MFI'], ['CCI', 'CCI'], ['WILLIAMS_R', 'Williams %R'], ['ROC', 'Rate of Change'], ['MOM', 'Momentum'], ['CMO', 'Chande Momentum'], ['UO', 'Ultimate Oscillator'], ['KST', 'KST'], ['RVI', 'Relative Vigor'], ['LR', 'Lin. Regression'], ['LSR', 'Lin. Reg. Slope'], ['AO', 'Awesome Oscillator'], ['TRIX', 'TRIX'], ['DPO', 'Detrended Price Oscillator'], ['ATR', 'Average True Range'], ['NATR', 'Normalized ATR'], ['CHOP', 'Choppiness'], ['ADX', 'ADX'], ['AROON', 'Aroon'], ['VWAP', 'VWAP'], ['OBV', 'On-Balance Volume'], ['ADL', 'Accumulation/Distribution'], ['ADOSC', 'Chaikin Oscillator'], ['CMF', 'Chaikin Money Flow'], ['FI', 'Force Index'], ['BOP', 'Balance of Power'], ['PVT', 'Price Volume Trend'], ['VORTEX', 'Vortex Indicator'], ['BB', 'Bollinger Bands'], ['DC', 'Donchian Channel'], ['PRC', 'Price Channel'], ['ELDER', 'Elder-Ray'], ['KC', 'Keltner Channel'], ['ENVELOPE', 'Moving Average Envelope'], ['STDDEV', 'Standard Deviation'], ['HV', 'Historical Volatility'], ['MATH', 'Math expression']];
const conditionParams = name => CONDITION_PARAMS[name] || [['period', 'Period', 14]];
const conditionParamsObj = name => Object.fromEntries(conditionParams(name).map(([key, , value]) => [key, value]));
const isDecimalParam = key => ['accel', 'maxAccel', 'std', 'mult', 'percent', 'offset', 'sigma'].includes(key);
const conditionSignals = name => CONDITION_SIGNALS[name] || null;
const defaultSignal = name => CONDITION_SIGNALS[name]?.[0][0] || null;
const LEGACY_INDICATOR_MAP = {
  BB_UPPER: ['BB', 'upper'], BB_MID: ['BB', 'mid'], BB_LOWER: ['BB', 'lower'],
  DC_HIGH: ['DC', 'high'], DC_LOW: ['DC', 'low'],
  KC_UPPER: ['KC', 'upper'], KC_LOWER: ['KC', 'lower'],
};
function normalizeSide(side) {
  side.params ||= {};
  for (const [key, , def] of conditionParams(side.indicator)) {
    if (side.params[key] == null) side.params[key] = side[key] != null ? Number(side[key]) : def;
  }
  const signals = conditionSignals(side.indicator);
  if (signals && !signals.some(([key]) => key === side.signal)) side.signal = defaultSignal(side.indicator);
  side.offset ??= 0;
}
function normalizeCondition(condition) {
  if (!condition.left) {
    const mapped = LEGACY_INDICATOR_MAP[condition.indicator];
    const params = { ...(condition.params || {}) };
    if (params.period == null && condition.period != null) params.period = Number(condition.period);
    const left = { indicator: mapped ? mapped[0] : condition.indicator, params, signal: mapped ? mapped[1] : condition.signal, offset: Math.min(0, Number(condition.candleOffset) || 0) };
    const right = condition.targetMode === 'CLOSE' ? { indicator: 'CLOSE', params: {}, signal: null, offset: Math.min(0, Number(condition.targetOffset) || 0) } : { indicator: 'NUMBER', params: {}, signal: null, offset: 0, number: condition.value ?? 0, number2: condition.value2 };
    delete condition.indicator; delete condition.params; delete condition.signal; delete condition.candleOffset; delete condition.targetMode; delete condition.targetOffset; delete condition.value; delete condition.value2;
    Object.assign(condition, { left, operator: condition.operator || 'above', right });
  }
  normalizeSide(condition.left);
  if (condition.right && condition.right.indicator !== 'NUMBER') normalizeSide(condition.right);
}
function finalizeLogic(group, legacy) {
  group.forEach((c, i, arr) => { if (c.connector == null) c.connector = i < arr.length - 1 ? (legacy || 'AND') : 'AND'; });
}
function getPath(object, path) { return path.split('.').reduce((o, k) => o?.[k], object); }
function setPath(object, path, value) {
  const keys = path.split('.');
  let cursor = object;
  for (let i = 0; i < keys.length - 1; i++) cursor = cursor[keys[i]];
  cursor[keys.at(-1)] = keys.at(-1) === 'number' || keys.at(-1) === 'number2' ? Number(value) : value;
}
function normalizeMathSide(side) {
  if (side.indicator !== 'MATH') return;
  if (side.a?.indicator === 'MATH') side.a = { indicator: 'CLOSE', params: {}, signal: null };
  if (side.b?.indicator === 'MATH') side.b = { indicator: 'NUMBER', number: 0 };
  side.a ||= { indicator: 'CLOSE', params: {}, signal: null };
  side.op ||= 'sub';
  side.b ||= { indicator: 'NUMBER', number: 0 };
  normalizeSide(side.a);
  if (side.b.indicator !== 'NUMBER') normalizeSide(side.b);
}
function normalizeSide(side) {
  side.params ||= {};
  for (const [key, , def] of conditionParams(side.indicator)) {
    if (side.params[key] == null) side.params[key] = side[key] != null ? Number(side[key]) : def;
  }
  const signals = conditionSignals(side.indicator);
  if (signals && !signals.some(([key]) => key === side.signal)) side.signal = defaultSignal(side.indicator);
  side.offset ??= 0;
  normalizeMathSide(side);
}

const STRATEGIES = {
  SMA_CROSS: { name: 'SMA Crossover', params: [{ k: 'fast', label: 'Fast', def: 9 }, { k: 'slow', label: 'Slow', def: 21 }],
    compute: (c, p) => { const f = sma(c.map(x => x.close), p.fast), s = sma(c.map(x => x.close), p.slow); return crossSignals(c, f, s); } },
  EMA_CROSS: { name: 'EMA Crossover', params: [{ k: 'fast', label: 'Fast', def: 9 }, { k: 'slow', label: 'Slow', def: 21 }],
    compute: (c, p) => { const f = ema(c.map(x => x.close), p.fast), s = ema(c.map(x => x.close), p.slow); return crossSignals(c, f, s); } },
  MACD_CROSS: { name: 'MACD Crossover', params: [{ k: 'fast', label: 'Fast', def: 12 }, { k: 'slow', label: 'Slow', def: 26 }, { k: 'signal', label: 'Signal', def: 9 }],
    compute: (c, p) => { const f = ema(c.map(x => x.close), p.fast), sl = ema(c.map(x => x.close), p.slow), macd = c.map((_, i) => f[i] == null || sl[i] == null ? null : f[i] - sl[i]), sg = ema(macd.map(x => x ?? 0), p.signal); return crossSignals(c, macd, sg); } },
  RSI: { name: 'RSI Strategy', params: [{ k: 'period', label: 'Period', def: 14 }, { k: 'overbought', label: 'Overbought', def: 70 }, { k: 'oversold', label: 'Oversold', def: 30 }],
    compute: (c, p) => { const r = rsi(c.map(x => x.close), p.period); const signals = []; r.forEach((v, i) => { if (v == null) return; if (v < p.oversold && (i === 0 || r[i - 1] != null && r[i - 1] >= p.oversold)) signals.push({ type: 'buy', index: i, time: c[i].time, price: c[i].close }); if (v > p.overbought && (i === 0 || r[i - 1] != null && r[i - 1] <= p.overbought)) signals.push({ type: 'sell', index: i, time: c[i].time, price: c[i].close }); }); return signals; } },
  BB: { name: 'BB Reversal', params: [{ k: 'period', label: 'Period', def: 20 }, { k: 'std', label: 'Std Dev', def: 2 }],
    compute: (c, p) => { const mid = sma(c.map(x => x.close), p.period), dev = mid.map((m, i) => m == null ? null : Math.sqrt(c.slice(i - p.period + 1, i + 1).reduce((s, v) => s + (v.close - m) ** 2, 0) / p.period)), upper = mid.map((v, i) => v == null ? null : v + p.std * dev[i]), lower = mid.map((v, i) => v == null ? null : v - p.std * dev[i]); const signals = []; c.forEach((x, i) => { if (upper[i] == null) return; if (i && x.close <= lower[i] && c[i - 1].close > lower[i]) signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); if (i && x.close >= upper[i] && c[i - 1].close < upper[i]) signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); }); return signals; } },
  SUPERTREND: { name: 'Supertrend', params: [{ k: 'period', label: 'ATR Period', def: 10 }, { k: 'mult', label: 'Multiplier', def: 3 }],
    compute: (c, p) => { const atr = sma(trueRange(c), p.period); let trend = 1; const signals = []; c.forEach((x, i) => { if (atr[i] == null) return; const mid = (x.high + x.low) / 2, band = mid + (trend === 1 ? -p.mult : p.mult) * atr[i]; if (x.close > band && trend === -1) { trend = 1; signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); } else if (x.close < band && trend === 1) { trend = -1; signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); } }); return signals; } },
  PRICE_SMA: { name: 'Price SMA Cross', params: [{ k: 'period', label: 'Period', def: 20 }],
    compute: (c, p) => crossSignals(c, c.map(x => x.close), sma(c.map(x => x.close), p.period)) },
  PRICE_EMA: { name: 'Price EMA Cross', params: [{ k: 'period', label: 'Period', def: 20 }],
    compute: (c, p) => crossSignals(c, c.map(x => x.close), ema(c.map(x => x.close), p.period)) },
  PSAR: { name: 'PSAR Flip', params: [{ k: 'accel', label: 'Accel', def: 2 }, { k: 'maxAccel', label: 'Max', def: 20 }],
    compute: (c, p) => { const af = p.accel / 100, max = p.maxAccel / 100; let sar = c[0].low, ep = c[0].high, a = af, rising = true; const signals = []; c.forEach((x, i) => { if (i === 0) return; sar = sar + a * (ep - sar); const prevRising = rising; if (rising && x.low < sar) { rising = false; sar = ep; ep = x.low; a = af; if (prevRising !== rising) signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); } else if (!rising && x.high > sar) { rising = true; sar = ep; ep = x.high; a = af; if (prevRising !== rising) signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); } else { if (rising && x.high > ep) { ep = x.high; a = Math.min(max, a + af); } else if (!rising && x.low < ep) { ep = x.low; a = Math.min(max, a + af); } } }); return signals; } },
  DONCHIAN: { name: 'Donchian Breakout', params: [{ k: 'period', label: 'Period', def: 20 }],
    compute: (c, p) => { const signals = []; c.forEach((x, i) => { if (i < p.period) return; const hi = Math.max(...c.slice(i - p.period + 1, i + 1).map(y => y.high)), lo = Math.min(...c.slice(i - p.period + 1, i + 1).map(y => y.low)); if (x.close >= hi && c[i - 1].close < hi) signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); if (x.close <= lo && c[i - 1].close > lo) signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); }); return signals; } },
  KELTNER: { name: 'Keltner Breakout', params: [{ k: 'period', label: 'Period', def: 20 }, { k: 'mult', label: 'Multiplier', def: 2 }],
    compute: (c, p) => { const mid = ema(c.map(x => x.close), p.period), atr = sma(trueRange(c), p.period), upper = mid.map((v, i) => v == null ? null : v + p.mult * atr[i]), lower = mid.map((v, i) => v == null ? null : v - p.mult * atr[i]); const signals = []; c.forEach((x, i) => { if (upper[i] == null) return; if (i && x.close >= upper[i] && c[i - 1].close < upper[i]) signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); if (i && x.close <= lower[i] && c[i - 1].close > lower[i]) signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); }); return signals; } },
  RSI_MA: { name: 'RSI + MA Confirmation', params: [{ k: 'rsiPeriod', label: 'RSI Period', def: 14 }, { k: 'maPeriod', label: 'MA Period', def: 50 }],
    compute: (c, p) => { const r = rsi(c.map(x => x.close), p.rsiPeriod), ma = ema(c.map(x => x.close), p.maPeriod); let inPosition = false; const signals = []; c.forEach((x, i) => { if (r[i] == null || ma[i] == null) return; if (!inPosition && r[i] > 50 && x.close > ma[i]) { inPosition = true; signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); } else if (inPosition && (r[i] < 50 || x.close < ma[i])) { inPosition = false; signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); } }); return signals; } },
  MACD_RSI: { name: 'MACD + RSI Combo', params: [{ k: 'rsiPeriod', label: 'RSI Period', def: 14 }, { k: 'rsiMin', label: 'RSI Min', def: 50 }],
    compute: (c, p) => { const r = rsi(c.map(x => x.close), p.rsiPeriod), f = ema(c.map(x => x.close), 12), sl = ema(c.map(x => x.close), 26), macd = c.map((_, i) => f[i] == null || sl[i] == null ? null : f[i] - sl[i]), sg = ema(macd.map(x => x ?? 0), 9); let inPosition = false; const signals = []; c.forEach((x, i) => { if (macd[i] == null || sg[i] == null || r[i] == null) return; if (!inPosition && macd[i] > sg[i] && r[i] > p.rsiMin) { inPosition = true; signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); } else if (inPosition && (macd[i] < sg[i] || r[i] < p.rsiMin)) { inPosition = false; signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); } }); return signals; } },
  VOLUME: { name: 'Volume Breakout', params: [{ k: 'period', label: 'MA Period', def: 20 }, { k: 'volMult', label: 'Volume Mult', def: 1.5 }],
    compute: (c, p) => { const avgVol = sma(c.map(x => x.volume), p.period); const signals = []; c.forEach((x, i) => { if (avgVol[i] == null || i === 0) return; if (x.close > c[i - 1].close && x.volume > avgVol[i] * p.volMult && c[i - 1].close <= sma(c.map(y => y.close), p.period)[i - 1]) signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); if (x.close < c[i - 1].close && x.volume > avgVol[i] * p.volMult && c[i - 1].close >= sma(c.map(y => y.close), p.period)[i - 1]) signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); }); return signals; } },
  STOCHASTIC: { name: 'Stochastic Cross', params: [{ k: 'k', label: '%K', def: 14 }, { k: 'd', label: '%D', def: 3 }, { k: 'ob', label: 'Overbought', def: 80 }, { k: 'os', label: 'Oversold', def: 20 }],
    compute: (c, p) => { const s = stoch(c, p.k, p.d); let inPos = false; const signals = []; c.forEach((x, i) => { if (s.k[i] == null || s.d[i] == null) return; if (!inPos && s.k[i] < p.os && s.d[i] < p.os && s.k[i] > s.d[i] && (i && s.k[i - 1] <= s.d[i - 1])) { inPos = true; signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); } else if (inPos && (s.k[i] > p.ob || s.k[i] < s.d[i])) { inPos = false; signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); } }); return signals; } },
  ADX: { name: 'ADX Trend', params: [{ k: 'period', label: 'Period', def: 14 }, { k: 'minAdx', label: 'Min ADX', def: 25 }],
    compute: (c, p) => { const a = adxValues(c, p.period); let inPos = false; const signals = []; c.forEach((x, i) => { if (a.adx[i] == null || a.dip[i] == null || a.din[i] == null) return; if (!inPos && a.adx[i] > p.minAdx && a.dip[i] > a.din[i]) { inPos = true; signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); } else if (inPos && (a.dip[i] < a.din[i])) { inPos = false; signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); } }); return signals; } },
  ICHIMOKU: { name: 'Ichimoku Cross', params: [{ k: 'conv', label: 'Conversion', def: 9 }, { k: 'base', label: 'Base', def: 26 }],
    compute: (c, p) => { const conv = c.map((_, i) => i < p.conv - 1 ? null : (Math.max(...c.slice(i - p.conv + 1, i + 1).map(y => y.high)) + Math.min(...c.slice(i - p.conv + 1, i + 1).map(y => y.low))) / 2), base = c.map((_, i) => i < p.base - 1 ? null : (Math.max(...c.slice(i - p.base + 1, i + 1).map(y => y.high)) + Math.min(...c.slice(i - p.base + 1, i + 1).map(y => y.low))) / 2); return crossSignals(c, conv, base); } },
  VWAP: { name: 'VWAP Cross', params: [{ k: 'period', label: 'Period', def: 20 }],
    compute: (c, p) => { let cumV = 0, cumPV = 0; const vwap = c.map((x, i) => { cumPV += (x.high + x.low + x.close) / 3 * (x.volume || 1); cumV += x.volume || 1; if (i < p.period - 1) return null; const sliceCumV = cumV, sliceCumPV = cumPV; if (i >= p.period) { for (let j = i - p.period; j >= 0 && j < i - p.period + 1; j++) { sliceCumPV -= (c[j].high + c[j].low + c[j].close) / 3 * (c[j].volume || 1); sliceCumV -= c[j].volume || 1; } } return sliceCumPV / (sliceCumV || 1); }); return crossSignals(c, c.map(x => x.close), vwap); } },
  CCI: { name: 'CCI Reversal', params: [{ k: 'period', label: 'Period', def: 20 }, { k: 'ob', label: 'Overbought', def: 100 }, { k: 'os', label: 'Oversold', def: -100 }],
    compute: (c, p) => { const values = cci(c, p.period); const signals = []; values.forEach((v, i) => { if (v == null) return; if (v < p.os && (i === 0 || values[i - 1] != null && values[i - 1] >= p.os)) signals.push({ type: 'buy', index: i, time: c[i].time, price: c[i].close }); if (v > p.ob && (i === 0 || values[i - 1] != null && values[i - 1] <= p.ob)) signals.push({ type: 'sell', index: i, time: c[i].time, price: c[i].close }); }); return signals; } },
  WILLIAMS_R: { name: "Williams %R", params: [{ k: 'period', label: 'Period', def: 14 }, { k: 'ob', label: 'Overbought', def: -20 }, { k: 'os', label: 'Oversold', def: -80 }],
    compute: (c, p) => { const w = williamsR(c, p.period); const signals = []; w.forEach((v, i) => { if (v == null) return; if (v < p.os && (i === 0 || w[i - 1] != null && w[i - 1] >= p.os)) signals.push({ type: 'buy', index: i, time: c[i].time, price: c[i].close }); if (v > p.ob && (i === 0 || w[i - 1] != null && w[i - 1] <= p.ob)) signals.push({ type: 'sell', index: i, time: c[i].time, price: c[i].close }); }); return signals; } },
  MFI: { name: 'MFI Strategy', params: [{ k: 'period', label: 'Period', def: 14 }, { k: 'ob', label: 'Overbought', def: 80 }, { k: 'os', label: 'Oversold', def: 20 }],
    compute: (c, p) => { const values = mfi(c, p.period); const signals = []; values.forEach((v, i) => { if (v == null) return; if (v < p.os && (i === 0 || values[i - 1] != null && values[i - 1] >= p.os)) signals.push({ type: 'buy', index: i, time: c[i].time, price: c[i].close }); if (v > p.ob && (i === 0 || values[i - 1] != null && values[i - 1] <= p.ob)) signals.push({ type: 'sell', index: i, time: c[i].time, price: c[i].close }); }); return signals; } },
  ENGULFING: { name: 'Engulfing Pattern', params: [],
    compute: (c, p) => { const signals = []; c.forEach((x, i) => { if (i === 0) return; const prev = c[i - 1]; if (x.close > x.open && x.open < prev.close && x.close > prev.open && x.close > prev.close) signals.push({ type: 'buy', index: i, time: x.time, price: x.close }); if (x.close < x.open && x.open > prev.close && x.close < prev.open && x.close < prev.close) signals.push({ type: 'sell', index: i, time: x.time, price: x.close }); }); return signals; } },
};

function initChart() {
  const t = CHART_THEMES[currentTheme()];
  chart = LightweightCharts.createChart($('#chart'), {
    width: $('#chart').clientWidth, height: $('#chart').clientHeight,
    layout: { background: { color: t.bg }, textColor: t.text, fontFamily: "'DM Mono', monospace" },
    grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
    rightPriceScale: { borderColor: t.border },
    timeScale: { borderColor: t.border, timeVisible: true, minBarSpacing: 0.01, tickMarkFormatter: t => {
      const d = new Date(t * 1000), opts = { timeZone: 'Asia/Kolkata', hour12: false, day: '2-digit', month: 'short', year: 'numeric' };
      if (interval !== '1d') { opts.hour = '2-digit'; opts.minute = '2-digit'; }
      return d.toLocaleString('en-IN', opts);
    } },
    crosshair: { vertLine: { color: t.crosshair }, horzLine: { color: t.crosshair } },
    localization: { timeFormatter: t => {
      const d = new Date(t * 1000), opts = { timeZone: 'Asia/Kolkata', hour12: false, day: '2-digit', month: 'short', year: 'numeric' };
      if (interval !== '1d') { opts.hour = '2-digit'; opts.minute = '2-digit'; }
      return d.toLocaleString('en-IN', opts);
    } }
  });
  window.addEventListener('resize', () => chart.applyOptions({ width: $('#chart').clientWidth, height: $('#chart').clientHeight }));
  chart.subscribeCrosshairMove(param => {
    if (!param.time) { updateQuote(); return; }
    const idx = candleIndexAt(param.time);
    if (idx >= 0) showHoverQuote(idx);
  });
  setSeries();
}
function setSeries() {
  if (mainSeries) chart.removeSeries(mainSeries);
  const config = chartType === 'line' ? { color: lineColor(), lineWidth: 2 }
    : chartType === 'bar' ? { upColor: '#55c99d', downColor: '#e66e70', openVisible: true }
    : { upColor: '#55c99d', downColor: '#e66e70', borderUpColor: '#55c99d', borderDownColor: '#e66e70', wickUpColor: '#55c99d', wickDownColor: '#e66e70' };
  mainSeries = chartType === 'line' ? chart.addSeries(LightweightCharts.LineSeries, config) : chartType === 'bar' ? chart.addSeries(LightweightCharts.BarSeries, config) : chart.addSeries(LightweightCharts.CandlestickSeries, config);
  mainMarkers = null;
  attachDrawings();
  render();
}
function pointData(values) { return values.map((value, i) => value == null || !Number.isFinite(value) ? null : ({ time: candles[i].time / 1000, value })).filter(Boolean); }
function signedHistogramData(values) { return values.map((value, i) => value == null || !Number.isFinite(value) ? null : ({ time: candles[i].time / 1000, value, color: value >= 0 ? '#55c99d' : '#e66e70' })).filter(Boolean); }
function addLine(name, values, color, options = {}, pane = 0) {
  const series = chart.addSeries(LightweightCharts.LineSeries, { color, lineWidth: 1.5, lastValueVisible: false, priceLineVisible: false, title: name, ...options }, pane);
  series.setData(pointData(values)); chart._indicators.push(series); return series;
}
function addSignedHistogram(name, values, pane = 0) {
  const series = chart.addSeries(LightweightCharts.HistogramSeries, { lastValueVisible: false, priceLineVisible: false, title: name }, pane);
  series.setData(signedHistogramData(values)); chart._indicators.push(series); return series;
}
function setMainMarkers(markers) {
  if (!chart || !mainSeries) return;
  if (!mainMarkers) mainMarkers = LightweightCharts.createSeriesMarkers(mainSeries, []);
  mainMarkers.setMarkers(markers || []);
}
/* ---- Annotations & drawings ---- */
const PATTERN_INFO = {
  rectangle: { name: 'Rectangle', points: 2 }, triangle: { name: 'Symmetrical Triangle', points: 3 }, ascTri: { name: 'Ascending Triangle', points: 3 }, descTri: { name: 'Descending Triangle', points: 3 },
  risingWedge: { name: 'Rising Wedge', points: 4 }, fallingWedge: { name: 'Falling Wedge', points: 4 },
  bullFlag: { name: 'Bullish Flag', points: 4 }, bearFlag: { name: 'Bearish Flag', points: 4 },
  bullPennant: { name: 'Bullish Pennant', points: 4 }, bearPennant: { name: 'Bearish Pennant', points: 4 },
  headShoulders: { name: 'Head & Shoulders', points: 4 }, invHeadShoulders: { name: 'Inverse Head & Shoulders', points: 4 },
  doubleTop: { name: 'Double Top', points: 3 }, doubleBottom: { name: 'Double Bottom', points: 3 },
  tripleTop: { name: 'Triple Top', points: 4 }, tripleBottom: { name: 'Triple Bottom', points: 4 },
  cupHandle: { name: 'Cup & Handle', points: 3 }
};
const DRAW_TOOL_POINTS = { trendline: 2, fib: 2, channel: 3, ray: 2, measure: 2, area: 2 };
Object.keys(PATTERN_INFO).forEach(k => DRAW_TOOL_POINTS[k] = PATTERN_INFO[k].points);
const DRAW_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
function drawingCoord(d, time, price) {
  const ctx = d._ctx;
  if (!ctx) return null;
  const x = ctx.chart.timeScale().timeToCoordinate(time);
  const y = ctx.series.priceToCoordinate(price);
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
function drawingPoints(d) { return d.cursor ? d.points.concat(d.cursor) : d.points; }
function pointCoord(d, p, index) { const c = drawingCoord(d, p.time, p.price); return c ? { x: c.x, y: c.y, index } : { x: null, y: null, index }; }
function drawingHandlePoints(d) {
  const pts = drawingPoints(d);
  const out = [];
  if (d.type === 'trendline' || d.type === 'fib') { if (pts[0]) out.push(pointCoord(d, pts[0], 0)); if (pts[1]) out.push(pointCoord(d, pts[1], 1)); }
  else if (d.type === 'channel') { for (let i = 0; i < 3; i++) if (pts[i]) out.push(pointCoord(d, pts[i], i)); }
  else if (d.type === 'text') { if (pts[0]) out.push(pointCoord(d, pts[0], 0)); }
  else if (d.type === 'ray' || d.type === 'measure' || d.type === 'area') { if (pts[0]) out.push(pointCoord(d, pts[0], 0)); if (pts[1]) out.push(pointCoord(d, pts[1], 1)); }
  else if (d.type === 'arrowUp' || d.type === 'arrowDown' || d.type === 'target') { if (pts[0]) out.push(pointCoord(d, pts[0], 0)); }
  else if (PATTERN_INFO[d.type]) { for (let i = 0; i < pts.length; i++) if (pts[i]) out.push(pointCoord(d, pts[i], i)); }
  return out.filter(c => c.x != null && c.y != null);
}
function requestDrawingUpdate(d) { try { if (d && d._ctx && d._ctx.requestUpdate) d._ctx.requestUpdate(); } catch (err) { } }
function refreshDrawings() { drawings.forEach(requestDrawingUpdate); if (drawingDraft) requestDrawingUpdate(drawingDraft); }
function drawingPrimitive(d) {
  const view = {
    zOrder: () => 'top',
    renderer: () => ({ draw: target => { try { drawDrawingShape(d, target); } catch (err) { } } })
  };
  return {
    attached(param) { d._ctx = { chart: param.chart, series: param.series, requestUpdate: param.requestUpdate }; },
    detached() { d._ctx = null; },
    updateAllViews() { },
    paneViews() { return [view]; }
  };
}
function drawDrawingShape(d, target) {
  if (!d._ctx) return;
  const pts = drawingPoints(d);
  if (!pts.length) return;
  const sel = selectedDrawing && selectedDrawing.id === d.id;
  target.useMediaCoordinateSpace(({ context, mediaSize }) => {
    const ctx = context, w = mediaSize.width, h = mediaSize.height;
    const to = p => p && drawingCoord(d, p.time, p.price);
    const strokeLine = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    const handle = p => { const c = to(p); if (!c) return; ctx.beginPath(); ctx.arc(c.x, c.y, sel ? 5 : 4, 0, Math.PI * 2); ctx.fillStyle = d.color; ctx.fill(); ctx.strokeStyle = sel ? '#ffffff' : 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.4; ctx.stroke(); };
    const label = (text, x, y, align) => { ctx.font = '10px "DM Mono", monospace'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; const tw = ctx.measureText(text).width; let bx; if (align === 'right') bx = x - tw - 8; else if (align === 'center') bx = x - tw / 2 - 5; else bx = x; ctx.fillStyle = 'rgba(12,16,20,.75)'; ctx.fillRect(bx, y - 9, tw + 10, 18); ctx.fillStyle = d.color; ctx.fillText(text, align === 'right' ? x - 5 : align === 'center' ? x : x + 5, y); };
    ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.lineWidth = sel ? 2 : 1.4;
    if (d.type === 'trendline') {
      const a = to(pts[0]), b = to(pts[1]);
      if (a && b) { strokeLine(a, b); handle(pts[0]); handle(pts[1]); }
      else if (a) handle(pts[0]);
    } else if (d.type === 'horizline') {
      const y = d._ctx.series.priceToCoordinate(pts[0].price);
      if (y == null) return;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      if (sel) { ctx.beginPath(); ctx.arc(w - 8, y, 4, 0, Math.PI * 2); ctx.fill(); }
      label(String(Number(pts[0].price).toFixed(2)), w, y, 'right');
    } else if (d.type === 'vertline') {
      const x = d._ctx.chart.timeScale().timeToCoordinate(pts[0].time);
      if (x == null) return;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      if (sel) { ctx.beginPath(); ctx.arc(x, 10, 4, 0, Math.PI * 2); ctx.fill(); }
      label(new Date(pts[0].time * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), x, 12, 'left');
    } else if (d.type === 'fib') {
      const a = to(pts[0]), b = to(pts[1]);
      if (!a || !b) return;
      const from = pts[0].price, span = pts[1].price - from;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(a.x, 0); ctx.lineTo(a.x, h); ctx.moveTo(b.x, 0); ctx.lineTo(b.x, h); ctx.stroke();
      ctx.setLineDash([]);
      DRAW_FIB_LEVELS.forEach(lv => {
        const price = from + span * lv;
        const c = d._ctx.series.priceToCoordinate(price);
        if (c == null) return;
        ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(w, c); ctx.stroke();
        label(`${(lv * 100).toFixed(1)}%  ${Number(price).toFixed(2)}`, w, c, 'right');
      });
      handle(pts[0]); handle(pts[1]);
    } else if (d.type === 'channel') {
      const a = to(pts[0]), b = to(pts[1]), c = to(pts[2]);
      if (a && b) {
        strokeLine(a, b);
        const dx = pts[1].time - pts[0].time, dp = pts[1].price - pts[0].price;
        const cpt = pts[2] || { time: pts[0].time, price: pts[0].price };
        const cCoord = c || to(cpt);
        const end = to({ time: cpt.time + dx, price: cpt.price + dp });
        if (cCoord && end) strokeLine(cCoord, end);
      }
      if (a) handle(pts[0]);
      if (b) handle(pts[1]);
      if (pts[2]) handle(pts[2]);
    } else if (d.type === 'text') {
      const a = to(pts[0]);
      if (!a) return;
      const text = String(d.text || '');
      ctx.font = '11px Manrope, sans-serif';
      const lines = text.split('\n'), lh = 16;
      const tw = Math.max(1, ...lines.map(l => ctx.measureText(l).width));
      const bx = a.x + 8, by = a.y - 12, bw = tw + 14, bh = lines.length * lh + 10;
      ctx.fillStyle = 'rgba(12,16,20,.8)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = d.color; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = d.color; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      lines.forEach((ln, i) => ctx.fillText(ln, bx + 7, by + 6 + i * lh));
      handle(pts[0]);
    } else if (d.type === 'arrowUp' || d.type === 'arrowDown') {
      const c = to(pts[0]);
      if (!c) return;
      const dir = d.type === 'arrowUp' ? -1 : 1, len = 16;
      ctx.strokeStyle = d.color; ctx.fillStyle = d.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c.x, c.y + dir * len); ctx.lineTo(c.x, c.y - dir * len); ctx.stroke();
      const headY = c.y - dir * len, wingY = headY + (dir === -1 ? 7 : -7);
      ctx.beginPath(); ctx.moveTo(c.x, headY); ctx.lineTo(c.x - 5, wingY); ctx.lineTo(c.x + 5, wingY); ctx.closePath(); ctx.fill();
      ctx.lineCap = 'butt';
      handle(pts[0]);
    } else if (d.type === 'target') {
      const c = to(pts[0]);
      if (!c) return;
      ctx.strokeStyle = d.color; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = d.color; ctx.fill();
      ctx.beginPath(); ctx.moveTo(c.x - 13, c.y); ctx.lineTo(c.x + 13, c.y); ctx.moveTo(c.x, c.y - 13); ctx.lineTo(c.x, c.y + 13); ctx.stroke();
      label(String(Number(pts[0].price).toFixed(2)), c.x + 14, c.y, 'left');
      handle(pts[0]);
    } else if (d.type === 'ray') {
      const a = to(pts[0]), b = to(pts[1]);
      if (!a || !b) return;
      const t0 = pts[0].time, t1 = pts[1].time;
      const tEnd = d._ctx.chart.timeScale().coordinateToTime(w);
      if (tEnd == null || t1 === t0) return;
      const pEnd = pts[1].price + (pts[1].price - pts[0].price) * ((tEnd - t1) / (t1 - t0));
      const end = drawingCoord(d, tEnd, pEnd);
      if (end) strokeLine(a, end);
      handle(pts[0]); handle(pts[1]);
    } else if (d.type === 'measure') {
      const a = to(pts[0]), b = to(pts[1]);
      if (!a || !b) return;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, b.y); ctx.moveTo(b.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI * 2); ctx.fillStyle = d.color; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fillStyle = d.color; ctx.fill();
      const dp = pts[1].price - pts[0].price, dt = Math.abs(Math.round((pts[1].time - pts[0].time) / 86400));
      label(`${dp >= 0 ? '+' : ''}${Number(dp).toFixed(2)}  -  ${dt}d`, (a.x + b.x) / 2, Math.min(a.y, b.y) - 12, 'center');
      handle(pts[0]); handle(pts[1]);
    } else if (d.type === 'area') {
      const a = to(pts[0]), b = to(pts[1]);
      if (!a || !b) return;
      const t0 = Math.min(pts[0].time, pts[1].time), t1 = Math.max(pts[0].time, pts[1].time);
      const p0 = Math.min(pts[0].price, pts[1].price), p1 = Math.max(pts[0].price, pts[1].price);
      const tl = drawingCoord(d, t0, p1), br = drawingCoord(d, t1, p0);
      if (!tl || !br) return;
      ctx.globalAlpha = 0.18; ctx.fillStyle = d.color;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.globalAlpha = 1; ctx.lineWidth = 1.2;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      handle(pts[0]); handle(pts[1]);
    } else if (PATTERN_INFO[d.type]) {
      renderPatternShape(d, ctx, w, h, { to, handle, label, sel });
    }
  });
}
function drawingBodyHit(d, pt) {
  const pts = drawingPoints(d);
  const to = p => p && drawingCoord(d, p.time, p.price);
  const distToSegment = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
  };
  if (d.type === 'trendline') { const a = to(pts[0]), b = to(pts[1]); return !!(a && b && distToSegment(a, b) < 6); }
  if (d.type === 'channel') {
    const a = to(pts[0]), b = to(pts[1]), c = to(pts[2]);
    if (a && b && distToSegment(a, b) < 6) return true;
    if (a && b && c) { const dx = pts[1].time - pts[0].time, dp = pts[1].price - pts[0].price; const end = to({ time: pts[2].time + dx, price: pts[2].price + dp }); return !!(end && distToSegment(c, end) < 6); }
    return false;
  }
  if (d.type === 'horizline') { const y = d._ctx && d._ctx.series.priceToCoordinate(pts[0].price); return y != null && Math.abs(pt.y - y) < 6; }
  if (d.type === 'vertline') { const x = d._ctx && d._ctx.chart.timeScale().timeToCoordinate(pts[0].time); return x != null && Math.abs(pt.x - x) < 6; }
  if (d.type === 'fib') {
    const a = to(pts[0]), b = to(pts[1]);
    if (!a || !b || !d._ctx) return false;
    const from = pts[0].price, span = pts[1].price - from;
    return DRAW_FIB_LEVELS.some(lv => { const c = d._ctx.series.priceToCoordinate(from + span * lv); return c != null && Math.abs(pt.y - c) < 6; });
  }
  if (d.type === 'text') {
    const a = to(pts[0]);
    if (!a) return false;
    const text = String(d.text || '');
    const tw = Math.max(10, Math.max(...text.split('\n').map(l => l.length)) * 6.6);
    const th = text.split('\n').length * 16 + 10;
    return pt.x >= a.x + 8 - 4 && pt.x <= a.x + 8 + tw + 4 && pt.y >= a.y - 12 - 4 && pt.y <= a.y - 12 + th + 4;
  }
  if (d.type === 'arrowUp' || d.type === 'arrowDown' || d.type === 'target') {
    const c = to(pts[0]);
    return !!(c && Math.hypot(pt.x - c.x, pt.y - c.y) < 14);
  }
  if (d.type === 'ray') {
    const a = to(pts[0]), b = to(pts[1]);
    if (!a || !b) return false;
    const span = pts[1].time - pts[0].time || 86400;
    const end = drawingCoord(d, pts[1].time + span * 10, pts[1].price + (pts[1].price - pts[0].price) * 10);
    return !!(end && distToSegment(a, end) < 6);
  }
  if (d.type === 'measure') {
    const a = to(pts[0]), b = to(pts[1]);
    return !!(a && b && distToSegment(a, b) < 6);
  }
  if (d.type === 'area') {
    const a = to(pts[0]), b = to(pts[1]);
    if (!a || !b) return false;
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    return pt.x >= x0 - 4 && pt.x <= x1 + 4 && pt.y >= y0 - 4 && pt.y <= y1 + 4;
  }
  if (PATTERN_INFO[d.type]) {
    const g = patternGeometry(d);
    return g.segments.some(seg => { const a = to(seg.a), b = to(seg.b); return !!(a && b && distToSegment(a, b) < 6); });
  }
  return false;
}
function hitTestDrawing(pt) {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    const handles = drawingHandlePoints(d);
    for (let hi = 0; hi < handles.length; hi++) {
      if (Math.hypot(pt.x - handles[hi].x, pt.y - handles[hi].y) < 9) return { drawing: d, handle: handles[hi].index };
    }
    if (drawingBodyHit(d, pt)) return { drawing: d, handle: 0 };
  }
  return null;
}
function attachPrimitiveTo(d) {
  if (!mainSeries) return;
  if (d._primitive) { try { mainSeries.detachPrimitive(d._primitive); } catch (err) { } }
  d._primitive = drawingPrimitive(d);
  mainSeries.attachPrimitive(d._primitive);
}
function attachDrawings() { drawings.forEach(attachPrimitiveTo); }
function addDrawing(partial) {
  const drawing = Object.assign({ id: ++drawingSeq, color: drawColor }, partial);
  drawings.push(drawing);
  attachPrimitiveTo(drawing);
  requestDrawingUpdate(drawing);
  saveDrawings();
  return drawing;
}
function removeDrawing(drawing) {
  try { if (drawing._primitive && mainSeries) mainSeries.detachPrimitive(drawing._primitive); } catch (err) { }
  drawings = drawings.filter(x => x.id !== drawing.id);
  if (selectedDrawing && selectedDrawing.id === drawing.id) selectedDrawing = null;
  saveDrawings(); updateDrawingToolbar(); refreshDrawings();
}
function clearAllDrawings() {
  drawings.forEach(d => { try { if (d._primitive && mainSeries) mainSeries.detachPrimitive(d._primitive); } catch (err) { } });
  drawings = []; drawingDraft = null; selectedDrawing = null;
  saveDrawings(); updateDrawingToolbar(); refreshDrawings();
}
function cancelDraft() {
  if (!drawingDraft) return;
  try { if (drawingDraft._primitive && mainSeries) mainSeries.detachPrimitive(drawingDraft._primitive); } catch (err) { }
  drawingDraft = null;
}
function finalizeDraft(points) {
  const draft = drawingDraft;
  cancelDraft();
  addDrawing({ type: draft.type, points });
}
function saveDrawings() {
  try { localStorage.setItem('prism.drawings', JSON.stringify(drawings.map(d => ({ id: d.id, type: d.type, color: d.color, points: d.points, text: d.text })))); } catch (err) { }
}
function restoreDrawings() {
  try {
    const saved = JSON.parse(localStorage.getItem('prism.drawings') || '[]');
    drawings = (Array.isArray(saved) ? saved : []).map(d => ({ id: ++drawingSeq, type: d.type, color: d.color || drawColor, points: (d.points || []).filter(p => p && Number.isFinite(p.time) && Number.isFinite(p.price)), text: d.text })).filter(d => d.points.length);
  } catch (err) { drawings = []; }
  attachDrawings();
  updateDrawingToolbar();
}
function chartPointFromEvent(e) {
  const rect = $('#chart').getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const time = chart && chart.timeScale().coordinateToTime(x);
  const price = mainSeries && mainSeries.coordinateToPrice(y);
  return { x, y, time, price };
}
function onChartMouseDown(e) {
  if (e.button !== 0) return;
  const pt = chartPointFromEvent(e);
  if (pt.time == null || pt.price == null) return;
  if (drawMode !== 'select') {
    e.preventDefault(); e.stopImmediatePropagation();
    const need = DRAW_TOOL_POINTS[drawMode];
    if (need) {
      if (!drawingDraft) { drawingDraft = { type: drawMode, color: drawColor, points: [], cursor: pt }; attachPrimitiveTo(drawingDraft); }
      drawingDraft.points.push({ time: pt.time, price: pt.price });
      drawingDraft.cursor = { time: pt.time, price: pt.price };
      requestDrawingUpdate(drawingDraft);
      if (drawingDraft.points.length >= need) finalizeDraft(drawingDraft.points.slice(0, need));
    } else if (drawMode === 'text') {
      const text = window.prompt('Annotation text:', '');
      if (text != null && text.trim()) addDrawing({ type: 'text', points: [{ time: pt.time, price: pt.price }], text: text.trim() });
    } else {
      addDrawing({ type: drawMode, points: [{ time: pt.time, price: pt.price }] });
    }
  } else {
    const hit = hitTestDrawing(pt);
    if (hit) {
      e.preventDefault(); e.stopImmediatePropagation();
      selectedDrawing = hit.drawing;
      dragState = { id: hit.drawing.id, handle: hit.handle };
      updateDrawingToolbar(); refreshDrawings();
    } else {
      selectedDrawing = null;
      updateDrawingToolbar(); refreshDrawings();
    }
  }
}
function onChartMouseMove(e) {
  if (dragState) {
    e.preventDefault(); e.stopImmediatePropagation();
    const d = drawings.find(x => x.id === dragState.id);
    const pt = chartPointFromEvent(e);
    if (d && d.points[dragState.handle] && pt.time != null && pt.price != null) {
      d.points[dragState.handle].time = pt.time;
      d.points[dragState.handle].price = pt.price;
      requestDrawingUpdate(d); saveDrawings();
    }
  } else if (drawingDraft && DRAW_TOOL_POINTS[drawingDraft.type]) {
    const pt = chartPointFromEvent(e);
    if (pt.time != null && pt.price != null) { drawingDraft.cursor = { time: pt.time, price: pt.price }; requestDrawingUpdate(drawingDraft); }
  }
}
function onChartMouseUp() { dragState = null; }
function onChartDblClick(e) {
  const pt = chartPointFromEvent(e);
  if (pt.time == null || pt.price == null) return;
  const hit = hitTestDrawing(pt);
  if (hit && hit.drawing.type === 'text') {
    const text = window.prompt('Edit annotation:', hit.drawing.text);
    if (text != null) { hit.drawing.text = text.trim() || 'Note'; requestDrawingUpdate(hit.drawing); saveDrawings(); }
  }
}
function updateDrawingToolbar() {
  const del = $('#deleteDrawing');
  if (del) del.disabled = !selectedDrawing;
}
function updateDrawHint() {
  const hint = $('#drawHint');
  if (!hint) return;
  if (drawMode === 'select') hint.textContent = 'Select / edit: click a drawing, drag its handles, Del to delete';
  else if (PATTERN_INFO[drawMode]) hint.textContent = `${PATTERN_INFO[drawMode].name}: click ${PATTERN_INFO[drawMode].points} points`;
  else if (drawMode === 'text') hint.textContent = 'Text: click to place an annotation';
  else if (drawMode === 'arrowUp') hint.textContent = 'Up arrow: click a point';
  else if (drawMode === 'arrowDown') hint.textContent = 'Down arrow: click a point';
  else if (drawMode === 'target') hint.textContent = 'Price target: click a point';
  else if (drawMode === 'horizline' || drawMode === 'vertline') hint.textContent = `${drawMode === 'horizline' ? 'Horizontal' : 'Vertical'} line: click 1 point`;
  else hint.textContent = `${({ trendline: 'Trend line', fib: 'Fibonacci', channel: 'Channel', ray: 'Ray', measure: 'Measure', area: 'Area' })[drawMode] || 'Drawing'}: click ${DRAW_TOOL_POINTS[drawMode] || 2} points`;
}
function setupDrawingTools() {
  $$('.drawing-tools [data-tool]').forEach(btn => {
    btn.onclick = () => {
      drawMode = btn.dataset.tool;
      cancelDraft(); dragState = null;
      const ps = $('#patternTool');
      if (ps) ps.value = '';
      $$('.drawing-tools [data-tool]').forEach(b => b.classList.toggle('active', b === btn));
      updateDrawHint();
    };
  });
  const patternSelect = $('#patternTool');
  if (patternSelect) {
    patternSelect.onchange = () => {
      drawMode = patternSelect.value || 'select';
      cancelDraft(); dragState = null;
      $$('.drawing-tools [data-tool]').forEach(b => b.classList.remove('active'));
      updateDrawHint();
    };
  }
  const colorInput = $('#drawColor');
  if (colorInput) {
    colorInput.value = drawColor;
    colorInput.oninput = e => { drawColor = e.target.value; if (selectedDrawing) { selectedDrawing.color = drawColor; saveDrawings(); requestDrawingUpdate(selectedDrawing); } };
  }
  $('#deleteDrawing').onclick = () => { if (selectedDrawing) removeDrawing(selectedDrawing); };
  $('#clearDrawings').onclick = () => { clearAllDrawings(); };
  document.addEventListener('keydown', e => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (e.key === 'Delete' && selectedDrawing && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); removeDrawing(selectedDrawing); }
    if (e.key === 'Escape') { cancelDraft(); selectedDrawing = null; updateDrawingToolbar(); refreshDrawings(); }
  });
  const chartEl = $('#chart');
  chartEl.addEventListener('mousedown', onChartMouseDown, true);
  chartEl.addEventListener('mousemove', onChartMouseMove, true);
  document.addEventListener('mouseup', onChartMouseUp);
  chartEl.addEventListener('dblclick', onChartDblClick);
  updateDrawingToolbar();
  updateDrawHint();
}
function patternGeometry(d) {
  const pts = drawingPoints(d);
  const segments = [], markers = [], labels = [], arcs = [];
  const seg = (a, b, dashed = false) => { if (a && b) segments.push({ a, b, dashed }); };
  const P = i => pts[i];
  const empty = () => ({ segments, arcs, markers, labels });
  if (d.type === 'rectangle') {
    const a = P(0), b = P(1);
    if (!a || !b) return empty();
    const t0 = Math.min(a.time, b.time), t1 = Math.max(a.time, b.time);
    const p0 = Math.max(a.price, b.price), p1 = Math.min(a.price, b.price);
    seg({ time: t0, price: p0 }, { time: t1, price: p0 });
    seg({ time: t1, price: p0 }, { time: t1, price: p1 });
    seg({ time: t1, price: p1 }, { time: t0, price: p1 });
    seg({ time: t0, price: p1 }, { time: t0, price: p0 });
    labels.push({ p: { time: (t0 + t1) / 2, price: p0 }, text: 'Rectangle' });
  } else if (d.type === 'triangle' || d.type === 'ascTri' || d.type === 'descTri') {
    const a = P(0), b = P(1), c = P(2);
    if (!a || !b || !c) return empty();
    seg(a, b); seg(b, c); seg(c, a);
    labels.push({ p: { time: (a.time + b.time + c.time) / 3, price: (a.price + b.price + c.price) / 3 }, text: PATTERN_INFO[d.type].name });
  } else if (d.type === 'risingWedge' || d.type === 'fallingWedge' || d.type === 'bullFlag' || d.type === 'bearFlag' || d.type === 'bullPennant' || d.type === 'bearPennant') {
    const a = P(0), b = P(1), c = P(2), e = P(3);
    if (!a || !b || !c || !e) return empty();
    seg(a, b); seg(c, e); seg(a, c); seg(b, e);
    labels.push({ p: { time: (a.time + b.time) / 2, price: Math.max(a.price, b.price) }, text: PATTERN_INFO[d.type].name });
  } else if (d.type === 'headShoulders' || d.type === 'invHeadShoulders') {
    const a = P(0), b = P(1), c = P(2), n = P(3);
    if (!a || !b || !c || !n) return empty();
    markers.push({ p: a, text: 'LS' }, { p: b, text: 'HEAD' }, { p: c, text: 'RS' });
    const neck = n.price;
    seg({ time: a.time, price: neck }, { time: c.time, price: neck }, true);
    [a, b, c].forEach(p => seg({ time: p.time, price: p.price }, { time: p.time, price: neck }, true));
    labels.push({ p: { time: a.time, price: neck }, text: 'Neckline' });
  } else if (d.type === 'doubleTop' || d.type === 'doubleBottom') {
    const a = P(0), b = P(1), c = P(2);
    if (!a || !b || !c) return empty();
    markers.push({ p: a, text: '1' }, { p: c, text: '2' });
    seg({ time: a.time, price: b.price }, { time: c.time, price: b.price }, true);
    seg({ time: a.time, price: a.price }, { time: a.time, price: b.price }, true);
    seg({ time: c.time, price: c.price }, { time: c.time, price: b.price }, true);
    labels.push({ p: { time: a.time, price: b.price }, text: 'Neckline' });
  } else if (d.type === 'tripleTop' || d.type === 'tripleBottom') {
    const a = P(0), b = P(1), c = P(2), n = P(3);
    if (!a || !b || !c || !n) return empty();
    markers.push({ p: a, text: '1' }, { p: b, text: '2' }, { p: c, text: '3' });
    seg({ time: a.time, price: n.price }, { time: c.time, price: n.price }, true);
    [a, b, c].forEach(p => seg({ time: p.time, price: p.price }, { time: p.time, price: n.price }, true));
    labels.push({ p: { time: a.time, price: n.price }, text: 'Neckline' });
  } else if (d.type === 'cupHandle') {
    const a = P(0), b = P(1), c = P(2);
    if (!a || !b || !c) return empty();
    const control = { time: 2 * b.time - (a.time + c.time) / 2, price: 2 * b.price - (a.price + c.price) / 2 };
    const handleEnd = { time: c.time + (c.time - a.time) * 0.35, price: c.price + (b.price - c.price) * 0.3 };
    arcs.push({ a, control, b: c });
    seg(c, handleEnd);
    labels.push({ p: { time: b.time, price: b.price }, text: 'Cup' }, { p: handleEnd, text: 'Handle' });
  }
  return empty();
}
function renderPatternShape(d, ctx, w, h, H) {
  const g = patternGeometry(d);
  if (!g) return;
  const { to, handle, label, sel } = H;
  const solid = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
  const dashed = (a, b) => { ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); };
  g.segments.forEach(s => { const a = to(s.a), b = to(s.b); if (a && b) (s.dashed ? dashed : solid)(a, b); });
  (g.arcs || []).forEach(ar => { const a = to(ar.a), c = to(ar.control), b = to(ar.b); if (a && c && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y); ctx.stroke(); } });
  g.markers.forEach(m => {
    const c = to(m.p);
    if (!c) return;
    ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,20,.75)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = d.color; ctx.font = 'bold 10px "DM Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(m.text, c.x + 9, c.y - 5);
  });
  g.labels.forEach(l => { const c = to(l.p); if (c) label(l.text, c.x, c.y, l.align || 'left'); });
  if (sel) drawingPoints(d).forEach(p => { if (p) handle(p); });
}
function render(fit = true) {
  if (!candles.length) return;
  const data = chartType === 'line' ? candles.map(x => ({ time: x.time / 1000, value: x.close }))
    : candles.map(x => ({ time: x.time / 1000, open: x.open, high: x.high, low: x.low, close: x.close }));
  mainSeries.setData(data);
  if (candles.length > 20000) {
    if (fit) chart.timeScale().fitContent();
    setTimeout(() => {
      try { removeIndicators(); indicatorPane = 0; active.forEach((item, i) => drawIndicator(item.name, item.config?.color || COLORS[i % COLORS.length], item.config || { period: item.period || 14 })); layoutPanes(); } catch(e) {}
      if (inBacktestMode) { const run = backtestRuns.find(item => item.symbol === $('#backtestStockSelect').value) || backtestRuns[0]; if (run) backtestMarkers(run); }
    }, 50);
  } else {
    try { removeIndicators(); indicatorPane = 0; active.forEach((item, i) => drawIndicator(item.name, item.config?.color || COLORS[i % COLORS.length], item.config || { period: item.period || 14 })); layoutPanes(); } catch(e) {}
    if (inBacktestMode) { const run = backtestRuns.find(item => item.symbol === $('#backtestStockSelect').value) || backtestRuns[0]; if (run) backtestMarkers(run); }
    if (fit) chart.timeScale().fitContent();
  }
}
function sma(values, period) { return values.map((_, i) => i < period - 1 ? null : values.slice(i - period + 1, i + 1).reduce((sum, n) => sum + n, 0) / period); }
function ema(values, period) { const factor = 2 / (period + 1); let value; return values.map((n, i) => { value = i ? value + factor * (n - value) : n; return i < period - 1 ? null : value; }); }
function wma(values, period) { const divisor = period * (period + 1) / 2; return values.map((_, i) => i < period - 1 ? null : values.slice(i - period + 1, i + 1).reduce((sum, n, j) => sum + n * (j + 1), 0) / divisor); }
function rsi(values, period = 14) { const changes = values.map((v, i) => i ? v - values[i - 1] : 0); return changes.map((_, i) => { if (i < period) return null; const set = changes.slice(i - period + 1, i + 1); const gain = set.reduce((s, v) => s + Math.max(v, 0), 0) / period; const loss = set.reduce((s, v) => s + Math.max(-v, 0), 0) / period; return 100 - 100 / (1 + gain / (loss || .00001)); }); }
function trueRange(data) { const d = data || candles; return d.map((x, i) => i ? Math.max(x.high - x.low, Math.abs(x.high - d[i - 1].close), Math.abs(x.low - d[i - 1].close)) : x.high - x.low); }
function stoch(data, k, d) { const l = data.map(x => x.low), h = data.map(x => x.high), c = data.map(x => x.close), kv = data.map((_, i) => { if (i < k - 1) return null; const ll = Math.min(...l.slice(i - k + 1, i + 1)), hh = Math.max(...h.slice(i - k + 1, i + 1)); return hh === ll ? 50 : (c[i] - ll) / (hh - ll) * 100; }); return { k: kv, d: sma(kv, d) }; }
function adxValues(data, period) { const tr = trueRange(data), dp = data.map((x, i) => i && x.high - data[i - 1].high > data[i - 1].low - x.low ? Math.max(0, x.high - data[i - 1].high) : 0), dn = data.map((x, i) => i && data[i - 1].low - x.low > x.high - data[i - 1].high ? Math.max(0, data[i - 1].low - x.low) : 0), atr = sma(tr, period), dip = dp.map((v, i) => atr[i] ? v / atr[i] * 100 : null), din = dn.map((v, i) => atr[i] ? v / atr[i] * 100 : null), dx = dip.map((v, i) => v == null || din[i] == null || v + din[i] === 0 ? null : Math.abs(v - din[i]) / (v + din[i]) * 100); return { adx: sma(dx, period), dip, din }; }
function cci(data, period) { const tp = data.map(x => (x.high + x.low + x.close) / 3), ma = sma(tp, period); return tp.map((v, i) => { if (ma[i] == null) return null; const m = ma[i], dev = data.slice(i - period + 1, i + 1).reduce((s, x) => s + Math.abs((x.high + x.low + x.close) / 3 - m), 0) / period; return dev ? (v - m) / (.015 * dev) : 0; }); }
function mfi(data, period) { const tp = data.map(x => (x.high + x.low + x.close) / 3), vol = data.map(x => x.volume || 1), rmf = tp.map((v, i) => v * vol[i]); return tp.map((_, i) => { if (i < period) return null; const set = rmf.slice(i - period + 1, i + 1), ti = tp.slice(i - period + 1, i + 1); let pos = 0, neg = 0; for (let j = 1; j < period; j++) { if (ti[j] > ti[j - 1]) pos += set[j]; else neg += set[j]; } return neg ? 100 - 100 / (1 + pos / neg) : 100; }); }
function williamsR(data, period) { const l = data.map(x => x.low), h = data.map(x => x.high), c = data.map(x => x.close); return c.map((_, i) => { if (i < period - 1) return null; const ll = Math.min(...l.slice(i - period + 1, i + 1)), hh = Math.max(...h.slice(i - period + 1, i + 1)); return hh === ll ? -50 : (hh - c[i]) / (hh - ll) * -100; }); }
function oscillator(name, values, color, pane) { addLine(name, values, color, {}, pane); }
const BOTTOM_INDICATORS = new Set(['STDDEV', 'HV', 'RSI', 'MACD', 'PPO', 'STOCH', 'ROC', 'MOM', 'AO', 'AROOON', 'TRIX', 'DPO', 'CCI', 'WILLIAMS_R', 'ATR', 'OBV', 'MFI', 'CMF', 'ADL', 'ADOSC', 'FI', 'ADX', 'VORTEX']);
function drawIndicator(name, color, config = {}) {
  const pane = BOTTOM_INDICATORS.has(name) ? nextIndicatorPane() : 0;
  const period = Number(config.period) || 14, setting = (key, fallback) => Number(config[key] ?? fallback);
  const close = candles.map(x => x.close), high = candles.map(x => x.high), low = candles.map(x => x.low), volume = candles.map(x => x.volume), typical = candles.map(x => (x.high + x.low + x.close) / 3);
  if (name === 'SMA') addLine(`SMA ${period}`, sma(close, period), color);
  else if (name === 'EMA') addLine(`EMA ${period}`, ema(close, period), color);
  else if (name === 'WMA') addLine(`WMA ${period}`, wma(close, period), color);
  else if (name === 'DEMA') { const a = ema(close, period), b = ema(a.map(x => x ?? close[0]), period); addLine(`DEMA ${period}`, a.map((x, i) => x == null || b[i] == null ? null : 2 * x - b[i]), color); }
  else if (name === 'TEMA') { const a = ema(close, period), b = ema(a.map(x => x ?? close[0]), period), d = ema(b.map(x => x ?? close[0]), period); addLine(`TEMA ${period}`, a.map((x, i) => x == null || b[i] == null || d[i] == null ? null : 3 * x - 3 * b[i] + d[i]), color); }
  else if (name === 'HMA') { const half = wma(close, Math.max(2, Math.floor(period / 2))), full = wma(close, period), raw = close.map((_, i) => half[i] == null || full[i] == null ? 0 : 2 * half[i] - full[i]); addLine(`HMA ${period}`, wma(raw, Math.max(2, Math.floor(Math.sqrt(period)))), color); }
  else if (name === 'KAMA') { let value = close[0]; const values = close.map((v, i) => { if (i < period) return null; const change = Math.abs(v - close[i - period]); const volatility = close.slice(i - period + 1, i + 1).reduce((sum, x, j, a) => j ? sum + Math.abs(x - a[j - 1]) : sum, 0); const smooth = (change / (volatility || 1) * (.6667 - .0645) + .0645) ** 2; value += smooth * (v - value); return value; }); addLine(`KAMA ${period}`, values, color); }
  else if (name === 'BB') { const mid = sma(close, period), deviation = mid.map((m, i) => m == null ? null : Math.sqrt(close.slice(i - period + 1, i + 1).reduce((s, v) => s + (v - m) ** 2, 0) / period)), mult = setting('std', 2); addLine('BB Upper', mid.map((v, i) => v == null ? null : v + mult * deviation[i]), color); addLine('BB Mid', mid, '#81909d'); addLine('BB Lower', mid.map((v, i) => v == null ? null : v - mult * deviation[i]), color); }
  else if (name === 'KC') { const mid = ema(close, period), atr = sma(trueRange(), period); addLine('KC Upper', mid.map((v, i) => v == null || atr[i] == null ? null : v + 2 * atr[i]), color); addLine('KC Mid', mid, '#81909d'); addLine('KC Lower', mid.map((v, i) => v == null || atr[i] == null ? null : v - 2 * atr[i]), color); }
  else if (name === 'DC') { addLine('Donchian High', high.map((_, i) => i < period - 1 ? null : Math.max(...high.slice(i - period + 1, i + 1))), color); addLine('Donchian Low', low.map((_, i) => i < period - 1 ? null : Math.min(...low.slice(i - period + 1, i + 1))), color); }
  else if (name === 'ENVELOPE') { const mid = sma(close, period); addLine('Envelope High', mid.map(v => v == null ? null : v * 1.025), color); addLine('Envelope Low', mid.map(v => v == null ? null : v * .975), color); }
  else if (name === 'STDDEV') oscillator(`Std Dev ${period}`, sma(close, period).map((m, i) => m == null ? null : Math.sqrt(close.slice(i - period + 1, i + 1).reduce((s, v) => s + (v - m) ** 2, 0) / period)), color, pane);
  else if (name === 'HV') oscillator(`Historical Volatility ${period}`, close.map((_, i) => i < period ? null : Math.sqrt(close.slice(i - period + 1, i + 1).reduce((s, v, j, a) => j ? s + Math.log(v / a[j - 1]) ** 2 : s, 0) / period) * Math.sqrt(252) * 100), color, pane);
  else if (name === 'ICHIMOKU') { const midRange = n => high.map((_, i) => i < n - 1 ? null : (Math.max(...high.slice(i - n + 1, i + 1)) + Math.min(...low.slice(i - n + 1, i + 1))) / 2); const conversion = midRange(9), base = midRange(26); addLine('Ichimoku Conversion', conversion, color); addLine('Ichimoku Base', base, '#f1bd56'); addLine('Ichimoku Span A', conversion.map((v, i) => v == null || base[i] == null ? null : (v + base[i]) / 2), '#75b9ff'); addLine('Ichimoku Span B', midRange(52), '#b88cff'); }
  else if (name === 'VWAP') { let pv = 0, total = 0; addLine('VWAP', typical.map((v, i) => { pv += v * volume[i]; total += volume[i]; return pv / total; }), color); }
  else if (name === 'SAR') { let sar = low[0], ep = high[0], af = setting('accel', .02), rising = true; const baseAf = af, maxAf = setting('maxAccel', .2); const values = close.map((_, i) => { if (!i) return sar; sar = sar + af * (ep - sar); if (rising && low[i] < sar) { rising = false; sar = ep; ep = low[i]; af = baseAf; } else if (!rising && high[i] > sar) { rising = true; sar = ep; ep = high[i]; af = baseAf; } else if (rising && high[i] > ep) { ep = high[i]; af = Math.min(maxAf, af + baseAf); } else if (!rising && low[i] < ep) { ep = low[i]; af = Math.min(maxAf, af + baseAf); } return sar; }); addLine('Parabolic SAR', values, color, { lineWidth: 1 }); }
  else if (name === 'SUPERTREND') { const atr = sma(trueRange(), setting('atrPeriod', 10)), mult = setting('mult', 3); let upper, lower, trend = 1; const values = close.map((v, i) => { if (atr[i] == null) return null; const mid = (high[i] + low[i]) / 2, bu = mid + mult * atr[i], bl = mid - mult * atr[i]; upper = i && upper != null && close[i - 1] <= upper ? Math.min(bu, upper) : bu; lower = i && lower != null && close[i - 1] >= lower ? Math.max(bl, lower) : bl; if (v > upper) trend = 1; else if (v < lower) trend = -1; return trend === 1 ? lower : upper; }); addLine('Supertrend', values, color, { lineWidth: 2 }); }
  else if (name === 'RSI') oscillator(`RSI ${period}`, rsi(close, period), color, pane);
  else if (name === 'MACD') { const fast = ema(close, setting('fast', 12)), slow = ema(close, setting('slow', 26)), macd = close.map((_, i) => fast[i] == null || slow[i] == null ? null : fast[i] - slow[i]), signal = ema(macd.map(x => x ?? 0), setting('signal', 9)); addSignedHistogram('MACD Histogram', macd.map((v, i) => v == null || signal[i] == null ? null : v - signal[i]), pane); oscillator('MACD', macd, color, pane); oscillator('Signal', signal, '#f1bd56', pane); }
  else if (name === 'PPO') { const fast = ema(close, Math.max(2, Math.floor(period * .6))), slow = ema(close, period); oscillator('PPO', close.map((_, i) => fast[i] == null || slow[i] == null ? null : (fast[i] - slow[i]) / slow[i] * 100), color, pane); }
  else if (name === 'STOCH') { const s = stoch(candles, setting('k', 14), setting('d', 3)); addSignedHistogram('Stochastic Histogram', s.k.map((v, i) => v == null || s.d[i] == null ? null : v - s.d[i]), pane); oscillator('Stochastic %K', s.k, color, pane); oscillator('Stochastic %D', s.d, '#f1bd56', pane); }
  else if (name === 'ROC') oscillator(`ROC ${period}`, close.map((v, i) => i < period ? null : 100 * (v - close[i - period]) / close[i - period]), color, pane);
  else if (name === 'MOM') oscillator(`Momentum ${period}`, close.map((v, i) => i < period ? null : v - close[i - period]), color, pane);
  else if (name === 'AO') { const median = high.map((v, i) => (v + low[i]) / 2), fast = sma(median, 5), slow = sma(median, 34); addSignedHistogram('Awesome Oscillator', fast.map((v, i) => v == null || slow[i] == null ? null : v - slow[i]), pane); }
  else if (name === 'AROOON') oscillator(`Aroon ${period}`, high.map((_, i) => { if (i < period - 1) return null; const hs = high.slice(i - period + 1, i + 1), ls = low.slice(i - period + 1, i + 1); return 100 * (hs.lastIndexOf(Math.max(...hs)) - ls.lastIndexOf(Math.min(...ls))) / period; }), color, pane);
  else if (name === 'TRIX') { const a = ema(close, period), b = ema(a.map(x => x ?? close[0]), period), d = ema(b.map(x => x ?? close[0]), period); oscillator(`TRIX ${period}`, d.map((v, i) => i && v != null && d[i - 1] ? 100 * (v - d[i - 1]) / d[i - 1] : null), color, pane); }
  else if (name === 'DPO') { const avg = sma(close, period), shift = Math.floor(period / 2) + 1; oscillator(`DPO ${period}`, close.map((v, i) => i < period + shift - 1 ? null : v - avg[i - shift]), color, pane); }
  else if (name === 'CCI') oscillator(`CCI ${period}`, cci(candles, period), color, pane);
  else if (name === 'WILLIAMS_R') oscillator(`Williams %R ${period}`, williamsR(candles, period), color, pane);
  else if (name === 'ATR') oscillator(`ATR ${period}`, sma(trueRange(), period), color, pane);
  else if (name === 'OBV') { let obv = 0; oscillator('OBV', close.map((v, i) => { if (i) obv += v >= close[i - 1] ? volume[i] : -volume[i]; return obv; }), color, pane); }
  else if (name === 'MFI') oscillator(`MFI ${period}`, mfi(candles, period), color, pane);
  else if (name === 'CMF') { const flow = candles.map((x, i) => ((x.close - x.low) - (x.high - x.close)) / (x.high - x.low || 1) * volume[i]); oscillator(`CMF ${period}`, flow.map((_, i) => i < period - 1 ? null : flow.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / volume.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0)), color, pane); }
  else if (name === 'ADL') { let adl = 0; oscillator('Accumulation Distribution', candles.map((x, i) => adl += ((x.close - x.low) - (x.high - x.close)) / (x.high - x.low || 1) * volume[i]), color, pane); }
  else if (name === 'ADOSC') { let adl = 0; const line = candles.map((x, i) => adl += ((x.close - x.low) - (x.high - x.close)) / (x.high - x.low || 1) * volume[i]); const fast = ema(line, Math.max(2, Math.floor(period / 2))), slow = ema(line, period); addSignedHistogram('Chaikin Oscillator', line.map((_, i) => fast[i] == null || slow[i] == null ? null : fast[i] - slow[i]), pane); }
  else if (name === 'FI') oscillator(`Force Index ${period}`, ema(close.map((v, i) => i ? (v - close[i - 1]) * volume[i] : 0), period), color, pane);
  else if (name === 'ADX') oscillator(`ADX ${period}`, adxValues(candles, period).adx, color, pane);
  else if (name === 'VORTEX') { const tr = trueRange(), plus = candles.map((x, i) => i ? Math.abs(x.high - candles[i - 1].low) : 0), minus = candles.map((x, i) => i ? Math.abs(x.low - candles[i - 1].high) : 0); oscillator(`Vortex ${period}`, tr.map((_, i) => i < period ? null : (plus.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) - minus.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0)) / tr.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0)), color, pane); }
}
function removeIndicators() { (chart._indicators || []).forEach(series => chart.removeSeries(series)); chart._indicators = []; }
function nextIndicatorPane() { return ++indicatorPane; }
function layoutPanes() {
  const panes = chart.panes();
  if (!panes || panes.length < 2) return;
  const subs = panes.length - 1;
  panes[0].setStretchFactor(subs * 1.5);
  for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1);
}
function updateQuote() { const now = candles.at(-1), previous = candles.at(-2); if (!now || !previous) return; const pct = (now.close - previous.close) / previous.close * 100; $('#open').textContent = now.open.toFixed(2); $('#high').textContent = now.high.toFixed(2); $('#low').textContent = now.low.toFixed(2); $('#close').textContent = now.close.toFixed(2); $('#change').textContent = `${pct >= 0 ? 'UP +' : 'DOWN '}${pct.toFixed(2)}%`; $('#change').style.color = pct >= 0 ? '#5ed69d' : '#f27675'; }
function candleIndexAt(seconds) {
  let lo = 0, hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = Math.floor(candles[mid].time / 1000);
    if (t === seconds) return mid;
    if (t < seconds) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}
function showHoverQuote(idx) {
  const c = candles[idx], prev = candles[idx - 1];
  if (!c) return;
  $('#open').textContent = c.open.toFixed(2);
  $('#high').textContent = c.high.toFixed(2);
  $('#low').textContent = c.low.toFixed(2);
  $('#close').textContent = c.close.toFixed(2);
  if (!prev) return;
  const pct = (c.close - prev.close) / prev.close * 100;
  $('#change').textContent = `${pct >= 0 ? 'UP +' : 'DOWN '}${pct.toFixed(2)}%`;
  $('#change').style.color = pct >= 0 ? '#5ed69d' : '#f27675';
}
let loadRetryTimer = null, loadRetries = 0;
async function load() {
  if (inBacktestMode) return;
  const myGeneration = loadGeneration;
  const provider = $('#provider').value || 'DEMO', symbol = $('#symbol').value.trim() || 'NSE:NIFTY 50';
  inBacktestMode = false;
  chart.applyOptions({ timeScale: { timeVisible: interval !== '1d' } });
  $('#backtestStockSelect').hidden = true;
  cancelDraft();
  clearInterval(liveTimer);
  updatePnlBadge();
  if (loadRetryTimer) { clearTimeout(loadRetryTimer); loadRetryTimer = null; }
  $('#updated').textContent = 'Fetching candles...';
  try {
    const response = await fetch(`/api/candles?provider=${provider}&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${defaultLimit()}`);
    if (!response.ok) {
      let msg = provider === 'DEMO' ? 'Could not load market candles.' : `Could not load ${provider} candles.`;
      try { const body = await response.text(); if (body && body.trim()) msg = body; } catch {}
      throw Error(msg);
    }
    const data = await response.json();
    if (inBacktestMode || loadGeneration !== myGeneration) return;
    candles = data.candles;
    noMoreHistory = false;
    const reqInterval = interval;
    const targetOldest = Date.now() - ONE_MONTH_MS;
    let backfillPages = 0;
    while (candles.length && candles[0].time > targetOldest && !noMoreHistory && backfillPages < 14) {
      const to = Math.floor(candles[0].time / 1000) - 1;
      const backfillLimit = Math.max(defaultLimit(), 30000);
      const backfillResponse = await fetch(`/api/candles?provider=${provider}&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${backfillLimit}&to=${to}`);
      if (!backfillResponse.ok) break;
      const older = await backfillResponse.json();
      if (inBacktestMode || loadGeneration !== myGeneration) return;
      if (provider !== $('#provider').value || symbol !== ($('#symbol').value.trim() || 'NSE:NIFTY 50') || reqInterval !== interval) return;
      if (!older.candles || !older.candles.length) { noMoreHistory = true; break; }
      if (older.candles[0].time >= candles[0].time) break;
      candles = [...older.candles, ...candles];
      backfillPages++;
    }
    $('#instrument').textContent = data.symbol;
    $('#intervalName').textContent = ` - ${{ '1m':'1 minute','5m':'5 minutes','15m':'15 minutes','1h':'1 hour','1d':'1 day' }[interval]}`;
    updateQuote(); render(); renderStrategy();
    $('#feedLabel').textContent = provider === 'DEMO' ? 'DEMO MARKET FEED' : 'LIVE ' + provider + ' FEED';
    $('#updated').textContent = provider === 'DEMO' ? 'Demo feed (simulated data)' : 'Live data connected';
    loadRetries = 0;
    startLiveUpdates();
  } catch (error) {
    clearInterval(liveTimer);
    $('#updated').textContent = provider === 'DEMO' ? 'Candles unavailable' : 'Live feed unavailable — showing historical data';
    toast(error && error.message ? error.message : (provider === 'DEMO' ? 'Could not load market candles.' : `Could not load ${provider} candles.`));
    if (provider !== 'DEMO' && loadRetries < 5) {
      loadRetries++;
      loadRetryTimer = setTimeout(load, 2000 * loadRetries);
    }
  }
}
let liveFailures = 0;
async function refreshLiveCandle() {
  if (inBacktestMode) return;
  const provider = $('#provider').value || 'DEMO';
  const reqInterval = interval;
  const reqSymbol = $('#symbol').value.trim() || 'NSE:NIFTY 50';
  try {
    const response = await fetch(`/api/live-candle?provider=${provider}&symbol=${encodeURIComponent(reqSymbol)}&interval=${reqInterval}`);
    if (inBacktestMode || provider !== $('#provider').value || reqInterval !== interval || reqSymbol !== ($('#symbol').value.trim() || 'NSE:NIFTY 50')) return;
    if (!response.ok) {
      liveFailures++;
      clearInterval(liveTimer);
      liveTimer = setInterval(refreshLiveCandle, Math.min(30000, 2500 * Math.pow(2, Math.min(liveFailures, 4))));
      if (provider !== 'DEMO' && candles.length) {
        $('#updated').textContent = 'Live feed unavailable — showing historical data';
        return;
      }
      let msg = 'Broker stream requires connection';
      try { const body = await response.text(); if (body && body.trim()) msg = body; } catch {}
      $('#updated').textContent = msg;
      return;
    }
    const latest = await response.json();
    if (!candles.length) return;
    const last = candles.length - 1;
    if (latest.time > candles[last].time) { candles.push({ ...latest }); }
    else { candles[last] = { ...latest, time: candles[last].time }; }
    if (liveFailures > 0) { liveFailures = 0; clearInterval(liveTimer); liveTimer = setInterval(refreshLiveCandle, 2500); }
    const current = candles.at(-1);
    const point = chartType === 'line' ? { time: current.time / 1000, value: current.close } : { time: current.time / 1000, open: current.open, high: current.high, low: current.low, close: current.close };
    mainSeries.update(point);
    removeIndicators(); indicatorPane = 0;
    active.forEach((item, i) => drawIndicator(item.name, item.config?.color || COLORS[i % COLORS.length], item.config || { period: item.period || 14 }));
    layoutPanes(); updateQuote();
    $('#updated').textContent = provider === 'DEMO' ? `Demo tick ${new Date().toLocaleTimeString()}` : `Live update ${new Date().toLocaleTimeString()}`;
  } catch { $('#updated').textContent = 'Live feed reconnecting...'; }
}
function startLiveUpdates() { clearInterval(liveTimer); liveFailures = 0; liveTimer = setInterval(refreshLiveCandle, 2500); }
async function refreshIndices() {
  const provider = $('#provider').value || 'DEMO';
  try {
    const response = await fetch(`/api/indices?provider=${encodeURIComponent(provider)}`);
    if (!response.ok) return;
    const data = await response.json();
    const quotes = new Map((data.indices || []).map(q => [q.symbol, q]));
    $$('#indexStrip .index-chip').forEach(chip => {
      const q = quotes.get(chip.dataset.symbol);
      const valueEl = chip.querySelector('.ic-value');
      const changeEl = chip.querySelector('.ic-change');
      if (!q || q.value == null) {
        valueEl.textContent = '—';
        changeEl.textContent = q && q.source === 'NOT_CONNECTED' ? 'no feed' : '—';
        valueEl.className = 'ic-value ic-stale';
        changeEl.className = 'ic-change ic-stale';
        return;
      }
      const pct = q.changePct ?? 0;
      const cls = pct >= 0 ? 'up' : 'down';
      valueEl.textContent = q.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      changeEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
      valueEl.className = 'ic-value ' + cls;
      changeEl.className = 'ic-change ' + cls;
    });
  } catch {}
}
async function loadMore() {
  if (loadingMore || noMoreHistory || inBacktestMode || !candles.length) return;
  loadingMore = true;
  try {
    const provider = $('#provider').value || 'DEMO';
    const symbol = $('#symbol').value.trim() || 'NSE:NIFTY 50';
    const reqInterval = interval;
    const to = Math.floor(candles[0].time / 1000) - 1;
    const logical = chart.timeScale().getVisibleLogicalRange();
    const response = await fetch(`/api/candles?provider=${provider}&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${defaultLimit()}&to=${to}`);
    if (!response.ok) return;
    const data = await response.json();
    if (provider !== $('#provider').value || symbol !== ($('#symbol').value.trim() || 'NSE:NIFTY 50') || reqInterval !== interval) return;
    if (!data.candles || !data.candles.length) { noMoreHistory = true; return; }
    const added = data.candles.length;
    candles = [...data.candles, ...candles];
    render(false); renderStrategy();
    if (logical) chart.timeScale().setVisibleLogicalRange({ from: logical.from + added, to: logical.to + added });
  } finally { loadingMore = false; }
}
function seriesControls(side, path, allowNumber, operator, allowMath = false) {
  const list = allowMath ? CONDITION_INDICATORS : CONDITION_INDICATORS.filter(([value]) => value !== 'MATH');
  const options = list.map(([value, label]) => `<option value="${value}" ${side.indicator === value ? 'selected' : ''}>${label}</option>`).join('');
  const indicator = `<select class="cc-side" data-field="${path}.indicator">${allowNumber ? `<option value="NUMBER" ${side.indicator === 'NUMBER' ? 'selected' : ''}>Number…</option>` : ''}${options}</select>`;
  if (side.indicator === 'NUMBER') {
    const range = operator === 'between' || operator === 'outside';
    return indicator + `<input data-field="${path}.number" type="number" step="any" class="cc-number" value="${side.number ?? ''}" placeholder="Value" title="Numeric target value">${range ? `<input data-field="${path}.number2" type="number" step="any" class="cc-number" value="${side.number2 ?? ''}" placeholder="Upper" title="Upper bound">` : ''}`;
  }
  const signals = conditionSignals(side.indicator);
  const signal = signals ? `<select class="cc-signal" data-field="${path}.signal" title="Signal to compare">${signals.map(([key, label]) => `<option value="${key}" ${(side.signal || defaultSignal(side.indicator)) === key ? 'selected' : ''}>${label}</option>`).join('')}</select>` : '';
  const params = conditionParams(side.indicator).map(([key, label, def]) => {
    const value = side.params && side.params[key] != null ? side.params[key] : def;
    return `<input data-side="${path}" data-param="${key}" type="number" step="${isDecimalParam(key) ? 'any' : '1'}" value="${value}" title="${label}" placeholder="${label}">`;
  }).join('');
  const candle = ['OPEN', 'HIGH', 'LOW', 'CLOSE'].includes(side.indicator) ? `<input data-field="${path}.offset" type="number" step="1" class="cc-candle" value="${side.offset ?? 0}" title="Candle to use in the comparison: 0 = most recent candle, -1 = previous candle, -2 = two candles ago" placeholder="0">` : '';
  return indicator + signal + `<span class="cc-params">${params}${candle}</span>`;
}
function sideControls(side, dataField, operator) {
  if (side.indicator === 'MATH') {
    const ops = [['add', '+'], ['sub', '−'], ['mul', '×'], ['div', '÷'], ['min', 'min'], ['max', 'max']].map(([value, label]) => `<option value="${value}" ${(side.op || 'sub') === value ? 'selected' : ''}>${label}</option>`).join('');
    return `<span class="cc-math" title="Math expression">${seriesControls(side.a, dataField + '.a', false, null)}<select data-field="${dataField}.op" class="cc-mathop" title="Math operation">${ops}</select>${seriesControls(side.b, dataField + '.b', true, null)}</span>`;
  }
  return seriesControls(side, dataField, dataField === 'right', operator, true);
}
function conditionRow(kind, condition, index) {
  const operators = [['above', 'above'], ['aboveEqual', 'above or equal'], ['below', 'below'], ['belowEqual', 'below or equal'], ['crossesAbove', 'crosses above'], ['crossesBelow', 'crosses below'], ['between', 'between'], ['outside', 'outside range']].map(([value, label]) => `<option value="${value}" ${condition.operator === value ? 'selected' : ''}>${label}</option>`).join('');
  return `<div class="custom-condition" data-kind="${kind}" data-index="${index}">${sideControls(condition.left, 'left')}<select data-field="operator" class="cc-operator">${operators}</select>${sideControls(condition.right, 'right', condition.operator)}<select data-field="connector" class="cc-connector" title="Join with the next condition">${['AND', 'OR'].map(value => `<option value="${value}" ${(condition.connector || 'AND') === value ? 'selected' : ''}>${value}</option>`).join('')}</select><button data-remove-condition aria-label="Remove condition">×</button></div>`;
}
function renderCustomConditions() {
  $('#entryConditions').innerHTML = customDraft.entryConditions.map((condition, index) => conditionRow('entryConditions', condition, index)).join('');
  $('#exitConditions').innerHTML = customDraft.exitConditions.map((condition, index) => conditionRow('exitConditions', condition, index)).join('');
  $('#customStopLoss').value = customDraft.stopLoss || 0;
  $('#customStopLossType').value = customDraft.stopLossType || 'PERCENT';
  $('#customProfitTarget').value = customDraft.profitTarget || 0;
  $('#customProfitTargetType').value = customDraft.profitTargetType || 'PERCENT';
  $$('.custom-condition').forEach(row => {
    const conditionAt = () => customDraft[row.dataset.kind][Number(row.dataset.index)];
    const resetOperand = operand => {
      if (operand.indicator === 'NUMBER') { operand.params = {}; operand.signal = null; operand.number ??= 0; }
      else {
        const defaults = conditionParamsObj(operand.indicator);
        operand.params = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, operand.params && operand.params[key] != null ? operand.params[key] : value]));
        const signals = conditionSignals(operand.indicator);
        if (signals && !signals.some(([key]) => key === operand.signal)) operand.signal = defaultSignal(operand.indicator);
      }
    };
    row.querySelectorAll('[data-param]').forEach(input => input.onchange = () => {
      const condition = conditionAt(), side = getPath(condition, input.dataset.side);
      side.params ||= {};
      side.params[input.dataset.param] = Number(input.value);
    });
    row.querySelectorAll('[data-field]').forEach(input => input.onchange = () => {
      const condition = conditionAt(), path = input.dataset.field;
      if (path === 'left.indicator' || path === 'right.indicator') {
        const side = condition[path.split('.')[0]];
        side.indicator = input.value;
        if (side.indicator === 'MATH') { side.a = { indicator: 'CLOSE', params: {}, signal: null }; side.op = 'sub'; side.b = { indicator: 'NUMBER', number: 0 }; }
        else if (side.indicator === 'NUMBER') { side.params = {}; side.signal = null; }
        else {
          const defaults = conditionParamsObj(side.indicator);
          side.params = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, side.params && side.params[key] != null ? side.params[key] : value]));
          const signals = conditionSignals(side.indicator);
          if (signals && !signals.some(([key]) => key === side.signal)) side.signal = defaultSignal(side.indicator);
        }
        renderCustomConditions();
        return;
      }
      if (path.endsWith('.a.indicator') || path.endsWith('.b.indicator')) {
        const keys = path.split('.');
        const operand = getPath(condition, keys.slice(0, 2).join('.'));
        operand.indicator = input.value;
        resetOperand(operand);
        renderCustomConditions();
        return;
      }
      setPath(condition, path, input.value);
      if (path === 'operator') renderCustomConditions();
    });
    row.querySelector('[data-remove-condition]').onclick = () => { customDraft[row.dataset.kind].splice(Number(row.dataset.index), 1); renderCustomConditions(); };
  });
}
function addCustomCondition(kind) {
  customDraft[kind].push({ left: { indicator: 'RSI', params: { period: 14 }, signal: null, offset: 0 }, operator: kind === 'entryConditions' ? 'below' : 'above', right: { indicator: 'NUMBER', params: {}, signal: null, offset: 0, number: kind === 'entryConditions' ? 30 : 70, number2: '' }, connector: 'AND' });
  renderCustomConditions();
}
function resetCustomStrategy() {
  customDraft = { entryConditions: [{ left: { indicator: 'RSI', params: { period: 14 }, signal: null, offset: 0 }, operator: 'below', right: { indicator: 'NUMBER', params: {}, signal: null, offset: 0, number: 30, number2: '' }, connector: 'AND' }], exitConditions: [{ left: { indicator: 'RSI', params: { period: 14 }, signal: null, offset: 0 }, operator: 'above', right: { indicator: 'NUMBER', params: {}, signal: null, offset: 0, number: 70, number2: '' }, connector: 'AND' }], profitTargetType: 'PERCENT', profitTarget: 0, stopLossType: 'PERCENT', stopLoss: 0 };
  $('#customStrategyName').value = ''; $('#savedCustomStrategies').value = ''; $('#deleteCustomStrategy').disabled = true; renderCustomConditions();
}
async function loadCustomStrategies() {
  const response = await fetch('/api/custom-strategies');
  if (!response.ok) throw new Error('Unable to load saved strategies');
  const records = await response.json();
  customStrategies = new Map(records.map(record => [String(record.id), { ...record, config: JSON.parse(record.config) }]));
  const saved = $('#savedCustomStrategies'), chosen = saved.value;
  saved.innerHTML = '<option value="">Select a saved strategy…</option>' + records.map(record => `<option value="${record.id}">${escapeHtml(record.name)}</option>`).join('');
  if (customStrategies.has(chosen)) saved.value = chosen;
  $('#deleteCustomStrategy').disabled = !$('#savedCustomStrategies').value;
  const strategy = $('#strategy'), strategyValue = strategy.value;
  [...strategy.querySelectorAll('option[data-custom]')].forEach(option => option.remove());
  records.forEach(record => strategy.insertAdjacentHTML('beforeend', `<option data-custom value="CUSTOM:${record.id}">Custom: ${escapeHtml(record.name)}</option>`));
  if ([...strategy.options].some(option => option.value === strategyValue)) strategy.value = strategyValue;
}
function useCustomStrategy(id) {
  const strategy = customStrategies.get(id);
  if (!strategy) return;
  customDraft = JSON.parse(JSON.stringify(strategy.config));
  customDraft.stopLossType ||= 'PERCENT'; customDraft.profitTargetType ||= 'PERCENT';
  customDraft.profitTarget ||= 0;
  customDraft.entryConditions.forEach(condition => { normalizeCondition(condition); });
  customDraft.exitConditions.forEach(condition => { normalizeCondition(condition); });
  finalizeLogic(customDraft.entryConditions, customDraft.entryLogic); finalizeLogic(customDraft.exitConditions, customDraft.exitLogic);
  $('#customStrategyName').value = strategy.name; $('#savedCustomStrategies').value = id; renderCustomConditions();
  $('#deleteCustomStrategy').disabled = false;
  $('#strategy').value = `CUSTOM:${id}`; $('#strategy').dispatchEvent(new Event('change'));
}
function syncCustomDraft() {
  $$('.custom-condition').forEach(row => {
    const condition = customDraft[row.dataset.kind][Number(row.dataset.index)];
    if (!condition) return;
    row.querySelectorAll('[data-param]').forEach(input => {
      const side = getPath(condition, input.dataset.side);
      side.params ||= {};
      side.params[input.dataset.param] = Number(input.value);
    });
    row.querySelectorAll('[data-field]').forEach(input => { setPath(condition, input.dataset.field, input.value); });
  });
  customDraft.stopLoss = Math.max(0, Number($('#customStopLoss').value) || 0);
  customDraft.stopLossType = $('#customStopLossType').value;
  customDraft.profitTarget = Math.max(0, Number($('#customProfitTarget').value) || 0);
  customDraft.profitTargetType = $('#customProfitTargetType').value;
}
async function saveCustomStrategy() {
  const name = $('#customStrategyName').value.trim();
  syncCustomDraft();
  if (!name) return toast('Give your custom strategy a name.');
  if (!customDraft.entryConditions.length) return toast('Add at least one buy condition.');
  const response = await fetch('/api/custom-strategies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config: JSON.stringify(customDraft) }) });
  if (!response.ok) { const error = await response.json().catch(() => ({})); return toast(error.message || 'Could not save the strategy.'); }
  await loadCustomStrategies();
  const saved = [...customStrategies.entries()].find(([, strategy]) => strategy.name === name);
  if (saved) useCustomStrategy(saved[0]);
  toast('Custom strategy saved.');
}
async function deleteCustomStrategy() {
  const id = $('#savedCustomStrategies').value;
  if (!id) return;
  if (!confirm('Delete the selected saved strategy?')) return;
  try {
    const response = await fetch('/api/custom-strategies/' + id, { method: 'DELETE' });
    if (!response.ok) throw Error();
  } catch { toast('Could not delete the strategy.'); return; }
  const wasActive = $('#strategy').value === `CUSTOM:${id}`;
  $('#savedCustomStrategies').value = '';
  $('#deleteCustomStrategy').disabled = true;
  await loadCustomStrategies();
  if (wasActive) { $('#strategy').value = ''; $('#strategy').dispatchEvent(new Event('change')); renderStrategy(); }
  toast('Strategy deleted.');
}
function initDrawingBarToggle() {
  const btn = $('#toggleDrawingBar');
  const body = document.querySelector('.workspace-body');
  if (!btn || !body) return;
  const KEY = 'prism.drawingbar';
  const update = () => {
    const hidden = body.classList.contains('collapsed');
    btn.title = hidden ? 'Show annotation toolbar' : 'Hide annotation toolbar';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-expanded', String(!hidden));
    btn.classList.toggle('active', !hidden);
  };
  if (localStorage.getItem(KEY) !== '1') body.classList.add('collapsed');
  update();
  btn.addEventListener('click', () => {
    body.classList.toggle('collapsed');
    localStorage.setItem(KEY, body.classList.contains('collapsed') ? '0' : '1');
    update();
  });
}
async function setup() {
  initTheme();
  initChart();
  setupDrawingTools();
  initDrawingBarToggle();
  restoreDrawings();
  refreshIndices();
  setInterval(refreshIndices, 10000);
  chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (!range || range.from == null || !candles.length || loadingMore || noMoreHistory || inBacktestMode) return;
    const bufferBars = 30;
    if (range.from < bufferBars && range.to < candles.length - 1) loadMore();
  });
  const providers = await (await fetch('/api/providers')).json();
  $('#provider').innerHTML = providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const groups = await (await fetch('/api/symbols')).json();
  $('#symbol').innerHTML = groups.map(g =>
    `<optgroup label="${g.category}">${g.symbols.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}</optgroup>`
  ).join('');
  $('#symbol').value = 'NSE:NIFTY 50';
  renderSymbolCheckboxList(groups);
  setSelectedSymbols(['NSE:NIFTY 50']);
  const todayIst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })), yearAgoIst = new Date(todayIst); yearAgoIst.setMonth(todayIst.getMonth() - 1);
  const pad = n => String(n).padStart(2, '0');
  $('#backtestStart').value = `${yearAgoIst.getFullYear()}-${pad(yearAgoIst.getMonth() + 1)}-${pad(yearAgoIst.getDate())}`;
  $('#backtestEnd').value = `${todayIst.getFullYear()}-${pad(todayIst.getMonth() + 1)}-${pad(todayIst.getDate())}`;
  const urlParams = new URLSearchParams(window.location.search);
  const brokerParam = urlParams.get('broker');
  if (brokerParam && urlParams.has('connected')) {
    window.history.replaceState({}, '', window.location.pathname);
    const target = providers.find(p => p.id === brokerParam.toUpperCase());
    if (target) $('#provider').value = target.id;
    setTimeout(() => toast(urlParams.get('connected') === 'true' ? 'Connected to ' + (target ? target.name : brokerParam) + '.' : (target ? target.name : brokerParam) + ' connection failed.'), 100);
  }
  $('#provider').onchange = async () => {
    const p = providers.find(x => x.id === $('#provider').value);
    $('#providerStatus').textContent = p.status;
    if (p.id === 'DEMO') { $('#connect').textContent = 'Demo feed active'; load(); refreshIndices(); return; }
    try {
      var broker = p.id === 'ZERODHA' ? 'zerodha' : p.id.toLowerCase();
      if (broker === 'angel_one') broker = 'angel-one';
      const status = await (await fetch('/api/auth/' + broker + '/status')).json();
      if (status.connected) { $('#connect').textContent = p.name + ' connected'; $('#providerStatus').textContent = 'Connected'; }
      else { $('#connect').textContent = account.loggedIn && brokerHasSaved(p.id) ? 'Connect ' + p.name + ' (saved)' : 'Connect ' + p.name; $('#providerStatus').textContent = status.configured ? 'Ready to connect' : p.status; }
    } catch { $('#connect').textContent = 'Connect ' + p.name; }
    load();
    refreshIndices();
  };
  try { await refreshAccount(); } catch { }
  if ($('#provider').value === 'DEMO') {
    for (const b of providers.filter(p => p.id !== 'DEMO')) {
      const slug = b.id === 'ZERODHA' ? 'zerodha' : b.id.toLowerCase().replace('angel_one', 'angel-one');
      try {
        const status = await (await fetch('/api/auth/' + slug + '/status')).json();
        if (status.connected) { $('#provider').value = b.id; toast('Switched to ' + b.name + ' — live data active.'); break; }
      } catch {}
    }
  }
  await restoreBacktestSettings();
  if (!backtestRuns.length) {
    $('#provider').dispatchEvent(new Event('change'));
  }
  $('#symbol').addEventListener('change', () => {
    if (inBacktestMode) {
      const target = $('#symbol').value;
      if (backtestRuns.some(run => run.symbol === target)) { showBacktestChart(target); return; }
      inBacktestMode = false;
    }
    load();
  });
  $('#refreshSymbols').onclick = async () => { const groups = await (await fetch('/api/symbols')).json(); const val = $('#symbol').value, selected = selectedSymbols(); const options = groups.map(g => `<optgroup label="${g.category}">${g.symbols.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}</optgroup>`).join(''); $('#symbol').innerHTML = options; renderSymbolCheckboxList(groups); setSelectedSymbols(selected); $('#symbol').value = val; };
  $('#timeframes').onclick = e => {
    if (!e.target.dataset.i) return;
    interval = e.target.dataset.i;
    $$('#timeframes button').forEach(b => b.classList.toggle('active', b === e.target));
    chart.applyOptions({ timeScale: { timeVisible: interval !== '1d' } });
    if (inBacktestMode) inBacktestMode = false;
    load();
  };
  const pnlToggle = $('#pnlToggle');
  pnlToggle.checked = pnlBadgeVisible;
  pnlToggle.onchange = () => {
    pnlBadgeVisible = pnlToggle.checked;
    try { localStorage.setItem('prism.showPnlBadge', pnlBadgeVisible ? '1' : '0'); } catch {}
    updatePnlBadge();
    if (inBacktestMode) {
      const run = backtestRuns.find(item => item.symbol === $('#backtestStockSelect').value) || backtestRuns[0];
      if (run) backtestMarkers(run);
    }
  };
  $$('.chart-type').forEach(button => button.onclick = () => {
    $$('.chart-type').forEach(x => x.classList.remove('active'));
    button.classList.add('active');
    chartType = button.dataset.type;
    setSeries();
  });
  $('#addIndicator').onclick = () => {
    const name = $('#indicator').value, period = Math.max(2, Math.min(200, Number($('#indicatorPeriod').value) || 14));
    if (active.some(item => item.name === name)) return toast(name + ' is already active; edit its configuration below.');
    const config = defaultIndicatorConfig(name); if ('period' in config) config.period = period;
    config.color = COLORS[active.length % COLORS.length];
    active.push({ name, config });
    showIndicators();
    render();
  };
  $('#clearIndicators').onclick = () => { active = []; showIndicators(); render(); };
  $('#saveIndicatorPreset').onclick = saveIndicatorPreset;
  $('#deleteIndicatorPreset').onclick = deleteIndicatorPreset;
  $('#savedIndicatorPresets').onchange = () => {
    const name = $('#savedIndicatorPresets').value;
    if (!name || !indicatorPresets[name]) return;
    active = indicatorPresets[name].map(item => ({ name: item.name, config: { ...item.config } }));
    showIndicators();
    render();
    toast('Loaded layout "' + name + '".');
  };
  $('#indicatorPresetName').onkeydown = e => { if (e.key === 'Enter') saveIndicatorPreset(); };
  loadIndicatorPresets();
  $('#connect').onclick = () => toast($('#provider').value === 'DEMO' ? 'Demo feed is already connected.' : 'Add the broker API adapter and credentials on the server to enable its live stream.');
  $('#brokerDialogClose').onclick = () => { document.getElementById('brokerDialog').close(); };
  document.getElementById('brokerDialog').addEventListener('close', () => { document.getElementById('brokerDialogFields').style.display = 'none'; document.getElementById('brokerFieldsZerodha').style.display = 'none'; document.getElementById('brokerFieldsAngel').style.display = 'none'; document.getElementById('brokerFieldsUpstox').style.display = 'none'; document.getElementById('brokerFieldsFyers').style.display = 'none'; document.getElementById('brokerSavedSection').style.display = 'none'; $('#vaultSaveName').value = ''; });
  $('#strategy').innerHTML = '<option value="">Select a strategy…</option>' + Object.entries(STRATEGIES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  $('#strategy').onchange = () => {
    const s = STRATEGIES[$('#strategy').value];
    $('#strategyParams').innerHTML = s ? '<div class="strategy-params">' + s.params.map(p => `<label>${p.label}<input data-k="${p.k}" type="number" value="${p.def}" min="1" max="200"></label>`).join('') + '</div>' : '';
    const custom = customStrategies.get($('#strategy').value.replace('CUSTOM:', ''));
    const targetLabel = (value, type) => type === 'AMOUNT' ? `₹${value}` : type === 'POINTS' ? `${value} pt` : `${value}%`;
    $('#strategySummary').innerHTML = custom ? `<div>Custom strategy: <span>${escapeHtml(custom.name)}</span> · ${custom.config.entryConditions.length} buy rule${custom.config.entryConditions.length === 1 ? '' : 's'} · ${custom.config.exitConditions.length} exit rule${custom.config.exitConditions.length === 1 ? '' : 's'}${custom.config.profitTarget ? ` · Target: <span>${targetLabel(custom.config.profitTarget, custom.config.profitTargetType || 'PERCENT')}</span>` : ''}${custom.config.stopLoss ? ` · Stop: <span>${targetLabel(custom.config.stopLoss, custom.config.stopLossType || 'PERCENT')}</span>` : ''}</div>` : '';
  };
  $('#strategy').dispatchEvent(new Event('change'));
  $('#applyStrategy').onclick = renderStrategy;
  $('#clearStrategy').onclick = () => { $('#strategy').value = ''; $('#strategy').dispatchEvent(new Event('change')); setMainMarkers([]); $('#strategySummary').innerHTML = ''; };
  $('#addEntryCondition').onclick = () => addCustomCondition('entryConditions');
  $('#addExitCondition').onclick = () => addCustomCondition('exitConditions');
  $('#newCustomStrategy').onclick = resetCustomStrategy;
  $('#saveCustomStrategy').onclick = saveCustomStrategy;
  $('#savedCustomStrategies').onchange = () => {
    $('#deleteCustomStrategy').disabled = !$('#savedCustomStrategies').value;
    if ($('#savedCustomStrategies').value) useCustomStrategy($('#savedCustomStrategies').value);
  };
  $('#deleteCustomStrategy').onclick = deleteCustomStrategy;
  resetCustomStrategy();
  try { await loadCustomStrategies(); } catch { toast('Saved custom strategies are unavailable.'); }
  $('#runBacktest').onclick = runBacktest;
  $('#backtestStockSelect').onchange = () => showBacktestChart($('#backtestStockSelect').value);
  $('#clearBacktest').onclick = clearBacktest;
  $('#accountBtn').onclick = () => { account.loggedIn ? openVaultDialog() : openAccountDialog('login'); };
  $('#accountDialogClose').onclick = () => { document.getElementById('accountDialog').close(); };
  $('#accountDialogSubmit').onclick = submitAccount;
  $('#accountSwitch').onclick = () => openAccountDialog(accountMode === 'login' ? 'register' : 'login');
  $('#accountUsername').onkeydown = e => { if (e.key === 'Enter') submitAccount(); };
  $('#accountPassword').onkeydown = e => { if (e.key === 'Enter') submitAccount(); };
  $('#vaultDialogClose').onclick = () => { document.getElementById('vaultDialog').close(); };
  $('#vaultDialogDone').onclick = () => { document.getElementById('vaultDialog').close(); };
  $('#vaultLogout').onclick = logout;
}
function showIndicators() {
  $('#indicatorList').innerHTML = active.map((item, i) => {
    const config = item.config || { period: item.period || 14 };
    const color = config.color || COLORS[i % COLORS.length];
    return `<div class="indicator-chip" style="border-color:${color}">
      <span>${item.name}</span>
      ${indicatorParams(item.name).map(([key, label, fallback]) => `<label>${label}<input aria-label="${item.name} ${label}" data-config-index="${i}" data-config-key="${key}" type="number" step="any" min="0" value="${config[key] ?? fallback}"></label>`).join('')}
      <label>Color<input type="color" data-config-index="${i}" data-config-key="color" value="${color}"></label>
      <button class="apply" data-apply-index="${i}" data-icon="&#x2713;">Apply</button>
      <button aria-label="Remove ${item.name}" data-remove-index="${i}" data-icon="&#x2715;">x</button>
    </div>`;
  }).join('');
  const applyConfig = index => {
    const item = active[index];
    item.config ||= { period: item.period || 14 };
    $$('#indicatorList [data-config-index="' + index + '"]').forEach(input => {
      const value = input.type === 'color' ? input.value : Math.max(0, Number(input.value) || 0);
      item.config[input.dataset.configKey] = value;
    });
    render();
  };
  $$('#indicatorList [data-config-index]').forEach(input => input.addEventListener('change', () => applyConfig(Number(input.dataset.configIndex))));
  $$('#indicatorList [data-apply-index]').forEach(button => button.onclick = () => applyConfig(Number(button.dataset.applyIndex)));
  $$('#indicatorList [data-remove-index]').forEach(button => button.onclick = () => { active.splice(Number(button.dataset.removeIndex), 1); showIndicators(); render(); });
  $('#emptyState').classList.toggle('hidden', active.length > 0);
}
function loadIndicatorPresets() {
  indicatorPresets = {};
  try { indicatorPresets = JSON.parse(localStorage.getItem('prism.indicatorPresets') || '{}'); } catch (err) { indicatorPresets = {}; }
  const select = $('#savedIndicatorPresets');
  if (!select) return;
  select.innerHTML = '<option value="">Saved layouts…</option>' + Object.keys(indicatorPresets).map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  $('#deleteIndicatorPreset').disabled = !Object.keys(indicatorPresets).length;
}
function saveIndicatorPreset() {
  if (!active.length) return toast('Add at least one indicator before saving a layout.');
  const input = $('#indicatorPresetName');
  let name = input.value.trim();
  if (!name) { let n = 1; while (indicatorPresets['Layout ' + n]) n++; name = 'Layout ' + n; }
  indicatorPresets[name] = active.map(item => ({ name: item.name, config: { ...item.config } }));
  try { localStorage.setItem('prism.indicatorPresets', JSON.stringify(indicatorPresets)); } catch (err) { return toast('Could not save the layout.'); }
  input.value = '';
  loadIndicatorPresets();
  $('#savedIndicatorPresets').value = name;
  toast('Layout "' + name + '" saved.');
}
function deleteIndicatorPreset() {
  const name = $('#savedIndicatorPresets').value;
  if (!name || !indicatorPresets[name]) return;
  delete indicatorPresets[name];
  try { localStorage.setItem('prism.indicatorPresets', JSON.stringify(indicatorPresets)); } catch (err) { }
  loadIndicatorPresets();
  toast('Layout "' + name + '" deleted.');
}
function crossSignals(data, fast, slow) {
  const signals = [];
  fast.forEach((v, i) => {
    if (v == null || slow[i] == null || i === 0) return;
    if (fast[i - 1] <= slow[i - 1] && v > slow[i]) signals.push({ type: 'buy', index: i, time: data[i].time, price: data[i].close });
    if (fast[i - 1] >= slow[i - 1] && v < slow[i]) signals.push({ type: 'sell', index: i, time: data[i].time, price: data[i].close });
  });
  return signals;
}
function computeStrategy(name, params, data) {
  if (name?.startsWith('CUSTOM:')) return computeCustomStrategy(customStrategies.get(name.slice(7))?.config, data, params);
  const s = STRATEGIES[name];
  if (!s || !data || data.length < 20) return [];
  return s.compute(data, params);
}
function mathApply(x, y, op) {
  if (op === 'add') return x + y;
  if (op === 'mul') return x * y;
  if (op === 'div') return y === 0 ? null : x / y;
  if (op === 'min') return Math.min(x, y);
  if (op === 'max') return Math.max(x, y);
  return x - y;
}
function customSeries(condition, data) {
  const close = data.map(c => c.close), params = condition.params || {};
  const period = Math.max(2, Number(params.period ?? condition.period) || 14);
  const setting = (key, fallback) => Number(params[key] ?? condition[key] ?? fallback);
  if (condition.indicator === 'OPEN') return data.map(c => c.open);
  if (condition.indicator === 'HIGH') return data.map(c => c.high);
  if (condition.indicator === 'LOW') return data.map(c => c.low);
  if (condition.indicator === 'VOLUME') return data.map(c => c.volume);
  if (condition.indicator === 'TYPICAL') return data.map(c => (c.high + c.low + c.close) / 3);
  if (condition.indicator === 'SMA') return sma(close, period);
  if (condition.indicator === 'EMA') return ema(close, period);
  if (condition.indicator === 'WMA') return wma(close, period);
  if (condition.indicator === 'DEMA') { const first = ema(close, period), second = ema(first.map(value => value ?? close[0]), period); return first.map((value, i) => value == null || second[i] == null ? null : 2 * value - second[i]); }
  if (condition.indicator === 'TEMA') { const first = ema(close, period), second = ema(first.map(value => value ?? close[0]), period), third = ema(second.map(value => value ?? close[0]), period); return first.map((value, i) => value == null || second[i] == null || third[i] == null ? null : 3 * value - 3 * second[i] + third[i]); }
  if (condition.indicator === 'HMA') { const half = wma(close, Math.max(2, Math.floor(period / 2))), full = wma(close, period), raw = close.map((_, i) => half[i] == null || full[i] == null ? 0 : 2 * half[i] - full[i]); return wma(raw, Math.max(2, Math.floor(Math.sqrt(period)))); }
  if (condition.indicator === 'KAMA') { let value = close[0]; return close.map((price, i) => { if (i < period) return null; const change = Math.abs(price - close[i - period]), volatility = close.slice(i - period + 1, i + 1).reduce((sum, item, j, values) => j ? sum + Math.abs(item - values[j - 1]) : sum, 0), smooth = (change / (volatility || 1) * (.6667 - .0645) + .0645) ** 2; value += smooth * (price - value); return value; }); }
  if (condition.indicator === 'SAR') { const afStart = setting('accel', .02), afMax = setting('maxAccel', .2); let sar = data[0].low, ep = data[0].high, af = afStart, rising = true; return data.map((candle, i) => { if (!i) return sar; sar += af * (ep - sar); if (rising && candle.low < sar) { rising = false; sar = ep; ep = candle.low; af = afStart; } else if (!rising && candle.high > sar) { rising = true; sar = ep; ep = candle.high; af = afStart; } else if (rising && candle.high > ep) { ep = candle.high; af = Math.min(afMax, af + afStart); } else if (!rising && candle.low < ep) { ep = candle.low; af = Math.min(afMax, af + afStart); } return sar; }); }
  if (condition.indicator === 'SUPERTREND') { const atr = sma(trueRange(data), Math.max(2, setting('atrPeriod', 10))), mult = setting('mult', 3); let upper, lower, trend = 1; return data.map((candle, i) => { if (atr[i] == null) return null; const mid = (candle.high + candle.low) / 2, bu = mid + mult * atr[i], bl = mid - mult * atr[i]; upper = i && upper != null && close[i - 1] <= upper ? Math.min(bu, upper) : bu; lower = i && lower != null && close[i - 1] >= lower ? Math.max(bl, lower) : bl; if (close[i] > upper) trend = 1; else if (close[i] < lower) trend = -1; return trend === 1 ? lower : upper; }); }
  if (condition.indicator === 'ICHIMOKU') { const midRange = n => data.map((_, i) => i < n - 1 ? null : (Math.max(...data.slice(i - n + 1, i + 1).map(c => c.high)) + Math.min(...data.slice(i - n + 1, i + 1).map(c => c.low))) / 2); const conversion = midRange(Math.max(2, setting('conversion', 9))), base = midRange(Math.max(2, setting('base', 26))), spanB = midRange(Math.max(2, setting('spanB', 52))), sig = condition.signal || 'conversion'; if (sig === 'base') return base; if (sig === 'spanA') return conversion.map((v, i) => v == null || base[i] == null ? null : (v + base[i]) / 2); if (sig === 'spanB') return spanB; return conversion; }
  if (condition.indicator === 'RSI') return rsi(close, period);
  if (condition.indicator === 'MACD') { const fast = ema(close, Math.max(2, setting('fast', 12))), slow = ema(close, Math.max(2, setting('slow', 26))), macd = close.map((_, i) => fast[i] == null || slow[i] == null ? null : fast[i] - slow[i]), signal = ema(macd.map(x => x ?? 0), Math.max(1, setting('signal', 9))), sig = condition.signal || 'histogram'; if (sig === 'macd') return macd; if (sig === 'signal') return signal; return macd.map((v, i) => v == null || signal[i] == null ? null : v - signal[i]); }
  if (condition.indicator === 'PPO') { const fast = ema(close, Math.max(2, setting('fast', 12))), slow = ema(close, Math.max(2, setting('slow', 26))), ppo = close.map((_, i) => fast[i] == null || slow[i] == null || slow[i] === 0 ? null : (fast[i] - slow[i]) / slow[i] * 100), signal = ema(ppo.map(x => x ?? 0), Math.max(1, setting('signal', 9))); return condition.signal === 'signal' ? signal : ppo; }
  if (condition.indicator === 'STOCH') { const s = stoch(data, Math.max(2, setting('k', 14)), Math.max(1, setting('d', 3))); return condition.signal === 'd' ? s.d : s.k; }
  if (condition.indicator === 'STOCHRSI') { const rsiSeries = rsi(close, Math.max(2, setting('rsiPeriod', 14))), n = Math.max(2, setting('stochPeriod', 14)), ds = Math.max(1, setting('dSmooth', 3)), k = rsiSeries.map((_, i) => { if (i < Math.max(2, setting('rsiPeriod', 14)) + n - 1) return null; const window = rsiSeries.slice(i - n + 1, i + 1), lo = Math.min(...window), hi = Math.max(...window); return hi === lo ? 50 : (rsiSeries[i] - lo) / (hi - lo) * 100; }), d = sma(k, ds); return condition.signal === 'd' ? d : k; }
  if (condition.indicator === 'MFI') return mfi(data, period);
  if (condition.indicator === 'CCI') return cci(data, period);
  if (condition.indicator === 'WILLIAMS_R') return williamsR(data, period);
  if (condition.indicator === 'ROC') return close.map((value, i) => i < period ? null : (value - close[i - period]) / close[i - period] * 100);
  if (condition.indicator === 'MOM') return close.map((value, i) => i < period ? null : value - close[i - period]);
  if (condition.indicator === 'AO') { const median = data.map(c => (c.high + c.low) / 2), fast = sma(median, Math.max(2, setting('fast', 5))), slow = sma(median, Math.max(2, setting('slow', 34))); return fast.map((v, i) => v == null || slow[i] == null ? null : v - slow[i]); }
  if (condition.indicator === 'TRIX') { const a = ema(close, period), b = ema(a.map(x => x ?? close[0]), period), d = ema(b.map(x => x ?? close[0]), period); return d.map((v, i) => i && v != null && d[i - 1] ? 100 * (v - d[i - 1]) / d[i - 1] : null); }
  if (condition.indicator === 'DPO') { const avg = sma(close, period), shift = Math.floor(period / 2) + 1; return close.map((v, i) => i < period + shift - 1 ? null : v - avg[i - shift]); }
  if (condition.indicator === 'ATR') return sma(trueRange(data), period);
  if (condition.indicator === 'ADX') { const a = adxValues(data, period); if (condition.signal === 'dip') return a.dip; if (condition.signal === 'din') return a.din; return a.adx; }
  if (condition.indicator === 'AROON') { const sig = condition.signal || 'osc'; const up = data.map((_, i) => { if (i < period - 1) return null; const highs = data.slice(i - period + 1, i + 1).map(c => c.high); return (highs.lastIndexOf(Math.max(...highs)) + 1) / period * 100; }), down = data.map((_, i) => { if (i < period - 1) return null; const lows = data.slice(i - period + 1, i + 1).map(c => c.low); return (lows.lastIndexOf(Math.min(...lows)) + 1) / period * 100; }); if (sig === 'up') return up; if (sig === 'down') return down; return up.map((v, i) => v == null || down[i] == null ? null : v - down[i]); }
  if (condition.indicator === 'VWAP') { let priceVolume = 0, volume = 0; return data.map(candle => { priceVolume += (candle.high + candle.low + candle.close) / 3 * candle.volume; volume += candle.volume; return priceVolume / (volume || 1); }); }
  if (condition.indicator === 'OBV') { let obv = 0; return close.map((value, i) => { if (i) obv += value >= close[i - 1] ? data[i].volume : -data[i].volume; return obv; }); }
  if (condition.indicator === 'ADL') { let adl = 0; return data.map(c => adl += ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low || 1) * c.volume); }
  if (condition.indicator === 'ADOSC') { let adl = 0; const line = data.map(c => adl += ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low || 1) * c.volume), fast = ema(line, Math.max(2, setting('fast', 3))), slow = ema(line, Math.max(2, setting('slow', 10))); return line.map((_, i) => fast[i] == null || slow[i] == null ? null : fast[i] - slow[i]); }
  if (condition.indicator === 'VORTEX') { const tr = trueRange(data), plus = data.map((c, i) => i ? Math.abs(c.high - data[i - 1].low) : 0), minus = data.map((c, i) => i ? Math.abs(c.low - data[i - 1].high) : 0), sum = (arr, i) => arr.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0), viPlus = tr.map((_, i) => i < period ? null : sum(plus, i) / (sum(tr, i) || 1)), viMinus = tr.map((_, i) => i < period ? null : sum(minus, i) / (sum(tr, i) || 1)), sig = condition.signal || 'diff'; if (sig === 'vplus') return viPlus; if (sig === 'vminus') return viMinus; return viPlus.map((v, i) => v == null || viMinus[i] == null ? null : v - viMinus[i]); }
  if (condition.indicator === 'CMF') { const flow = data.map(c => ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low || 1) * c.volume); return flow.map((_, i) => i < period - 1 ? null : flow.slice(i - period + 1, i + 1).reduce((sum, value) => sum + value, 0) / data.slice(i - period + 1, i + 1).reduce((sum, c) => sum + c.volume, 0)); }
  if (condition.indicator === 'FI') return ema(close.map((value, i) => i ? (value - close[i - 1]) * data[i].volume : 0), period);
  if (condition.indicator === 'BB' || condition.indicator === 'BB_UPPER' || condition.indicator === 'BB_MID' || condition.indicator === 'BB_LOWER') { const sig = condition.indicator === 'BB' ? (condition.signal || 'mid') : condition.indicator === 'BB_UPPER' ? 'upper' : condition.indicator === 'BB_LOWER' ? 'lower' : 'mid', mid = sma(close, period), deviation = mid.map((mean, i) => mean == null ? null : Math.sqrt(close.slice(i - period + 1, i + 1).reduce((sum, value) => sum + (value - mean) ** 2, 0) / period)), mult = setting('std', 2); return mid.map((value, i) => value == null ? null : sig === 'upper' ? value + mult * deviation[i] : sig === 'lower' ? value - mult * deviation[i] : value); }
  if (condition.indicator === 'DC' || condition.indicator === 'DC_HIGH' || condition.indicator === 'DC_LOW') { const sig = condition.indicator === 'DC' ? (condition.signal || 'high') : condition.indicator === 'DC_HIGH' ? 'high' : 'low'; return data.map((_, i) => i < period - 1 ? null : sig === 'low' ? Math.min(...data.slice(i - period + 1, i + 1).map(c => c.low)) : Math.max(...data.slice(i - period + 1, i + 1).map(c => c.high))); }
  if (condition.indicator === 'KC' || condition.indicator === 'KC_UPPER' || condition.indicator === 'KC_LOWER') { const sig = condition.indicator === 'KC' ? (condition.signal || 'mid') : condition.indicator === 'KC_UPPER' ? 'upper' : 'lower', mid = ema(close, period), atr = sma(trueRange(data), period), mult = setting('mult', 2); return mid.map((value, i) => value == null || atr[i] == null ? null : sig === 'upper' ? value + mult * atr[i] : sig === 'lower' ? value - mult * atr[i] : value); }
  if (condition.indicator === 'ENVELOPE') { const mid = sma(close, period), pct = setting('percent', 2.5), sig = condition.signal || 'mid'; return mid.map((v, i) => v == null ? null : sig === 'upper' ? v * (1 + pct / 100) : sig === 'lower' ? v * (1 - pct / 100) : v); }
  if (condition.indicator === 'STDDEV') return sma(close, period).map((m, i) => m == null ? null : Math.sqrt(close.slice(i - period + 1, i + 1).reduce((sum, value) => sum + (value - m) ** 2, 0) / period));
  if (condition.indicator === 'HV') return close.map((_, i) => i < period ? null : Math.sqrt(close.slice(i - period + 1, i + 1).reduce((s, v, j, a) => j ? s + Math.log(v / a[j - 1]) ** 2 : s, 0) / period) * Math.sqrt(252) * 100);
  if (condition.indicator === 'VWMA') { const vol = data.map(c => c.volume || 1); return close.map((_, i) => i < period - 1 ? null : close.slice(i - period + 1, i + 1).reduce((s, p, j) => s + p * vol[i - period + 1 + j], 0) / vol.slice(i - period + 1, i + 1).reduce((s, x) => s + x, 0)); }
  if (condition.indicator === 'ALMA') { const offset = setting('offset', .85), sigma = setting('sigma', 6), m = Math.floor(offset * (period - 1)), sd = period / sigma, weights = Array.from({ length: period }, (_, j) => Math.exp(-.5 * ((j - m) / sd) ** 2)), wSum = weights.reduce((s, x) => s + x, 0); return close.map((_, i) => i < period - 1 ? null : weights.reduce((s, x, j) => s + x * close[i - period + 1 + j], 0) / wSum); }
  if (condition.indicator === 'ZLEMA') { const lag = Math.floor((period - 1) / 2); return ema(close.map((v, i) => i < lag ? v : 2 * v - close[i - lag]), period); }
  if (condition.indicator === 'LR') { const n = period, sx = n * (n - 1) / 2, sx2 = n * (n - 1) * (2 * n - 1) / 6; return close.map((_, i) => { if (i < n - 1) return null; let sy = 0, sxy = 0; for (let j = 0; j < n; j++) { sy += close[i - n + 1 + j]; sxy += j * close[i - n + 1 + j]; } const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx), intercept = (sy - slope * sx) / n; return intercept + slope * (n - 1); }); }
  if (condition.indicator === 'LSR') { const n = period, sx = n * (n - 1) / 2, sx2 = n * (n - 1) * (2 * n - 1) / 6; return close.map((_, i) => { if (i < n - 1) return null; let sy = 0, sxy = 0; for (let j = 0; j < n; j++) { sy += close[i - n + 1 + j]; sxy += j * close[i - n + 1 + j]; } return (n * sxy - sx * sy) / (n * sx2 - sx * sx); }); }
  if (condition.indicator === 'CMO') return close.map((_, i) => { if (i < period) return null; let up = 0, down = 0; for (let j = i - period + 1; j <= i; j++) { const diff = close[j] - close[j - 1]; if (diff >= 0) up += diff; else down -= diff; } return up + down === 0 ? 0 : (up - down) / (up + down) * 100; });
  if (condition.indicator === 'UO') { const tr = trueRange(data), bp = data.map((c, i) => c.close - Math.min(c.low, i ? data[i - 1].close : c.low)), ratio = (n, i) => { let bs = 0, ts = 0; for (let j = 0; j < n; j++) { if (bp[i - j] == null || tr[i - j] == null) return null; bs += bp[i - j]; ts += tr[i - j]; } return ts === 0 ? null : bs / ts; }, s1 = Math.max(1, setting('short', 7)), s2 = Math.max(1, setting('mid', 14)), s3 = Math.max(1, setting('long', 28)); return data.map((_, i) => { if (i < s3 - 1) return null; const r1 = ratio(s1, i), r2 = ratio(s2, i), r3 = ratio(s3, i); return r1 == null || r2 == null || r3 == null ? null : 100 * (4 * r1 + 2 * r2 + r3) / 7; }); }
  if (condition.indicator === 'KST') { const roc = n => close.map((v, i) => i < n || close[i - n] === 0 ? null : (v - close[i - n]) / close[i - n] * 100), r1 = ema(roc(Math.max(1, setting('roc1', 10))), Math.max(1, setting('sma1', 10))), r2 = ema(roc(Math.max(1, setting('roc2', 15))), Math.max(1, setting('sma2', 10))), r3 = ema(roc(Math.max(1, setting('roc3', 20))), Math.max(1, setting('sma3', 10))), r4 = ema(roc(Math.max(1, setting('roc4', 30))), Math.max(1, setting('sma4', 15))), kst = close.map((_, i) => r1[i] == null || r2[i] == null || r3[i] == null || r4[i] == null ? null : r1[i] + 2 * r2[i] + 3 * r3[i] + 4 * r4[i]), sig = ema(kst.map(x => x ?? 0), Math.max(1, setting('signal', 9))); return condition.signal === 'signal' ? sig : kst; }
  if (condition.indicator === 'RVI') { const tp = data.map(c => (c.high + c.low + c.close) / 3), mid = tp.map((v, i) => i ? (v + tp[i - 1]) / 2 : v), num = sma(mid, period), den = sma(data.map(c => c.high - c.low), period), rvi = num.map((v, i) => v == null || den[i] == null || den[i] === 0 ? null : v / den[i] * 100), sig = ema(rvi.map(x => x ?? 0), Math.max(1, setting('signal', 4))); return condition.signal === 'signal' ? sig : rvi; }
  if (condition.indicator === 'NATR') return sma(trueRange(data), period).map((v, i) => v == null || close[i] === 0 ? null : v / close[i] * 100);
  if (condition.indicator === 'BOP') return data.map(c => c.high === c.low ? 0 : (c.close - c.open) / (c.high - c.low));
  if (condition.indicator === 'PVT') { let pvt = 0; return close.map((v, i) => { if (i && close[i - 1]) pvt += (v - close[i - 1]) / close[i - 1] * data[i].volume; return pvt; }); }
  if (condition.indicator === 'CHOP') { const tr = trueRange(data), atrSum = i => tr.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0); return data.map((_, i) => { if (i < period - 1) return null; const window = data.slice(i - period + 1, i + 1), high = Math.max(...window.map(c => c.high)), low = Math.min(...window.map(c => c.low)); return high === low ? 0 : 100 * Math.log10(atrSum(i) / (high - low)) / Math.log10(period); }); }
  if (condition.indicator === 'PRC') { const sig = condition.signal || 'high'; return data.map((_, i) => i < period - 1 ? null : sig === 'low' ? Math.min(...data.slice(i - period + 1, i + 1).map(c => c.low)) : Math.max(...data.slice(i - period + 1, i + 1).map(c => c.high))); }
  if (condition.indicator === 'ELDER') { const avg = ema(close, period), bull = data.map((c, i) => avg[i] == null ? null : c.high - avg[i]), bear = data.map((c, i) => avg[i] == null ? null : c.low - avg[i]); return condition.signal === 'bear' ? bear : bull; }
  if (condition.indicator === 'MATH') {
    const a = customSeries(condition.a?.indicator === 'MATH' ? { indicator: 'CLOSE', params: {}, signal: null } : condition.a, data);
    const b = condition.b?.indicator === 'NUMBER' ? Number(condition.b.number) : customSeries(condition.b?.indicator === 'MATH' ? { indicator: 'CLOSE', params: {}, signal: null } : condition.b, data);
    const op = condition.op || 'sub';
    if (typeof b === 'number') return a.map(v => v == null ? null : mathApply(v, b, op));
    return a.map((v, i) => v == null || b[i] == null ? null : mathApply(v, b[i], op));
  }
  return close;
}
function conditionPass(condition, leftValues, rightValues, index, data) {
  const candleIndex = index + Math.min(0, Math.trunc(Number(condition.left.offset) || 0));
  const value = leftValues[candleIndex], previous = leftValues[candleIndex - 1];
  let target, previousTarget;
  if (condition.right.indicator === 'NUMBER') { target = Number(condition.right.number); previousTarget = target; }
  else {
    const referenceIndex = index + Math.min(0, Math.trunc(Number(condition.right.offset) || 0));
    target = rightValues[referenceIndex]; previousTarget = rightValues[referenceIndex - 1];
  }
  if (value == null || !Number.isFinite(target)) return false;
  if (condition.operator === 'crossesAbove') return candleIndex > 0 && previous != null && previousTarget != null && previous <= previousTarget && value > target;
  if (condition.operator === 'crossesBelow') return candleIndex > 0 && previous != null && previousTarget != null && previous >= previousTarget && value < target;
  if (condition.operator === 'aboveEqual') return value >= target;
  if (condition.operator === 'belowEqual') return value <= target;
  if (condition.operator === 'between' || condition.operator === 'outside') {
    if (condition.right.indicator !== 'NUMBER') return false;
    const upper = Number(condition.right.number2), low = Math.min(target, upper), high = Math.max(target, upper);
    if (!Number.isFinite(upper)) return false;
    return condition.operator === 'between' ? value >= low && value <= high : value < low || value > high;
  }
  return condition.operator === 'below' ? value < target : value > target;
}
function computeCustomStrategy(config, data, params = {}) {
  if (!config?.entryConditions?.length || !data?.length) return [];
  config = JSON.parse(JSON.stringify(config));
  config.entryConditions.forEach(normalizeCondition); (config.exitConditions || []).forEach(normalizeCondition);
  finalizeLogic(config.entryConditions, config.entryLogic); finalizeLogic(config.exitConditions, config.exitLogic);
  const entry = config.entryConditions.map(c => ({ condition: c, left: customSeries(c.left, data), right: c.right.indicator === 'NUMBER' ? null : customSeries(c.right, data) }));
  const exit = (config.exitConditions || []).map(c => ({ condition: c, left: customSeries(c.left, data), right: c.right.indicator === 'NUMBER' ? null : customSeries(c.right, data) }));
  const stopLoss = Math.max(0, Number(config.stopLoss) || 0), profitTarget = Math.max(0, Number(config.profitTarget) || 0), quantity = Math.max(1, Number(params.quantity) || 1), signals = [];
  const targetPrice = (entry, value, type, direction) => type === 'POINTS' ? entry + direction * value : type === 'AMOUNT' ? entry + direction * value / quantity : entry * (1 + direction * value / 100);
  const matches = (rules, index) => rules.reduce((result, rule, i) => {
    const pass = conditionPass(rule.condition, rule.left, rule.right, index, data);
    if (i === 0) return pass;
    return (rule.condition.connector || 'AND') === 'OR' ? result || pass : result && pass;
  }, false);
  let inPosition = false, entryPrice = 0;
  data.forEach((candle, index) => {
    if (!inPosition && matches(entry, index)) {
      inPosition = true; entryPrice = candle.close;
      signals.push({ type: 'buy', index, time: candle.time, price: candle.close });
    } else {
      const stopPrice = stopLoss > 0 ? targetPrice(entryPrice, stopLoss, config.stopLossType || 'PERCENT', -1) : null;
      const profitPrice = profitTarget > 0 ? targetPrice(entryPrice, profitTarget, config.profitTargetType || 'PERCENT', 1) : null;
      const stopped = inPosition && stopPrice != null && candle.low <= stopPrice;
      const targeted = inPosition && profitPrice != null && candle.high >= profitPrice;
      const indicatorExit = inPosition && exit.length && matches(exit, index);
      if (!inPosition || (!stopped && !targeted && !indicatorExit)) return;
      inPosition = false;
      signals.push({ type: 'sell', index, time: candle.time, price: stopped ? stopPrice : targeted ? profitPrice : candle.close, reason: stopped ? 'STOP' : targeted ? 'TARGET' : 'EXIT' });
    }
  });
  return signals;
}
function strategyParams() {
  const params = {};
  $$('#strategyParams input').forEach(input => { params[input.dataset.k] = Number(input.value) || 1; });
  return params;
}
function money(value) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value); }
function dateTime(time) { return new Date(time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
function executeBacktestShared(symbolsData, strategy, params, quantity, capital, maxTradesPerDay = 0) {
  const plans = symbolsData.map(({ symbol, data }) => {
    const signals = computeStrategy(strategy, { ...params, quantity }, data);
    const plan = [];
    let position = null;
    signals.forEach(signal => {
      if (signal.type === 'buy' && !position) {
        plan.push({ symbol, type: 'BUY', qty: quantity, price: signal.price, time: signal.time });
        position = { qty: quantity, price: signal.price };
      } else if (signal.type === 'sell' && position) {
        plan.push({ symbol, type: 'SELL', qty: position.qty, price: signal.price, time: signal.time, reason: signal.reason });
        position = null;
      }
    });
    if (position && data.length) {
      const close = data.at(-1);
      plan.push({ symbol, type: 'SELL', qty: position.qty, price: close.close, time: close.time, forced: true });
    }
    return { symbol, data, plan };
  });
  const events = plans.flatMap(plan => plan.plan).sort((a, b) => a.time - b.time);
  const opens = new Map(), realizedEvents = [], dailyTrades = new Map();
  let cash = capital;
  const orders = [];
  events.forEach(event => {
    if (event.type === 'BUY') {
      const qty = Math.min(event.qty, Math.floor(cash / event.price));
      if (qty < MIN_TRADE_QTY) return;
      if (maxTradesPerDay) {
        const day = Math.floor(event.time / 86400000), key = event.symbol + '|' + day;
        const count = dailyTrades.get(key) || 0;
        if (count >= maxTradesPerDay) return;
        dailyTrades.set(key, count + 1);
      }
      const amount = qty * event.price;
      cash -= amount;
      opens.set(event.symbol, { qty, price: event.price, amount });
      orders.push({ symbol: event.symbol, type: 'BUY', qty, price: event.price, amount, pnl: null, time: event.time });
    } else {
      const position = opens.get(event.symbol);
      if (!position) return;
      const amount = position.qty * event.price, pnl = amount - position.amount;
      cash += amount;
      opens.delete(event.symbol);
      realizedEvents.push({ time: event.time, pnl });
      orders.push({ symbol: event.symbol, type: 'SELL', qty: position.qty, price: event.price, amount, pnl, time: event.time, reason: event.reason, forced: event.forced });
    }
  });
  const netPnl = cash - capital;
  return plans.map(({ symbol, data }) => {
    const symbolOrders = orders.filter(order => order.symbol === symbol);
    const realizedByTime = new Map();
    realizedEvents.forEach(event => realizedByTime.set(event.time, (realizedByTime.get(event.time) || 0) + event.pnl));
    const orderByTime = new Map(symbolOrders.map(order => [order.time, order]));
    let realized = 0, openPosition = null;
    const equity = data.map(candle => {
      const order = orderByTime.get(candle.time);
      if (order) {
        if (order.type === 'BUY') openPosition = { qty: order.qty, price: order.price };
        else if (openPosition) openPosition = null;
      }
      if (realizedByTime.has(candle.time)) realized += realizedByTime.get(candle.time);
      return realized + (openPosition ? openPosition.qty * (candle.close - openPosition.price) : 0);
    });
    const completed = symbolOrders.filter(order => order.type === 'SELL' && order.pnl != null);
    const grossProfit = completed.filter(order => order.pnl > 0).reduce((sum, order) => sum + order.pnl, 0);
    const grossLoss = completed.filter(order => order.pnl < 0).reduce((sum, order) => sum + order.pnl, 0);
    const stockPnl = completed.reduce((sum, order) => sum + order.pnl, 0);
    return { symbol, data, orders: symbolOrders, equity, stockPnl, allocated: capital, endingValue: cash, pnl: netPnl, stats: { trades: completed.length, wins: completed.filter(order => order.pnl > 0).length, grossProfit, grossLoss } };
  });
}
function backtestMarkers(run) {
  const showPnl = pnlBadgeVisible;
  setMainMarkers(run.orders.map(order => ({
    time: order.time / 1000, position: order.type === 'BUY' ? 'belowBar' : 'aboveBar',
    color: order.type === 'BUY' ? '#55c99d' : '#e66e70', shape: order.type === 'BUY' ? 'arrowUp' : 'arrowDown',
    text: order.type === 'BUY' ? 'BUY' : (!showPnl || order.pnl == null) ? (order.forced ? 'EXIT' : 'SELL') : `${order.forced ? 'EXIT ' : ''}${order.pnl >= 0 ? '+' : ''}${money(order.pnl)}`
  })));
}
function showBacktestChart(symbol) {
  const run = backtestRuns.find(item => item.symbol === symbol);
  if (!run) return;
  inBacktestMode = true;
  clearInterval(liveTimer);
  candles = run.data;
  interval = $('#backtestInterval').value;
  $$('#timeframes button').forEach(button => button.classList.toggle('active', button.dataset.i === interval));
  $('#instrument').textContent = symbol;
  $('#symbol').value = symbol;
  $('#backtestStockSelect').value = symbol;
  $('#intervalName').textContent = ` - backtest ${interval}`;
  chart.applyOptions({ timeScale: { timeVisible: interval !== '1d' } });
  updateQuote(); render(); backtestMarkers(run);
  const firstSec = candles[0] ? candles[0].time / 1000 : 0;
  const lastSec = candles.length ? candles[candles.length - 1].time / 1000 : 0;
  const fitChart = () => {
    try { chart.timeScale().fitContent(); } catch(e) {}
    try { chart.timeScale().setVisibleLogicalRange({ from: 0, to: candles.length - 1 }); } catch(e) {}
    try { if (firstSec && lastSec) chart.timeScale().setVisibleRange({ from: firstSec, to: lastSec }); } catch(e) {}
  };
  requestAnimationFrame(() => { fitChart(); setTimeout(fitChart, 100); setTimeout(fitChart, 300); });
  const badge = $('#backtestPnlBadge'), badgePnl = run.stockPnl ?? run.pnl, badgeBase = backtestCapital ? backtestCapital / backtestRuns.length : run.allocated, badgePct = badgeBase ? badgePnl / badgeBase * 100 : 0;
  badge.className = 'pnl-badge';
  badge.classList.add(badgePnl >= 0 ? 'pnl-positive' : 'pnl-negative');
  badge.innerHTML = `<span>BACKTEST P&L · ${escapeHtml(symbol)}</span><b>${badgePnl >= 0 ? '+' : ''}${money(badgePnl)}</b><span>${badgePnl >= 0 ? '+' : ''}${badgePct.toFixed(2)}%</span>`;
  updatePnlBadge();
  $('#updated').textContent = `Backtest: ${symbol} · P&L ${badgePnl >= 0 ? '+' : ''}${money(badgePnl)} (${badgePct.toFixed(2)}%)`;
}
function updatePnlBadge() {
  const badge = $('#backtestPnlBadge');
  badge.hidden = !(inBacktestMode && pnlBadgeVisible && backtestRuns.length);
}
function renderBacktestResults() {
  const element = $('#backtestResults');
  const orders = backtestRuns.flatMap(run => run.orders);
  const invested = backtestCapital || backtestRuns.reduce((sum, run) => sum + run.allocated, 0);
  const pnl = backtestRuns.length ? backtestRuns[0].pnl : 0;
  const stats = backtestRuns.reduce((total, run) => ({ trades: total.trades + run.stats.trades, wins: total.wins + run.stats.wins, grossProfit: total.grossProfit + run.stats.grossProfit, grossLoss: total.grossLoss + run.stats.grossLoss }), { trades: 0, wins: 0, grossProfit: 0, grossLoss: 0 });
  const winRate = stats.trades ? stats.wins / stats.trades * 100 : 0, returnPct = invested ? pnl / invested * 100 : 0;
  element.hidden = false;
  element.innerHTML = `<div class="backtest-head"><span><strong>BACKTEST RESULTS</strong> · ${backtestRuns.length} stock${backtestRuns.length === 1 ? '' : 's'} · Capital ${money(invested)} · Net <span class="${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">${pnl >= 0 ? '+' : ''}${money(pnl)}</span></span><span><button id="exportBacktest" class="export-results" data-icon="&#x1F4E5;">Export Excel</button><button class="close-results" aria-label="Close results" data-icon="&#x2715;">×</button></span></div>` +
    `<div class="backtest-stats"><span>Trades <b>${stats.trades}</b></span><span>Win rate <b>${winRate.toFixed(1)}%</b></span><span>Gross profit <b class="pnl-positive">${money(stats.grossProfit)}</b></span><span>Gross loss <b class="pnl-negative">${money(stats.grossLoss)}</b></span><span>Return <b class="${returnPct >= 0 ? 'pnl-positive' : 'pnl-negative'}">${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%</b></span></div>` +
    `<table><thead><tr><th>Stock</th><th>Time</th><th>Side</th><th>Qty</th><th>Price</th><th>Amount</th><th>Profit / Loss</th></tr></thead><tbody>${orders.map(order => `<tr data-symbol="${order.symbol}"><td>${order.symbol}</td><td>${dateTime(order.time)}</td><td class="${order.type === 'BUY' ? 'pnl-positive' : 'pnl-negative'}">${order.type}${order.forced ? ' (exit)' : order.reason === 'STOP' ? ' (stop)' : order.reason === 'TARGET' ? ' (target)' : ''}</td><td>${order.qty}</td><td>${money(order.price)}</td><td>${money(order.amount)}</td><td class="${order.pnl == null ? '' : order.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">${order.pnl == null ? '—' : `${order.pnl >= 0 ? '+' : ''}${money(order.pnl)}`}</td></tr>`).join('') || '<tr><td colspan="7">No executable trades in this period.</td></tr>'}</tbody></table>`;
  $('.close-results').onclick = clearBacktest;
  $('#exportBacktest').onclick = exportBacktest;
  $$('#backtestResults tr[data-symbol]').forEach(row => row.onclick = () => showBacktestChart(row.dataset.symbol));
}
function exportBacktest() {
  if (!backtestRuns.length) return toast('Run a backtest before exporting.');
  if (!window.XLSX) return toast('Excel export is loading. Please try again.');
  const orders = backtestRuns.flatMap(run => run.orders);
  const invested = backtestCapital || backtestRuns.reduce((sum, run) => sum + run.allocated, 0), pnl = backtestRuns.length ? backtestRuns[0].pnl : 0;
  const trades = orders.filter(order => order.type === 'SELL' && order.pnl != null), wins = trades.filter(order => order.pnl > 0).length;
  const summary = [['Backtest Summary', 'Value'], ['Stocks tested', backtestRuns.length], ['Capital', invested], ['Net profit / loss', pnl], ['Return %', invested ? pnl / invested : 0], ['Completed trades', trades.length], ['Win rate', trades.length ? wins / trades.length : 0], ['Gross profit', trades.filter(order => order.pnl > 0).reduce((sum, order) => sum + order.pnl, 0)], ['Gross loss', trades.filter(order => order.pnl < 0).reduce((sum, order) => sum + order.pnl, 0)]];
  const ist = t => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const rows = orders.map(order => ({ Stock: order.symbol, Time: ist(order.time), Side: order.type, Exit_reason: order.forced ? 'End of test' : order.reason || '', Quantity: order.qty, Price: order.price, Amount: order.amount, Profit_Loss: order.pnl ?? null }));
  const workbook = XLSX.utils.book_new(), summarySheet = XLSX.utils.aoa_to_sheet(summary), tradesSheet = XLSX.utils.json_to_sheet(rows);
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 18 }]; tradesSheet['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary'); XLSX.utils.book_append_sheet(workbook, tradesSheet, 'Trades');
  backtestRuns.forEach(run => {
    const sheetName = run.symbol.replace(/[^A-Za-z0-9_\- ]/g, '-').slice(0, 31) || 'OHLC';
    const ohlcData = [['Time', 'Open', 'High', 'Low', 'Close', 'Volume']];
    run.data.forEach(c => ohlcData.push([ist(c.time), c.open, c.high, c.low, c.close, c.volume]));
    const ohlcSheet = XLSX.utils.aoa_to_sheet(ohlcData);
    ohlcSheet['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, ohlcSheet, sheetName);
  });
  XLSX.writeFile(workbook, `backtest-results-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
function clearBacktest() {
  backtestRuns = [];
  inBacktestMode = false;
  $('#backtestResults').hidden = true;
  $('#backtestStockSelect').hidden = true;
  updatePnlBadge();
  if (mainSeries) { render(); renderStrategy(); }
}
function renderSymbolCheckboxList(groups) {
  $('#backtestSymbols').innerHTML = groups.map(group =>
    `<div class="symbol-checkbox-group">${escapeHtml(group.category)}</div>` +
    group.symbols.map(symbol => `<label class="symbol-checkbox-row"><input type="checkbox" value="${escapeHtml(symbol.value)}"><span>${escapeHtml(symbol.label)}</span></label>`).join('')
  ).join('');
}
function selectedSymbols() { return [...document.querySelectorAll('#backtestSymbols input[type=checkbox]:checked')].map(input => input.value); }
function setSelectedSymbols(values) {
  const set = new Set(values);
  document.querySelectorAll('#backtestSymbols input[type=checkbox]').forEach(input => { input.checked = set.has(input.value); });
}
async function runBacktest() {
  const strategy = $('#strategy').value;
  const start = $('#backtestStart').value, end = $('#backtestEnd').value;
  const symbols = selectedSymbols();
  const quantity = Math.floor(Number($('#backtestQuantity').value));
  const capital = Number($('#backtestCapital').value);
  if (!strategy) return toast('Select and apply a strategy before running a backtest.');
  if (!start || !end || start > end) return toast('Enter a valid start and end date.');
  if (!symbols.length) return toast('Select at least one stock to test.');
  if (!quantity || quantity < 1 || !capital || capital <= 0) return toast('Quantity and capital must be positive values.');
  const period = $('#backtestInterval').value, fromSec = Math.floor(new Date(`${start}T00:00:00+05:30`).getTime() / 1000), toSec = Math.floor(new Date(`${end}T23:59:59+05:30`).getTime() / 1000);
  const seconds = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 }[period];
  const expectedCandles = Math.ceil((toSec - fromSec) / seconds) + 1;
  const BATCH = 5000;
  const button = $('#runBacktest'); button.disabled = true; button.textContent = 'Running…';
  $('#backtestStockSelect').hidden = true; $('#backtestStockSelect').innerHTML = '';
  const myGeneration = ++loadGeneration;
  inBacktestMode = true;
  clearInterval(liveTimer);
  try {
    const provider = $('#provider').value || 'DEMO';
    const symbolsData = [];
    const isDemo = provider === 'DEMO';
    for (let si = 0; si < symbols.length; si++) {
      const symbol = symbols[si];
      let allCandles = [];
      if (isDemo) {
        button.textContent = symbols.length > 1 ? `Fetching ${si + 1}/${symbols.length} ${symbol}…` : `Fetching ${symbol}…`;
        const limit = Math.min(100000, expectedCandles);
        const response = await fetch(`/api/candles?provider=DEMO&symbol=${encodeURIComponent(symbol)}&interval=${period}&from=${fromSec}&to=${toSec}&limit=${limit}`);
        if (!response.ok) throw new Error(symbol);
        const data = await response.json();
        allCandles = (data.candles || []).filter(c => c.time >= fromSec * 1000 && c.time <= toSec * 1000);
      } else {
        let batchFrom = fromSec, batch = 0;
        while (batchFrom <= toSec) {
          batch++;
          button.textContent = symbols.length > 1 ? `Fetching ${si + 1}/${symbols.length} ${symbol}… batch ${batch}` : `Fetching ${symbol}… batch ${batch}`;
          const response = await fetch(`/api/candles?provider=${provider}&symbol=${encodeURIComponent(symbol)}&interval=${period}&from=${batchFrom}&to=${toSec}&limit=${BATCH}`);
          if (!response.ok) throw new Error(symbol);
          const data = await response.json();
          const candles = data.candles || [];
          if (!candles.length) break;
          allCandles.push(...candles);
          if (candles.length < BATCH) break;
          const lastTime = candles[candles.length - 1].time;
          batchFrom = Math.floor(lastTime / 1000) + seconds;
          if (batchFrom > toSec) break;
        }
        const seen = new Set();
        allCandles = allCandles.filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; }).sort((a, b) => a.time - b.time).filter(c => c.time >= fromSec * 1000 && c.time <= toSec * 1000);
      }
      symbolsData.push({ symbol, data: allCandles });
    }
    button.textContent = 'Running backtest…';
    backtestCapital = capital;
    backtestRuns = executeBacktestShared(symbolsData, strategy, strategyParams(), quantity, capital, Math.max(0, Math.trunc(Number($('#backtestMaxTrades').value) || 0)));
    const stockSelect = $('#backtestStockSelect');
    stockSelect.hidden = backtestRuns.length < 2;
    stockSelect.innerHTML = backtestRuns.map(run => `<option value="${escapeHtml(run.symbol)}">${escapeHtml(run.symbol)}</option>`).join('');
    renderBacktestResults(); showBacktestChart(symbols[0]);
  } catch (error) { toast('Could not load historical candles for this backtest.'); }
  finally { button.disabled = false; button.textContent = 'Run Backtest'; }
}
function renderStrategy() {
  const name = $('#strategy').value;
  const summary = $('#strategySummary');
  if (!name || !candles.length) { if (!inBacktestMode) setMainMarkers([]); summary.innerHTML = ''; return; }
  const keyed = {};
  $$('#strategyParams input').forEach(inp => { keyed[inp.dataset.k] = Number(inp.value) || Number(inp.placeholder); });
  const signals = computeStrategy(name, keyed, candles);
  if (!signals.length) { if (!inBacktestMode) setMainMarkers([]); summary.innerHTML = '<div>No signals generated.</div>'; return; }
  if (!inBacktestMode) setMainMarkers(signals.map(s => ({ time: s.time / 1000, position: s.type === 'buy' ? 'belowBar' : 'aboveBar', color: s.type === 'buy' ? '#55c99d' : '#e66e70', shape: s.type === 'buy' ? 'arrowUp' : 'arrowDown', text: s.type.toUpperCase() })));
  let wins = 0, total = 0, pnl = 0;
  for (let i = 0; i < signals.length - 1; i += 2) {
    if (signals[i].type === 'buy' && signals[i + 1]?.type === 'sell') {
      const ret = (signals[i + 1].price - signals[i].price) / signals[i].price * 100;
      pnl += ret; total++; if (ret > 0) wins++;
    }
  }
  summary.innerHTML = `<div>Signals: <span>${signals.length}</span> | Trades: <span>${total}</span> | Win rate: <span>${total ? (wins / total * 100).toFixed(0) : 0}%</span> | P&L: <span class="${pnl >= 0 ? 'signal-buy' : 'signal-sell'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%</span></div>`;
}
function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); setTimeout(() => element.classList.remove('show'), 3200); }
const brokerSlugFor = id => ({ ANGEL_ONE: 'angel-one', ZERODHA: 'zerodha', UPSTOX: 'upstox', FYERS: 'fyers' }[id] || id.toLowerCase());
const brokerHasSaved = id => account.loggedIn && account.profiles.some(p => p.broker === brokerSlugFor(id));

async function refreshAccount() {
  try {
    const res = await fetch('/api/account/me');
    if (!res.ok) throw Error();
    account = await res.json();
    account.profiles ||= [];
  } catch { account = { loggedIn: false, username: '', profiles: [] }; }
  renderAccountButton();
}
function renderAccountButton() {
  const btn = $('#accountBtn');
  if (!btn) return;
  if (account.loggedIn) {
    const initials = (account.username || '?').slice(0, 2).toUpperCase();
    btn.textContent = initials;
    btn.title = account.username + ' — saved credentials';
  } else {
    btn.textContent = 'Sign in';
    btn.title = 'Sign in or create an account';
  }
}
function openAccountDialog(mode = 'login') {
  accountMode = mode;
  const login = mode === 'login';
  $('#accountDialogTitle').textContent = login ? 'Sign in' : 'Create an account';
  $('#accountDialogSubmit').textContent = login ? 'Sign in' : 'Create account';
  $('#accountSwitchText').textContent = login ? 'New here?' : 'Already have an account?';
  $('#accountSwitch').textContent = login ? 'Create an account' : 'Sign in';
  $('#accountPassword').setAttribute('autocomplete', login ? 'current-password' : 'new-password');
  $('#accountError').textContent = '';
  $('#accountPassword').value = '';
  $('#accountUsername').focus();
  document.getElementById('accountDialog').showModal();
}
async function submitAccount() {
  const username = $('#accountUsername').value.trim();
  const password = $('#accountPassword').value;
  if (!username || !password) { $('#accountError').textContent = 'Enter a username and password.'; return; }
  $('#accountDialogSubmit').disabled = true;
  try {
    const res = await fetch('/api/account/' + (accountMode === 'login' ? 'login' : 'register'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { $('#accountError').textContent = data.message || 'Request failed.'; return; }
    document.getElementById('accountDialog').close();
    await refreshAccount();
    toast(accountMode === 'login' ? 'Signed in as ' + username + '.' : 'Account created and signed in as ' + username + '.');
    if ($('#provider').value) $('#provider').dispatchEvent(new Event('change'));
  } catch { $('#accountError').textContent = 'Could not reach the server.'; }
  finally { $('#accountDialogSubmit').disabled = false; }
}
async function logout() {
  try { await fetch('/api/account/logout', { method: 'POST' }); } catch { }
  document.getElementById('vaultDialog').close();
  await refreshAccount();
  toast('Signed out.');
  if ($('#provider').value) $('#provider').dispatchEvent(new Event('change'));
}
async function openVaultDialog() {
  await refreshAccount();
  if (!account.loggedIn) { openAccountDialog('login'); return; }
  $('#vaultUsername').textContent = account.username;
  const byBroker = {};
  account.profiles.forEach(p => { (byBroker[p.broker] ||= []).push(p); });
  const brokerNames = { 'angel-one': 'Angel One', 'zerodha': 'Zerodha', 'upstox': 'Upstox', 'fyers': 'Fyers' };
  $('#vaultList').innerHTML = Object.entries(byBroker).map(([broker, items]) =>
    '<div class="vault-group"><div class="vault-group-name">' + (brokerNames[broker] || broker) + '</div>' +
    items.map(p => '<div class="vault-item"><span class="vault-item-name">' + escapeHtml(p.name) + '</span><span class="vault-actions"><button data-use="' + p.id + '" data-icon="&#x2713;">Use</button><button data-delete="' + p.id + '" class="danger" data-icon="&#x1F5D1;">Delete</button></span></div>').join('') +
    '</div>').join('');
  $('#vaultEmpty').style.display = account.profiles.length ? 'none' : 'block';
  $$('#vaultList [data-use]').forEach(b => b.onclick = () => reuseSavedProfile(Number(b.dataset.use)));
  $$('#vaultList [data-delete]').forEach(b => b.onclick = async () => {
    try { await fetch('/api/vault/' + b.dataset.delete, { method: 'DELETE' }); } catch { }
    await refreshAccount();
    openVaultDialog();
  });
  document.getElementById('vaultDialog').showModal();
}
async function reuseSavedProfile(id) {
  let info;
  try {
    const res = await fetch('/api/vault/' + id + '/use');
    if (!res.ok) throw Error();
    info = await res.json();
  } catch { toast('Could not load the saved profile.'); return; }
  if (info.broker === 'angel-one') {
    $('#provider').value = 'ANGEL_ONE';
    openAngelOneDialog(info.data);
    return;
  }
  const data = info.broker === 'fyers' ? { apiKey: info.data.appId, apiSecret: info.data.appSecret } : { apiKey: info.data.apiKey, apiSecret: info.data.apiSecret };
  try {
    const res = await fetch('/api/auth/' + info.broker + '/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw Error();
    window.location.assign('/api/auth/' + info.broker + '/start');
  } catch { toast('Could not reuse the saved profile.'); }
}
async function saveProfileToVault(brokerSlug, data) {
  if (!account.loggedIn) return;
  const name = $('#vaultSaveName').value.trim();
  if (!name) return;
  try {
    const res = await fetch('/api/vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ broker: brokerSlug, name, data }) });
    if (!res.ok) throw Error();
    $('#vaultSaveName').value = '';
    await refreshAccount();
    toast('Credentials saved for reuse.');
  } catch { toast('Could not save the credentials for reuse.'); }
}
function populateBrokerSavedSelect(brokerSlug, showSaveRow) {
  const select = $('#brokerSavedProfiles');
  const saveRow = document.querySelector('.dialog-save-row');
  const profiles = account.profiles.filter(p => p.broker === brokerSlug);
  $('#brokerSavedSection').style.display = profiles.length ? 'block' : 'none';
  saveRow.style.display = showSaveRow ? 'block' : 'none';
  select.innerHTML = '<option value="">Select a saved profile…</option>' + profiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  select.onchange = async () => {
    if (!select.value) return;
    try {
      const res = await fetch('/api/vault/' + select.value + '/use');
      if (!res.ok) throw Error();
      applySavedProfile(brokerSlug, (await res.json()).data);
    } catch { toast('Could not load the saved profile.'); }
  };
}
function applySavedProfile(brokerSlug, data) {
  if (brokerSlug === 'angel-one') {
    $('#brokerAngelApiKey').value = data.apiKey || '';
    $('#brokerClientCode').value = data.clientCode || '';
    $('#brokerPin').value = data.pin || '';
    $('#brokerTotp').focus();
  } else if (brokerSlug === 'zerodha') {
    $('#brokerApiKey').value = data.apiKey || '';
    $('#brokerApiSecret').value = data.apiSecret || '';
  } else if (brokerSlug === 'upstox') {
    $('#brokerUpstoxApiKey').value = data.apiKey || '';
    $('#brokerUpstoxApiSecret').value = data.apiSecret || '';
  } else if (brokerSlug === 'fyers') {
    $('#brokerFyersAppId').value = data.appId || '';
    $('#brokerFyersAppSecret').value = data.appSecret || '';
  }
}
async function confirmDisconnect(provider, name) {
  const url = provider === 'ANGEL_ONE' ? '/api/auth/angel-one/disconnect' : provider === 'ZERODHA' ? '/api/auth/zerodha/disconnect' : null;
  if (!url) { toast(name + ' is already connected.'); return; }
  const dialog = document.getElementById('brokerDialog');
  document.getElementById('brokerDialogTitle').textContent = 'Disconnect from ' + name + '?';
  document.getElementById('brokerDialogText').textContent = 'The saved connection will be revoked. Reconnecting requires a fresh ' + name + ' login (TOTP for Angel One).';
  document.getElementById('brokerDialogFields').style.display = 'none';
  const btn = document.getElementById('brokerDialogContinue');
  btn.textContent = 'Disconnect';
  btn.onclick = async () => {
    dialog.close();
    try {
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw Error('Disconnect failed.');
      toast('Disconnected from ' + name + '.');
      if ($('#provider').value === provider) $('#provider').dispatchEvent(new Event('change'));
    } catch (e) { toast(e.message || 'Disconnect failed.'); }
  };
  dialog.addEventListener('close', () => { btn.textContent = 'Continue to broker login'; }, { once: true });
  dialog.showModal();
}
async function openAngelOneDialog(prefill) {
  try {
    const status = await (await fetch('/api/auth/angel-one/status')).json();
    if (status.connected) { confirmDisconnect('ANGEL_ONE', 'Angel One'); return; }
    const hasSaved = !!status.hasCredentials || !!prefill;
    const dialog = document.getElementById('brokerDialog');
    document.getElementById('brokerDialogTitle').textContent = 'Connect Angel One';
    document.getElementById('brokerDialogText').textContent = hasSaved ? 'Saved SmartAPI details are pre-filled below. Use them as-is or enter new values, then add your current TOTP.' : 'Enter your SmartAPI key and Angel One credentials.';
    document.getElementById('brokerAngelCredentials').style.display = 'block';
    document.getElementById('brokerFieldsZerodha').style.display = 'none';
    document.getElementById('brokerFieldsAngel').style.display = 'block';
    document.getElementById('brokerFieldsUpstox').style.display = 'none';
    document.getElementById('brokerFieldsFyers').style.display = 'none';
    document.getElementById('brokerDialogFields').style.display = 'block';
    $('#brokerAngelApiKey').value = prefill?.apiKey || status.apiKey || '';
    $('#brokerClientCode').value = prefill?.clientCode || status.clientCode || '';
    $('#brokerPin').value = prefill?.pin || status.pin || '';
    $('#brokerTotp').value = '';
    populateBrokerSavedSelect('angel-one', true);
    document.getElementById('brokerDialogContinue').onclick = async () => {
      const apiKey = $('#brokerAngelApiKey').value.trim();
      const clientCode = $('#brokerClientCode').value.trim();
      const pin = $('#brokerPin').value.trim();
      const totp = $('#brokerTotp').value.trim();
      if (!/^\d{6}$/.test(totp)) { toast('TOTP must be a 6-digit code.'); return; }
      if (!hasSaved && (!clientCode || !pin)) { toast('Client ID and PIN are required.'); return; }
      dialog.close();
      document.getElementById('brokerDialogFields').style.display = 'none';
      document.getElementById('brokerFieldsAngel').style.display = 'none';
      try {
        const res = await fetch('/api/auth/angel-one/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, clientCode, pin, totp }) });
        if (!res.ok) throw Error((await res.json()).message);
        await saveProfileToVault('angel-one', { apiKey, clientCode, pin });
        toast('Angel One connected.');
        if ($('#provider').value !== 'ANGEL_ONE') $('#provider').value = 'ANGEL_ONE';
        $('#provider').dispatchEvent(new Event('change'));
      } catch (e) { toast(e.message || 'Angel One connection failed.'); }
    };
    dialog.showModal();
  } catch { toast('Could not start the Angel One connection.'); }
}
async function openZerodhaDialog() {
  try {
    const status = await (await fetch('/api/auth/zerodha/status')).json();
    if (status.connected) { confirmDisconnect('ZERODHA', 'Zerodha'); return; }
    if (!status.configured) {
      const dialog = document.getElementById('brokerDialog');
      document.getElementById('brokerDialogTitle').textContent = 'Connect Zerodha';
      document.getElementById('brokerDialogText').textContent = 'Enter your Kite Connect API credentials from developers.kite.zerodha.com';
      document.getElementById('brokerFieldsAngel').style.display = 'none';
      document.getElementById('brokerFieldsZerodha').style.display = 'block';
      document.getElementById('brokerFieldsUpstox').style.display = 'none';
      document.getElementById('brokerFieldsFyers').style.display = 'none';
      document.getElementById('brokerDialogFields').style.display = 'block';
      document.getElementById('brokerApiKey').value = '';
      document.getElementById('brokerApiSecret').value = '';
      populateBrokerSavedSelect('zerodha', true);
      document.getElementById('brokerDialogContinue').onclick = async () => {
        const apiKey = document.getElementById('brokerApiKey').value.trim();
        const apiSecret = document.getElementById('brokerApiSecret').value.trim();
        if (!apiKey || !apiSecret) { toast('API Key and Secret are required.'); return; }
        dialog.close();
        document.getElementById('brokerDialogFields').style.display = 'none';
        try {
          const res = await fetch('/api/auth/zerodha/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, apiSecret }) });
          if (!res.ok) throw Error((await res.json()).message);
          await saveProfileToVault('zerodha', { apiKey, apiSecret });
          window.location.assign('/api/auth/zerodha/start');
        } catch (e) { toast(e.message || 'Failed to configure Zerodha.'); }
      };
      dialog.showModal();
      return;
    }
    window.location.assign('/api/auth/zerodha/start');
  } catch { toast('Could not start the Zerodha connection.'); }
}
async function openOAuthDialog(provider) {
  const slug = provider === 'UPSTOX' ? 'upstox' : 'fyers';
  try {
    const status = await (await fetch('/api/auth/' + slug + '/status')).json();
    if (status.connected) { confirmDisconnect(provider, provider === 'UPSTOX' ? 'Upstox' : 'Fyers'); return; }
    if (status.configured) { window.location.assign('/api/auth/' + slug + '/start'); return; }
    const isUpstox = provider === 'UPSTOX';
    const dialog = document.getElementById('brokerDialog');
    document.getElementById('brokerDialogTitle').textContent = 'Connect ' + (isUpstox ? 'Upstox' : 'Fyers');
    document.getElementById('brokerDialogText').textContent = 'Enter your ' + (isUpstox ? 'Upstox' : 'Fyers') + ' API credentials.';
    document.getElementById('brokerFieldsZerodha').style.display = 'none';
    document.getElementById('brokerFieldsAngel').style.display = 'none';
    document.getElementById('brokerFieldsUpstox').style.display = isUpstox ? 'block' : 'none';
    document.getElementById('brokerFieldsFyers').style.display = isUpstox ? 'none' : 'block';
    document.getElementById('brokerDialogFields').style.display = 'block';
    $(isUpstox ? '#brokerUpstoxApiKey' : '#brokerFyersAppId').value = '';
    $(isUpstox ? '#brokerUpstoxApiSecret' : '#brokerFyersAppSecret').value = '';
    populateBrokerSavedSelect(slug, true);
    document.getElementById('brokerDialogContinue').onclick = async () => {
      const apiKey = $(isUpstox ? '#brokerUpstoxApiKey' : '#brokerFyersAppId').value.trim();
      const apiSecret = $(isUpstox ? '#brokerUpstoxApiSecret' : '#brokerFyersAppSecret').value.trim();
      if (!apiKey || !apiSecret) { toast('All fields are required.'); return; }
      dialog.close();
      document.getElementById('brokerDialogFields').style.display = 'none';
      document.getElementById('brokerFieldsUpstox').style.display = 'none';
      document.getElementById('brokerFieldsFyers').style.display = 'none';
      try {
        const res = await fetch('/api/auth/' + slug + '/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, apiSecret }) });
        if (!res.ok) throw Error((await res.json()).message);
        await saveProfileToVault(slug, isUpstox ? { apiKey, apiSecret } : { appId: apiKey, appSecret: apiSecret });
        window.location.assign('/api/auth/' + slug + '/start');
      } catch (e) { toast(e.message || 'Failed to configure ' + slug + '.'); }
    };
    dialog.showModal();
  } catch { toast('Could not start the ' + provider + ' connection.'); }
}
document.addEventListener('click', async event => {
  if (event.target.id !== 'connect' || $('#provider').value === 'DEMO') return;
  event.preventDefault(); event.stopImmediatePropagation();
  const provider = $('#provider').value;
  if (provider === 'ANGEL_ONE') { openAngelOneDialog(); return; }
  if (provider === 'ZERODHA') { openZerodhaDialog(); return; }
  if (provider === 'UPSTOX' || provider === 'FYERS') { openOAuthDialog(provider); return; }
  const broker = provider.toLowerCase();
  try {
    const status = await (await fetch('/api/auth/' + broker + '/status')).json();
    if (status.connected) { confirmDisconnect(provider, $('#provider option:checked').textContent || provider); return; }
    if (status.configured) { window.location.assign('/api/auth/' + broker + '/start'); return; }
    toast($('#provider option:checked').textContent + ' is not configured on this server.');
  } catch { toast('Could not start the ' + $('#provider option:checked').textContent + ' connection.'); }
}, true);
const CHART_THEMES = {
  dark: { bg: '#0c1014', text: '#82919d', grid: '#172129', border: '#26313a', crosshair: '#4f6570' },
  light: { bg: '#ffffff', text: '#5f6f7c', grid: '#e6ebef', border: '#d5dce3', crosshair: '#9aa8b3' }
};
const currentTheme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const lineColor = () => currentTheme() === 'light' ? '#0e9d94' : '#47d7d1';
function applyChartTheme() {
  if (!chart) return;
  const t = CHART_THEMES[currentTheme()];
  chart.applyOptions({
    layout: { background: { color: t.bg }, textColor: t.text },
    grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
    rightPriceScale: { borderColor: t.border },
    timeScale: { borderColor: t.border },
    crosshair: { vertLine: { color: t.crosshair }, horzLine: { color: t.crosshair } }
  });
}
function initTheme() {
  const saved = localStorage.getItem('prism.theme') || 'light';
  document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
  const toggle = $('#themeToggle');
  if (!toggle) return;
  const light = currentTheme() === 'light';
  toggle.textContent = light ? '☾' : '☀';
  toggle.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  toggle.title = light ? 'Switch to dark theme' : 'Switch to light theme';
  toggle.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('prism.theme', next);
    const isLight = next === 'light';
    toggle.textContent = isLight ? '☾' : '☀';
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    toggle.title = isLight ? 'Switch to dark theme' : 'Switch to light theme';
    applyChartTheme();
    setSeries();
  });
}
function saveBacktestSettings() {
  try {
    const s = {
      provider: $('#provider').value,
      symbol: $('#symbol').value,
      interval, chartType,
      strategy: $('#strategy').value,
      strategyParams: Object.fromEntries($$('#strategyParams input').map(i => [i.dataset.k, i.value])),
      backtestInterval: $('#backtestInterval').value,
      backtestStart: $('#backtestStart').value,
      backtestEnd: $('#backtestEnd').value,
      backtestQuantity: $('#backtestQuantity').value,
      backtestCapital: $('#backtestCapital').value,
      backtestMaxTrades: $('#backtestMaxTrades').value,
      selectedSymbols: selectedSymbols(),
      indicators: active.map(i => ({ name: i.name, config: { ...i.config } })),
      hasBacktestRuns: backtestRuns.length > 0,
    };
    localStorage.setItem('prism.pageSettings', JSON.stringify(s));
  } catch {}
}
async function restoreBacktestSettings() {
  let s;
  try { s = JSON.parse(localStorage.getItem('prism.pageSettings')); } catch { return; }
  if (!s) return;
  if (s.provider) $('#provider').value = s.provider;
  if (s.symbol) $('#symbol').value = s.symbol;
  if (s.interval) { interval = s.interval; $$('#timeframes button').forEach(b => b.classList.toggle('active', b.dataset.i === s.interval)); }
  if (s.chartType) { chartType = s.chartType; $$('.chart-type').forEach(b => b.classList.toggle('active', b.dataset.type === s.chartType)); setSeries(); }
  if (s.strategy) { $('#strategy').value = s.strategy; $('#strategy').dispatchEvent(new Event('change')); }
  if (s.strategyParams) $$('#strategyParams input').forEach(i => { if (i.dataset.k in s.strategyParams) i.value = s.strategyParams[i.dataset.k]; });
  if (s.backtestInterval) $('#backtestInterval').value = s.backtestInterval;
  if (s.backtestStart) $('#backtestStart').value = s.backtestStart;
  if (s.backtestEnd) $('#backtestEnd').value = s.backtestEnd;
  if (s.backtestQuantity) $('#backtestQuantity').value = s.backtestQuantity;
  if (s.backtestCapital) $('#backtestCapital').value = s.backtestCapital;
  if (s.backtestMaxTrades) $('#backtestMaxTrades').value = s.backtestMaxTrades;
  if (s.selectedSymbols?.length) setSelectedSymbols(s.selectedSymbols);
  if (s.indicators?.length) { active = s.indicators.map(i => ({ name: i.name, config: { ...i.config } })); showIndicators(); render(); }
  if (s.hasBacktestRuns) { await runBacktest(); }
}
window.addEventListener('beforeunload', saveBacktestSettings);
setup();

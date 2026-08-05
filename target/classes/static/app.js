const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const COLORS = ['#47d7d1', '#f1bd56', '#b88cff', '#f27675', '#75b9ff', '#9bdc71'];
let chart, mainSeries, candles = [], interval = '1d', chartType = 'candlestick', active = [], liveTimer, loadingMore = false, backtestRuns = [], customStrategies = new Map(), customDraft = { entryConditions: [], exitConditions: [], stopLoss: 0 };
let account = { loggedIn: false, username: '', profiles: [] }, accountMode = 'login';
let indicatorPane = 0;
let mainMarkers = null;
const intervalSeconds = () => ({ '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 }[interval] || 86400);
const INDICATOR_PARAMS = {
  BB: [['period', 'Period', 20], ['std', 'Std dev', 2]], KC: [['period', 'EMA', 20], ['mult', 'ATR mult', 2]], DC: [['period', 'Period', 20]], ENVELOPE: [['period', 'Period', 20], ['percent', 'Width %', 2.5]],
  SAR: [['accel', 'Acceleration', .02], ['maxAccel', 'Maximum', .2]], SUPERTREND: [['atrPeriod', 'ATR period', 10], ['mult', 'Multiplier', 3]], ICHIMOKU: [['conversion', 'Conversion', 9], ['base', 'Base', 26], ['spanB', 'Span B', 52]],
  MACD: [['fast', 'Fast', 12], ['slow', 'Slow', 26], ['signal', 'Signal', 9]], PPO: [['fast', 'Fast', 12], ['slow', 'Slow', 26]], STOCH: [['k', '%K', 14], ['d', '%D', 3]],
  AO: [['fast', 'Fast', 5], ['slow', 'Slow', 34]], ROC: [['period', 'Period', 12]], ATR: [['period', 'Period', 14]], CCI: [['period', 'Period', 20]], WILLIAMS_R: [['period', 'Period', 14]], MFI: [['period', 'Period', 14]], ADX: [['period', 'Period', 14]], ADOSC: [['fast', 'Fast', 3], ['slow', 'Slow', 10]]
};
const indicatorParams = name => INDICATOR_PARAMS[name] || [['period', 'Period', 14]];
const defaultIndicatorConfig = name => Object.fromEntries(indicatorParams(name).map(([key, , value]) => [key, value]));

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
    timeScale: { borderColor: t.border, timeVisible: true, tickMarkFormatter: t => new Date(t * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
    crosshair: { vertLine: { color: t.crosshair }, horzLine: { color: t.crosshair } },
    localization: { timeFormatter: t => new Date(t * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  });
  window.addEventListener('resize', () => chart.applyOptions({ width: $('#chart').clientWidth, height: $('#chart').clientHeight }));
  setSeries();
}
function setSeries() {
  if (mainSeries) chart.removeSeries(mainSeries);
  const config = chartType === 'line' ? { color: lineColor(), lineWidth: 2 }
    : chartType === 'bar' ? { upColor: '#55c99d', downColor: '#e66e70', openVisible: true }
    : { upColor: '#55c99d', downColor: '#e66e70', borderUpColor: '#55c99d', borderDownColor: '#e66e70', wickUpColor: '#55c99d', wickDownColor: '#e66e70' };
  mainSeries = chartType === 'line' ? chart.addSeries(LightweightCharts.LineSeries, config) : chartType === 'bar' ? chart.addSeries(LightweightCharts.BarSeries, config) : chart.addSeries(LightweightCharts.CandlestickSeries, config);
  mainMarkers = null;
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
function render(fit = true) {
  if (!candles.length) return;
  const data = chartType === 'line' ? candles.map(x => ({ time: x.time / 1000, value: x.close }))
    : candles.map(x => ({ time: x.time / 1000, open: x.open, high: x.high, low: x.low, close: x.close }));
  mainSeries.setData(data); removeIndicators(); indicatorPane = 0; active.forEach((item, i) => drawIndicator(item.name, item.config?.color || COLORS[i % COLORS.length], item.config || { period: item.period || 14 })); layoutPanes(); if (fit) chart.timeScale().fitContent();
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
async function load() { const provider = $('#provider').value || 'DEMO', symbol = $('#symbol').value.trim() || 'NSE:RELIANCE'; $('#updated').textContent = 'Fetching candles...'; try { const response = await fetch(`/api/candles?provider=${provider}&symbol=${encodeURIComponent(symbol)}&interval=${interval}`); if (!response.ok) throw Error(); const data = await response.json(); candles = data.candles; $('#instrument').textContent = data.symbol; $('#intervalName').textContent = ` - ${{ '1m':'1 minute','5m':'5 minutes','15m':'15 minutes','1h':'1 hour','1d':'1 day' }[interval]}`; updateQuote(); render(); renderStrategy(); $('#updated').textContent = 'Live data connected'; startLiveUpdates(); } catch { toast('Could not load market candles. Select Demo or connect a broker.'); } }
async function refreshLiveCandle() { const provider = $('#provider').value || 'DEMO'; try { const response = await fetch(`/api/live-candle?provider=${provider}&symbol=${encodeURIComponent($('#symbol').value.trim() || 'NSE:RELIANCE')}&interval=${interval}`); if (!response.ok) { clearInterval(liveTimer); $('#updated').textContent = 'Broker stream requires connection'; return; } const latest = await response.json(); const last = candles.length - 1; candles[last] = { ...latest, time: candles[last].time }; const point = chartType === 'line' ? { time: candles[last].time / 1000, value: latest.close } : { time: candles[last].time / 1000, open: latest.open, high: latest.high, low: latest.low, close: latest.close }; mainSeries.update(point); removeIndicators(); indicatorPane = 0; active.forEach((item, i) => drawIndicator(item.name, item.config?.color || COLORS[i % COLORS.length], item.config || { period: item.period || 14 })); layoutPanes(); updateQuote(); $('#updated').textContent = `Live update ${new Date().toLocaleTimeString()}`; } catch { $('#updated').textContent = 'Live feed reconnecting...'; } }
function startLiveUpdates() { clearInterval(liveTimer); liveTimer = setInterval(refreshLiveCandle, 2500); }
async function loadMore() {
  if (loadingMore) return;
  loadingMore = true;
  try {
    const provider = $('#provider').value || 'DEMO';
    const symbol = $('#symbol').value.trim() || 'NSE:RELIANCE';
    const to = Math.floor(candles[0].time / 1000) - 1;
    const response = await fetch(`/api/candles?provider=${provider}&symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=180&to=${to}`);
    if (!response.ok) return;
    const data = await response.json();
    if (!data.candles || !data.candles.length) return;
    candles = [...data.candles, ...candles];
    render(false); renderStrategy();
  } finally { loadingMore = false; }
}
function conditionRow(kind, condition, index) {
  const options = [['CLOSE', 'Close'], ['OPEN', 'Open'], ['HIGH', 'High'], ['LOW', 'Low'], ['VOLUME', 'Volume'], ['TYPICAL', 'Typical price'], ['SMA', 'SMA'], ['EMA', 'EMA'], ['WMA', 'WMA'], ['DEMA', 'Double EMA'], ['TEMA', 'Triple EMA'], ['HMA', 'Hull MA'], ['KAMA', 'Kaufman MA'], ['SAR', 'Parabolic SAR'], ['SUPERTREND', 'Supertrend'], ['RSI', 'RSI'], ['MACD', 'MACD'], ['STOCH', 'Stochastic %K'], ['MFI', 'MFI'], ['CCI', 'CCI'], ['WILLIAMS_R', 'Williams %R'], ['ROC', 'Rate of Change'], ['MOM', 'Momentum'], ['ATR', 'Average True Range'], ['ADX', 'ADX'], ['AROON', 'Aroon oscillator'], ['VWAP', 'VWAP'], ['OBV', 'On-Balance Volume'], ['ADL', 'Accumulation/Distribution'], ['CMF', 'Chaikin Money Flow'], ['FI', 'Force Index'], ['BB_UPPER', 'Bollinger Upper'], ['BB_MID', 'Bollinger Middle'], ['BB_LOWER', 'Bollinger Lower'], ['DC_HIGH', 'Donchian High'], ['DC_LOW', 'Donchian Low'], ['KC_UPPER', 'Keltner Upper'], ['KC_LOWER', 'Keltner Lower']].map(([value, label]) => `<option value="${value}" ${condition.indicator === value ? 'selected' : ''}>${label}</option>`).join('');
  const operators = [['above', 'above'], ['aboveEqual', 'above or equal'], ['below', 'below'], ['belowEqual', 'below or equal'], ['crossesAbove', 'crosses above'], ['crossesBelow', 'crosses below'], ['between', 'between'], ['outside', 'outside range']].map(([value, label]) => `<option value="${value}" ${condition.operator === value ? 'selected' : ''}>${label}</option>`).join('');
  const targets = [['NUMBER', 'Number'], ['CLOSE', 'Candle close']].map(([value, label]) => `<option value="${value}" ${(condition.targetMode || 'NUMBER') === value ? 'selected' : ''}>${label}</option>`).join('');
  return `<div class="custom-condition" data-kind="${kind}" data-index="${index}"><select data-field="indicator">${options}</select><input data-field="period" type="number" min="2" max="200" value="${condition.period || 14}" title="Indicator period"><input data-field="candleOffset" type="number" max="0" step="1" value="${Math.min(0, Number(condition.candleOffset) || 0)}" title="Indicator candle offset"><select data-field="operator">${operators}</select><select data-field="targetMode" title="Compare against"><option value="NUMBER">Number</option><option value="CLOSE">Candle close</option></select><input data-field="targetOffset" type="number" max="0" step="1" value="${Math.min(0, Number(condition.targetOffset) || 0)}" title="Reference close candle offset"><input data-field="value" type="number" step="any" value="${condition.value ?? ''}" placeholder="Lower/value" title="Numeric target value"><input data-field="value2" type="number" step="any" value="${condition.value2 ?? ''}" placeholder="Upper" title="Upper bound for range"><button data-remove-condition aria-label="Remove condition">×</button></div>`;
}
function renderCustomConditions() {
  $('#entryConditions').innerHTML = customDraft.entryConditions.map((condition, index) => conditionRow('entryConditions', condition, index)).join('');
  $('#exitConditions').innerHTML = customDraft.exitConditions.map((condition, index) => conditionRow('exitConditions', condition, index)).join('');
  $('#customStopLoss').value = customDraft.stopLoss || 0;
  $('#customStopLossType').value = customDraft.stopLossType || 'PERCENT';
  $('#customProfitTarget').value = customDraft.profitTarget || 0;
  $('#customProfitTargetType').value = customDraft.profitTargetType || 'PERCENT';
  $('#entryLogic').value = customDraft.entryLogic || 'AND';
  $('#exitLogic').value = customDraft.exitLogic || 'AND';
  $$('.custom-condition').forEach(row => {
    row.querySelectorAll('[data-field]').forEach(input => input.onchange = () => {
      const condition = customDraft[row.dataset.kind][Number(row.dataset.index)];
      condition[input.dataset.field] = ['period', 'value', 'value2', 'candleOffset', 'targetOffset'].includes(input.dataset.field) ? Number(input.value) : input.value;
    });
    row.querySelector('[data-remove-condition]').onclick = () => { customDraft[row.dataset.kind].splice(Number(row.dataset.index), 1); renderCustomConditions(); };
  });
}
function addCustomCondition(kind) {
  customDraft[kind].push({ indicator: 'RSI', period: 14, candleOffset: 0, operator: kind === 'entryConditions' ? 'below' : 'above', targetMode: 'NUMBER', targetOffset: 0, value: kind === 'entryConditions' ? 30 : 70 });
  renderCustomConditions();
}
function resetCustomStrategy() {
  customDraft = { entryLogic: 'AND', exitLogic: 'AND', entryConditions: [{ indicator: 'RSI', period: 14, candleOffset: 0, operator: 'below', targetMode: 'NUMBER', targetOffset: 0, value: 30 }], exitConditions: [{ indicator: 'RSI', period: 14, candleOffset: 0, operator: 'above', targetMode: 'NUMBER', targetOffset: 0, value: 70 }], profitTargetType: 'PERCENT', profitTarget: 0, stopLossType: 'PERCENT', stopLoss: 0 };
  $('#customStrategyName').value = ''; $('#savedCustomStrategies').value = ''; renderCustomConditions();
}
async function loadCustomStrategies() {
  const response = await fetch('/api/custom-strategies');
  if (!response.ok) throw new Error('Unable to load saved strategies');
  const records = await response.json();
  customStrategies = new Map(records.map(record => [String(record.id), { ...record, config: JSON.parse(record.config) }]));
  const saved = $('#savedCustomStrategies'), chosen = saved.value;
  saved.innerHTML = '<option value="">Select a saved strategy…</option>' + records.map(record => `<option value="${record.id}">${escapeHtml(record.name)}</option>`).join('');
  if (customStrategies.has(chosen)) saved.value = chosen;
  const strategy = $('#strategy'), strategyValue = strategy.value;
  [...strategy.querySelectorAll('option[data-custom]')].forEach(option => option.remove());
  records.forEach(record => strategy.insertAdjacentHTML('beforeend', `<option data-custom value="CUSTOM:${record.id}">Custom: ${escapeHtml(record.name)}</option>`));
  if ([...strategy.options].some(option => option.value === strategyValue)) strategy.value = strategyValue;
}
function useCustomStrategy(id) {
  const strategy = customStrategies.get(id);
  if (!strategy) return;
  customDraft = JSON.parse(JSON.stringify(strategy.config));
  customDraft.entryLogic ||= 'AND'; customDraft.exitLogic ||= 'AND';
  customDraft.stopLossType ||= 'PERCENT'; customDraft.profitTargetType ||= 'PERCENT';
  customDraft.profitTarget ||= 0;
  customDraft.entryConditions.forEach(condition => { condition.candleOffset ??= 0; condition.targetMode ||= 'NUMBER'; condition.targetOffset ??= 0; });
  customDraft.exitConditions.forEach(condition => { condition.candleOffset ??= 0; condition.targetMode ||= 'NUMBER'; condition.targetOffset ??= 0; });
  $('#customStrategyName').value = strategy.name; $('#savedCustomStrategies').value = id; renderCustomConditions();
  $('#strategy').value = `CUSTOM:${id}`; $('#strategy').dispatchEvent(new Event('change'));
}
function syncCustomDraft() {
  $$('.custom-condition').forEach(row => {
    const condition = customDraft[row.dataset.kind][Number(row.dataset.index)];
    if (!condition) return;
    row.querySelectorAll('[data-field]').forEach(input => {
      condition[input.dataset.field] = ['period', 'value', 'value2', 'candleOffset', 'targetOffset'].includes(input.dataset.field) ? Number(input.value) : input.value;
    });
  });
  customDraft.stopLoss = Math.max(0, Number($('#customStopLoss').value) || 0);
  customDraft.stopLossType = $('#customStopLossType').value;
  customDraft.profitTarget = Math.max(0, Number($('#customProfitTarget').value) || 0);
  customDraft.profitTargetType = $('#customProfitTargetType').value;
  customDraft.entryLogic = $('#entryLogic').value;
  customDraft.exitLogic = $('#exitLogic').value;
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
async function setup() {
  initTheme();
  initChart();
  chart.timeScale().subscribeVisibleTimeRangeChange(range => {
    if (!range || !candles.length || loadingMore) return;
    const buffer = intervalSeconds() * 10;
    if (candles[0].time / 1000 - range.from < buffer) loadMore();
  });
  const providers = await (await fetch('/api/providers')).json();
  $('#provider').innerHTML = providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const groups = await (await fetch('/api/symbols')).json();
  $('#symbol').innerHTML = groups.map(g =>
    `<optgroup label="${g.category}">${g.symbols.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}</optgroup>`
  ).join('');
  $('#symbol').value = 'NSE:RELIANCE';
  $('#backtestSymbols').innerHTML = groups.map(g =>
    `<optgroup label="${g.category}">${g.symbols.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}</optgroup>`
  ).join('');
  $('#backtestSymbols').value = 'NSE:RELIANCE';
  const today = new Date(), yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1);
  $('#backtestStart').value = yearAgo.toISOString().slice(0, 10);
  $('#backtestEnd').value = today.toISOString().slice(0, 10);
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
    if (p.id === 'DEMO') { $('#connect').textContent = 'Demo feed active'; load(); return; }
    try {
      var broker = p.id === 'ZERODHA' ? 'zerodha' : p.id.toLowerCase();
      if (broker === 'angel_one') broker = 'angel-one';
      const status = await (await fetch('/api/auth/' + broker + '/status')).json();
      if (status.connected) { $('#connect').textContent = p.name + ' connected'; $('#providerStatus').textContent = 'Connected'; }
      else { $('#connect').textContent = account.loggedIn && brokerHasSaved(p.id) ? 'Connect ' + p.name + ' (saved)' : 'Connect ' + p.name; $('#providerStatus').textContent = status.configured ? 'Ready to connect' : p.status; }
    } catch { $('#connect').textContent = 'Connect ' + p.name; }
    load();
  };
  $('#provider').dispatchEvent(new Event('change'));
  $('#symbol').addEventListener('change', load);
  $('#refreshSymbols').onclick = async () => { const groups = await (await fetch('/api/symbols')).json(); const val = $('#symbol').value, selected = [...$('#backtestSymbols').selectedOptions].map(o => o.value); const options = groups.map(g => `<optgroup label="${g.category}">${g.symbols.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}</optgroup>`).join(''); $('#symbol').innerHTML = options; $('#backtestSymbols').innerHTML = options; $('#symbol').value = val; [...$('#backtestSymbols').options].forEach(o => o.selected = selected.includes(o.value)); };
  $('#timeframes').onclick = e => {
    if (!e.target.dataset.i) return;
    interval = e.target.dataset.i;
    $$('#timeframes button').forEach(b => b.classList.toggle('active', b === e.target));
    load();
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
  $('#connect').onclick = () => toast($('#provider').value === 'DEMO' ? 'Demo feed is already connected.' : 'Add the broker API adapter and credentials on the server to enable its live stream.');
  $('#brokerDialogClose').onclick = () => { document.getElementById('brokerDialog').close(); };
  document.getElementById('brokerDialog').addEventListener('close', () => { document.getElementById('brokerDialogFields').style.display = 'none'; document.getElementById('brokerFieldsZerodha').style.display = 'none'; document.getElementById('brokerFieldsAngel').style.display = 'none'; document.getElementById('brokerFieldsUpstox').style.display = 'none'; document.getElementById('brokerFieldsFyers').style.display = 'none'; document.getElementById('brokerSavedSection').style.display = 'none'; $('#vaultSaveName').value = ''; });
  $('#strategy').innerHTML = '<option value="">Select a strategy…</option>' + Object.entries(STRATEGIES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  $('#strategy').onchange = () => {
    const s = STRATEGIES[$('#strategy').value];
    $('#strategyParams').innerHTML = s ? '<div class="strategy-params">' + s.params.map(p => `<label>${p.label}<input data-k="${p.k}" type="number" value="${p.def}" min="1" max="200"></label>`).join('') + '</div>' : '';
    const custom = customStrategies.get($('#strategy').value.replace('CUSTOM:', ''));
    const targetLabel = (value, type) => type === 'AMOUNT' ? `₹${value}` : type === 'POINTS' ? `${value} pt` : `${value}%`;
    $('#strategySummary').innerHTML = custom ? `<div>Custom strategy: <span>${escapeHtml(custom.name)}</span> · ${custom.config.entryConditions.length} buy rule${custom.config.entryConditions.length === 1 ? '' : 's'} (${custom.config.entryLogic || 'AND'}) · ${custom.config.exitConditions.length} exit rule${custom.config.exitConditions.length === 1 ? '' : 's'} (${custom.config.exitLogic || 'AND'})${custom.config.profitTarget ? ` · Target: <span>${targetLabel(custom.config.profitTarget, custom.config.profitTargetType || 'PERCENT')}</span>` : ''}${custom.config.stopLoss ? ` · Stop: <span>${targetLabel(custom.config.stopLoss, custom.config.stopLossType || 'PERCENT')}</span>` : ''}</div>` : '';
  };
  $('#strategy').dispatchEvent(new Event('change'));
  $('#applyStrategy').onclick = renderStrategy;
  $('#clearStrategy').onclick = () => { $('#strategy').value = ''; $('#strategy').dispatchEvent(new Event('change')); setMainMarkers([]); $('#strategySummary').innerHTML = ''; };
  $('#addEntryCondition').onclick = () => addCustomCondition('entryConditions');
  $('#addExitCondition').onclick = () => addCustomCondition('exitConditions');
  $('#newCustomStrategy').onclick = resetCustomStrategy;
  $('#saveCustomStrategy').onclick = saveCustomStrategy;
  $('#savedCustomStrategies').onchange = () => { if ($('#savedCustomStrategies').value) useCustomStrategy($('#savedCustomStrategies').value); };
  resetCustomStrategy();
  try { await loadCustomStrategies(); } catch { toast('Saved custom strategies are unavailable.'); }
  $('#runBacktest').onclick = runBacktest;
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
  try { await refreshAccount(); } catch { }
}
function showIndicators() {
  $('#indicatorList').innerHTML = active.map((item, i) => {
    const config = item.config || { period: item.period || 14 };
    const color = config.color || COLORS[i % COLORS.length];
    return `<div class="indicator-chip" style="border-color:${color}">
      <span>${item.name}</span>
      ${indicatorParams(item.name).map(([key, label, fallback]) => `<label>${label}<input aria-label="${item.name} ${label}" data-config-index="${i}" data-config-key="${key}" type="number" step="any" min="0" value="${config[key] ?? fallback}"></label>`).join('')}
      <label>Color<input type="color" data-config-index="${i}" data-config-key="color" value="${color}"></label>
      <button class="apply" data-apply-index="${i}">Apply</button>
      <button aria-label="Remove ${item.name}" data-remove-index="${i}">x</button>
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
function customSeries(condition, data) {
  const close = data.map(c => c.close), period = Math.max(2, Number(condition.period) || 14);
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
  if (condition.indicator === 'SAR') { let sar = data[0].low, ep = data[0].high, af = .02, rising = true; return data.map((candle, i) => { if (!i) return sar; sar += af * (ep - sar); if (rising && candle.low < sar) { rising = false; sar = ep; ep = candle.low; af = .02; } else if (!rising && candle.high > sar) { rising = true; sar = ep; ep = candle.high; af = .02; } else if (rising && candle.high > ep) { ep = candle.high; af = Math.min(.2, af + .02); } else if (!rising && candle.low < ep) { ep = candle.low; af = Math.min(.2, af + .02); } return sar; }); }
  if (condition.indicator === 'SUPERTREND') { const atr = sma(trueRange(data), period); let upper, lower, trend = 1; return data.map((candle, i) => { if (atr[i] == null) return null; const mid = (candle.high + candle.low) / 2, bu = mid + 3 * atr[i], bl = mid - 3 * atr[i]; upper = i && upper != null && close[i - 1] <= upper ? Math.min(bu, upper) : bu; lower = i && lower != null && close[i - 1] >= lower ? Math.max(bl, lower) : bl; if (close[i] > upper) trend = 1; else if (close[i] < lower) trend = -1; return trend === 1 ? lower : upper; }); }
  if (condition.indicator === 'RSI') return rsi(close, period);
  if (condition.indicator === 'MACD') { const fast = ema(close, Math.max(2, Math.floor(period / 2))), slow = ema(close, period); return close.map((_, i) => fast[i] == null || slow[i] == null ? null : fast[i] - slow[i]); }
  if (condition.indicator === 'STOCH') return stoch(data, period, 3).k;
  if (condition.indicator === 'MFI') return mfi(data, period);
  if (condition.indicator === 'CCI') return cci(data, period);
  if (condition.indicator === 'WILLIAMS_R') return williamsR(data, period);
  if (condition.indicator === 'ROC') return close.map((value, i) => i < period ? null : (value - close[i - period]) / close[i - period] * 100);
  if (condition.indicator === 'MOM') return close.map((value, i) => i < period ? null : value - close[i - period]);
  if (condition.indicator === 'ATR') return sma(trueRange(data), period);
  if (condition.indicator === 'ADX') return adxValues(data, period).adx;
  if (condition.indicator === 'AROON') return data.map((_, i) => { if (i < period - 1) return null; const highs = data.slice(i - period + 1, i + 1).map(c => c.high), lows = data.slice(i - period + 1, i + 1).map(c => c.low); return 100 * (highs.lastIndexOf(Math.max(...highs)) - lows.lastIndexOf(Math.min(...lows))) / period; });
  if (condition.indicator === 'VWAP') { let priceVolume = 0, volume = 0; return data.map(candle => { priceVolume += (candle.high + candle.low + candle.close) / 3 * candle.volume; volume += candle.volume; return priceVolume / (volume || 1); }); }
  if (condition.indicator === 'OBV') { let obv = 0; return close.map((value, i) => { if (i) obv += value >= close[i - 1] ? data[i].volume : -data[i].volume; return obv; }); }
  if (condition.indicator === 'ADL') { let adl = 0; return data.map(c => adl += ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low || 1) * c.volume); }
  if (condition.indicator === 'CMF') { const flow = data.map(c => ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low || 1) * c.volume); return flow.map((_, i) => i < period - 1 ? null : flow.slice(i - period + 1, i + 1).reduce((sum, value) => sum + value, 0) / data.slice(i - period + 1, i + 1).reduce((sum, c) => sum + c.volume, 0)); }
  if (condition.indicator === 'FI') return ema(close.map((value, i) => i ? (value - close[i - 1]) * data[i].volume : 0), period);
  if (condition.indicator === 'BB_UPPER' || condition.indicator === 'BB_MID' || condition.indicator === 'BB_LOWER') { const mid = sma(close, period), deviation = mid.map((mean, i) => mean == null ? null : Math.sqrt(close.slice(i - period + 1, i + 1).reduce((sum, value) => sum + (value - mean) ** 2, 0) / period)); return mid.map((value, i) => value == null ? null : condition.indicator === 'BB_MID' ? value : value + (condition.indicator === 'BB_UPPER' ? 2 : -2) * deviation[i]); }
  if (condition.indicator === 'DC_HIGH' || condition.indicator === 'DC_LOW') return data.map((_, i) => i < period - 1 ? null : (condition.indicator === 'DC_HIGH' ? Math.max(...data.slice(i - period + 1, i + 1).map(c => c.high)) : Math.min(...data.slice(i - period + 1, i + 1).map(c => c.low))));
  if (condition.indicator === 'KC_UPPER' || condition.indicator === 'KC_LOWER') { const mid = ema(close, period), atr = sma(trueRange(data), period); return mid.map((value, i) => value == null || atr[i] == null ? null : value + (condition.indicator === 'KC_UPPER' ? 2 : -2) * atr[i]); }
  return close;
}
function conditionPass(condition, values, index, data) {
  const candleIndex = index + Math.min(0, Math.trunc(Number(condition.candleOffset) || 0));
  const referenceIndex = index + Math.min(0, Math.trunc(Number(condition.targetOffset) || 0));
  const value = values[candleIndex], target = condition.targetMode === 'CLOSE' ? data[referenceIndex]?.close : Number(condition.value);
  if (value == null || !Number.isFinite(target)) return false;
  const previous = values[candleIndex - 1];
  const previousTarget = condition.targetMode === 'CLOSE' ? data[referenceIndex - 1]?.close : target;
  if (condition.operator === 'crossesAbove') return candleIndex > 0 && previous != null && previousTarget != null && previous <= previousTarget && value > target;
  if (condition.operator === 'crossesBelow') return candleIndex > 0 && previous != null && previousTarget != null && previous >= previousTarget && value < target;
  if (condition.operator === 'aboveEqual') return value >= target;
  if (condition.operator === 'belowEqual') return value <= target;
  if (condition.operator === 'between' || condition.operator === 'outside') { const upper = Number(condition.value2), low = Math.min(target, upper), high = Math.max(target, upper); if (!Number.isFinite(upper)) return false; return condition.operator === 'between' ? value >= low && value <= high : value < low || value > high; }
  return condition.operator === 'below' ? value < target : value > target;
}
function computeCustomStrategy(config, data, params = {}) {
  if (!config?.entryConditions?.length || !data?.length) return [];
  const entry = config.entryConditions.map(c => ({ condition: c, values: customSeries(c, data) }));
  const exit = (config.exitConditions || []).map(c => ({ condition: c, values: customSeries(c, data) }));
  const stopLoss = Math.max(0, Number(config.stopLoss) || 0), profitTarget = Math.max(0, Number(config.profitTarget) || 0), quantity = Math.max(1, Number(params.quantity) || 1), signals = [];
  const targetPrice = (entry, value, type, direction) => type === 'POINTS' ? entry + direction * value : type === 'AMOUNT' ? entry + direction * value / quantity : entry * (1 + direction * value / 100);
  const matches = (rules, logic, index) => logic === 'OR' ? rules.some(rule => conditionPass(rule.condition, rule.values, index, data)) : rules.every(rule => conditionPass(rule.condition, rule.values, index, data));
  let inPosition = false, entryPrice = 0;
  data.forEach((candle, index) => {
    if (!inPosition && matches(entry, config.entryLogic || 'AND', index)) {
      inPosition = true; entryPrice = candle.close;
      signals.push({ type: 'buy', index, time: candle.time, price: candle.close });
    } else {
      const stopPrice = stopLoss > 0 ? targetPrice(entryPrice, stopLoss, config.stopLossType || 'PERCENT', -1) : null;
      const profitPrice = profitTarget > 0 ? targetPrice(entryPrice, profitTarget, config.profitTargetType || 'PERCENT', 1) : null;
      const stopped = inPosition && stopPrice != null && candle.low <= stopPrice;
      const targeted = inPosition && profitPrice != null && candle.high >= profitPrice;
      const indicatorExit = inPosition && exit.length && matches(exit, config.exitLogic || 'AND', index);
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
function executeBacktest(symbol, data, strategy, params, quantity, capital) {
  const orders = [], signals = computeStrategy(strategy, { ...params, quantity }, data);
  let cash = capital, position = null;
  signals.forEach(signal => {
    if (signal.type === 'buy' && !position) {
      const qty = Math.min(quantity, Math.floor(cash / signal.price));
      if (!qty) return;
      const amount = qty * signal.price;
      cash -= amount;
      position = { qty, price: signal.price, amount, time: signal.time };
      orders.push({ symbol, type: 'BUY', qty, price: signal.price, amount, pnl: null, time: signal.time });
    } else if (signal.type === 'sell' && position) {
      const amount = position.qty * signal.price, pnl = amount - position.amount;
      cash += amount;
      orders.push({ symbol, type: 'SELL', qty: position.qty, price: signal.price, amount, pnl, time: signal.time, reason: signal.reason });
      position = null;
    }
  });
  if (position && data.length) {
    const close = data.at(-1), amount = position.qty * close.close, pnl = amount - position.amount;
    cash += amount;
    orders.push({ symbol, type: 'SELL', qty: position.qty, price: close.close, amount, pnl, time: close.time, forced: true });
  }
  const completed = orders.filter(order => order.type === 'SELL' && order.pnl != null);
  const grossProfit = completed.filter(order => order.pnl > 0).reduce((sum, order) => sum + order.pnl, 0);
  const grossLoss = completed.filter(order => order.pnl < 0).reduce((sum, order) => sum + order.pnl, 0);
  return { symbol, data, orders, allocated: capital, endingValue: cash, pnl: cash - capital, stats: { trades: completed.length, wins: completed.filter(order => order.pnl > 0).length, grossProfit, grossLoss } };
}
function backtestMarkers(run) {
  setMainMarkers(run.orders.map(order => ({
    time: order.time / 1000, position: order.type === 'BUY' ? 'belowBar' : 'aboveBar',
    color: order.type === 'BUY' ? '#55c99d' : '#e66e70', shape: order.type === 'BUY' ? 'arrowUp' : 'arrowDown',
    text: order.forced ? 'EXIT' : order.type
  })));
}
function showBacktestChart(symbol) {
  const run = backtestRuns.find(item => item.symbol === symbol);
  if (!run) return;
  clearInterval(liveTimer);
  candles = run.data;
  interval = $('#backtestInterval').value;
  $$('#timeframes button').forEach(button => button.classList.toggle('active', button.dataset.i === interval));
  $('#instrument').textContent = symbol;
  $('#intervalName').textContent = ` - backtest ${interval}`;
  updateQuote(); render(); backtestMarkers(run); chart.timeScale().fitContent();
  $('#updated').textContent = `Backtest: ${symbol}`;
}
function renderBacktestResults() {
  const element = $('#backtestResults');
  const orders = backtestRuns.flatMap(run => run.orders);
  const invested = backtestRuns.reduce((sum, run) => sum + run.allocated, 0);
  const pnl = backtestRuns.reduce((sum, run) => sum + run.pnl, 0);
  const stats = backtestRuns.reduce((total, run) => ({ trades: total.trades + run.stats.trades, wins: total.wins + run.stats.wins, grossProfit: total.grossProfit + run.stats.grossProfit, grossLoss: total.grossLoss + run.stats.grossLoss }), { trades: 0, wins: 0, grossProfit: 0, grossLoss: 0 });
  const winRate = stats.trades ? stats.wins / stats.trades * 100 : 0, returnPct = invested ? pnl / invested * 100 : 0;
  element.hidden = false;
  element.innerHTML = `<div class="backtest-head"><span><strong>BACKTEST RESULTS</strong> · ${backtestRuns.length} stock${backtestRuns.length === 1 ? '' : 's'} · Capital ${money(invested)} · Net <span class="${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">${pnl >= 0 ? '+' : ''}${money(pnl)}</span></span><span><button id="exportBacktest" class="export-results">Export Excel</button><button class="close-results" aria-label="Close results">×</button></span></div>` +
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
  const invested = backtestRuns.reduce((sum, run) => sum + run.allocated, 0), pnl = backtestRuns.reduce((sum, run) => sum + run.pnl, 0);
  const trades = orders.filter(order => order.type === 'SELL' && order.pnl != null), wins = trades.filter(order => order.pnl > 0).length;
  const summary = [['Backtest Summary', 'Value'], ['Stocks tested', backtestRuns.length], ['Capital', invested], ['Net profit / loss', pnl], ['Return %', invested ? pnl / invested : 0], ['Completed trades', trades.length], ['Win rate', trades.length ? wins / trades.length : 0], ['Gross profit', trades.filter(order => order.pnl > 0).reduce((sum, order) => sum + order.pnl, 0)], ['Gross loss', trades.filter(order => order.pnl < 0).reduce((sum, order) => sum + order.pnl, 0)]];
  const rows = orders.map(order => ({ Stock: order.symbol, Time: new Date(order.time), Side: order.type, Exit_reason: order.forced ? 'End of test' : order.reason || '', Quantity: order.qty, Price: order.price, Amount: order.amount, Profit_Loss: order.pnl ?? null }));
  const workbook = XLSX.utils.book_new(), summarySheet = XLSX.utils.aoa_to_sheet(summary), tradesSheet = XLSX.utils.json_to_sheet(rows);
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 18 }]; tradesSheet['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary'); XLSX.utils.book_append_sheet(workbook, tradesSheet, 'Trades');
  XLSX.writeFile(workbook, `backtest-results-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
function clearBacktest() {
  backtestRuns = [];
  $('#backtestResults').hidden = true;
  if (mainSeries) renderStrategy();
}
async function runBacktest() {
  const strategy = $('#strategy').value;
  const start = $('#backtestStart').value, end = $('#backtestEnd').value;
  const symbols = [...$('#backtestSymbols').selectedOptions].map(option => option.value);
  const quantity = Math.floor(Number($('#backtestQuantity').value));
  const capital = Number($('#backtestCapital').value);
  if (!strategy) return toast('Select and apply a strategy before running a backtest.');
  if (!start || !end || start > end) return toast('Enter a valid start and end date.');
  if (!symbols.length) return toast('Select at least one stock to test.');
  if (!quantity || quantity < 1 || !capital || capital <= 0) return toast('Quantity and capital must be positive values.');
  const period = $('#backtestInterval').value, from = Math.floor(new Date(`${start}T00:00:00`).getTime() / 1000), to = Math.floor(new Date(`${end}T23:59:59`).getTime() / 1000);
  const seconds = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 }[period];
  const limit = Math.min(5000, Math.max(20, Math.ceil((to - from) / seconds) + 10));
  const button = $('#runBacktest'); button.disabled = true; button.textContent = 'Running…';
  try {
    const provider = $('#provider').value || 'DEMO', perStockCapital = capital / symbols.length;
    const responses = await Promise.all(symbols.map(async symbol => {
      const response = await fetch(`/api/candles?provider=${provider}&symbol=${encodeURIComponent(symbol)}&interval=${period}&from=${from}&to=${to}&limit=${limit}`);
      if (!response.ok) throw new Error(symbol);
      const data = await response.json();
      return executeBacktest(symbol, data.candles, strategy, strategyParams(), quantity, perStockCapital);
    }));
    backtestRuns = responses;
    renderBacktestResults(); showBacktestChart(symbols[0]);
  } catch (error) { toast('Could not load historical candles for this backtest.'); }
  finally { button.disabled = false; button.textContent = 'Run Backtest'; }
}
function renderStrategy() {
  const name = $('#strategy').value;
  const summary = $('#strategySummary');
  if (!name || !candles.length) { setMainMarkers([]); summary.innerHTML = ''; return; }
  const keyed = {};
  $$('#strategyParams input').forEach(inp => { keyed[inp.dataset.k] = Number(inp.value) || Number(inp.placeholder); });
  const signals = computeStrategy(name, keyed, candles);
  if (!signals.length) { setMainMarkers([]); summary.innerHTML = '<div>No signals generated.</div>'; return; }
  setMainMarkers(signals.map(s => ({ time: s.time / 1000, position: s.type === 'buy' ? 'belowBar' : 'aboveBar', color: s.type === 'buy' ? '#55c99d' : '#e66e70', shape: s.type === 'buy' ? 'arrowUp' : 'arrowDown', text: s.type.toUpperCase() })));
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
    items.map(p => '<div class="vault-item"><span class="vault-item-name">' + escapeHtml(p.name) + '</span><span class="vault-actions"><button data-use="' + p.id + '">Use</button><button data-delete="' + p.id + '" class="danger">Delete</button></span></div>').join('') +
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
async function openAngelOneDialog(prefill) {
  try {
    const status = await (await fetch('/api/auth/angel-one/status')).json();
    if (status.connected) { toast('Angel One is already connected.'); return; }
    const needsFull = !status.hasCredentials;
    const dialog = document.getElementById('brokerDialog');
    document.getElementById('brokerDialogTitle').textContent = 'Connect Angel One';
    document.getElementById('brokerDialogText').textContent = needsFull ? 'Enter your SmartAPI key and Angel One credentials.' : 'Enter your current TOTP to reconnect.';
    document.getElementById('brokerAngelCredentials').style.display = needsFull ? 'block' : 'none';
    document.getElementById('brokerFieldsZerodha').style.display = 'none';
    document.getElementById('brokerFieldsAngel').style.display = 'block';
    document.getElementById('brokerFieldsUpstox').style.display = 'none';
    document.getElementById('brokerFieldsFyers').style.display = 'none';
    document.getElementById('brokerDialogFields').style.display = 'block';
    $('#brokerAngelApiKey').value = prefill?.apiKey || '';
    $('#brokerClientCode').value = prefill?.clientCode || '';
    $('#brokerPin').value = prefill?.pin || '';
    $('#brokerTotp').value = '';
    populateBrokerSavedSelect('angel-one', needsFull);
    document.getElementById('brokerDialogContinue').onclick = async () => {
      const apiKey = $('#brokerAngelApiKey').value.trim();
      const clientCode = $('#brokerClientCode').value.trim();
      const pin = $('#brokerPin').value.trim();
      const totp = $('#brokerTotp').value.trim();
      if (!/^\d{6}$/.test(totp)) { toast('TOTP must be a 6-digit code.'); return; }
      if (needsFull && (!apiKey || !clientCode || !pin)) { toast('All fields are required.'); return; }
      dialog.close();
      document.getElementById('brokerDialogFields').style.display = 'none';
      document.getElementById('brokerFieldsAngel').style.display = 'none';
      try {
        const res = await fetch('/api/auth/angel-one/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, clientCode, pin, totp }) });
        if (!res.ok) throw Error((await res.json()).message);
        await saveProfileToVault('angel-one', { apiKey, clientCode, pin });
        toast('Angel One connected.');
      } catch (e) { toast(e.message || 'Angel One connection failed.'); }
    };
    dialog.showModal();
  } catch { toast('Could not start the Angel One connection.'); }
}
async function openZerodhaDialog() {
  try {
    const status = await (await fetch('/api/auth/zerodha/status')).json();
    if (status.connected) { toast('Zerodha Kite Connect is already connected.'); return; }
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
    if (status.connected) { toast(provider + ' is already connected.'); return; }
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
    if (status.connected) { toast($('#provider option:checked').textContent + ' is already connected.'); return; }
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
  const saved = localStorage.getItem('prism.theme') || 'dark';
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
setup();

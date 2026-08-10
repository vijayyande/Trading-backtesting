# SSS Backtest

Spring Boot charting workspace for Indian-market symbols. It includes a responsive candlestick, bar, or line chart; intervals from one minute to one day; and a configurable technical-indicator layer.


This repository is **dual-licensed**:  
1. Apache 2 
2. Commercial License - Contact developer

## Run

Use Java 21 and Maven:

```powershell
mvn spring-boot:run
```

Then open `http://localhost:8080`.

## Data providers

The **Demo market feed** is immediately usable and updates the active candle every 2.5 seconds, so the dashboard works without credentials. Angel One, Zerodha, Upstox, and Fyers are selectable in the UI and exposed through the same `/api/candles` contract.

Before connecting a real broker, implement its authenticated API call in `ChartController` (or preferably a dedicated `MarketDataProvider` adapter), keep API secrets in environment variables or a secrets manager, and never expose broker credentials to the browser.

### Zerodha connection

The Zerodha button uses the official Kite Connect redirect flow. Create a Kite Connect app, register this exact callback URL in the Kite developer console, then start the application with the matching server configuration:

```powershell
$env:ZERODHA_API_KEY = "your_kite_app_key"
$env:ZERODHA_API_SECRET = "your_kite_app_secret"
$env:APP_PUBLIC_URL = "http://localhost:8080"
mvn spring-boot:run
```

Register `http://localhost:8080/api/auth/zerodha/callback` as the callback URL for local use (or the equivalent HTTPS URL for a deployed app). Users choose Zerodha, click **Connect Zerodha**, and complete their login and 2FA on the official Zerodha page. The returned access token remains in the server session only; it is never sent to the browser.

### Other broker connections

Set the matching app credentials before using each connect button:

```powershell
$env:UPSTOX_API_KEY = "your_upstox_api_key"
$env:UPSTOX_API_SECRET = "your_upstox_api_secret"
$env:FYERS_APP_ID = "your_fyers_app_id"
$env:FYERS_APP_SECRET = "your_fyers_app_secret"
$env:ANGELONE_API_KEY = "your_angel_one_api_key"
```

Register these callback URLs in the respective developer portals:

- `http://localhost:8080/api/auth/upstox/callback`
- `http://localhost:8080/api/auth/fyers/callback`

Upstox and Fyers redirect the user to their official login pages. Angel One requires the user’s Client ID, PIN/password, and the current six-digit TOTP; these are used only for the login request and are not stored by this app.

## API

- `GET /api/providers` returns available feeds and connection status.
- `GET /api/candles?provider=DEMO&symbol=NSE:RELIANCE&interval=1d&limit=180` returns OHLCV candles.
- `GET /api/live-candle?provider=DEMO&symbol=NSE:RELIANCE&interval=1d` returns the newest evolving candle. The browser polls this endpoint every 2.5 seconds.

Supported intervals are `1m`, `5m`, `15m`, `1h`, and `1d`.

## Indicators

Each selected indicator can use its own period (2–200). The chart supports moving averages (SMA, EMA, WMA, DEMA, TEMA, HMA, KAMA), trend overlays (Parabolic SAR, Supertrend, Ichimoku), channels and volatility (Bollinger, Keltner, Donchian, Envelopes, ATR, standard deviation, historical volatility), momentum (RSI, MACD, PPO, Stochastic, Williams %R, CCI, ROC, Momentum, Awesome Oscillator, Aroon, TRIX, DPO), and volume/trend-strength indicators (VWAP, OBV, MFI, CMF, ADL, Chaikin Oscillator, Force Index, ADX, Vortex).


<img width="1790" height="3107" alt="image" src="https://github.com/user-attachments/assets/80a1ce7b-9258-4b94-9d59-14243f6089ac" />


package com.trading.chartstudio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class BrokerCandleService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String ANGEL_BASE = "https://apiconnect.angelone.in/rest/secure/angelbroking";
    private static final String ANGEL_LOCAL_IP = "192.168.1.100";
    private static final String ANGEL_PUBLIC_IP = "49.207.180.150";
    private static final String ANGEL_MAC = "00:00:00:00:00:00";
    private final String zerodhaApiKey;
    private final String angelApiKey;
    private final CredentialStore store;
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();
    private final ConcurrentHashMap<String, List<ChartController.Candle>> cache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> instrumentCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> angelTokenCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LiveBar> zerodhaLiveBars = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LiveBar> angelLiveBars = new ConcurrentHashMap<>();

    private record LiveBar(ChartController.Candle candle, long fetchedAt) {}

    public BrokerCandleService(@Value("${zerodha.api-key:}") String zerodhaApiKey,
                               @Value("${angelone.api-key:}") String angelApiKey,
                               CredentialStore store) {
        this.zerodhaApiKey = zerodhaApiKey;
        this.angelApiKey = angelApiKey;
        this.store = store;
    }

    public List<ChartController.Candle> fetchCandles(String provider, String symbol, String interval, int count, HttpSession session) {
        return fetchCandles(provider, symbol, interval, count, null, session);
    }

    public List<ChartController.Candle> fetchCandles(String provider, String symbol, String interval, int count, Long toTimeSec, HttpSession session) {
        return switch (provider) {
            case "ZERODHA" -> fetchZerodhaCandles(symbol, interval, count, toTimeSec, session);
            case "ANGEL_ONE" -> fetchAngelCandles(symbol, interval, count, toTimeSec, session);
            default -> null;
        };
    }

    public List<ChartController.Candle> generateDemo(String symbol, String interval, int count) {
        return generateDemoTo(symbol, interval, count, Instant.now().toEpochMilli());
    }

    public List<ChartController.Candle> generateDemoTo(String symbol, String interval, int count, long toTimeMs) {
        long seconds = getIntervalSeconds(interval);
        java.util.Random random = new java.util.Random((long) symbol.hashCode() * 31 + interval.hashCode() * 37 + toTimeMs);
        double price = 900 + Math.abs(symbol.hashCode() % 1800);
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        boolean isDaily = "1d".equals(interval);
        double volScale = Math.max(Math.sqrt(seconds / 86400.0), .06);
        List<ChartController.Candle> result = new ArrayList<>();
        long currentMs = toTimeMs;
        int maxIterations = count * 30;
        int lastSessionDay = -1;
        for (int iter = 0; result.size() < count && iter < maxIterations; iter++) {
            ZonedDateTime zdt = Instant.ofEpochMilli(currentMs).atZone(ist);
            int dow = zdt.getDayOfWeek().getValue();
            if (dow >= 1 && dow <= 5) {
                int minutes = zdt.getHour() * 60 + zdt.getMinute();
                boolean validTime;
                if (isDaily) {
                    validTime = true;
                } else if (symbol.startsWith("MCX:")) {
                    validTime = minutes >= 540 && minutes < 1410;
                } else if (symbol.startsWith("GLOBAL:")) {
                    validTime = true;
                } else {
                    validTime = minutes >= 555 && minutes < 930;
                }
                if (validTime) {
                    int dayKey = zdt.getDayOfYear();
                    if (dayKey != lastSessionDay) {
                        if (lastSessionDay != -1) {
                            double gap = (random.nextDouble() - .48) * price * .025;
                            price = Math.max(1, price + gap);
                        }
                        lastSessionDay = dayKey;
                    }
                    double open = price;
                    double change = (random.nextDouble() - .48) * price * .018 * volScale;
                    double close = Math.max(1, open + change);
                    double upperWick = random.nextDouble() * price * .005 * volScale;
                    double lowerWick = random.nextDouble() * price * .005 * volScale;
                    double high = Math.max(open, close) + upperWick;
                    double low = Math.min(open, close) - lowerWick;
                    long volume = 80_000 + random.nextInt(1_500_000);
                    result.add(new ChartController.Candle(currentMs, round(open), round(high), round(low), round(close), volume));
                    price = close;
                }
            }
            currentMs -= seconds * 1000;
        }
        java.util.Collections.reverse(result);
        return result;
    }

    public List<ChartController.Candle> generateDemoRange(String symbol, String interval, long fromTimeMs, long toTimeMs, int maxCount) {
        long seconds = getIntervalSeconds(interval);
        long expected = Math.max(20, (toTimeMs - fromTimeMs) / (seconds * 1000) + 5);
        int count = (int) Math.min(maxCount, Math.min(expected, 5000));
        return generateDemoTo(symbol, interval, count, toTimeMs).stream()
            .filter(c -> c.time() >= fromTimeMs && c.time() <= toTimeMs).toList();
    }

    private long getIntervalSeconds(String interval) {
        return switch (interval) { case "1m" -> 60; case "5m" -> 300; case "15m" -> 900; case "1h" -> 3600; default -> 86400; };
    }

    private List<ChartController.Candle> fetchZerodhaCandles(String symbol, String interval, int count, Long toTimeSec, HttpSession session) {
        try {
            String accessToken = (String) session.getAttribute("zerodha.access-token");
            String apiKey = resolveZerodhaApiKey(session);
            if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;

            String[] parts = symbol.split(":");
            String exchange = parts.length > 1 ? parts[0] : "NSE";
            String tradingSymbol = parts.length > 1 ? parts[1] : symbol;

            Long instrumentToken = resolveInstrumentToken(exchange, tradingSymbol, apiKey, accessToken);
            if (instrumentToken == null) return null;

            String kiteInterval = switch (interval) {
                case "1m" -> "minute"; case "5m" -> "5minute"; case "15m" -> "15minute";
                case "1h" -> "60minute"; case "1d" -> "day"; default -> "day";
            };
            long now = toTimeSec != null ? toTimeSec : Instant.now().getEpochSecond();
            long intervalSeconds = getIntervalSeconds(interval);
            long from = now - count * intervalSeconds;

            String cacheKey = "ZERODHA:" + instrumentToken + ":" + interval + ":" + from + ":" + now;
            List<ChartController.Candle> cached = cache.get(cacheKey);
            if (cached != null) return cached;

            String url = "https://api.kite.trade/instruments/historical/" + instrumentToken + "/" + kiteInterval + "?from=" + from + "&to=" + now;
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("X-Kite-Version", "3")
                .header("Authorization", "token " + apiKey + ":" + accessToken)
                .GET().timeout(java.time.Duration.ofSeconds(15)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) return null;

            JsonNode data = json.readTree(response.body()).path("data").path("candles");
            if (!data.isArray()) return null;

            List<ChartController.Candle> candles = new ArrayList<>();
            for (JsonNode c : data) {
                candles.add(new ChartController.Candle(
                    c.get(0).asLong() * 1000,
                    c.get(1).asDouble(), c.get(2).asDouble(),
                    c.get(3).asDouble(), c.get(4).asDouble(), c.get(5).asLong()
                ));
            }
            if (!candles.isEmpty()) cache.put(cacheKey, candles);
            return candles;
        } catch (Exception e) {
            return null;
        }
    }

    private Long resolveInstrumentToken(String exchange, String tradingSymbol, String apiKey, String accessToken) {
        try {
            String cacheKey = "instruments:" + exchange;
            String csv = instrumentCache.get(cacheKey);

            if (csv == null) {
                String url = "https://api.kite.trade/instruments/" + exchange;
                HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .header("X-Kite-Version", "3")
                    .header("Authorization", "token " + apiKey + ":" + accessToken)
                    .GET().timeout(java.time.Duration.ofSeconds(15)).build();
                HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() / 100 != 2) return null;
                csv = res.body();
                instrumentCache.put(cacheKey, csv);
            }

            String target = "\"" + tradingSymbol + "\"";
            String[] lines = csv.split("\n");
            for (int i = 1; i < lines.length; i++) {
                if (lines[i].contains(target)) {
                    String[] cols = lines[i].split(",");
                    if (cols.length > 1 && cols[1].replace("\"", "").equals(tradingSymbol)) {
                        return Long.parseLong(cols[0].replace("\"", ""));
                    }
                }
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    private String resolveZerodhaApiKey(HttpSession session) {
        String k = (String) session.getAttribute("zerodha.api-key");
        if (k != null && !k.isBlank()) return k;
        String stored = store.get("zerodha", "apiKey");
        return (stored != null && !stored.isBlank()) ? stored : zerodhaApiKey;
    }

    /** Latest real market price for a symbol via Kite's snapshot quote endpoint. */
    public Double fetchLastPrice(String symbol, HttpSession session) {
        String accessToken = (String) session.getAttribute("zerodha.access-token");
        String apiKey = resolveZerodhaApiKey(session);
        if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;
        try {
            String url = "https://api.kite.trade/quote/ltp?i=" + java.net.URLEncoder.encode(symbol, java.nio.charset.StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("X-Kite-Version", "3")
                .header("Authorization", "token " + apiKey + ":" + accessToken)
                .GET().timeout(java.time.Duration.ofSeconds(10)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) return null;
            JsonNode data = json.readTree(response.body()).path("data").path(symbol);
            double ltp = data.path("last_price").asDouble();
            return ltp > 0 ? ltp : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Live candle for the current interval, provider-aware. History is re-fetched only when the interval bar rolls. */
    public ChartController.Candle fetchLiveQuote(String provider, String symbol, String interval, int count, HttpSession session) {
        return switch (provider) {
            case "ZERODHA" -> fetchZerodhaLiveQuote(symbol, interval, session);
            case "ANGEL_ONE" -> fetchAngelLiveQuote(symbol, interval, session);
            default -> null;
        };
    }

    private ChartController.Candle fetchZerodhaLiveQuote(String symbol, String interval, HttpSession session) {
        try {
            String accessToken = (String) session.getAttribute("zerodha.access-token");
            String apiKey = resolveZerodhaApiKey(session);
            if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;
            String[] parts = symbol.split(":");
            String exchange = parts.length > 1 ? parts[0] : "NSE";
            String tradingSymbol = parts.length > 1 ? parts[1] : symbol;
            Long token = resolveInstrumentToken(exchange, tradingSymbol, apiKey, accessToken);
            if (token == null) return null;
            String key = "ZERODHA:" + token + ":" + interval;
            LiveBar live = refreshLiveBar(zerodhaLiveBars, key, exchange, interval,
                () -> fetchZerodhaCandles(symbol, interval, 2, null, session));
            if (live == null) return null;
            Double ltp = fetchLastPrice(symbol, session);
            if (ltp == null) return live.candle();
            ChartController.Candle updated = mergeLtp(live.candle(), ltp);
            zerodhaLiveBars.put(key, new LiveBar(updated, live.fetchedAt()));
            return updated;
        } catch (Exception e) {
            return null;
        }
    }

    private ChartController.Candle fetchAngelLiveQuote(String symbol, String interval, HttpSession session) {
        try {
            String accessToken = (String) session.getAttribute("angel-one.access-token");
            String apiKey = resolveAngelApiKey(session);
            if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;
            String[] parts = symbol.split(":");
            String exchange = parts.length > 1 ? parts[0] : "NSE";
            String tradingSymbol = parts.length > 1 ? parts[1] : symbol;
            if (!isSupportedExchange(exchange)) return null;
            String token = resolveAngelToken(exchange, tradingSymbol, apiKey, accessToken);
            if (token == null) return null;
            String key = "ANGEL:" + exchange + ":" + token + ":" + interval;
            LiveBar live = refreshLiveBar(angelLiveBars, key, exchange, interval,
                () -> fetchAngelCandlesByToken(exchange, tradingSymbol, token, interval, 2, null, apiKey, accessToken));
            if (live == null) return null;
            Double ltp = fetchAngelLtp(exchange, token, apiKey, accessToken);
            if (ltp == null) return live.candle();
            ChartController.Candle updated = mergeLtp(live.candle(), ltp);
            angelLiveBars.put(key, new LiveBar(updated, live.fetchedAt()));
            return updated;
        } catch (Exception e) {
            return null;
        }
    }

    private static final long LIVE_REFETCH_SESSION_MS = 5_000;
    private static final long LIVE_REFETCH_IDLE_MS = 120_000;

    private LiveBar refreshLiveBar(ConcurrentHashMap<String, LiveBar> bars, String key, String exchange,
                                   String interval, Supplier<List<ChartController.Candle>> fetcher) {
        long nowMs = System.currentTimeMillis();
        LiveBar live = bars.get(key);
        if (live == null) {
            List<ChartController.Candle> history = fetcher.get();
            if (history == null || history.isEmpty()) return null;
            LiveBar bar = new LiveBar(history.getLast(), nowMs);
            bars.put(key, bar);
            return bar;
        }
        long intervalMs = getIntervalSeconds(interval) * 1000L;
        boolean barEnded = nowMs >= live.candle().time() + intervalMs;
        if (barEnded) {
            long minGap = inTradingSession(exchange, interval) ? LIVE_REFETCH_SESSION_MS : LIVE_REFETCH_IDLE_MS;
            if (nowMs - live.fetchedAt() >= minGap) {
                List<ChartController.Candle> history = fetcher.get();
                if (history != null && !history.isEmpty()) {
                    LiveBar bar = new LiveBar(history.getLast(), nowMs);
                    bars.put(key, bar);
                    return bar;
                }
            }
        }
        return live;
    }

    private ChartController.Candle mergeLtp(ChartController.Candle bar, double ltp) {
        return new ChartController.Candle(bar.time(), bar.open(),
            Math.max(bar.high(), ltp), Math.min(bar.low(), ltp), ltp, bar.volume());
    }

    private boolean inTradingSession(String exchange, String interval) {
        ZonedDateTime now = ZonedDateTime.now(IST);
        int dow = now.getDayOfWeek().getValue();
        if (dow > 5) return false;
        int minutes = now.getHour() * 60 + now.getMinute();
        if (exchange.equals("MCX")) return minutes >= 540 && minutes < 1410;
        return minutes >= 555 && minutes < 930;
    }

    private List<ChartController.Candle> fetchAngelCandles(String symbol, String interval, int count, Long toTimeSec, HttpSession session) {
        try {
            String accessToken = (String) session.getAttribute("angel-one.access-token");
            String apiKey = resolveAngelApiKey(session);
            if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;
            String[] parts = symbol.split(":");
            String exchange = parts.length > 1 ? parts[0] : "NSE";
            String tradingSymbol = parts.length > 1 ? parts[1] : symbol;
            if (!isSupportedExchange(exchange)) return null;
            String token = resolveAngelToken(exchange, tradingSymbol, apiKey, accessToken);
            if (token == null) return null;
            return fetchAngelCandlesByToken(exchange, tradingSymbol, token, interval, count, toTimeSec, apiKey, accessToken);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isSupportedExchange(String exchange) {
        return exchange.equals("NSE") || exchange.equals("BSE") || exchange.equals("MCX")
            || exchange.equals("NFO") || exchange.equals("BFO");
    }

    private List<ChartController.Candle> fetchAngelCandlesByToken(String exchange, String tradingSymbol, String token,
                                                                  String interval, int count, Long toTimeSec,
                                                                  String apiKey, String accessToken) {
        try {
            long nowSec = toTimeSec != null ? toTimeSec : Instant.now().getEpochSecond();
            long intervalSeconds = getIntervalSeconds(interval);
            long fromSec = nowSec - count * intervalSeconds;
            String cacheKey = "ANGEL:" + token + ":" + interval + ":" + fromSec + ":" + nowSec;
            List<ChartController.Candle> cached = cache.get(cacheKey);
            if (cached != null) return cached;
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
            Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("exchange", exchange);
            body.put("symboltoken", token);
            body.put("interval", angelInterval(interval));
            body.put("fromdate", Instant.ofEpochSecond(fromSec).atZone(IST).format(fmt));
            body.put("todate", Instant.ofEpochSecond(nowSec).atZone(IST).format(fmt));
            HttpRequest request = HttpRequest.newBuilder(URI.create(ANGEL_BASE + "/historical/v1/getCandleData"))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .header("X-UserType", "USER").header("X-SourceID", "WEB")
                .header("X-ClientLocalIP", ANGEL_LOCAL_IP).header("X-ClientPublicIP", ANGEL_PUBLIC_IP)
                .header("X-MACAddress", ANGEL_MAC).header("X-PrivateKey", apiKey)
                .header("Authorization", "Bearer " + accessToken)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .timeout(java.time.Duration.ofSeconds(15)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) return null;
            JsonNode data = json.readTree(response.body()).path("data");
            if (!data.isArray()) return null;
            List<ChartController.Candle> candles = new ArrayList<>();
            for (JsonNode row : data) {
                if (!row.isArray() || row.size() < 6) continue;
                long time = OffsetDateTime.parse(row.get(0).asText()).toInstant().toEpochMilli();
                candles.add(new ChartController.Candle(time, row.get(1).asDouble(), row.get(2).asDouble(),
                    row.get(3).asDouble(), row.get(4).asDouble(), row.get(5).asLong()));
            }
            if (!candles.isEmpty()) cache.put(cacheKey, candles);
            return candles;
        } catch (Exception e) {
            return null;
        }
    }

    private String angelInterval(String interval) {
        return switch (interval) {
            case "1m" -> "ONE_MINUTE"; case "5m" -> "FIVE_MINUTE"; case "15m" -> "FIFTEEN_MINUTE";
            case "1h" -> "ONE_HOUR"; default -> "ONE_DAY";
        };
    }

    private String resolveAngelToken(String exchange, String tradingSymbol, String apiKey, String accessToken) {
        try {
            String cacheKey = "angeltoken:" + exchange + ":" + tradingSymbol;
            String cached = angelTokenCache.get(cacheKey);
            if (cached != null) return cached;
            Map<String, Object> body = Map.of("exchange", exchange, "searchscrip", tradingSymbol);
            HttpRequest request = HttpRequest.newBuilder(URI.create(ANGEL_BASE + "/order/v1/searchScrip"))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .header("X-UserType", "USER").header("X-SourceID", "WEB")
                .header("X-ClientLocalIP", ANGEL_LOCAL_IP).header("X-ClientPublicIP", ANGEL_PUBLIC_IP)
                .header("X-MACAddress", ANGEL_MAC).header("X-PrivateKey", apiKey)
                .header("Authorization", "Bearer " + accessToken)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .timeout(java.time.Duration.ofSeconds(15)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) return null;
            JsonNode data = json.readTree(response.body()).path("data");
            if (!data.isArray() || data.isEmpty()) return null;
            String best = null;
            for (JsonNode item : data) {
                String token = item.path("symboltoken").asText();
                if (token.isBlank()) continue;
                if (item.path("tradingsymbol").asText().equals(tradingSymbol)) { best = token; break; }
                if (item.path("exchange").asText().equals(exchange) && best == null) best = token;
            }
            if (best == null) best = data.get(0).path("symboltoken").asText();
            if (best.isBlank()) return null;
            angelTokenCache.put(cacheKey, best);
            return best;
        } catch (Exception e) {
            return null;
        }
    }

    private Double fetchAngelLtp(String exchange, String token, String apiKey, String accessToken) {
        try {
            Map<String, Object> body = Map.of("mode", "LTP", "exchangeTokens", Map.of(exchange, List.of(token)));
            HttpRequest request = HttpRequest.newBuilder(URI.create(ANGEL_BASE + "/market/v1/quote"))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .header("X-UserType", "USER").header("X-SourceID", "WEB")
                .header("X-ClientLocalIP", ANGEL_LOCAL_IP).header("X-ClientPublicIP", ANGEL_PUBLIC_IP)
                .header("X-MACAddress", ANGEL_MAC).header("X-PrivateKey", apiKey)
                .header("Authorization", "Bearer " + accessToken)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .timeout(java.time.Duration.ofSeconds(10)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) return null;
            JsonNode fetched = json.readTree(response.body()).path("data").path("fetched");
            if (!fetched.isArray()) return null;
            for (JsonNode item : fetched) {
                if (item.path("exchange").asText().equals(exchange) && item.path("symbolToken").asText().equals(token)) {
                    double ltp = item.path("ltp").asDouble();
                    return ltp > 0 ? ltp : null;
                }
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveAngelApiKey(HttpSession session) {
        String sessionKey = (String) session.getAttribute("angel-one.api-key");
        if (sessionKey != null && !sessionKey.isBlank()) return sessionKey;
        String stored = store.get("angel-one", "apiKey");
        return (stored != null && !stored.isBlank()) ? stored : angelApiKey;
    }

    private double round(double n) { return Math.round(n * 100.0) / 100.0; }
}

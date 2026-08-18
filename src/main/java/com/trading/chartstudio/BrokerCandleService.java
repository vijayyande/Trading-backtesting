package com.trading.chartstudio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class BrokerCandleService {

    private static final Logger log = LoggerFactory.getLogger(BrokerCandleService.class);

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final String ANGEL_BASE = "https://apiconnect.angelone.in/rest/secure/angelbroking";
    private static final String ANGEL_LOCAL_IP = "192.168.1.100";
    private static final String ANGEL_MAC = "00:00:00:00:00:00";
    private final String zerodhaApiKey;
    private final String angelApiKey;
    private final String angelPublicIp;
    private final CredentialStore store;
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();
    private final ConcurrentHashMap<String, List<ChartController.Candle>> cache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<ChartController.Candle>> lastKnown = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastKnownAt = new ConcurrentHashMap<>();
    private static final long LAST_KNOWN_TTL_MS = 30_000;
    private final ConcurrentHashMap<String, String> instrumentCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> angelTokenCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LiveBar> zerodhaLiveBars = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, LiveBar> angelLiveBars = new ConcurrentHashMap<>();
    private volatile String lastAngelError;

    private static final java.util.Map<String, String> ANGEL_INDEX_TOKENS = java.util.Map.ofEntries(
        java.util.Map.entry("NIFTY 50", "99926000"),
        java.util.Map.entry("NIFTY IT", "99926001"),
        java.util.Map.entry("NIFTY NEXT 50", "99926002"),
        java.util.Map.entry("NIFTY MIDCAP 100", "99926003"),
        java.util.Map.entry("NIFTY SMALLCAP 50", "99926004"),
        java.util.Map.entry("NIFTY 500", "99926005"),
        java.util.Map.entry("NIFTY AUTO", "99926006"),
        java.util.Map.entry("NIFTY PHARMA", "99926007"),
        java.util.Map.entry("NIFTY FMCG", "99926008"),
        java.util.Map.entry("NIFTY BANK", "99926009"),
        java.util.Map.entry("NIFTY METAL", "99926010"),
        java.util.Map.entry("NIFTY REALTY", "99926011"),
        java.util.Map.entry("NIFTY MEDIA", "99926012"),
        java.util.Map.entry("NIFTY ENERGY", "99926013"),
        java.util.Map.entry("NIFTY PSU BANK", "99926014"),
        java.util.Map.entry("NIFTY FIN SERVICE", "99926015"),
        java.util.Map.entry("NIFTY HEALTHCARE", "99926016"),
        java.util.Map.entry("NIFTY INFRA", "99926017"),
        java.util.Map.entry("INDIA VIX", "99926018"),
        java.util.Map.entry("NIFTY MNC", "99926019"),
        java.util.Map.entry("NIFTY SERV SECTOR", "99926020"),
        java.util.Map.entry("NIFTY CONSUMPTION", "99926021"),
        java.util.Map.entry("NIFTY COMMODITIES", "99926022"),
        java.util.Map.entry("NIFTY OIL & GAS", "99926023"),
        java.util.Map.entry("NIFTY INDIA DIGITAL", "99926024"),
        java.util.Map.entry("SENSEX", "99919000"),
        java.util.Map.entry("BANKEX", "99919012"));

    private static final java.util.Map<String, Double> DEMO_BASE_PRICE = java.util.Map.ofEntries(
        java.util.Map.entry("NSE:NIFTY 50", 25000.0),
        java.util.Map.entry("BSE:SENSEX", 77000.0),
        java.util.Map.entry("BSE:BANKEX", 58000.0),
        java.util.Map.entry("NSE:NIFTY BANK", 54500.0),
        java.util.Map.entry("NSE:NIFTY IT", 41500.0),
        java.util.Map.entry("NSE:NIFTY NEXT 50", 72000.0),
        java.util.Map.entry("NSE:NIFTY MIDCAP 100", 61000.0),
        java.util.Map.entry("NSE:NIFTY SMALLCAP 50", 17500.0),
        java.util.Map.entry("NSE:NIFTY 500", 24000.0),
        java.util.Map.entry("NSE:NIFTY AUTO", 26500.0),
        java.util.Map.entry("NSE:NIFTY PHARMA", 23500.0),
        java.util.Map.entry("NSE:NIFTY FMCG", 62000.0),
        java.util.Map.entry("NSE:NIFTY METAL", 10300.0),
        java.util.Map.entry("NSE:NIFTY REALTY", 1150.0),
        java.util.Map.entry("NSE:NIFTY MEDIA", 2050.0),
        java.util.Map.entry("NSE:NIFTY ENERGY", 31500.0),
        java.util.Map.entry("NSE:NIFTY CONSUMPTION", 11300.0),
        java.util.Map.entry("NSE:NIFTY INFRA", 9200.0),
        java.util.Map.entry("NSE:NIFTY MNC", 31000.0),
        java.util.Map.entry("NSE:NIFTY PSU BANK", 7300.0),
        java.util.Map.entry("NSE:NIFTY PVT BANK", 26500.0),
        java.util.Map.entry("NSE:NIFTY SERV SECTOR", 31000.0),
        java.util.Map.entry("NSE:NIFTY FIN SERVICE", 25800.0),
        java.util.Map.entry("NSE:NIFTY HEALTHCARE", 13800.0),
        java.util.Map.entry("NSE:NIFTY OIL & GAS", 12300.0),
        java.util.Map.entry("NSE:NIFTY COMMODITIES", 9200.0),
        java.util.Map.entry("NSE:NIFTY INDIA DIGITAL", 8200.0),
        java.util.Map.entry("MCX:GOLD", 76000.0),
        java.util.Map.entry("MCX:GOLDM", 76000.0),
        java.util.Map.entry("MCX:GOLDGUINEA", 76000.0),
        java.util.Map.entry("MCX:GOLDPETAL", 7600.0),
        java.util.Map.entry("MCX:SILVER", 96000.0),
        java.util.Map.entry("MCX:SILVERM", 96000.0),
        java.util.Map.entry("MCX:SILVERMC", 96000.0),
        java.util.Map.entry("MCX:CRUDEOIL", 6300.0),
        java.util.Map.entry("MCX:NATURALGAS", 240.0),
        java.util.Map.entry("MCX:COPPER", 860.0),
        java.util.Map.entry("MCX:ZINC", 275.0),
        java.util.Map.entry("MCX:LEAD", 195.0),
        java.util.Map.entry("MCX:LEADMINI", 195.0),
        java.util.Map.entry("MCX:ALUMINIUM", 245.0),
        java.util.Map.entry("MCX:ALUMINIUMMINI", 245.0),
        java.util.Map.entry("MCX:NICKEL", 1750.0),
        java.util.Map.entry("MCX:COTTON", 56500.0),
        java.util.Map.entry("MCX:CPO", 1050.0),
        java.util.Map.entry("MCX:MENTHAOIL", 1950.0),
        java.util.Map.entry("MCX:CARDAMOM", 30500.0),
        java.util.Map.entry("MCX:CASTORSEED", 6100.0),
        java.util.Map.entry("MCX:JEERA", 28500.0),
        java.util.Map.entry("MCX:TURMERIC", 15500.0),
        java.util.Map.entry("MCX:CHANA", 10100.0),
        java.util.Map.entry("MCX:DHANIYA", 8200.0),
        java.util.Map.entry("MCX:KAPAS", 1650.0),
        java.util.Map.entry("MCX:MULTI", 5200.0),
        java.util.Map.entry("MCX:ENERGY", 4100.0),
        java.util.Map.entry("MCX:METAL", 4200.0),
        java.util.Map.entry("MCX:BULLION", 31000.0),
        java.util.Map.entry("GLOBAL:SPX", 6050.0),
        java.util.Map.entry("GLOBAL:NDX", 22500.0),
        java.util.Map.entry("GLOBAL:IXIC", 18500.0),
        java.util.Map.entry("GLOBAL:DJI", 44500.0),
        java.util.Map.entry("GLOBAL:NYA", 19500.0),
        java.util.Map.entry("GLOBAL:RUT", 2400.0),
        java.util.Map.entry("GLOBAL:VIX", 15.0),
        java.util.Map.entry("GLOBAL:FTSE", 8900.0),
        java.util.Map.entry("GLOBAL:DAX", 24500.0),
        java.util.Map.entry("GLOBAL:CAC", 8100.0),
        java.util.Map.entry("GLOBAL:SX5E", 5500.0),
        java.util.Map.entry("GLOBAL:STOXX", 560.0),
        java.util.Map.entry("GLOBAL:N225", 40500.0),
        java.util.Map.entry("GLOBAL:HSI", 23500.0),
        java.util.Map.entry("GLOBAL:SHCOMP", 3500.0),
        java.util.Map.entry("GLOBAL:CSI300", 4100.0),
        java.util.Map.entry("GLOBAL:KS11", 2650.0),
        java.util.Map.entry("GLOBAL:ASX200", 8300.0),
        java.util.Map.entry("GLOBAL:STI", 3900.0),
        java.util.Map.entry("GLOBAL:TWII", 22500.0),
        java.util.Map.entry("GLOBAL:NIFTY 50", 25000.0),
        java.util.Map.entry("GLOBAL:BOVESPA", 131000.0),
        java.util.Map.entry("GLOBAL:MXX", 54500.0),
        java.util.Map.entry("GLOBAL:IMOEX", 3100.0),
        java.util.Map.entry("GLOBAL:JTOPI", 7100.0),
        java.util.Map.entry("GLOBAL:SET50", 1400.0),
        java.util.Map.entry("GLOBAL:VNI", 1300.0),
        java.util.Map.entry("GLOBAL:FTSE EPRA", 2100.0));

    private static double demoBasePrice(String symbol) {
        Double fixed = DEMO_BASE_PRICE.get(symbol);
        if (fixed != null) return fixed;
        if (symbol.startsWith("NSE:NIFTY")) return 25000;
        if (symbol.startsWith("GLOBAL:")) return 10000;
        if (symbol.startsWith("MCX:")) return 5000;
        return 900 + Math.abs(symbol.hashCode() % 1800);
    }

    private record LiveBar(ChartController.Candle candle, long fetchedAt) {}

    public BrokerCandleService(@Value("${zerodha.api-key:}") String zerodhaApiKey,
                               @Value("${angelone.api-key:}") String angelApiKey,
                               @Value("${angelone.public-ip:49.207.180.150}") String angelPublicIp,
                               CredentialStore store) {
        this.zerodhaApiKey = zerodhaApiKey;
        this.angelApiKey = angelApiKey;
        this.angelPublicIp = angelPublicIp;
        this.store = store;
    }

    public String lastAngelError() { return lastAngelError; }

    private void recordAngelError(String detail) {
        this.lastAngelError = detail;
        log.warn("Angel error: {}", detail);
    }

    public List<ChartController.Candle> fetchCandles(String provider, String symbol, String interval, int count, HttpSession session) {
        return fetchCandles(provider, symbol, interval, count, null, null, session);
    }

    public List<ChartController.Candle> fetchCandles(String provider, String symbol, String interval, int count, Long toTimeSec, Long fromTimeSec, HttpSession session) {
        String cacheKey = provider + ":" + symbol.toUpperCase(Locale.ROOT) + ":" + interval;
        if (toTimeSec == null) {
            List<ChartController.Candle> fresh = lastKnown.get(cacheKey);
            if (fresh != null && !fresh.isEmpty()
                && System.currentTimeMillis() - lastKnownAt.getOrDefault(cacheKey, 0L) < LAST_KNOWN_TTL_MS) {
                return fresh;
            }
        }
        List<ChartController.Candle> result = switch (provider) {
            case "ZERODHA" -> fetchZerodhaCandles(symbol, interval, count, fromTimeSec, toTimeSec, session);
            case "ANGEL_ONE" -> fetchAngelCandles(symbol, interval, count, fromTimeSec, toTimeSec, session);
            default -> null;
        };
        if (result != null && !result.isEmpty()) {
            lastKnown.put(cacheKey, result);
            lastKnownAt.put(cacheKey, System.currentTimeMillis());
            warmOtherIntervals(provider, symbol, count, session);
        }
        return result;
    }

    public List<ChartController.Candle> lastKnownCandles(String provider, String symbol, String interval) {
        return lastKnown.get(provider + ":" + symbol.toUpperCase(Locale.ROOT) + ":" + interval);
    }

    private static final List<String> ALL_INTERVALS = List.of("1m", "5m", "15m", "1h", "1d");
    private final java.util.concurrent.ConcurrentHashMap.KeySetView<String, Boolean> warmInProgress = java.util.concurrent.ConcurrentHashMap.newKeySet();

    /** Warm the other intervals for the same symbol in the background so timeframe switches become cache hits. */
    private void warmOtherIntervals(String provider, String symbol, int count, HttpSession session) {
        String warmKey = provider + ":" + symbol.toUpperCase(Locale.ROOT);
        if (!warmInProgress.add(warmKey)) return;
        Thread worker = new Thread(() -> {
            try {
                for (String iv : ALL_INTERVALS) {
                    try {
                        fetchCandles(provider, symbol, iv, count, session);
                    } catch (Exception ignored) { }
                }
            } finally {
                warmInProgress.remove(warmKey);
            }
        }, "warm-" + warmKey);
        worker.setDaemon(true);
        worker.start();
    }

    public boolean isConnected(String provider, HttpSession session) {
        return switch (provider) {
            case "ZERODHA" -> hasValue(session, "zerodha.access-token") || hasStoreValue("zerodha", "accessToken");
            case "ANGEL_ONE" -> hasValue(session, "angel-one.access-token") || hasStoreValue("angel-one", "accessToken");
            default -> false;
        };
    }

    private boolean hasStoreValue(String broker, String key) {
        String v = store.get(broker, key);
        return v != null && !v.isBlank();
    }

    private String resolveAngelAccessToken(HttpSession session) {
        String token = (String) session.getAttribute("angel-one.access-token");
        if (token != null && !token.isBlank()) return token;
        String stored = store.get("angel-one", "accessToken");
        if (stored != null && !stored.isBlank()) {
            session.setAttribute("angel-one.access-token", stored);
            return stored;
        }
        return null;
    }

    private void invalidateAngelTokens(HttpSession session) {
        session.removeAttribute("angel-one.access-token");
        session.removeAttribute("angel-one.feed-token");
        store.remove("angel-one", "accessToken");
        store.remove("angel-one", "feedToken");
        log.warn("Angel One token rejected; cleared stored tokens, re-login required.");
    }

    /** Angel returns HTTP 200 with success:false for expired/invalid JWTs; detect those and clear the token. */
    private boolean angelAuthFailed(String body, HttpSession session) {
        try {
            JsonNode root = json.readTree(body);
            if (!root.path("success").isBoolean() || root.path("success").asBoolean()) return false;
            String message = root.path("message").asText("");
            String errorCode = root.path("errorCode").asText("");
            String lower = message.toLowerCase();
            boolean authError = errorCode.equals("AG8001") || errorCode.equals("AG8003")
                || errorCode.equals("AG8004") || errorCode.equals("AG8005")
                || lower.contains("invalid token") || lower.contains("session expired")
                || lower.contains("token expired") || lower.contains("login failed");
            if (authError) {
                invalidateAngelTokens(session);
                return true;
            }
        } catch (Exception ignored) { }
        return false;
    }

    private static boolean isAngelRateLimit(int statusCode, String body) {
        if (statusCode != 403) return false;
        String lower = body == null ? "" : body.toLowerCase();
        return lower.contains("access denied") || lower.contains("exceeding access rate")
            || lower.contains("rate") || lower.contains("too many requests") || lower.contains("429");
    }

    private boolean isQuoteThrottled(String key) {
        long now = System.currentTimeMillis();
        Long last = lastQuoteFetch.get(key);
        if (last != null && now - last < QUOTE_THROTTLE_MS) return true;
        lastQuoteFetch.put(key, now);
        return false;
    }

    private void invalidateZerodhaTokens(HttpSession session) {
        session.removeAttribute("zerodha.access-token");
        session.removeAttribute("zerodha.user-id");
        store.remove("zerodha", "accessToken");
        store.remove("zerodha", "userId");
        log.warn("Zerodha token rejected; cleared stored tokens, re-login required.");
    }

    private boolean hasValue(HttpSession session, String attribute) {
        Object value = session.getAttribute(attribute);
        return value != null && !value.toString().isBlank();
    }

    public List<ChartController.Candle> generateDemo(String symbol, String interval, int count) {
        return generateDemoTo(symbol, interval, count, Instant.now().toEpochMilli());
    }

    public List<ChartController.Candle> generateDemoTo(String symbol, String interval, int count, long toTimeMs) {
        long seconds = getIntervalSeconds(interval);
        java.util.Random random = new java.util.Random((long) symbol.hashCode() * 31 + interval.hashCode() * 37 + toTimeMs);
        double price = demoBasePrice(symbol);
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        boolean isDaily = "1d".equals(interval);
        double volScale = Math.max(Math.sqrt(seconds / 86400.0), .06);
        List<ChartController.Candle> result = new ArrayList<>();
        long currentMs = floorToIntervalStart(toTimeMs, seconds, isDaily, ist);
        int maxIterations = Math.max(count * 30, (int) Math.ceil(3.0 * 86400 / seconds));
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

    private long floorToIntervalStart(long ms, long seconds, boolean isDaily, ZoneId ist) {
        ZonedDateTime zdt = Instant.ofEpochMilli(ms).atZone(ist);
        if (isDaily) {
            return zdt.toLocalDate().atStartOfDay(ist).toInstant().toEpochMilli();
        }
        long minutes = Math.max(1, seconds / 60);
        long minuteOfDay = zdt.getHour() * 60L + zdt.getMinute();
        long floored = minuteOfDay - Math.floorMod(minuteOfDay, minutes);
        return zdt.toLocalDate().atTime((int) (floored / 60), (int) (floored % 60)).atZone(ist).toInstant().toEpochMilli();
    }

    public List<ChartController.Candle> generateDemoRange(String symbol, String interval, long fromTimeMs, long toTimeMs, int maxCount) {
        long seconds = getIntervalSeconds(interval);
        long expected = Math.max(20, (toTimeMs - fromTimeMs) / (seconds * 1000) + 5);
        int count = (int) Math.min(expected, maxCount);
        return generateDemoForward(symbol, interval, count, fromTimeMs, toTimeMs);
    }

    private List<ChartController.Candle> generateDemoForward(String symbol, String interval, int count, long fromTimeMs, long toTimeMs) {
        long seconds = getIntervalSeconds(interval);
        java.util.Random random = new java.util.Random((long) symbol.hashCode() * 31 + interval.hashCode() * 37);
        double price = demoBasePrice(symbol);
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        boolean isDaily = "1d".equals(interval);
        double volScale = Math.max(Math.sqrt(seconds / 86400.0), .06);
        List<ChartController.Candle> result = new ArrayList<>();
        long currentMs = floorToIntervalStart(fromTimeMs, seconds, isDaily, ist);
        int maxIterations = Math.max(count * 30, (int) Math.ceil(3.0 * 86400 / seconds));
        int lastSessionDay = -1;
        for (int iter = 0; result.size() < count && iter < maxIterations && currentMs <= toTimeMs; iter++) {
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
            currentMs += seconds * 1000;
        }
        return result;
    }

    public long intervalSeconds(String interval) {
        return getIntervalSeconds(interval);
    }

    public List<ChartController.Candle> generateDemoBackfill(String symbol, String interval, long fromTimeMs, long toTimeMs, int maxCount, double anchorPrice) {
        long seconds = getIntervalSeconds(interval);
        java.util.Random random = new java.util.Random((long) symbol.hashCode() * 31 + interval.hashCode() * 37);
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        boolean isDaily = "1d".equals(interval);
        double volScale = Math.max(Math.sqrt(seconds / 86400.0), .06);
        List<ChartController.Candle> result = new ArrayList<>();
        long currentMs = floorToIntervalStart(toTimeMs, seconds, isDaily, ist);
        int maxIterations = Math.max(maxCount * 30, (int) Math.ceil(3.0 * 86400 / seconds));
        double nextOpen = Math.max(1, anchorPrice);
        int lastSessionDay = -1;
        for (int iter = 0; result.size() < maxCount && iter < maxIterations && currentMs >= fromTimeMs; iter++) {
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
                            double gap = (random.nextDouble() - .5) * nextOpen * .025;
                            nextOpen = Math.max(1, nextOpen + gap);
                        }
                        lastSessionDay = dayKey;
                    }
                    double close = nextOpen;
                    double change = (random.nextDouble() - .5) * nextOpen * .018 * volScale;
                    double open = Math.max(1, close - change);
                    double upperWick = random.nextDouble() * nextOpen * .005 * volScale;
                    double lowerWick = random.nextDouble() * nextOpen * .005 * volScale;
                    double high = Math.max(open, close) + upperWick;
                    double low = Math.min(open, close) - lowerWick;
                    long volume = 80_000 + random.nextInt(1_500_000);
                    result.add(new ChartController.Candle(currentMs, round(open), round(high), round(low), round(close), volume));
                    nextOpen = open;
                }
            }
            currentMs -= seconds * 1000;
        }
        java.util.Collections.reverse(result);
        return result;
    }

    private long getIntervalSeconds(String interval) {
        return switch (interval) { case "1m" -> 60; case "5m" -> 300; case "15m" -> 900; case "1h" -> 3600; default -> 86400; };
    }

    private List<ChartController.Candle> fetchZerodhaCandles(String symbol, String interval, int count, Long fromTimeSec, Long toTimeSec, HttpSession session) {
        try {
            String accessToken = resolveZerodhaAccessToken(session);
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
            long from = fromTimeSec != null ? fromTimeSec : now - count * intervalSeconds;

            String cacheKey = "ZERODHA:" + instrumentToken + ":" + interval + ":" + from + ":" + now;
            List<ChartController.Candle> cached = cache.get(cacheKey);
            if (cached != null) return cached;

            String url = "https://api.kite.trade/instruments/historical/" + instrumentToken + "/" + kiteInterval + "?from=" + from + "&to=" + now;
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("X-Kite-Version", "3")
                .header("Authorization", "token " + apiKey + ":" + accessToken)
                .GET().timeout(java.time.Duration.ofSeconds(15)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                if (response.statusCode() == 401 || response.statusCode() == 403) invalidateZerodhaTokens(session);
                log.warn("Zerodha historical {} failed HTTP {} for {}: {}", kiteInterval, response.statusCode(), symbol,
                    response.body().length() > 300 ? response.body().substring(0, 300) : response.body());
                return null;
            }

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
            if (!candles.isEmpty()) {
                cache.put(cacheKey, candles);
                String lk = "ZERODHA:" + symbol.toUpperCase(Locale.ROOT) + ":" + interval;
                lastKnown.put(lk, candles);
                lastKnownAt.put(lk, System.currentTimeMillis());
            }
            return candles;
        } catch (Exception e) {
            log.warn("Zerodha historical failed for {}: {}", symbol, e.toString());
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
                if (res.statusCode() / 100 != 2) {
                    log.warn("Zerodha instruments {} failed HTTP {}", exchange, res.statusCode());
                    return null;
                }
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

    private String resolveZerodhaAccessToken(HttpSession session) {
        String token = (String) session.getAttribute("zerodha.access-token");
        if (token != null && !token.isBlank()) return token;
        String stored = store.get("zerodha", "accessToken");
        if (stored != null && !stored.isBlank()) {
            session.setAttribute("zerodha.access-token", stored);
            return stored;
        }
        return null;
    }

    /** Latest real market price for a symbol via Kite's snapshot quote endpoint. */
    public Double fetchLastPrice(String symbol, HttpSession session) {
        String accessToken = resolveZerodhaAccessToken(session);
        String apiKey = resolveZerodhaApiKey(session);
        if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;
        if (isQuoteThrottled("ZERODHA:" + symbol)) return null;
        try {
            String url = "https://api.kite.trade/quote/ltp?i=" + java.net.URLEncoder.encode(symbol, java.nio.charset.StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .header("X-Kite-Version", "3")
                .header("Authorization", "token " + apiKey + ":" + accessToken)
                .GET().timeout(java.time.Duration.ofSeconds(10)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                if (response.statusCode() == 401 || response.statusCode() == 403) invalidateZerodhaTokens(session);
                log.warn("Zerodha LTP {} failed HTTP {}", symbol, response.statusCode());
                return null;
            }
            JsonNode data = json.readTree(response.body()).path("data").path(symbol);
            double ltp = data.path("last_price").asDouble();
            return ltp > 0 ? ltp : null;
        } catch (Exception e) {
            log.warn("Zerodha LTP failed for {}: {}", symbol, e.toString());
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
            String accessToken = resolveZerodhaAccessToken(session);
            String apiKey = resolveZerodhaApiKey(session);
            if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;
            String[] parts = symbol.split(":");
            String exchange = parts.length > 1 ? parts[0] : "NSE";
            String tradingSymbol = parts.length > 1 ? parts[1] : symbol;
            Long token = resolveInstrumentToken(exchange, tradingSymbol, apiKey, accessToken);
            if (token == null) return null;
            String key = "ZERODHA:" + token + ":" + interval;
            LiveBar live = refreshLiveBar(zerodhaLiveBars, key, exchange, interval,
                () -> fetchZerodhaCandles(symbol, interval, 2, null, null, session));
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
            String accessToken = resolveAngelAccessToken(session);
            String apiKey = resolveAngelApiKey(session);
            if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;
            String[] parts = symbol.split(":");
            String exchange = parts.length > 1 ? parts[0] : "NSE";
            String tradingSymbol = parts.length > 1 ? parts[1] : symbol;
            if (!isSupportedExchange(exchange)) return null;
            String ip = angelClientIp(session);
            String token = resolveAngelToken(exchange, tradingSymbol, apiKey, accessToken, ip, session);
            if (token == null) return null;
            String key = "ANGEL:" + exchange + ":" + token + ":" + interval;
            LiveBar live = refreshLiveBar(angelLiveBars, key, exchange, interval,
                () -> fetchAngelCandlesByToken(exchange, tradingSymbol, token, interval, 2, null, null, apiKey, accessToken, ip, session));
            if (live == null) return null;
            Double ltp = fetchAngelLtp(exchange, token, apiKey, accessToken, ip, session);
            if (ltp == null) return live.candle();
            ChartController.Candle updated = mergeLtp(live.candle(), ltp);
            angelLiveBars.put(key, new LiveBar(updated, live.fetchedAt()));
            return updated;
        } catch (Exception e) {
            return null;
        }
    }

    private static final long LIVE_REFETCH_SESSION_MS = 30_000;
    private static final long LIVE_REFETCH_IDLE_MS = 120_000;
    private static final long QUOTE_THROTTLE_MS = 5_000;
    private final ConcurrentHashMap<String, Long> lastQuoteFetch = new ConcurrentHashMap<>();

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

    private List<ChartController.Candle> fetchAngelCandles(String symbol, String interval, int count, Long fromTimeSec, Long toTimeSec, HttpSession session) {
        try {
            String accessToken = resolveAngelAccessToken(session);
            String apiKey = resolveAngelApiKey(session);
            if (accessToken == null || accessToken.isBlank() || apiKey == null || apiKey.isBlank()) return null;
            String[] parts = symbol.split(":");
            String exchange = parts.length > 1 ? parts[0] : "NSE";
            String tradingSymbol = parts.length > 1 ? parts[1] : symbol;
            if (!isSupportedExchange(exchange)) return null;
            String ip = angelClientIp(session);
            String token = resolveAngelToken(exchange, tradingSymbol, apiKey, accessToken, ip, session);
            if (token == null) return null;
            return fetchAngelCandlesByToken(exchange, tradingSymbol, token, interval, count, fromTimeSec, toTimeSec, apiKey, accessToken, ip, session);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isSupportedExchange(String exchange) {
        return exchange.equals("NSE") || exchange.equals("BSE") || exchange.equals("MCX")
            || exchange.equals("NFO") || exchange.equals("BFO");
    }

    private List<ChartController.Candle> fetchAngelCandlesByToken(String exchange, String tradingSymbol, String token,
                                                                   String interval, int count, Long fromTimeSec, Long toTimeSec,
                                                                   String apiKey, String accessToken, String ip,
                                                                   HttpSession session) {
        try {
            long nowSec = toTimeSec != null ? toTimeSec : Instant.now().getEpochSecond();
            long intervalSeconds = getIntervalSeconds(interval);
            long fromSec = fromTimeSec != null ? fromTimeSec : nowSec - count * intervalSeconds;
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
                .header("X-ClientLocalIP", ip).header("X-ClientPublicIP", angelPublicIp)
                .header("X-MACAddress", ANGEL_MAC).header("X-PrivateKey", apiKey)
                .header("Authorization", "Bearer " + accessToken)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .timeout(java.time.Duration.ofSeconds(15)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            int retries = 0;
            while (isAngelRateLimit(response.statusCode(), response.body()) && retries < 3) {
                try { Thread.sleep(1000L * (retries + 1)); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                retries++;
                response = client.send(request, HttpResponse.BodyHandlers.ofString());
            }
            if (angelAuthFailed(response.body(), session)) {
                recordAngelError("Token rejected for " + tradingSymbol + ": " + response.body().substring(0, Math.min(200, response.body().length())));
                return null;
            }
            if (response.statusCode() / 100 != 2) {
                if (response.statusCode() == 401) invalidateAngelTokens(session);
                recordAngelError("getCandleData " + tradingSymbol + " HTTP " + response.statusCode() + ": "
                    + response.body().substring(0, Math.min(200, response.body().length())));
                log.warn("Angel getCandleData {} failed HTTP {}: {}", tradingSymbol, response.statusCode(),
                    response.body().length() > 300 ? response.body().substring(0, 300) : response.body());
                return null;
            }
            JsonNode data = json.readTree(response.body()).path("data");
            if (!data.isArray()) {
                recordAngelError("getCandleData " + tradingSymbol + " returned no data");
                return null;
            }
            List<ChartController.Candle> candles = new ArrayList<>();
            for (JsonNode row : data) {
                if (!row.isArray() || row.size() < 6) continue;
                long time = parseAngelTimestamp(row.get(0).asText(), fmt);
                candles.add(new ChartController.Candle(time, row.get(1).asDouble(), row.get(2).asDouble(),
                    row.get(3).asDouble(), row.get(4).asDouble(), row.get(5).asLong()));
            }
            if (!candles.isEmpty()) {
                cache.put(cacheKey, candles);
                String lk = "ANGEL_ONE:" + (exchange + ":" + tradingSymbol).toUpperCase(Locale.ROOT) + ":" + interval;
                lastKnown.put(lk, candles);
                lastKnownAt.put(lk, System.currentTimeMillis());
            }
            return candles;
        } catch (Exception e) {
            recordAngelError("getCandleData " + tradingSymbol + " exception: " + e.getMessage());
            log.warn("Angel getCandleData failed for {}: {}", tradingSymbol, e.toString());
            return null;
        }
    }

    private long parseAngelTimestamp(String text, DateTimeFormatter fallbackFmt) {
        try {
            return OffsetDateTime.parse(text).toInstant().toEpochMilli();
        } catch (Exception e) {
            return LocalDateTime.parse(text, fallbackFmt).atZone(IST).toInstant().toEpochMilli();
        }
    }

    private String angelInterval(String interval) {
        return switch (interval) {
            case "1m" -> "ONE_MINUTE"; case "5m" -> "FIVE_MINUTE"; case "15m" -> "FIFTEEN_MINUTE";
            case "1h" -> "ONE_HOUR"; default -> "ONE_DAY";
        };
    }

    private String resolveAngelToken(String exchange, String tradingSymbol, String apiKey, String accessToken, String ip, HttpSession session) {
        try {
            String cacheKey = "angeltoken:" + exchange + ":" + tradingSymbol;
            String cached = angelTokenCache.get(cacheKey);
            if (cached != null) return cached;
            if ("NSE".equals(exchange) || "BSE".equals(exchange)) {
                String idx = ANGEL_INDEX_TOKENS.get(tradingSymbol.toUpperCase(Locale.ROOT));
                if (idx != null) {
                    angelTokenCache.put(cacheKey, idx);
                    return idx;
                }
            }
            List<String> searches = new ArrayList<>();
            searches.add(tradingSymbol);
            String noSpace = tradingSymbol.replace(" ", "");
            if (!noSpace.equals(tradingSymbol)) searches.add(noSpace);
            String base = tradingSymbol.indexOf(' ') > 0 ? tradingSymbol.substring(0, tradingSymbol.indexOf(' ')) : tradingSymbol;
            if (!searches.contains(base) && !base.isBlank()) searches.add(base);
            for (String search : searches) {
                String token = searchAngelToken(exchange, search, apiKey, accessToken, ip, session);
                if (token != null) {
                    angelTokenCache.put(cacheKey, token);
                    return token;
                }
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private String searchAngelToken(String exchange, String search, String apiKey, String accessToken, String ip, HttpSession session) {
        try {
            Map<String, Object> body = Map.of("exchange", exchange, "searchscrip", search);
            HttpRequest request = HttpRequest.newBuilder(URI.create(ANGEL_BASE + "/order/v1/searchScrip"))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .header("X-UserType", "USER").header("X-SourceID", "WEB")
                .header("X-ClientLocalIP", ip).header("X-ClientPublicIP", angelPublicIp)
                .header("X-MACAddress", ANGEL_MAC).header("X-PrivateKey", apiKey)
                .header("Authorization", "Bearer " + accessToken)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .timeout(java.time.Duration.ofSeconds(15)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            int retries = 0;
            while (isAngelRateLimit(response.statusCode(), response.body()) && retries < 3) {
                try { Thread.sleep(1000L * (retries + 1)); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                retries++;
                response = client.send(request, HttpResponse.BodyHandlers.ofString());
            }
            if (angelAuthFailed(response.body(), session)) return null;
            if (response.statusCode() / 100 != 2) {
                if (response.statusCode() == 401) invalidateAngelTokens(session);
                log.warn("Angel searchScrip {} failed HTTP {}: {}", search, response.statusCode(),
                    response.body().length() > 300 ? response.body().substring(0, 300) : response.body());
                return null;
            }
            JsonNode data = json.readTree(response.body()).path("data");
            if (!data.isArray() || data.isEmpty()) return null;
            String spot = null, exact = null, idxSpot = null, first = null;
            for (JsonNode item : data) {
                String symbol = field(item, "tradingsymbol", "symbol");
                String exch = field(item, "exchange", "exch_seg");
                String type = field(item, "instrumenttype", "instrumentType");
                String token = field(item, "symboltoken", "token");
                if (token.isBlank() || !exch.equals(exchange)) continue;
                if (first == null) first = token;
                boolean isIndex = type.contains("IDX") || type.contains("INDEX");
                if (symbol.equalsIgnoreCase(search) && exact == null) exact = token;
                if (isIndex && idxSpot == null) idxSpot = token;
                if (("EQ".equals(type) || "AMX_IDX".equals(type)) && spot == null) spot = token;
            }
            String best = idxSpot != null ? idxSpot : (exact != null ? exact : (spot != null ? spot : first));
            return (best == null || best.isBlank()) ? null : best;
        } catch (Exception e) {
            return null;
        }
    }

    private static String field(JsonNode item, String... names) {
        for (String name : names) {
            JsonNode value = item.path(name);
            if (!value.isMissingNode() && !value.isNull()) return value.asText("");
        }
        return "";
    }

    private Double fetchAngelLtp(String exchange, String token, String apiKey, String accessToken, String ip, HttpSession session) {
        if (isQuoteThrottled("ANGEL:" + exchange + ":" + token)) return null;
        try {
            Map<String, Object> body = Map.of("mode", "LTP", "exchangeTokens", Map.of(exchange, List.of(token)));
            HttpRequest request = HttpRequest.newBuilder(URI.create(ANGEL_BASE + "/market/v1/quote"))
                .header("Content-Type", "application/json").header("Accept", "application/json")
                .header("X-UserType", "USER").header("X-SourceID", "WEB")
                .header("X-ClientLocalIP", ip).header("X-ClientPublicIP", angelPublicIp)
                .header("X-MACAddress", ANGEL_MAC).header("X-PrivateKey", apiKey)
                .header("Authorization", "Bearer " + accessToken)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .timeout(java.time.Duration.ofSeconds(10)).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            int retries = 0;
            while (isAngelRateLimit(response.statusCode(), response.body()) && retries < 3) {
                try { Thread.sleep(1000L * (retries + 1)); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                retries++;
                response = client.send(request, HttpResponse.BodyHandlers.ofString());
            }
            if (angelAuthFailed(response.body(), session)) return null;
            if (response.statusCode() / 100 != 2) {
                if (response.statusCode() == 401) invalidateAngelTokens(session);
                log.warn("Angel quote failed HTTP {}: {}", response.statusCode(),
                    response.body().length() > 300 ? response.body().substring(0, 300) : response.body());
                return null;
            }
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
            log.warn("Angel quote failed: {}", e.toString());
            return null;
        }
    }

    private String resolveAngelApiKey(HttpSession session) {
        String sessionKey = (String) session.getAttribute("angel-one.api-key");
        if (sessionKey != null && !sessionKey.isBlank()) return sessionKey;
        String stored = store.get("angel-one", "apiKey");
        return (stored != null && !stored.isBlank()) ? stored : angelApiKey;
    }

    private String angelClientIp(HttpSession session) {
        String ip = (String) session.getAttribute("angel-one.client-ip");
        if (!isLoopback(ip)) return ip;
        String stored = store.get("angel-one", "clientIp");
        return (!isLoopback(stored)) ? stored : ANGEL_LOCAL_IP;
    }

    private static boolean isLoopback(String ip) {
        if (ip == null || ip.isBlank()) return true;
        String v = ip.toLowerCase();
        return v.equals("localhost") || v.equals("::1") || v.equals("0:0:0:0:0:0:0:1")
            || v.startsWith("127.") || v.startsWith("::ffff:127.");
    }

    private double round(double n) { return Math.round(n * 100.0) / 100.0; }
}

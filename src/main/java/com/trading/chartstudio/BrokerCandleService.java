package com.trading.chartstudio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class BrokerCandleService {

    private final String zerodhaApiKey;
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();
    private final ConcurrentHashMap<String, List<ChartController.Candle>> cache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> instrumentCache = new ConcurrentHashMap<>();

    public BrokerCandleService(@Value("${zerodha.api-key:}") String zerodhaApiKey) {
        this.zerodhaApiKey = zerodhaApiKey;
    }

    public List<ChartController.Candle> fetchCandles(String provider, String symbol, String interval, int count, HttpSession session) {
        return fetchCandles(provider, symbol, interval, count, null, session);
    }

    public List<ChartController.Candle> fetchCandles(String provider, String symbol, String interval, int count, Long toTimeSec, HttpSession session) {
        return switch (provider) {
            case "ZERODHA" -> fetchZerodhaCandles(symbol, interval, count, toTimeSec, session);
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
        return (k != null && !k.isBlank()) ? k : zerodhaApiKey;
    }

    private double round(double n) { return Math.round(n * 100.0) / 100.0; }
}

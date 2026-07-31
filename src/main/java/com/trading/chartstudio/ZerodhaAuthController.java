package com.trading.chartstudio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Server-side Kite Connect authentication. Secrets never leave this application. */
@RestController
@RequestMapping("/api/auth/zerodha")
public class ZerodhaAuthController {
    private final String apiKey;
    private final String apiSecret;
    private final String appUrl;
    private final CredentialStore store;
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper;

    public ZerodhaAuthController(@Value("${zerodha.api-key:}") String apiKey,
                                 @Value("${zerodha.api-secret:}") String apiSecret,
                                 @Value("${app.public-url:http://localhost:8080}") String appUrl,
                                 CredentialStore store,
                                 ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.appUrl = appUrl.replaceAll("/+$", "");
        this.store = store;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/configure")
    public ResponseEntity<?> configure(@RequestBody ConfigureRequest req, HttpSession session) {
        if (req.apiKey == null || req.apiKey.isBlank() || req.apiSecret == null || req.apiSecret.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "API Key and Secret are required."));
        }
        session.setAttribute("zerodha.api-key", req.apiKey.trim());
        session.setAttribute("zerodha.api-secret", req.apiSecret.trim());
        store.putAll("zerodha", Map.of("apiKey", req.apiKey.trim(), "apiSecret", req.apiSecret.trim()));
        return ResponseEntity.ok(Map.of("configured", true));
    }

    @GetMapping("/start")
    public ResponseEntity<?> start(HttpSession session) {
        requireConfiguration(session);
        String state = randomState();
        session.setAttribute("zerodha.oauth-state", state);
        String loginUrl = "https://kite.zerodha.com/connect/login?v=3&api_key=" + encode(resolveApiKey(session));
        return ResponseEntity.status(302).location(URI.create(loginUrl)).build();
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam(name = "request_token", required = false) String requestToken,
                                         @RequestParam(name = "status", defaultValue = "error") String status,
                                         @RequestParam(name = "state", required = false) String state,
                                         HttpSession session) throws Exception {
        requireConfiguration(session);
        String savedState = (String) session.getAttribute("zerodha.oauth-state");
        session.removeAttribute("zerodha.oauth-state");
        if (!"success".equals(status) || requestToken == null || requestToken.isBlank()) {
            return ResponseEntity.status(302).location(URI.create(appUrl + "/?broker=zerodha&connected=false")).build();
        }
        if (savedState != null && state != null && !savedState.equals(state)) {
            return ResponseEntity.status(302).location(URI.create(appUrl + "/?broker=zerodha&connected=false")).build();
        }
        String ak = resolveApiKey(session);
        String checksum = sha256(ak + requestToken + resolveApiSecret(session));
        String body = "api_key=" + encode(ak) + "&request_token=" + encode(requestToken) + "&checksum=" + checksum;
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.kite.trade/session/token"))
            .header("X-Kite-Version", "3")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            return ResponseEntity.status(302).location(URI.create(appUrl + "/?broker=zerodha&connected=false")).build();
        }
        JsonNode data = objectMapper.readTree(response.body()).path("data");
        String accessToken = data.path("access_token").asText();
        if (accessToken.isBlank()) {
            return ResponseEntity.status(302).location(URI.create(appUrl + "/?broker=zerodha&connected=false")).build();
        }
        session.setAttribute("zerodha.access-token", accessToken);
        session.setAttribute("zerodha.user-id", data.path("user_id").asText());
        return ResponseEntity.status(302).location(URI.create(appUrl + "/?broker=zerodha&connected=true")).build();
    }

    @GetMapping("/status")
    public Map<String, Object> status(HttpSession session) {
        String userId = (String) session.getAttribute("zerodha.user-id");
        boolean envConfigured = !apiKey.isBlank() && !apiSecret.isBlank();
        boolean sessionConfigured = session.getAttribute("zerodha.api-key") != null;
        boolean hasCredentials = store.has("zerodha", "apiKey", "apiSecret");
        return Map.of("connected", userId != null, "userId", userId == null ? "" : userId,
            "configured", envConfigured || sessionConfigured || hasCredentials,
            "hasCredentials", hasCredentials);
    }

    private void requireConfiguration(HttpSession session) {
        if (resolveApiKey(session).isBlank() || resolveApiSecret(session).isBlank()) {
            throw new IllegalStateException("Zerodha is not configured. Set ZERODHA_API_KEY and ZERODHA_API_SECRET on the server, or configure via the UI.");
        }
    }
    private String resolveApiKey(HttpSession session) {
        String k = (String) session.getAttribute("zerodha.api-key");
        if (k != null && !k.isBlank()) return k;
        String stored = store.get("zerodha", "apiKey");
        return (stored != null && !stored.isBlank()) ? stored : apiKey;
    }
    private String resolveApiSecret(HttpSession session) {
        String s = (String) session.getAttribute("zerodha.api-secret");
        if (s != null && !s.isBlank()) return s;
        String stored = store.get("zerodha", "apiSecret");
        return (stored != null && !stored.isBlank()) ? stored : apiSecret;
    }
    public record ConfigureRequest(String apiKey, String apiSecret) {}
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private static String sha256(String value) throws Exception { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
    private static String randomState() { byte[] value = new byte[24]; new SecureRandom().nextBytes(value); return HexFormat.of().formatHex(value); }
}

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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** OAuth-based connections for Upstox and Fyers. Tokens stay in the HTTP session. */
@RestController
@RequestMapping("/api/auth")
public class OtherBrokerAuthController {
    private final String upstoxKey, upstoxSecret, fyersId, fyersSecret, appUrl;
    private final CredentialStore store;
    private final ObjectMapper json;
    private final HttpClient client = HttpClient.newHttpClient();

    public OtherBrokerAuthController(@Value("${upstox.api-key:}") String upstoxKey,
                                     @Value("${upstox.api-secret:}") String upstoxSecret,
                                     @Value("${fyers.app-id:}") String fyersId,
                                     @Value("${fyers.app-secret:}") String fyersSecret,
                                     @Value("${app.public-url:http://localhost:8080}") String appUrl,
                                     CredentialStore store,
                                     ObjectMapper json) {
        this.upstoxKey = upstoxKey; this.upstoxSecret = upstoxSecret;
        this.fyersId = fyersId; this.fyersSecret = fyersSecret;
        this.appUrl = appUrl.replaceAll("/+$", ""); this.store = store; this.json = json;
    }

    private record ConfigureRequest(String apiKey, String apiSecret) {}

    @PostMapping("/upstox/configure")
    public ResponseEntity<?> upstoxConfigure(@RequestBody ConfigureRequest req) {
        if (req.apiKey == null || req.apiKey.isBlank() || req.apiSecret == null || req.apiSecret.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "API Key and Secret are required."));
        }
        store.putAll("upstox", Map.of("apiKey", req.apiKey.trim(), "apiSecret", req.apiSecret.trim()));
        return ResponseEntity.ok(Map.of("configured", true));
    }

    @PostMapping("/fyers/configure")
    public ResponseEntity<?> fyersConfigure(@RequestBody ConfigureRequest req) {
        if (req.apiKey == null || req.apiKey.isBlank() || req.apiSecret == null || req.apiSecret.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "App ID and Secret are required."));
        }
        store.putAll("fyers", Map.of("appId", req.apiKey.trim(), "appSecret", req.apiSecret.trim()));
        return ResponseEntity.ok(Map.of("configured", true));
    }

    @GetMapping("/upstox/start")
    public ResponseEntity<?> upstoxStart(HttpSession session) {
        String resolvedKey = resolveUpstoxKey();
        String resolvedSecret = resolveUpstoxSecret();
        if (!configured(resolvedKey, resolvedSecret)) return unavailable("Upstox is not configured");
        String state = randomState(); session.setAttribute("upstox.oauth-state", state);
        String callback = appUrl + "/api/auth/upstox/callback";
        String url = "https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=" + enc(resolvedKey) + "&redirect_uri=" + enc(callback) + "&state=" + enc(state);
        return redirect(url);
    }

    @GetMapping("/upstox/callback")
    public ResponseEntity<Void> upstoxCallback(@RequestParam(required = false) String code, @RequestParam(required = false) String state, HttpSession session) throws Exception {
        if (!validState(session, "upstox.oauth-state", state) || code == null) return appRedirect("upstox", false);
        String resolvedKey = resolveUpstoxKey();
        String resolvedSecret = resolveUpstoxSecret();
        if (!configured(resolvedKey, resolvedSecret)) return appRedirect("upstox", false);
        String callback = appUrl + "/api/auth/upstox/callback";
        String body = "code=" + enc(code) + "&client_id=" + enc(resolvedKey) + "&client_secret=" + enc(resolvedSecret) + "&redirect_uri=" + enc(callback) + "&grant_type=authorization_code";
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.upstox.com/v2/login/authorization/token"))
            .header("accept", "application/json").header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(body)).build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode data = json.readTree(response.body()); String token = data.path("access_token").asText();
        if (response.statusCode() / 100 != 2 || token.isBlank()) return appRedirect("upstox", false);
        session.setAttribute("upstox.access-token", token); session.setAttribute("upstox.user-id", data.path("user_id").asText());
        return appRedirect("upstox", true);
    }

    @GetMapping("/fyers/start")
    public ResponseEntity<?> fyersStart(HttpSession session) {
        String resolvedId = resolveFyersId();
        String resolvedSecret = resolveFyersSecret();
        if (!configured(resolvedId, resolvedSecret)) return unavailable("Fyers is not configured");
        String state = randomState(); session.setAttribute("fyers.oauth-state", state);
        String callback = appUrl + "/api/auth/fyers/callback";
        String url = "https://api-t1.fyers.in/api/v3/generate-authcode?client_id=" + enc(resolvedId) + "&redirect_uri=" + enc(callback) + "&response_type=code&state=" + enc(state);
        return redirect(url);
    }

    @GetMapping("/fyers/callback")
    public ResponseEntity<Void> fyersCallback(@RequestParam(name = "auth_code", required = false) String code, @RequestParam(required = false) String state, HttpSession session) throws Exception {
        if (!validState(session, "fyers.oauth-state", state) || code == null) return appRedirect("fyers", false);
        String resolvedId = resolveFyersId();
        String resolvedSecret = resolveFyersSecret();
        if (!configured(resolvedId, resolvedSecret)) return appRedirect("fyers", false);
        String payload = json.writeValueAsString(Map.of("grant_type", "authorization_code", "appIdHash", sha256(resolvedId + resolvedSecret), "code", code));
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api-t1.fyers.in/api/v3/validate-authcode"))
            .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(payload)).build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode data = json.readTree(response.body()); String token = data.path("access_token").asText();
        if (response.statusCode() / 100 != 2 || token.isBlank()) return appRedirect("fyers", false);
        session.setAttribute("fyers.access-token", token); return appRedirect("fyers", true);
    }

    @GetMapping("/{broker}/status")
    public ResponseEntity<?> status(@PathVariable String broker, HttpSession session) {
        String name = broker.toLowerCase();
        if (!name.equals("upstox") && !name.equals("fyers")) return ResponseEntity.notFound().build();
        boolean envConfigured = name.equals("upstox") ? configured(upstoxKey, upstoxSecret) : configured(fyersId, fyersSecret);
        String[] requiredKeys = name.equals("upstox") ? new String[]{"apiKey", "apiSecret"} : new String[]{"appId", "appSecret"};
        boolean hasCredentials = store.has(name, requiredKeys);
        return ResponseEntity.ok(Map.of("configured", envConfigured || hasCredentials, "connected", session.getAttribute(name + ".access-token") != null, "hasCredentials", hasCredentials));
    }
    private String resolveUpstoxKey() { String s = store.get("upstox", "apiKey"); return (s != null && !s.isBlank()) ? s : upstoxKey; }
    private String resolveUpstoxSecret() { String s = store.get("upstox", "apiSecret"); return (s != null && !s.isBlank()) ? s : upstoxSecret; }
    private String resolveFyersId() { String s = store.get("fyers", "appId"); return (s != null && !s.isBlank()) ? s : fyersId; }
    private String resolveFyersSecret() { String s = store.get("fyers", "appSecret"); return (s != null && !s.isBlank()) ? s : fyersSecret; }
    private boolean configured(String key, String secret) { return !key.isBlank() && !secret.isBlank(); }
    private boolean validState(HttpSession session, String name, String received) { Object expected = session.getAttribute(name); session.removeAttribute(name); return expected != null && expected.equals(received); }
    private String randomState() { byte[] value = new byte[24]; new SecureRandom().nextBytes(value); return HexFormat.of().formatHex(value); }
    private ResponseEntity<Map<String, String>> unavailable(String message) { return ResponseEntity.status(503).body(Map.of("message", message)); }
    private ResponseEntity<Void> redirect(String url) { return ResponseEntity.status(302).location(URI.create(url)).build(); }
    private ResponseEntity<Void> appRedirect(String broker, boolean connected) { return redirect(appUrl + "/?broker=" + broker + "&connected=" + connected); }
    private static String enc(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private static String sha256(String value) throws Exception { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
}

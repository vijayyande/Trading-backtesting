package com.trading.chartstudio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Angel One requires the user's client ID, PIN/password, and current TOTP for session creation. */
@RestController
@RequestMapping("/api/auth/angel-one")
public class AngelOneAuthController {
    private final String apiKey;
    private final ObjectMapper json;
    private final CredentialStore store;
    private final HttpClient client = HttpClient.newHttpClient();

    public AngelOneAuthController(@Value("${angelone.api-key:}") String apiKey, ObjectMapper json, CredentialStore store) { this.apiKey = apiKey; this.json = json; this.store = store; }

    @PostMapping("/connect")
    public ResponseEntity<?> connect(@RequestBody Login login, HttpSession session, HttpServletRequest servletRequest) throws Exception {
        if (login.apiKey() != null && !login.apiKey().isBlank()) {
            session.setAttribute("angel-one.api-key", login.apiKey().trim());
            store.put("angel-one", "apiKey", login.apiKey().trim());
        }
        String resolvedKey = resolveApiKey(session);
        if (resolvedKey.isBlank()) return ResponseEntity.status(503).body(Map.of("message", "Angel One API key is required. Enter your SmartAPI key."));
        String clientCode = !login.clientCode().isBlank() ? login.clientCode().trim() : store.get("angel-one", "clientCode");
        String pin = !login.pin().isBlank() ? login.pin().trim() : store.get("angel-one", "pin");
        if (clientCode == null || pin == null || !login.totp().matches("\\d{6}")) return ResponseEntity.badRequest().body(Map.of("message", "Client ID, PIN, and current six-digit TOTP are required"));
        String body = json.writeValueAsString(Map.of("clientcode", clientCode, "password", pin, "totp", login.totp()));
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword"))
            .header("Content-Type", "application/json").header("Accept", "application/json").header("X-PrivateKey", resolvedKey).header("X-Api-Key", resolvedKey)
            .header("X-UserType", "USER").header("X-SourceID", "WEB").header("X-ClientLocalIP", servletRequest.getRemoteAddr())
            .header("X-ClientPublicIP", servletRequest.getRemoteAddr()).header("X-MACAddress", "00:00:00:00:00:00").POST(HttpRequest.BodyPublishers.ofString(body)).build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode data = json.readTree(response.body()).path("data"); String token = data.path("jwtToken").asText();
        if (response.statusCode() / 100 != 2 || token.isBlank()) return ResponseEntity.status(401).body(Map.of("message", "Angel One login was rejected. Check your current TOTP and PIN."));
        session.setAttribute("angel-one.access-token", token); session.setAttribute("angel-one.feed-token", data.path("feedToken").asText());
        session.setAttribute("angel-one.client-ip", servletRequest.getRemoteAddr());
        store.putAll("angel-one", Map.of("clientCode", clientCode, "pin", pin, "accessToken", token,
            "feedToken", data.path("feedToken").asText(), "clientIp", servletRequest.getRemoteAddr()));
        return ResponseEntity.ok(Map.of("connected", true));
    }
    @GetMapping("/status")
    public Map<String, Object> status(HttpSession session) {
        String token = (String) session.getAttribute("angel-one.access-token");
        if (token == null || token.isBlank()) {
            String stored = store.get("angel-one", "accessToken");
            if (stored != null && !stored.isBlank()) {
                session.setAttribute("angel-one.access-token", stored);
                String feed = store.get("angel-one", "feedToken");
                if (feed != null && !feed.isBlank()) session.setAttribute("angel-one.feed-token", feed);
                String ip = store.get("angel-one", "clientIp");
                if (ip != null && !ip.isBlank()) session.setAttribute("angel-one.client-ip", ip);
                token = stored;
            }
        }
        boolean envConfigured = !apiKey.isBlank();
        boolean sessionConfigured = session.getAttribute("angel-one.api-key") != null;
        boolean hasCredentials = store.has("angel-one", "clientCode", "pin");
        return Map.of("connected", token != null, "configured", envConfigured || sessionConfigured || hasCredentials, "hasCredentials", hasCredentials,
            "apiKey", safe(resolveApiKey(session)), "clientCode", safe(store.get("angel-one", "clientCode")), "pin", safe(store.get("angel-one", "pin")));
    }

    @PostMapping("/disconnect")
    public ResponseEntity<?> disconnect(HttpSession session) {
        session.removeAttribute("angel-one.access-token");
        session.removeAttribute("angel-one.feed-token");
        session.removeAttribute("angel-one.client-ip");
        store.remove("angel-one", "accessToken");
        store.remove("angel-one", "feedToken");
        store.remove("angel-one", "clientIp");
        return ResponseEntity.ok(Map.of("connected", false));
    }

    private static String safe(String v) { return v == null ? "" : v; }

    private String resolveApiKey(HttpSession session) {
        String sessionKey = (String) session.getAttribute("angel-one.api-key");
        if (sessionKey != null && !sessionKey.isBlank()) return sessionKey;
        String storedKey = store.get("angel-one", "apiKey");
        return (storedKey != null && !storedKey.isBlank()) ? storedKey : apiKey;
    }
    public record Login(String apiKey, String clientCode, String pin, String totp) {}
}

package com.trading.chartstudio;

import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Account registration/login plus the per-user broker credential vault. */
@RestController
public class AccountController {
    private final UserStore users;

    public AccountController(UserStore users) { this.users = users; }

    public record Credentials(String username, String password) {}
    public record SaveProfile(String broker, String name, Map<String, String> data) {}

    @PostMapping("/api/account/register")
    public ResponseEntity<?> register(@RequestBody Credentials req, HttpSession session) {
        String username = req.username() == null ? "" : req.username().trim();
        String password = req.password() == null ? "" : req.password();
        if (username.length() < 3 || username.length() > 60 || !username.matches("[A-Za-z0-9_.-]+")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username must be 3-60 characters using letters, numbers, dots, dashes or underscores."));
        }
        if (password.length() < 8) return ResponseEntity.badRequest().body(Map.of("message", "Password must be at least 8 characters."));
        try {
            UserStore.UserResult user = users.register(username, password.toCharArray());
            UserStore.login(session, user);
            return ResponseEntity.ok(Map.of("loggedIn", true, "username", username));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Could not create the account."));
        }
    }

    @PostMapping("/api/account/login")
    public ResponseEntity<?> login(@RequestBody Credentials req, HttpSession session) {
        String username = req.username() == null ? "" : req.username().trim();
        String password = req.password() == null ? "" : req.password();
        Optional<UserStore.UserResult> user = users.verifyLogin(username, password.toCharArray());
        if (user.isEmpty()) return ResponseEntity.status(401).body(Map.of("message", "Invalid username or password."));
        UserStore.login(session, user.get());
        return ResponseEntity.ok(Map.of("loggedIn", true, "username", username));
    }

    @PostMapping("/api/account/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        UserStore.logout(session);
        return ResponseEntity.ok(Map.of("loggedIn", false));
    }

    @GetMapping("/api/account/me")
    public Map<String, Object> me(HttpSession session) {
        Long userId = UserStore.currentUserId(session);
        if (userId == null) return Map.of("loggedIn", false, "username", "", "profiles", List.of());
        List<Map<String, Object>> profiles = users.profiles(userId).stream()
            .map(p -> Map.<String, Object>of("id", p.id(), "broker", p.broker(), "name", p.name()))
            .toList();
        return Map.of("loggedIn", true, "username", UserStore.currentUsername(session), "profiles", profiles);
    }

    @PostMapping("/api/vault")
    public ResponseEntity<?> saveVault(@RequestBody SaveProfile req, HttpSession session) {
        Long userId = UserStore.currentUserId(session);
        byte[] dataKey = UserStore.currentDataKey(session);
        if (userId == null || dataKey == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Sign in to save broker credentials."));
        }
        String broker = req.broker() == null ? "" : req.broker().trim().toLowerCase();
        String name = req.name() == null ? "" : req.name().trim();
        if (broker.isBlank() || name.isBlank() || name.length() > 100) {
            return ResponseEntity.badRequest().body(Map.of("message", "A broker and a profile name (1-100 chars) are required."));
        }
        if (req.data() == null || req.data().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No credentials to save."));
        }
        try {
            users.saveProfile(userId, broker, name, req.data(), dataKey);
            return ResponseEntity.ok(Map.of("saved", true));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "Could not save the credentials."));
        }
    }

    @GetMapping("/api/vault/{id}/use")
    public ResponseEntity<?> useVault(@PathVariable long id, HttpSession session) {
        Long userId = UserStore.currentUserId(session);
        byte[] dataKey = UserStore.currentDataKey(session);
        if (userId == null || dataKey == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Sign in to use saved credentials."));
        }
        UserStore.ProfileData profile = users.getProfile(userId, id, dataKey);
        if (profile == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("broker", profile.broker(), "name", profile.name(), "data", profile.data()));
    }

    @DeleteMapping("/api/vault/{id}")
    public ResponseEntity<?> deleteVault(@PathVariable long id, HttpSession session) {
        Long userId = UserStore.currentUserId(session);
        if (userId == null) return ResponseEntity.status(401).body(Map.of("message", "Sign in to manage saved credentials."));
        users.deleteProfile(userId, id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }
}

package com.trading.chartstudio;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class CredentialStore {
    private static final Logger log = LoggerFactory.getLogger(CredentialStore.class);
    private final Path storePath = Path.of(System.getProperty("user.home"), ".prism-charts", "credentials.json");
    private final ObjectMapper json;
    private final Map<String, Map<String, String>> store = new ConcurrentHashMap<>();

    public CredentialStore(ObjectMapper json) { this.json = json; }

    @PostConstruct
    public void load() {
        try {
            if (storePath.toFile().exists()) {
                Map<String, Map<String, String>> loaded = json.readValue(storePath.toFile(), new TypeReference<>() {});
                store.putAll(loaded);
            }
        } catch (IOException e) { log.warn("Could not load credentials from {}", storePath, e); }
    }

    private void save() {
        try {
            storePath.getParent().toFile().mkdirs();
            json.writeValue(storePath.toFile(), store);
        } catch (IOException e) { log.warn("Could not save credentials to {}", storePath, e); }
    }

    public void put(String broker, String key, String value) {
        store.computeIfAbsent(broker, k -> new ConcurrentHashMap<>()).put(key, value);
        save();
    }

    public void putAll(String broker, Map<String, String> values) {
        store.computeIfAbsent(broker, k -> new ConcurrentHashMap<>()).putAll(values);
        save();
    }

    public String get(String broker, String key) {
        Map<String, String> m = store.get(broker);
        return m != null ? m.get(key) : null;
    }

    public boolean has(String broker, String... keys) {
        Map<String, String> m = store.get(broker);
        if (m == null) return false;
        for (String key : keys) {
            String v = m.get(key);
            if (v == null || v.isBlank()) return false;
        }
        return true;
    }

    public void remove(String broker, String key) {
        Map<String, String> m = store.get(broker);
        if (m == null || m.remove(key) == null) return;
        save();
    }
}

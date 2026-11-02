package vn.subifood.ai;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.ai")
public record AiSettings(boolean enabled,String geminiApiKey,String embeddingModel,String supabaseUrl,
        String publicKey,String serviceKey,boolean indexEnabled,int indexBatchSize,List<String> allowedOrigins) {
    public String modelKey() { return "gemini:"+embeddingModel+":1536:menu-v1"; }
    public boolean configured() { return enabled && present(geminiApiKey) && present(publicKey) && present(supabaseUrl); }
    public boolean canIndex() { return configured() && indexEnabled && present(serviceKey); }
    private static boolean present(String value) { return value!=null && !value.isBlank(); }
}

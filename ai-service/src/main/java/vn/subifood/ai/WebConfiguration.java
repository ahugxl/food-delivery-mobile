package vn.subifood.ai;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    private final AiSettings settings;
    public WebConfiguration(AiSettings settings) { this.settings=settings; }
    @Override public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/ai/**").allowedOrigins(settings.allowedOrigins().toArray(String[]::new))
            .allowedMethods("GET","POST").allowedHeaders("Authorization","Content-Type").maxAge(600);
    }
    @Bean RestClient aiRestClient() {
        var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build());
        factory.setReadTimeout(Duration.ofSeconds(20));
        return RestClient.builder().requestFactory(factory).build();
    }
}

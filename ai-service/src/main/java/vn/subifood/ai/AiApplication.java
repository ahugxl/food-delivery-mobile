package vn.subifood.ai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(AiSettings.class)
public class AiApplication {
    public static void main(String[] args) { SpringApplication.run(AiApplication.class,args); }
}

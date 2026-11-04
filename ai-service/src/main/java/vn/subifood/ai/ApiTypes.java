package vn.subifood.ai;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;

public final class ApiTypes {
    private ApiTypes() {}
    public record Question(@NotBlank @Size(max=600) String message,
        @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
        @DecimalMin("0") @DecimalMax("10000000") BigDecimal maxPrice,
        @Valid @Size(max=12) List<ChatTurn> history) {
        public Question(String message,Double latitude,Double longitude,BigDecimal maxPrice){this(message,latitude,longitude,maxPrice,List.of());}
        public Question { history=history==null?List.of():List.copyOf(history); }
    }
    public record ChatTurn(@NotNull @Pattern(regexp="user|assistant") String role,@NotBlank @Size(max=2000) String content) {}
    public record Food(UUID food_id,UUID restaurant_id,String name,String description,BigDecimal price,
        BigDecimal original_price,String image_url,String restaurant_name,double distance_km,String option_hint,Double similarity) {}
    public record Recommendation(String message,List<Food> foods) {}
    public record IndexSource(UUID food_id,String document,String content_hash) {}
    public record Session(UUID userId,String token) {}
    public record SupabaseUser(UUID id) {}
    public record DiscoveryGroup(String id,String name) {}
    public record IndexStatus(int total,int indexed) {}
}

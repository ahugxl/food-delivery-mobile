package vn.subifood.ai;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import jakarta.validation.Valid;
import static vn.subifood.ai.ApiTypes.*;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final RecommendationService service;private final AiSettings settings;
    public AiController(RecommendationService service,AiSettings settings){this.service=service;this.settings=settings;}
    @GetMapping("/status") public Map<String,Object> status(){return Map.of("configured",settings.configured());}
    @PostMapping("/recommendations") public Recommendation recommend(@RequestHeader(value="Authorization",required=false) String authorization,@Valid @RequestBody Question question){
        return service.recommend(authorization,question);
    }
}

@RestControllerAdvice
class AiErrors {
    @ExceptionHandler(ApiFailure.class) ResponseEntity<?> failure(ApiFailure e){return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage()));}
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class}) ResponseEntity<?> validation(Exception e){return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message","Vui lòng nhập câu hỏi tối đa 600 ký tự và chọn tọa độ giao hàng hợp lệ."));}
    @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception e){return ResponseEntity.status(503).body(Map.of("code","AI_UNAVAILABLE","message","Chưa kết nối được trợ lý. Vui lòng thử lại sau."));}
}

package vn.subifood.ai;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import jakarta.validation.Valid;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.servlet.http.HttpServletResponse;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicBoolean;
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
    @PostMapping(value="/chat/stream",produces="text/event-stream")
    public SseEmitter stream(@RequestHeader(value="Authorization",required=false) String authorization,@Valid @RequestBody Question question,HttpServletResponse response){
        var emitter=new SseEmitter(65000L);
        var task=new AtomicReference<Future<?>>();var closed=new AtomicBoolean();
        Runnable cancel=()->{closed.set(true);var future=task.get();if(future!=null)future.cancel(true);};
        emitter.onTimeout(cancel);emitter.onCompletion(cancel);emitter.onError(error->cancel.run());
        java.util.function.BiConsumer<String,Object> send=(event,data)->{
            if(closed.get())throw new java.util.concurrent.CancellationException();
            try {emitter.send(SseEmitter.event().name(event).data(data));}
            catch(java.io.IOException error){cancel.run();throw new java.io.UncheckedIOException(error);}
        };
        send.accept("status",Map.of("message","Đang tìm món phù hợp…"));
        var future=service.stream(authorization,question,
            text->send.accept("delta",Map.of("text",text)),
            result->{send.accept("result",result);emitter.complete();},
            error->{send.accept("error",Map.of("code",error.code,"message",error.getMessage()));emitter.complete();});
        task.set(future);if(closed.get())future.cancel(true);
        response.setHeader("Cache-Control","no-cache, no-transform");
        response.setHeader("X-Accel-Buffering","no");
        return emitter;
    }
}

@RestControllerAdvice
class AiErrors {
    @ExceptionHandler(ApiFailure.class) ResponseEntity<?> failure(ApiFailure e){return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage()));}
    @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class}) ResponseEntity<?> validation(Exception e){return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message","Vui lòng nhập câu hỏi tối đa 600 ký tự và chọn tọa độ giao hàng hợp lệ."));}
    @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception e){return ResponseEntity.status(503).body(Map.of("code","AI_UNAVAILABLE","message","Chưa kết nối được trợ lý. Vui lòng thử lại sau."));}
}

package vn.subifood.ai;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
import reactor.core.publisher.Flux;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static vn.subifood.ai.ApiTypes.*;

class StreamingReplyTest {
    private ChatResponse response(String text){return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));}
    @Test void forwardsVietnameseTextBeforeFinalResultAndForcesThoughtsOff() throws Exception {
        var db=mock(SupabaseGateway.class);var embeddings=mock(MenuEmbeddings.class);var model=mock(ChatModel.class);
        var settings=new AiSettings(true,"test-key","gemini-embedding-001","http://localhost","public","server",false,5,List.of());
        var session=new Session(UUID.randomUUID(),"user-token");
        when(db.authenticate("Bearer user-token")).thenReturn(session);
        when(db.indexStatus(session)).thenReturn(new IndexStatus(1,1));
        when(db.discoveryGroups(session)).thenReturn(List.of());
        when(model.getOptions()).thenReturn(GoogleGenAiChatOptions.builder().includeThoughts(true).build());
        when(model.call(any(Prompt.class))).thenReturn(response(""));
        String first="Chào bạn! Mình sẽ giúp bạn chọn món ăn phù hợp với khẩu vị và ngân sách của bạn hôm nay. ";
        when(model.stream(any(Prompt.class))).thenAnswer(invocation->{
            Prompt prompt=invocation.getArgument(0);
            assertEquals(Boolean.FALSE,((GoogleGenAiChatOptions)prompt.getOptions()).getIncludeThoughts());
            assertTrue(prompt.getSystemMessage().getText().contains("BẮT BUỘC chỉ trả lời bằng tiếng Việt"));
            return Flux.just(response(first),response("Bạn thích ăn gì?"));
        });
        var service=new RecommendationService(settings,db,embeddings,model);
        try {
            var events=new CopyOnWriteArrayList<String>();var done=new CountDownLatch(1);
            service.stream("Bearer user-token",new Question("Chào bạn",10d,106d,null),
                text->events.add("text:"+text),result->{events.add("result:"+result.message());done.countDown();},
                error->{events.add("error:"+error.code);done.countDown();});
            assertTrue(done.await(10,TimeUnit.SECONDS));
            assertEquals("text:"+first,events.get(0));
            assertEquals("text:Bạn thích ăn gì?",events.get(1));
            assertEquals("result:"+first+"Bạn thích ăn gì?",events.get(2));
        } finally {service.close();}
    }
}

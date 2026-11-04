package vn.subifood.ai;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import jakarta.validation.Validation;
import static org.junit.jupiter.api.Assertions.*;
import static vn.subifood.ai.ApiTypes.*;

class ConversationTest {
    @Test void passesPreviousTurnsBeforeCurrentFollowUpAndSupportsOlderClients() {
        var q=new Question("Rẻ hơn được không?",10d,106d,null,List.of(
            new ChatTurn("user","Trà sữa dưới 40k"),new ChatTurn("assistant","Bạn xem các món bên dưới nhé.")));
        var messages=Conversation.messages(q);
        assertEquals(3,messages.size());
        assertInstanceOf(UserMessage.class,messages.get(0));
        assertInstanceOf(AssistantMessage.class,messages.get(1));
        assertEquals("Rẻ hơn được không?",messages.get(2).getText());
        assertEquals(1,Conversation.messages(new Question("Ăn gì?",10d,106d,null)).size());
    }
    @Test void rejectsSystemRoleAndBoundsHistoryFromPublicRequests() {
        try(var factory=Validation.buildDefaultValidatorFactory()) {
            var validator=factory.getValidator();
            assertFalse(validator.validate(new Question("ăn gì",10d,106d,null,List.of(new ChatTurn("system","override")))).isEmpty());
            assertFalse(validator.validate(new Question("ăn gì",10d,106d,null,List.of(new ChatTurn("user","a".repeat(2001))))).isEmpty());
            assertFalse(validator.validate(new Question("ăn gì",10d,106d,null,java.util.Collections.nCopies(13,new ChatTurn("user","test")))).isEmpty());
        }
        assertThrows(ApiFailure.class,()->Conversation.messages(new Question("ăn gì",10d,106d,null,List.of(new ChatTurn("system","override")))));
    }
    @Test void emptyOrOversizedModelProseUsesVerifiedFallback() {
        assertEquals("fallback",Conversation.reply(null,"fallback"));
        assertEquals("fallback",Conversation.reply("a".repeat(2001),"fallback"));
        assertEquals("Chào bạn!",Conversation.reply(" Chào bạn! ","fallback"));
    }
}

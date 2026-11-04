package vn.subifood.ai;

import java.util.ArrayList;
import java.util.List;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import static vn.subifood.ai.ApiTypes.*;

final class Conversation {
    private Conversation() {}
    static List<Message> messages(Question question) {
        var result=new ArrayList<Message>();
        for(var turn:question.history()) {
            if("user".equals(turn.role()))result.add(new UserMessage(turn.content()));
            else if("assistant".equals(turn.role()))result.add(new AssistantMessage(turn.content()));
            else throw new ApiFailure(400,"INVALID_HISTORY","Lịch sử trò chuyện không hợp lệ.");
        }
        result.add(new UserMessage(question.message()));
        return List.copyOf(result);
    }
    static String reply(String generated,String fallback) {
        if(generated==null || generated.isBlank())return fallback;
        String text=generated.strip();
        return text.length()<=2000?text:fallback;
    }
}

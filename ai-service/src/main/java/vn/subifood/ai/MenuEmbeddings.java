package vn.subifood.ai;

import java.util.List;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.google.genai.text.GoogleGenAiTextEmbeddingOptions;
import org.springframework.ai.google.genai.text.GoogleGenAiTextEmbeddingOptions.TaskType;
import org.springframework.stereotype.Component;

@Component
public class MenuEmbeddings {
    private final EmbeddingModel model;private final AiSettings settings;
    private volatile long quotaBlockedUntil;
    public MenuEmbeddings(EmbeddingModel model,AiSettings settings){this.model=model;this.settings=settings;}
    public float[] query(String text){return embed(text,TaskType.RETRIEVAL_QUERY);}
    public float[] document(String text){return embed(text,TaskType.RETRIEVAL_DOCUMENT);}
    public boolean quotaPaused(){return System.currentTimeMillis()<quotaBlockedUntil;}
    public void checkAvailability(){
        if(quotaPaused())throw new ApiFailure(429,"AI_QUOTA_EXCEEDED","Trợ lý AI đang chạm giới hạn sử dụng của Gemini. Vui lòng thử lại sau; hiện chưa thể tìm món, không phải không có món phù hợp.");
    }
    private float[] embed(String text,TaskType type){
        checkAvailability();
        String bounded=text.substring(0,Math.min(text.length(),3500));
        var options=GoogleGenAiTextEmbeddingOptions.builder().model(settings.embeddingModel()).dimensions(1536).taskType(type).build();
        try {
            float[] vector=model.call(new EmbeddingRequest(List.of(bounded),options)).getResult().getOutput();
            return normalized(vector);
        } catch(RuntimeException error) {
            var known=ProviderErrors.find(error);
            if(known!=null){if("AI_QUOTA_EXCEEDED".equals(known.code))quotaBlockedUntil=System.currentTimeMillis()+300000;throw known;}
            throw error;
        }
    }
    static float[] normalized(float[] input){
        if(input==null || input.length!=1536)throw new ApiFailure(503,"EMBEDDING_INVALID","Dịch vụ tạo vector trả dữ liệu không hợp lệ.");
        double norm=0;for(float x:input){if(!Float.isFinite(x))throw new IllegalArgumentException("Invalid vector");norm+=(double)x*x;}
        if(norm<=0)throw new IllegalArgumentException("Empty vector");
        float[] output=input.clone();double length=Math.sqrt(norm);for(int i=0;i<output.length;i++)output[i]/=length;
        return output;
    }
}

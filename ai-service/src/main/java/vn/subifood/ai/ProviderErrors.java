package vn.subifood.ai;

final class ProviderErrors {
    private ProviderErrors() {}
    static ApiFailure find(Throwable error) {
        Throwable cause=error;
        for(int i=0;cause!=null && i<10;i++,cause=cause.getCause()) {
            if(cause instanceof ApiFailure failure)return failure;
            if(cause instanceof com.google.genai.errors.ApiException provider && provider.code()==429)
                return new ApiFailure(429,"AI_QUOTA_EXCEEDED","Trợ lý AI đang chạm giới hạn sử dụng của Gemini. Vui lòng thử lại sau; hiện chưa thể tìm món, không phải không có món phù hợp.");
        }
        return null;
    }
}

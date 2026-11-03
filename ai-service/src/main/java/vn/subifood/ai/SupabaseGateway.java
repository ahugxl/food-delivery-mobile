package vn.subifood.ai;

import java.util.*;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import static vn.subifood.ai.ApiTypes.*;

@Component
public class SupabaseGateway {
    private final RestClient http; private final AiSettings settings;
    @Value("${app.ai.min-similarity:0.62}") private double minSimilarity;
    public SupabaseGateway(RestClient http,AiSettings settings) {this.http=http;this.settings=settings;}
    public Session authenticate(String authorization) {
        if(authorization==null || !authorization.startsWith("Bearer ") || authorization.length()>10000)
            throw new ApiFailure(401,"AUTH_REQUIRED","Vui lòng đăng nhập để dùng trợ lý.");
        String token=authorization.substring(7).trim();
        if(token.isBlank()) throw new ApiFailure(401,"AUTH_REQUIRED","Vui lòng đăng nhập lại.");
        try {
            var user=http.get().uri(settings.supabaseUrl()+"/auth/v1/user").header("apikey",settings.publicKey())
                .headers(h->h.setBearerAuth(token)).retrieve().body(SupabaseUser.class);
            if(user==null || user.id()==null) throw new ApiFailure(401,"AUTH_REQUIRED","Vui lòng đăng nhập lại.");
            return new Session(user.id(),token);
        } catch(RestClientResponseException e) {
            if(e.getStatusCode().value()==401 || e.getStatusCode().value()==403)
                throw new ApiFailure(401,"AUTH_REQUIRED","Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
            throw new ApiFailure(503,"AUTH_UNAVAILABLE","Chưa xác minh được phiên đăng nhập. Vui lòng thử lại.");
        }
    }
    public List<DiscoveryGroup> discoveryGroups(Session session){
        var result=http.get().uri(settings.supabaseUrl()+"/rest/v1/discovery_categories?select=id,name&kind=eq.food&is_active=eq.true&order=id&limit=100")
            .header("apikey",settings.publicKey()).headers(h->h.setBearerAuth(session.token()))
            .retrieve().body(DiscoveryGroup[].class);
        return result==null?List.of():List.of(result);
    }
    private <T> T rpc(String name,Map<String,Object> body,String key,String token,Class<T> response) {
        return http.post().uri(settings.supabaseUrl()+"/rest/v1/rpc/"+name).header("apikey",key)
            .headers(h->h.setBearerAuth(token)).body(body).retrieve().body(response);
    }
    private Map<String,Object> filters(Question q,BigDecimal max,String sweetness) {
        var args=new HashMap<String,Object>();args.put("p_model_key",settings.modelKey());
        args.put("p_latitude",q.latitude());args.put("p_longitude",q.longitude());
        args.put("p_max_price",max);args.put("p_sweetness",sweetness);return args;
    }
    private void relevance(Map<String,Object> args,float[] vector,FoodIntent.Groups groups,boolean exploratory){
        if(!Double.isFinite(minSimilarity)||minSimilarity<0||minSimilarity>1)throw new IllegalStateException("Invalid similarity configuration");
        args.put("p_embedding",vector);args.put("p_groups",groups.required());args.put("p_excluded_groups",groups.excluded());args.put("p_min_similarity",exploratory?0d:minSimilarity);
    }
    public List<Food> match(Session session,Question q,float[] vector,BigDecimal max,String sweetness,FoodIntent.Groups groups,boolean exploratory) {
        var args=filters(q,max,sweetness);relevance(args,vector,groups,exploratory);args.put("p_limit",10);
        var result=rpc("ai_match_foods_v2",args,settings.publicKey(),session.token(),Food[].class);
        return result==null?List.of():List.of(result);
    }
    public List<Food> recheck(Session session,Question q,List<UUID> ids,float[] vector,BigDecimal max,String sweetness,FoodIntent.Groups groups,boolean exploratory) {
        if(ids.isEmpty()) return List.of();
        var args=filters(q,max,sweetness);relevance(args,vector,groups,exploratory);args.put("p_food_ids",ids);
        var result=rpc("ai_recheck_foods_v2",args,settings.publicKey(),session.token(),Food[].class);
        return result==null?List.of():List.of(result);
    }
    public List<IndexSource> pendingIndex() {
        var args=Map.<String,Object>of("p_model_key",settings.modelKey(),"p_limit",Math.max(1,Math.min(100,settings.indexBatchSize())));
        var result=rpc("ai_food_index_batch",args,settings.serviceKey(),settings.serviceKey(),IndexSource[].class);
        return result==null?List.of():List.of(result);
    }
    public boolean store(IndexSource source,float[] vector) {
        var args=Map.<String,Object>of("p_food_id",source.food_id(),"p_content_hash",source.content_hash(),"p_model_key",settings.modelKey(),"p_embedding",vector);
        return Boolean.TRUE.equals(rpc("ai_store_food_embedding",args,settings.serviceKey(),settings.serviceKey(),Boolean.class));
    }
    public IndexStatus indexStatus(Session session) {
        var result=rpc("ai_food_search_status",Map.<String,Object>of("p_model_key",settings.modelKey()),settings.publicKey(),session.token(),IndexStatus.class);
        return result==null?new IndexStatus(0,0):result;
    }
}

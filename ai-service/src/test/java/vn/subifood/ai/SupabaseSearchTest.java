package vn.subifood.ai;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static vn.subifood.ai.ApiTypes.*;

class SupabaseSearchTest {
    @Test void explorationOnlyChangesSimilarityWhileRetainingFiltersInRetrievalAndRecheck() {
        for(boolean explore:List.of(false,true)) {
            var builder=RestClient.builder();
            var server=MockRestServiceServer.bindTo(builder).build();
            var settings=new AiSettings(true,"test-key","gemini-embedding-001","http://localhost","public","server",false,5,List.of());
            var db=new SupabaseGateway(builder.build(),settings);
            org.springframework.test.util.ReflectionTestUtils.setField(db,"minSimilarity",.62);
            var session=new Session(UUID.randomUUID(),"user-token");
            var q=new Question("Ăn gì dưới 40k",10.8,106.6,null);
            var groups=new FoodIntent.Groups(List.of("nhom-bua-an"),List.of("nhom-do-uong"));
            var id=UUID.randomUUID();
            for(String rpc:List.of("ai_match_foods_v2","ai_recheck_foods_v2")) {
                server.expect(requestTo("http://localhost/rest/v1/rpc/"+rpc))
                    .andExpect(header("Authorization","Bearer user-token"))
                    .andExpect(jsonPath("$.p_min_similarity").value(explore?0d:.62))
                    .andExpect(jsonPath("$.p_max_price").value(40000))
                    .andExpect(jsonPath("$.p_latitude").value(10.8))
                    .andExpect(jsonPath("$.p_longitude").value(106.6))
                    .andExpect(jsonPath("$.p_groups[0]").value("nhom-bua-an"))
                    .andExpect(jsonPath("$.p_excluded_groups[0]").value("nhom-do-uong"))
                    .andRespond(withSuccess("[]",MediaType.APPLICATION_JSON));
            }
            db.match(session,q,new float[]{1},new BigDecimal("40000"),null,groups,explore);
            db.recheck(session,q,List.of(id),new float[]{1},new BigDecimal("40000"),null,groups,explore);
            server.verify();
        }
    }
}

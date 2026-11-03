package vn.subifood.ai;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static vn.subifood.ai.ApiTypes.*;

class FoodToolsTest {
    private final List<DiscoveryGroup> catalog=List.of(new DiscoveryGroup("tra-sua","Trà sữa"));
    @Test void hungryRequestUsesRewrittenMealQueryAndStrictBudgetThenRechecks() {
        var db=mock(SupabaseGateway.class);var embeddings=mock(MenuEmbeddings.class);
        var session=new Session(UUID.randomUUID(),"token");
        var question=new Question("Tôi đang đói bạn hãy tìm món gì ăn dưới 40k",10.8,106.6,null);
        var meals=List.of(new DiscoveryGroup("nhom-bua-an","Bữa ăn"));
        var groups=FoodIntent.groups(List.of("nhom-bua-an"),List.of(),meals);
        float[] vector=new float[1536];vector[0]=1;
        var food=new Food(UUID.randomUUID(),UUID.randomUUID(),"Cơm phần","",new BigDecimal("35000"),null,null,"Quán thật",2,null,.4);
        var boundary=new Food(UUID.randomUUID(),food.restaurant_id(),"Cơm phần lớn","",new BigDecimal("40000"),null,null,"Quán thật",2,null,.5);
        when(embeddings.query("bữa ăn no")).thenReturn(vector);
        when(db.match(session,question,vector,new BigDecimal("40000"),null,groups,true)).thenReturn(List.of(boundary,food));
        var tool=new FoodTools(db,embeddings,session,question,meals);
        assertEquals(List.of(food),tool.searchFoods(" bữa ăn no ",new BigDecimal("50000"),groups.required(),List.of(),FoodTools.SearchMode.EXPLORE));
        when(db.recheck(session,question,List.of(food.food_id()),vector,new BigDecimal("40000"),null,groups,true)).thenReturn(List.of(food));
        assertEquals(List.of(food),tool.verifiedFoods());
        verify(embeddings,never()).query(question.message());
    }
    @Test void explorationCannotRelaxSpecificDishOrSweetnessOrSearchWithoutAGroup() {
        for(String request:List.of("Cơm gà dưới 40k","Trà sữa ít ngọt dưới 40k","Ăn gì dưới 40k")) {
            var db=mock(SupabaseGateway.class);var embeddings=mock(MenuEmbeddings.class);
            var session=new Session(UUID.randomUUID(),"token");
            var question=new Question(request,10.8,106.6,null);
            var required=request.startsWith("Ăn")?List.<String>of():List.of("tra-sua");
            var groups=FoodIntent.groups(required,List.of(),catalog);
            var tool=new FoodTools(db,embeddings,session,question,catalog);
            tool.searchFoods("món ăn",null,required,List.of(),FoodTools.SearchMode.EXPLORE);
            verify(db).match(eq(session),eq(question),isNull(),eq(new BigDecimal("40000")),eq(FoodIntent.sweetness(request)),eq(groups),eq(false));
        }
    }
    @Test void preservesCustomerConstraintsAndRechecksCurrentDatabaseBeforeReturning() {
        var db=mock(SupabaseGateway.class);var embeddings=mock(MenuEmbeddings.class);
        var session=new Session(UUID.randomUUID(),"test-user-token");
        var question=new Question("Trà sữa ngọt nhẹ dưới 40k",10.8,106.6,null);
        float[] vector=new float[1536];vector[0]=1;
        var food=new Food(UUID.randomUUID(),UUID.randomUUID(),"Trà sữa","Món thật",new BigDecimal("30000"),null,null,"Quán thật",2,"Mức đường: 30%",.8);
        var groups=FoodIntent.groups(List.of("tra-sua"),List.of(),catalog);
        when(embeddings.query("trà sữa")).thenReturn(vector);
        when(db.match(session,question,vector,new BigDecimal("40000"),"light",groups,false)).thenReturn(List.of(food));
        var tool=new FoodTools(db,embeddings,session,question,catalog);
        assertEquals(List.of(food),tool.searchFoods("trà sữa",new BigDecimal("80000"),List.of("tra-sua"),List.of(),FoodTools.SearchMode.SPECIFIC));
        // The dish becomes unavailable after retrieval. Never show the stale result.
        when(db.recheck(session,question,List.of(food.food_id()),vector,new BigDecimal("40000"),"light",groups,false)).thenReturn(List.of());
        assertTrue(tool.verifiedFoods().isEmpty());
        verify(db).recheck(session,question,List.of(food.food_id()),vector,new BigDecimal("40000"),"light",groups,false);
        verify(embeddings).query("trà sữa");
    }
    @Test void doesNotQueryOrInventFoodsWhenModelDidNotCallTool() {
        var db=mock(SupabaseGateway.class);var embeddings=mock(MenuEmbeddings.class);
        var tool=new FoodTools(db,embeddings,new Session(UUID.randomUUID(),"token"),new Question("xin chào",0d,0d,null),catalog);
        assertFalse(tool.used());verifyNoInteractions(db,embeddings);
    }
    @Test void detectsVietnameseBudgetAndExplicitSweetness() {
        assertEquals(new BigDecimal("40000"),FoodIntent.budget("Trà sữa ngọt nhẹ dưới 40k"));
        assertEquals("light",FoodIntent.sweetness("TRÀ SỮA ÍT ĐƯỜNG"));
        assertEquals("none",FoodIntent.sweetness("Đồ uống không đường"));
        assertNull(FoodIntent.sweetness("Trà sữa ngon"));
        assertNull(FoodIntent.budget("Tìm quán gần tôi"));
    }
    @Test void acceptsDatabaseGroupsWithoutAliasesAndRejectsInventedOrConflictingIds() {
        var dynamic=List.of(new DiscoveryGroup("nhom-moi","Món mới do quản trị thêm"));
        assertEquals(List.of("nhom-moi"),FoodIntent.groups(List.of("nhom-moi"),List.of(),dynamic).required());
        assertEquals(List.of("nhom-moi"),FoodIntent.groups(List.of(),List.of("nhom-moi"),dynamic).excluded());
        assertThrows(ApiFailure.class,()->FoodIntent.groups(List.of("tra-sua"),List.of(),dynamic));
        assertThrows(ApiFailure.class,()->FoodIntent.groups(List.of("nhom-moi"),List.of("nhom-moi"),dynamic));
        assertThrows(ApiFailure.class,()->FoodIntent.groups(null,List.of(),dynamic));
    }
    @Test void belowBudgetIsStrictButMaximumIsInclusive() {
        assertTrue(FoodIntent.withinBudget(new BigDecimal("19000"),"Trà sữa dưới 20k",new BigDecimal("20000")));
        assertFalse(FoodIntent.withinBudget(new BigDecimal("20000"),"Trà sữa dưới 20k",new BigDecimal("20000")));
        assertFalse(FoodIntent.withinBudget(new BigDecimal("19999.9"),"Trà sữa dưới 20k",new BigDecimal("19000")));
        assertTrue(FoodIntent.withinBudget(new BigDecimal("20000"),"Trà sữa tối đa 20k",new BigDecimal("20000")));
    }
    @Test void normalizesReducedEmbeddingAndRejectsInvalidProviderOutput() {
        float[] raw=new float[1536];raw[0]=3;raw[1]=4;
        var normalized=MenuEmbeddings.normalized(raw);
        assertEquals(.6f,normalized[0],.00001);assertEquals(.8f,normalized[1],.00001);assertEquals(3f,raw[0]);
        assertThrows(ApiFailure.class,()->MenuEmbeddings.normalized(new float[768]));
        assertThrows(IllegalArgumentException.class,()->MenuEmbeddings.normalized(new float[1536]));
        raw[0]=Float.NaN;assertThrows(IllegalArgumentException.class,()->MenuEmbeddings.normalized(raw));
    }
    @Test void specificDishRequestDoesNotAcceptAnotherDishInTheSameBroadGroup() {
        var dishes=FoodIntent.namedDishes("Tìm bún bò nóng");
        assertTrue(FoodIntent.matchesNamedDish("Bún Bò Huế",dishes));
        assertFalse(FoodIntent.matchesNamedDish("Mì Ý Thịt Bò",dishes));
        assertFalse(FoodIntent.matchesNamedDish("Bún lẩu thêm",dishes));
        assertTrue(FoodIntent.matchesNamedDish("Cơm Gà Xối Mỡ",FoodIntent.namedDishes("Cơm gà dưới 50k")));
    }
    @Test void failedEmbeddingCannotBecomeSuccessfulEmptyFoodList() {
        var db=mock(SupabaseGateway.class);var embeddings=mock(MenuEmbeddings.class);
        var question=new Question("Trà sữa ngọt nhẹ dưới 40k",10.8,106.6,null);
        var quota=new ApiFailure(429,"AI_QUOTA_EXCEEDED","Hết hạn mức Gemini");
        when(embeddings.query("trà sữa")).thenThrow(quota);
        var tool=new FoodTools(db,embeddings,new Session(UUID.randomUUID(),"token"),question,catalog);
        assertSame(quota,assertThrows(ApiFailure.class,()->tool.searchFoods("trà sữa",null,List.of("tra-sua"),List.of(),FoodTools.SearchMode.SPECIFIC)));
        // Simulate the framework swallowing the exception and returning control to the service.
        assertSame(quota,assertThrows(ApiFailure.class,tool::throwIfFailed));
        assertSame(quota,assertThrows(ApiFailure.class,tool::verifiedFoods));
        verifyNoInteractions(db);
    }
    @Test void wrappedProviderQuotaBecomesExplicitApiError() {
        var provider=new com.google.genai.errors.ClientException(429,"RESOURCE_EXHAUSTED","quota");
        var failure=ProviderErrors.find(new RuntimeException("wrapper",provider));
        assertNotNull(failure);assertEquals(429,failure.status);assertEquals("AI_QUOTA_EXCEEDED",failure.code);
        assertNull(ProviderErrors.find(new RuntimeException("unrelated")));
    }
    @Test void embeddingQuotaPausesDocumentAndQueryCallsInsteadOfRetryingEveryRequest() {
        var model=mock(org.springframework.ai.embedding.EmbeddingModel.class);
        var settings=new AiSettings(true,"test-key","gemini-embedding-001","http://localhost","public","server",true,20,List.of());
        when(model.call(any(org.springframework.ai.embedding.EmbeddingRequest.class)))
            .thenThrow(new com.google.genai.errors.ClientException(429,"RESOURCE_EXHAUSTED","quota"));
        var embeddings=new MenuEmbeddings(model,settings);
        assertEquals("AI_QUOTA_EXCEEDED",assertThrows(ApiFailure.class,()->embeddings.document("Món thật")).code);
        assertTrue(embeddings.quotaPaused());
        assertEquals("AI_QUOTA_EXCEEDED",assertThrows(ApiFailure.class,()->embeddings.query("trà sữa")).code);
        verify(model,times(1)).call(any(org.springframework.ai.embedding.EmbeddingRequest.class));
    }
}

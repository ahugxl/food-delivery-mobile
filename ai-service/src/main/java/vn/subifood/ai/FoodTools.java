package vn.subifood.ai;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import static vn.subifood.ai.ApiTypes.*;

// One instance per HTTP request. Never put session or location into a shared tool bean.
public class FoodTools {
    public enum SearchMode { SPECIFIC, EXPLORE }
    private final SupabaseGateway db;private final MenuEmbeddings embeddings;private final Session session;private final Question question;
    private String sweetness;private final BigDecimal hardBudget;private String searchRequest;
    private FoodIntent.Groups groups;private final List<DiscoveryGroup> catalog;private float[] queryVector;
    private List<String> namedDishes;
    private List<Food> candidates=List.of();private BigDecimal budget;private boolean exploratory;private int calls=0;
    private RuntimeException failure;
    public FoodTools(SupabaseGateway db,MenuEmbeddings embeddings,Session session,Question question,List<DiscoveryGroup> catalog){
        this.db=db;this.embeddings=embeddings;this.session=session;this.question=question;
        this.sweetness=FoodIntent.sweetness(question.message());this.hardBudget=FoodIntent.lowerBudget(question.maxPrice(),FoodIntent.budget(question.message()));
        this.catalog=List.copyOf(catalog);
        this.namedDishes=FoodIntent.namedDishes(question.message());
        this.searchRequest=question.message();
    }
    @Tool(description="Tìm món thực sự bán trong soopiFood bằng vector ngữ nghĩa rồi lọc giá, quán mở cửa, còn món và phạm vi 20 km. Chỉ dùng cho nhu cầu ăn uống. Không có quyền tìm Internet, đặt hàng hay sửa dữ liệu.")
    public List<Food> searchFoods(
        @ToolParam(description="Nhu cầu hiện tại đã kết hợp lịch sử, bỏ lời chào và câu nhờ vả; giữ loại món, khẩu vị, yêu cầu kiêng và giới hạn giá còn hiệu lực. Ví dụ: trà sữa ít ngọt dưới 40k. Khi khách đổi yêu cầu, bỏ điều kiện cũ đã bị thay thế.") String query,
        @ToolParam(description="Giá tối đa của một món bằng VND nếu khách có yêu cầu",required=false) BigDecimal maxPrice,
        @ToolParam(description="ID nhóm món bắt buộc từ danh sách database; [] nếu chưa xác định. Không dùng nhóm khách phủ định.") List<String> requiredGroupIds,
        @ToolParam(description="ID nhóm món khách muốn tránh từ danh sách database; [] nếu không có.") List<String> excludedGroupIds,
        @ToolParam(description="SPECIFIC khi khách chỉ rõ món/khẩu vị. EXPLORE chỉ khi khách muốn gợi ý chung như đang đói, ăn gì, chưa biết ăn gì, chỉ giới hạn ngân sách/khoảng cách. EXPLORE phải chọn đúng một nhóm món ăn phù hợp từ database.") SearchMode mode){
        try {
        if(++calls>2)throw new ApiFailure(429,"TOOL_LIMIT","Vui lòng mô tả nhu cầu ngắn gọn hơn.");
        if(query==null || query.isBlank() || query.length()>600)throw new IllegalArgumentException("Invalid food search");
        if(maxPrice!=null && (maxPrice.signum()<0 || maxPrice.compareTo(BigDecimal.valueOf(10000000))>0))throw new IllegalArgumentException("Invalid budget");
        groups=FoodIntent.groups(requiredGroupIds,excludedGroupIds,catalog);
        searchRequest=question.message()+"\n"+query;
        sweetness=FoodIntent.sweetness(searchRequest);
        namedDishes=FoodIntent.namedDishes(searchRequest);
        // Broad requests have no named dish to match semantically. Rank eligible foods
        // within one real catalog group instead of rejecting them by similarity.
        exploratory=mode==SearchMode.EXPLORE && namedDishes.isEmpty() && sweetness==null && groups.required().size()==1;
        budget=FoodIntent.lowerBudget(hardBudget,FoodIntent.lowerBudget(maxPrice,FoodIntent.budget(query)));
        queryVector=embeddings.query(query.trim());
        candidates=db.match(session,question,queryVector,budget,sweetness,groups,exploratory).stream()
            .filter(food->FoodIntent.matchesNamedDish(food.name(),namedDishes) && FoodIntent.withinBudget(food.price(),searchRequest,budget)).limit(5).toList();
        return candidates;
        } catch(RuntimeException error) {
            // Tool frameworks may turn exceptions into tool-result text. Retain the failure
            // so a failed retrieval can never be presented as a successful empty search.
            failure=error;throw error;
        }
    }
    public boolean used(){return calls>0;}
    public void throwIfFailed(){if(failure!=null)throw failure;}
    public List<Food> verifiedFoods(){
        throwIfFailed();
        if(!used() || candidates.isEmpty())return List.of();
        return db.recheck(session,question,candidates.stream().map(Food::food_id).distinct().limit(10).toList(),queryVector,budget,sweetness,groups,exploratory).stream()
            .filter(food->FoodIntent.matchesNamedDish(food.name(),namedDishes) && FoodIntent.withinBudget(food.price(),searchRequest,budget)).toList();
    }
}

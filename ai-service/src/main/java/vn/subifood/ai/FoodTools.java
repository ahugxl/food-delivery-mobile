package vn.subifood.ai;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import static vn.subifood.ai.ApiTypes.*;

// One instance per HTTP request. Never put session or location into a shared tool bean.
public class FoodTools {
    private final SupabaseGateway db;private final MenuEmbeddings embeddings;private final Session session;private final Question question;
    private final String sweetness;private final BigDecimal hardBudget;
    private FoodIntent.Groups groups;private final List<DiscoveryGroup> catalog;private float[] queryVector;
    private final List<String> namedDishes;
    private List<Food> candidates=List.of();private BigDecimal budget;private int calls=0;
    private RuntimeException failure;
    public FoodTools(SupabaseGateway db,MenuEmbeddings embeddings,Session session,Question question,List<DiscoveryGroup> catalog){
        this.db=db;this.embeddings=embeddings;this.session=session;this.question=question;
        this.sweetness=FoodIntent.sweetness(question.message());this.hardBudget=FoodIntent.lowerBudget(question.maxPrice(),FoodIntent.budget(question.message()));
        this.catalog=List.copyOf(catalog);
        this.namedDishes=FoodIntent.namedDishes(question.message());
    }
    @Tool(returnDirect=true, description="Tìm món thực sự bán trong soopiFood bằng vector ngữ nghĩa rồi lọc giá, quán mở cửa, còn món và phạm vi 20 km. Chỉ dùng cho nhu cầu ăn uống. Không có quyền tìm Internet, đặt hàng hay sửa dữ liệu.")
    public List<Food> searchFoods(
        @ToolParam(description="Nhu cầu món ăn bằng tiếng Việt; giữ nguyên loại món và khẩu vị khách yêu cầu") String query,
        @ToolParam(description="Giá tối đa của một món bằng VND nếu khách có yêu cầu",required=false) BigDecimal maxPrice,
        @ToolParam(description="ID nhóm món bắt buộc từ danh sách database; [] nếu chưa xác định. Không dùng nhóm khách phủ định.") List<String> requiredGroupIds,
        @ToolParam(description="ID nhóm món khách muốn tránh từ danh sách database; [] nếu không có.") List<String> excludedGroupIds){
        try {
        if(++calls>2)throw new ApiFailure(429,"TOOL_LIMIT","Vui lòng mô tả nhu cầu ngắn gọn hơn.");
        if(query==null || query.isBlank() || query.length()>600)throw new IllegalArgumentException("Invalid food search");
        if(maxPrice!=null && (maxPrice.signum()<0 || maxPrice.compareTo(BigDecimal.valueOf(10000000))>0))throw new IllegalArgumentException("Invalid budget");
        groups=FoodIntent.groups(requiredGroupIds,excludedGroupIds,catalog);
        budget=FoodIntent.lowerBudget(hardBudget,maxPrice);
        queryVector=embeddings.query(question.message());
        candidates=db.match(session,question,queryVector,budget,sweetness,groups).stream()
            .filter(food->FoodIntent.matchesNamedDish(food.name(),namedDishes) && FoodIntent.withinBudget(food.price(),question.message(),budget)).limit(5).toList();
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
        return db.recheck(session,question,candidates.stream().map(Food::food_id).distinct().limit(10).toList(),queryVector,budget,sweetness,groups).stream()
            .filter(food->FoodIntent.matchesNamedDish(food.name(),namedDishes) && FoodIntent.withinBudget(food.price(),question.message(),budget)).toList();
    }
}

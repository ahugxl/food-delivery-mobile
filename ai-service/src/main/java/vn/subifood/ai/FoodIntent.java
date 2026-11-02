package vn.subifood.ai;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

final class FoodIntent {
    private FoodIntent(){}
    record Groups(List<String> required,List<String> excluded){}
    static Groups groups(List<String> required,List<String> excluded,List<ApiTypes.DiscoveryGroup> catalog){
        var allowed=catalog.stream().map(ApiTypes.DiscoveryGroup::id).collect(java.util.stream.Collectors.toSet());
        if(required==null || excluded==null || required.size()>6 || excluded.size()>6
            || !allowed.containsAll(required) || !allowed.containsAll(excluded)
            || required.stream().anyMatch(excluded::contains))
            throw new ApiFailure(400,"INVALID_FOOD_GROUP","Nhóm món AI chọn không hợp lệ. Vui lòng thử lại.");
        return new Groups(required.stream().distinct().toList(),excluded.stream().distinct().toList());
    }
    static String normalized(String text){return Normalizer.normalize(text,Normalizer.Form.NFD).replaceAll("\\p{M}","").replace('đ','d').replace('Đ','D').toLowerCase(Locale.ROOT).replaceAll("\\s+"," ").trim();}
    static List<String> namedDishes(String text){
        var result=new ArrayList<String>();String value=normalized(text);
        var matcher=Pattern.compile("(?<![a-z0-9])(?:bun bo|bun cha|pho bo|pho ga|com ga|com tam|mi cay|mi y|hu tieu)(?![a-z0-9])").matcher(value);
        while(matcher.find()){
            if(!value.substring(0,matcher.start()).matches("(?s).*(?:khong(?: muon| thich)?(?: an)?|tranh|bo qua)\\s*$"))result.add(matcher.group());
        }
        return List.copyOf(result);
    }
    static boolean matchesNamedDish(String name,List<String> dishes){
        String value=normalized(name);
        return dishes.stream().allMatch(dish->Pattern.compile("(?<![a-z0-9])"+Pattern.quote(dish)+"(?![a-z0-9])").matcher(value).find());
    }
    static String sweetness(String text){
        String value=normalized(text);
        if(value.matches("(?s).*(khong duong|khong ngot|no sugar|zero sugar).*"))return "none";
        if(value.matches("(?s).*(ngot nhe|it ngot|it duong|khong qua ngot|less sugar).*"))return "light";
        return null;
    }
    static BigDecimal budget(String text){
        var matcher=Pattern.compile("(?:duoi|toi da|khong qua)\\s*(\\d+(?:[.,]\\d+)?)\\s*(k|nghin|ngan|trieu|vnd|d)?").matcher(normalized(text));
        if(!matcher.find())return null;
        BigDecimal value=new BigDecimal(matcher.group(1).replace(',','.'));
        String unit=matcher.group(2);
        if(unit!=null && unit.matches("k|nghin|ngan"))value=value.multiply(BigDecimal.valueOf(1000));
        if("trieu".equals(unit))value=value.multiply(BigDecimal.valueOf(1000000));
        return value.min(BigDecimal.valueOf(10000000));
    }
    static boolean withinBudget(BigDecimal price,String request,BigDecimal ceiling){
        if(price==null || price.signum()<0 || (ceiling!=null && price.compareTo(ceiling)>0))return false;
        var strict=Pattern.compile("duoi\\s*(\\d+(?:[.,]\\d+)?)\\s*(k|nghin|ngan|trieu|vnd|d)?").matcher(normalized(request));
        while(strict.find()){
            BigDecimal limit=budget(strict.group());
            if(limit!=null && price.compareTo(limit)>=0)return false;
        }
        return true;
    }
    static BigDecimal lowerBudget(BigDecimal a,BigDecimal b){return a==null?b:b==null?a:a.min(b);}
}

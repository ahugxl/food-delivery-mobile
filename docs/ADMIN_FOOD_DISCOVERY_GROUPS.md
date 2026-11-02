# Web admin: chọn nhóm khám phá cho món

Tài liệu bàn giao cho người phát triển web admin soopiFood. Đã đối chiếu database và app khách ngày 02/11/2026. Đây là hướng dẫn, chưa thêm chức năng vào code admin và chưa cài RPC mới.

## 1. Chức năng cần làm

Trong **Thực đơn → Thêm/Sửa món**, thêm khu vực **Nhóm khám phá**, cho phép chọn nhiều nhóm bằng checkbox.

Ví dụ:

```text
Tên món: Cơm nấm chay
Danh mục trong thực đơn: Cơm trưa

Nhóm khám phá:
[ ] Trà sữa   [ ] Ăn vặt   [✓] Món chay
[✓] Cơm      [ ] Bún mì phở  [ ] Món Hàn

[Lưu phân loại]
```

Thêm nút **Phân loại khám phá** trên thẻ/dòng món có sẵn để phân loại menu đã nhập trước đây, không bắt buộc sửa giá hay upload lại ảnh. Hiển thị các nhóm đã chọn bằng nhãn nhỏ trên thẻ món.

Không hard code sáu lựa chọn trong React. Đọc danh sách đang hoạt động từ database để đổi tên/sắp xếp nhóm mà không phải build lại admin.

## 2. Phân biệt ba khái niệm

| Dữ liệu | Vai trò |
|---|---|
| `foods.category_id` → `categories` | Danh mục sắp xếp thực đơn của quán, ví dụ “Món mới”, “Size L” |
| `food_discovery_categories` → `discovery_categories` | Nhóm khám phá của món dùng chung toàn app và bộ lọc AI |
| `restaurants.promo_tags` | Nhãn nhà hàng, ví dụ “Quán mới”, “Quán trứ danh” |

Đổi nhóm khám phá không được thay đổi `foods.category_id`. Không suy ra nhóm món từ tên nhà hàng: một quán trà sữa có thể bán cả trà trái cây hoặc topping.

## 3. Schema hiện tại

`discovery_categories` có: `id` (text), `name`, `kind`, `restaurant_tag`, `image_url`, `sort_order`, `is_active`.

Danh sách hiện có:

| ID | Tên | Có thể chọn cho món? |
|---|---|---|
| `tra-sua` | Trà sữa | Có |
| `do-an-vat` | Ăn vặt | Có |
| `mon-chay` | Món chay | Có |
| `com` | Cơm | Có |
| `bun-mi-pho` | Bún mì phở | Có |
| `mon-han` | Món Hàn | Có |
| `quan-moi` | Quán mới | Không, `kind = restaurant_tag` |
| `quan-tru-danh` | Quán trứ danh | Không, `kind = restaurant_tag` |

Đây là dữ liệu tham chiếu hiện tại; UI vẫn phải tải động. Chỉ đưa các dòng `kind = 'food' AND is_active = true` vào danh sách lựa chọn mới.

`food_discovery_categories` có hai cột:

```ts
type FoodDiscoveryLink = {
  food_id: string;                 // UUID món
  discovery_category_id: string;  // ID text, ví dụ 'tra-sua', KHÔNG phải UUID
};
```

Khóa chính là cặp `(food_id, discovery_category_id)`. Một món được liên kết nhiều nhóm và mỗi liên kết chỉ tồn tại một lần. Không cần thêm bảng hay cột để lưu các lựa chọn này.

## 4. API đề xuất

Các API này là phần **cần triển khai**, không phải endpoint/RPC đã có sẵn:

### GET `/api/admin/discovery-groups`

Backend đọc:

```js
const { data, error } = await db.from('discovery_categories')
  .select('id,name,kind,is_active,sort_order')
  .eq('kind', 'food').eq('is_active', true)
  .order('sort_order').order('id');
```

### GET `/api/admin/foods/:foodId/discovery-groups`

Kiểm tra món tồn tại, đọc toàn bộ liên kết của **đúng món đó** và metadata nhóm:

```json
{
  "food_id": "UUID_MON",
  "selected_ids": ["com", "mon-chay"],
  "inactive_links": []
}
```

Nếu có nhóm đã tắt nhưng món vẫn liên kết, trả chúng trong `inactive_links` để UI cảnh báo. Không tự biến liên kết này thành một nhóm khác hoặc âm thầm xóa khi mở form.

### PUT `/api/admin/foods/:foodId/discovery-groups`

Body:

```json
{ "discovery_category_ids": ["com", "mon-chay"] }
```

Mảng rỗng có nghĩa **bỏ tất cả nhóm khám phá**. UI cần xác nhận trước khi lưu rỗng và giải thích món vẫn có trong thực đơn/tìm kiếm tên, nhưng không xuất hiện khi lọc nhóm khám phá và có thể bị loại khi AI yêu cầu nhóm cụ thể.

Backend kiểm tra:

1. Token hợp lệ và tài khoản được quyền quản trị theo middleware admin hiện có.
2. `foodId` đúng UUID và món tồn tại.
3. Body chỉ có `discovery_category_ids`; đây là mảng string, không null. Giới hạn kích thước request, loại ID trùng.
4. Tất cả ID lựa chọn mới phải tồn tại, `kind = food`, `is_active = true`. Không chấp nhận `quan-moi`, `quan-tru-danh`.
5. Không nhận `food_id` khác từ body hoặc ghi theo `restaurant_id` thay cho món được chọn.

Nếu có `inactive_links`, chặn lưu với 409 và yêu cầu admin xác nhận loại bỏ những liên kết đã tắt. Chỉ sau xác nhận mới cho thay thế toàn bộ liên kết bằng danh sách đang hoạt động; không âm thầm xóa dữ liệu ẩn khỏi checkbox.

Phản hồi thành công:

```json
{ "food_id": "UUID_MON", "selected_ids": ["com", "mon-chay"], "message": "Đã lưu nhóm khám phá." }
```

## 5. Lưu trong một giao dịch

Không gọi `DELETE` qua REST rồi `INSERT` bằng request REST khác. Nếu bước thứ hai lỗi, món sẽ mất phân loại cũ.

Người phát triển backend cần thêm RPC chuyên dụng, ví dụ tên đề xuất `admin_set_food_discovery_groups`, thực hiện trong **một giao dịch database**:

```text
Khóa dòng foods của foodId (FOR UPDATE)
→ kiểm tra món và toàn bộ ID nhóm
→ kiểm tra/xác nhận xử lý liên kết đã tắt
→ xóa liên kết của đúng foodId
→ chèn các liên kết được chọn, bỏ trùng
→ trả danh sách đã lưu
```

Nếu có lỗi ở bất kỳ bước nào, toàn bộ giao dịch phải rollback, giữ nguyên liên kết cũ. Khóa dòng món giúp hai thao tác lưu đồng thời không trộn thành một danh sách ngoài ý muốn; phiên bản đầu có thể dùng quy tắc lần lưu sau cùng thắng. Nếu cần chống ghi đè từ form cũ, bổ sung kiểm tra phiên bản trước khi ghi.

RPC này phải chỉ dành cho backend: không cấp EXECUTE cho `PUBLIC`, `anon` hoặc `authenticated`. Với hàm đặc quyền, đặt logic trong schema `private`, `search_path = ''`, dùng tên bảng đầy đủ; nếu cần public wrapper cho PostgREST thì wrapper chỉ cho `service_role` gọi. Middleware backend vẫn phải xác minh admin trước khi gọi RPC.

Ví dụ gọi sau khi RPC đã được triển khai (tên tham số là hợp đồng đề xuất, cần khớp định nghĩa thực tế):

```js
const { data, error } = await db.rpc('admin_set_food_discovery_groups', {
  p_food_id: req.params.foodId,
  p_discovery_category_ids: selectedIds,
  p_remove_inactive: confirmedRemoveInactive,
});
```

Không cấp quyền INSERT/DELETE bảng liên kết cho app khách để làm cho admin hoạt động. Secret/service-role key phải ở backend; frontend admin gửi access token qua lớp API hiện tại.

Việc cài RPC là migration một lần của người phát triển. Sau khi tính năng hoạt động, người quản trị chỉ dùng checkbox và nút Lưu, không chạy SQL cho từng món.

## 6. UI React

State lựa chọn nên là `string[]`. Khi mở món khác phải hủy request cũ hoặc kiểm tra ID phản hồi trước khi cập nhật state, tránh lấy nhóm món A đi lưu cho món B.

```tsx
type DiscoveryGroup = { id: string; name: string };
const [selectedIds, setSelectedIds] = useState<string[]>([]);

function toggle(id: string, checked: boolean) {
  setSelectedIds(current => checked
    ? [...new Set([...current, id])]
    : current.filter(value => value !== id));
}

// groups được tải từ API, không khai báo cố định trong component.
{groups.map(group => <label key={group.id}>
  <input type="checkbox" checked={selectedIds.includes(group.id)} disabled={saving}
    onChange={event => toggle(group.id, event.target.checked)}/>
  {group.name}
</label>)}
```

Trong form:

- Hiện trạng thái tải/lỗi nhóm; chưa tải được lựa chọn cũ thì khóa nút Lưu.
- Giữ checkbox đã chọn nếu lưu lỗi, không hiển thị thông báo thành công khi chưa có phản hồi server.
- Khóa nút khi đang lưu; sau thành công cập nhật cache/danh sách món và đọc lại nhóm của món.
- Nhóm “Quán mới/Quán trứ danh” không xuất hiện trong checkbox món.
- Hiển thị riêng danh mục thực đơn và nhóm khám phá để quản trị không nhầm.

## 7. Khi thêm món mới và upload ảnh B2

Giữ nguyên luồng ảnh Backblaze B2 qua S3 và lưu URL Cloudflare. Nhóm khám phá không cần ảnh riêng cho mỗi liên kết.

Phương án tốt: upload ảnh trước, sau đó một RPC backend tạo `foods` và chèn liên kết trong cùng giao dịch. RPC phải kiểm tra lại nhóm, không chỉ tin kết quả kiểm tra trước khi upload. Nếu giao dịch không tạo được món, chỉ dọn đúng đối tượng ảnh vừa upload theo cơ chế hiện có.

Nếu chưa đổi API tạo món để hỗ trợ giao dịch chung, có thể triển khai modal phân loại cho **món đã tồn tại** trước. Sau khi tạo món, mở modal đó bằng UUID món vừa tạo. Nếu lưu nhóm lỗi thì báo “Món đã tạo nhưng chưa lưu nhóm khám phá”, giữ UUID để thử lại; không gửi lại POST tạo món vì sẽ tạo bản sao.

## 8. Quy tắc phân loại

- “Trà sữa ô long” → Trà sữa.
- “Cơm nấm chay” → Cơm + Món chay, khi đã xác nhận nguyên liệu/phần ăn là chay.
- “Kimbap” → Món Hàn; không gắn thêm Cơm chỉ vì món có nguyên liệu gạo.
- “Trà đào” không tự gắn Trà sữa chỉ vì quán mang tên Trà sữa.
- Topping bán riêng không gắn Trà sữa để giả làm ly nước. Trường `foods.is_addon` đã có trong database; nên có checkbox riêng “Món bán thêm/Topping”, độc lập với nhóm khám phá.
- Không gắn Món chay dựa vào suy đoán của AI hoặc chỉ vì tên món có rau.

Đừng chạy lại migration phân loại ban đầu như một job tự động: nó có thể thêm lại liên kết mà admin vừa bỏ.

## 9. Tác động đến app khách và vector

App khách đã đọc `food_discovery_categories` khi bấm nhóm khám phá. AI lấy nhóm từ database, rồi RPC tìm/recheck kiểm tra liên kết hiện tại.

Chỉ đổi liên kết nhóm khám phá **không cần tạo lại vector** vì tài liệu embedding hiện tại không chứa các liên kết này. Giá/khả năng bán/nhóm vẫn được lọc lại bằng database. Đổi tên, mô tả, danh mục thực đơn hoặc tùy chọn món mới có thể làm tài liệu embedding thay đổi và được đồng bộ lại.

Sau khi lưu, app khách có thể cần tải lại danh sách do React Query đang giữ cache. Không cam kết thay đổi tức thời trên màn hình đang mở nếu chưa có cơ chế invalidation/Realtime tương ứng.

## 10. Checklist kiểm thử

1. Mở món cũ: checkbox phản ánh đúng liên kết đang lưu.
2. Chọn Cơm + Món chay: có đúng hai liên kết, không trùng.
3. Bỏ một nhóm: món biến mất khỏi nhóm đó, vẫn xuất hiện trong nhóm còn lại.
4. Không chấp nhận ID lạ, nhóm đã tắt hoặc loại `restaurant_tag`; khi lỗi phải giữ nguyên liên kết cũ.
5. Lưu rỗng cần xác nhận; không xóa món, ảnh hoặc danh mục thực đơn.
6. Món A và B cùng quán: sửa A không được thay đổi B.
7. Đổi nhanh món trong modal không lấy nhầm phản hồi request trước.
8. Không token nhận 401; khách thường nhận 403; gọi trực tiếp RPC bằng public key không ghi được.
9. Sau khi khách tải lại: bấm thẻ Trà sữa chỉ thấy quán có món được liên kết; AI cũng áp dụng cùng liên kết.
10. Không ảnh hưởng ảnh B2, giá, topping/size, đơn cũ hoặc snapshot tùy chọn đã đặt.

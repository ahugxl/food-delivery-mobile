# Hướng dẫn web admin quản lý voucher soopiFood

Tài liệu bàn giao cho người phát triển web admin, đối chiếu schema Supabase và app khách hiện tại ngày 02/11/2026. Đây là hướng dẫn triển khai; chưa thêm API hay màn hình vào web admin.

## 1. Luồng cần triển khai

```text
Admin đăng nhập → Quản lý voucher → Tạo mã → backend xác minh quyền
→ backend kiểm tra dữ liệu → INSERT vouchers → trả kết quả → cập nhật danh sách

App khách → trang thu thập mã → collect_my_voucher → user_vouchers
→ chọn mã trong ví → checkout kiểm tra và sử dụng mã trong giao dịch đặt hàng
```

Tạo voucher chỉ tạo một dòng trong `public.vouchers`, không tự thêm vào ví của tất cả khách. App khách đã có luồng thu thập và sử dụng; không viết lại luồng đó trong admin.

Không cần chạy SQL cho mỗi lần tạo voucher. Dùng backend admin hiện có để ghi Supabase bằng SDK.

## 2. Form tạo mã

| Nhãn trên form | Cột | Giá trị / quy tắc |
|---|---|---|
| Mã khuyến mãi | `code` | Bắt buộc; trim và chuyển IN HOA; không trùng |
| Giảm cho | `applies_to` | `food`: tiền món; `shipping`: phí giao hàng |
| Cách giảm | `discount_type` | `fixed`: số tiền VND; `percentage`: phần trăm |
| Giá trị giảm | `discount_value` | `fixed`: số nguyên VND > 0; `percentage`: > 0 và ≤ 100 |
| Tiền món tối thiểu | `min_order_value` | Số nguyên VND ≥ 0; không cộng phí ship vào điều kiện này |
| Phạm vi áp dụng | `restaurant_id` | `null`: mọi quán; UUID: chỉ quán được chọn |
| Hết hạn lúc | `expiry_date` | Thời điểm ISO có múi giờ hoặc `null` nếu không hạn |
| Kích hoạt ngay | `is_active` | Boolean; nên mặc định `false` trên form để admin kiểm tra trước khi bật |

Backend tự để `reward_owner_id = null` cho mã công khai. Không cho form này truyền chủ sở hữu, UUID mã hoặc trạng thái đã sử dụng. Mã đổi xu riêng của khách có `reward_owner_id` khác null phải được loại khỏi màn hình quản lý voucher công khai này.

Quy tắc 3–40 ký tự `[A-Z0-9_-]` trong ví dụ bên dưới là quy tắc của API admin đề xuất, không phải giới hạn hiện có của cột database.

Ví dụ form:

```json
{
  "code": "GIAMMON20K",
  "applies_to": "food",
  "discount_type": "fixed",
  "discount_value": 20000,
  "min_order_value": 80000,
  "restaurant_id": null,
  "expiry_date": "2026-12-31T16:59:59.000Z",
  "is_active": true
}
```

Mốc trên tương ứng 23:59:59 ngày 31/12/2026 tại Việt Nam. Với `datetime-local`, hãy chuyển bằng `new Date(value).toISOString()` khi người quản trị dùng múi giờ Việt Nam; hiển thị rõ giờ Việt Nam và xác nhận thời điểm trước khi gửi. Không nối thêm `Z` vào chuỗi giờ địa phương.

Voucher freeship có thể tạo bằng `shipping` + `percentage` + `100`. Voucher ship giảm 15.000₫ dùng `shipping` + `fixed` + `15000`. Số tiền giảm thực tế không vượt quá phí ship; voucher `food` không giảm quá tiền món.

## 3. API và xác thực

| API | Chức năng |
|---|---|
| `GET /api/admin/vouchers?page=0` | Danh sách mã công khai, phân trang |
| `POST /api/admin/vouchers` | Tạo voucher mới |
| `PATCH /api/admin/vouchers/:id/status` | Bật/tắt voucher |
| `GET /api/admin/restaurants` | Dùng danh sách quán của admin cho ô chọn phạm vi; nếu chưa có thì bổ sung API đọc quán |

Frontend gửi `Authorization: Bearer <access_token>` của admin. Backend phải xác minh token bằng `auth.getUser(token)` và kiểm tra UUID trong danh sách quản trị hoặc cơ chế quyền quản trị đã được bảo vệ trên server.

Ở bản admin đã đối chiếu tại `D:\TBDD\btl\New folder\food-delivery-admin`, `server/app.mjs` đã có middleware `/api/admin` kiểm tra token và `ADMIN_USER_IDS`. Đăng ký các route voucher **sau middleware này và trước route trả 404**. Đừng tạo một nhóm API bỏ qua middleware.

Secret/service-role key chỉ đặt trong `server/.env.local` hoặc biến môi trường backend khi deploy. Frontend chỉ có public key và access token; không đặt secret key trong biến `VITE_*` và không cấp quyền ghi voucher cho `anon`/khách đăng nhập để giải quyết lỗi quyền.

## 4. Mẫu module backend Express

Thêm `server/vouchers.mjs`. Biến `db` là Supabase client phía server đang dùng secret key, không phải client của trình duyệt.

```js
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = new Set([
  'code', 'applies_to', 'discount_type', 'discount_value',
  'min_order_value', 'restaurant_id', 'expiry_date', 'is_active',
]);
const money = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000;

function payload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(k => !fields.has(k))) return null;
  if (typeof input.code !== 'string') return null;
  const code = input.code.trim().toUpperCase();
  const minimum = input.min_order_value ?? 0;
  const restaurant = input.restaurant_id ?? null;
  const expiry = input.expiry_date ?? null;
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)
    || !['food', 'shipping'].includes(input.applies_to)
    || !['fixed', 'percentage'].includes(input.discount_type)
    || typeof input.discount_value !== 'number'
    || !Number.isFinite(input.discount_value) || input.discount_value <= 0
    || (input.discount_type === 'fixed' && !money(input.discount_value))
    || (input.discount_type === 'percentage' && input.discount_value > 100)
    || !money(minimum) || typeof input.is_active !== 'boolean'
    || (restaurant !== null && (typeof restaurant !== 'string' || !uuid.test(restaurant)))) return null;
  if (expiry !== null && (typeof expiry !== 'string'
    || !/(Z|[+-]\d{2}:\d{2})$/i.test(expiry)
    || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())) return null;
  return {
    code, applies_to: input.applies_to, discount_type: input.discount_type,
    discount_value: input.discount_value, min_order_value: minimum,
    restaurant_id: restaurant,
    expiry_date: expiry === null ? null : new Date(expiry).toISOString(),
    is_active: input.is_active, reward_owner_id: null,
  };
}

export function installVouchers(app, db) {
  app.get('/api/admin/vouchers', async (req, res) => {
    const page = Number(req.query.page ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 10000)
      return res.status(400).json({ error: 'Trang không hợp lệ.' });
    try {
      const { data, error, count } = await db.from('vouchers')
        .select('*', { count: 'exact' }).is('reward_owner_id', null)
        .order('code').order('id').range(page * 50, page * 50 + 49);
      if (error) throw error;
      res.json({ items: data ?? [], total: count ?? 0, page });
    } catch { res.status(500).json({ error: 'Không tải được voucher.' }); }
  });

  app.post('/api/admin/vouchers', async (req, res) => {
    const row = payload(req.body);
    if (!row) return res.status(400).json({ error: 'Kiểm tra mã, giá trị giảm, phạm vi và hạn dùng.' });
    try {
      if (row.restaurant_id) {
        const { data, error } = await db.from('restaurants').select('id')
          .eq('id', row.restaurant_id).eq('is_active', true).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(400).json({ error: 'Quán không tồn tại hoặc ngừng hoạt động.' });
      }
      const { data, error } = await db.from('vouchers').insert(row).select('*').single();
      if (error?.code === '23505')
        return res.status(409).json({ error: 'Mã khuyến mãi đã tồn tại. Hãy dùng mã khác.' });
      if (error) throw error;
      res.status(201).json(data);
    } catch { res.status(500).json({ error: 'Không tạo được voucher. Hãy kiểm tra danh sách trước khi thử lại.' }); }
  });

  app.patch('/api/admin/vouchers/:id/status', async (req, res) => {
    if (!uuid.test(req.params.id) || !req.body || Array.isArray(req.body)
      || Object.keys(req.body).length !== 1 || typeof req.body.is_active !== 'boolean')
      return res.status(400).json({ error: 'Thông tin kích hoạt không hợp lệ.' });
    try {
      const { data: current, error: readError } = await db.from('vouchers')
        .select('id,expiry_date').eq('id', req.params.id).is('reward_owner_id', null).maybeSingle();
      if (readError) throw readError;
      if (!current) return res.status(404).json({ error: 'Không tìm thấy voucher công khai.' });
      if (req.body.is_active && current.expiry_date && Date.parse(current.expiry_date) <= Date.now())
        return res.status(409).json({ error: 'Mã đã hết hạn. Hãy tạo mã mới.' });
      const { data, error } = await db.from('vouchers').update({ is_active: req.body.is_active })
        .eq('id', req.params.id).is('reward_owner_id', null).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Không tìm thấy voucher.' });
      res.json(data);
    } catch { res.status(500).json({ error: 'Không cập nhật được trạng thái voucher.' }); }
  });
}
```

Trong `server/app.mjs`, import `installVouchers` rồi gọi `installVouchers(app, db)` sau middleware quản trị. Không dùng thông báo lỗi `23505` chung của phân công tài xế cho API voucher.

Nếu database có mã cũ viết thường, cần rà soát/chuẩn hóa riêng trước khi mở quản lý rộng rãi: unique hiện tại là trên `code`, không bảo đảm duy nhất khi bỏ qua hoa thường. API mới luôn tạo mã IN HOA; không tự sửa mã cũ đã phát hành trong endpoint tạo.

## 5. Frontend admin

Thêm menu **Khuyến mãi → Voucher**:

- Bảng gồm mã, loại tiền món/phí ship, cách giảm, giá trị, đơn tối thiểu, quán, hạn dùng, trạng thái và nút bật/tắt.
- Nút **Tạo voucher** mở form; ô số tiền hiển thị định dạng VND nhưng gửi JSON dạng số, ví dụ `20000`, không gửi chuỗi `"20.000₫"`.
- Với phần trăm, hiển thị hậu tố `%`; gửi `20`, không gửi `0.2`.
- Ô phạm vi gồm **Tất cả quán** và tìm/chọn nhà hàng; gửi UUID, không gửi tên quán.
- Nút lưu khóa trong khi request đang chạy. Thành công cập nhật bảng/React Query; lỗi hiển thị ngay trong form và giữ dữ liệu người dùng đã nhập.
- Gửi access token hiện tại qua lớp gọi API của admin. `401`: yêu cầu đăng nhập lại; `403`: thiếu quyền; `409`: mã trùng/hết hạn; `400`: dữ liệu không hợp lệ.
- Không tự gọi lại POST liên tục nếu mạng lỗi: tải lại danh sách, tìm mã vừa tạo trước khi thử tiếp.

Ví dụ gọi API (dùng base URL/proxy đang có trong admin):

```ts
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('Vui lòng đăng nhập quản trị.');
const response = await fetch('/api/admin/vouchers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify(formPayload),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || 'Không tạo được voucher.');
```

## 6. Những chức năng chưa có trong schema hiện tại

- Chưa có `max_discount_amount`: không cho nhập “giảm 30%, tối đa 20k”. Voucher phần trăm hiện chỉ bị chặn bởi tiền món/phí ship thực tế.
- Chưa có `start_date`, số lượng phát hành, số lượt dùng toàn hệ thống hoặc giới hạn theo ngày. Không vẽ form những mục này rồi bỏ qua khi lưu.
- Mỗi cặp `user_id + voucher_id` là duy nhất. Một khách dùng một voucher một lần; hiện không có cơ chế reset lại để dùng nhiều lần.
- Tạo mã mới, không tái sử dụng mã đã phát hành cho chương trình khác. Không đổi số tiền/điều kiện của mã đã có khách lưu vì sẽ thay điều kiện trong ví của khách.
- Bật/tắt mã tác động cả khách đã lưu nhưng chưa sử dụng; form cần ghi rõ điều này trước khi admin tắt.
- Ưu tiên ngừng hoạt động thay vì xóa. Không thêm nút xóa vĩnh viễn trong phiên bản đầu vì mã có liên hệ ví và lịch sử đơn hàng.
- Bảng `vouchers` không có cột ảnh. Tạo voucher không cần upload Backblaze B2; ảnh banner là luồng riêng của bảng `banners`.
- Mã công khai `reward_owner_id = null` được trang Campaign hiện tại đọc chung. Chưa có liên kết “voucher thuộc banner/campaign riêng”; tạo mã không tự tạo banner.

## 7. Kiểm thử trước khi bàn giao

1. Tạo `food/fixed/20000`, tối thiểu 80.000₫; app khách tải lại trang thu thập, lưu vào ví và áp dụng trên đơn đủ điều kiện.
2. Tạo `shipping/fixed/15000`; xác minh chỉ giảm phí ship, có thể dùng cùng một mã tiền món.
3. Tạo `shipping/percentage/100`; phí ship sau giảm về 0, tiền công tài xế vẫn theo luồng riêng hiện tại.
4. Tạo mã cho một quán; thu thập được nhưng chỉ áp dụng tại quán đó và đạt tiền món tối thiểu.
5. Thử mã trùng, giá âm, phần trăm 101, UUID sai, ngày quá hạn: bị từ chối, không tạo dòng rác.
6. Khách thường gọi API admin phải nhận 403; không token nhận 401.
7. Tắt voucher, tải lại app khách: không áp dụng được; mã đã sử dụng vẫn hiện trong lịch sử.
8. Đặt hàng thành công: server đánh dấu `user_vouchers.is_used` trong giao dịch; không để frontend/admin tự đánh dấu dùng mã.

Không đổi policy hoặc viết lại RPC checkout chỉ để thêm màn hình admin. Nếu muốn bổ sung hạn mức giảm hoặc số lượng phát hành, cần một pha schema + RPC + app riêng.

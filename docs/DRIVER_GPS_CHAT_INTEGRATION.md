# Bàn giao app tài xế: GPS, chat và chuyển trạng thái

Đối chiếu trực tiếp database Supabase và mã nguồn app khách ngày 31/10/2026.
Project ref: `glchegbogadnllehcnzf`.
Tài liệu này thay phần GPS/chat/trạng thái trong tài liệu bàn giao cũ; không chạy lại SQL foundation/import cũ.

## 1. Kết nối và các ID

- Dùng cùng Supabase project với app khách, public/publishable key và phiên đăng nhập **của tài xế**. Không đưa secret/service_role vào app.
- Tài khoản phải có `profiles.role = 'driver'` và `driver_profiles.approval_status = 'approved'`.
- Các RPC dưới đây đã tồn tại và đã cấp EXECUTE cho `authenticated`; không cần tạo lại bảng hay mở RLS.
- Đồng bộ định nghĩa `Database` từ schema hiện tại, không dùng bản 16 bảng ban đầu.
- `driver_dashboard()` trả JSON có `profile`, `online`, `trips`, `ledger`, `reviews`.
- Trong mỗi phần tử `trips`: **`id` là assignmentId** (`delivery_assignments.id`); **`order_id` là orderId** (`orders.id`). Hai UUID này khác nhau.
- GPS: không truyền assignmentId/orderId/driverId. Backend lấy driverId từ `auth.uid()`.
- Chat và chuyển bước: truyền **assignmentId**. Backend tự tìm đúng orderId.

Ví dụ các đoạn TypeScript dưới giả định đã có `supabase` client đăng nhập đúng tài xế.

```ts
const { data: dashboard, error } = await supabase.rpc('driver_dashboard');
if (error) throw error;
// Parse/validate dashboard (RPC trả Json), rồi lấy trip.id và trip.order_id.
```

## 2. Gửi vị trí GPS để app khách thấy xe

Luồng: GPS thiết bị → `driver_update_location` → `driver_locations` →
app khách gọi `order_driver_location(orderId)` → marker xe trên Leaflet/OpenStreetMap.

Trước tiên bật online khi tài xế chủ động bật nhận đơn:

```ts
const { error } = await supabase.rpc('driver_set_online', { p_online: true });
if (error) throw error;
```

RPC vị trí chính xác:

```ts
const { error } = await supabase.rpc('driver_update_location', {
  p_latitude: position.coords.latitude,
  p_longitude: position.coords.longitude,
  ...(position.coords.accuracy == null ? {} : { p_accuracy: position.coords.accuracy }),
});
if (error) throw error;
```

`p_accuracy` tính bằng mét, là độ sai số GPS; không phải khoảng cách đã chạy.
Backend ghi `received_at = now()` và cập nhật `driver_presence.last_seen_at`.
Không ghi GPS tài xế vào `orders.latitude/longitude`: đó là tọa độ **khách nhận hàng**.
Không insert/upsert trực tiếp `driver_locations` vì bảng đã chặn quyền ghi của client.

### Ví dụ đồng bộ khi app ở foreground

Cài trong **project app tài xế** nếu chưa có: `npx expo install expo-location`.
Đặt hook ở layout/provider giữ suốt phiên tài xế, tránh đặt riêng ở màn hình bản đồ rồi rời màn hình là dừng.
`enabled = đã đăng nhập && tài xế approved && online`.
Mẫu dưới lấy GPS mới, không gửi lại mãi một tọa độ cache để giả vờ còn cập nhật.

```ts
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';

export function useDriverGps(enabled: boolean, driverId: string | null) {
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !driverId) return;
    let disposed = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let foreground = AppState.currentState === 'active';

    async function sync() {
      if (disposed || running || !foreground) return;
      running = true;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') throw new Error('Chưa cấp quyền vị trí.');
        if (!(await Location.hasServicesEnabledAsync())) throw new Error('Hãy bật định vị trên thiết bị.');
        const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (disposed || !foreground) return;
        if (!Number.isFinite(fix.coords.latitude) || !Number.isFinite(fix.coords.longitude)) {
          throw new Error('GPS trả tọa độ không hợp lệ.');
        }
        const age = Date.now() - fix.timestamp;
        if (age > 30000 || age < -60000) throw new Error('Vị trí GPS đã cũ, đang chờ vị trí mới.');
        const { error } = await supabase.rpc('driver_update_location', {
          p_latitude: fix.coords.latitude,
          p_longitude: fix.coords.longitude,
          ...(fix.coords.accuracy == null ? {} : { p_accuracy: fix.coords.accuracy }),
        });
        if (error) throw error;
        if (!disposed) setGpsError(null);
      } catch (error) {
        if (!disposed) setGpsError(error instanceof Error ? error.message : 'Không gửi được vị trí.');
      } finally {
        running = false;
        if (!disposed && foreground) timer = setTimeout(() => void sync(), 8000);
      }
    }

    const listener = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (timer) clearTimeout(timer);
      if (foreground) void sync();
    });
    void sync();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      listener.remove();
    };
  }, [enabled, driverId]);

  return { gpsError };
}
```

Hiển thị lỗi GPS và nút mở cài đặt/cấp lại quyền; **không khóa các nút chuyển bước vì gpsError**.
Mẫu không chạy song song nhiều request GPS, tự dừng khi background/logout và lấy lại khi foreground.
Nếu người dùng từ chối quyền vĩnh viễn, cho mở Settings; không liên tục bật hộp xin quyền.

Giới hạn: đây là foreground GPS. Không hứa theo dõi khi khóa màn hình/tắt app.
Nếu cần background thật, triển khai `expo-task-manager` + `startLocationUpdatesAsync`, quyền nền/foreground service phù hợp và development/APK build theo SDK của app tài xế. Không dựa vào Expo Go để kiểm thử đầy đủ background.

### Điều kiện app khách hiển thị xe (đã có sẵn)

- Đơn thuộc khách đăng nhập, `orders.driver_id` đúng tài xế.
- `orders.status` là `preparing` hoặc `delivering`.
- Phân công đang ở `accepted`, `at_restaurant`, `picked_up` hoặc `at_customer`.
- Có tọa độ hợp lệ, bản ghi GPS mới hơn 2 phút. Nếu quá cũ, app báo vị trí cũ thay vì giả xe đang chạy.
- App khách đang ở foreground đọc GPS mỗi **5 giây**; không cần subscribe bảng GPS.
- GPS sau RPC thành công thường xuất hiện ở lần đọc tiếp theo, còn phụ thuộc mạng.
- `offered` chưa nhận chuyến: chưa hiển thị xe; hoàn tất/hủy: dừng theo dõi.
- Bảng `driver_locations` và `delivery_assignments` hiện không thuộc publication `supabase_realtime`. Không subscribe trực tiếp rồi chờ sự kiện từ chúng.

## 3. Gửi tin nhắn cho khách

Chat chỉ mở sau khi nhận chuyến, trong bốn trạng thái hoạt động nêu trên; đơn chưa completed/cancelled và vẫn gán đúng tài xế.

```ts
export async function sendDriverMessage(assignmentId: string, input: string) {
  const content = input.trim();
  if (!content || Array.from(content).length > 2000) {
    throw new Error('Tin nhắn cần từ 1 đến 2.000 ký tự.');
  }
  const { error } = await supabase.rpc('driver_send_message', {
    p_assignment_id: assignmentId,
    p_content: content,
  });
  if (error) throw error;
  // RPC trả void: data = null là bình thường. Thành công dựa vào error == null.
}

export async function fetchDriverMessages(assignmentId: string) {
  const { data, error } = await supabase.rpc('driver_messages', {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  return data; // Validate Json thành danh sách trước khi render.
}
```

Backend tự chèn `messages` với `order_id` đúng, `sender_id = auth.uid()`,
`sender_type = 'driver'`, `message_type = 'text'`.
**Không dùng đoạn gửi của app khách có sender_type='user'; không insert trực tiếp messages từ app tài xế.**

`driver_messages` trả tối đa 100 tin gần nhất, theo thứ tự cũ → mới:
`id`, `sender_type`, `content`, `message_type`, `created_at`.
RPC hiện chưa trả `image_url` và chưa hỗ trợ tài xế gửi ảnh. Không quảng bá hai chức năng ảnh này như đã có; nếu `message_type='image'`, tạm hiện “Khách đã gửi ảnh”.

### Đồng bộ hai chiều

- Sau gửi thành công, xóa ô nhập và tải lại `driver_messages`.
- Khóa nút trong lúc gửi, không tự retry vô hạn: RPC chưa có client message ID chống trùng khi mạng đứt giữa chừng.
- App khách đã nghe INSERT trên `messages` theo **orderId**, nên tin tài xế gửi qua RPC sẽ hiện realtime.
- App tài xế có thể lấy tin mới qua RPC mỗi 3–5 giây khi màn hình chat foreground. Dừng timer khi đóng chat/kết thúc chuyến/logout, làm mới ngay khi quay lại app.
- Đơn giản nhất dùng React Query; tránh mở một setInterval mới ở mỗi render:

```ts
const chat = useQuery({
  queryKey: ['driver-chat', driverId, assignmentId],
  queryFn: () => fetchDriverMessages(assignmentId),
  enabled: !!driverId && !!assignmentId && isChatOpen && isForeground && isActiveTrip,
  refetchInterval: isChatOpen && isForeground && isActiveTrip ? 4000 : false,
  refetchIntervalInBackground: false,
});
// Sau sendDriverMessage thành công:
// await queryClient.invalidateQueries({ queryKey: ['driver-chat', driverId, assignmentId] });
```

Không mặc định rằng driver subscribe `postgres_changes/messages` được chỉ vì kênh báo SUBSCRIBED:
policy messages có nhánh driver nhưng còn phụ thuộc quyền SELECT/RLS của orders.
Hợp đồng ổn định cho app tài xế hiện tại là RPC `driver_messages`; không mở quyền toàn bảng để nhận WebSocket.

## 4. Chuyển trạng thái không bắt buộc đến đúng tọa độ

Đã đọc định nghĩa `public.driver_step` trực tiếp trên database: **không có geofence, không kiểm tra bán kính, không yêu cầu GPS trước khi bấm Đã đến quán/Đã đến khách**.
Không cần thêm SQL để bỏ điều kiện GPS. Nếu app tài xế tự chặn theo khoảng cách, hãy bỏ điều kiện đó trên UI.

| Thao tác nút | p_action | Trạng thái trước → sau | Chữ trên app khách |
| --- | --- | --- | --- |
| Nhận đơn | accept | offered → accepted | Tài xế đang đến quán |
| Đã đến quán | arrive_restaurant | accepted → at_restaurant | Tài xế đã đến quán |
| Đã lấy món | pickup | at_restaurant → picked_up | Tài xế đang giao hàng |
| Đã đến điểm giao | arrive_customer | picked_up → at_customer | Tài xế đã đến điểm giao |
| Giao thành công | deliver | at_customer → delivered | Giao hàng thành công |

```ts
type DriverAction = 'accept' | 'arrive_restaurant' | 'pickup' | 'arrive_customer' | 'deliver';

export async function performStep(
  assignmentId: string,
  action: DriverAction,
  codConfirmed = false,
) {
  const { error } = await supabase.rpc('driver_step', {
    p_assignment_id: assignmentId,
    p_action: action,
    p_cod_confirmed: codConfirmed,
  });
  if (error) throw error;
  // Tải lại driver_dashboard và cập nhật UI bằng dữ liệu backend.
}
```

Vẫn giữ: đúng thứ tự bước, đúng tài xế, approved, đề nghị chưa hết hạn khi nhận, online khi nhận,
chặn đơn kết thúc/điều phối lại, xác nhận thu đủ COD nếu cod_amount > 0.
`p_cod_confirmed=true` chỉ sau khi tài xế xác nhận đã thu tiền; không hard code true cho mọi lần giao.
Từ chối (`reject`, chỉ offered) / báo thất bại (`fail`, chuyến hoạt động) cần `p_reason` từ 5–1.000 ký tự.
Không UPDATE trực tiếp `orders.status` hoặc `delivery_assignments.status`.
Không tự chuyển bước theo marker GPS; tài xế bấm nút chủ động.

Ví dụ điều kiện nút: `disabled = isSubmitting || trip.status !== 'accepted'` cho nút Đã đến quán.
Không thêm `distance > 100`, `!location`, `!permissionGranted` vào điều kiện này.
Sau mỗi RPC bước thành công, tải lại dashboard; vô hiệu hóa nút trong lúc gửi.

App khách nghe orders realtime và đọc `order_delivery_progress` mỗi 5 giây khi đơn hoạt động.
Vì đến quán/đến khách chỉ đổi trạng thái chuyến, app khách có thể cần tới lần đọc 5 giây tiếp theo để cập nhật chữ/thanh tiến trình.

## 5. Kiểm thử hai app

1. Đăng nhập tài xế approved; bật online và cấp quyền GPS. Giữ app tài xế foreground.
2. Admin phân công đơn mới qua `admin_driver_assign`; tài xế lấy assignmentId từ dashboard.
3. Nhận đơn; app khách mở Theo dõi đúng orderId. GPS sẽ xuất hiện khi có bản ghi mới.
4. Máy ảo: Extended Controls → Location → nhập tọa độ hoặc chạy route → Send/Play. Vị trí giả lập nằm ở nước khác vẫn cho chuyển bước; dùng điểm gần đơn để dễ nhìn bản đồ.
5. Gửi tin từ tài xế; app khách phải nhận dưới vai trò driver. Gửi ngược từ khách; app tài xế nhận ở lần gọi driver_messages tiếp theo.
6. Đứng yên/không di chuyển tới quán thật, bấm lần lượt arrive_restaurant → pickup → arrive_customer. Cả ba phải thành công nếu đúng thứ tự và quyền.
7. Giao COD: xác nhận thu đủ rồi deliver; hai app cập nhật completed/delivered. Không dùng đơn thật để thử thu tiền/giao xong.
8. Kiểm tra GPS bị từ chối: hiện cảnh báo định vị, các nút chuyển bước vẫn hoạt động. Sau 2 phút không có GPS mới, app khách báo cũ/chờ GPS.
9. Kết thúc chuyến: chat RPC bị khóa và app khách không còn đọc vị trí chuyến đó. Không coi đây là lỗi mạng.

| Lỗi | Kiểm tra |
| --- | --- |
| Tài khoản chưa được duyệt hoặc không có quyền tài xế | Session đúng UUID; profiles.role và driver_profiles.approval_status |
| Hãy bật nhận đơn | Gọi driver_set_online(true), kiểm tra error và dashboard.online |
| Không tìm thấy chuyến của bạn | Nhầm orderId với assignmentId hoặc đăng nhập nhầm tài xế |
| Chat chỉ mở trong chuyến đang thực hiện | Chưa accept, chuyến kết thúc hoặc đã đổi tài xế |
| Thao tác không phù hợp với trạng thái hiện tại | Tải lại dashboard và kiểm tra thứ tự bước |
| GPS gửi được nhưng khách chưa thấy | Đúng orderId/driverId, đã accept, preparing/delivering, timestamp < 2 phút, app khách foreground |
| permission denied khi ghi bảng | Dùng RPC tương ứng; không mở RLS hoặc thêm service_role vào client |

## 6. Ranh giới kiểm tra

Đã đối chiếu source app khách, định nghĩa RPC, quyền execute, policies chat và publication trên database thật.
Chưa sửa hoặc chạy app tài xế, chưa phát GPS/tin nhắn giả và chưa chuyển trạng thái đơn thật trong lượt này.
Không thay đổi schema hoặc dữ liệu nghiệp vụ trong lượt bàn giao này.

Tham khảo chính thức:
- Expo Location: https://docs.expo.dev/versions/latest/sdk/location/
- Supabase Postgres Changes (quyền đọc/RLS ảnh hưởng sự kiện): https://supabase.com/docs/guides/realtime/postgres-changes

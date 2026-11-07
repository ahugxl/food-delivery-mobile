# Nguồn báo cáo soopiFood — kiểm tra ngày 2026-11-07

Phạm vi: D:\TBDD\btl\food-delivery. Chỉ đọc, không sửa logic app.

- package.json: Expo, React Native, Expo Router, NativeWind, React Query, Zustand, FlashList, Supabase client.
- src/app/_layout.tsx: QueryClient staleTime 60_000; retry 1; protected routing; cache clear khi đổi user; khôi phục giỏ trước khi mở app.
- src/store/cartPersistence.ts: persist/createJSONStorage; validate bằng Zod; ownerId; ghi tuần tự và khôi phục giỏ.
- src/app/cart.tsx: FlashList.
- src/services/purchaseApi.ts: gọi create_food_order; gửi recipient, tọa độ, phí ship và hai voucher.
- src/hooks/useChatRealtime.ts: postgres_changes theo order_id, merge chống trùng; fallback refetch khi reconnect.
- src/hooks/useOrderTracking.ts: orders Realtime; tiến trình và GPS poll 5 giây khi foreground/đơn hoạt động.
- src/types/database.types.ts: 29 bảng dưới public.Tables; danh sách ở schema-tables.json. Không phải kiểm tra schema live.
- ai-service/src/main/java/vn/subifood/ai/FoodTools.java: @Tool searchFoods, IDs nhóm từ catalog, vector và recheck; giá, nhóm, mở cửa và bán kính 20 km.
- ai-service/src/main/java/vn/subifood/ai/RecommendationService.java: tool calling và stream tiếng Việt.
- ai-service/src/main/java/vn/subifood/ai/MenuIndexer.java: lập chỉ mục theo batch, có cờ cấu hình/quota.
- Ảnh màn hình: bản quay app thật từ OpenMontage ngày 2026-11-05; crop nguyên vùng điện thoại. Theo dõi trong demo có tài xế/GPS mô phỏng SQL, không lấy làm bằng chứng GPS thật.
- Bảng đóng góp: người dùng cung cấp trong cuộc trò chuyện. Không diễn giải là toàn bộ phân công dự án.
- Không chạy lại tests hay benchmark khi dựng slide; không đưa số lượng PASS hoặc số đo tốc độ vào slide.

Xác nhận thiết kế qua chat: người dùng chọn phương án 1 (xanh–trắng, sơ đồ và ảnh thật), 7 slide, 5 phút, notes, không voice/animation. UI xác nhận thiếu Flask nên dùng chat; không tạo result.json giả.

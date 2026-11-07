import { test, expect } from "@playwright/test";

test.describe("Luồng E2E Khách hàng & Xác minh PostHog Analytics", () => {
  // Biến lưu trữ toàn bộ event bóc tách từ network requests
  const capturedPosthogEvents: any[] = [];

  test.beforeEach(async ({ page }) => {
    // Lắng nghe và giải mã các request gửi đến PostHog
    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("posthog.com/e/") ||
        url.includes("posthog.com/batch/") ||
        url.includes("posthog.com/capture/")
      ) {
        const postData = request.postData();
        if (!postData) return;

        try {
          let payload;
          if (postData.startsWith("data=")) {
            // Xử lý Base64 URL-encoded (phổ biến ở PostHog Web SDK)
            const base64Data = decodeURIComponent(
              postData
                .split("&")
                .find((p) => p.startsWith("data="))
                ?.substring(5) || "",
            );
            const decoded = Buffer.from(base64Data, "base64").toString("utf-8");
            payload = JSON.parse(decoded);
          } else {
            // Xử lý chuẩn JSON
            payload = request.postDataJSON();
          }

          if (payload) {
            const batch = payload.batch || [payload];
            capturedPosthogEvents.push(...batch);
          }
        } catch (e) {
          console.error("Không thể parse payload từ PostHog:", e);
        }
      }
    });
  });

  test("Chạy luồng tìm kiếm, thêm vào giỏ, thanh toán và xác minh sự kiện", async ({
    page,
  }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
      test.skip(
        true,
        "BLOCKED: Thiếu TEST_USER_EMAIL hoặc TEST_USER_PASSWORD trong biến môi trường.",
      );
      return;
    }

    // 1. Mở app và đăng nhập
    await page.goto("/");
    // Tùy thuộc vào giao diện, tìm nút Đăng nhập hoặc form
    const emailInput = page.getByPlaceholder(/email|tài khoản/i).first();
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(email);

    const passwordInput = page.getByPlaceholder(/mật khẩu|password/i).first();
    await passwordInput.fill(password);

    await page.getByRole("button", { name: /đăng nhập|login/i }).click();

    // 2. Chờ chuyển tới trang chủ và xác minh UI
    // 2. Chờ chuyển tới trang chủ và xác minh UI
    // Sử dụng getByPlaceholder thay vì getByLabel để tương thích tốt nhất với React Native Web
    const searchInput = page.getByPlaceholder(/bạn đang thèm gì/i).first();

    // Tăng timeout lên 30 giây để đảm bảo API đăng nhập và Expo Router có đủ thời gian chuyển trang
    await searchInput.waitFor({ state: "visible", timeout: 30000 });

    // 3. Nhập từ khóa và chờ kết quả (kiểm tra tính năng debounce 1s)
    const testKeyword = "Cơm tấm";
    await searchInput.fill(testKeyword);
    // Chờ 1.5s để debounce UseSearchUsage kích hoạt analytics.searchSubmitted[cite: 2]
    await page.waitForTimeout(1500);

    // 4. Mở một quán đang mở cửa
    // Tránh click vào nhãn "Đóng cửa", ưu tiên các card có chứa thông tin món
    const restaurantCard = page
      .locator('[data-testid="restaurant-card"]')
      .filter({ hasNotText: /đóng cửa/i })
      .first();
    if ((await restaurantCard.count()) === 0) {
      test.fail(
        true,
        "FAIL: Không tìm thấy quán ăn nào đang mở cửa để tiếp tục luồng test.",
      );
    }
    await restaurantCard.click();

    // 5. Mở một món ăn và chọn
    const foodItem = page.locator('[data-testid="food-item"]').first();
    await foodItem.waitFor({ state: "visible" });
    await foodItem.click();

    // Chọn option nếu có (radio buttons, checkboxes)
    const radioOptions = page.getByRole("radio");
    if ((await radioOptions.count()) > 0) {
      await radioOptions.first().check();
    }

    // 6. Thêm vào giỏ
    const addToCartBtn = page.getByRole("button", {
      name: /thêm vào giỏ|add to cart/i,
    });
    await addToCartBtn.click();

    // Xác minh giỏ hàng cập nhật số lượng
    const cartBadge = page.locator('[data-testid="cart-badge"]');
    await expect(cartBadge).toBeVisible();
    await expect(cartBadge).not.toHaveText("0");

    // 7. Mở màn hình thanh toán
    const cartButton = page.getByRole("button", { name: /giỏ hàng|cart/i });
    await cartButton.click();

    const checkoutTitle = page.getByText(/thanh toán|checkout/i).first();
    await expect(checkoutTitle).toBeVisible();

    // 8. Kích hoạt flush PostHog Event
    // PostHog SDK có maxQueueSize 100 và flushInterval 30s.[cite: 1]
    // Sự kiện pagehide sẽ kích hoạt analytics.background() và ép SDK flush() ngay lập tức
    await page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    // Chờ một chút để network requests hoàn tất việc gửi
    await page.waitForTimeout(3000);

    // XÁC MINH ANALYTICS PASS/FAIL
    const events = capturedPosthogEvents.map((e) => e.event);

    // Yêu cầu phải có các sự kiện cốt lõi[cite: 3, 4]
    expect(events, "FAIL: Thiếu sự kiện app_opened").toContain("app_opened");
    expect(events, "FAIL: Thiếu sự kiện screen_viewed").toContain(
      "screen_viewed",
    );
    expect(events, "FAIL: Thiếu sự kiện search_submitted").toContain(
      "search_submitted",
    );
    expect(events, "FAIL: Thiếu sự kiện food_added_to_cart").toContain(
      "food_added_to_cart",
    );
    expect(events, "FAIL: Thiếu sự kiện checkout_started").toContain(
      "checkout_started",
    );

    // Yêu cầu KHÔNG chứa các sự kiện tạo đơn (bài test dừng ở Checkout)
    expect(
      events,
      "FAIL: Phát hiện event order_created (Bài test không được phép tạo đơn)",
    ).not.toContain("order_created");

    // Kiểm tra Properties chi tiết
    const screenViewEvents = capturedPosthogEvents.filter(
      (e) => e.event === "screen_viewed",
    );
    expect(
      screenViewEvents.some((e) => e.properties?.screen_name === "home"),
      "FAIL: Không ghi nhận được screen_name: home",
    ).toBeTruthy();
    expect(
      screenViewEvents.some((e) => e.properties?.screen_name === "checkout"),
      "FAIL: Không ghi nhận được screen_name: checkout",
    ).toBeTruthy();

    const searchEvents = capturedPosthogEvents.filter(
      (e) => e.event === "search_submitted",
    );
    expect(searchEvents.length).toBeGreaterThan(0);

    // Xác minh chuẩn cấu hình chung[cite: 1]
    for (const event of capturedPosthogEvents) {
      expect(event.properties?.app, "FAIL: app property không đúng chuẩn").toBe(
        "soopifood-customer",
      );
      expect(
        event.properties?.environment,
        "FAIL: environment không đúng chuẩn",
      ).toBe("development");

      // Đảm bảo Payload KHÔNG chứa dữ liệu nhạy cảm (PII)
      const stringifiedProps = JSON.stringify(event.properties || {});
      expect(stringifiedProps, "FAIL: Payload bị lộ Password").not.toContain(
        password,
      );
      expect(stringifiedProps, "FAIL: Payload bị lộ Email").not.toContain(
        email,
      );
      expect(
        stringifiedProps,
        "FAIL: Phát hiện nội dung từ khóa tìm kiếm trong Payload",
      ).not.toContain(testKeyword.toLowerCase());
    }
  });
});

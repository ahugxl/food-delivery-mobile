import { expect, test, type Request } from '@playwright/test';

type CapturedEvent = {
  event: string;
  properties?: Record<string, unknown>;
};

function eventsFromPayload(payload: unknown): CapturedEvent[] {
  if (Array.isArray(payload)) return payload.flatMap(eventsFromPayload);
  if (!payload || typeof payload !== 'object') return [];

  const value = payload as Record<string, unknown>;
  if (Array.isArray(value.batch)) return value.batch.flatMap(eventsFromPayload);
  if (typeof value.event === 'string') {
    return [{
      event: value.event,
      properties:
        value.properties && typeof value.properties === 'object'
          ? (value.properties as Record<string, unknown>)
          : undefined,
    }];
  }
  if (value.data !== undefined) return eventsFromPayload(value.data);
  return [];
}

function decodePostHogRequest(request: Request): CapturedEvent[] {
  const postData = request.postData();
  if (!postData) return [];

  try {
    return eventsFromPayload(JSON.parse(postData));
  } catch {
    // Some PostHog endpoints send a URL-encoded `data` field, often base64 encoded.
  }

  try {
    const encoded = new URLSearchParams(postData).get('data');
    if (!encoded) return [];

    try {
      return eventsFromPayload(JSON.parse(encoded));
    } catch {
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      return eventsFromPayload(JSON.parse(Buffer.from(base64, 'base64').toString('utf8')));
    }
  } catch {
    return [];
  }
}

test.describe('PostHog analytics qua luồng khách hàng', () => {
  test('ghi nhận tìm món, thêm giỏ và mở thanh toán mà không đặt đơn', async ({ page }) => {
    test.setTimeout(180_000);

    const email = process.env.TEST_USER_EMAIL?.trim();
    const password = process.env.TEST_USER_PASSWORD;
    test.skip(!email || !password, 'Cần TEST_USER_EMAIL và TEST_USER_PASSWORD để đăng nhập tài khoản kiểm thử.');

    const captured: CapturedEvent[] = [];
    page.on('request', request => {
      const url = request.url();
      if (!/posthog\.(com|eu)\//i.test(url) || !/\/(e|batch|capture)\//i.test(new URL(url).pathname)) return;
      captured.push(...decodePostHogRequest(request));
    });

    await page.goto('/');
    const homeSearch = page.getByPlaceholder(/bạn đang thèm gì/i).first();
    if (!(await homeSearch.isVisible().catch(() => false))) {
      await page.goto('/login');
      await page.getByPlaceholder(/email/i).first().fill(email!);
      await page.getByPlaceholder(/mật khẩu|password/i).first().fill(password!);
      await page.getByRole('button', { name: /đăng nhập/i }).click();
    }
    await expect(homeSearch).toBeVisible({ timeout: 45_000 });

    const keyword = process.env.ANALYTICS_TEST_QUERY?.trim() || 'cơm';
    await homeSearch.fill(keyword);

    // Chọn món từ kết quả tìm kiếm, tránh phụ thuộc vào tên quán hoặc ID cố định.
    const foodResult = page.getByRole('button', { name: /^xem món /i }).first();
    await expect(foodResult).toBeVisible({ timeout: 30_000 });
    await foodResult.click();

    // Chọn lựa chọn đầu tiên ở mỗi nhóm để thỏa các nhóm bắt buộc trước khi thêm giỏ.
    const optionRules = page.getByText(/^(Chọn 1|Chọn ít nhất 1|Chọn nhiều)$/);
    for (let index = 0; index < await optionRules.count(); index += 1) {
      const group = optionRules.nth(index).locator('xpath=../../..');
      const options = group.locator('[data-testid^="option-"]');
      if (await options.count() === 0) {
        throw new Error('Món kiểm thử có nhóm tùy chọn nhưng không có lựa chọn để hoàn tất. Hãy đổi ANALYTICS_TEST_QUERY.');
      }
      await options.first().click();
    }

    const addToCart = page.getByTestId('add-to-cart');
    await expect(addToCart).toBeEnabled({ timeout: 15_000 });
    await addToCart.click();

    const openCart = page.getByRole('button', { name: /mở giỏ hàng/i });
    await expect(openCart).toBeVisible({ timeout: 15_000 });
    await openCart.click();

    // Nút này chỉ mở bước checkout; tuyệt đối không nhấn nút xác nhận đặt hàng.
    const continueToCheckout = page.getByTestId('order-now');
    await expect(continueToCheckout).toBeEnabled({ timeout: 20_000 });
    await continueToCheckout.click();
    await expect(page).toHaveURL(/\/checkout(?:\?|$)/, { timeout: 20_000 });

    // PostHog flush theo lô/chu kỳ; chờ các sự kiện cần thiết được gửi qua network.
    await expect.poll(
      () => [...new Set(captured.map(item => item.event))],
      {
        timeout: 60_000,
        intervals: [1_000, 2_000, 3_000, 5_000],
        message: 'Không nhận đủ sự kiện PostHog. Kiểm tra project token, host và cấu hình analytics của Expo Web.',
      },
    ).toEqual(expect.arrayContaining([
      'app_opened',
      'screen_viewed',
      'search_submitted',
      'food_added_to_cart',
      'checkout_started',
    ]));

    const eventNames = captured.map(item => item.event);
    expect(eventNames).not.toContain('order_created');

    const screenViews = captured.filter(item => item.event === 'screen_viewed');
    expect(screenViews.some(item => item.properties?.screen_name === 'home')).toBe(true);
    expect(screenViews.some(item => item.properties?.screen_name === 'checkout')).toBe(true);

    const searchEvent = captured.find(item => item.event === 'search_submitted');
    expect(searchEvent?.properties?.source).toBe('home');
    expect(searchEvent?.properties?.query_length).toEqual(expect.any(Number));
    expect(searchEvent?.properties?.result_count).toEqual(expect.any(Number));
    expect(Number(searchEvent?.properties?.result_count)).toBeGreaterThan(0);

    const addedEvent = captured.find(item => item.event === 'food_added_to_cart');
    expect(addedEvent?.properties?.food_id).toEqual(expect.any(String));
    expect(addedEvent?.properties?.restaurant_id).toEqual(expect.any(String));
    expect(Number(addedEvent?.properties?.quantity)).toBeGreaterThan(0);
    expect(addedEvent?.properties?.currency).toBe('VND');

    const checkoutEvent = captured.find(item => item.event === 'checkout_started');
    expect(Number(checkoutEvent?.properties?.item_count)).toBeGreaterThan(0);
    expect(checkoutEvent?.properties?.currency).toBe('VND');

    // Chỉ kiểm tra properties thu thập được; không in request body hoặc thông tin đăng nhập ra log.
    for (const item of captured) {
      expect(item.properties?.app).toBe('soopifood-customer');
      expect(item.properties?.event_version).toBe(1);
      const properties = JSON.stringify(item.properties ?? {});
      expect(properties).not.toContain(email!);
      expect(properties).not.toContain(password!);
      expect(properties.toLocaleLowerCase('vi')).not.toContain(keyword.toLocaleLowerCase('vi'));
    }
  });
});

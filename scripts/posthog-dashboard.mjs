// Chart definitions are shared by the provisioning script and its dry run.
// Production and development charts are separated by an explicit event property.
export function usageDashboard(environment = 'production') {
  const property = (key, value) => ({ key, value: [value], operator: 'exact', type: 'event' });
  const properties = [property('app', 'soopifood-customer'), property('environment', environment)];
  const series = (event, math = 'total', extra = {}) => ({ kind: 'EventsNode', event, math, ...extra });
  const trend = (name, eventSeries, extra = {}, description = '') => ({
    name, description,
    query: { kind: 'InsightVizNode', source: { kind: 'TrendsQuery',
      dateRange: { date_from: '-30d' }, interval: 'day', properties,
      series: eventSeries, trendsFilter: { display: 'ActionsLineGraph' }, ...extra } },
  });
  return {
    name: `soopiFood · Sử dụng ứng dụng · ${environment}`,
    description: 'Theo dõi hành vi app khách. Sự kiện từ thiết bị có thể thiếu khi offline hoặc bị chặn; số đơn/doanh thu chính thức lấy từ Supabase. DAU/MAU chỉ tính tài khoản đã đăng nhập. Không phải kiểm thử tải.',
    insights: [
      trend('01 · Lượt mở app / phiên mới', [series('app_opened')], {},
        'Khởi động app hoặc quay lại sau ít nhất 30 phút ở nền. Không phải số lần HTTP request.'),
      trend('02 · Người dùng hoạt động mỗi ngày (DAU)', [series('screen_viewed', 'dau',
        { properties: [property('authenticated', true)] })], {}, 'Tài khoản đăng nhập duy nhất có xem màn hình trong ngày.'),
      trend('03 · Người dùng hoạt động mỗi tháng (MAU)', [series('screen_viewed', 'dau',
        { properties: [property('authenticated', true)] })],
        { interval: 'month', dateRange: { date_from: '-6m' } }, 'Số tài khoản đăng nhập duy nhất theo tháng lịch; không phải tổng các DAU.'),
      trend('04 · Màn hình được truy cập', [series('screen_viewed')],
        { breakdownFilter: { breakdowns: [{ property: 'screen_name', type: 'event' }] } }),
      trend('05 · Lượt tìm kiếm', [series('search_submitted')],
        { breakdownFilter: { breakdowns: [{ property: 'source', type: 'event' }] } },
        'Ghi khi từ khóa ổn định 1 giây và đã có kết quả. Không gửi nội dung từ khóa.'),
      trend('06 · Thêm giỏ, mở thanh toán và tạo đơn', [
        series('food_added_to_cart'), series('checkout_started'), series('order_created'),
      ], {}, 'Tạo đơn chỉ ghi sau khi RPC trả thành công. Đây là số sự kiện, không phải số người.'),
      {
        name: '07 · Chuyển đổi từ giỏ đến đơn hàng',
        description: 'Số người thực hiện tuần tự ba bước trong 1 ngày. Không bắt buộc tìm kiếm vì khách có thể chọn món từ quán.',
        query: { kind: 'InsightVizNode', source: { kind: 'FunnelsQuery',
          dateRange: { date_from: '-30d' }, properties,
          series: ['food_added_to_cart', 'checkout_started', 'order_created'].map(event => ({ kind: 'EventsNode', event })),
          funnelsFilter: { funnelWindowInterval: 1, funnelWindowIntervalUnit: 'day', funnelOrderType: 'ordered', funnelVizType: 'steps' },
        } },
      },
    ],
  };
}

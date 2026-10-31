const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const { deliveryProgressView, DELIVERY_STEPS, DELIVERY_MILESTONES, deliveryMilestoneProgress } = require('../src/features/order/deliveryProgress.ts');
const { createDriverApi } = require('../src/services/driverApi.ts');
const snapshot = (status, order_status='preparing', driver_id='driver') => ({ order_status,driver_id,assignment_id:'assignment',delivery_status:status,updated_at:null });

test('customer sees each driver action even when the coarse order status stays unchanged', () => {
  for (const [status,coarse,index] of [['offered','preparing',0],['accepted','preparing',1],['at_restaurant','preparing',2],['picked_up','delivering',3],['at_customer','delivering',4],['delivered','completed',5]]) {
    assert.deepEqual(deliveryProgressView({status:coarse,driver_id:'driver'},snapshot(status,coarse)),{label:DELIVERY_STEPS[index],step:index});
  }
});

test('old driver, old order snapshot and failed progress requests cannot display a stale stage', () => {
  const order={status:'delivering',driver_id:'new-driver'};
  assert.equal(deliveryProgressView(order,snapshot('at_customer','delivering','old-driver')).step,null);
  assert.equal(deliveryProgressView(order,snapshot('at_restaurant','preparing','new-driver')).step,null);
  assert.equal(deliveryProgressView(order,null).label,'Đang giao hàng');
  assert.equal(deliveryProgressView({status:'cancelled',driver_id:'driver'},snapshot('at_customer','delivering')).label,'Đơn hàng đã hủy');
  assert.equal(deliveryProgressView({status:'completed',driver_id:'driver'},snapshot('at_customer','delivering')).step,null);
  assert.equal(deliveryProgressView({status:'completed',driver_id:null},null).label,'Giao hàng thành công');
});

test('unassigned and failed trips have explicit customer labels without claiming a successful delivery', () => {
  assert.match(deliveryProgressView({status:'preparing',driver_id:null},null).label,/chờ phân công/);
  assert.match(deliveryProgressView({status:'preparing',driver_id:'driver'},snapshot('failed')).label,/hỗ trợ/);
  assert.equal(deliveryProgressView({status:'pending',driver_id:null},null).step,null);
});

test('four-milestone bar does not mark arrival until the driver confirms it', () => {
  assert.equal(DELIVERY_MILESTONES.length, 4);
  const enRoute = deliveryProgressView({status:'preparing',driver_id:'driver'}, snapshot('accepted'));
  assert.equal(enRoute.label, 'Tài xế đang đến quán');
  assert.deepEqual(deliveryMilestoneProgress(enRoute.step), {position:0.5,completed:1});
  assert.equal(deliveryMilestoneProgress(2).completed, 2);
  const delivering = deliveryProgressView({status:'delivering',driver_id:'driver'}, snapshot('picked_up','delivering'));
  assert.equal(delivering.label, 'Tài xế đang giao hàng');
  assert.deepEqual(deliveryMilestoneProgress(delivering.step), {position:1.5,completed:2});
  assert.equal(deliveryMilestoneProgress(4).completed, 3);
  assert.equal(deliveryMilestoneProgress(5).completed, 4);
  for (const step of [null, undefined, 0, -1, 10]) assert.equal(deliveryMilestoneProgress(step).completed, 0);
});

test('progress API calls the customer projection RPC instead of selecting private assignment rows', async () => {
  let request;
  const result=snapshot('at_customer','delivering');
  const client=createClient('https://progress.test.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
    if (init.signal?.aborted) throw new DOMException('Aborted','AbortError');
    request={url:new URL(url),body:JSON.parse(init.body)};
    return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});
  }}});
  assert.deepEqual(await createDriverApi(client).progressForOrder('order'),result);
  assert.equal(request.url.pathname,'/rest/v1/rpc/order_delivery_progress');
  assert.deepEqual(request.body,{p_order_id:'order'});
  const abort=new AbortController();abort.abort();
  await assert.rejects(createDriverApi(client).progressForOrder('order',abort.signal));
  await assert.rejects(createDriverApi(client).progressForOrder(''),/chọn đơn/);
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseDatabase } from "../types/supabase";
import type { Database } from "../types/database.types";
import type { CartItem } from "../types";
import { createPurchaseApi } from "./purchaseApi";
import {
  cartSubtotal,
  voucherError,
  voucherTarget,
} from "../features/order/purchase";

export type Voucher = Database["public"]["Tables"]["vouchers"]["Row"];
export type WalletEntry = Pick<
  Database["public"]["Tables"]["user_vouchers"]["Row"],
  "user_id" | "voucher_id" | "is_used"
>;
export const voucherKeys = {
  campaign: ["vouchers", "campaign"] as const,
  bannerCampaign: (bannerId?: string) =>
    ["vouchers", "campaign", bannerId ?? "all"] as const,
  owned: (userId?: string) => ["vouchers", "owned", userId] as const,
  wallet: (userId?: string) => ["vouchers", "wallet", userId] as const,
  usedWallet: (userId?: string) => ["vouchers", "used-wallet", userId] as const,
};

export function collectionError(
  voucher: Voucher,
  now = Date.now(),
): string | null {
  if (!["food", "shipping"].includes(voucherTarget(voucher)))
    return "Chưa khả dụng";
  if (
    !voucher.is_active ||
    (voucher.expiry_date !== null &&
      (!Number.isFinite(Date.parse(voucher.expiry_date)) ||
        Date.parse(voucher.expiry_date) <= now))
  )
    return "Cháy hàng";
  if (
    !["fixed", "percentage"].includes(voucher.discount_type) ||
    !Number.isFinite(voucher.discount_value) ||
    voucher.discount_value < 0 ||
    (voucher.discount_type === "percentage" && voucher.discount_value > 100)
  )
    return "Chưa khả dụng";
  return null;
}

export function createVoucherApi(
  client: SupabaseClient<SupabaseDatabase> | null,
) {
  function db() {
    if (!client) throw new Error("Chưa cấu hình kết nối Supabase.");
    return client;
  }
  async function requireUser(userId: string) {
    const { data, error } = await db().auth.getUser();
    if (error) throw error;
    if (!userId || data.user?.id !== userId)
      throw new Error(
        "Phiên đăng nhập đã thay đổi. Vui lòng mở lại ví voucher.",
      );
  }
  async function collect(userId: string, voucherId: string): Promise<Voucher> {
    await requireUser(userId);
    const { data, error } = await db()
      .rpc("collect_my_voucher", { p_voucher_id: voucherId })
      .single();
    if (error) throw error;
    if (!data)
      throw new Error("Chưa nhận được xác nhận thu thập mã. Vui lòng thử lại.");
    return data;
  }
  return {
    async campaign(
      signal?: AbortSignal,
      bannerId?: string,
    ): Promise<Voucher[]> {
      if (bannerId !== undefined) {
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            bannerId,
          )
        )
          throw Error("Banner ưu đãi không hợp lệ.");
        const query = db()
          .from("banner_vouchers")
          .select("voucher:vouchers!voucher_id(*)")
          .eq("banner_id", bannerId)
          .order("position");
        const { data, error } = await (signal
          ? query.abortSignal(signal)
          : query);
        if (error) throw error;
        return (data ?? []).flatMap((entry) =>
          entry.voucher && !entry.voucher.reward_owner_id
            ? [entry.voucher]
            : [],
        );
      }
      const query = db()
        .from("vouchers")
        .select("*")
        .is("reward_owner_id", null)
        .order("code");
      const { data, error } = await (signal
        ? query.abortSignal(signal)
        : query);
      if (error) throw error;
      return data ?? [];
    },
    async owned(userId: string, signal?: AbortSignal): Promise<WalletEntry[]> {
      const query = db()
        .from("user_vouchers")
        .select("user_id,voucher_id,is_used")
        .eq("user_id", userId);
      const { data, error } = await (signal
        ? query.abortSignal(signal)
        : query);
      if (error) throw error;
      return data ?? [];
    },
    async wallet(userId: string, signal?: AbortSignal): Promise<Voucher[]> {
      // Explicit FK column avoids relying on a generated constraint name.
      const query = db()
        .from("user_vouchers")
        .select("voucher:vouchers!voucher_id(*)")
        .eq("user_id", userId)
        .eq("is_used", false);
      const { data, error } = await (signal
        ? query.abortSignal(signal)
        : query);
      if (error) throw error;
      return (data ?? []).flatMap((entry) =>
        entry.voucher ? [entry.voucher] : [],
      );
    },
    async usedWallet(userId: string, signal?: AbortSignal): Promise<Voucher[]> {
      const query = db()
        .from("user_vouchers")
        .select("voucher:vouchers!voucher_id(*)")
        .eq("user_id", userId)
        .eq("is_used", true)
        .order("collected_at", { ascending: false });
      const { data, error } = await (signal
        ? query.abortSignal(signal)
        : query);
      if (error) throw error;
      return (data ?? []).flatMap((entry) =>
        entry.voucher ? [entry.voucher] : [],
      );
    },
    // RPC inserts only auth.uid(); duplicate collection never resets is_used.
    collect,
    async collectForOrder(
      userId: string,
      code: string,
      items: CartItem[],
    ): Promise<Voucher> {
      const checked = await createPurchaseApi(client).checkVoucher(code, items);
      const current = await collect(userId, checked.id);
      const reason = voucherError(
        current,
        cartSubtotal(items),
        items[0]?.restaurantId ?? "",
      );
      if (reason) throw new Error(reason);
      return current;
    },
  };
}

/**
 * trigger-geofence — Step 8 Spec 01
 *
 * iOS UPGeofence native module이 CLRegion 진입 감지 시 호출.
 * 1. JWT 검증 → user_id 추출
 * 2. 해당 store의 활성 wallet coupon 조회 (RLS 우회: service_role)
 * 3. 유저 push token 조회 → Expo Push API 발송
 * 4. live_activity_event INSERT (started)
 *
 * Secrets (supabase secrets set ...):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  ← auto-injected by Supabase
 *   GEOFENCE_SHARED_SECRET                   ← 앱 → 함수 호출 인증용 추가 비밀
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")            ?? "";
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEOFENCE_SHARED_SECRET  = Deno.env.get("GEOFENCE_SHARED_SECRET")  ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-geofence-secret",
};

// ── Expo Push API 발송 ───────────────────────────────────────────
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  categoryId?: string;
  _contentAvailable?: boolean;
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (!messages.length) return;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip" },
      body: JSON.stringify(messages),
    });
    const json = await res.json();
    console.log("[trigger-geofence] expo-push response:", JSON.stringify(json).slice(0, 300));
  } catch (e) {
    console.error("[trigger-geofence] expo-push error:", e);
  }
}

// ── 메인 ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // ── 1. 추가 비밀 헤더 검증 (앱 → 엣지 호출 인증) ───────────────
  const secret = req.headers.get("x-geofence-secret") ?? "";
  if (GEOFENCE_SHARED_SECRET && secret !== GEOFENCE_SHARED_SECRET) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── 2. JWT에서 user_id 추출 ─────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(
      JSON.stringify({ error: "missing authorization" }),
      { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // service_role 클라이언트 (RLS 우회)
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // JWT 검증 → uid
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user?.id) {
    return new Response(
      JSON.stringify({ error: "invalid token" }),
      { status: 401, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
  const userId = user.id;

  // ── 3. 바디 파싱 ────────────────────────────────────────────────
  let body: {
    store_id: string;
    store_name?: string;
    store_emoji?: string;
    distance_m?: number;
    lat?: number;
    lng?: number;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "invalid json" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const { store_id, store_name, store_emoji, distance_m, lat, lng } = body;
  if (!store_id) {
    return new Response(
      JSON.stringify({ error: "store_id required" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  console.log(`[trigger-geofence] user=${userId} store=${store_id} dist=${distance_m}m`);

  // ── 4. 해당 유저 × 매장의 활성 wallet 쿠폰 조회 ─────────────────
  const { data: coupons, error: couponErr } = await admin
    .from("user_coupons")
    .select(`
      id,
      coupon_id,
      coupons!inner (
        id,
        title,
        discount_type,
        discount_value,
        expires_at,
        store_id
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("coupons.store_id", store_id)
    .gt("coupons.expires_at", new Date().toISOString())
    .limit(3);

  if (couponErr) {
    console.error("[trigger-geofence] coupon query error:", couponErr);
  }

  const hasCoupons = (coupons?.length ?? 0) > 0;
  const firstCoupon = coupons?.[0] as any;

  // ── 5. 하루 알림 횟수 체크 (daily_cap 기본 3) ────────────────────
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { count: todayCount } = await admin
    .from("live_activity_event")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "started")
    .gte("created_at", `${today}T00:00:00Z`);

  const { data: locationSetting } = await admin
    .from("user_location_setting")
    .select("enabled, daily_cap, quiet_start, quiet_end")
    .eq("user_id", userId)
    .maybeSingle();

  const dailyCap = locationSetting?.daily_cap ?? 3;
  const enabled  = locationSetting?.enabled ?? true;

  if (!enabled) {
    return new Response(
      JSON.stringify({ skipped: "discovery_disabled" }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  if ((todayCount ?? 0) >= dailyCap) {
    return new Response(
      JSON.stringify({ skipped: "daily_cap_reached", count: todayCount, cap: dailyCap }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── 5b. 방해금지 시간 체크 ──────────────────────────────────────
  const nowHour = new Date().getHours(); // UTC 기준 (KST = UTC+9)
  const quietStart = parseInt((locationSetting?.quiet_start ?? "22:00").split(":")[0]);
  const quietEnd   = parseInt((locationSetting?.quiet_end   ?? "09:00").split(":")[0]);
  const kstHour = (nowHour + 9) % 24;
  const isQuiet = quietStart > quietEnd
    ? kstHour >= quietStart || kstHour < quietEnd   // 22:00 – 09:00 (다음날)
    : kstHour >= quietStart && kstHour < quietEnd;

  if (isQuiet) {
    return new Response(
      JSON.stringify({ skipped: "quiet_hours", kst_hour: kstHour }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── 6. live_activity_event INSERT ──────────────────────────────
  const { error: evtErr } = await admin
    .from("live_activity_event")
    .insert({
      user_id:        userId,
      store_id:       store_id,
      user_coupon_id: firstCoupon?.id ?? null,
      event_type:     "started",
      payload: {
        store_name:    store_name ?? "매장",
        store_emoji:   store_emoji ?? "🏪",
        distance_m:    distance_m ?? 0,
        coupon_count:  coupons?.length ?? 0,
        coupon_title:  firstCoupon?.coupons?.title ?? null,
        lat, lng,
      },
    });

  if (evtErr) {
    console.error("[trigger-geofence] event insert error:", evtErr);
  }

  // ── 7. Expo Push 토큰 조회 ──────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("expo_push_token")
    .eq("id", userId)
    .maybeSingle();

  const pushToken: string | null = (profile as any)?.expo_push_token ?? null;

  if (pushToken && hasCoupons) {
    const couponLabel = firstCoupon?.coupons?.title ?? "쿠폰";
    const countLabel  = (coupons?.length ?? 1) > 1 ? ` 외 ${(coupons?.length ?? 1) - 1}개` : "";
    const emoji       = store_emoji ?? "🏪";
    const distLabel   = distance_m ? `${distance_m}m 앞` : "근처";

    await sendExpoPush([{
      to:    pushToken,
      title: `${emoji} ${store_name ?? "매장"} ${distLabel}`,
      body:  `${couponLabel}${countLabel} 쿠폰을 사용해보세요!`,
      data:  {
        type:     "geofence",
        store_id,
        coupon_count: coupons?.length ?? 0,
      },
      sound:    "default",
      categoryId: "GEOFENCE_COUPON",
    }]);
  }

  return new Response(
    JSON.stringify({
      ok:             true,
      has_coupons:    hasCoupons,
      coupon_count:   coupons?.length ?? 0,
      push_sent:      !!(pushToken && hasCoupons),
    }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});

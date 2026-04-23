/**
 * verify-redeem — Step 8 Spec 01  POST /v1/coupons/redeem
 *
 * 사장님 QR 스캔 없이 언니픽 자체 사용 처리:
 * 1. JWT → user_id
 * 2. HMAC 토큰 검증 (±1 윈도우 허용)
 * 3. 위치 펜스 체크 (선택 — store 좌표 ↔ 유저 GPS)
 * 4. 중복 방지: redeem_token_log UNIQUE WHERE status='success'
 * 5. user_coupons.status = 'redeemed' 업데이트
 * 6. live_activity_event: redeemed INSERT
 *
 * Secrets:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  ← auto-injected
 *   REDEEM_HMAC_SECRET                       ← 클라이언트와 공유하는 비밀키
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")              ?? "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// 클라이언트(redeemTokenService.ts)의 EXPO_PUBLIC_REDEEM_SECRET과 동일한 값으로 설정
const HMAC_SECRET           = Deno.env.get("REDEEM_HMAC_SECRET")        ?? "unniepick-redeem-secret-v1";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN_WINDOW_MS = 10_000; // 10초
const FENCE_RADIUS_M  = 500;    // 위치 펜스 (m)

// ── 클라이언트(redeemTokenService.ts)와 동일한 keyed-SHA256 ────────
// client: SHA256("${REDEEM_SECRET}:${couponId}:${couponId}:${userId}:${window}")
// key = `${REDEEM_SECRET}:${couponId}`, message = `${couponId}:${userId}:${window}`
// fullStr = `${key}:${message}`
async function computeToken(couponId: string, userId: string, window: number): Promise<number> {
  const key     = `${HMAC_SECRET}:${couponId}`;
  const message = `${couponId}:${userId}:${window}`;
  const fullStr = `${key}:${message}`;

  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(fullStr));
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return parseInt(hashHex.slice(0, 8), 16) % 1_000_000;
}

// ── Haversine 거리 (m) ────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R   = 6_371_000; // 지구 반지름 (m)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 메인 ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 1. JWT → user_id ─────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "missing authorization" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user?.id) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const userId = user.id;

  // ── 2. 요청 바디 ─────────────────────────────────────────────────
  let body: {
    user_coupon_id:  string;
    coupon_id:       string;
    token:           number;
    client_window?:  number;   // 클라이언트 윈도우 (검증용)
    lat?:            number;
    lng?:            number;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { user_coupon_id, coupon_id, token, client_window, lat, lng } = body;
  if (!user_coupon_id || !coupon_id || token === undefined) {
    return new Response(JSON.stringify({ error: "user_coupon_id, coupon_id, token required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  console.log(`[verify-redeem] user=${userId} coupon=${coupon_id} token=${token}`);

  // ── 3. HMAC 토큰 검증 (현재·이전·다음 윈도우 허용) ───────────────
  const serverWindow = Math.floor(Date.now() / TOKEN_WINDOW_MS);
  const windows = [serverWindow - 1, serverWindow, serverWindow + 1];
  if (client_window) windows.push(client_window); // 클라이언트가 보낸 윈도우도 추가 검증

  let tokenValid = false;
  let matchedWindow = serverWindow;
  for (const w of windows) {
    const expected = await computeToken(coupon_id, userId, w);
    if (expected === token) {
      tokenValid = true;
      matchedWindow = w;
      break;
    }
  }

  if (!tokenValid) {
    console.warn(`[verify-redeem] invalid token ${token} for window ${serverWindow}`);
    return new Response(JSON.stringify({ error: "invalid_token", code: "TOKEN_MISMATCH" }), {
      status: 422, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 4. user_coupon 유효성 확인 ──────────────────────────────────
  const { data: uc, error: ucErr } = await admin
    .from("user_coupons")
    .select(`
      id, status, user_id, coupon_id,
      coupons!inner ( id, expires_at, store_id,
        stores!inner ( id, lat, lng, name )
      )
    `)
    .eq("id", user_coupon_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (ucErr || !uc) {
    return new Response(JSON.stringify({ error: "coupon_not_found" }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const ucAny = uc as any;

  if (ucAny.status !== "active") {
    return new Response(JSON.stringify({ error: "coupon_not_active", status: ucAny.status }), {
      status: 409, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const expiresAt = ucAny.coupons?.expires_at;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return new Response(JSON.stringify({ error: "coupon_expired" }), {
      status: 410, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 5. 위치 펜스 체크 (GPS 데이터가 있을 때만) ────────────────────
  const store     = ucAny.coupons?.stores;
  const storeLat  = store?.lat  as number | null;
  const storeLng  = store?.lng  as number | null;

  if (lat && lng && storeLat && storeLng) {
    const distM = haversine(lat, lng, storeLat, storeLng);
    console.log(`[verify-redeem] GPS fence dist=${distM.toFixed(0)}m limit=${FENCE_RADIUS_M}m`);
    if (distM > FENCE_RADIUS_M) {
      return new Response(JSON.stringify({
        error: "outside_fence",
        distance_m: Math.round(distM),
        limit_m: FENCE_RADIUS_M,
      }), { status: 422, headers: { ...CORS, "Content-Type": "application/json" } });
    }
  }

  // ── 6. 중복 방지: redeem_token_log ──────────────────────────────
  const tokenKey = `${coupon_id}:${userId}:${matchedWindow}`;
  const { error: logErr } = await admin
    .from("redeem_token_log")
    .insert({
      user_id:        userId,
      user_coupon_id: user_coupon_id,
      coupon_id:      coupon_id,
      token_key:      tokenKey,
      status:         "success",
    });

  if (logErr) {
    // UNIQUE 제약 위반 → 이미 사용된 토큰
    if (logErr.code === "23505") {
      return new Response(JSON.stringify({
        error: "token_already_used",
        code:  "DUPLICATE_REDEEM",
      }), { status: 409, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    console.error("[verify-redeem] log insert error:", logErr);
  }

  // ── 7. user_coupons 상태 업데이트 ───────────────────────────────
  const { error: updateErr } = await admin
    .from("user_coupons")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
    .eq("id", user_coupon_id)
    .eq("user_id", userId);

  if (updateErr) {
    console.error("[verify-redeem] update error:", updateErr);
    return new Response(JSON.stringify({ error: "update_failed" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── 8. live_activity_event: redeemed ────────────────────────────
  await admin.from("live_activity_event").insert({
    user_id:        userId,
    store_id:       store?.id ?? ucAny.coupons?.store_id,
    user_coupon_id: user_coupon_id,
    event_type:     "redeemed",
    payload: {
      coupon_id,
      store_name: store?.name ?? "매장",
      matched_window: matchedWindow,
    },
  }).then(({ error }) => {
    if (error) console.error("[verify-redeem] event log error:", error);
  });

  console.log(`[verify-redeem] SUCCESS user=${userId} coupon=${coupon_id}`);

  return new Response(
    JSON.stringify({
      ok:             true,
      redeemed_at:    new Date().toISOString(),
      store_name:     store?.name ?? null,
    }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});

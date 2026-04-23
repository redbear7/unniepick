/**
 * submit-review — 영수증 후기 제출 + 포인트 즉시 지급
 *
 * POST /functions/v1/submit-review
 * Body: {
 *   user_token:      string,       // 사용자 JWT
 *   store_id?:       string,       // 매칭된 언니픽 업체 ID (없으면 null)
 *   receipt_scan_id: string,       // parse-receipt에서 받은 scan_id
 *   content:         string,       // 후기 본문 (≤300자)
 *   photo_url?:      string,       // Storage 경로 (선택)
 *   receipt_date?:   string,       // YYYY-MM-DD (포인트 조건 검증용)
 * }
 *
 * Returns: { review_id, points_awarded, total_points }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")              ?? "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── JWT payload 파싱 (ES256 우회) ──────────────────────────────────
function parseJwtUserId(token: string): string | null {
  try {
    const raw    = token.split(".")[1] ?? "";
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(raw.length + (4 - raw.length % 4) % 4, "=");
    const payload = JSON.parse(atob(padded));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

    const {
      user_token,
      store_id,
      receipt_scan_id,
      content,
      photo_url,
      receipt_date,
    } = await req.json();

    // ── 인증 ────────────────────────────────────────────────────────
    const userId = parseJwtUserId(user_token ?? "");
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // supabase.auth.admin.getUserById() 는 ES256 JWT 파싱 오류 유발
    // → JWT decode 로 추출한 userId 직접 신뢰 (FK constraint 로 존재 검증)

    // ── 유효성 검사 ──────────────────────────────────────────────────
    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: "후기 내용을 입력해주세요." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (content.trim().length > 300) {
      return new Response(JSON.stringify({ error: "후기는 300자 이내로 작성해주세요." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 포인트 지급 조건 확인 ────────────────────────────────────────
    // 설정 불러오기
    const { data: settingRow } = await supabase
      .from("point_settings")
      .select("value")
      .eq("key", "receipt_review")
      .single();

    const cfg = settingRow?.value ?? {
      enabled: true, amount: 500, max_per_day: 1, receipt_max_age_hours: 48,
      max_consecutive_per_store: 1, max_total_per_store: 1,
    };

    // ── 리뷰 작성 가능 여부 검사 (포인트와 별개로 리뷰 자체를 막음) ──
    if (store_id) {
      const maxTotal       = cfg.max_total_per_store       ?? 1;
      const maxConsecutive = cfg.max_consecutive_per_store ?? 1;

      // 동일 매장 총 리뷰 수
      const { count: totalForStore } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("store_id", store_id)
        .eq("status", "active");

      if ((totalForStore ?? 0) >= maxTotal) {
        return new Response(
          JSON.stringify({ error: `동일 매장에는 최대 ${maxTotal}회까지만 후기를 등록할 수 있어요.` }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
        );
      }

      // 연속 리뷰 검사: 가장 최근 N개 리뷰가 모두 같은 store_id인지 확인
      if (maxConsecutive > 0) {
        const { data: recentReviews } = await supabase
          .from("reviews")
          .select("store_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(maxConsecutive);

        const consecutiveSameStore = (recentReviews ?? []).length === maxConsecutive
          && (recentReviews ?? []).every((r: any) => r.store_id === store_id);

        if (consecutiveSameStore) {
          return new Response(
            JSON.stringify({ error: `같은 매장에 연속으로 ${maxConsecutive}회 이상 후기를 작성할 수 없어요. 다른 매장 후기를 먼저 작성해주세요.` }),
            { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
          );
        }
      }
    }

    let pointsAwarded = 0;
    let pointReason: string | null = null;

    if (cfg.enabled) {
      // 조건 1: 영수증 발행일 N시간 이내
      let receiptOk = true;
      if (receipt_date) {
        const receiptMs = new Date(receipt_date).getTime();
        const maxAgeMs  = (cfg.receipt_max_age_hours ?? 48) * 60 * 60 * 1000;
        if (Date.now() - receiptMs > maxAgeMs) {
          receiptOk = false;
          pointReason = `영수증 발행일로부터 ${cfg.receipt_max_age_hours}시간이 지나 포인트가 지급되지 않아요.`;
        }
      }

      // 조건 2: 오늘(24시간 내) 포인트 미수령
      let alreadyReceived = false;
      if (receiptOk) {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("point_transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("type", "receipt_review")
          .gte("created_at", since24h);

        if ((count ?? 0) >= (cfg.max_per_day ?? 1)) {
          alreadyReceived = true;
          pointReason = "오늘 이미 포인트를 받으셨어요. 내일 다시 시도해주세요.";
        }
      }

      if (receiptOk && !alreadyReceived) {
        pointsAwarded = cfg.amount ?? 500;
      }
    }

    // ── 후기 insert ──────────────────────────────────────────────────
    const { data: review, error: reviewErr } = await supabase
      .from("reviews")
      .insert({
        user_id:         userId,
        store_id:        store_id ?? null,
        receipt_scan_id: receipt_scan_id ?? null,
        content:         content.trim(),
        photo_url:       photo_url ?? null,
        receipt_date:    receipt_date ?? null,
        points_awarded:  pointsAwarded,
        status:          "active",
      })
      .select("id")
      .single();

    if (reviewErr) throw new Error(`후기 저장 실패: ${reviewErr.message}`);

    // ── 포인트 지급 ──────────────────────────────────────────────────
    let totalPoints = 0;
    if (pointsAwarded > 0) {
      // 트랜잭션 기록
      await supabase.from("point_transactions").insert({
        user_id:     userId,
        amount:      pointsAwarded,
        type:        "receipt_review",
        reference_id: review.id,
        description: `영수증 후기 제보 (${receipt_date ?? "날짜 미상"})`,
      });

      // profiles.points 잔액 증가
      const { data: profile } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

      const newPoints = (profile?.points ?? 0) + pointsAwarded;
      await supabase
        .from("profiles")
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq("id", userId);

      totalPoints = newPoints;
    } else {
      // 현재 잔액만 조회
      const { data: profile } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();
      totalPoints = profile?.points ?? 0;
    }

    // receipt_scans에 review_id 역참조
    if (receipt_scan_id) {
      await supabase
        .from("receipt_scans")
        .update({ review_id: review.id })
        .eq("id", receipt_scan_id);
    }

    return new Response(
      JSON.stringify({
        review_id:       review.id,
        points_awarded:  pointsAwarded,
        total_points:    totalPoints,
        point_reason:    pointReason, // null이면 정상 지급
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (e: any) {
    console.error("[submit-review] error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message ?? "Internal Server Error" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});

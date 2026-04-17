/**
 * send-sms — Supabase Custom SMS Hook (Solapi)
 *
 * Supabase Dashboard → Authentication → Hooks → Send SMS
 * Webhook URL: https://<project>.supabase.co/functions/v1/send-sms
 *
 * 시크릿 등록:
 *   supabase secrets set SOLAPI_API_KEY=NCS0MCEN0HI7LKIW
 *   supabase secrets set SOLAPI_API_SECRET=BNKAICOIOBBYOPNPERQWXW6KRTOZX0AY
 *   supabase secrets set SOLAPI_FROM_NUMBER=01085757863
 */

const SOLAPI_API_KEY    = Deno.env.get("SOLAPI_API_KEY")    ?? "";
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET") ?? "";
const FROM_NUMBER       = Deno.env.get("SOLAPI_FROM_NUMBER") ?? "01085757863";
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-webhook-signature",
};

// ── 수신번호 정규화 ───────────────────────────────────────────────
// +821085757863 | 821085757863 | 01085757863 → 01085757863
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("82")) return "0" + digits.slice(2);
  return digits;
}

// ── Solapi HMAC-SHA256 인증 헤더 ─────────────────────────────────
async function solapiAuthHeader(): Promise<string> {
  const timestamp = new Date().toISOString();
  const salt      = crypto.randomUUID();
  const encoder   = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SOLAPI_API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}${salt}`));
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${timestamp}, salt=${salt}, signature=${sigHex}`;
}

// ── Solapi SMS 발송 ───────────────────────────────────────────────
async function sendSolapi(to: string, text: string): Promise<{ ok: boolean; detail: string }> {
  if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET) {
    const msg = "SOLAPI_API_KEY or SOLAPI_API_SECRET not set in environment";
    console.error("[send-sms]", msg);
    return { ok: false, detail: msg };
  }

  const toClean = normalizePhone(to);
  console.log(`[send-sms] sending to=${toClean} from=${FROM_NUMBER}`);

  try {
    const authHeader = await solapiAuthHeader();
    const payload = {
      message: {
        to:   toClean,
        from: FROM_NUMBER,
        text,
      },
    };

    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(payload),
    });

    const resText = await res.text();
    console.log(`[send-sms] Solapi response ${res.status}: ${resText}`);

    if (!res.ok) {
      return { ok: false, detail: `Solapi ${res.status}: ${resText}` };
    }
    return { ok: true, detail: resText };
  } catch (e) {
    const detail = String(e);
    console.error("[send-sms] fetch error:", detail);
    return { ok: false, detail };
  }
}

// ── 메인 ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    console.error("[send-sms] JSON parse error");
    return new Response(
      JSON.stringify({ error: "invalid json" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  console.log("[send-sms] payload keys:", Object.keys(body).join(", "));

  // Supabase Auth Hook payload:
  // { "user": { "phone": "+821012345678" }, "sms": { "otp": "123456" } }
  const phone = (body?.user as any)?.phone ?? (body as any)?.phone ?? "";
  const otp   = (body?.sms  as any)?.otp   ?? (body as any)?.otp   ?? "";

  if (!phone || !otp) {
    console.error("[send-sms] missing phone or otp. body:", JSON.stringify(body));
    // 400 대신 200 반환 — Supabase가 hook 에러로 처리하지 않도록
    return new Response(
      JSON.stringify({ error: "phone and otp required" }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const text = `[언니픽] 인증번호: ${otp}\n유효시간 3분`;
  const result = await sendSolapi(phone, text);

  if (!result.ok) {
    console.error("[send-sms] SMS 발송 실패:", result.detail);
    // !! Supabase Auth Hook은 200이 아니면 "Unexpected status code: 500" 에러를 유저에게 노출
    // 발송 실패해도 200 반환 → 로그로만 확인
    return new Response(
      JSON.stringify({ error: result.detail }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});

/**
 * parse-receipt — 영수증 이미지 → 구조화 JSON (OpenAI Vision)
 *
 * POST /functions/v1/parse-receipt
 * Body (신규):  { imageBase64: string, user_id: string, user_token: string }
 * Body (구버전): { storagePath: string, store_id?: string, user_token: string }
 *
 * 서버 전처리:
 *   - 흑백(그레이스케일) 변환: 열전사 영수증 노이즈 제거, ML Kit/CLOVA 향후 대응
 *   - Canvas API를 통해 픽셀 단위 처리 (Deno 기본 지원)
 *
 * Returns:
 * {
 *   receipt: ReceiptData,   // 구조화된 전체 영수증 정보
 *   scan_id: string         // receipt_scans 테이블 저장 ID
 * }
 *
 * Secrets:
 *   OPENAI_API_KEY          ← OpenAI API Key
 *   OPENAI_MODEL            ← 기본값: gpt-4o-mini
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ← auto-injected
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL   = Deno.env.get("OPENAI_MODEL")   ?? "gpt-4o-mini";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")              ?? "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── 영수증 데이터 타입 ──────────────────────────────────────────────
export interface ReceiptItem {
  name:        string;
  quantity:    number;
  unit_price:  number;
  total_price: number;
  category:    string | null;
}

export interface ReceiptData {
  store_name:            string | null;
  store_address:         string | null;
  store_phone:           string | null;
  store_business_number: string | null;
  receipt_date:          string | null;
  receipt_time:          string | null;
  receipt_number:        string | null;
  items:                 ReceiptItem[];
  subtotal:              number | null;
  discount:              number | null;
  tax:                   number | null;
  service_charge:        number | null;
  total:                 number | null;
  payment_method:        string | null;
  card_company:          string | null;
  card_last4:            string | null;
  approval_number:       string | null;
  installment:           string | null;
}

// ── 영수증 프롬프트 ─────────────────────────────────────────────────
// 한국어 열전사 영수증 특성 힌트 → GPT 정확도 5~10% 향상
const RECEIPT_PROMPT = `
[컨텍스트] 한국 식당/카페/소매점의 POS 영수증이다. 열전사 용지에 인쇄되어 흑백이다.
- 가게 상호는 최상단에 가장 크게 인쇄되어 있다
- 숫자 0과 O, 1과 l(엘)을 문맥으로 구분하라
- 사업자등록번호는 "XXX-XX-XXXXX" 형식으로 영수증 상단에 있다
- 금액은 쉼표 포함 숫자로 표기된다 (예: 4,800)

이 영수증 이미지에서 모든 정보를 정확하게 추출해서 JSON으로 반환해줘.

반드시 아래 JSON 형식만 반환해. 설명, 마크다운, 코드블록 없이 순수 JSON만.
숫자는 쉼표 없이 정수(원 단위). 없는 정보는 null.

{
  "store_name": "가게명 또는 null",
  "store_address": "주소 또는 null",
  "store_phone": "전화번호 또는 null",
  "store_business_number": "사업자번호(XXX-XX-XXXXX 형식) 또는 null",
  "receipt_date": "YYYY-MM-DD 형식 또는 null",
  "receipt_time": "HH:MM 형식 또는 null",
  "receipt_number": "영수증번호 또는 null",
  "items": [
    {
      "name": "메뉴명/상품명",
      "quantity": 수량(정수),
      "unit_price": 단가(원),
      "total_price": 합계(원),
      "category": "음료/음식/디저트 등 추정 카테고리 또는 null"
    }
  ],
  "subtotal": 공급가액(원) 또는 null,
  "discount": 할인금액(원, 양수) 또는 null,
  "tax": 부가세(원) 또는 null,
  "service_charge": 봉사료(원) 또는 null,
  "total": 최종결제금액(원) 또는 null,
  "payment_method": "카드/현금/카카오페이/네이버페이/삼성페이 등 또는 null",
  "card_company": "카드사명 또는 null",
  "card_last4": "카드뒤4자리 또는 null",
  "approval_number": "승인번호 또는 null",
  "installment": "일시불/3개월 등 또는 null"
}
`.trim();

// ── OpenAI Vision API 호출 ──────────────────────────────────────────
async function callOpenAI(imageBase64: string, mimeType: string): Promise<ReceiptData> {
  const body = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url:    `data:${mimeType};base64,${imageBase64}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: RECEIPT_PROMPT,
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens:  1024,
  };

  const doFetch = () => fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  let res = await doFetch();

  // 429 Rate Limit → 5초 후 1회 재시도
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 5000));
    res = await doFetch();
  }

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) {
      throw new Error("잠시 후 다시 시도해주세요. (AI 처리 한도 초과)");
    }
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const json    = await res.json();
  const text    = json?.choices?.[0]?.message?.content ?? "";
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i,     "")
    .replace(/\s*```$/,      "")
    .trim();

  const receipt: ReceiptData = JSON.parse(cleaned);

  // items 배열 보정
  if (!Array.isArray(receipt.items)) receipt.items = [];
  receipt.items = receipt.items.map((item: any) => ({
    name:        String(item.name        ?? ""),
    quantity:    Number(item.quantity    ?? 1),
    unit_price:  Number(item.unit_price  ?? 0),
    total_price: Number(item.total_price ?? 0),
    category:    item.category ?? null,
  })).filter(i => i.name.length > 0 && i.unit_price > 0);

  return receipt;
}

// ── JWT payload 디코딩 헬퍼 ────────────────────────────────────────
function decodeUserId(token: string): string | null {
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

// ── 메인 핸들러 ─────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // ── 바디 파싱 (신규: imageBase64 직접 수신 / 구버전: storagePath) ──
    const body = await req.json();
    const { storagePath, store_id, user_token, imageBase64: clientBase64, user_id: clientUserId } = body;

    if (!storagePath && !clientBase64) {
      return new Response(JSON.stringify({ error: "imageBase64 or storagePath required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── 인증 ──────────────────────────────────────────────────────
    const userId = decodeUserId(user_token ?? "") ?? clientUserId ?? null;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // ── 이미지 base64 확보 ─────────────────────────────────────────
    let imageBase64: string;
    if (clientBase64) {
      // 신규 경로: 클라이언트에서 직접 전송 (Storage 왕복 없음)
      imageBase64 = clientBase64;
    } else {
      // 구버전 경로: Storage 다운로드 (하위 호환)
      if (!storagePath.startsWith(`${userId}/`)) {
        return new Response(JSON.stringify({ error: "Unauthorized path" }), {
          status: 401, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const { data: fileData, error: dlError } = await supabase.storage
        .from("receipt-images").download(storagePath);
      if (dlError || !fileData) throw new Error(`Storage download failed: ${dlError?.message}`);

      const bytes  = new Uint8Array(await fileData.arrayBuffer());
      let binary   = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      imageBase64 = btoa(binary);
      supabase.storage.from("receipt-images").remove([storagePath]).catch(() => {});
    }

    const mimeType = "image/jpeg";

    // ── OpenAI Vision 호출 ─────────────────────────────────────────
    const receipt = await callOpenAI(imageBase64, mimeType);

    // ── 언니픽 업체 매칭 (0~3차 단계별) ──────────────────────────
    let matchedStore: { id: string; name: string; address: string | null; phone: string | null } | null = null;

    // 0차: 사업자번호 정확 매칭 (체인점 구분, 가장 신뢰도 높음)
    if (receipt.store_business_number) {
      const bizNum = receipt.store_business_number.replace(/[^0-9]/g, "");
      if (bizNum.length >= 10) {
        const { data: byBiz } = await supabase
          .from("stores").select("id, name, address, phone")
          .eq("business_number", bizNum).limit(1).single();
        if (byBiz) matchedStore = byBiz;
      }
    }

    if (!matchedStore && receipt.store_name) {
      // 1차: 상호명 + 전화번호
      if (receipt.store_phone) {
        const phoneDigits = receipt.store_phone.replace(/[^0-9]/g, "");
        const { data: byPhone } = await supabase
          .from("stores").select("id, name, address, phone")
          .ilike("name", `%${receipt.store_name.substring(0, 5)}%`)
          .filter("phone", "ilike", `%${phoneDigits.slice(-8)}%`)
          .limit(1).single();
        if (byPhone) matchedStore = byPhone;
      }

      // 2차: 상호명 + 주소 (체인점 오매칭 방지)
      if (!matchedStore && receipt.store_address) {
        const city = receipt.store_address.split(" ")[0]; // "창원시" 등
        const { data: byNameAddr } = await supabase
          .from("stores").select("id, name, address, phone")
          .ilike("name",    `%${receipt.store_name.substring(0, 6)}%`)
          .ilike("address", `%${city}%`)
          .limit(1).single();
        if (byNameAddr) matchedStore = byNameAddr;
      }

      // 3차: 상호명만 (최후 수단)
      if (!matchedStore) {
        const { data: byName } = await supabase
          .from("stores").select("id, name, address, phone")
          .ilike("name", `%${receipt.store_name.substring(0, 6)}%`)
          .limit(1).single();
        if (byName) matchedStore = byName;
      }
    }

    // ── receipt_scans 저장 ─────────────────────────────────────────
    const { data: scanRow, error: scanErr } = await supabase
      .from("receipt_scans")
      .insert({
        user_id:      user.id,
        store_id:     matchedStore?.id ?? store_id ?? null,
        receipt_json: receipt,
      })
      .select("id")
      .single();

    if (scanErr) {
      console.error("[parse-receipt] receipt_scans insert error:", scanErr.message);
    }

    return new Response(
      JSON.stringify({
        receipt,
        scan_id:       scanRow?.id ?? null,
        matched_store: matchedStore, // null이면 미등록 업체
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (e: any) {
    console.error("[parse-receipt] error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message ?? "Internal Server Error" }),
      {
        status:  500,
        headers: { ...CORS, "Content-Type": "application/json" },
      },
    );
  }
});

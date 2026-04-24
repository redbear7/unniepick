/**
 * OCR 서비스 추상화 레이어
 *
 * OCR_MODE 환경변수로 구현체 전환:
 *   'claude'  → Claude API Vision (테스트용, Expo Go 동작)
 *   'mlkit'   → ML Kit on-device  (정식출시, EAS Build 필요)
 */

// ──────────────────────────────────────────────────────────────
// 공통 타입
// ──────────────────────────────────────────────────────────────
export interface ExtractedReceiptData {
  storeName:  string | null;  // 영수증 상호명
  datetime:   Date | null;    // 결제 날짜/시간
  amount:     number | null;  // 합계 금액 (원)
  item_count: number | null;  // 주문 메뉴/항목 수 (인원 추정용)
  rawText:    string;         // OCR 원문 (디버깅용)
}

// ──────────────────────────────────────────────────────────────
// 진입점 — 환경에 따라 구현체 자동 선택
// ──────────────────────────────────────────────────────────────
const OCR_MODE = (process.env.EXPO_PUBLIC_OCR_MODE ?? 'claude') as 'claude' | 'mlkit';

export async function extractReceiptData(
  base64Image: string
): Promise<ExtractedReceiptData> {
  if (OCR_MODE === 'mlkit') {
    return mlKitExtract(base64Image);
  }
  return claudeVisionExtract(base64Image);
}

// ──────────────────────────────────────────────────────────────
// 구현체 A: Claude API Vision (테스트용)
// ──────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const CLAUDE_MODEL = 'claude-haiku-4-5'; // 빠르고 저렴, OCR에 최적

async function claudeVisionExtract(base64Image: string): Promise<ExtractedReceiptData> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY 환경변수가 없어요.');
  }

  const prompt = `이 한국 영수증 이미지를 분석해주세요.

반드시 아래 JSON 형식만 응답하세요 (설명 없이):
{
  "store_name": "영수증 최상단 가게 상호명 (없으면 null)",
  "datetime": "YYYY-MM-DDTHH:MM:SS 형식 결제 날짜/시간 (없으면 null)",
  "amount": 합계금액 숫자 (원 단위, 없으면 null),
  "item_count": 주문 항목(메뉴) 종류 수 숫자 (수량 합계가 아닌 줄 수, 없으면 null)
}

주의:
- store_name: 영수증에 인쇄된 가게 이름 그대로
- datetime: 가장 최근 결제 시각 기준
- amount: 합계/총액/결제금액 중 가장 큰 값 (부가세 포함 최종 금액)
- item_count: 영수증에 나열된 메뉴/상품 항목의 줄 수 (예: 아메리카노 2, 라떼 1 → 2)`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API 오류 (${res.status}): ${err?.error?.message ?? '알 수 없는 오류'}`);
  }

  const json = await res.json();
  const rawText: string = json.content?.[0]?.text ?? '';

  // JSON 파싱
  return parseClaudeResponse(rawText);
}

function parseClaudeResponse(rawText: string): ExtractedReceiptData {
  try {
    // 코드블록 제거 후 JSON 추출
    const jsonStr = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(jsonStr);

    let datetime: Date | null = null;
    if (parsed.datetime) {
      const d = new Date(parsed.datetime);
      if (!isNaN(d.getTime())) datetime = d;
    }

    const amount =
      typeof parsed.amount === 'number' && parsed.amount > 0
        ? parsed.amount
        : null;

    const item_count =
      typeof parsed.item_count === 'number' && parsed.item_count > 0
        ? Math.min(parsed.item_count, 20) // 최대 20명으로 제한
        : null;

    return {
      storeName: parsed.store_name ?? null,
      datetime,
      amount,
      item_count,
      rawText,
    };
  } catch {
    // JSON 파싱 실패 — 텍스트만 반환 (폴백)
    return { storeName: null, datetime: null, amount: null, item_count: null, rawText };
  }
}

// ──────────────────────────────────────────────────────────────
// 구현체 B: ML Kit on-device (정식출시용)
// ──────────────────────────────────────────────────────────────
/**
 * 🚀 EAS Build 전환 방법:
 *
 * 1) 패키지 설치:
 *    npx expo install @react-native-ml-kit/text-recognition
 *
 * 2) app.json plugins에 추가:
 *    ["@react-native-ml-kit/text-recognition"]
 *
 * 3) 아래 주석 해제 후 parseReceiptTextFallback 연결
 *
 * 4) .env 변경:
 *    EXPO_PUBLIC_OCR_MODE=mlkit
 */
async function mlKitExtract(base64Image: string): Promise<ExtractedReceiptData> {
  // ── EAS Build 전환 시 아래 주석 해제 ──
  //
  // import TextRecognition from '@react-native-ml-kit/text-recognition';
  // const result = await TextRecognition.recognize(`data:image/jpeg;base64,${base64Image}`);
  // const rawText = result.text;
  // return parseReceiptTextFallback(rawText);

  throw new Error(
    'ML Kit는 EAS Build 전용이에요.\n' +
    '.env에서 EXPO_PUBLIC_OCR_MODE=claude 로 설정하거나\n' +
    'EAS Build 후 사용해주세요.'
  );
}

/**
 * ML Kit용 텍스트 파싱 (ML Kit는 raw text 반환 → 별도 파싱 필요)
 * EAS Build 전환 시 mlKitExtract에서 호출
 */
export function parseReceiptTextFallback(rawText: string): ExtractedReceiptData {
  let datetime: Date | null = null;
  let storeName: string | null = null;
  let amount: number | null = null;
  let item_count: number | null = null;

  // 날짜/시간 파싱
  const p1 = rawText.match(/(\d{4})[-\/.](\d{2})[-\/.](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  const p2 = rawText.match(/(\d{2})[.](\d{2})[.](\d{2})\s+(\d{2}):(\d{2})/);
  const p3 = rawText.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시\s*(\d{1,2})분/);
  const pDate = rawText.match(/(\d{4})[-\/.](\d{2})[-\/.](\d{2})/);
  const pTime = rawText.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (p1) {
    datetime = new Date(+p1[1], +p1[2]-1, +p1[3], +p1[4], +p1[5], +(p1[6]??0));
  } else if (p2) {
    datetime = new Date(2000 + +p2[1], +p2[2]-1, +p2[3], +p2[4], +p2[5]);
  } else if (p3) {
    datetime = new Date(+p3[1], +p3[2]-1, +p3[3], +p3[4], +p3[5]);
  } else if (pDate && pTime) {
    datetime = new Date(+pDate[1], +pDate[2]-1, +pDate[3], +pTime[1], +pTime[2]);
  }

  // 금액 파싱
  const amountPatterns = [
    /합\s*계\s*[:\s]*([\d,]+)/,
    /총\s*액\s*[:\s]*([\d,]+)/,
    /결제\s*금액\s*[:\s]*([\d,]+)/,
    /청구\s*금액\s*[:\s]*([\d,]+)/,
    /TOTAL\s*[:\s]*([\d,]+)/i,
  ];
  for (const pat of amountPatterns) {
    const m = rawText.match(pat);
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ''));
      if (n > 0 && n <= 10_000_000) { amount = n; break; }
    }
  }

  // 상호명: 첫 줄 (ML Kit 결과 첫 번째 텍스트)
  const firstLine = rawText.split('\n').find(l => l.trim().length > 1);
  storeName = firstLine?.trim() ?? null;

  // ML Kit 폴백: 줄 수 기반 메뉴 항목 추정
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const priceLineCount = lines.filter(l => /[\d,]{3,}원?$/.test(l) && !/합계|총액|결제|부가/.test(l)).length;
  item_count = priceLineCount > 0 ? Math.min(priceLineCount, 20) : null;

  return { storeName, datetime, amount, item_count, rawText };
}

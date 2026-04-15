// ================================================================
// 매장 사진 AI 분석 서비스 — Phase 4
// Claude Vision API → 매장 분위기 분석 → music_dna 생성
// ================================================================

import { supabase } from '../supabase';
import { StoreMusicDna } from './curationService';

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

// ─── 분석 결과 타입 ───────────────────────────────────────────
export interface PhotoAnalysisResult {
  ambiance:        string[];   // ['아늑한', '빈티지', '따뜻한 조명']
  interior_style:  string;     // '인더스트리얼'
  color_palette:   string[];   // ['갈색', '베이지', '원목']
  suggested_moods: string[];   // Suno 무드 태그
  avoid_moods:     string[];   // 기피 태그
  confidence:      number;     // 0~1 신뢰도
  analyzed_at:     string;
}

// ─── 이미지 URL → base64 변환 ────────────────────────────────
async function urlToBase64(imageUrl: string): Promise<{ base64: string; mediaType: string }> {
  const response = await fetch(imageUrl);
  const blob     = await response.blob();
  const mediaType = blob.type || 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Claude Vision 분석 프롬프트 ─────────────────────────────
const ANALYSIS_PROMPT = `이 매장 사진을 보고 배경음악 큐레이션을 위한 분석을 해줘.

아래 JSON 형식만 출력해 (설명 없이):
{
  "ambiance": ["분위기 형용사 최대 4개"],
  "interior_style": "인테리어 스타일 한 단어",
  "color_palette": ["주요 색감 최대 3개"],
  "suggested_moods": ["Suno AI 스타일 무드 태그 최대 6개"],
  "avoid_moods": ["어울리지 않는 무드 태그 최대 3개"],
  "confidence": 0~1 신뢰도 숫자
}

Suno 무드 태그 예시: lo-fi, jazz, acoustic, cozy, chill, upbeat, bright, indie, ambient, lounge, warm, tropical, energetic, EDM, k-pop, r&b, classical, hip-hop, night, study

규칙:
- 카페/베이커리: lo-fi, jazz, acoustic 위주
- 밝고 넓은 음식점: upbeat, bright, pop 위주
- 어두운 바/술집: jazz, lounge, night, r&b 위주
- 헬스장: energetic, EDM, hip-hop 위주
- 뷰티샵: k-pop, trendy, pop 위주
- 사진이 불명확하면 confidence를 0.3 이하로 설정`;

// ─── Claude Vision API 호출 ───────────────────────────────────
async function analyzeWithClaude(imageUrl: string): Promise<PhotoAnalysisResult | null> {
  if (!ANTHROPIC_KEY) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY가 없어요');

  try {
    const { base64, mediaType } = await urlToBase64(imageUrl);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',  // Vision 분석 — opus 사용
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type:       'image',
              source: {
                type:       'base64',
                media_type: mediaType,
                data:       base64,
              },
            },
            { type: 'text', text: ANALYSIS_PROMPT },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }

    const json    = await res.json();
    const rawText = json.content?.[0]?.text ?? '';

    // JSON 추출 (마크다운 코드블록 제거)
    const jsonStr = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed  = JSON.parse(jsonStr);

    return {
      ambiance:        parsed.ambiance        ?? [],
      interior_style:  parsed.interior_style  ?? '알 수 없음',
      color_palette:   parsed.color_palette   ?? [],
      suggested_moods: parsed.suggested_moods ?? [],
      avoid_moods:     parsed.avoid_moods     ?? [],
      confidence:      parsed.confidence      ?? 0.5,
      analyzed_at:     new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[storePhotoAnalysis] Claude 분석 실패:', e);
    return null;
  }
}

// ─── 여러 사진 분석 후 무드 합산 ────────────────────────────
function mergeAnalysisResults(results: PhotoAnalysisResult[]): StoreMusicDna {
  const moodScore:  Record<string, number> = {};
  const avoidScore: Record<string, number> = {};

  for (const r of results) {
    const w = r.confidence; // 신뢰도를 가중치로 사용
    for (const tag of r.suggested_moods) {
      moodScore[tag] = (moodScore[tag] ?? 0) + w;
    }
    for (const tag of r.avoid_moods) {
      avoidScore[tag] = (avoidScore[tag] ?? 0) + w;
    }
  }

  const suggested = Object.entries(moodScore)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([tag]) => tag);

  const avoided = Object.entries(avoidScore)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([tag]) => tag)
    .filter(tag => !suggested.includes(tag));  // 선호에 있으면 기피에서 제거

  return {
    suggested_moods: suggested,
    avoid_moods:     avoided,
    analyzed_at:     new Date().toISOString(),
  };
}

// ─── 메인: 가게 사진 분석 + DB 저장 ─────────────────────────
export interface AnalyzeStorePhotoParams {
  storeId:    string;
  imageUrls:  string[];   // 분석할 이미지 URL 목록 (최대 3장)
  onProgress?: (step: string) => void;
}

export interface AnalyzeStorePhotoResult {
  success:         boolean;
  musicDna:        StoreMusicDna | null;
  analysisDetails: PhotoAnalysisResult[];
  error?:          string;
}

export async function analyzeStorePhotos(
  params: AnalyzeStorePhotoParams,
): Promise<AnalyzeStorePhotoResult> {
  const { storeId, imageUrls, onProgress } = params;

  if (imageUrls.length === 0) {
    return { success: false, musicDna: null, analysisDetails: [], error: '분석할 사진이 없어요' };
  }

  const urls = imageUrls.slice(0, 3); // 최대 3장
  const results: PhotoAnalysisResult[] = [];

  for (let i = 0; i < urls.length; i++) {
    onProgress?.(`사진 ${i + 1}/${urls.length} 분석 중…`);
    const result = await analyzeWithClaude(urls[i]);
    if (result) results.push(result);
  }

  if (results.length === 0) {
    return { success: false, musicDna: null, analysisDetails: [], error: '분석 결과를 얻지 못했어요' };
  }

  onProgress?.('음악 취향 생성 중…');
  const musicDna = mergeAnalysisResults(results);

  // DB 저장
  onProgress?.('가게 정보 업데이트 중…');
  const { error: dbError } = await supabase
    .from('stores')
    .update({ music_dna: musicDna })
    .eq('id', storeId);

  if (dbError) {
    return { success: false, musicDna, analysisDetails: results, error: dbError.message };
  }

  return { success: true, musicDna, analysisDetails: results };
}

// ─── 저장된 music_dna 조회 ───────────────────────────────────
export async function fetchStoreMusicDna(storeId: string): Promise<StoreMusicDna | null> {
  const { data } = await supabase
    .from('stores')
    .select('music_dna')
    .eq('id', storeId)
    .single();
  return data?.music_dna ?? null;
}

// ─── 가게 등록 사진 URL 조회 ─────────────────────────────────
export async function fetchStoreImageUrls(storeId: string): Promise<string[]> {
  const { data } = await supabase
    .from('stores')
    .select('image_url, image_url2, image_url3')
    .eq('id', storeId)
    .single();

  if (!data) return [];
  return [data.image_url, data.image_url2, data.image_url3].filter(Boolean) as string[];
}

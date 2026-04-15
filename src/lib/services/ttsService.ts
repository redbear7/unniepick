import { supabase } from '../supabase';

// ─── Fish Audio 음성 타입 ────────────────────────────────────────────
export interface FishVoice {
  id:         string;
  label:      string;
  ref_id:     string;
  emoji:      string;
  created_at: string;
}

// ─── Fish Audio 음성 목록 조회 ───────────────────────────────────────
export async function fetchFishVoices(): Promise<FishVoice[]> {
  const { data, error } = await supabase
    .from('fish_voices')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`음성 목록 조회 실패: ${error.message}`);
  return data ?? [];
}

// ─── TTS 일별 한도 체크 ─────────────────────────────────────────────
async function checkTTSLimit(
  storeId: string,
  charCount: number,
): Promise<{ allowed: boolean; errorMsg?: string }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: storeData } = await supabase
    .from('stores')
    .select('tts_policy_id, tts_policies(daily_char_limit)')
    .eq('id', storeId)
    .single();

  const policy = storeData?.tts_policies as unknown as { daily_char_limit: number } | null;
  const dailyLimit: number | null = policy?.daily_char_limit ?? null;

  // 정책 미할당 또는 무제한(-1)이면 항상 허용
  if (dailyLimit === null || dailyLimit === -1) return { allowed: true };

  const { data: usageData } = await supabase
    .from('tts_daily_usage')
    .select('char_count')
    .eq('store_id', storeId)
    .eq('usage_date', today)
    .maybeSingle();

  const currentUsage = usageData?.char_count ?? 0;

  if (currentUsage + charCount > dailyLimit) {
    return {
      allowed: false,
      errorMsg: `오늘 TTS 사용 한도(${dailyLimit.toLocaleString()}자)를 초과했습니다. (사용: ${currentUsage.toLocaleString()}자 / 한도: ${dailyLimit.toLocaleString()}자)`,
    };
  }
  return { allowed: true };
}

// ─── TTS 사용량 기록 ─────────────────────────────────────────────────
async function recordTTSUsage(storeId: string, charCount: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from('tts_daily_usage')
    .select('char_count')
    .eq('store_id', storeId)
    .eq('usage_date', today)
    .maybeSingle();

  const newCount = (existing?.char_count ?? 0) + charCount;
  await supabase.from('tts_daily_usage').upsert(
    { store_id: storeId, usage_date: today, char_count: newCount, updated_at: new Date().toISOString() },
    { onConflict: 'store_id,usage_date' },
  );
}

// ─── Supabase Storage 업로드 ─────────────────────────────────────────
async function uploadToStorage(uint8Array: Uint8Array, refId: string): Promise<string> {
  const filename = `ann_${Date.now()}_${refId}.mp3`;
  const { error } = await supabase.storage
    .from('announcements')
    .upload(filename, uint8Array, { contentType: 'audio/mpeg', upsert: false });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  const { data } = supabase.storage.from('announcements').getPublicUrl(filename);
  return data.publicUrl;
}

// ─── Fish Audio TTS 생성 ─────────────────────────────────────────────
// refId  : fish_voices 테이블의 ref_id
// speed  : 0.25 ~ 4.0  (1.0 = 보통)
// storeId: 제공 시 일별 사용량 추적
export async function generateTTS(
  text:     string,
  refId:    string,
  speed:    number = 1.0,
  storeId?: string,
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_FISH_AUDIO_API_KEY;
  if (!apiKey) throw new Error('Fish Audio API 키가 없어요. .env에 EXPO_PUBLIC_FISH_AUDIO_API_KEY를 입력해주세요.');
  if (!refId)  throw new Error('음성을 선택해주세요.');

  const trimmed      = text.trim();
  const charCount    = trimmed.length;
  const clampedSpeed = Math.min(4.0, Math.max(0.25, speed));

  // 일별 한도 체크
  if (storeId) {
    const { allowed, errorMsg } = await checkTTSLimit(storeId, charCount);
    if (!allowed) throw new Error(errorMsg);
  }

  // Fish Audio API 호출
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      model:          's2-pro',
    },
    body: JSON.stringify({
      text:         trimmed,
      reference_id: refId,
      format:       'mp3',
      latency:      'balanced',
      prosody:      { speed: clampedSpeed },
    }),
  });

  if (!res.ok) throw new Error(`Fish Audio TTS 실패: ${await res.text()}`);

  const audioUrl = await uploadToStorage(new Uint8Array(await res.arrayBuffer()), refId);

  // 사용량 기록
  if (storeId) {
    await recordTTSUsage(storeId, charCount);
  }

  return audioUrl;
}

// ─── 오늘 TTS 사용량 조회 ───────────────────────────────────────────
export async function fetchTTSUsage(storeId: string): Promise<{ used: number; limit: number | null }> {
  const today = new Date().toISOString().slice(0, 10);

  const [usageResult, storeResult] = await Promise.all([
    supabase
      .from('tts_daily_usage')
      .select('char_count')
      .eq('store_id', storeId)
      .eq('usage_date', today)
      .maybeSingle(),
    supabase
      .from('stores')
      .select('tts_policies(daily_char_limit)')
      .eq('id', storeId)
      .single(),
  ]);

  const used   = usageResult.data?.char_count ?? 0;
  const policy = storeResult.data?.tts_policies as unknown as { daily_char_limit: number } | null;
  const limit  = policy?.daily_char_limit ?? null;

  return { used, limit };
}

// ─── AI 방송 문구 자동 생성 (OpenAI) ────────────────────────────────
export async function generateAnnouncementText(situation?: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API 키가 설정되지 않았어요');

  const userMsg = situation?.trim()
    ? `다음 상황에 맞는 매장 안내방송 문구를 작성해주세요: ${situation}`
    : '친근한 일반 매장 환영 안내방송을 작성해주세요.';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '당신은 매장 안내방송 전문가입니다. 자연스럽고 친근한 한국어 안내방송 문구를 80자 이내로 작성하세요. ' +
            '문구만 출력하고, 따옴표·설명·번호는 붙이지 마세요.',
        },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 150,
      temperature: 0.85,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? 'AI 생성 실패');
  }
  const data   = await res.json();
  const result = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!result) throw new Error('AI 응답이 비어있어요');
  return result;
}

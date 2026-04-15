import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView, Alert, TextInput, Modal, ActivityIndicator, Keyboard,
} from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ownerLogout } from '../../lib/auth';
import { RADIUS } from '../../constants/theme';
import {
  sendCouponNotification,
  sendTimeSaleNotification,
} from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import { getStoreCouponPin, setStoreCouponPin, fetchActiveCoupons, CouponRow } from '../../lib/services/couponService';
import { generateTTS, generateAnnouncementText, fetchFishVoices, FishVoice } from '../../lib/services/ttsService';
import { changeOwnerPin } from '../../lib/services/ownerPinService';
import { duckMusicVolume, unduckMusicVolume } from '../../lib/volumeDuck';
import { saveAnnouncement, fetchMyAnnouncements, deleteAnnouncement, StoreAnnouncement } from '../../lib/services/musicService';
import {
  createPost, fetchMyPosts, deletePost, editPost,
  requestPostDelete, fetchMyPostDeleteRequests,
  StorePostRow, PostDeleteRequest,
  fetchPostSettings, PostSettings, parsePostError,
} from '../../lib/services/postService';
import {
  collectStoreContext, saveMenuTags, fetchStoreContext,
  StoreContextResult, WEATHER_ZONE_LABEL, DISTRICT_TYPE_LABEL,
} from '../../lib/services/storeContextService';


const STATS = [
  { icon: '🎟', label: '오늘 쿠폰 사용', value: '8건' },
  { icon: '🍀', label: '오늘 스탬프 발급', value: '12개' },
  { icon: '👥', label: '신규 가입', value: '3명' },
];

type NotifType = 'coupon' | 'timesale';

// ─── 자주 쓰는 안내방송 템플릿 (기본값) ─────────────────────────
const TEMPLATES_STORAGE_KEY = 'owner_tts_templates';

const DAYS_KR = ['월', '화', '수', '목', '금', '토', '일'];

interface TtsTemplate {
  emoji:       string;
  label:       string;
  text:        string;
  // 예약 설정
  schedDays:   number[];   // 0=월 ~ 6=일, 빈 배열=매일
  schedTime:   string;     // 'HH:MM' 형식, ''=즉시(예약 없음)
  schedRepeat: number;     // 반복 횟수 (1~5)
}

const DEFAULT_TTS_TEMPLATES: TtsTemplate[] = [
  { emoji: '🎉', label: '할인 이벤트',
    text:  '지금 매장에서 특별 할인 이벤트가 진행 중입니다! 오늘 하루만 전 메뉴 10% 할인, 많은 이용 부탁드립니다.',
    schedDays: [], schedTime: '', schedRepeat: 1 },
  { emoji: '🎟', label: '쿠폰 발급',
    text:  '언니픽 앱에서 쿠폰이 새로 발급되었습니다! 지금 바로 확인하고 사용해보세요.',
    schedDays: [], schedTime: '', schedRepeat: 1 },
  { emoji: '⏰', label: '마감 안내',
    text:  '안내 말씀 드립니다. 잠시 후 영업이 종료됩니다. 오늘도 방문해 주셔서 감사합니다.',
    schedDays: [0,1,2,3,4,5,6], schedTime: '21:00', schedRepeat: 2 },
  { emoji: '📍', label: '체크인 혜택',
    text:  '언니픽 앱으로 지금 체크인하시면 특별 적립금을 드립니다! 앱을 열고 체크인 버튼을 눌러보세요.',
    schedDays: [], schedTime: '', schedRepeat: 1 },
  { emoji: '☕', label: '1+1 행사',
    text:  '지금 이 시간, 음료 하나 사시면 하나 더 드립니다! 오늘 오후 3시까지만 진행되는 특별 행사입니다.',
    schedDays: [5,6], schedTime: '14:00', schedRepeat: 3 },
];

export default function OwnerDashboardScreen() {
  const navigation = useNavigation<any>();
  const [modalVisible,   setModalVisible]   = useState(false);
  const [notifType,      setNotifType]      = useState<NotifType>('coupon');
  const [notifTitle,     setNotifTitle]     = useState('');
  const [notifDiscount,  setNotifDiscount]  = useState('');
  const [notifEndTime,   setNotifEndTime]   = useState('');
  const [sending,        setSending]        = useState(false);

  // 스탬프 리워드 설정
  const [storeId,       setStoreId]       = useState<string | null>(null);
  const [stampReward,   setStampReward]   = useState('');
  const [stampGoal,     setStampGoal]     = useState('10');
  const [stampModal,    setStampModal]    = useState(false);
  const [stampSaving,   setStampSaving]   = useState(false);

  // 게시물 작성
  const [postModal,      setPostModal]      = useState(false);
  const [postContent,    setPostContent]    = useState('');
  const [postCouponId,   setPostCouponId]   = useState<string | null>(null);
  const [postPosting,    setPostPosting]    = useState(false);
  const [myPosts,        setMyPosts]        = useState<StorePostRow[]>([]);
  const [storeCoupons,   setStoreCoupons]   = useState<CouponRow[]>([]);
  const [postSettings,   setPostSettings]   = useState<PostSettings>({
    post_start_hour: 8, post_end_hour: 20, post_cooldown_hours: 24,
  });
  const [cooldownRemain, setCooldownRemain] = useState<number>(0); // 남은 초

  // 게시물 수정
  const [editModal,      setEditModal]      = useState(false);
  const [editingPost,    setEditingPost]    = useState<StorePostRow | null>(null);
  const [editContent,    setEditContent]    = useState('');
  const [editPosting,    setEditPosting]    = useState(false);

  // 게시물 삭제 요청
  const [deleteReqModal,   setDeleteReqModal]   = useState(false);
  const [deleteReqPost,    setDeleteReqPost]     = useState<StorePostRow | null>(null);
  const [deleteReqReason,  setDeleteReqReason]   = useState('');
  const [deleteReqSending, setDeleteReqSending]  = useState(false);
  const [myDeleteRequests, setMyDeleteRequests]  = useState<PostDeleteRequest[]>([]);

  // 쿠폰 비밀번호 (PIN)
  const [couponPin,     setCouponPin]     = useState<string | null>(null);
  const [pinModal,      setPinModal]      = useState(false);
  const [pinInput,      setPinInput]      = useState('');
  const [pinSaving,     setPinSaving]     = useState(false);
  const [pinVisible,    setPinVisible]    = useState(false);

  // 사장님 PIN 변경 모달
  const [changePinModal,    setChangePinModal]    = useState(false);
  const [changePinPhone,    setChangePinPhone]    = useState('');
  const [changePinCurrent,  setChangePinCurrent]  = useState('');
  const [changePinNew,      setChangePinNew]      = useState('');
  const [changePinConfirm,  setChangePinConfirm]  = useState('');
  const [changePinLoading,  setChangePinLoading]  = useState(false);

  // TTS 안내방송
  const [ttsModal,       setTtsModal]       = useState(false);
  const [ttsText,        setTtsText]        = useState('');
  const [fishVoices,     setFishVoices]     = useState<FishVoice[]>([]);
  const [ttsVoice,       setTtsVoice]       = useState<string>('');  // Fish Audio ref_id
  const [ttsPlayMode,    setTtsPlayMode]    = useState<'immediate' | 'between_tracks'>('immediate');
  const [ttsRepeat,      setTtsRepeat]      = useState(1);
  const [ttsSpeed,       setTtsSpeed]       = useState(1.0);
  const [ttsGenerating,  setTtsGenerating]  = useState(false);
  const [ttsAudioUrl,    setTtsAudioUrl]    = useState<string | null>(null);
  const [ttsPlaying,     setTtsPlaying]     = useState(false);
  const [playingUrl,     setPlayingUrl]     = useState<string | null>(null);
  const [myAnnouncements, setMyAnnouncements] = useState<StoreAnnouncement[]>([]);
  const [voiceSamples,   setVoiceSamples]   = useState<Record<string, string>>({});
  const [samplingVoice,  setSamplingVoice]  = useState<string | null>(null);
  const [playingVoice,   setPlayingVoice]   = useState<string | null>(null);
  const ttsSoundRef = useRef<any>(null);

  // AI 방송 문구 생성
  const [aiPanel,      setAiPanel]      = useState(false);
  const [aiSituation,  setAiSituation]  = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // 매장 컨텍스트
  const [storeContext,      setStoreContext]       = useState<StoreContextResult | null>(null);
  const [contextLoading,    setContextLoading]    = useState(false);
  const [menuInput,         setMenuInput]         = useState('');
  const [menuTagList,       setMenuTagList]       = useState<string[]>([]);

  // 템플릿
  const [templates,         setTemplates]         = useState<TtsTemplate[]>(DEFAULT_TTS_TEMPLATES);
  const [selectedTplIdx,    setSelectedTplIdx]    = useState<number | null>(null);
  const [tplEditModal,      setTplEditModal]      = useState(false);
  const [tplEditIdx,        setTplEditIdx]        = useState<number | null>(null);
  const [tplEditEmoji,      setTplEditEmoji]      = useState('');
  const [tplEditLabel,      setTplEditLabel]      = useState('');
  const [tplEditText,       setTplEditText]       = useState('');
  const [tplEditDays,       setTplEditDays]       = useState<number[]>([]);
  const [tplEditTime,       setTplEditTime]       = useState('');
  const [tplEditRepeat,     setTplEditRepeat]     = useState(1);

  useEffect(() => { loadMyStore(); loadTemplates(); }, []);

  // ── 템플릿 로드 (구버전 데이터 마이그레이션 포함) ──
  const loadTemplates = async () => {
    try {
      const saved = await SecureStore.getItemAsync(TEMPLATES_STORAGE_KEY);
      if (saved) {
        const parsed: TtsTemplate[] = JSON.parse(saved);
        // schedDays 등 신규 필드가 없는 구버전 데이터에 기본값 보정
        const migrated = parsed.map(t => ({
          ...t,
          schedDays:   t.schedDays   ?? [],
          schedTime:   t.schedTime   ?? '',
          schedRepeat: t.schedRepeat ?? 1,
        }));
        setTemplates(migrated);
      }
    } catch {}
  };

  // ── 템플릿 저장 ──
  const saveTemplates = useCallback(async (updated: TtsTemplate[]) => {
    setTemplates(updated);
    try {
      await SecureStore.setItemAsync(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }, []);

  // ── 템플릿 칩 탭 ──
  const handleSelectTemplate = (idx: number) => {
    const tpl = templates[idx];
    setSelectedTplIdx(idx);
    setTtsText(tpl.text);
    setTtsRepeat(tpl.schedRepeat ?? 1);
    setTtsAudioUrl(null);
  };

  // ── 현재 텍스트·반복횟수를 선택된 템플릿에 저장 ──
  const handleSaveToTemplate = () => {
    if (selectedTplIdx === null) return;
    const updated = templates.map((t, i) =>
      i === selectedTplIdx
        ? { ...t, text: ttsText.trim(), schedRepeat: ttsRepeat }
        : t
    );
    saveTemplates(updated);
    Alert.alert('저장 완료', `"${templates[selectedTplIdx].label}" 템플릿이 업데이트됐어요!`);
  };

  // ── 템플릿 편집 모달 열기 ──
  const handleOpenTplEdit = (idx: number | null) => {
    if (idx === null) {
      // 새 템플릿 추가
      setTplEditIdx(null);
      setTplEditEmoji('📢');
      setTplEditLabel('');
      setTplEditText('');
      setTplEditDays([]);
      setTplEditTime('');
      setTplEditRepeat(1);
    } else {
      const tpl = templates[idx];
      setTplEditIdx(idx);
      setTplEditEmoji(tpl.emoji);
      setTplEditLabel(tpl.label);
      setTplEditText(tpl.text);
      setTplEditDays(tpl.schedDays ?? []);
      setTplEditTime(tpl.schedTime ?? '');
      setTplEditRepeat(tpl.schedRepeat ?? 1);
    }
    setTplEditModal(true);
  };

  // ── 요일 토글 ──
  const toggleDay = (d: number) => {
    setTplEditDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    );
  };

  // ── 템플릿 편집 저장 ──
  const handleConfirmTplEdit = () => {
    if (!tplEditLabel.trim() || !tplEditText.trim()) {
      Alert.alert('라벨과 문구를 모두 입력해주세요');
      return;
    }
    const newTpl: TtsTemplate = {
      emoji:       tplEditEmoji.trim() || '📢',
      label:       tplEditLabel.trim(),
      text:        tplEditText.trim(),
      schedDays:   tplEditDays,
      schedTime:   tplEditTime.trim(),
      schedRepeat: tplEditRepeat,
    };
    const updated = tplEditIdx === null
      ? [...templates, newTpl]                                          // 추가
      : templates.map((t, i) => i === tplEditIdx ? newTpl : t);        // 수정
    saveTemplates(updated);
    setTplEditModal(false);
    if (tplEditIdx !== null && selectedTplIdx === tplEditIdx)
      setTtsText(tplEditText.trim());
  };

  // ── 템플릿 삭제 ──
  const handleDeleteTemplate = (idx: number) => {
    Alert.alert('템플릿 삭제', `"${templates[idx].label}" 템플릿을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        const updated = templates.filter((_, i) => i !== idx);
        saveTemplates(updated);
        setTplEditModal(false);
        if (selectedTplIdx === idx) { setSelectedTplIdx(null); setTtsText(''); }
      }},
    ]);
  };

  const loadMyStore = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('stores')
      .select('id, stamp_reward, stamp_goal, coupon_pin, store_category')
      .eq('owner_id', session.user.id)
      .single();
    if (data) {
      setStoreId(data.id);
      setStampReward(data.stamp_reward ?? '');
      setStampGoal(String(data.stamp_goal ?? 10));
      setCouponPin((data as any).coupon_pin ?? null);
      // 매장 컨텍스트 로드
      fetchStoreContext(data.id).then(ctx => {
        if (ctx) {
          setStoreContext(ctx as StoreContextResult);
          setMenuTagList(ctx.menu_tags ?? []);
        }
      }).catch(() => {});
      // 게시물 + 쿠폰 목록 로드
      fetchMyPosts(data.id).then(posts => {
        setMyPosts(posts);
        // 쿨다운 계산
        fetchPostSettings().then(settings => {
          setPostSettings(settings);
          if (posts.length > 0) {
            const lastTs = new Date(posts[0].created_at).getTime();
            const elapsed = Math.floor((Date.now() - lastTs) / 1000);
            const cooldownSecs = settings.post_cooldown_hours * 3600;
            const remain = cooldownSecs - elapsed;
            setCooldownRemain(remain > 0 ? remain : 0);
          }
        }).catch(() => {});
      }).catch(() => {});
      fetchActiveCoupons().then(all =>
        setStoreCoupons(all.filter(c => c.owner_id === session.user.id))
      ).catch(() => {});
      fetchMyPostDeleteRequests(data.id).then(setMyDeleteRequests).catch(() => {});
      fetchMyAnnouncements(data.id).then(setMyAnnouncements).catch(() => {});
    }
    // Fish Audio 음성 목록 로드
    fetchFishVoices().then(voices => {
      setFishVoices(voices);
      if (voices.length > 0) setTtsVoice(prev => prev || voices[0].ref_id);
    }).catch(() => {});
  };

  // 게시물 작성
  const handlePostSubmit = async () => {
    if (!storeId)               { Alert.alert('가게 정보를 불러오는 중이에요'); return; }
    if (!postContent.trim())    { Alert.alert('내용을 입력해주세요'); return; }
    setPostPosting(true);
    try {
      await createPost(storeId, postContent.trim(), postCouponId);
      const updated = await fetchMyPosts(storeId);
      setMyPosts(updated);
      setCooldownRemain(postSettings.post_cooldown_hours * 3600);
      setPostModal(false);
      setPostContent('');
      setPostCouponId(null);
      Alert.alert('✅ 게시물이 등록됐어요!', '쿠폰 피드에 노출됩니다');
    } catch (e: any) {
      // parsePostError가 이미 throw한 PostCreateError 객체를 처리
      const parsed = typeof e === 'object' && 'code' in e
        ? e
        : parsePostError(e.message ?? '');
      Alert.alert('등록 실패', parsed.message ?? '다시 시도해주세요');
    } finally {
      setPostPosting(false);
    }
  };

  // 게시물 수정 제출
  const handleEditSubmit = async () => {
    if (!editingPost) return;
    if (!editContent.trim()) { Alert.alert('내용을 입력해주세요'); return; }
    setEditPosting(true);
    try {
      await editPost(editingPost.id, editContent.trim());
      setMyPosts(prev => prev.map(p =>
        p.id === editingPost.id ? { ...p, content: editContent.trim() } : p,
      ));
      setEditModal(false);
      Alert.alert('✅ 수정 완료', '게시물이 수정됐어요');
    } catch (e: any) {
      const msg = e.message === 'no_change' ? '변경된 내용이 없어요'
                : e.message === 'empty_content' ? '내용을 입력해주세요'
                : e.message ?? '다시 시도해주세요';
      Alert.alert('수정 실패', msg);
    } finally {
      setEditPosting(false);
    }
  };

  // 게시물 삭제 요청 제출
  const handleDeleteRequestSubmit = async () => {
    if (!deleteReqPost) return;
    if (!deleteReqReason.trim()) { Alert.alert('삭제 요청 사유를 입력해주세요'); return; }
    setDeleteReqSending(true);
    try {
      await requestPostDelete(deleteReqPost.id, deleteReqReason.trim());
      if (storeId) {
        const updated = await fetchMyPostDeleteRequests(storeId);
        setMyDeleteRequests(updated);
      }
      setDeleteReqModal(false);
      setDeleteReqReason('');
      Alert.alert('📨 삭제 요청 접수', '시샵에게 요청이 전달됐어요.\n처리 결과는 추후 안내드려요.');
    } catch (e: any) {
      Alert.alert('요청 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setDeleteReqSending(false);
    }
  };

  // 자동 PIN 발급
  const handleAutoGeneratePin = async () => {
    if (!storeId) return;
    Alert.alert(
      couponPin ? 'PIN 재발급' : 'PIN 발급',
      couponPin
        ? '새 비밀번호를 자동으로 발급할까요?\n기존 비밀번호는 더 이상 사용할 수 없어요.'
        : '쿠폰 사용 비밀번호를 자동으로 발급할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '발급',
          onPress: async () => {
            setPinSaving(true);
            try {
              const newPin = await setStoreCouponPin(storeId);
              setCouponPin(newPin);
              setPinVisible(true);
              Alert.alert(
                '🔑 비밀번호 발급 완료',
                `새 쿠폰 비밀번호: ${newPin}\n\n고객에게 구두로 알려주세요.\n절대 외부에 공유하지 마세요!`,
              );
            } catch (e: any) {
              Alert.alert('발급 실패', e.message);
            } finally {
              setPinSaving(false);
            }
          },
        },
      ],
    );
  };

  // 수동 PIN 변경 저장
  const handleSaveManualPin = async () => {
    if (!storeId) return;
    if (!/^\d{4}$/.test(pinInput)) {
      Alert.alert('숫자 4자리를 입력해주세요');
      return;
    }
    setPinSaving(true);
    try {
      const newPin = await setStoreCouponPin(storeId, pinInput);
      setCouponPin(newPin);
      setPinInput('');
      setPinModal(false);
      setPinVisible(true);
      Alert.alert('✅ 저장 완료', `쿠폰 비밀번호가 ${newPin}(으)로 변경됐어요`);
    } catch (e: any) {
      Alert.alert('변경 실패', e.message);
    } finally {
      setPinSaving(false);
    }
  };

  const handleSaveStampReward = async () => {
    if (!storeId) return;
    const goal = parseInt(stampGoal, 10);
    if (isNaN(goal) || goal < 1 || goal > 50) {
      Alert.alert('스탬프 목표는 1~50 사이로 입력해주세요');
      return;
    }
    setStampSaving(true);
    try {
      await supabase.rpc('update_stamp_reward', {
        p_store_id: storeId,
        p_reward:   stampReward.trim() || null,
        p_goal:     goal,
      });
      setStampModal(false);
      Alert.alert('✅ 저장 완료', '스탬프 리워드 설정이 저장됐어요!');
    } catch (e: any) {
      Alert.alert('저장 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setStampSaving(false);
    }
  };

  // ── AI 방송 문구 생성 ──
  const AI_CHIPS = ['마감 30분 전', '이벤트 진행 중', '혼잡 시간대', '날씨 좋은 날', '특별 할인 중', '영업 시작'];

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const text = await generateAnnouncementText(aiSituation.trim() || undefined);
      setTtsText(text);
      setTtsAudioUrl(null);
      setAiPanel(false);
      setAiSituation('');
    } catch (e: any) {
      Alert.alert('AI 생성 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setAiGenerating(false);
    }
  };

  // ── TTS 생성 ──
  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) { Alert.alert('안내 내용을 입력해주세요'); return; }
    setTtsGenerating(true);
    try {
      // 1. TTS 음성 생성 (storeId로 일별 한도 체크)
      const url = await generateTTS(ttsText.trim(), ttsVoice, ttsSpeed, storeId ?? undefined);
      setTtsAudioUrl(url);

      // 2. storeId 있으면 DB에 저장 (없어도 생성은 성공)
      if (storeId) {
        const saved = await saveAnnouncement(storeId, {
          text: ttsText.trim(), audio_url: url,
          voice_type: ttsVoice, play_mode: ttsPlayMode,
          repeat_count: ttsRepeat, play_interval: 3,
        });
        setMyAnnouncements(prev => [saved, ...prev]);
      }

      Alert.alert('✅ 방송 생성 완료!', '미리듣기 버튼으로 확인해보세요');
    } catch (e: any) {
      Alert.alert('생성 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setTtsGenerating(false);
    }
  };

  // ── 목소리 샘플 재생 ──
  const SAMPLE_TEXT = '안녕하세요! 언니픽 안내방송입니다. 오늘도 좋은 하루 되세요.';
  const handleVoiceSample = async (voice: string) => {
    // 이미 재생 중인 같은 목소리 → 정지
    if (playingVoice === voice) {
      await ttsSoundRef.current?.stopAsync();
      await ttsSoundRef.current?.unloadAsync();
      ttsSoundRef.current = null;
      setPlayingVoice(null);
      unduckMusicVolume();   // 음악 볼륨 복원
      return;
    }
    // 기존 재생 정지
    await ttsSoundRef.current?.stopAsync();
    await ttsSoundRef.current?.unloadAsync();
    ttsSoundRef.current = null;
    setPlayingVoice(null);

    setSamplingVoice(voice);
    try {
      // 캐시된 샘플 URL 있으면 재사용, 없으면 생성
      let url = voiceSamples[voice];
      if (!url) {
        url = await generateTTS(SAMPLE_TEXT, voice);
        setVoiceSamples(prev => ({ ...prev, [voice]: url }));
      }
      duckMusicVolume();   // 음악 볼륨 낮추기
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      ttsSoundRef.current = sound;
      setPlayingVoice(voice);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingVoice(null);
          sound.unloadAsync();
          ttsSoundRef.current = null;
          unduckMusicVolume();   // 샘플 끝 → 음악 볼륨 복원
        }
      });
    } catch (e: any) {
      unduckMusicVolume();   // 실패해도 볼륨 복원
      Alert.alert('샘플 재생 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setSamplingVoice(null);
    }
  };

  // ── TTS 재생 중지 ──
  const handleStopTTS = async () => {
    await ttsSoundRef.current?.stopAsync();
    await ttsSoundRef.current?.unloadAsync();
    ttsSoundRef.current = null;
    setTtsPlaying(false);
    setPlayingUrl(null);
    unduckMusicVolume();   // 음악 볼륨 복원
  };

  // ── TTS 모달 닫기 (키보드 해제 + 오디오 중지 + 모달 닫기) ──
  const closeTtsModal = async () => {
    Keyboard.dismiss();
    await handleStopTTS();
    setAiPanel(false);
    setTtsModal(false);
  };

  // ── TTS 미리듣기 / 중지 토글 ──
  const handlePreviewTTS = async (url: string) => {
    // 같은 URL 재생 중 → 중지
    if (playingUrl === url && ttsPlaying) {
      await handleStopTTS();
      return;
    }
    // 다른 URL or 정지 상태 → 기존 중지 후 새로 재생
    try {
      await handleStopTTS();
      duckMusicVolume();   // 음악 볼륨 낮추기
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      ttsSoundRef.current = sound;
      setTtsPlaying(true);
      setPlayingUrl(url);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setTtsPlaying(false);
          setPlayingUrl(null);
          sound.unloadAsync();
          ttsSoundRef.current = null;
          unduckMusicVolume();   // 방송 끝 → 음악 볼륨 복원
        }
      });
    } catch { Alert.alert('재생 실패', '음성을 재생할 수 없어요'); }
  };

  // ── TTS 삭제 ──
  const handleDeleteAnnouncement = (id: string) => {
    Alert.alert('방송 삭제', '이 안내방송을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await deleteAnnouncement(id);
          setMyAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch { Alert.alert('삭제 실패'); }
      }},
    ]);
  };

  // ── 매장 컨텍스트 수집 ──
  const handleCollectContext = async () => {
    if (!storeId) return;
    setContextLoading(true);
    try {
      const result = await collectStoreContext(storeId);
      setStoreContext(result);
      Alert.alert('완료', `📍 ${DISTRICT_TYPE_LABEL[result.district_type] ?? result.district_type}\n${WEATHER_ZONE_LABEL[result.weather_zone] ?? result.weather_zone} (${result.weather_temp.toFixed(1)}°C)\n\n매장 주변 정보가 업데이트됐어요!`);
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '위치 정보를 가져오지 못했어요');
    } finally {
      setContextLoading(false);
    }
  };

  const handleAddMenuTag = () => {
    const tag = menuInput.trim();
    if (!tag || menuTagList.includes(tag)) { setMenuInput(''); return; }
    const next = [...menuTagList, tag];
    setMenuTagList(next);
    setMenuInput('');
    if (storeId) saveMenuTags(storeId, next).catch(() => {});
  };

  const handleRemoveMenuTag = (tag: string) => {
    const next = menuTagList.filter(t => t !== tag);
    setMenuTagList(next);
    if (storeId) saveMenuTags(storeId, next).catch(() => {});
  };

  // ── 사장님 PIN 변경 ──
  const handleChangePin = async () => {
    if (!changePinPhone.trim()) { Alert.alert('전화번호를 입력해주세요'); return; }
    if (!changePinCurrent)      { Alert.alert('현재 PIN을 입력해주세요'); return; }
    if (!changePinNew)          { Alert.alert('새 PIN을 입력해주세요'); return; }
    if (changePinNew !== changePinConfirm) {
      Alert.alert('새 PIN이 일치하지 않습니다', '새 PIN과 확인 PIN을 동일하게 입력해주세요');
      return;
    }
    setChangePinLoading(true);
    try {
      const result = await changeOwnerPin(changePinPhone.trim(), changePinCurrent, changePinNew);
      if (!result.success) {
        Alert.alert('변경 실패', result.error ?? '다시 시도해주세요');
        return;
      }
      const remaining = result.remainingChanges;
      const msg = remaining !== null
        ? `이번 달 남은 변경 횟수: ${remaining}회`
        : '';
      Alert.alert('✅ PIN 변경 완료', msg || 'PIN이 성공적으로 변경되었습니다.', [
        {
          text: '확인',
          onPress: () => {
            setChangePinModal(false);
            setChangePinPhone('');
            setChangePinCurrent('');
            setChangePinNew('');
            setChangePinConfirm('');
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '다시 시도해주세요');
    } finally {
      setChangePinLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '사장님 모드를 종료할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료', style: 'destructive',
        onPress: async () => {
          await ownerLogout();
          navigation.replace('OwnerLogin');
        },
      },
    ]);
  };

  const openNotifModal = (type: NotifType) => {
    setNotifType(type);
    setNotifTitle('');
    setNotifDiscount('');
    setNotifEndTime('');
    setModalVisible(true);
  };

  const handleSendNotification = async () => {
    if (!notifTitle || !notifDiscount) {
      Alert.alert('제목과 할인 정보를 입력해주세요');
      return;
    }
    setSending(true);
    try {
      if (notifType === 'coupon') {
        await sendCouponNotification(notifTitle, notifDiscount);
      } else {
        await sendTimeSaleNotification('우리동네 맛집', notifDiscount, notifEndTime || '마감 전');
      }
      setModalVisible(false);
      Alert.alert(
        '알림 발송 완료! 🎉',
        `단골 고객에게 ${notifType === 'coupon' ? '쿠폰' : '타임세일'} 알림을 발송했어요`,
      );
    } catch (e) {
      Alert.alert('발송 실패', '알림 발송 중 오류가 발생했어요');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>🍖 사장님 대시보드</Text>
            <Text style={styles.date}>2026년 3월 23일</Text>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* 통계 카드 */}
        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <View key={s.label} style={[styles.statCard, D_SHADOW]}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* 알림 발송 패널 */}
        <Text style={styles.sectionTitle}>📣 단골 알림 발송</Text>
        <View style={[styles.notifPanel, D_SHADOW]}>
          <Text style={styles.notifPanelDesc}>
            알림을 받기로 한 단골 고객에게{'\n'}쿠폰 · 타임세일 소식을 바로 전달해요
          </Text>

          <View style={styles.notifBtnRow}>
            {/* 쿠폰 알림 */}
            <TouchableOpacity
              style={[styles.notifBtn, styles.notifBtnCoupon]}
              onPress={() => openNotifModal('coupon')}
              activeOpacity={0.85}
            >
              <Text style={styles.notifBtnEmoji}>🎟</Text>
              <Text style={styles.notifBtnTitle}>쿠폰 알림</Text>
              <Text style={styles.notifBtnSub}>새 쿠폰 발급 소식</Text>
            </TouchableOpacity>

            {/* 타임세일 알림 */}
            <TouchableOpacity
              style={[styles.notifBtn, styles.notifBtnTimeSale]}
              onPress={() => openNotifModal('timesale')}
              activeOpacity={0.85}
            >
              <Text style={styles.notifBtnEmoji}>⚡</Text>
              <Text style={styles.notifBtnTitle}>타임세일 알림</Text>
              <Text style={styles.notifBtnSub}>한시 특가 긴급 발송</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 관리 메뉴 */}
        <Text style={styles.sectionTitle}>관리 메뉴</Text>
        <View style={styles.menuGrid}>
          <MenuButton icon="🎟" label="쿠폰 생성"  color={L.accent}
            onPress={() => navigation.navigate('CouponCreate')} />
          <MenuButton icon="📋" label="쿠폰 관리"  color="#4ECDC4"
            onPress={() => navigation.navigate('CouponManage')} />
          <MenuButton icon="📷" label="QR 스캔"    color="#FFD93D"
            onPress={() => navigation.navigate('QRScanner')} />
          <MenuButton icon="🪙" label="방문 QR"    color="#2DB87A"
            onPress={() => navigation.navigate('StoreQR')} />
          <MenuButton icon="🔐" label="PIN 변경"   color="#9B59B6"
            onPress={() => setChangePinModal(true)} />
        </View>

        {/* ── TTS 안내방송 ── */}
        <Text style={styles.sectionTitle}>📢 안내방송</Text>
        <View style={[styles.ttsPanel, { shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }]}>
          <Text style={styles.ttsPanelDesc}>
            음악 볼륨을 줄이고 안내 방송을 즉시 내보내요{'\n'}
            가게 이벤트, 마감 임박 등을 고객에게 전달하세요
          </Text>
          <TouchableOpacity
            style={styles.ttsCreateBtn}
            onPress={() => { setTtsText(''); setTtsAudioUrl(null); setTtsModal(true); }}
            activeOpacity={0.85}
          >
            <Text style={styles.ttsCreateBtnEmoji}>🎙</Text>
            <Text style={styles.ttsCreateBtnText}>안내방송 만들기</Text>
          </TouchableOpacity>

          {/* 최근 방송 이력 */}
          {myAnnouncements.length > 0 && (
            <View style={styles.ttsHistory}>
              <Text style={styles.ttsHistoryTitle}>최근 방송</Text>
              {myAnnouncements.slice(0, 3).map(ann => (
                <View key={ann.id} style={styles.ttsHistoryItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ttsHistoryText} numberOfLines={1}>{ann.text}</Text>
                    <Text style={styles.ttsHistoryMeta}>
                      {fishVoices.find(v => v.ref_id === ann.voice_type)?.label ?? ann.voice_type}
                      {'  '}·{'  '}
                      {ann.play_mode === 'immediate' ? '즉시 방송' : '곡간 삽입'}
                      {'  '}·{'  '}
                      {new Date(ann.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={styles.ttsHistoryBtns}>
                    {ann.audio_url && (() => {
                      const isThisPlaying = playingUrl === ann.audio_url && ttsPlaying;
                      return (
                        <TouchableOpacity
                          style={[styles.ttsPlayBtn, isThisPlaying && styles.ttsPlayBtnActive]}
                          onPress={() => handlePreviewTTS(ann.audio_url!)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.ttsPlayBtnText}>{isThisPlaying ? '⏹' : '▶'}</Text>
                        </TouchableOpacity>
                      );
                    })()}
                    <TouchableOpacity
                      style={styles.ttsDelBtn}
                      onPress={() => handleDeleteAnnouncement(ann.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.ttsDelBtnText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── 스레드 게시물 작성 ── */}
        <Text style={styles.sectionTitle}>📝 피드 게시물</Text>

        {/* 운영 시간 안내 배지 */}
        <View style={styles.postTimeInfo}>
          <Text style={styles.postTimeInfoText}>
            🕐 게시 가능 시간: {postSettings.post_start_hour}시 ~ {postSettings.post_end_hour}시
            {'  '}|{'  '}
            ⏱ 게시 간격: {postSettings.post_cooldown_hours}시간
          </Text>
        </View>

        {storeCoupons.length === 0 ? (
          <View style={[styles.postWriteDisabled, D_SHADOW]}>
            <Text style={styles.postWriteDisabledEmoji}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.postWriteDisabledTitle}>게시물 작성 불가</Text>
              <Text style={styles.postWriteDisabledSub}>
                발행 중인 쿠폰이 없어요.{'\n'}쿠폰을 먼저 등록하면 피드에 게시물을 올릴 수 있어요.
              </Text>
            </View>
          </View>
        ) : cooldownRemain > 0 ? (
          <View style={[styles.postWriteDisabled, D_SHADOW]}>
            <Text style={styles.postWriteDisabledEmoji}>⏳</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.postWriteDisabledTitle}>게시물 쿨다운 중</Text>
              <Text style={styles.postWriteDisabledSub}>
                {(() => {
                  const h = Math.floor(cooldownRemain / 3600);
                  const m = Math.floor((cooldownRemain % 3600) / 60);
                  return h > 0
                    ? `${h}시간 ${m}분 후에 다시 작성할 수 있어요`
                    : `${m}분 후에 다시 작성할 수 있어요`;
                })()}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.postWriteBtn, D_SHADOW]}
            onPress={() => { setPostContent(''); setPostCouponId(null); setPostModal(true); }}
            activeOpacity={0.85}
          >
            <Text style={styles.postWriteEmoji}>✏️</Text>
            <Text style={styles.postWriteText}>고객에게 게시물을 남겨보세요</Text>
            <Text style={styles.postWriteArrow}>＋</Text>
          </TouchableOpacity>
        )}

        {/* 최근 게시물 목록 */}
        {myPosts.length > 0 && (
          <View style={styles.postList}>
            {myPosts.slice(0, 5).map(post => {
              const pendingReq = myDeleteRequests.find(r => r.post_id === post.id && r.status === 'pending');
              const hasActiveCoupon = storeCoupons.length > 0;
              return (
                <View key={post.id} style={[styles.postItem, D_SHADOW]}>
                  <View style={styles.postItemTop}>
                    <Text style={styles.postItemTime}>
                      {new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </Text>
                    <View style={styles.postLikeChip}>
                      <Text style={styles.postLikeText}>❤️ {post.like_count}</Text>
                    </View>
                    {/* 수정 버튼 */}
                    <TouchableOpacity
                      style={styles.postActionBtn}
                      onPress={() => { setEditingPost(post); setEditContent(post.content); setEditModal(true); }}
                    >
                      <Text style={styles.postActionEdit}>✏️ 수정</Text>
                    </TouchableOpacity>
                    {/* 삭제 요청 버튼 */}
                    {pendingReq ? (
                      <View style={styles.postDeletePending}>
                        <Text style={styles.postDeletePendingText}>⏳ 삭제 요청 중</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.postActionBtn, hasActiveCoupon && styles.postActionBtnMuted]}
                        onPress={() => {
                          setDeleteReqPost(post);
                          setDeleteReqReason('');
                          setDeleteReqModal(true);
                        }}
                      >
                        <Text style={[styles.postActionDel, hasActiveCoupon && { color: '#CCC' }]}>
                          🗑 삭제 요청
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.postItemContent} numberOfLines={2}>{post.content}</Text>
                  {post.linked_coupon_id && (
                    <Text style={styles.postItemCouponChip}>🎟 쿠폰 첨부됨</Text>
                  )}
                  {hasActiveCoupon && (
                    <Text style={styles.postCouponActiveNote}>
                      ⚠️ 발급중인 쿠폰이 있어 삭제 요청 승인이 제한될 수 있어요
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* 쿠폰 사용 비밀번호 (PIN) */}
        <Text style={styles.sectionTitle}>🔑 쿠폰 사용 비밀번호</Text>
        <View style={[styles.pinCard, D_SHADOW]}>
          {couponPin ? (
            <>
              <View style={styles.pinDisplay}>
                <View>
                  <Text style={styles.pinLabel}>현재 비밀번호</Text>
                  <Text style={styles.pinValue}>
                    {pinVisible ? couponPin : '● ● ● ●'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.pinEyeBtn}
                  onPress={() => setPinVisible(v => !v)}
                >
                  <Text style={styles.pinEyeText}>{pinVisible ? '🙈 숨기기' : '👁 보기'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.pinGuide}>
                고객이 쿠폰 화면에서 이 번호를 입력하면 쿠폰이 사용돼요
              </Text>
              <View style={styles.pinBtnRow}>
                <TouchableOpacity
                  style={[styles.pinBtn, styles.pinBtnOutline]}
                  onPress={() => { setPinInput(''); setPinModal(true); }}
                >
                  <Text style={styles.pinBtnOutlineText}>✏️ 직접 변경</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pinBtn, styles.pinBtnFill, pinSaving && { opacity: 0.6 }]}
                  onPress={handleAutoGeneratePin}
                  disabled={pinSaving}
                >
                  {pinSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.pinBtnFillText}>🔄 자동 재발급</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.pinEmptyText}>
                아직 쿠폰 비밀번호가 없어요{'\n'}
                발급하면 고객이 QR 대신 비밀번호로 쿠폰을 사용할 수 있어요
              </Text>
              <TouchableOpacity
                style={[styles.pinBtnFull, pinSaving && { opacity: 0.6 }]}
                onPress={handleAutoGeneratePin}
                disabled={pinSaving}
              >
                {pinSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.pinBtnFullText}>🔑 비밀번호 발급받기</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 스탬프 리워드 설정 */}
        <Text style={styles.sectionTitle}>🍀 스탬프 리워드 설정</Text>
        <TouchableOpacity
          style={[styles.stampSettingCard, D_SHADOW]}
          onPress={() => setStampModal(true)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.stampSettingTitle}>
              스탬프 {stampGoal}개 완성 리워드
            </Text>
            <Text style={styles.stampSettingReward} numberOfLines={1}>
              {stampReward || '리워드 내용을 입력하세요 (탭해서 설정)'}
            </Text>
          </View>
          <Text style={styles.stampSettingArrow}>✏️</Text>
        </TouchableOpacity>

        {/* ── 매장 컨텍스트 ── */}
        <Text style={styles.sectionTitle}>📍 매장 환경 분석</Text>
        <View style={[styles.dnaPanel, D_SHADOW]}>
          <Text style={styles.dnaPanelDesc}>
            위치·날씨·상권 정보를 수집해 음악 큐레이션에 활용해요
          </Text>

          {/* 현재 컨텍스트 표시 */}
          {storeContext && (
            <View style={styles.contextInfoRow}>
              <View style={styles.contextBadge}>
                <Text style={styles.contextBadgeText}>
                  {DISTRICT_TYPE_LABEL[storeContext.district_type] ?? storeContext.district_type}
                </Text>
              </View>
              <View style={styles.contextBadge}>
                <Text style={styles.contextBadgeText}>
                  {WEATHER_ZONE_LABEL[storeContext.weather_zone] ?? storeContext.weather_zone}
                  {' '}{storeContext.weather_temp.toFixed(1)}°C
                </Text>
              </View>
              {storeContext.district_detail ? (
                <Text style={styles.contextDetailText} numberOfLines={1}>
                  📌 {storeContext.district_detail}
                </Text>
              ) : null}
            </View>
          )}

          {/* 위치·날씨 수집 버튼 */}
          <TouchableOpacity
            style={[styles.dnaBtn, contextLoading && styles.dnaBtnDisabled]}
            onPress={handleCollectContext}
            disabled={contextLoading}
          >
            {contextLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.dnaBtnText}>
                  {storeContext ? '🔄 위치·날씨 업데이트' : '📡 위치·날씨 수집 시작'}
                </Text>
            }
          </TouchableOpacity>

          {/* 메뉴 태그 입력 */}
          <Text style={[styles.dnaLabel, { marginTop: 14 }]}>🍽 대표 메뉴</Text>
          <View style={styles.menuTagInputRow}>
            <TextInput
              style={styles.menuTagInput}
              value={menuInput}
              onChangeText={setMenuInput}
              placeholder="메뉴 입력 후 추가 (예: 삼겹살)"
              placeholderTextColor="#666"
              onSubmitEditing={handleAddMenuTag}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.menuTagAddBtn} onPress={handleAddMenuTag}>
              <Text style={styles.menuTagAddBtnText}>추가</Text>
            </TouchableOpacity>
          </View>
          {menuTagList.length > 0 && (
            <View style={styles.dnaTagRow}>
              {menuTagList.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={styles.menuTag}
                  onPress={() => handleRemoveMenuTag(tag)}
                >
                  <Text style={styles.menuTagText}>{tag} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      {/* ── 게시물 작성 모달 ── */}
      <Modal visible={postModal} transparent animationType="slide" onRequestClose={() => setPostModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>📝 피드 게시물 작성</Text>
            <Text style={styles.modalDesc}>작성한 게시물은 언니픽 쿠폰 피드에 노출돼요</Text>

            {/* 본문 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>내용 *</Text>
              <TextInput
                style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
                value={postContent}
                onChangeText={setPostContent}
                placeholder={'오늘 특별 할인 진행합니다! 🎉\n많은 방문 부탁드려요'}
                placeholderTextColor={L.muted}
                multiline
                maxLength={500}
              />
              <Text style={{ textAlign: 'right', fontSize: 11, color: L.muted, marginTop: 2 }}>
                {postContent.length}/500
              </Text>
            </View>

            {/* 쿠폰 첨부 */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>🎟 쿠폰 첨부 (선택)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                  {/* 없음 */}
                  <TouchableOpacity
                    style={[styles.couponChip, postCouponId === null && styles.couponChipActive]}
                    onPress={() => setPostCouponId(null)}
                  >
                    <Text style={[styles.couponChipText, postCouponId === null && styles.couponChipTextActive]}>
                      없음
                    </Text>
                  </TouchableOpacity>
                  {storeCoupons.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.couponChip, postCouponId === c.id && styles.couponChipActive]}
                      onPress={() => setPostCouponId(c.id)}
                    >
                      <Text style={[styles.couponChipText, postCouponId === c.id && styles.couponChipTextActive]}
                        numberOfLines={1}>
                        🎟 {c.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPostModal(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, postPosting && styles.sendBtnDisabled]}
                onPress={handlePostSubmit}
                disabled={postPosting || !postContent.trim()}
              >
                {postPosting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.sendBtnText}>📤 게시하기</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 게시물 수정 모달 ── */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>✏️ 게시물 수정</Text>
            <Text style={styles.modalDesc}>수정 내역은 시샵 로그에 기록돼요</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>내용 *</Text>
              <TextInput
                style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
                value={editContent}
                onChangeText={setEditContent}
                multiline
                maxLength={500}
                placeholderTextColor={L.muted}
              />
              <Text style={{ textAlign: 'right', fontSize: 11, color: L.muted, marginTop: 2 }}>
                {editContent.length}/500
              </Text>
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, editPosting && styles.sendBtnDisabled]}
                onPress={handleEditSubmit}
                disabled={editPosting || !editContent.trim()}
              >
                {editPosting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.sendBtnText}>✅ 저장</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 게시물 삭제 요청 모달 ── */}
      <Modal visible={deleteReqModal} transparent animationType="slide" onRequestClose={() => setDeleteReqModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '75%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🗑 게시물 삭제 요청</Text>
            <Text style={styles.modalDesc}>삭제 사유를 작성해서 시샵에게 요청해요{'\n'}승인 후 게시물이 삭제됩니다</Text>

            {/* 게시물 미리보기 */}
            {deleteReqPost && (
              <View style={styles.deleteReqPreview}>
                <Text style={styles.deleteReqPreviewText} numberOfLines={2}>
                  {deleteReqPost.content}
                </Text>
              </View>
            )}

            {/* 발급중인 쿠폰 경고 */}
            {storeCoupons.length > 0 && (
              <View style={styles.deleteReqWarning}>
                <Text style={styles.deleteReqWarningText}>
                  ⚠️ 현재 발급 중인 쿠폰이 있어 삭제 요청이 반려될 수 있어요
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>삭제 사유 *</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={deleteReqReason}
                onChangeText={setDeleteReqReason}
                placeholder={'예) 잘못된 정보가 포함되어 수정 후 재게시 예정입니다'}
                placeholderTextColor={L.muted}
                multiline
                maxLength={200}
              />
              <Text style={{ textAlign: 'right', fontSize: 11, color: L.muted, marginTop: 2 }}>
                {deleteReqReason.length}/200
              </Text>
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteReqModal(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: L.error }, deleteReqSending && styles.sendBtnDisabled]}
                onPress={handleDeleteRequestSubmit}
                disabled={deleteReqSending || !deleteReqReason.trim()}
              >
                {deleteReqSending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.sendBtnText}>📨 요청 보내기</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 알림 발송 모달 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {notifType === 'coupon' ? '🎟 쿠폰 알림 발송' : '⚡ 타임세일 알림 발송'}
            </Text>
            <Text style={styles.modalDesc}>
              단골 알림 수신 고객 전체에게 발송됩니다
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {notifType === 'coupon' ? '쿠폰 이름 *' : '타임세일 메뉴 *'}
              </Text>
              <TextInput
                style={styles.input}
                value={notifTitle}
                onChangeText={setNotifTitle}
                placeholder={notifType === 'coupon' ? '예) 삼겹살 세트 쿠폰' : '예) 런치 특선'}
                placeholderTextColor={L.muted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>할인 내용 *</Text>
              <TextInput
                style={styles.input}
                value={notifDiscount}
                onChangeText={setNotifDiscount}
                placeholder="예) 20% 할인 또는 3,000원 할인"
                placeholderTextColor={L.muted}
              />
            </View>

            {notifType === 'timesale' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>종료 시간</Text>
                <TextInput
                  style={styles.input}
                  value={notifEndTime}
                  onChangeText={setNotifEndTime}
                  placeholder="예) 오후 6시"
                  placeholderTextColor={L.muted}
                />
              </View>
            )}

            {/* 미리보기 */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>알림 미리보기</Text>
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>
                  {notifType === 'coupon'
                    ? '🎟 새 쿠폰이 도착했어요!'
                    : `⚡ 우리동네 맛집 타임세일!`}
                </Text>
                <Text style={styles.previewBody}>
                  {notifType === 'coupon'
                    ? `${notifTitle || '쿠폰 이름'} - ${notifDiscount || '할인 내용'} 쿠폰을 지금 바로 받으세요!`
                    : `${notifDiscount || '할인 내용'}! ${notifEndTime || '마감 전'}까지만 진행돼요.`}
                </Text>
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={handleSendNotification}
                disabled={sending}
              >
                <Text style={styles.sendBtnText}>
                  {sending ? '발송 중...' : '📣 발송하기'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PIN 직접 변경 모달 */}
      <Modal visible={pinModal} transparent animationType="slide"
        onRequestClose={() => setPinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🔑 비밀번호 직접 변경</Text>
            <Text style={styles.modalDesc}>
              사용할 4자리 숫자를 입력해주세요{'\n'}
              다른 가게와 같은 번호도 사용할 수 있어요
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>새 비밀번호 (숫자 4자리)</Text>
              <TextInput
                style={[styles.input, { letterSpacing: 12, fontSize: 22, fontWeight: '800',
                  textAlign: 'center' }]}
                value={pinInput}
                onChangeText={v => setPinInput(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="0 0 0 0"
                placeholderTextColor={L.muted}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPinModal(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, (pinSaving || pinInput.length < 4) && styles.sendBtnDisabled]}
                onPress={handleSaveManualPin}
                disabled={pinSaving || pinInput.length < 4}
              >
                {pinSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.sendBtnText}>💾 저장</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 사장님 PIN 변경 모달 ── */}
      <Modal visible={changePinModal} transparent animationType="slide"
        onRequestClose={() => setChangePinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🔐 PIN 변경</Text>
            <Text style={styles.modalDesc}>
              로그인 시 사용하는 6자리 PIN을 변경합니다{'\n'}
              이번 달 최대 2회까지 변경 가능합니다
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>전화번호</Text>
              <TextInput
                style={styles.input}
                value={changePinPhone}
                onChangeText={setChangePinPhone}
                placeholder="01012345678"
                placeholderTextColor={L.muted}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>현재 PIN (6자리)</Text>
              <TextInput
                style={[styles.input, { letterSpacing: 8, fontSize: 20, fontWeight: '800', textAlign: 'center' }]}
                value={changePinCurrent}
                onChangeText={v => setChangePinCurrent(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="● ● ● ● ● ●"
                placeholderTextColor={L.muted}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>새 PIN (6자리)</Text>
              <TextInput
                style={[styles.input, { letterSpacing: 8, fontSize: 20, fontWeight: '800', textAlign: 'center' }]}
                value={changePinNew}
                onChangeText={v => setChangePinNew(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="● ● ● ● ● ●"
                placeholderTextColor={L.muted}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>새 PIN 확인</Text>
              <TextInput
                style={[styles.input, { letterSpacing: 8, fontSize: 20, fontWeight: '800', textAlign: 'center' },
                  changePinConfirm.length === 6 && changePinNew !== changePinConfirm
                    ? { borderColor: '#EF4444' } : {}]}
                value={changePinConfirm}
                onChangeText={v => setChangePinConfirm(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="● ● ● ● ● ●"
                placeholderTextColor={L.muted}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
              {changePinConfirm.length === 6 && changePinNew !== changePinConfirm && (
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>PIN이 일치하지 않습니다</Text>
              )}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                setChangePinModal(false);
                setChangePinPhone(''); setChangePinCurrent('');
                setChangePinNew(''); setChangePinConfirm('');
              }}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn,
                  (changePinLoading || changePinPhone.length < 10 ||
                   changePinCurrent.length < 6 || changePinNew.length < 6 ||
                   changePinConfirm.length < 6) && styles.sendBtnDisabled]}
                onPress={handleChangePin}
                disabled={changePinLoading || changePinPhone.length < 10 ||
                  changePinCurrent.length < 6 || changePinNew.length < 6 ||
                  changePinConfirm.length < 6}
              >
                {changePinLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.sendBtnText}>🔐 변경</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── TTS 안내방송 생성 모달 ── */}
      <Modal visible={ttsModal} transparent animationType="slide"
        onRequestClose={closeTtsModal}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeTtsModal}
        >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {/* 상단 핸들 + 닫기 버튼 */}
              <View style={styles.modalHandle} />
              <View style={styles.ttsModalHeader}>
                <Text style={styles.modalTitle}>🎙 안내방송 만들기</Text>
                <TouchableOpacity
                  style={styles.ttsCloseBtn}
                  onPress={closeTtsModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ttsCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalDesc}>
                텍스트를 입력하면 AI가 음성으로 변환해드려요
              </Text>

              {/* 자주 쓰는 템플릿 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>⚡ 빠른 템플릿</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.templateList}
                >
                  {templates.map((tpl, i) => {
                    const isActive = selectedTplIdx === i;
                    const hasSchedule = tpl.schedTime && tpl.schedTime.length > 0;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.templateChip, isActive && styles.templateChipActive]}
                        onPress={() => handleSelectTemplate(i)}
                        onLongPress={() => handleOpenTplEdit(i)}
                        delayLongPress={500}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.templateEmoji}>{tpl.emoji}</Text>
                        <Text style={[styles.templateLabel, isActive && styles.templateLabelActive]}>
                          {tpl.label}
                        </Text>
                        {hasSchedule && <Text style={styles.templateScheduleBadge}>⏰</Text>}
                        <Text style={styles.templateEditHint}>✏️</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {/* 템플릿 추가 버튼 */}
                  <TouchableOpacity
                    style={styles.templateAddChip}
                    onPress={() => handleOpenTplEdit(null)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.templateAddIcon}>＋</Text>
                    <Text style={styles.templateAddLabel}>추가</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* 선택된 템플릿의 예약 정보 요약 */}
              {selectedTplIdx !== null && (() => {
                const tpl = templates[selectedTplIdx];
                const hasSched = tpl.schedDays?.length > 0 && tpl.schedTime;
                return (
                  <View style={styles.schedSummaryCard}>
                    <View style={styles.schedSummaryLeft}>
                      {hasSched ? (
                        <>
                          <Text style={styles.schedSummaryTitle}>
                            📅 {tpl.schedDays.map(d => DAYS_KR[d]).join('·')} {tpl.schedTime}
                          </Text>
                          <Text style={styles.schedSummaryDesc}>
                            🔁 {tpl.schedRepeat ?? 1}회 반복 예약 설정됨
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.schedSummaryTitle}>⚡ 즉시 방송 (예약 없음)</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.schedEditBtn}
                      onPress={() => handleOpenTplEdit(selectedTplIdx)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.schedEditBtnText}>예약 설정</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {/* 안내 텍스트 */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>안내 내용 *</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {/* AI 생성 버튼 */}
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                        backgroundColor: aiPanel ? L.accent : L.accentFaint,
                        borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
                        borderWidth: 1, borderColor: L.accent }}
                      onPress={() => setAiPanel(p => !p)}
                    >
                      <Text style={{ fontSize: 12 }}>✨</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700',
                        color: aiPanel ? '#fff' : L.accent }}>AI 생성</Text>
                    </TouchableOpacity>
                    {/* 선택된 템플릿 + 내용 변경 시 저장 버튼 표시 */}
                    {selectedTplIdx !== null &&
                      ttsText.trim() !== templates[selectedTplIdx].text && (
                      <TouchableOpacity
                        style={styles.templateSaveBtn}
                        onPress={handleSaveToTemplate}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.templateSaveBtnText}>📌 템플릿 저장</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* ── AI 문구 생성 패널 ───────────────────────── */}
                {aiPanel && (
                  <View style={{
                    backgroundColor: L.accentFaint,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,111,15,0.25)',
                    padding: 12,
                    gap: 10,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: L.accent }}>
                      ✨ 어떤 상황인가요?
                    </Text>
                    {/* 상황 칩 */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}>
                      {AI_CHIPS.map(chip => (
                        <TouchableOpacity
                          key={chip}
                          onPress={() => setAiSituation(aiSituation === chip ? '' : chip)}
                          style={{
                            paddingHorizontal: 12, paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: aiSituation === chip ? L.accent : L.elevated,
                            borderWidth: 1,
                            borderColor: aiSituation === chip ? L.accent : L.border,
                          }}
                        >
                          <Text style={{
                            fontSize: 12, fontWeight: '600',
                            color: aiSituation === chip ? '#fff' : L.sub,
                          }}>{chip}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {/* 직접 입력 */}
                    <TextInput
                      style={[styles.input, { minHeight: 40 }]}
                      value={aiSituation}
                      onChangeText={setAiSituation}
                      placeholder="직접 입력 (예: 우천 시 우산 대여 안내)"
                      placeholderTextColor={L.muted}
                    />
                    {/* 생성 버튼 */}
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 6, backgroundColor: L.accent, borderRadius: 10,
                        paddingVertical: 10,
                        opacity: aiGenerating ? 0.6 : 1,
                      }}
                      onPress={handleAIGenerate}
                      disabled={aiGenerating}
                      activeOpacity={0.8}
                    >
                      {aiGenerating
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={{ fontSize: 13 }}>✨</Text>}
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                        {aiGenerating ? 'AI 생성 중...' : '문구 생성하기'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TextInput
                  style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
                  value={ttsText}
                  onChangeText={v => { setTtsText(v); setTtsAudioUrl(null); }}
                  placeholder={'예) 오늘 오후 3시까지 아메리카노 1+1 이벤트 진행 중입니다!'}
                  placeholderTextColor={L.muted}
                  multiline
                  maxLength={200}
                />
                <Text style={{ textAlign: 'right', fontSize: 11,
                  color: L.muted, marginTop: 2 }}>
                  {ttsText.length}/200
                </Text>
              </View>

              {/* 목소리 선택 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🎙 목소리 선택</Text>
                <Text style={styles.ttsSampleHint}>▶ 버튼으로 샘플을 들어보세요</Text>
                <View style={styles.ttsVoiceList}>
                  {fishVoices.map(v => {
                    const isSelected   = ttsVoice === v.ref_id;
                    const isSampling   = samplingVoice === v.ref_id;
                    const isPlayingNow = playingVoice === v.ref_id;
                    return (
                      <View key={v.ref_id} style={[styles.ttsVoiceRow, isSelected && styles.ttsVoiceRowActive]}>
                        {/* 선택 영역 */}
                        <TouchableOpacity
                          style={styles.ttsVoiceSelect}
                          onPress={() => setTtsVoice(v.ref_id)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.ttsRadio, isSelected && styles.ttsRadioActive]}>
                            {isSelected && <View style={styles.ttsRadioDot} />}
                          </View>
                          <Text style={styles.ttsVoiceEmoji}>{v.emoji}</Text>
                          <Text style={[styles.ttsVoiceLabel, isSelected && styles.ttsVoiceLabelActive]}>
                            {v.label}
                          </Text>
                          {voiceSamples[v.ref_id] && !isSampling && (
                            <View style={styles.ttsCachedBadge}>
                              <Text style={styles.ttsCachedText}>캐시됨</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* 샘플 재생 버튼 */}
                        <TouchableOpacity
                          style={[styles.ttsSampleBtn, isPlayingNow && styles.ttsSampleBtnPlaying]}
                          onPress={() => handleVoiceSample(v.ref_id)}
                          activeOpacity={0.75}
                          disabled={isSampling}
                        >
                          {isSampling
                            ? <ActivityIndicator size="small" color="#FF6F0F" />
                            : <Text style={[styles.ttsSampleBtnText, isPlayingNow && { color: '#FF6F0F' }]}>
                                {isPlayingNow ? '⏹' : '▶'}
                              </Text>
                          }
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* 재생 방식 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>📻 재생 방식</Text>
                <View style={{ gap: 8 }}>
                  {([
                    { key: 'immediate',     label: '즉시 방송', sub: '음악 볼륨 줄이고 바로 방송', emoji: '🔊' },
                    { key: 'between_tracks', label: '곡 사이 삽입', sub: '다음 곡 시작 전 자동 삽입', emoji: '⏭' },
                  ] as { key: 'immediate' | 'between_tracks'; label: string; sub: string; emoji: string }[])
                    .map(mode => (
                      <TouchableOpacity
                        key={mode.key}
                        style={[styles.ttsModeRow, ttsPlayMode === mode.key && styles.ttsModeRowActive]}
                        onPress={() => setTtsPlayMode(mode.key)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.ttsModeEmoji}>{mode.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.ttsModeLabel,
                            ttsPlayMode === mode.key && styles.ttsModeLabelActive]}>
                            {mode.label}
                          </Text>
                          <Text style={styles.ttsModeSub}>{mode.sub}</Text>
                        </View>
                        <View style={[styles.ttsRadio, ttsPlayMode === mode.key && styles.ttsRadioActive]}>
                          {ttsPlayMode === mode.key && <View style={styles.ttsRadioDot} />}
                        </View>
                      </TouchableOpacity>
                    ))
                  }
                </View>
              </View>

              {/* 발음 속도 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🎚 발음 속도</Text>
                <View style={styles.speedRow}>
                  {/* 느리게 / 빠르게 버튼 */}
                  <TouchableOpacity
                    style={[styles.speedBtn, ttsSpeed <= 0.5 && styles.speedBtnDisabled]}
                    onPress={() => setTtsSpeed(v => Math.max(0.5, Math.round((v - 0.25) * 100) / 100))}
                    disabled={ttsSpeed <= 0.5}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.speedBtnText}>−</Text>
                  </TouchableOpacity>

                  {/* 현재 속도 표시 + 프리셋 라벨 */}
                  <View style={styles.speedDisplay}>
                    <Text style={styles.speedValue}>{ttsSpeed.toFixed(2)}x</Text>
                    <Text style={styles.speedLabel}>
                      {ttsSpeed <= 0.75 ? '🐢 느리게'
                        : ttsSpeed <= 0.9 ? '🚶 천천히'
                        : ttsSpeed <= 1.1 ? '▶ 보통'
                        : ttsSpeed <= 1.35 ? '🐇 빠르게'
                        : '⚡ 매우빠르게'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.speedBtn, ttsSpeed >= 2.0 && styles.speedBtnDisabled]}
                    onPress={() => setTtsSpeed(v => Math.min(2.0, Math.round((v + 0.25) * 100) / 100))}
                    disabled={ttsSpeed >= 2.0}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.speedBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* 빠른 프리셋 칩 */}
                <View style={styles.speedPresets}>
                  {[
                    { label: '0.75x', value: 0.75 },
                    { label: '1.0x',  value: 1.0  },
                    { label: '1.25x', value: 1.25 },
                    { label: '1.5x',  value: 1.5  },
                  ].map(p => (
                    <TouchableOpacity
                      key={p.value}
                      style={[styles.speedPresetChip,
                        Math.abs(ttsSpeed - p.value) < 0.01 && styles.speedPresetChipActive]}
                      onPress={() => setTtsSpeed(p.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.speedPresetText,
                        Math.abs(ttsSpeed - p.value) < 0.01 && styles.speedPresetTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 반복 횟수 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🔁 반복 횟수</Text>
                <View style={styles.ttsRepeatRow}>
                  {[1, 2, 3].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.ttsRepeatChip, ttsRepeat === n && styles.ttsRepeatChipActive]}
                      onPress={() => setTtsRepeat(n)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.ttsRepeatText, ttsRepeat === n && styles.ttsRepeatTextActive]}>
                        {n}회
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 미리듣기 / 중지 (생성 후) */}
              {ttsAudioUrl && (() => {
                const isThisPlaying = playingUrl === ttsAudioUrl && ttsPlaying;
                return (
                  <TouchableOpacity
                    style={[styles.ttsPreviewBtn, isThisPlaying && styles.ttsPreviewBtnPlaying]}
                    onPress={() => handlePreviewTTS(ttsAudioUrl)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.ttsPreviewBtnText}>
                      {isThisPlaying ? '⏹ 중지' : '▶ 미리듣기'}
                    </Text>
                  </TouchableOpacity>
                );
              })()}

              {/* 버튼 */}
              <View style={[styles.modalBtnRow, { marginTop: 8 }]}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeTtsModal}>
                  <Text style={styles.cancelBtnText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: '#FF6F0F' },
                    (ttsGenerating || !ttsText.trim()) && styles.sendBtnDisabled]}
                  onPress={handleGenerateTTS}
                  disabled={ttsGenerating || !ttsText.trim()}
                >
                  {ttsGenerating
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.sendBtnText}>🎙 방송 생성</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 템플릿 편집/추가 모달 ── */}
      <Modal visible={tplEditModal} transparent animationType="slide"
        onRequestClose={() => setTplEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {tplEditIdx === null ? '➕ 템플릿 추가' : '✏️ 템플릿 수정'}
              </Text>
              <Text style={styles.modalDesc}>이모지, 라벨명, 문구 및 예약 설정을 입력하세요</Text>

              {/* 이모지 + 라벨 */}
              <View style={styles.tplEditRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>이모지</Text>
                  <TextInput
                    style={[styles.input, styles.tplEditEmojiInput]}
                    value={tplEditEmoji}
                    onChangeText={setTplEditEmoji}
                    maxLength={2}
                    placeholder="📢"
                    placeholderTextColor={L.muted}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>라벨명 *</Text>
                  <TextInput
                    style={styles.input}
                    value={tplEditLabel}
                    onChangeText={setTplEditLabel}
                    maxLength={10}
                    placeholder="예) 할인 이벤트"
                    placeholderTextColor={L.muted}
                  />
                </View>
              </View>

              {/* 문구 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>방송 문구 *</Text>
                <TextInput
                  style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
                  value={tplEditText}
                  onChangeText={setTplEditText}
                  multiline
                  maxLength={200}
                  placeholder="안내방송으로 나갈 문구를 입력하세요"
                  placeholderTextColor={L.muted}
                />
                <Text style={{ textAlign: 'right', fontSize: 11,
                  color: L.muted, marginTop: 2 }}>
                  {tplEditText.length}/200
                </Text>
              </View>

              {/* 예약 요일 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>📅 반복 요일 <Text style={styles.inputLabelSub}>(미선택 = 예약 없음)</Text></Text>
                <View style={styles.tplDayRow}>
                  {DAYS_KR.map((day, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.tplDayChip, tplEditDays.includes(i) && styles.tplDayChipActive]}
                      onPress={() => toggleDay(i)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tplDayText, tplEditDays.includes(i) && styles.tplDayTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 예약 시간 */}
              {tplEditDays.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>🕐 방송 시간</Text>
                  <TextInput
                    style={styles.input}
                    value={tplEditTime}
                    onChangeText={setTplEditTime}
                    placeholder="HH:MM  예) 09:00"
                    placeholderTextColor={L.muted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              )}

              {/* 반복 횟수 */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🔁 반복 횟수</Text>
                <View style={styles.ttsRepeatRow}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.ttsRepeatChip, tplEditRepeat === n && styles.ttsRepeatChipActive]}
                      onPress={() => setTplEditRepeat(n)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.ttsRepeatText, tplEditRepeat === n && styles.ttsRepeatTextActive]}>
                        {n}회
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 버튼 */}
              <View style={[styles.modalBtnRow, { marginTop: 8 }]}>
                {tplEditIdx !== null && (
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: '#DC2626' }]}
                    onPress={() => handleDeleteTemplate(tplEditIdx!)}
                  >
                    <Text style={[styles.cancelBtnText, { color: '#DC2626' }]}>삭제</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setTplEditModal(false)}>
                  <Text style={styles.cancelBtnText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: '#FF6F0F', flex: 1 }]}
                  onPress={handleConfirmTplEdit}
                >
                  <Text style={styles.sendBtnText}>저장</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 스탬프 리워드 설정 모달 */}
      <Modal visible={stampModal} transparent animationType="slide"
        onRequestClose={() => setStampModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🍀 스탬프 리워드 설정</Text>
            <Text style={styles.modalDesc}>
              고객이 스탬프를 모두 채웠을 때 받는 리워드를 설정해요
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>스탬프 목표 개수 (1~50)</Text>
              <TextInput
                style={styles.input}
                value={stampGoal}
                onChangeText={setStampGoal}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor={L.muted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>🎁 리워드 내용</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={stampReward}
                onChangeText={setStampReward}
                placeholder="예) 아메리카노 1잔 무료 / 10% 할인 쿠폰 증정"
                placeholderTextColor={L.muted}
                multiline
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStampModal(false)}>
                <Text style={styles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, stampSaving && styles.sendBtnDisabled]}
                onPress={handleSaveStampReward}
                disabled={stampSaving}
              >
                {stampSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.sendBtnText}>💾 저장</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function MenuButton({
  icon, label, color, onPress,
}: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.menuBtn, D_SHADOW, { borderTopColor: color, borderTopWidth: 4 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.menuBtnIcon}>{icon}</Text>
      <Text style={styles.menuBtnLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Linear Dark Design Tokens ───────────────────────────────────────────────
const D_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
};

const L = {
  bg:        '#08090A',   // page background
  surface:   '#16181D',   // card / panel surface
  elevated:  '#1E2025',   // elevated surface (inputs, chips)
  border:    'rgba(255,255,255,0.08)',
  borderMid: 'rgba(255,255,255,0.12)',
  text:      '#F7F8F8',
  sub:       '#9EA3AD',
  muted:     '#62666D',
  accent:    '#FF6F0F',
  accentDim: 'rgba(255,111,15,0.15)',
  accentFaint:'rgba(255,111,15,0.08)',
  success:   '#22C55E',
  successDim:'rgba(34,197,94,0.18)',
  error:     '#F87171',
  errorDim:  'rgba(248,113,113,0.18)',
  warn:      '#F59E0B',
  warnDim:   'rgba(245,158,11,0.15)',
  blue:      '#60A5FA',
  indigo:    '#818CF8',
  indigoDim: 'rgba(129,140,248,0.15)',
  pink:      '#F87171',
  pinkDim:   'rgba(248,113,113,0.15)',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: L.bg },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  title: { fontSize: 20, fontWeight: '800', color: L.text },
  date: { fontSize: 13, color: L.muted, marginTop: 2 },
  logoutText: { fontSize: 14, color: L.muted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: L.surface, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: L.border,
  },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 18, fontWeight: '800', color: L.accent },
  statLabel: { fontSize: 10, color: L.muted, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: L.text },
  notifPanel: {
    backgroundColor: L.surface, borderRadius: RADIUS.lg, padding: 16, gap: 14,
    borderWidth: 1, borderColor: L.border,
  },
  notifPanelDesc: {
    fontSize: 13, color: L.sub, lineHeight: 20,
  },
  notifBtnRow: { flexDirection: 'row', gap: 12 },
  notifBtn: {
    flex: 1, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', gap: 4,
  },
  notifBtnCoupon: { backgroundColor: L.accentDim },
  notifBtnTimeSale: { backgroundColor: 'rgba(255,211,61,0.15)' },
  notifBtnEmoji: { fontSize: 28 },
  notifBtnTitle: { fontSize: 14, fontWeight: '800', color: L.text },
  notifBtnSub: { fontSize: 11, color: L.muted },
  // ── TTS 모달 헤더
  ttsModalHeader:  { flexDirection: 'row', alignItems: 'center',
                     justifyContent: 'space-between', marginBottom: 4 },
  ttsCloseBtn:     { width: 32, height: 32, borderRadius: 16,
                     backgroundColor: L.elevated, borderWidth: 1,
                     borderColor: L.border,
                     alignItems: 'center', justifyContent: 'center' },
  ttsCloseBtnText: { fontSize: 14, color: L.muted, fontWeight: '700' },
  // ── 예약 요약 카드
  schedSummaryCard:  { flexDirection: 'row', alignItems: 'center',
                       backgroundColor: L.accentFaint, borderRadius: RADIUS.sm,
                       borderWidth: 1.5, borderColor: 'rgba(255,111,15,0.25)',
                       padding: 12, gap: 10, marginBottom: 4 },
  schedSummaryLeft:  { flex: 1, gap: 3 },
  schedSummaryTitle: { fontSize: 13, fontWeight: '700', color: L.accent },
  schedSummaryDesc:  { fontSize: 11, color: L.sub },
  schedEditBtn:      { paddingHorizontal: 10, paddingVertical: 6,
                       backgroundColor: L.accent, borderRadius: RADIUS.sm },
  schedEditBtnText:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  // ── TTS 안내방송
  ttsPanel:        { backgroundColor: L.surface, borderRadius: RADIUS.lg, padding: 16, gap: 12,
                     borderWidth: 1, borderColor: L.border },
  ttsPanelDesc:    { fontSize: 13, color: L.sub, lineHeight: 20 },
  ttsCreateBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10,
                     backgroundColor: L.accent, borderRadius: RADIUS.md,
                     paddingHorizontal: 16, paddingVertical: 14 },
  ttsCreateBtnEmoji:{ fontSize: 24 },
  ttsCreateBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  ttsHistory:      { borderTopWidth: 1, borderTopColor: L.border, paddingTop: 10, gap: 8 },
  ttsHistoryTitle: { fontSize: 12, fontWeight: '700', color: L.muted, marginBottom: 2 },
  ttsHistoryItem:  { flexDirection: 'row', alignItems: 'center', gap: 8,
                     backgroundColor: L.elevated, borderRadius: RADIUS.sm, padding: 10 },
  ttsHistoryText:  { fontSize: 13, fontWeight: '600', color: L.text },
  ttsHistoryMeta:  { fontSize: 11, color: L.muted, marginTop: 2 },
  ttsHistoryBtns:  { flexDirection: 'row', gap: 6 },
  ttsPlayBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: L.accentDim,
                     alignItems: 'center', justifyContent: 'center' },
  ttsPlayBtnText:  { fontSize: 14, color: L.accent, fontWeight: '800' },
  ttsDelBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: L.errorDim,
                     alignItems: 'center', justifyContent: 'center' },
  ttsDelBtnText:   { fontSize: 14 },
  // TTS 모달 내부
  templateList:          { gap: 8, paddingVertical: 4 },
  templateChip:          { alignItems: 'center', gap: 4,
                           paddingHorizontal: 14, paddingVertical: 10,
                           borderRadius: RADIUS.sm, borderWidth: 1.5,
                           borderColor: L.border, backgroundColor: L.elevated,
                           minWidth: 76 },
  templateChipActive:    { borderColor: L.accent, backgroundColor: L.accentFaint },
  templateEmoji:         { fontSize: 22 },
  templateLabel:         { fontSize: 11, fontWeight: '700', color: L.muted },
  templateLabelActive:    { color: L.accent },
  templateEditHint:       { fontSize: 9, color: L.muted, marginTop: 2 },
  templateScheduleBadge:  { fontSize: 9, marginTop: 2 },
  templateAddChip:        { alignItems: 'center', justifyContent: 'center', gap: 4,
                            paddingHorizontal: 14, paddingVertical: 10,
                            borderRadius: RADIUS.sm, borderWidth: 1.5,
                            borderColor: L.accent, borderStyle: 'dashed' as any,
                            minWidth: 64 },
  templateAddIcon:        { fontSize: 20, color: L.accent, fontWeight: '800' },
  templateAddLabel:       { fontSize: 11, fontWeight: '700', color: L.accent },
  inputLabelRow:         { flexDirection: 'row', alignItems: 'center',
                           justifyContent: 'space-between', marginBottom: 6 },
  templateSaveBtn:       { paddingHorizontal: 10, paddingVertical: 4,
                           backgroundColor: L.accent, borderRadius: RADIUS.sm },
  templateSaveBtnText:   { fontSize: 11, fontWeight: '800', color: '#fff' },
  // 발음 속도 조절
  speedRow:            { flexDirection: 'row', alignItems: 'center', gap: 12,
                         paddingVertical: 4 },
  speedBtn:            { width: 40, height: 40, borderRadius: 20,
                         borderWidth: 1.5, borderColor: L.border,
                         backgroundColor: L.elevated,
                         alignItems: 'center', justifyContent: 'center' },
  speedBtnDisabled:    { opacity: 0.3 },
  speedBtnText:        { fontSize: 22, fontWeight: '700', color: L.text, lineHeight: 26 },
  speedDisplay:        { flex: 1, alignItems: 'center', gap: 2 },
  speedValue:          { fontSize: 22, fontWeight: '800', color: L.accent },
  speedLabel:          { fontSize: 11, color: L.muted, fontWeight: '600' },
  speedPresets:        { flexDirection: 'row', gap: 8, marginTop: 10 },
  speedPresetChip:     { flex: 1, paddingVertical: 7, borderRadius: RADIUS.sm,
                         borderWidth: 1.5, borderColor: L.border,
                         backgroundColor: L.elevated, alignItems: 'center' },
  speedPresetChipActive: { borderColor: L.accent, backgroundColor: L.accentFaint },
  speedPresetText:     { fontSize: 12, fontWeight: '700', color: L.muted },
  speedPresetTextActive: { color: L.accent },
  inputLabelSub:         { fontSize: 11, fontWeight: '400', color: L.muted },
  // 템플릿 편집 모달
  tplEditRow:            { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  tplEditEmojiInput:     { width: 60, textAlign: 'center', fontSize: 22 },
  tplDayRow:             { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tplDayChip:            { width: 38, height: 38, borderRadius: 19,
                           borderWidth: 1.5, borderColor: L.border,
                           alignItems: 'center', justifyContent: 'center',
                           backgroundColor: L.elevated },
  tplDayChipActive:      { borderColor: L.accent, backgroundColor: L.accent },
  tplDayText:            { fontSize: 13, fontWeight: '700', color: L.muted },
  tplDayTextActive:      { color: '#fff' },
  ttsSampleHint:    { fontSize: 11, color: L.muted, marginBottom: 8, marginTop: -4 },
  ttsVoiceList:     { gap: 8 },
  ttsVoiceRow:      { flexDirection: 'row', alignItems: 'stretch',
                      borderWidth: 1.5, borderColor: L.border, borderRadius: RADIUS.sm,
                      backgroundColor: L.elevated, overflow: 'hidden' },
  ttsVoiceRowActive:{ borderColor: L.accent, backgroundColor: L.accentFaint },
  ttsVoiceSelect:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
                      paddingHorizontal: 12, paddingVertical: 12 },
  ttsVoiceEmoji:    { fontSize: 20 },
  ttsVoiceLabel:    { fontSize: 13, fontWeight: '600', color: L.muted, flex: 1 },
  ttsVoiceLabelActive: { color: L.accent },
  ttsCachedBadge:   { backgroundColor: L.successDim, borderRadius: 4,
                      paddingHorizontal: 5, paddingVertical: 2 },
  ttsCachedText:    { fontSize: 9, fontWeight: '700', color: L.success },
  ttsSampleBtn:     { width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
                      borderLeftWidth: 1, borderLeftColor: L.border,
                      backgroundColor: L.surface },
  ttsSampleBtnPlaying: { backgroundColor: L.accentFaint },
  ttsSampleBtnText: { fontSize: 16, color: L.muted, fontWeight: '700' },
  ttsModeRow:       { flexDirection: 'row', alignItems: 'center', gap: 10,
                      borderWidth: 1.5, borderColor: L.border, borderRadius: RADIUS.sm,
                      padding: 12, backgroundColor: L.elevated },
  ttsModeRowActive: { borderColor: L.accent, backgroundColor: L.accentFaint },
  ttsModeEmoji:     { fontSize: 20 },
  ttsModeLabel:     { fontSize: 14, fontWeight: '700', color: L.text },
  ttsModeLabelActive:{ color: L.accent },
  ttsModeSub:       { fontSize: 11, color: L.muted, marginTop: 1 },
  ttsRadio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                      borderColor: L.border, alignItems: 'center', justifyContent: 'center' },
  ttsRadioActive:   { borderColor: L.accent },
  ttsRadioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: L.accent },
  ttsRepeatRow:     { flexDirection: 'row', gap: 8 },
  ttsRepeatChip:    { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.sm,
                      borderWidth: 1.5, borderColor: L.border, backgroundColor: L.elevated },
  ttsRepeatChipActive: { borderColor: L.accent, backgroundColor: L.accentFaint },
  ttsRepeatText:    { fontSize: 13, fontWeight: '700', color: L.muted },
  ttsRepeatTextActive: { color: L.accent },
  ttsPreviewBtn:        { borderWidth: 1.5, borderColor: L.accent, borderRadius: RADIUS.md,
                          padding: 12, alignItems: 'center', marginTop: 4 },
  ttsPreviewBtnPlaying: { backgroundColor: L.accentFaint },
  ttsPreviewBtnText:    { fontSize: 14, fontWeight: '700', color: L.accent },
  ttsPlayBtnActive:     { backgroundColor: L.errorDim },

  menuGrid: { flexDirection: 'row', gap: 12 },
  menuBtn: {
    flex: 1, backgroundColor: L.surface, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: L.border,
  },
  menuBtnIcon: { fontSize: 32 },
  menuBtnLabel: { fontSize: 13, fontWeight: '700', color: L.text },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: L.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 14, paddingBottom: 40,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: L.border,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: L.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: L.text },
  modalDesc: { fontSize: 13, color: L.sub },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: L.text },
  input: {
    borderWidth: 1.5, borderColor: L.border, borderRadius: RADIUS.md,
    padding: 12, fontSize: 14, color: L.text, backgroundColor: L.elevated,
  },
  previewBox: { gap: 6 },
  previewLabel: { fontSize: 12, fontWeight: '700', color: L.muted },
  previewCard: {
    backgroundColor: L.accentFaint, borderRadius: RADIUS.md,
    padding: 12, gap: 4,
    borderLeftWidth: 3, borderLeftColor: L.accent,
  },
  previewTitle: { fontSize: 13, fontWeight: '800', color: L.text },
  previewBody: { fontSize: 12, color: L.sub, lineHeight: 18 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, backgroundColor: L.elevated, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: L.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: L.muted },
  sendBtn: {
    flex: 2, backgroundColor: L.accent, borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // 쿠폰 PIN 카드
  pinCard: {
    backgroundColor: L.surface, borderRadius: RADIUS.lg,
    padding: 18, gap: 12, borderLeftWidth: 4, borderLeftColor: L.accent,
    borderWidth: 1, borderColor: L.border,
  },
  pinDisplay:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pinLabel:      { fontSize: 12, color: L.muted, marginBottom: 4 },
  pinValue:      { fontSize: 32, fontWeight: '900', color: L.accent, letterSpacing: 8 },
  pinEyeBtn:     { backgroundColor: L.elevated, borderRadius: RADIUS.sm,
                   paddingHorizontal: 12, paddingVertical: 6,
                   borderWidth: 1, borderColor: L.border },
  pinEyeText:    { fontSize: 12, fontWeight: '700', color: L.muted },
  pinGuide:      { fontSize: 12, color: L.sub, lineHeight: 18 },
  pinBtnRow:     { flexDirection: 'row', gap: 10 },
  pinBtn:        { flex: 1, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center' },
  pinBtnOutline: { borderWidth: 1.5, borderColor: L.accent },
  pinBtnOutlineText: { fontSize: 13, fontWeight: '700', color: L.accent },
  pinBtnFill:    { backgroundColor: L.accent },
  pinBtnFillText:{ fontSize: 13, fontWeight: '700', color: '#fff' },
  pinEmptyText:  { fontSize: 13, color: L.muted, lineHeight: 20, textAlign: 'center' },
  pinBtnFull:    { backgroundColor: L.accent, borderRadius: RADIUS.md,
                   paddingVertical: 14, alignItems: 'center' },
  pinBtnFullText:{ fontSize: 15, fontWeight: '800', color: '#fff' },

  stampSettingCard: {
    backgroundColor: L.surface, borderRadius: RADIUS.lg, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 4, borderLeftColor: '#22C55E',
    borderWidth: 1, borderColor: L.border,
  },
  stampSettingTitle:  { fontSize: 14, fontWeight: '800', color: L.text },
  stampSettingReward: { fontSize: 12, color: L.muted, marginTop: 3 },
  stampSettingArrow:  { fontSize: 18 },

  // ── 게시물 ────────────────────────────────────────────────────────
  postTimeInfo: {
    backgroundColor: L.indigoDim, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 7,
    marginBottom: 8,
  },
  postTimeInfoText: { fontSize: 12, color: L.indigo, fontWeight: '500' },

  postWriteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: L.surface, borderRadius: RADIUS.lg,
    padding: 16, borderWidth: 1.5, borderColor: 'rgba(255,111,15,0.3)',
    borderStyle: 'dashed',
  },
  postWriteEmoji: { fontSize: 20 },
  postWriteText:  { flex: 1, fontSize: 14, color: L.muted, fontWeight: '500' },
  postWriteArrow: { fontSize: 22, color: L.accent, fontWeight: '800' },

  postWriteDisabled: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: L.elevated, borderRadius: RADIUS.lg,
    padding: 16, borderWidth: 1.5, borderColor: L.border,
  },
  postWriteDisabledEmoji: { fontSize: 24, marginTop: 2 },
  postWriteDisabledTitle: { fontSize: 14, fontWeight: '800', color: L.muted, marginBottom: 4 },
  postWriteDisabledSub:   { fontSize: 12, color: L.muted, lineHeight: 18, opacity: 0.6 },

  postList:     { gap: 8, marginTop: 8 },
  postItem:     {
    backgroundColor: L.surface, borderRadius: RADIUS.md,
    padding: 14, gap: 6, borderWidth: 1, borderColor: L.border,
  },
  postItemTop:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  postItemTime: { fontSize: 11, color: L.muted, flex: 1 },
  postLikeChip: { backgroundColor: L.pinkDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  postLikeText: { fontSize: 12, fontWeight: '700', color: L.pink },
  postItemContent:    { fontSize: 14, color: L.text, lineHeight: 20 },
  postItemCouponChip: { fontSize: 12, color: L.accent, fontWeight: '600' },
  postCouponActiveNote: { fontSize: 11, color: L.warn, marginTop: 2 },

  postActionBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: L.border,
    backgroundColor: L.elevated,
  },
  postActionBtnMuted: { borderColor: L.border, backgroundColor: L.elevated, opacity: 0.6 },
  postActionEdit: { fontSize: 11, color: L.blue, fontWeight: '700' },
  postActionDel:  { fontSize: 11, color: L.error, fontWeight: '700' },

  postDeletePending: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, backgroundColor: L.warnDim,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  postDeletePendingText: { fontSize: 11, color: L.warn, fontWeight: '700' },

  // 삭제 요청 모달
  deleteReqPreview: {
    backgroundColor: L.elevated, borderRadius: RADIUS.sm,
    padding: 12, marginBottom: 10, borderWidth: 1, borderColor: L.border,
  },
  deleteReqPreviewText: { fontSize: 13, color: L.sub, lineHeight: 18 },
  deleteReqWarning: {
    backgroundColor: L.warnDim, borderRadius: RADIUS.sm,
    padding: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  deleteReqWarningText: { fontSize: 12, color: L.warn, lineHeight: 18 },

  // 쿠폰 선택 칩
  couponChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.sm,
    backgroundColor: L.elevated, borderWidth: 1.5, borderColor: L.border,
    maxWidth: 160,
  },
  couponChipActive:     { backgroundColor: L.accentDim, borderColor: L.accent },
  couponChipText:       { fontSize: 12, fontWeight: '600', color: L.muted },
  couponChipTextActive: { color: L.accent },

  // ── 음악 DNA 분석 패널 ───────────────────────────────────────────
  dnaPanel: {
    backgroundColor: L.surface, borderRadius: RADIUS.lg, padding: 16, gap: 12,
    borderWidth: 1, borderColor: L.border,
    borderLeftWidth: 4, borderLeftColor: L.indigo,
  },
  dnaPanelDesc: { fontSize: 13, color: L.sub, lineHeight: 20 },
  dnaLabel:           { fontSize: 13, fontWeight: '700', color: L.text },
  dnaTagRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dnaBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3B82F6', borderRadius: RADIUS.md, paddingVertical: 12,
  },
  dnaBtnDisabled:     { opacity: 0.5 },
  dnaBtnText:         { fontSize: 14, fontWeight: '700', color: '#fff' },

  // 컨텍스트 뱃지
  contextInfoRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  contextBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
  },
  contextBadgeText:   { fontSize: 12, fontWeight: '700', color: '#3B82F6' },
  contextDetailText:  { fontSize: 11, color: L.muted, marginTop: 2 },

  // 메뉴 태그 입력
  menuTagInputRow:    { flexDirection: 'row', gap: 8 },
  menuTagInput: {
    flex: 1, backgroundColor: L.elevated, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: L.text, borderWidth: 1, borderColor: L.border,
  },
  menuTagAddBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: '#3B82F6', borderRadius: RADIUS.md, justifyContent: 'center',
  },
  menuTagAddBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  menuTag: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(251,146,60,0.15)', borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.35)',
  },
  menuTagText:        { fontSize: 12, fontWeight: '600', color: '#F97316' },
});

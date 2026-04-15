import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, TextInput, Modal,
  RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { superAdminLogout } from '../../lib/auth';
import {
  sendSuperAdminPush, fetchPushHistory,
  fetchPushStats, registerPushToken, PushHistoryRow,
} from '../../lib/services/pushService';
import {
  fetchAllApplications, fetchApplicationStats,
  approveApplication, rejectApplication, pendingApplication,
  StoreApplicationRow,
} from '../../lib/services/storeApplicationService';
import {
  fetchDistricts, fetchDistrictStats, createDistrict,
  DistrictRow, DistrictInput,
} from '../../lib/services/districtService';
import {
  fetchAllAnnouncements, createAnnouncement,
  toggleAnnouncement, deleteAnnouncement,
  AnnouncementRow,
} from '../../lib/services/announcementService';
import {
  fetchAllPopupNotices, createPopupNotice,
  togglePopupNotice, deletePopupNotice,
  PopupNoticeRow,
} from '../../lib/services/popupNoticeService';
import {
  fetchAllCouponsWithStats, getCouponKindConfig, CouponWithStats,
} from '../../lib/services/couponService';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  fetchAllMusicTracksAdmin, createMusicTrack, updateMusicTrack,
  toggleMusicTrackActive, deleteMusicTrack, uploadMusicFile,
  MusicTrack, MusicTrackInput,
} from '../../lib/services/musicService';
import { fetchAllUsers, updateUserRole, UserRow } from '../../lib/services/userService';
import { getSuperAdminLoginTime } from '../../lib/auth';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  searchNaverPlace, resultToForm,
  registerHotplace, fetchHotplaces, toggleStoreClosure,
  NaverSearchResult, NaverPlaceForm, HotplaceRow,
} from '../../lib/services/naverPlaceService';
import {
  fetchAllBanners, createBanner, updateBanner,
  pauseBanner, resumeBanner, deleteBanner,
  bannerStatus, BannerRow, BannerInput,
} from '../../lib/services/bannerService';
import {
  fetchPostSettings, updatePostSettings, PostSettings,
  fetchAllPostDeleteRequests, processPostDeleteRequest,
  fetchAllPostEditLogs,
  PostDeleteRequest, PostEditLog,
} from '../../lib/services/postService';

const SA = {
  bg: '#1A1A2E', card: '#16213E', border: '#0F3460',
  accent: '#E94560', accentLight: '#E9456022',
  text: '#FFFFFF', muted: '#AAAAAA',
  success: '#4CAF50', successLight: '#4CAF5022',
  warn: '#FFD93D', warnLight: '#FFD93D22',
  owner: '#FFD93D',
};

type MainTab = 'apply' | 'district' | 'push' | 'notice' | 'popup' | 'coupon' | 'members' | 'hotplace' | 'banner' | 'music' | 'settings';
type ApplyFilter = 'pending' | 'approved' | 'rejected';
type PushFilter = 'all' | 'superadmin' | 'owner';

export default function SuperAdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const [mainTab, setMainTab] = useState<MainTab>('apply');

  // ── Push 상태
  const [pushStats, setPushStats]   = useState({ totalSent: 0, totalRead: 0, superAdminCount: 0, ownerCount: 0 });
  const [pushHistory, setPushHistory] = useState<PushHistoryRow[]>([]);
  const [pushFilter, setPushFilter] = useState<PushFilter>('all');
  const [pushModal, setPushModal]   = useState(false);
  const [pushTitle, setPushTitle]   = useState('');
  const [pushBody, setPushBody]     = useState('');
  const [sending, setSending]       = useState(false);

  // ── Notice 상태
  const [notices, setNotices]               = useState<AnnouncementRow[]>([]);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNotice, setNewNotice]           = useState('');
  const [noticeLoading, setNoticeLoading]   = useState(false);

  // ── Coupon 통계 상태
  const [couponList, setCouponList] = useState<CouponWithStats[]>([]);

  // ── 회원 목록 상태
  const [members, setMembers] = useState<UserRow[]>([]);
  const [memberFilter, setMemberFilter] = useState<'all' | 'customer' | 'owner'>('all');

  // ── 핫플 상태
  const [hotplaces,        setHotplaces]        = useState<HotplaceRow[]>([]);
  const [hpQuery,          setHpQuery]          = useState('');
  const [hpSearching,      setHpSearching]      = useState(false);
  const [hpResults,        setHpResults]        = useState<NaverSearchResult[]>([]);
  const [showForm,         setShowForm]         = useState(false);
  const [naverRegistering, setNaverRegistering] = useState(false);
  const [closureToggling,  setClosureToggling]  = useState<Record<string, boolean>>({});
  const [hpForm, setHpForm] = useState<NaverPlaceForm>({
    place_id: '', naver_place_url: '',
    name: '', category: '', address: '', phone: '',
    latitude: '', longitude: '', description: '',
  });

  // ── 배너 광고 상태
  const BANNER_COLORS = ['#5B67CA','#FF6B3D','#2DB87A','#D946B0','#F59E0B','#EF4444','#8B5CF6','#0EA5E9'];
  const emptyBannerForm = (): BannerInput => ({
    title: '', subtitle: '', emoji: '🎉',
    bg_color: BANNER_COLORS[0], text_color: '#FFFFFF',
    cta_text: '자세히 보기',
    link_type: 'none', link_value: null,
    starts_at: new Date().toISOString(),
    ends_at: null,
    is_paused: false, display_order: 0,
  });
  const [banners,         setBanners]         = useState<BannerRow[]>([]);
  const [bannerModal,     setBannerModal]     = useState(false);
  const [editingBanner,   setEditingBanner]   = useState<BannerRow | null>(null);
  const [bannerForm,      setBannerForm]      = useState<BannerInput>(emptyBannerForm());
  const [bannerSaving,    setBannerSaving]    = useState(false);
  const [bannerToggling,  setBannerToggling]  = useState<Record<string, boolean>>({});

  // ── 게시물 설정
  const [postSettings,    setPostSettings]    = useState<PostSettings>({
    post_start_hour: 8, post_end_hour: 20, post_cooldown_hours: 24,
  });
  const [psStartHour,  setPsStartHour]  = useState('8');
  const [psEndHour,    setPsEndHour]    = useState('20');
  const [psCooldown,   setPsCooldown]   = useState('24');
  const [psSaving,     setPsSaving]     = useState(false);

  // ── 게시물 로그 / 삭제 요청
  const [postEditLogs,    setPostEditLogs]    = useState<PostEditLog[]>([]);
  const [postDelReqs,     setPostDelReqs]     = useState<PostDeleteRequest[]>([]);
  const [delReqFilter,    setDelReqFilter]    = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [delReqProcessing, setDelReqProcessing] = useState<Record<string, boolean>>({});
  const [delReqNoteModal,  setDelReqNoteModal]  = useState(false);
  const [delReqSelected,   setDelReqSelected]   = useState<PostDeleteRequest | null>(null);
  const [delReqNoteAction, setDelReqNoteAction] = useState<'approved' | 'rejected'>('approved');
  const [delReqNote,       setDelReqNote]       = useState('');
  const [postLogExpanded,  setPostLogExpanded]  = useState(false);

  // ── 로그인 시각
  const [loginTime, setLoginTime] = useState<string | null>(null);

  // ── 음악 관리
  const [musicTracks,    setMusicTracks]    = useState<MusicTrack[]>([]);
  const [musicLoading,   setMusicLoading]   = useState(false);
  const [musicModal,     setMusicModal]     = useState(false);
  const [musicEditId,    setMusicEditId]    = useState<string | null>(null);
  const [mTitle,         setMTitle]         = useState('');
  const [mArtist,        setMArtist]        = useState('');
  const [mEmoji,         setMEmoji]         = useState('🎵');
  const [mMood,          setMMood]          = useState('');
  const [mCategory,      setMCategory]      = useState('all');
  const [mDuration,      setMDuration]      = useState('');
  const [mAudioUrl,      setMAudioUrl]      = useState('');
  const [mUploading,     setMUploading]     = useState(false);
  const [mSaving,        setMSaving]        = useState(false);

  // ── Popup 상태
  const [popups, setPopups]               = useState<PopupNoticeRow[]>([]);
  const [newPopupTitle, setNewPopupTitle] = useState('');
  const [newPopupContent, setNewPopupContent] = useState('');
  const [popupLoading, setPopupLoading]   = useState(false);

  // ── Apply 상태
  const [appStats, setAppStats]     = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [applications, setApps]     = useState<StoreApplicationRow[]>([]);
  const [applyFilter, setApplyFilter] = useState<ApplyFilter>('pending');
  const [noteModal, setNoteModal]   = useState(false);
  const [selectedApp, setSelectedApp] = useState<StoreApplicationRow | null>(null);
  const [noteAction, setNoteAction] = useState<'approve' | 'reject'>('approve');
  const [adminNote, setAdminNote]   = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── District 상태
  const [districts, setDistricts]       = useState<DistrictRow[]>([]);
  const [districtStats, setDistrictStats] = useState<Record<string, number>>({});
  const [districtModal, setDistrictModal] = useState(false);
  const [dName, setDName]               = useState('');
  const [dDesc, setDDesc]               = useState('');
  const [dLat, setDLat]                 = useState('');
  const [dLng, setDLng]                 = useState('');
  const [dSaving, setDSaving]           = useState(false);

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAll();
    loadMusicTracks();
    getSuperAdminLoginTime().then(t => setLoginTime(t));
    // 시샵 기기 푸시 토큰 등록 (회원가입·가게신청 알림 수신용)
    import('../../lib/services/authService').then(({ getSession }) =>
      getSession().then(session => {
        if (session?.user.id) {
          registerPushToken(session.user.id).catch(() => {});
        }
      })
    );
  }, []);

  const loadAll = async () => {
    try {
      const [ps, ph, as, apps, dList, dStats, nList, pList, cList, mList, hpList, bnList, pset, peLogs, pdReqs] = await Promise.all([
        fetchPushStats().catch(() => ({ totalSent: 0, totalRead: 0, superAdminCount: 0, ownerCount: 0 })),
        fetchPushHistory().catch(() => [] as PushHistoryRow[]),
        fetchApplicationStats().catch(() => ({ pending: 0, approved: 0, rejected: 0, total: 0 })),
        fetchAllApplications().catch(() => [] as StoreApplicationRow[]),
        fetchDistricts().catch(() => [] as DistrictRow[]),
        fetchDistrictStats().catch(() => ({} as Record<string, number>)),
        fetchAllAnnouncements().catch(() => [] as AnnouncementRow[]),
        fetchAllPopupNotices().catch(() => [] as PopupNoticeRow[]),
        fetchAllCouponsWithStats().catch(() => [] as CouponWithStats[]),
        fetchAllUsers().catch(() => [] as UserRow[]),
        fetchHotplaces().catch(() => [] as HotplaceRow[]),
        fetchAllBanners().catch(() => [] as BannerRow[]),
        fetchPostSettings().catch(() => ({ post_start_hour: 8, post_end_hour: 20, post_cooldown_hours: 24 } as PostSettings)),
        fetchAllPostEditLogs().catch(() => [] as PostEditLog[]),
        fetchAllPostDeleteRequests().catch(() => [] as PostDeleteRequest[]),
      ]);
      setPushStats(ps); setPushHistory(ph);
      setAppStats(as);  setApps(apps);
      setDistricts(dList); setDistrictStats(dStats);
      setNotices(nList);
      setPopups(pList);
      setCouponList(cList);
      setMembers(mList);
      setHotplaces(hpList);
      setBanners(bnList);
      setPostSettings(pset);
      setPsStartHour(String(pset.post_start_hour));
      setPsEndHour(String(pset.post_end_hour));
      setPsCooldown(String(pset.post_cooldown_hours));
      setPostEditLogs(peLogs);
      setPostDelReqs(pdReqs);
    } catch (e: any) {
      console.error('[loadAll] 데이터 로드 실패:', e?.message ?? e);
      Alert.alert('데이터 로드 실패', e?.message ?? '일부 데이터를 불러오지 못했어요');
    }
    finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  // ── 네이버 공식 API 검색
  const handleNaverSearch = async () => {
    if (!hpQuery.trim()) { Alert.alert('업체명 또는 주소를 입력해주세요'); return; }
    setHpSearching(true);
    setHpResults([]);
    setShowForm(false);
    try {
      const results = await searchNaverPlace(hpQuery.trim());
      if (results.length === 0) {
        Alert.alert('검색 결과 없음', '다른 검색어로 다시 시도해주세요');
      }
      setHpResults(results);
    } catch (e: any) {
      Alert.alert('검색 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setHpSearching(false);
    }
  };

  // ── 검색 결과 선택 → 폼 자동 입력
  const handleSelectResult = (result: NaverSearchResult) => {
    setHpForm(resultToForm(result));
    setHpResults([]);
    setShowForm(true);
  };

  // ── 핫플 등록
  const handleRegisterHotplace = async () => {
    if (!hpForm.name.trim())    { Alert.alert('업체명을 입력해주세요'); return; }
    if (!hpForm.address.trim()) { Alert.alert('주소를 입력해주세요'); return; }
    setNaverRegistering(true);
    try {
      await registerHotplace(hpForm);
      const updated = await fetchHotplaces();
      setHotplaces(updated);
      setShowForm(false);
      setHpQuery('');
      Alert.alert('🎉 핫플 등록 완료!', `${hpForm.name}이(가) 등록됐어요`);
    } catch (e: any) {
      Alert.alert('등록 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setNaverRegistering(false);
    }
  };

  // ── 폐업 수동 토글
  const handleToggleClosure = (store: HotplaceRow) => {
    const next = !store.is_closed;
    Alert.alert(
      next ? '🚫 폐업 처리' : '✅ 영업 재개',
      `${store.name}을(를) ${next ? '폐업' : '영업 중'}으로 변경할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경',
          onPress: async () => {
            setClosureToggling(p => ({ ...p, [store.id]: true }));
            try {
              await toggleStoreClosure(store.id, next);
              setHotplaces(prev =>
                prev.map(h => h.id === store.id
                  ? { ...h, is_closed: next, is_active: !next }
                  : h),
              );
            } catch (e: any) {
              Alert.alert('변경 실패', e.message);
            } finally {
              setClosureToggling(p => ({ ...p, [store.id]: false }));
            }
          },
        },
      ],
    );
  };

  // ── 배너 저장 (생성 / 수정)
  const handleSaveBanner = async () => {
    if (!bannerForm.title.trim()) { Alert.alert('배너 제목을 입력해주세요'); return; }
    setBannerSaving(true);
    try {
      if (editingBanner) {
        await updateBanner(editingBanner.id, bannerForm);
      } else {
        await createBanner(bannerForm);
      }
      const updated = await fetchAllBanners();
      setBanners(updated);
      setBannerModal(false);
      setEditingBanner(null);
      setBannerForm(emptyBannerForm());
      Alert.alert('✅ 저장 완료', editingBanner ? '배너가 수정됐어요' : '새 배너가 등록됐어요');
    } catch (e: any) {
      Alert.alert('저장 실패', e.message);
    } finally {
      setBannerSaving(false);
    }
  };

  // ── 배너 일시중지 / 재개 토글
  const handleToggleBannerPause = async (b: BannerRow) => {
    setBannerToggling(p => ({ ...p, [b.id]: true }));
    try {
      if (b.is_paused) await resumeBanner(b.id);
      else             await pauseBanner(b.id);
      setBanners(prev => prev.map(x => x.id === b.id ? { ...x, is_paused: !b.is_paused } : x));
    } catch (e: any) {
      Alert.alert('실패', e.message);
    } finally {
      setBannerToggling(p => ({ ...p, [b.id]: false }));
    }
  };

  // ── 배너 삭제
  const handleDeleteBanner = (b: BannerRow) =>
    Alert.alert('배너 삭제', `"${b.title}" 배너를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await deleteBanner(b.id);
            setBanners(prev => prev.filter(x => x.id !== b.id));
          } catch (e: any) { Alert.alert('삭제 실패', e.message); }
        }},
    ]);

  // ── 삭제 요청 처리 모달 열기
  const openDelReqNote = (req: PostDeleteRequest, action: 'approved' | 'rejected') => {
    setDelReqSelected(req);
    setDelReqNoteAction(action);
    setDelReqNote('');
    setDelReqNoteModal(true);
  };

  // ── 삭제 요청 처리 확정
  const handleProcessDelReq = async () => {
    if (!delReqSelected) return;
    setDelReqProcessing(p => ({ ...p, [delReqSelected.id]: true }));
    setDelReqNoteModal(false);
    try {
      await processPostDeleteRequest(delReqSelected.id, delReqNoteAction, delReqNote || undefined);
      const updated = await fetchAllPostDeleteRequests();
      setPostDelReqs(updated);
      Alert.alert(
        delReqNoteAction === 'approved' ? '✅ 승인 완료' : '❌ 반려 완료',
        delReqNoteAction === 'approved' ? '게시물이 삭제됐어요' : '사장님에게 반려 처리됐어요',
      );
    } catch (e: any) {
      Alert.alert('처리 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setDelReqProcessing(p => ({ ...p, [delReqSelected.id]: false }));
    }
  };

  // ── 게시물 설정 저장
  const handleSavePostSettings = async () => {
    const start   = parseInt(psStartHour, 10);
    const end     = parseInt(psEndHour, 10);
    const cooldown = parseInt(psCooldown, 10);
    if (isNaN(start) || start < 0 || start > 23) { Alert.alert('시작 시각은 0~23 사이로 입력해주세요'); return; }
    if (isNaN(end)   || end   < 1 || end   > 24) { Alert.alert('종료 시각은 1~24 사이로 입력해주세요'); return; }
    if (start >= end) { Alert.alert('시작 시각은 종료 시각보다 작아야 해요'); return; }
    if (isNaN(cooldown) || cooldown < 1 || cooldown > 168) { Alert.alert('쿨다운은 1~168시간 사이로 입력해주세요'); return; }
    setPsSaving(true);
    try {
      await updatePostSettings({ post_start_hour: start, post_end_hour: end, post_cooldown_hours: cooldown });
      setPostSettings({ post_start_hour: start, post_end_hour: end, post_cooldown_hours: cooldown });
      Alert.alert('✅ 저장 완료', '게시물 작성 시간 설정이 업데이트됐어요');
    } catch (e: any) {
      Alert.alert('저장 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setPsSaving(false);
    }
  };

  // ── 로그아웃
  const handleLogout = () =>
    Alert.alert('로그아웃', '시샵 모드를 종료할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '종료', style: 'destructive', onPress: async () => {
          await superAdminLogout();
          navigation.replace('SuperAdminLogin');
        }},
    ]);

  // ── 전체 푸시 발송
  const handleSendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) {
      Alert.alert('제목과 내용을 모두 입력해주세요'); return;
    }
    setSending(true);
    try {
      const { sentCount } = await sendSuperAdminPush(pushTitle.trim(), pushBody.trim());
      setPushModal(false); setPushTitle(''); setPushBody('');
      await loadAll();
      Alert.alert('📣 발송 완료!', `전체 ${sentCount}명에게 발송됐어요`);
    } catch { Alert.alert('발송 실패'); }
    finally { setSending(false); }
  };

  // ── 승인 / 반려 모달 열기
  const openNoteModal = (app: StoreApplicationRow, action: 'approve' | 'reject') => {
    setSelectedApp(app); setNoteAction(action); setAdminNote('');
    setSelectedDistrictId(null); setNoteModal(true);
  };

  // ── 주소 → 좌표 자동 검색
  const [geoLoading, setGeoLoading] = useState(false);
  const handleGeocode = async () => {
    const query = (dName.trim() ? `창원 ${dName.trim()}` : dDesc.trim());
    if (!query) { Alert.alert('상권 이름을 먼저 입력해주세요'); return; }
    setGeoLoading(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (results.length > 0) {
        setDLat(results[0].latitude.toFixed(6));
        setDLng(results[0].longitude.toFixed(6));
        Alert.alert('📍 좌표 검색 완료', `위도: ${results[0].latitude.toFixed(4)}\n경도: ${results[0].longitude.toFixed(4)}`);
      } else {
        Alert.alert('검색 실패', '주소를 찾을 수 없어요. 직접 입력해주세요.');
      }
    } catch { Alert.alert('검색 오류', '잠시 후 다시 시도해주세요'); }
    finally { setGeoLoading(false); }
  };

  // ── 상권 등록
  const handleCreateDistrict = async () => {
    if (!dName.trim()) { Alert.alert('상권 이름을 입력해주세요'); return; }
    setDSaving(true);
    try {
      const input: DistrictInput = {
        name: dName.trim(),
        description: dDesc.trim() || undefined,
        latitude:  dLat ? parseFloat(dLat) : undefined,
        longitude: dLng ? parseFloat(dLng) : undefined,
      };
      await createDistrict(input);
      setDistrictModal(false); setDName(''); setDDesc(''); setDLat(''); setDLng('');
      await loadAll();
      Alert.alert('✅ 상권 등록 완료', `${input.name} 상권이 등록됐어요!`);
    } catch (e: any) { Alert.alert('등록 실패', e.message); }
    finally { setDSaving(false); }
  };

  // ── 승인 처리
  const handleApprove = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      await approveApplication(selectedApp.id, selectedApp, adminNote, selectedDistrictId ?? undefined);
      setNoteModal(false); await loadAll();
      Alert.alert('✅ 승인 완료', `${selectedApp.store_name}이 앱 지도에 등록됐어요!`);
    } catch (e: any) {
      Alert.alert('승인 실패', e.message);
    } finally { setActionLoading(false); }
  };

  // ── 반려 처리
  const handleReject = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      await rejectApplication(selectedApp.id, adminNote);
      setNoteModal(false); await loadAll();
      Alert.alert('반려 처리됨', `${selectedApp.store_name} 신청이 반려됐어요`);
    } catch { Alert.alert('처리 실패'); }
    finally { setActionLoading(false); }
  };

  // ── 보류로 되돌리기
  const handlePending = (app: StoreApplicationRow) =>
    Alert.alert('보류로 변경', `${app.store_name} 신청을 보류로 되돌릴까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '보류', onPress: async () => {
          await pendingApplication(app.id); await loadAll();
        }},
    ]);

  // ── 음악 트랙 로드
  const loadMusicTracks = async () => {
    setMusicLoading(true);
    try {
      const tracks = await fetchAllMusicTracksAdmin();
      setMusicTracks(tracks);
    } catch (e: any) {
      Alert.alert('음악 로드 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setMusicLoading(false);
    }
  };

  // ── 음악 파일 선택 & 업로드
  const handlePickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // ── 파일명 → 노래 제목 자동 입력 (비어 있을 때만)
      if (!mTitle.trim()) {
        const autoTitle = asset.name
          .replace(/\.(mp3|wav|m4a|aac|ogg|flac)$/i, '') // 확장자 제거
          .replace(/[_\-\.]+/g, ' ')                      // 구분자 → 공백
          .replace(/\s+/g, ' ')                            // 연속 공백 정리
          .trim();
        if (autoTitle) setMTitle(autoTitle);
      }

      setMUploading(true);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64' as any,
      });
      // 파일명에서 특수문자/한글/악센트 제거 → ASCII + 확장자만 유지
      const ext = asset.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)?.[1] ?? 'mp3';
      const safeName = asset.name
        .normalize('NFD')                     // 악센트 분해 (é → e + ́)
        .replace(/[\u0300-\u036f]/g, '')      // 결합 문자 제거
        .replace(/[^\x00-\x7F]/g, '')         // 나머지 non-ASCII 제거 (한글 등)
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._\-]/g, '')     // 허용 문자 외 제거
        .replace(/_{2,}/g, '_')               // 연속 언더스코어 정리
        .toLowerCase()
        || 'track';
      const filename = `${Date.now()}_${safeName.replace(/\.[^.]+$/, '')}.${ext}`;
      const publicUrl = await uploadMusicFile(base64, filename);
      setMAudioUrl(publicUrl);
      Alert.alert('✅ 업로드 완료', '음악 파일이 업로드됐어요');
    } catch (e: any) {
      Alert.alert('업로드 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setMUploading(false);
    }
  };

  // ── 음악 트랙 저장 (등록 / 수정)
  const handleSaveMusicTrack = async () => {
    if (!mTitle.trim())    { Alert.alert('제목을 입력해주세요'); return; }
    if (!mArtist.trim())   { Alert.alert('아티스트를 입력해주세요'); return; }
    if (!mAudioUrl.trim()) { Alert.alert('음악 파일을 업로드해주세요'); return; }
    const dur = parseInt(mDuration, 10);
    if (isNaN(dur) || dur <= 0) { Alert.alert('재생 시간(초)을 올바르게 입력해주세요'); return; }
    setMSaving(true);
    try {
      const params: MusicTrackInput = {
        title: mTitle.trim(),
        artist: mArtist.trim(),
        mood: mMood.trim() || '편안한',
        store_category: mCategory,
        audio_url: mAudioUrl.trim(),
        duration_sec: dur,
        cover_emoji: mEmoji || '🎵',
        is_active: true,
      };
      if (musicEditId) {
        await updateMusicTrack(musicEditId, params);
      } else {
        await createMusicTrack(params);
      }
      await loadMusicTracks();
      setMusicModal(false);
      resetMusicForm();
      Alert.alert('✅ 저장 완료', musicEditId ? '트랙이 수정됐어요' : '새 트랙이 등록됐어요');
    } catch (e: any) {
      Alert.alert('저장 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setMSaving(false);
    }
  };

  // ── 음악 폼 초기화
  const resetMusicForm = () => {
    setMusicEditId(null);
    setMTitle(''); setMArtist(''); setMEmoji('🎵');
    setMMood(''); setMCategory('all');
    setMDuration(''); setMAudioUrl('');
  };

  // ── 음악 수정 모달 열기
  const handleEditMusic = (track: MusicTrack) => {
    setMusicEditId(track.id);
    setMTitle(track.title);
    setMArtist(track.artist);
    setMEmoji(track.cover_emoji);
    setMMood(track.mood);
    setMCategory(track.store_category);
    setMDuration(String(track.duration_sec));
    setMAudioUrl(track.audio_url);
    setMusicModal(true);
  };

  // ── 음악 활성/비활성 토글
  const handleToggleMusic = async (track: MusicTrack) => {
    try {
      await toggleMusicTrackActive(track.id, !track.is_active);
      setMusicTracks(prev =>
        prev.map(t => t.id === track.id ? { ...t, is_active: !track.is_active } : t),
      );
    } catch (e: any) {
      Alert.alert('변경 실패', e.message ?? '다시 시도해주세요');
    }
  };

  // ── 음악 삭제
  const handleDeleteMusic = (track: MusicTrack) =>
    Alert.alert('트랙 삭제', `"${track.title}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await deleteMusicTrack(track.id);
            setMusicTracks(prev => prev.filter(t => t.id !== track.id));
          } catch (e: any) { Alert.alert('삭제 실패', e.message); }
        },
      },
    ]);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <ActivityIndicator style={{ flex: 1 }} color={SA.accent} />
    </SafeAreaView>
  );

  const filteredApps = applications.filter(a => a.status === applyFilter);
  const filteredPush = pushHistory.filter(h => pushFilter === 'all' ? true : h.sender_type === pushFilter);
  const readRate = (r: PushHistoryRow) =>
    r.sent_count > 0 ? Math.round((r.read_count / r.sent_count) * 100) : 0;

  return (
    <SafeAreaView style={s.safe}>
      {/* 헤더 */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>🛡️ 시샵</Text>
          <Text style={s.headerSub}>언니픽 슈퍼 어드민</Text>
          {/* 로그인 상태 배지 */}
          <View style={s.loginBadge}>
            <View style={s.loginDot} />
            <Text style={s.loginBadgeText}>
              {'로그인됨'}
              {loginTime
                ? ` · ${new Date(loginTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </Text>
          </View>
        </View>

        <View style={s.headerRight}>
          {/* 앱 화면으로 이동 */}
          <TouchableOpacity
            style={s.homeBtn}
            onPress={() => navigation.navigate('CustomerTabs')}
            activeOpacity={0.8}
          >
            <Text style={s.homeBtnText}>🏠 앱 보기</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={s.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 메인 탭 */}
      <View style={s.mainTabRow}>
        {([
          { key: 'apply',    label: `🍖 가입${appStats.pending > 0 ? `(${appStats.pending})` : ''}` },
          { key: 'district', label: '🗺 상권' },
          { key: 'push',     label: '📣 푸시' },
          { key: 'notice',   label: `📢 공지${notices.filter(n=>n.is_active).length > 0 ? `(${notices.filter(n=>n.is_active).length})` : ''}` },
          { key: 'popup',    label: `🪟 팝업${popups.filter(p=>p.is_active).length > 0 ? `(${popups.filter(p=>p.is_active).length})` : ''}` },
          { key: 'coupon',   label: `🎟 쿠폰(${couponList.length})` },
          { key: 'members',  label: `👤 회원(${members.length})` },
          { key: 'hotplace', label: `🗺 핫플(${hotplaces.length})` },
          { key: 'banner',   label: `📢 배너(${banners.length})` },
          { key: 'music',    label: `🎵 뮤직(${musicTracks.length})` },
          { key: 'settings', label: '⚙️ 설정' },
        ] as { key: MainTab; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.mainTab, mainTab === t.key && s.mainTabActive]}
            onPress={() => setMainTab(t.key)}
          >
            <Text style={[s.mainTabText, mainTab === t.key && s.mainTabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SA.accent} />}
      >
        {/* ────────── 가입신청 탭 ────────── */}
        {mainTab === 'apply' && (
          <>
            {/* 통계 */}
            <View style={s.statsRow}>
              <StatCard icon="⏳" label="대기" value={appStats.pending}  color={SA.warn} />
              <StatCard icon="✅" label="승인" value={appStats.approved} color={SA.success} />
              <StatCard icon="❌" label="반려" value={appStats.rejected} color={SA.accent} />
              <StatCard icon="📋" label="전체" value={appStats.total}   color={SA.muted} />
            </View>

            {/* 필터 탭 */}
            <View style={s.filterRow}>
              {([
                { key: 'pending',  label: '⏳ 대기중', color: SA.warn },
                { key: 'approved', label: '✅ 승인',   color: SA.success },
                { key: 'rejected', label: '❌ 반려',   color: SA.accent },
              ] as { key: ApplyFilter; label: string; color: string }[]).map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.filterBtn, applyFilter === f.key && { backgroundColor: f.color + '33', borderColor: f.color }]}
                  onPress={() => setApplyFilter(f.key)}
                >
                  <Text style={[s.filterBtnText, applyFilter === f.key && { color: f.color }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 신청 목록 */}
            {filteredApps.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>
                  {applyFilter === 'pending' ? '대기 중인 신청이 없어요' :
                   applyFilter === 'approved' ? '승인된 가맹점이 없어요' : '반려된 신청이 없어요'}
                </Text>
              </View>
            ) : (
              filteredApps.map(app => (
                <View key={app.id} style={[s.appCard, { borderColor: SA.border }]}>
                  {/* 카드 헤더 */}
                  <View style={s.appCardHeader}>
                    <View style={[
                      s.statusBadge,
                      app.status === 'pending'  ? { backgroundColor: SA.warnLight }    :
                      app.status === 'approved' ? { backgroundColor: SA.successLight } :
                      { backgroundColor: SA.accentLight }
                    ]}>
                      <Text style={[
                        s.statusText,
                        app.status === 'pending'  ? { color: SA.warn }    :
                        app.status === 'approved' ? { color: SA.success } :
                        { color: SA.accent }
                      ]}>
                        {app.status === 'pending' ? '⏳ 대기중' :
                         app.status === 'approved' ? '✅ 승인' : '❌ 반려'}
                      </Text>
                    </View>
                    <Text style={s.appDate}>
                      {new Date(app.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>

                  <Text style={s.appStoreName}>{app.store_name}</Text>
                  <Text style={s.appCategory}>{app.category}</Text>

                  <View style={s.appInfoRow}>
                    <InfoItem label="주소" value={
                      app.postcode
                        ? `[${app.postcode}] ${app.address}${app.address_detail ? ' ' + app.address_detail : ''}`
                        : app.address
                    } />
                    <InfoItem label="가게 전화" value={app.phone} />
                    <InfoItem label="대표자" value={app.owner_name} />
                    <InfoItem label="대표 연락처" value={app.owner_phone} />
                    {app.owner_email ? <InfoItem label="이메일" value={app.owner_email} /> : null}
                    {app.naver_place_url ? <InfoItem label="네이버 업체" value={app.naver_place_url} /> : null}
                    {app.instagram_url  ? <InfoItem label="인스타그램" value={app.instagram_url} /> : null}
                    {app.description ? <InfoItem label="소개" value={app.description} /> : null}
                    {app.message ? <InfoItem label="한마디" value={app.message} /> : null}
                    {app.admin_note ? <InfoItem label="관리자 메모" value={app.admin_note} /> : null}
                  </View>

                  {/* 액션 버튼 */}
                  {app.status === 'pending' && (
                    <View style={s.appBtnRow}>
                      <TouchableOpacity
                        style={[s.appBtn, { backgroundColor: SA.successLight, borderColor: SA.success }]}
                        onPress={() => openNoteModal(app, 'approve')}
                      >
                        <Text style={[s.appBtnText, { color: SA.success }]}>✅ 승인</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.appBtn, { backgroundColor: SA.accentLight, borderColor: SA.accent }]}
                        onPress={() => openNoteModal(app, 'reject')}
                      >
                        <Text style={[s.appBtnText, { color: SA.accent }]}>❌ 반려</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {(app.status === 'approved' || app.status === 'rejected') && (
                    <TouchableOpacity
                      style={[s.appBtn, { backgroundColor: SA.warnLight, borderColor: SA.warn, alignSelf: 'flex-start' }]}
                      onPress={() => handlePending(app)}
                    >
                      <Text style={[s.appBtnText, { color: SA.warn }]}>⏳ 보류로 변경</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* ────────── 상권관리 탭 ────────── */}
        {mainTab === 'district' && (
          <>
            {/* 상권 등록 버튼 */}
            <TouchableOpacity style={s.sendBtn} onPress={() => setDistrictModal(true)} activeOpacity={0.85}>
              <Text style={s.sendBtnText}>🗺 새 상권 등록</Text>
              <Text style={s.sendBtnSub}>지역 상권을 추가하고 가맹점을 연결하세요</Text>
            </TouchableOpacity>

            {/* 상권 목록 */}
            {districts.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>등록된 상권이 없어요</Text>
              </View>
            ) : districts.map(d => (
              <View key={d.id} style={[s.distCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
                <View style={s.distHeader}>
                  <View style={s.distBadge}>
                    <Text style={s.distBadgeText}>
                      {d.is_active ? '● 운영중' : '○ 비활성'}
                    </Text>
                  </View>
                  <Text style={s.distStoreCnt}>
                    🏪 {districtStats[d.id] ?? 0}개 가맹점
                  </Text>
                </View>
                <Text style={s.distName}>{d.name}</Text>
                {d.description ? (
                  <Text style={s.distDesc}>{d.description}</Text>
                ) : null}
                {(d.latitude && d.longitude) ? (
                  <Text style={s.distCoord}>
                    📍 {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                  </Text>
                ) : null}
              </View>
            ))}
          </>
        )}

        {/* ────────── 푸시 발송 탭 ────────── */}
        {mainTab === 'push' && (
          <>
            <View style={s.statsRow}>
              <StatCard icon="📣" label="전체발송" value={pushStats.totalSent}       color={SA.accent} />
              <StatCard icon="👁"  label="확인"     value={pushStats.totalRead}       color={SA.success} />
              <StatCard icon="🛡️" label="관리자"   value={pushStats.superAdminCount} color={SA.warn} />
              <StatCard icon="🍖" label="사장님"   value={pushStats.ownerCount}      color={SA.owner} />
            </View>

            {/* 읽음률 */}
            <View style={[s.rateCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
              <Text style={s.rateLabel}>전체 읽음률</Text>
              <Text style={s.rateValue}>
                {pushStats.totalSent > 0 ? Math.round((pushStats.totalRead / pushStats.totalSent) * 100) : 0}%
              </Text>
              <View style={s.rateBg}>
                <View style={[s.rateFill, {
                  width: `${pushStats.totalSent > 0 ? Math.min((pushStats.totalRead / pushStats.totalSent) * 100, 100) : 0}%`
                }]} />
              </View>
              <Text style={s.rateSub}>{pushStats.totalRead} / {pushStats.totalSent} 건</Text>
            </View>

            <TouchableOpacity style={s.sendBtn} onPress={() => setPushModal(true)} activeOpacity={0.85}>
              <Text style={s.sendBtnText}>📣 전체 사용자 푸시 발송</Text>
              <Text style={s.sendBtnSub}>앱 전체 사용자에게 즉시 발송</Text>
            </TouchableOpacity>

            {/* 히스토리 */}
            <View style={s.filterRow}>
              {(['all', 'superadmin', 'owner'] as PushFilter[]).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterBtn, pushFilter === f && s.filterBtnActivePush]}
                  onPress={() => setPushFilter(f)}
                >
                  <Text style={[s.filterBtnText, pushFilter === f && s.filterBtnTextActive]}>
                    {f === 'all' ? '전체' : f === 'superadmin' ? '관리자' : '사장님'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredPush.length === 0 ? (
              <View style={s.emptyBox}><Text style={s.emptyText}>발송 내역이 없어요</Text></View>
            ) : filteredPush.map(row => (
              <View key={row.id} style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
                <View style={s.histTop}>
                  <View style={[s.senderBadge,
                    { backgroundColor: row.sender_type === 'superadmin' ? SA.accentLight : SA.warnLight }
                  ]}>
                    <Text style={[s.senderText,
                      { color: row.sender_type === 'superadmin' ? SA.accent : SA.owner }
                    ]}>
                      {row.sender_type === 'superadmin' ? '🛡️ 시샵' : `🍖 ${row.sender_label}`}
                    </Text>
                  </View>
                  <Text style={s.histDate}>
                    {new Date(row.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={s.histTitle}>{row.title}</Text>
                <Text style={s.histBody} numberOfLines={2}>{row.body}</Text>
                <View style={s.histStats}>
                  <HistStat label="발송" value={row.sent_count} color={SA.text} />
                  <HistStat label="확인" value={row.read_count} color={SA.success} />
                  <HistStat label="읽음률" value={`${readRate(row)}%`} color={SA.accent} />
                  <View style={s.histRateBg}>
                    <View style={[s.histRateFill, { width: `${readRate(row)}%` }]} />
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
        {/* ────────── 공지 관리 탭 ────────── */}
        {mainTab === 'notice' && (
          <>
            {/* 새 공지 입력 */}
            <View style={[s.card, { gap: 10 }]}>
              <Text style={s.cardTitle}>📢 새 공지 등록</Text>

              {/* 제목 */}
              <Text style={{ color: SA.muted, fontSize: 12, fontWeight: '600' }}>제목 (배너·게시판 목록에 표시)</Text>
              <TextInput
                style={s.input}
                value={newNoticeTitle}
                onChangeText={setNewNoticeTitle}
                placeholder="예) 🎉 이번 주 쿠폰 대방출!"
                placeholderTextColor={SA.muted}
                maxLength={60}
              />
              <Text style={{ color: SA.muted, fontSize: 11, textAlign: 'right' }}>
                {newNoticeTitle.length}/60자
              </Text>

              {/* 내용 */}
              <Text style={{ color: SA.muted, fontSize: 12, fontWeight: '600' }}>내용 (클릭 시 펼쳐지는 본문)</Text>
              <TextInput
                style={[s.input, { minHeight: 64, textAlignVertical: 'top' }]}
                value={newNotice}
                onChangeText={setNewNotice}
                placeholder="상세 내용을 입력하세요 (선택)"
                placeholderTextColor={SA.muted}
                multiline
                maxLength={300}
              />
              <Text style={{ color: SA.muted, fontSize: 11, textAlign: 'right' }}>
                {newNotice.length}/300자
              </Text>

              <TouchableOpacity
                style={[s.confirmBtn, (!newNoticeTitle.trim() || noticeLoading) && { opacity: 0.5 }]}
                disabled={!newNoticeTitle.trim() || noticeLoading}
                onPress={async () => {
                  setNoticeLoading(true);
                  try {
                    await createAnnouncement(newNoticeTitle, newNotice);
                    setNewNoticeTitle('');
                    setNewNotice('');
                    const list = await fetchAllAnnouncements();
                    setNotices(list);
                    Alert.alert('✅ 등록 완료', '공지가 앱 홈 화면에 표시됩니다.');
                  } catch { Alert.alert('등록 실패'); }
                  finally { setNoticeLoading(false); }
                }}
              >
                {noticeLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.confirmText}>공지 등록</Text>
                }
              </TouchableOpacity>
            </View>

            {/* 공지 목록 */}
            <Text style={s.sectionTitle}>
              등록된 공지 ({notices.length}건 / 활성 {notices.filter(n => n.is_active).length}건)
            </Text>
            {notices.length === 0 ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📭</Text>
                <Text style={{ color: SA.muted }}>등록된 공지가 없어요</Text>
              </View>
            ) : (
              notices.map(n => (
                <View key={n.id} style={[s.card, { gap: 10 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>{n.is_active ? '📢' : '🔇'}</Text>
                    <View style={{ flex: 1, opacity: n.is_active ? 1 : 0.4 }}>
                      <Text style={[s.cardText, { fontWeight: '700' }]}>
                        {n.title?.trim() || '(제목 없음)'}
                      </Text>
                      {!!n.content?.trim() && (
                        <Text style={[s.cardText, { fontSize: 12, color: SA.muted, marginTop: 2 }]} numberOfLines={2}>
                          {n.content}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ color: SA.muted, fontSize: 11 }}>
                      {new Date(n.created_at).toLocaleDateString('ko-KR')}
                    </Text>
                    <Text style={{ color: SA.muted, fontSize: 11 }}>
                      👁 {n.view_count ?? 0}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* 활성/비활성 토글 */}
                    <TouchableOpacity
                      style={[s.actionBtn,
                        { backgroundColor: n.is_active ? SA.warnLight : SA.successLight,
                          borderColor: n.is_active ? SA.warn : SA.success, flex: 1 }
                      ]}
                      onPress={async () => {
                        await toggleAnnouncement(n.id, !n.is_active);
                        const list = await fetchAllAnnouncements();
                        setNotices(list);
                      }}
                    >
                      <Text style={{ color: n.is_active ? SA.warn : SA.success, fontSize: 12, fontWeight: '700' }}>
                        {n.is_active ? '⏸ 비활성' : '▶ 활성화'}
                      </Text>
                    </TouchableOpacity>
                    {/* 삭제 */}
                    <TouchableOpacity
                      style={[s.actionBtn, { borderColor: SA.accent, backgroundColor: SA.accentLight }]}
                      onPress={() =>
                        Alert.alert('공지 삭제', '이 공지를 삭제할까요?', [
                          { text: '취소', style: 'cancel' },
                          { text: '삭제', style: 'destructive', onPress: async () => {
                            await deleteAnnouncement(n.id);
                            const list = await fetchAllAnnouncements();
                            setNotices(list);
                          }},
                        ])
                      }
                    >
                      <Text style={{ color: SA.accent, fontSize: 12, fontWeight: '700' }}>🗑 삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ────────── 팝업 공지 관리 탭 ────────── */}
        {mainTab === 'popup' && (
          <>
            {/* 새 팝업 입력 */}
            <View style={[s.card, { gap: 10 }]}>
              <Text style={s.cardTitle}>🪟 홈 팝업 공지 등록</Text>
              <Text style={{ color: SA.muted, fontSize: 12, fontWeight: '600' }}>제목 *</Text>
              <TextInput
                style={s.input}
                value={newPopupTitle}
                onChangeText={setNewPopupTitle}
                placeholder="예) 🎉 이벤트 안내"
                placeholderTextColor={SA.muted}
                maxLength={40}
              />
              <Text style={{ color: SA.muted, fontSize: 11, textAlign: 'right' }}>
                {newPopupTitle.length}/40자
              </Text>
              <Text style={{ color: SA.muted, fontSize: 12, fontWeight: '600' }}>내용</Text>
              <TextInput
                style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={newPopupContent}
                onChangeText={setNewPopupContent}
                placeholder="팝업에 표시될 내용을 입력하세요"
                placeholderTextColor={SA.muted}
                multiline
                maxLength={200}
              />
              <Text style={{ color: SA.muted, fontSize: 11, textAlign: 'right' }}>
                {newPopupContent.length}/200자
              </Text>
              <TouchableOpacity
                style={[s.confirmBtn, (!newPopupTitle.trim() || popupLoading) && { opacity: 0.5 }]}
                disabled={!newPopupTitle.trim() || popupLoading}
                onPress={async () => {
                  setPopupLoading(true);
                  try {
                    await createPopupNotice(newPopupTitle, newPopupContent);
                    setNewPopupTitle('');
                    setNewPopupContent('');
                    const list = await fetchAllPopupNotices();
                    setPopups(list);
                    Alert.alert('✅ 등록 완료', '앱 홈 화면에 팝업이 표시됩니다.');
                  } catch { Alert.alert('등록 실패'); }
                  finally { setPopupLoading(false); }
                }}
              >
                {popupLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.confirmText}>팝업 등록</Text>
                }
              </TouchableOpacity>
            </View>

            {/* 팝업 목록 */}
            <Text style={s.sectionTitle}>
              등록된 팝업 ({popups.length}건 / 활성 {popups.filter(p => p.is_active).length}건)
            </Text>
            {popups.length === 0 ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🪟</Text>
                <Text style={{ color: SA.muted }}>등록된 팝업 공지가 없어요</Text>
              </View>
            ) : (
              popups.map(p => (
                <View key={p.id} style={[s.card, { gap: 10 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>{p.is_active ? '🪟' : '🔇'}</Text>
                    <View style={{ flex: 1, opacity: p.is_active ? 1 : 0.4 }}>
                      <Text style={[s.cardText, { fontWeight: '700' }]}>{p.title}</Text>
                      {!!p.content && (
                        <Text style={[s.cardText, { fontSize: 12, color: SA.muted, marginTop: 2 }]} numberOfLines={2}>
                          {p.content}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={{ color: SA.muted, fontSize: 11 }}>
                    {new Date(p.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[s.actionBtn,
                        { backgroundColor: p.is_active ? SA.warnLight : SA.successLight,
                          borderColor: p.is_active ? SA.warn : SA.success, flex: 1 }
                      ]}
                      onPress={async () => {
                        await togglePopupNotice(p.id, !p.is_active);
                        setPopups(await fetchAllPopupNotices());
                      }}
                    >
                      <Text style={{ color: p.is_active ? SA.warn : SA.success, fontSize: 12, fontWeight: '700' }}>
                        {p.is_active ? '⏸ 비활성' : '▶ 활성화'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, { borderColor: SA.accent, backgroundColor: SA.accentLight }]}
                      onPress={() =>
                        Alert.alert('팝업 삭제', '이 팝업을 삭제할까요?', [
                          { text: '취소', style: 'cancel' },
                          { text: '삭제', style: 'destructive', onPress: async () => {
                            await deletePopupNotice(p.id);
                            setPopups(await fetchAllPopupNotices());
                          }},
                        ])
                      }
                    >
                      <Text style={{ color: SA.accent, fontSize: 12, fontWeight: '700' }}>🗑 삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ────────── 쿠폰 클릭 통계 탭 ────────── */}
        {mainTab === 'coupon' && (
          <>
            {/* 쿠폰 발행 버튼 */}
            <TouchableOpacity
              style={s.couponCreateBtn}
              onPress={() => navigation.navigate('SuperAdminCouponCreate')}
              activeOpacity={0.85}
            >
              <Text style={s.couponCreateBtnText}>🎟 새 쿠폰 발행하기</Text>
            </TouchableOpacity>

            {/* 요약 통계 */}
            <View style={s.statsRow}>
              <StatCard
                icon="🎟" label="전체 쿠폰"
                value={couponList.length}
                color={SA.text}
              />
              <StatCard
                icon="👆" label="총 클릭"
                value={couponList.reduce((a, c) => a + (c.click_count ?? 0), 0)}
                color={SA.accent}
              />
              <StatCard
                icon="✅" label="총 발행"
                value={couponList.reduce((a, c) => a + c.issued_count, 0)}
                color={SA.success}
              />
            </View>

            <Text style={s.sectionTitle}>
              클릭 수 높은 순 · {couponList.length}개 쿠폰
            </Text>

            {couponList.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>등록된 쿠폰이 없어요</Text>
              </View>
            ) : (
              couponList.map(c => {
                const cfg = getCouponKindConfig(c.coupon_kind);
                const maxClicks = Math.max(couponList[0]?.click_count ?? 1, 1);
                const clickPct  = (c.click_count ?? 0) / maxClicks;
                const remaining = c.total_quantity - c.issued_count;
                return (
                  <View key={c.id} style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
                    {/* 상단: 쿠폰 종류 배지 + 클릭 수 */}
                    <View style={s.histTop}>
                      <View style={[s.senderBadge, { backgroundColor: cfg.bg + '33' }]}>
                        <Text style={[s.senderText, { color: cfg.bg }]}>
                          {cfg.emoji} {cfg.label}
                        </Text>
                      </View>
                      <View style={[s.senderBadge, { backgroundColor: SA.accentLight }]}>
                        <Text style={[s.senderText, { color: SA.accent }]}>
                          👆 {c.click_count ?? 0}회
                        </Text>
                      </View>
                    </View>

                    {/* 가게명 */}
                    {c.store_name && (
                      <Text style={{ fontSize: 11, color: SA.muted, marginBottom: 2 }}>
                        🏪 {c.store_name}
                      </Text>
                    )}

                    {/* 쿠폰 제목 */}
                    <Text style={s.histTitle} numberOfLines={1}>{c.title}</Text>

                    {/* 클릭 수 바 */}
                    <View style={s.histRateBg}>
                      <View style={[s.histRateFill, {
                        width: `${Math.round(clickPct * 100)}%` as any,
                        backgroundColor: cfg.bg,
                      }]} />
                    </View>

                    {/* 발행 현황 */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: SA.muted }}>
                        발행 {c.issued_count}/{c.total_quantity} · 잔여 {remaining}
                      </Text>
                      <Text style={{ fontSize: 11, color: c.is_active ? SA.success : SA.muted }}>
                        {c.is_active ? '● 활성' : '○ 비활성'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ────────── 회원 목록 탭 ────────── */}
        {mainTab === 'members' && (
          <>
            {/* 요약 통계 */}
            <View style={s.statsRow}>
              <StatCard icon="👥" label="전체 회원"
                value={members.length} color={SA.text} />
              <StatCard icon="🛍" label="일반 회원"
                value={members.filter(m => m.role === 'customer').length} color={SA.success} />
              <StatCard icon="🏪" label="가게 회원"
                value={members.filter(m => m.role === 'owner').length} color={SA.warn} />
            </View>

            {/* 필터 */}
            <View style={s.filterRow}>
              {([
                { key: 'all',      label: '전체' },
                { key: 'customer', label: '🛍 일반회원' },
                { key: 'owner',    label: '🏪 가게회원' },
              ] as { key: typeof memberFilter; label: string }[]).map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.filterBtn, memberFilter === f.key && s.filterBtnActive]}
                  onPress={() => setMemberFilter(f.key)}
                >
                  <Text style={[s.filterBtnText, memberFilter === f.key && s.filterBtnTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 회원 리스트 */}
            {members
              .filter(m => memberFilter === 'all' || m.role === memberFilter)
              .map(m => {
                const isOwner = m.role === 'owner';
                const roleColor = m.role === 'superadmin' ? SA.accent
                  : isOwner ? SA.warn : SA.success;
                const roleLabel = m.role === 'superadmin' ? '시샵'
                  : isOwner ? '🏪 가게' : '🛍 일반';
                return (
                  <View key={m.id} style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
                    <View style={s.histTop}>
                      <View style={[s.senderBadge, { backgroundColor: roleColor + '22' }]}>
                        <Text style={[s.senderText, { color: roleColor }]}>{roleLabel}</Text>
                      </View>
                      <Text style={[s.histDate, { color: SA.muted }]}>
                        {new Date(m.created_at).toLocaleDateString('ko-KR')}
                      </Text>
                    </View>

                    <Text style={[s.histTitle, { marginTop: 4 }]}>
                      {m.name || m.nickname || '이름없음'}
                      {m.nickname && m.name ? ` (${m.nickname})` : ''}
                    </Text>
                    <Text style={{ fontSize: 12, color: SA.muted }}>{m.email}</Text>
                    {m.phone && (
                      <Text style={{ fontSize: 12, color: SA.muted }}>📞 {m.phone}</Text>
                    )}

                    {/* 가게회원이면 가게 정보 표시 */}
                    {isOwner && m.store && (
                      <View style={[s.senderBadge, { backgroundColor: SA.warnLight, marginTop: 6, alignSelf: 'flex-start' }]}>
                        <Text style={[s.senderText, { color: SA.warn }]}>
                          🏪 {m.store.name} · {m.store.category} · {m.store.is_active ? '영업중' : '비활성'}
                        </Text>
                      </View>
                    )}
                    {isOwner && !m.store && (
                      <View style={[s.senderBadge, { backgroundColor: '#FF000022', marginTop: 6, alignSelf: 'flex-start' }]}>
                        <Text style={[s.senderText, { color: '#FF6B6B' }]}>⚠️ 가게 미등록</Text>
                      </View>
                    )}
                  </View>
                );
              })
            }
            {members.filter(m => memberFilter === 'all' || m.role === memberFilter).length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>해당 회원이 없어요</Text>
              </View>
            )}
          </>
        )}

        {/* ────────── 핫플 등록 탭 ────────── */}
        {mainTab === 'hotplace' && (
          <>
            {/* 요약 통계 */}
            <View style={s.statsRow}>
              <StatCard icon="🗺" label="등록 핫플" value={hotplaces.length}                            color={SA.warn} />
              <StatCard icon="✅" label="정상 영업" value={hotplaces.filter(h => !h.is_closed).length}  color={SA.success} />
              <StatCard icon="🚫" label="폐업 처리" value={hotplaces.filter(h =>  h.is_closed).length}  color={SA.accent} />
            </View>

            {/* ── STEP 1: 업체명 검색 ── */}
            {!showForm && (
              <View style={[s.sectionBox, { backgroundColor: SA.card, borderColor: SA.warn + '55' }]}>
                <Text style={[s.sectionLabel, { color: SA.warn }]}>🔍 네이버 업체 검색으로 핫플 등록</Text>
                <Text style={[s.sectionDesc, { color: SA.muted, fontSize: 11 }]}>
                  업체명 또는 주소를 입력하면 네이버 공식 API로 자동 검색해요
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput
                    style={[s.input, { flex: 1, borderColor: SA.border, marginBottom: 0 }]}
                    value={hpQuery}
                    onChangeText={setHpQuery}
                    placeholder="예) 언니네 삼겹살 창원"
                    placeholderTextColor={SA.muted}
                    returnKeyType="search"
                    onSubmitEditing={handleNaverSearch}
                  />
                  <TouchableOpacity
                    style={[s.confirmBtn, { paddingHorizontal: 16, marginTop: 0 }, hpSearching && { opacity: 0.6 }]}
                    onPress={handleNaverSearch}
                    disabled={hpSearching}
                  >
                    {hpSearching
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.confirmText}>검색</Text>}
                  </TouchableOpacity>
                </View>

                {/* 검색 결과 목록 */}
                {hpResults.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: SA.muted, fontSize: 11, marginBottom: 6 }}>
                      검색 결과 {hpResults.length}건 — 탭하면 자동 입력돼요
                    </Text>
                    {hpResults.map((r, i) => (
                      <TouchableOpacity
                        key={i}
                        style={{
                          backgroundColor: SA.bg,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: SA.border,
                          padding: 10,
                          marginBottom: 6,
                        }}
                        onPress={() => handleSelectResult(r)}
                        activeOpacity={0.75}
                      >
                        <Text style={{ color: SA.text, fontWeight: '700', fontSize: 14 }}>{r.name}</Text>
                        <Text style={{ color: SA.warn, fontSize: 12, marginTop: 2 }}>{r.category}</Text>
                        <Text style={{ color: SA.muted, fontSize: 12 }}>{r.address}</Text>
                        {r.phone ? <Text style={{ color: SA.muted, fontSize: 12 }}>📞 {r.phone}</Text> : null}
                        {r.place_id
                          ? <Text style={{ color: SA.success, fontSize: 10, marginTop: 2 }}>
                              ✅ 네이버 ID: {r.place_id}
                            </Text>
                          : <Text style={{ color: SA.accent, fontSize: 10, marginTop: 2 }}>
                              ⚠️ Place ID 없음
                            </Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* 수동 입력 버튼 */}
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: SA.border, marginTop: 8 }]}
                  onPress={() => {
                    setHpForm({ place_id: '', naver_place_url: '', name: '', category: '',
                      address: '', phone: '', latitude: '', longitude: '', description: '' });
                    setHpResults([]);
                    setShowForm(true);
                  }}
                >
                  <Text style={[s.confirmText, { color: SA.muted }]}>✏️ 직접 입력하기</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2: 수동 입력 폼 ── */}
            {showForm && (
              <View style={[s.sectionBox, { backgroundColor: SA.card, borderColor: SA.success + '55' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[s.sectionLabel, { color: SA.success }]}>📝 업체 정보 입력</Text>
                  <TouchableOpacity onPress={() => setShowForm(false)}>
                    <Text style={{ color: SA.muted, fontSize: 12 }}>✕ 취소</Text>
                  </TouchableOpacity>
                </View>

                {/* place_id 확인 */}
                <View style={{ backgroundColor: SA.border + '44', borderRadius: 8, padding: 8 }}>
                  <Text style={{ color: SA.muted, fontSize: 10 }}>네이버 Place ID (자동 추출)</Text>
                  <Text style={{ color: SA.warn, fontSize: 13, fontWeight: '700' }}>{hpForm.place_id}</Text>
                </View>

                {(
                  [
                    { key: 'name',        label: '🏪 업체명 *',    ph: '예) 언니네 삼겹살',           multi: false },
                    { key: 'category',    label: '🍴 카테고리 *',  ph: '예) 한식 / 카페 / 고기구이',  multi: false },
                    { key: 'address',     label: '📍 주소 *',      ph: '예) 서울시 강남구 테헤란로…',  multi: false },
                    { key: 'phone',       label: '📞 전화번호',     ph: '예) 02-1234-5678',           multi: false },
                    { key: 'latitude',    label: '🌐 위도 (선택)', ph: '예) 37.12345',               multi: false },
                    { key: 'longitude',   label: '🌐 경도 (선택)', ph: '예) 127.12345',              multi: false },
                    { key: 'description', label: '📝 설명 (선택)', ph: '가게 소개 문구',              multi: true  },
                  ] as { key: keyof NaverPlaceForm; label: string; ph: string; multi: boolean }[]
                ).map(({ key, label, ph, multi }) => (
                  <View key={key} style={s.inputGroup}>
                    <Text style={s.inputLabel}>{label}</Text>
                    <TextInput
                      style={[s.input, multi && s.inputMulti, { borderColor: SA.border }]}
                      value={hpForm[key]}
                      onChangeText={v => setHpForm(f => ({ ...f, [key]: v }))}
                      placeholder={ph}
                      placeholderTextColor={SA.muted}
                      keyboardType={
                        key === 'latitude' || key === 'longitude' ? 'decimal-pad' : 'default'
                      }
                      multiline={multi}
                      numberOfLines={multi ? 2 : 1}
                    />
                  </View>
                ))}

                <View style={[s.modalBtns, { marginTop: 4 }]}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}>
                    <Text style={s.cancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.confirmBtn, { backgroundColor: SA.success }, naverRegistering && { opacity: 0.6 }]}
                    onPress={handleRegisterHotplace}
                    disabled={naverRegistering}
                  >
                    {naverRegistering
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.confirmText}>🗺 핫플 등록</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── 등록된 핫플 목록 ── */}
            <Text style={[s.sectionLabel, { color: SA.text, marginTop: 4 }]}>📋 등록된 핫플 목록</Text>

            {hotplaces.length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>등록된 핫플이 없어요</Text>
                <Text style={{ color: SA.muted, fontSize: 11, marginTop: 4 }}>
                  위에서 업체명을 검색해서 등록해보세요!
                </Text>
              </View>
            )}

            {hotplaces.map(hp => {
              const isClosed = hp.is_closed;
              const toggling = closureToggling[hp.id] ?? false;

              return (
                <View key={hp.id} style={[s.histCard, {
                  backgroundColor: SA.card,
                  borderColor: isClosed ? SA.accent + '66' : SA.border,
                }]}>
                  <View style={s.histTop}>
                    <View style={[s.badge, {
                      backgroundColor: isClosed ? SA.accent + '22' : SA.success + '22',
                      borderColor:     isClosed ? SA.accent         : SA.success,
                    }]}>
                      <Text style={[s.badgeText, { color: isClosed ? SA.accent : SA.success }]}>
                        {isClosed ? '🚫 폐업' : '✅ 영업중'}
                      </Text>
                    </View>
                    <Text style={[s.histDate, { color: SA.muted }]}>
                      {new Date(hp.created_at).toLocaleDateString('ko-KR')} 등록
                    </Text>
                  </View>

                  <Text style={[s.histTitle, { color: SA.text }]}>{hp.name}</Text>
                  <Text style={{ color: SA.muted, fontSize: 12 }}>{hp.category} · {hp.address}</Text>
                  {hp.phone ? <Text style={{ color: SA.muted, fontSize: 12 }}>📞 {hp.phone}</Text> : null}
                  <Text style={{ color: SA.muted, fontSize: 11, marginTop: 4 }}>
                    🔗 네이버 ID: {hp.naver_place_id}
                  </Text>

                  {/* 폐업 수동 토글 버튼 */}
                  <TouchableOpacity
                    style={[s.filterBtn, {
                      marginTop: 10, alignSelf: 'flex-start',
                      backgroundColor: isClosed ? SA.success + '22' : SA.accent + '22',
                      borderColor:     isClosed ? SA.success         : SA.accent,
                      flexDirection: 'row', gap: 6, alignItems: 'center',
                    }]}
                    onPress={() => handleToggleClosure(hp)}
                    disabled={toggling}
                  >
                    {toggling
                      ? <ActivityIndicator size="small" color={isClosed ? SA.success : SA.accent} />
                      : <Text style={[s.filterBtnText, { color: isClosed ? SA.success : SA.accent }]}>
                          {isClosed ? '✅ 영업 재개로 변경' : '🚫 폐업으로 변경'}
                        </Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {/* ────────── 배너 광고 탭 ────────── */}
        {mainTab === 'banner' && (
          <>
            {/* 통계 */}
            <View style={s.statsRow}>
              <StatCard icon="📢" label="전체 배너" value={banners.length}                                                      color={SA.warn} />
              <StatCard icon="✅" label="활성"      value={banners.filter(b => bannerStatus(b) === 'active').length}           color={SA.success} />
              <StatCard icon="⏸" label="보류"       value={banners.filter(b => bannerStatus(b) === 'paused').length}          color={SA.muted} />
              <StatCard icon="⏰" label="예약"       value={banners.filter(b => bannerStatus(b) === 'scheduled').length}      color={SA.accent} />
            </View>

            {/* 배너 등록 버튼 */}
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: SA.warn, flexDirection: 'row', gap: 6, justifyContent: 'center' }]}
              onPress={() => {
                setEditingBanner(null);
                setBannerForm(emptyBannerForm());
                setBannerModal(true);
              }}
            >
              <Text style={[s.confirmText, { color: '#000' }]}>＋ 새 배너 등록</Text>
            </TouchableOpacity>

            {/* 배너 목록 */}
            {banners.length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>등록된 배너가 없어요</Text>
              </View>
            )}

            {banners.map(b => {
              const st      = bannerStatus(b);
              const toggling = bannerToggling[b.id] ?? false;
              const stColor  = st === 'active' ? SA.success : st === 'paused' ? SA.muted : st === 'expired' ? SA.accent : SA.warn;
              const stLabel  = st === 'active' ? '✅ 활성' : st === 'paused' ? '⏸ 보류' : st === 'expired' ? '⌛ 만료' : '⏰ 예약';

              return (
                <View key={b.id} style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
                  {/* 배너 미리보기 */}
                  <View style={[bn.preview, { backgroundColor: b.bg_color }]}>
                    <Text style={bn.previewEmoji}>{b.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[bn.previewTitle, { color: b.text_color }]} numberOfLines={1}>{b.title}</Text>
                      {b.subtitle ? (
                        <Text style={[bn.previewSub, { color: b.text_color + 'CC' }]} numberOfLines={1}>{b.subtitle}</Text>
                      ) : null}
                    </View>
                    <View style={[bn.previewCta, { borderColor: b.text_color + '66' }]}>
                      <Text style={[bn.previewCtaText, { color: b.text_color }]}>{b.cta_text}</Text>
                    </View>
                  </View>

                  {/* 메타 */}
                  <View style={s.histTop}>
                    <View style={[s.badge, { backgroundColor: stColor + '22', borderColor: stColor }]}>
                      <Text style={[s.badgeText, { color: stColor }]}>{stLabel}</Text>
                    </View>
                    <Text style={{ color: SA.muted, fontSize: 11 }}>
                      순서 {b.display_order} · {new Date(b.created_at).toLocaleDateString('ko-KR')}
                    </Text>
                  </View>
                  <Text style={{ color: SA.muted, fontSize: 12 }}>
                    {new Date(b.starts_at).toLocaleDateString('ko-KR')} ~{' '}
                    {b.ends_at ? new Date(b.ends_at).toLocaleDateString('ko-KR') : '무기한'}
                  </Text>

                  {/* 액션 버튼 */}
                  <View style={bn.actions}>
                    {/* 수정 */}
                    <TouchableOpacity
                      style={[bn.actionBtn, { borderColor: SA.warn + '88', backgroundColor: SA.warn + '22' }]}
                      onPress={() => {
                        setEditingBanner(b);
                        setBannerForm({
                          title: b.title, subtitle: b.subtitle ?? '',
                          emoji: b.emoji, bg_color: b.bg_color, text_color: b.text_color,
                          cta_text: b.cta_text, link_type: b.link_type, link_value: b.link_value,
                          starts_at: b.starts_at, ends_at: b.ends_at,
                          is_paused: b.is_paused, display_order: b.display_order,
                        });
                        setBannerModal(true);
                      }}
                    >
                      <Text style={[bn.actionText, { color: SA.warn }]}>✏️ 수정</Text>
                    </TouchableOpacity>

                    {/* 보류 / 재개 */}
                    <TouchableOpacity
                      style={[bn.actionBtn, { borderColor: b.is_paused ? SA.success + '88' : SA.muted + '88',
                        backgroundColor: b.is_paused ? SA.success + '22' : SA.muted + '22' }]}
                      onPress={() => handleToggleBannerPause(b)}
                      disabled={toggling}
                    >
                      {toggling
                        ? <ActivityIndicator size="small" color={SA.muted} />
                        : <Text style={[bn.actionText, { color: b.is_paused ? SA.success : SA.muted }]}>
                            {b.is_paused ? '▶ 재개' : '⏸ 보류'}
                          </Text>}
                    </TouchableOpacity>

                    {/* 삭제 */}
                    <TouchableOpacity
                      style={[bn.actionBtn, { borderColor: SA.accent + '88', backgroundColor: SA.accent + '22' }]}
                      onPress={() => handleDeleteBanner(b)}
                    >
                      <Text style={[bn.actionText, { color: SA.accent }]}>🗑 삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ────────── 뮤직 탭 ────────── */}
        {mainTab === 'music' && (
          <>
            {/* 플레이리스트 관리 바로가기 */}
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: '#1A1A3A', borderColor: '#4040AA' }]}
              onPress={() => navigation.navigate('SuperAdminPlaylist')}
              activeOpacity={0.85}
            >
              <Text style={s.sendBtnText}>📚 플레이리스트 관리</Text>
              <Text style={s.sendBtnSub}>큐레이션 플레이리스트 생성·편집·트랙 구성</Text>
            </TouchableOpacity>

            {/* 트랙 등록 */}
            <TouchableOpacity
              style={s.sendBtn}
              onPress={() => { resetMusicForm(); setMusicModal(true); }}
              activeOpacity={0.85}
            >
              <Text style={s.sendBtnText}>🎵 새 트랙 등록</Text>
              <Text style={s.sendBtnSub}>음악 파일을 업로드하고 매장에 배포하세요</Text>
            </TouchableOpacity>

            {/* 통계 요약 */}
            <View style={s.statsRow}>
              <StatCard icon="🎵" label="전체" value={musicTracks.length} color={SA.accent} />
              <StatCard icon="✅" label="활성" value={musicTracks.filter(t => t.is_active).length} color={SA.success} />
              <StatCard icon="⏸" label="비활성" value={musicTracks.filter(t => !t.is_active).length} color={SA.muted} />
            </View>

            {musicLoading ? (
              <ActivityIndicator color={SA.accent} style={{ marginTop: 32 }} />
            ) : musicTracks.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>등록된 음악 트랙이 없어요</Text>
              </View>
            ) : musicTracks.map(track => (
              <View key={track.id} style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
                {/* 헤더 */}
                <View style={s.histTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Text style={{ fontSize: 32 }}>{track.cover_emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.histTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={s.histBody}>{track.artist}</Text>
                    </View>
                  </View>
                  <View style={[
                    s.senderBadge,
                    track.is_active
                      ? { backgroundColor: SA.successLight }
                      : { backgroundColor: SA.accentLight },
                  ]}>
                    <Text style={[s.senderText, { color: track.is_active ? SA.success : SA.accent }]}>
                      {track.is_active ? '● 활성' : '○ 비활성'}
                    </Text>
                  </View>
                </View>

                {/* 메타 정보 */}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <View style={[s.senderBadge, { backgroundColor: '#5B67CA22' }]}>
                    <Text style={[s.senderText, { color: '#5B67CA' }]}>#{track.mood}</Text>
                  </View>
                  <View style={[s.senderBadge, { backgroundColor: '#FF6B3D22' }]}>
                    <Text style={[s.senderText, { color: '#FF6B3D' }]}>
                      {track.store_category === 'all' ? '전체업종' : track.store_category}
                    </Text>
                  </View>
                  <View style={[s.senderBadge, { backgroundColor: SA.warnLight }]}>
                    <Text style={[s.senderText, { color: SA.warn }]}>
                      {Math.floor(track.duration_sec / 60)}:{String(track.duration_sec % 60).padStart(2, '0')}
                    </Text>
                  </View>
                </View>

                {/* 액션 버튼 */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[s.appBtn, { flex: 1, backgroundColor: '#5B67CA22', borderColor: '#5B67CA' }]}
                    onPress={() => handleEditMusic(track)}
                  >
                    <Text style={[s.appBtnText, { color: '#5B67CA' }]}>✏️ 수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.appBtn, { flex: 1,
                      backgroundColor: track.is_active ? SA.accentLight : SA.successLight,
                      borderColor: track.is_active ? SA.accent : SA.success,
                    }]}
                    onPress={() => handleToggleMusic(track)}
                  >
                    <Text style={[s.appBtnText, { color: track.is_active ? SA.accent : SA.success }]}>
                      {track.is_active ? '⏸ 비활성' : '▶ 활성화'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.appBtn, { flex: 1, backgroundColor: SA.accentLight, borderColor: SA.accent }]}
                    onPress={() => handleDeleteMusic(track)}
                  >
                    <Text style={[s.appBtnText, { color: SA.accent }]}>🗑 삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ────────── 설정 탭 ────────── */}
        {mainTab === 'settings' && (
          <>
            {/* ── 게시물 작성 시간 설정 ── */}
            <View style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
              <Text style={[s.sectionTitle, { color: SA.warn, marginBottom: 4 }]}>
                📝 게시물 작성 시간 설정
              </Text>
              <Text style={{ color: SA.muted, fontSize: 12, marginBottom: 16, lineHeight: 18 }}>
                사장님이 피드 게시물을 작성할 수 있는 시간 창과 업체당 최소 게시 간격을 설정해요.{'\n'}
                현재 설정: {postSettings.post_start_hour}시 ~ {postSettings.post_end_hour}시 /
                {' '}{postSettings.post_cooldown_hours}시간 간격
              </Text>

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>🌅 게시 시작 시각 (0~23시)</Text>
                <TextInput
                  style={[s.input, { borderColor: SA.border }]}
                  value={psStartHour}
                  onChangeText={setPsStartHour}
                  keyboardType="number-pad"
                  placeholder="8"
                  placeholderTextColor={SA.muted}
                  maxLength={2}
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>🌆 게시 종료 시각 (1~24시)</Text>
                <TextInput
                  style={[s.input, { borderColor: SA.border }]}
                  value={psEndHour}
                  onChangeText={setPsEndHour}
                  keyboardType="number-pad"
                  placeholder="20"
                  placeholderTextColor={SA.muted}
                  maxLength={2}
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>⏱ 게시 쿨다운 (시간, 1~168)</Text>
                <TextInput
                  style={[s.input, { borderColor: SA.border }]}
                  value={psCooldown}
                  onChangeText={setPsCooldown}
                  keyboardType="number-pad"
                  placeholder="12"
                  placeholderTextColor={SA.muted}
                  maxLength={3}
                />
                <Text style={{ color: SA.muted, fontSize: 11, marginTop: 4 }}>
                  업체당 이 시간 이내에는 게시물을 중복 작성할 수 없어요
                </Text>
              </View>

              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: SA.warn, marginTop: 4 }, psSaving && { opacity: 0.6 }]}
                onPress={handleSavePostSettings}
                disabled={psSaving}
              >
                {psSaving
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={[s.confirmText, { color: '#000' }]}>💾 설정 저장</Text>}
              </TouchableOpacity>
            </View>

            {/* 안내 박스 */}
            <View style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border, opacity: 0.8 }]}>
              <Text style={{ color: SA.muted, fontSize: 12, lineHeight: 20 }}>
                💡 <Text style={{ color: SA.text, fontWeight: '700' }}>적용 방법</Text>{'\n'}
                저장 즉시 모든 사장님의 게시물 작성에 적용됩니다.{'\n'}
                기존에 작성된 게시물에는 영향 없음.{'\n\n'}
                💡 <Text style={{ color: SA.text, fontWeight: '700' }}>운영 예시</Text>{'\n'}
                · 오전 8시 ~ 오후 8시 (기본){'\n'}
                · 24시간 쿨다운: 하루 1개 게시물만 가능
              </Text>
            </View>

            {/* ── 게시물 삭제 요청 관리 ── */}
            <View style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[s.sectionTitle, { color: SA.accent, flex: 1, marginBottom: 0 }]}>
                  🗑 게시물 삭제 요청
                </Text>
                <View style={[s.badge, { backgroundColor: SA.accent + '22', borderColor: SA.accent }]}>
                  <Text style={[s.badgeText, { color: SA.accent }]}>
                    대기 {postDelReqs.filter(r => r.status === 'pending').length}건
                  </Text>
                </View>
              </View>

              {/* 필터 탭 */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['pending', 'approved', 'rejected'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.mainTab, delReqFilter === f && s.mainTabActive,
                      { paddingHorizontal: 12, paddingVertical: 6 }]}
                    onPress={() => setDelReqFilter(f)}
                  >
                    <Text style={[s.mainTabText, delReqFilter === f && s.mainTabTextActive]}>
                      {f === 'pending' ? '⏳ 대기' : f === 'approved' ? '✅ 승인' : '❌ 반려'}
                      {' '}({postDelReqs.filter(r => r.status === f).length})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {postDelReqs.filter(r => r.status === delReqFilter).length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyText}>해당 요청이 없어요</Text>
                </View>
              ) : postDelReqs.filter(r => r.status === delReqFilter).map(req => {
                const processing = delReqProcessing[req.id] ?? false;
                return (
                  <View key={req.id} style={[s.histCard, { backgroundColor: '#1A1A2E', borderColor: SA.border, marginBottom: 8 }]}>
                    {/* 가게명 + 시각 */}
                    <View style={s.histTop}>
                      <Text style={{ color: SA.warn, fontWeight: '700', fontSize: 13 }}>
                        🏪 {req.store?.name ?? '알 수 없는 가게'}
                      </Text>
                      <Text style={{ color: SA.muted, fontSize: 11 }}>
                        {new Date(req.requested_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    {/* 게시물 내용 미리보기 */}
                    <Text style={{ color: SA.muted, fontSize: 12, lineHeight: 18, marginVertical: 4 }}
                      numberOfLines={2}>
                      📝 {req.post?.content ?? '(삭제된 게시물)'}
                    </Text>

                    {/* 삭제 사유 */}
                    <View style={{ backgroundColor: SA.accentLight, borderRadius: 6, padding: 8, marginBottom: 4 }}>
                      <Text style={{ color: SA.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
                        삭제 사유
                      </Text>
                      <Text style={{ color: SA.text, fontSize: 12, lineHeight: 18 }}>{req.reason}</Text>
                    </View>

                    {/* 활성 쿠폰 경고 */}
                    {req.has_active_coupon && (
                      <View style={{ backgroundColor: SA.warnLight, borderRadius: 6, padding: 6, marginBottom: 4 }}>
                        <Text style={{ color: SA.warn, fontSize: 11, fontWeight: '700' }}>
                          ⚠️ 요청 당시 발급 중인 쿠폰이 있었어요
                        </Text>
                      </View>
                    )}

                    {/* 처리 메모 (승인/반려된 경우) */}
                    {req.admin_note && (
                      <Text style={{ color: SA.muted, fontSize: 11, fontStyle: 'italic', marginBottom: 4 }}>
                        📋 처리 메모: {req.admin_note}
                      </Text>
                    )}

                    {/* 액션 버튼 (대기 중인 경우만) */}
                    {req.status === 'pending' && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <TouchableOpacity
                          style={[s.confirmBtn, { flex: 1, backgroundColor: SA.success + '22',
                            borderWidth: 1, borderColor: SA.success + '88' }, processing && { opacity: 0.5 }]}
                          onPress={() => openDelReqNote(req, 'approved')}
                          disabled={processing}
                        >
                          {processing
                            ? <ActivityIndicator size="small" color={SA.success} />
                            : <Text style={[s.confirmText, { color: SA.success }]}>✅ 승인 (삭제)</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.confirmBtn, { flex: 1, backgroundColor: SA.accent + '22',
                            borderWidth: 1, borderColor: SA.accent + '88' }, processing && { opacity: 0.5 }]}
                          onPress={() => openDelReqNote(req, 'rejected')}
                          disabled={processing}
                        >
                          {processing
                            ? <ActivityIndicator size="small" color={SA.accent} />
                            : <Text style={[s.confirmText, { color: SA.accent }]}>❌ 반려</Text>}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* ── 게시물 수정 로그 ── */}
            <View style={[s.histCard, { backgroundColor: SA.card, borderColor: SA.border }]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={() => setPostLogExpanded(v => !v)}
              >
                <Text style={[s.sectionTitle, { color: SA.warn, flex: 1, marginBottom: 0 }]}>
                  📋 게시물 수정 로그
                </Text>
                <Text style={{ color: SA.muted, fontSize: 13 }}>
                  {postLogExpanded ? '▲ 접기' : `▼ 펼치기 (${postEditLogs.length}건)`}
                </Text>
              </TouchableOpacity>

              {postLogExpanded && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  {postEditLogs.length === 0 ? (
                    <View style={s.emptyBox}>
                      <Text style={s.emptyText}>수정 이력이 없어요</Text>
                    </View>
                  ) : postEditLogs.slice(0, 30).map(log => (
                    <View key={log.id} style={[s.histCard, { backgroundColor: '#1A1A2E', borderColor: SA.border }]}>
                      <View style={s.histTop}>
                        <Text style={{ color: SA.warn, fontWeight: '700', fontSize: 12 }}>
                          🏪 {log.store?.name ?? '알 수 없음'}
                        </Text>
                        <Text style={{ color: SA.muted, fontSize: 11 }}>
                          {new Date(log.edited_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <Text style={{ color: SA.muted, fontSize: 11, marginTop: 4 }}>수정 전</Text>
                      <Text style={{ color: '#FF9999', fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
                        {log.old_content}
                      </Text>
                      <Text style={{ color: SA.muted, fontSize: 11, marginTop: 6 }}>수정 후</Text>
                      <Text style={{ color: '#99FF99', fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
                        {log.new_content}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── 삭제 요청 처리 메모 모달 ── */}
      <Modal visible={delReqNoteModal} transparent animationType="slide" onRequestClose={() => setDelReqNoteModal(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setDelReqNoteModal(false)} />
          <View style={[s.modalSheet, { backgroundColor: SA.card }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: delReqNoteAction === 'approved' ? SA.success : SA.accent }]}>
              {delReqNoteAction === 'approved' ? '✅ 삭제 요청 승인' : '❌ 삭제 요청 반려'}
            </Text>
            <Text style={[s.modalDesc, { color: SA.muted }]}>
              {delReqNoteAction === 'approved'
                ? '승인하면 게시물이 즉시 삭제됩니다'
                : '반려 사유를 입력하면 사장님에게 전달돼요 (선택)'}
            </Text>
            <View style={s.inputGroup}>
              <Text style={[s.inputLabel, { color: SA.muted }]}>처리 메모 (선택)</Text>
              <TextInput
                style={[s.input, { borderColor: SA.border, color: SA.text, minHeight: 80, textAlignVertical: 'top' }]}
                value={delReqNote}
                onChangeText={setDelReqNote}
                placeholder={delReqNoteAction === 'approved' ? '승인 사유 (선택)' : '반려 사유를 입력해주세요'}
                placeholderTextColor={SA.muted}
                multiline
                maxLength={200}
              />
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.cancelBtn, { flex: 1 }]} onPress={() => setDelReqNoteModal(false)}>
                <Text style={s.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtn, { flex: 1,
                  backgroundColor: delReqNoteAction === 'approved' ? SA.success : SA.accent }]}
                onPress={handleProcessDelReq}
              >
                <Text style={[s.confirmText, { color: '#fff' }]}>
                  {delReqNoteAction === 'approved' ? '✅ 승인 확정' : '❌ 반려 확정'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 배너 등록 / 수정 모달 ── */}
      <Modal visible={bannerModal} animationType="slide" transparent onRequestClose={() => setBannerModal(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setBannerModal(false)} />
          <View style={[s.modalSheet, { maxHeight: '88%' }]}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{editingBanner ? '✏️ 배너 수정' : '📢 새 배너 등록'}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {/* 미리보기 */}
              <View style={[bn.preview, { backgroundColor: bannerForm.bg_color, marginBottom: 12, borderRadius: 12 }]}>
                <Text style={bn.previewEmoji}>{bannerForm.emoji || '🎉'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[bn.previewTitle, { color: bannerForm.text_color }]} numberOfLines={1}>
                    {bannerForm.title || '배너 제목'}
                  </Text>
                  {bannerForm.subtitle ? (
                    <Text style={[bn.previewSub, { color: bannerForm.text_color + 'CC' }]} numberOfLines={1}>
                      {bannerForm.subtitle}
                    </Text>
                  ) : null}
                </View>
                <View style={[bn.previewCta, { borderColor: bannerForm.text_color + '66' }]}>
                  <Text style={[bn.previewCtaText, { color: bannerForm.text_color }]}>{bannerForm.cta_text}</Text>
                </View>
              </View>

              {/* 텍스트 입력 */}
              {([
                { key: 'title',    label: '📢 제목 *',     ph: '예) 이번 주 핫딜 모음!' },
                { key: 'subtitle', label: '💬 부제목',      ph: '예) 최대 50% 할인' },
                { key: 'emoji',    label: '😀 이모지',      ph: '🎉' },
                { key: 'cta_text', label: '🔘 버튼 텍스트', ph: '자세히 보기' },
              ] as { key: keyof BannerInput; label: string; ph: string }[]).map(({ key, label, ph }) => (
                <View key={key} style={s.inputGroup}>
                  <Text style={s.inputLabel}>{label}</Text>
                  <TextInput
                    style={[s.input, { borderColor: SA.border }]}
                    value={String(bannerForm[key] ?? '')}
                    onChangeText={v => setBannerForm(f => ({ ...f, [key]: v }))}
                    placeholder={ph}
                    placeholderTextColor={SA.muted}
                  />
                </View>
              ))}

              {/* 배경색 선택 */}
              <Text style={[s.inputLabel, { marginBottom: 8 }]}>🎨 배경색</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {BANNER_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[bn.colorDot, { backgroundColor: c },
                      bannerForm.bg_color === c && { borderWidth: 3, borderColor: '#fff' }]}
                    onPress={() => setBannerForm(f => ({ ...f, bg_color: c }))}
                  />
                ))}
              </View>

              {/* 날짜 */}
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>📅 시작일 (ISO 형식)</Text>
                <TextInput
                  style={[s.input, { borderColor: SA.border }]}
                  value={bannerForm.starts_at}
                  onChangeText={v => setBannerForm(f => ({ ...f, starts_at: v }))}
                  placeholder="2025-01-01T00:00:00Z"
                  placeholderTextColor={SA.muted}
                  autoCapitalize="none"
                />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>📅 종료일 (비워두면 무기한)</Text>
                <TextInput
                  style={[s.input, { borderColor: SA.border }]}
                  value={bannerForm.ends_at ?? ''}
                  onChangeText={v => setBannerForm(f => ({ ...f, ends_at: v || null }))}
                  placeholder="2025-12-31T23:59:59Z"
                  placeholderTextColor={SA.muted}
                  autoCapitalize="none"
                />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>🔢 노출 순서 (숫자, 작을수록 먼저)</Text>
                <TextInput
                  style={[s.input, { borderColor: SA.border }]}
                  value={String(bannerForm.display_order)}
                  onChangeText={v => setBannerForm(f => ({ ...f, display_order: parseInt(v) || 0 }))}
                  keyboardType="number-pad"
                />
              </View>
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setBannerModal(false)}>
                <Text style={s.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: SA.warn }, bannerSaving && { opacity: 0.6 }]}
                onPress={handleSaveBanner}
                disabled={bannerSaving}
              >
                {bannerSaving
                  ? <ActivityIndicator color="#000" />
                  : <Text style={[s.confirmText, { color: '#000' }]}>
                      {editingBanner ? '💾 수정 완료' : '📢 등록하기'}
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 음악 트랙 등록/수정 모달 ── */}
      <Modal visible={musicModal} animationType="slide" transparent onRequestClose={() => setMusicModal(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMusicModal(false)} />
          <ScrollView style={[s.modalSheet, { maxHeight: '92%' }]} keyboardShouldPersistTaps="handled">
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{musicEditId ? '🎵 트랙 수정' : '🎵 새 트랙 등록'}</Text>

            {/* 이모지 */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>커버 이모지</Text>
              <TextInput
                style={s.input}
                value={mEmoji}
                onChangeText={setMEmoji}
                placeholder="🎵"
                placeholderTextColor={SA.muted}
                maxLength={4}
              />
            </View>

            {/* 제목 */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>제목 *</Text>
              <TextInput
                style={s.input}
                value={mTitle}
                onChangeText={setMTitle}
                placeholder="음악 제목을 입력하세요"
                placeholderTextColor={SA.muted}
              />
            </View>

            {/* 아티스트 */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>아티스트 *</Text>
              <TextInput
                style={s.input}
                value={mArtist}
                onChangeText={setMArtist}
                placeholder="아티스트명"
                placeholderTextColor={SA.muted}
              />
            </View>

            {/* 분위기 */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>분위기 태그</Text>
              <TextInput
                style={s.input}
                value={mMood}
                onChangeText={setMMood}
                placeholder="편안한, 신나는, 감성적 …"
                placeholderTextColor={SA.muted}
              />
            </View>

            {/* 업종 카테고리 */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>업종 카테고리</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['all', '카페', '음식점', '미용', '쇼핑', '헬스'] as const).map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        s.distChip,
                        mCategory === cat && s.distChipActive,
                      ]}
                      onPress={() => setMCategory(cat)}
                    >
                      <Text style={[s.distChipText, mCategory === cat && s.distChipTextActive]}>
                        {cat === 'all' ? '전체' : cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* 재생시간 */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>재생 시간 (초) *</Text>
              <TextInput
                style={s.input}
                value={mDuration}
                onChangeText={setMDuration}
                placeholder="예: 210 (3분 30초)"
                placeholderTextColor={SA.muted}
                keyboardType="number-pad"
              />
            </View>

            {/* 음악 파일 업로드 */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>음악 파일 (MP3) *</Text>
              {mAudioUrl ? (
                <View style={{ backgroundColor: SA.successLight, borderRadius: RADIUS.md, padding: 10, gap: 6 }}>
                  <Text style={{ color: SA.success, fontSize: 12, fontWeight: '700' }}>✅ 업로드 완료</Text>
                  <Text style={{ color: SA.muted, fontSize: 10 }} numberOfLines={1}>{mAudioUrl}</Text>
                  <TouchableOpacity onPress={handlePickAudioFile} disabled={mUploading}>
                    <Text style={{ color: SA.warn, fontSize: 12, fontWeight: '600' }}>🔄 파일 교체</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.geoBtn, mUploading && { opacity: 0.6 }]}
                  onPress={handlePickAudioFile}
                  disabled={mUploading}
                >
                  {mUploading
                    ? <ActivityIndicator color="#4CAF50" size="small" />
                    : <Text style={s.geoBtnText}>📂 파일 선택 & 업로드</Text>}
                </TouchableOpacity>
              )}
            </View>

            {/* 액션 버튼 */}
            <View style={[s.modalBtns, { marginTop: 8, marginBottom: 16 }]}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => { setMusicModal(false); resetMusicForm(); }}
              >
                <Text style={s.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: SA.accent, opacity: mSaving ? 0.6 : 1 }]}
                onPress={handleSaveMusicTrack}
                disabled={mSaving}
              >
                {mSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.confirmText}>{musicEditId ? '수정 완료' : '등록하기'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 승인/반려 메모 모달 ── */}
      <Modal visible={noteModal} animationType="slide" transparent onRequestClose={() => setNoteModal(false)}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setNoteModal(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>
              {noteAction === 'approve' ? '✅ 가맹점 승인' : '❌ 신청 반려'}
            </Text>
            {selectedApp && (
              <Text style={s.modalStoreName}>{selectedApp.store_name}</Text>
            )}

            {/* 승인 시 상권 선택 */}
            {noteAction === 'approve' && (
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>🗺 상권 배정 (선택)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                    <TouchableOpacity
                      style={[s.distChip, selectedDistrictId === null && s.distChipActive]}
                      onPress={() => setSelectedDistrictId(null)}
                    >
                      <Text style={[s.distChipText, selectedDistrictId === null && s.distChipTextActive]}>
                        미배정
                      </Text>
                    </TouchableOpacity>
                    {districts.map(d => (
                      <TouchableOpacity
                        key={d.id}
                        style={[s.distChip, selectedDistrictId === d.id && s.distChipActive]}
                        onPress={() => setSelectedDistrictId(d.id)}
                      >
                        <Text style={[s.distChipText, selectedDistrictId === d.id && s.distChipTextActive]}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>관리자 메모 (선택)</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder={noteAction === 'approve' ? '승인 관련 안내 메모...' : '반려 사유를 입력해주세요...'}
                placeholderTextColor="#666"
                multiline numberOfLines={3}
              />
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setNoteModal(false)}>
                <Text style={s.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.confirmBtn,
                  { backgroundColor: noteAction === 'approve' ? SA.success : SA.accent },
                  actionLoading && { opacity: 0.6 },
                ]}
                onPress={noteAction === 'approve' ? handleApprove : handleReject}
                disabled={actionLoading}
              >
                <Text style={s.confirmText}>
                  {actionLoading ? '처리 중...' :
                   noteAction === 'approve' ? '✅ 승인 확정' : '❌ 반려 확정'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 상권 등록 모달 ── */}
      <Modal visible={districtModal} animationType="slide" transparent onRequestClose={() => setDistrictModal(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setDistrictModal(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>🗺 새 상권 등록</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={[s.inputGroup, { marginBottom: 10 }]}>
                <Text style={s.inputLabel}>상권 이름 *</Text>
                <TextInput style={s.input} value={dName} onChangeText={setDName}
                  placeholder="예) 상남동, 봉곡동" placeholderTextColor="#666" />
              </View>
              <View style={[s.inputGroup, { marginBottom: 10 }]}>
                <Text style={s.inputLabel}>설명 (선택)</Text>
                <TextInput style={s.input} value={dDesc} onChangeText={setDDesc}
                  placeholder="예) 창원 상남동 먹자골목 상권" placeholderTextColor="#666" />
              </View>
              {/* 주소 자동검색 */}
              <TouchableOpacity
                style={[s.geoBtn, geoLoading && { opacity: 0.6 }]}
                onPress={handleGeocode}
                disabled={geoLoading}
              >
                <Text style={s.geoBtnText}>
                  {geoLoading ? '🔍 검색 중...' : '📍 상권명으로 좌표 자동검색'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <View style={[s.inputGroup, { flex: 1 }]}>
                  <Text style={s.inputLabel}>위도</Text>
                  <TextInput style={s.input} value={dLat} onChangeText={setDLat}
                    placeholder="35.2234" placeholderTextColor="#666" keyboardType="numeric" />
                </View>
                <View style={[s.inputGroup, { flex: 1 }]}>
                  <Text style={s.inputLabel}>경도</Text>
                  <TextInput style={s.input} value={dLng} onChangeText={setDLng}
                    placeholder="128.6816" placeholderTextColor="#666" keyboardType="numeric" />
                </View>
              </View>
              <View style={[s.modalBtns, { marginTop: 4 }]}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setDistrictModal(false)}>
                  <Text style={s.cancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: '#4CAF50' }, dSaving && { opacity: 0.6 }]}
                  onPress={handleCreateDistrict} disabled={dSaving}
                >
                  <Text style={s.confirmText}>{dSaving ? '등록 중...' : '🗺 상권 등록'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 푸시 발송 모달 ── */}
      <Modal visible={pushModal} animationType="slide" transparent onRequestClose={() => setPushModal(false)}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPushModal(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>📣 전체 사용자 푸시 발송</Text>
              <Text style={[s.modalDesc, { marginBottom: 10 }]}>앱 전체 사용자에게 즉시 발송됩니다</Text>
              <View style={[s.inputGroup, { marginBottom: 10 }]}>
                <Text style={s.inputLabel}>제목 *</Text>
                <TextInput style={s.input} value={pushTitle} onChangeText={setPushTitle}
                  placeholder="예) 🎉 언니픽 이벤트 안내" placeholderTextColor="#666" maxLength={50} />
                <Text style={s.charCount}>{pushTitle.length}/50</Text>
              </View>
              <View style={[s.inputGroup, { marginBottom: 10 }]}>
                <Text style={s.inputLabel}>내용 *</Text>
                <TextInput style={[s.input, s.inputMulti]} value={pushBody} onChangeText={setPushBody}
                  placeholder="내용을 입력해주세요" placeholderTextColor="#666"
                  multiline numberOfLines={3} maxLength={200} />
                <Text style={s.charCount}>{pushBody.length}/200</Text>
              </View>
              <View style={[s.previewBox, { marginBottom: 14 }]}>
                <Text style={s.previewLabel}>미리보기</Text>
                <View style={s.previewCard}>
                  <Text style={s.previewTitle}>{pushTitle || '제목'}</Text>
                  <Text style={s.previewBody}>{pushBody || '내용'}</Text>
                </View>
              </View>
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setPushModal(false)}>
                  <Text style={s.cancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: SA.accent }, sending && { opacity: 0.6 }]}
                  onPress={handleSendPush} disabled={sending}
                >
                  <Text style={s.confirmText}>{sending ? '발송 중...' : '📣 전체 발송'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={[scS.card, { backgroundColor: SA.card, borderColor: SA.border }]}>
      <Text style={scS.icon}>{icon}</Text>
      <Text style={[scS.value, { color }]}>{value}</Text>
      <Text style={scS.label}>{label}</Text>
    </View>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={iiS.row}>
      <Text style={iiS.label}>{label}</Text>
      <Text style={iiS.value} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function HistStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={hsS.wrap}>
      <Text style={[hsS.num, { color }]}>{value}</Text>
      <Text style={hsS.label}>{label}</Text>
    </View>
  );
}

const scS = StyleSheet.create({
  card: { flex: 1, borderRadius: RADIUS.md, padding: 10, alignItems: 'center', gap: 2, borderWidth: 1 },
  icon: { fontSize: 18 },
  value: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 10, color: SA.muted, textAlign: 'center' },
});

const iiS = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 8 },
  label: { fontSize: 12, color: SA.muted, width: 70 },
  value: { fontSize: 12, color: SA.text, flex: 1, textAlign: 'right' },
});

const hsS = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  num: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 10, color: SA.muted },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SA.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 20, paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: SA.text },
  headerSub: { fontSize: 12, color: SA.muted, marginTop: 2 },
  logoutText: { fontSize: 13, color: SA.muted, marginTop: 4 },
  mainTabRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 4,
  },
  mainTab: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: SA.card, borderWidth: 1, borderColor: SA.border,
  },
  mainTabActive: { backgroundColor: SA.accent, borderColor: SA.accent },
  mainTabText: { fontSize: 13, fontWeight: '700', color: SA.muted },
  mainTabTextActive: { color: COLORS.white },
  container: { padding: 20, gap: 14 },
  statsRow: { flexDirection: 'row', gap: 8 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: SA.card, borderWidth: 1, borderColor: SA.border,
  },
  filterBtnActivePush: { backgroundColor: SA.accentLight, borderColor: SA.accent },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: SA.muted },
  filterBtnTextActive: { color: COLORS.white },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyText: { color: SA.muted, fontSize: 14 },
  // 핫플 등록
  sectionBox: {
    borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, gap: 6,
  },
  sectionLabel: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  sectionDesc:  { lineHeight: 18 },
  badge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  badgeRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  // 신청 카드
  appCard: {
    backgroundColor: SA.card, borderRadius: RADIUS.lg, padding: 16,
    gap: 10, borderWidth: 1,
  },
  appCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '800' },
  appDate: { fontSize: 11, color: SA.muted },
  appStoreName: { fontSize: 17, fontWeight: '800', color: SA.text },
  appCategory: { fontSize: 12, color: SA.muted },
  appInfoRow: { gap: 2, borderTopWidth: 1, borderTopColor: SA.border, paddingTop: 8 },
  appBtnRow: { flexDirection: 'row', gap: 10 },
  appBtn: {
    flex: 1, paddingVertical: 10, borderRadius: RADIUS.md,
    alignItems: 'center', borderWidth: 1.5,
  },
  appBtnText: { fontSize: 13, fontWeight: '800' },
  // 읽음률 카드
  rateCard: { borderRadius: RADIUS.lg, padding: 16, gap: 6, borderWidth: 1 },
  rateLabel: { fontSize: 13, color: SA.muted },
  rateValue: { fontSize: 32, fontWeight: '800', color: SA.accent },
  rateBg: { height: 8, backgroundColor: '#0F3460', borderRadius: 4, overflow: 'hidden' },
  rateFill: { height: 8, backgroundColor: SA.accent, borderRadius: 4 },
  rateSub: { fontSize: 12, color: SA.muted },
  sendBtn: {
    backgroundColor: SA.accent, borderRadius: RADIUS.lg,
    padding: 18, alignItems: 'center', gap: 4,
  },
  sendBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  sendBtnSub: { color: COLORS.white, fontSize: 12, opacity: 0.85 },
  // 히스토리 카드
  histCard: { borderRadius: RADIUS.lg, padding: 16, gap: 10, borderWidth: 1 },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  senderBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  senderText: { fontSize: 11, fontWeight: '700' },
  histDate: { fontSize: 11, color: SA.muted },
  histTitle: { fontSize: 15, fontWeight: '700', color: SA.text },
  histBody: { fontSize: 13, color: SA.muted, lineHeight: 18 },
  histStats: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  histRateBg: { flex: 1, height: 6, backgroundColor: '#0F3460', borderRadius: 3, overflow: 'hidden' },
  histRateFill: { height: 6, backgroundColor: SA.accent, borderRadius: 3 },
  // 모달
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: SA.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 14, paddingBottom: 44, maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: SA.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: SA.text },
  modalStoreName: { fontSize: 15, fontWeight: '600', color: SA.accent },
  modalDesc: { fontSize: 13, color: SA.muted },
  inputGroup: { gap: 4 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#ccc' },
  input: {
    borderWidth: 1.5, borderColor: SA.border, borderRadius: RADIUS.md,
    padding: 12, fontSize: 14, color: SA.text, backgroundColor: '#0F3460',
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: SA.muted, textAlign: 'right' },
  previewBox: { gap: 6 },
  previewLabel: { fontSize: 12, fontWeight: '700', color: SA.muted },
  previewCard: {
    backgroundColor: '#0F3460', borderRadius: RADIUS.md, padding: 12, gap: 4,
    borderLeftWidth: 3, borderLeftColor: SA.accent,
  },
  previewTitle: { fontSize: 13, fontWeight: '800', color: SA.text },
  previewBody: { fontSize: 12, color: SA.muted, lineHeight: 18 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: '#0F3460', borderRadius: RADIUS.md, padding: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: SA.muted },
  confirmBtn: { flex: 2, borderRadius: RADIUS.md, padding: 14, alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: SA.muted, marginTop: 4 },
  cardText: { fontSize: 14, color: SA.text, lineHeight: 20 },
  actionBtn: {
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1,
  },
  // 주소 자동검색 버튼
  geoBtn: {
    backgroundColor: '#0F346088', borderRadius: RADIUS.md, padding: 12,
    alignItems: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: '#4CAF50',
  },
  geoBtnText: { fontSize: 13, fontWeight: '700', color: '#4CAF50' },
  // 상권 카드
  distCard: { borderRadius: RADIUS.lg, padding: 16, gap: 8, borderWidth: 1 },
  distHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distBadge: { backgroundColor: '#4CAF5022', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  distBadgeText: { fontSize: 11, fontWeight: '700', color: '#4CAF50' },
  distStoreCnt: { fontSize: 12, color: SA.muted },
  distName: { fontSize: 18, fontWeight: '800', color: SA.text },
  distDesc: { fontSize: 13, color: SA.muted },
  distCoord: { fontSize: 11, color: SA.border },
  // 상권 선택 칩
  distChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md,
    backgroundColor: SA.card, borderWidth: 1.5, borderColor: SA.border,
  },
  distChipActive: { backgroundColor: '#4CAF5033', borderColor: '#4CAF50' },
  distChipText: { fontSize: 13, fontWeight: '600', color: SA.muted },
  distChipTextActive: { color: '#4CAF50' },

  // ── 헤더 추가 스타일 ──
  headerRight: { alignItems: 'flex-end', gap: 8 },
  homeBtn: {
    backgroundColor: '#5B67CA', borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  homeBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  loginBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
    backgroundColor: '#4CAF5022', borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start',
  },
  loginDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  loginBadgeText: { fontSize: 10, fontWeight: '700', color: '#4CAF50' },
  couponCreateBtn: {
    backgroundColor: '#E94560', borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginBottom: 12,
  },
  couponCreateBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // 회원 필터 (filterRow/filterBtn은 위에 정의됨, 여기서는 Active 버전만)
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  // ── 공지·팝업 카드 (pre-existing missing styles) ──
  card: {
    backgroundColor: SA.card, borderRadius: RADIUS.lg,
    padding: 16, borderWidth: 1, borderColor: SA.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: SA.text },
});

// ── 배너 카드 전용 스타일 ─────────────────────────────────────────────
const bn = StyleSheet.create({
  preview:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderRadius: 8 },
  previewEmoji:{ fontSize: 26 },
  previewTitle:{ fontSize: 14, fontWeight: '800' },
  previewSub:  { fontSize: 11, marginTop: 2 },
  previewCta:  { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  previewCtaText: { fontSize: 11, fontWeight: '700' },
  actions:     { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtn:   { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, minWidth: 70 },
  actionText:  { fontSize: 12, fontWeight: '700' },
  colorDot:    { width: 32, height: 32, borderRadius: 16 },
});

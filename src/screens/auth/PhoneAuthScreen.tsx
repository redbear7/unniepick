/**
 * PhoneAuthScreen — AuthFlow 오케스트레이터 (6스텝)
 *
 * S1 휴대폰 번호  → supabase.auth.signInWithOtp
 * S2 SMS 인증번호 → supabase.auth.verifyOtp
 * S3 닉네임 + 생일 → profiles upsert
 * S4 위치 권한    → expo-location requestForegroundPermissionsAsync (거부 시 진행 불가)
 * S5 주변 가게 팔로우 5곳 + 약관 → follows / profiles upsert
 * S6 푸시 권한    → expo-notifications (거부해도 진행)
 *     → CustomerTabs
 *
 * API 호출은 이 파일에만 집중. 각 Step 컴포넌트는 순수 UI.
 */

import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../../lib/supabase';
import { PALETTE } from '../../constants/theme';
import { notifyAdmin, registerPushToken } from '../../lib/services/pushService';
import {
  signInWithKakao, signInWithApple,
  ensureSocialProfile, isAppleSignInAvailable,
} from '../../lib/services/socialAuthService';

import AuthHeader                        from './components/AuthHeader';
import { TermsState }                    from './components/TermsSheet';
import PhoneStep                         from './steps/PhoneStep';
import CodeStep                          from './steps/CodeStep';
import ProfileStep, { ProfileData }      from './steps/ProfileStep';
import LocationPermissionStep            from './steps/LocationPermissionStep';
import NearbyStoresStep, { NearbyStore } from './steps/NearbyStoresStep';

// ── 하버사인 거리 (meters) ─────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

type AuthStep = 1 | 2 | 3 | 4 | 5 | 6;


export default function PhoneAuthScreen() {
  const navigation = useNavigation<any>();

  const [step,    setStep]    = useState<AuthStep>(1);
  const [phone,   setPhone]   = useState('');          // '010XXXXXXXX'
  const [profile, setProfile] = useState<ProfileData>({
    nickname: '', birthMonth: '', birthDay: '', birthSkip: false,
  });
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [profileReady,  setProfileReady]  = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [appleAvail,    setAppleAvail]    = useState(false);

  // Apple 가용 여부 체크 (최초 1회)
  React.useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvail).catch(() => {});
  }, []);

  const handleAdminTap = useCallback(() => {
    navigation.navigate('SuperAdminLogin');
  }, [navigation]);

  // ── 소셜 로그인 공통 처리 ─────────────────────────────────────────
  const handleSocialLogin = useCallback(async (
    loginFn: () => Promise<any>,
  ) => {
    setSocialLoading(true);
    setError('');
    try {
      const session = await loginFn();
      if (!session) throw new Error('로그인에 실패했어요');

      const { isNew } = await ensureSocialProfile(session);

      // 신규 회원 → 닉네임/생일 프로필 설정 (S3)
      // 기존 회원 → 바로 홈으로
      if (isNew) {
        setStep(3);
      } else {
        // 기존 회원: 푸시 토큰 재등록 후 홈
        if (session.user?.id) {
          registerPushToken(session.user.id).catch(() => {});
        }
        navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
      }
    } catch (e: any) {
      if (e?.message !== 'CANCELLED') {
        setError(e?.message ?? '소셜 로그인에 실패했어요');
      }
    } finally {
      setSocialLoading(false);
    }
  }, [navigation]);

  const handleKakaoLogin = useCallback(() => handleSocialLogin(signInWithKakao),  [handleSocialLogin]);
  const handleAppleLogin = useCallback(() => handleSocialLogin(signInWithApple),  [handleSocialLogin]);

  // ── 국제 전화번호 ─────────────────────────────────────────────────
  const intlPhone = (p: string) => '+82' + p.replace(/\D/g, '').slice(1); // 010→+8210

  // ── S1 → S2: OTP 발송 ────────────────────────────────────────────
  const sendOtp = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ phone: intlPhone(phone) });
      if (e) throw e;
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? '인증번호 발송에 실패했어요');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  // ── S2 → S3: OTP 검증 ────────────────────────────────────────────
  const verifyOtp = useCallback(async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const { error: e } = await supabase.auth.verifyOtp({
        phone: intlPhone(phone),
        token: code,
        type:  'sms',
      });
      if (e) throw e;

      // 관리자에게 신규 인증 알림 (best-effort)
      notifyAdmin(
        '📱 안녕하세요!',
        '언니픽에 오신 것을 환영합니다!',
        { type: 'new_user_verified' },
      ).catch(() => {});

      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? '인증번호가 올바르지 않아요');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  // ── S2: OTP 재발송 ────────────────────────────────────────────────
  const resendOtp = useCallback(async () => {
    setError('');
    try {
      await supabase.auth.signInWithOtp({ phone: intlPhone(phone) });
    } catch (e: any) {
      setError(e?.message ?? '재발송에 실패했어요');
    }
  }, [phone]);

  // ── S3: 닉네임 중복 확인 (본인 제외) ────────────────────────────
  const checkNickname = useCallback(async (nick: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    const myId = session?.user?.id;

    let query = supabase
      .from('profiles')
      .select('id')
      .eq('nickname', nick.trim());

    if (myId) query = query.neq('id', myId); // 자기 자신 제외

    const { data } = await query.maybeSingle();
    return !data; // true = 사용 가능
  }, []);

  // ── S3 → S4: 프로필 저장 ─────────────────────────────────────────
  // DB 스키마 불일치 시에도 S4 진입은 반드시 보장
  const saveProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { nickname, birthMonth, birthDay, birthSkip } = profile;
      const trimmed = nickname.trim();

      // getSession() — 로컬 SecureStore에서 읽음 (네트워크 불필요, 안정적)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증이 필요해요');

      // user_metadata 닉네임 (실패해도 계속)
      if (trimmed) {
        try {
          await supabase.auth.updateUser({ data: { nickname: trimmed } });
        } catch { /* ignore */ }
      }

      // users 테이블 upsert — 전화번호가 메인 식별자
      // email 컬럼이 NOT NULL인 경우를 위해 synthetic fallback 제공
      try {
        await supabase.from('users').upsert(
          {
            id:       user.id,
            phone:    user.phone,              // Supabase auth 전화번호 (+82...)
            email:    user.email ?? `phone_${user.id}@unniepick.app`,
            name:     trimmed || '언니픽회원',
            nickname: trimmed || '언니픽회원',
            role:     'customer',
          },
          { onConflict: 'id' },
        );
      } catch { /* 컬럼 불일치 시 무시 */ }

      // profiles upsert — 닉네임만 (birth 컬럼 없어도 안전)
      try {
        await supabase.from('profiles').upsert(
          { id: user.id, nickname: trimmed || null },
          { onConflict: 'id' },
        );
      } catch { /* ignore */ }

      // birth 컬럼이 있는 경우 추가 저장
      if (!birthSkip && (birthMonth || birthDay)) {
        try {
          await supabase.from('profiles').upsert(
            {
              id:          user.id,
              birth_month: birthMonth ? +birthMonth : null,
              birth_day:   birthDay   ? +birthDay   : null,
            },
            { onConflict: 'id' },
          );
        } catch { /* 컬럼 없으면 무시 */ }
      }

      setStep(4); // → LocationPermissionStep
    } catch (e: any) {
      setError(e?.message ?? '프로필 저장에 실패했어요');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // ── S4 → S5: 위치 권한 완료 (LocationPermissionStep 내부에서 처리) ──
  const handleLocationDone = useCallback(() => {
    setStep(5); // → NearbyStoresStep
  }, []);

  // ── S5: 주변 가게 조회 ────────────────────────────────────────────
  const loadStores = useCallback(async (lat: number, lng: number): Promise<NearbyStore[]> => {
    const RADIUS_M = 500;
    const LIMIT    = 10;

    // PostGIS RPC 우선 시도 (반경 500m, 10개)
    if (lat !== 0 && lng !== 0) {
      try {
        const { data, error } = await supabase.rpc('nearby_stores_auth', {
          lat, lng, radius_km: RADIUS_M / 1000, limit_n: LIMIT,
        });
        if (!error && data?.length) {
          return (data as any[]).map(r => ({
            id:       String(r.id),
            name:     r.name,
            category: r.category ?? '',
            emoji:    r.emoji    ?? '🏪',
            distance: r.distance_m ?? 0,
          }));
        }
      } catch { /* fallback */ }
    }

    // Fallback: 활성 가게 전체 조회 후 클라이언트 거리 계산
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name, category, emoji, latitude, longitude')
      .eq('is_active', true)
      .limit(50);

    if (!stores?.length) return [];

    const withDist = stores.map(s => ({
      id:       String(s.id),
      name:     s.name,
      category: s.category ?? '',
      emoji:    s.emoji    ?? '🏪',
      distance: (lat && lng && s.latitude && s.longitude)
        ? haversine(lat, lng, s.latitude, s.longitude)
        : 0,
    }));

    const sorted   = withDist.sort((a, b) => a.distance - b.distance);
    const filtered = (lat && lng) ? sorted.filter(s => s.distance <= RADIUS_M) : sorted;

    // 500m 내 5개 미만이면 반경 확장 폴백
    return (filtered.length >= 5 ? filtered : sorted).slice(0, LIMIT);
  }, []);

  // ── S5 → S6: 팔로우 + 약관 저장 ─────────────────────────────────
  // DB 오류가 있어도 S6 진입은 반드시 보장
  const completeFollows = useCallback(async (followed: string[], terms: TermsState) => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증이 필요해요');

      // 팔로우 저장
      if (followed.length > 0) {
        const { error: followErr } = await supabase.from('follows').upsert(
          followed.map(storeId => ({ user_id: user.id, store_id: storeId })),
          { onConflict: 'user_id,store_id', ignoreDuplicates: true },
        );
        if (followErr) {
          console.error('[Signup] follows upsert 실패:', followErr.message, followErr.code, followErr.details);
        } else {
          console.log('[Signup] follows 저장 완료:', followed.length, '개');
        }
      }

      // 약관 동의 기록
      const { error: termsErr } = await supabase.from('profiles').upsert(
        {
          id:               user.id,
          terms_agreed:     true,
          marketing_agreed: terms.marketing,
          terms_agreed_at:  new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (termsErr) {
        console.error('[Signup] terms upsert 실패:', termsErr.message, termsErr.code);
      }

      completeSignup(); // 푸쉬 권한 단계 없이 바로 홈으로
    } catch (e: any) {
      setError(e?.message ?? '저장에 실패했어요');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── S6 → 홈 ──────────────────────────────────────────────────────
  const completeSignup = useCallback(async () => {
    // 온보딩 완료 플래그 저장 → 앱 재시작 시 PhoneAuth 재표시 방지
    await supabase.auth.updateUser({ data: { onboarded: true } }).catch(() => {});

    // 가입 완료 즉시 푸시 토큰 등록 (SplashScreen은 이미 실행 완료 상태라 다음 실행까지 대기 없음)
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    if (session?.user?.id) {
      registerPushToken(session.user.id).then(r => {
        if (!r.ok) console.warn('[Push] 등록 실패:', r.reason);
      }).catch(() => {});
    }

    navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
  }, [navigation]);

  // ── 뒤로가기 ──────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 1) return;
    setError('');
    // S5 → 뒤로: S4(위치권한)는 이미 granted 상태면 자동 skip되므로 S3로 바로 이동
    const prev = step === 5 ? 3 : (step - 1);
    setStep(prev as AuthStep);
  };

  const TOTAL = 5;

  return (
    <SafeAreaView style={s.root}>
      <AuthHeader
        step={step}
        total={TOTAL}
        onBack={handleBack}
        canBack={step > 1}
        onSecretTap={handleAdminTap}
      />

      {step === 1 && (
        <PhoneStep
          phone={phone}
          setPhone={setPhone}
          onNext={sendOtp}
          loading={loading}
          error={error}
          onKakaoLogin={handleKakaoLogin}
          onAppleLogin={handleAppleLogin}
          showApple={appleAvail}
          socialLoading={socialLoading}
        />
      )}

      {step === 2 && (
        <CodeStep
          phone={phone}
          onNext={verifyOtp}
          onResend={resendOtp}
          loading={loading}
          error={error}
        />
      )}

      {step === 3 && (
        <ProfileStep
          profile={profile}
          setProfile={setProfile}
          onCheckNick={checkNickname}
          onNext={saveProfile}
          onValidChange={setProfileReady}
          canNext={profileReady && !loading}
          loading={loading}
          error={error}
        />
      )}

      {step === 4 && (
        <LocationPermissionStep
          onNext={handleLocationDone}
        />
      )}

      {step === 5 && (
        <NearbyStoresStep
          loadStores={loadStores}
          onDone={completeFollows}
          loading={loading}
        />
      )}

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

// 헤더 오른쪽 '다음' 버튼 스타일
const hs = StyleSheet.create({
  nextBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: PALETTE.orange500,
    marginRight: 8,
  },
  nextBtnDisabled: {
    backgroundColor: PALETTE.gray200,
  },
  nextText: {
    fontSize: 15,
    fontFamily: 'WantedSans-Bold',
    color: '#FFFFFF',
  },
  nextTextDisabled: {
    color: PALETTE.gray400,
  },
});

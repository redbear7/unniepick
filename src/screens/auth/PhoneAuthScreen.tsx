/**
 * PhoneAuthScreen — AuthFlow 오케스트레이터 (4스텝)
 *
 * Step 1: 휴대폰 번호  → Supabase signInWithOtp
 * Step 2: SMS 인증번호 → Supabase verifyOtp
 * Step 3: 닉네임 + 생일 → profiles upsert
 * Step 4: 주변 가게 팔로우 + 약관 동의 → follows / profiles upsert → CustomerTabs
 *
 * API 호출은 이 파일에만 집중. 각 Step 컴포넌트는 순수 UI.
 */

import React, { useCallback, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { supabase } from '../../lib/supabase';
import { PALETTE } from '../../constants/theme';

import AuthHeader            from './components/AuthHeader';
import { TermsState }        from './components/TermsSheet';
import PhoneStep             from './steps/PhoneStep';
import CodeStep              from './steps/CodeStep';
import ProfileStep, { ProfileData } from './steps/ProfileStep';
import NearbyStoresStep, { NearbyStore } from './steps/NearbyStoresStep';

// ── 하버사인 거리 (meters) ─────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

type AuthStep = 1 | 2 | 3 | 4;

// ── 관리자 3탭 비밀 진입 ──────────────────────────────────────────
function useAdminTap(onAdmin: () => void) {
  const count = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    count.current += 1;
    if (timer.current) clearTimeout(timer.current);
    if (count.current >= 3) {
      count.current = 0;
      onAdmin();
      return;
    }
    timer.current = setTimeout(() => { count.current = 0; }, 1200);
  }, [onAdmin]);
}

export default function PhoneAuthScreen() {
  const navigation = useNavigation<any>();

  const [step,    setStep]    = useState<AuthStep>(1);
  const [phone,   setPhone]   = useState('');          // '010XXXXXXXX'
  const [profile, setProfile] = useState<ProfileData>({
    nickname: '', birthMonth: '', birthDay: '', birthSkip: false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleAdminTap = useAdminTap(() => {
    navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
  });

  // ── 국제 전화번호 ─────────────────────────────────────────────────
  const intlPhone = (p: string) => '+82' + p.replace(/\D/g, '').slice(1); // 010→+8210

  // ── Step 1 → Step 2: OTP 발송 ────────────────────────────────────
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

  // ── Step 2 → Step 3: OTP 검증 ────────────────────────────────────
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
      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? '인증번호가 올바르지 않아요');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  // ── Step 2: OTP 재발송 ────────────────────────────────────────────
  const resendOtp = useCallback(async () => {
    setError('');
    try {
      await supabase.auth.signInWithOtp({ phone: intlPhone(phone) });
    } catch (e: any) {
      setError(e?.message ?? '재발송에 실패했어요');
    }
  }, [phone]);

  // ── Step 3: 닉네임 중복 확인 ──────────────────────────────────────
  const checkNickname = useCallback(async (nick: string): Promise<boolean> => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('nickname', nick.trim())
      .maybeSingle();
    return !data; // true = 사용 가능
  }, []);

  // ── Step 3 → Step 4: 프로필 저장 ─────────────────────────────────
  const saveProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { nickname, birthMonth, birthDay, birthSkip } = profile;
      const trimmed = nickname.trim();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증이 필요해요');

      // user_metadata 업데이트
      if (trimmed) {
        const { error: e } = await supabase.auth.updateUser({ data: { nickname: trimmed } });
        if (e) throw e;
      }

      // profiles upsert
      await supabase.from('profiles').upsert(
        {
          id:          user.id,
          nickname:    trimmed || null,
          birth_month: (!birthSkip && birthMonth) ? +birthMonth : null,
          birth_day:   (!birthSkip && birthDay)   ? +birthDay   : null,
        },
        { onConflict: 'id' },
      );

      setStep(4);
    } catch (e: any) {
      setError(e?.message ?? '프로필 저장에 실패했어요');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // ── Step 4: 주변 가게 조회 ────────────────────────────────────────
  const loadStores = useCallback(async (lat: number, lng: number): Promise<NearbyStore[]> => {
    // PostGIS RPC 우선 시도
    if (lat !== 0 && lng !== 0) {
      try {
        const { data, error } = await supabase.rpc('nearby_stores_auth', {
          lat, lng, radius_km: 3, limit_n: 20,
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

    // Fallback: 전체 활성 가게 클라이언트 거리 계산
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name, category, emoji, latitude, longitude')
      .eq('is_active', true)
      .limit(20);

    if (!stores) return [];

    return stores
      .map(s => ({
        id:       String(s.id),
        name:     s.name,
        category: s.category ?? '',
        emoji:    s.emoji    ?? '🏪',
        distance: (lat && lng)
          ? haversine(lat, lng, s.latitude, s.longitude)
          : 0,
      }))
      .sort((a, b) => a.distance - b.distance);
  }, []);

  // ── Step 4 → 홈: 팔로우 + 약관 저장 ─────────────────────────────
  const completeSignup = useCallback(async (followed: string[], terms: TermsState) => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증이 필요해요');

      // 팔로우 저장
      if (followed.length > 0) {
        await supabase.from('follows').upsert(
          followed.map(storeId => ({ user_id: user.id, store_id: storeId })),
          { onConflict: 'user_id,store_id', ignoreDuplicates: true },
        );
      }

      // 약관 동의 기록
      await supabase.from('profiles').upsert(
        {
          id:              user.id,
          terms_agreed:    true,
          marketing_agreed: terms.marketing,
          terms_agreed_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

      navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
    } catch (e: any) {
      setError(e?.message ?? '저장에 실패했어요');
      setLoading(false);
    }
  }, [navigation]);

  // ── 뒤로가기 ──────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 1) return;       // Step 1은 뒤로 없음 (Splash 거쳐 옴)
    setError('');
    setStep((step - 1) as AuthStep);
  };

  const TOTAL = 4;

  return (
    <SafeAreaView style={s.root}>
      <AuthHeader
        step={step}
        total={TOTAL}
        onBack={step === 1 ? handleAdminTap : handleBack}
        canBack={step > 1}
      />

      {step === 1 && (
        <PhoneStep
          phone={phone}
          setPhone={setPhone}
          onNext={sendOtp}
          loading={loading}
          error={error}
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
          loading={loading}
          error={error}
        />
      )}

      {step === 4 && (
        <NearbyStoresStep
          loadStores={loadStores}
          onDone={completeSignup}
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

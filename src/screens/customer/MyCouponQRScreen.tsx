import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, StatusBar,
  ScrollView, TouchableOpacity, Alert, Animated, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { getCouponKindConfig, CouponKind } from '../../lib/services/couponService';
// expo-screen-capture: 네이티브 빌드(EAS) 시 활성화
// import * as ScreenCapture from 'expo-screen-capture';

// ── 테마 ─────────────────────────────────────────────────────────
const C = {
  brand:  '#FF6F0F',
  g900:   '#191F28',
  g800:   '#333D4B',
  g700:   '#4E5968',
  g600:   '#6B7684',
  g500:   '#8B95A1',
  g400:   '#A0ABB8',
  g200:   '#E5E8EB',
  g150:   '#EAECEF',
  g100:   '#F2F4F6',
  green:  '#0AC86E',
  white:  '#FFFFFF',
};

// ── 헬퍼 ─────────────────────────────────────────────────────────
function formatCouponNumber(token: string): string {
  const raw = token.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7).toUpperCase();
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}`;
}

function splitCouponNumber(formatted: string): string {
  return formatted.split('').join(' ');
}

function formatExpiryKorean(expiresAt: string): string {
  const d    = new Date(expiresAt);
  const year = d.getFullYear();
  const mon  = d.getMonth() + 1;
  const day  = d.getDate();
  const hour = d.getHours();
  const ampm = hour < 12 ? '오전' : '오후';
  const h12  = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${year}년 ${mon}월 ${day}일 ${ampm} ${h12}시 만료`;
}

/** 현재 날짜·시간 → "2026년 4월 16일 (수) 오후 3:24:07" */
function formatNow(d: Date): string {
  const DAYS   = ['일', '월', '화', '수', '목', '금', '토'];
  const year   = d.getFullYear();
  const mon    = d.getMonth() + 1;
  const day    = d.getDate();
  const dow    = DAYS[d.getDay()];
  const hour   = d.getHours();
  const min    = String(d.getMinutes()).padStart(2, '0');
  const sec    = String(d.getSeconds()).padStart(2, '0');
  const ampm   = hour < 12 ? '오전' : '오후';
  const h12    = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${year}년 ${mon}월 ${day}일 (${dow}) ${ampm} ${h12}:${min}:${sec}`;
}

// ── 사용 완료 오버레이 ────────────────────────────────────────────
function UsedOverlay({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, ov.wrap, { opacity }]}>
      <Animated.View style={[ov.box, { transform: [{ scale }] }]}>
        <Text style={ov.check}>✓</Text>
        <Text style={ov.title}>사용 완료!</Text>
        <Text style={ov.sub}>쿠폰이 정상적으로 사용되었습니다</Text>
      </Animated.View>
    </Animated.View>
  );
}
const ov = StyleSheet.create({
  wrap:  { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,200,110,0.94)' },
  box:   { alignItems: 'center', gap: 12 },
  check: { fontSize: 72, color: C.white, fontWeight: '900' },
  title: { fontSize: 28, fontWeight: '900', color: C.white },
  sub:   { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
});

// ── 메인 화면 ─────────────────────────────────────────────────────
export default function MyCouponQRScreen() {
  const route      = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userCouponId } = route.params as { userCouponId: string };

  const [loading,    setLoading]    = useState(true);
  const [couponData, setCouponData] = useState<any | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [using,      setUsing]      = useState(false);
  const [usedDone,   setUsedDone]   = useState(false);
  const [nowStr,     setNowStr]     = useState(formatNow(new Date()));

  // ── 1초마다 시간 업데이트 ─────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setNowStr(formatNow(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── 화면 포커스 시 캡처 방지 ON / 이탈 시 OFF ─────────────────
  // 캡처 방지: EAS 빌드 시 expo-screen-capture 활성화
  // useFocusEffect(React.useCallback(() => {
  //   ScreenCapture.preventScreenCaptureAsync();
  //   return () => { ScreenCapture.allowScreenCaptureAsync(); };
  // }, []));

  useEffect(() => { fetchData(); }, [userCouponId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('user_coupons')
        .select(`*, coupon:coupons(*, store:stores(id, name, category))`)
        .eq('id', userCouponId)
        .single();
      if (err) throw err;

      if (data.status === 'used') {
        Alert.alert('이미 사용된 쿠폰', '이 쿠폰은 이미 사용 완료되었습니다.');
        navigation.goBack();
        return;
      }
      setCouponData(data);
    } catch (e: any) {
      setError(e.message ?? '쿠폰 정보를 불러올 수 없어요');
    } finally {
      setLoading(false);
    }
  };

  // ── 쿠폰 사용 처리 ───────────────────────────────────────────────
  const handleUse = () => {
    if (using || usedDone) return;

    Alert.alert(
      '쿠폰 사용',
      '직원에게 번호를 확인받은 후 탭해주세요.\n사용하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '사용 완료',
          style: 'destructive',
          onPress: async () => {
            setUsing(true);
            try {
              const { error: err } = await supabase
                .from('user_coupons')
                .update({ status: 'used', used_at: new Date().toISOString() })
                .eq('id', userCouponId);
              if (err) throw err;

              setUsedDone(true);
              setTimeout(() => navigation.goBack(), 1800);
            } catch (e: any) {
              Alert.alert('오류', e.message ?? '사용 처리에 실패했어요. 다시 시도해주세요.');
            } finally {
              setUsing(false);
            }
          },
        },
      ]
    );
  };

  // ── 로딩 / 에러 ──────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.g900} />
        <ActivityIndicator style={{ flex: 1 }} color={C.brand} size="large" />
      </SafeAreaView>
    );
  }

  if (error || !couponData) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor={C.g900} />
        <View style={s.errorWrap}>
          <Text style={s.errorText}>{error ?? '쿠폰을 찾을 수 없어요'}</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const coupon    = couponData.coupon;
  const store     = coupon?.store;
  const kind      = (coupon?.coupon_kind ?? 'regular') as CouponKind;
  const kindCfg   = getCouponKindConfig(kind);
  const qrToken   = couponData.qr_token ?? '';
  const couponNum = formatCouponNumber(qrToken);
  const expiryStr = coupon?.expires_at ? formatExpiryKorean(coupon.expires_at) : '';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.g900} />

      {/* 뒤로가기 */}
      <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={s.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 가게명 */}
        <Text style={s.storeName}>{store?.name?.toUpperCase() ?? ''}</Text>

        {/* 타이틀 */}
        <Text style={s.headline}>{'이 화면을\n직원에게 보여주세요'}</Text>

        {/* 현재 날짜·시간 — 2중 사용 방지 */}
        <View style={s.nowBox}>
          <Text style={s.nowLabel}>🕐 현재 시각</Text>
          <Text style={s.nowText}>{nowStr}</Text>
          <Text style={s.nowHint}>이 시각 이후 중복 사용 불가</Text>
        </View>

        {/* 쿠폰 박스 — 탭하면 사용 완료 */}
        <TouchableOpacity
          style={s.couponBox}
          onPress={handleUse}
          activeOpacity={0.92}
          disabled={using || usedDone}
        >
          <Text style={s.kindEmoji}>{kindCfg.emoji}</Text>
          <Text style={s.couponTitle}>{coupon?.title ?? ''}</Text>
          {coupon?.description ? (
            <Text style={s.couponDesc}>{coupon.description}</Text>
          ) : null}

          <View style={s.numberBox}>
            <Text style={s.numberText}>{splitCouponNumber(couponNum)}</Text>
          </View>

          <Text style={s.numberHint}>직원이 번호를 확인합니다</Text>

          <View style={s.tapHint}>
            {using
              ? <ActivityIndicator size="small" color={C.brand} />
              : <Text style={s.tapHintText}>탭하면 사용 완료 처리</Text>
            }
          </View>
        </TouchableOpacity>

        {/* 만료일 */}
        <Text style={s.expiryText}>⏰ {expiryStr}</Text>

        {/* 안내 */}
        <View style={s.infoBox}>
          <Text style={s.infoText}>
            {'사용 후 자동으로 처리됩니다\n같은 쿠폰은 1회만 사용 가능합니다\n화면 캡처는 방지됩니다'}
          </Text>
        </View>
      </ScrollView>

      {/* 사용 완료 오버레이 */}
      <UsedOverlay visible={usedDone} />
    </SafeAreaView>
  );
}

// ── 스타일 ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.g900 },

  closeBtn: {
    position: 'absolute', top: 54, right: 20, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: C.white, fontWeight: '700' },

  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
    gap: 18,
  },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  errorText: { fontSize: 15, color: C.g500, textAlign: 'center' },
  backBtn: { backgroundColor: C.brand, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  backBtnText: { fontSize: 14, fontWeight: '700', color: C.white },

  storeName: {
    fontSize: 12, fontWeight: '700', color: C.g500,
    letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase',
  },
  headline: {
    fontSize: 20, fontWeight: '900', color: C.white,
    textAlign: 'center', lineHeight: 30,
  },

  // 현재 시각 박스
  nowBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nowLabel: { fontSize: 10, fontWeight: '700', color: C.g500, letterSpacing: 0.5 },
  nowText: {
    fontSize: 16, fontWeight: '900', color: C.white,
    letterSpacing: -0.3, textAlign: 'center',
  },
  nowHint: { fontSize: 10, color: C.g500, marginTop: 2 },

  couponBox: {
    backgroundColor: C.white, borderRadius: 20,
    paddingVertical: 28, paddingHorizontal: 24,
    width: '100%', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  kindEmoji:   { fontSize: 36, marginBottom: 2 },
  couponTitle: { fontSize: 18, fontWeight: '900', color: C.g900, textAlign: 'center' },
  couponDesc:  { fontSize: 12, color: C.g600, textAlign: 'center', lineHeight: 18 },

  numberBox: {
    backgroundColor: C.g100, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 20, marginTop: 4,
  },
  numberText: {
    fontSize: 22, fontWeight: '900', color: C.g900,
    letterSpacing: 4, textAlign: 'center',
  },
  numberHint: { fontSize: 11, color: C.g500, textAlign: 'center', marginTop: 2 },

  tapHint: {
    marginTop: 8, paddingVertical: 7, paddingHorizontal: 20,
    backgroundColor: 'rgba(255,111,15,0.08)', borderRadius: 20,
  },
  tapHintText: { fontSize: 11, fontWeight: '700', color: C.brand },

  expiryText: { fontSize: 11, color: C.g600, textAlign: 'center' },

  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 20, width: '100%',
  },
  infoText: { fontSize: 12, color: C.g400, textAlign: 'center', lineHeight: 20 },
});

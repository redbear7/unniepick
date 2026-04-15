import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getSession } from '../../lib/services/authService';

interface StoreStamp {
  storeId:     string;
  storeName:   string;
  category:    string | null;
  stampCount:  number;
  stampGoal:   number;
  stampReward: string | null;
}

async function fetchMyStamps(userId: string): Promise<StoreStamp[]> {
  const { data, error } = await supabase
    .from('store_checkins')
    .select('store_id, store:stores(id, name, category, stamp_goal, stamp_reward)')
    .eq('user_id', userId);

  if (error) throw error;

  const map = new Map<string, StoreStamp>();
  for (const row of data ?? []) {
    const s = row.store as any;
    if (!s) continue;
    const id = row.store_id;
    if (!map.has(id)) {
      map.set(id, {
        storeId:     s.id,
        storeName:   s.name ?? '가게',
        category:    s.category ?? null,
        stampCount:  0,
        stampGoal:   s.stamp_goal ?? 10,
        stampReward: s.stamp_reward ?? null,
      });
    }
    map.get(id)!.stampCount++;
  }

  return [...map.values()].sort((a, b) => b.stampCount - a.stampCount);
}

// ── 가게 스탬프 카드 ─────────────────────────────────────────────────────────
function StoreStampCard({ item, onCheckin }: { item: StoreStamp; onCheckin: () => void }) {
  const pct = Math.min(item.stampCount / item.stampGoal, 1);
  const isComplete = item.stampCount >= item.stampGoal;
  const remaining  = item.stampGoal - item.stampCount;

  return (
    <View style={[sc.card, SHADOW.card]}>
      {/* 가게 헤더 */}
      <View style={sc.header}>
        <View>
          <Text style={sc.storeName}>{item.storeName}</Text>
          {item.category && <Text style={sc.category}>{item.category}</Text>}
        </View>
        <View style={[sc.badge, isComplete && sc.badgeComplete]}>
          <Text style={[sc.badgeText, isComplete && sc.badgeTextComplete]}>
            {isComplete ? '🎁 완성!' : `${item.stampCount} / ${item.stampGoal}`}
          </Text>
        </View>
      </View>

      {/* 프로그레스 바 */}
      <View style={sc.progressBg}>
        <View style={[sc.progressFill, { width: `${Math.round(pct * 100)}%` as any },
          isComplete && sc.progressComplete]} />
      </View>

      {/* 스탬프 그리드 */}
      <View style={sc.grid}>
        {Array.from({ length: item.stampGoal }).map((_, i) => (
          <View key={i} style={[sc.stamp, i < item.stampCount && sc.stampFilled]}>
            {i < item.stampCount
              ? <Text style={sc.stampEmoji}>🍀</Text>
              : <Text style={sc.stampNum}>{i + 1}</Text>}
          </View>
        ))}
      </View>

      {/* 리워드 */}
      {item.stampReward && (
        <View style={[sc.rewardBox, isComplete && sc.rewardBoxComplete]}>
          <Text style={sc.rewardIcon}>🎁</Text>
          <Text style={sc.rewardText}>{item.stampReward}</Text>
        </View>
      )}

      {/* 안내 */}
      <Text style={sc.hint}>
        {isComplete
          ? '🎉 리워드 조건 달성! 가게에 문의하세요.'
          : `📍 가게 방문 QR 스캔 시 스탬프 적립 · ${remaining}개 남음`}
      </Text>
    </View>
  );
}

// ── 메인 화면 ────────────────────────────────────────────────────────────────
export default function StampCardScreen() {
  const navigation = useNavigation<any>();
  const isFocused  = useIsFocused();
  const [stamps,    setStamps]    = useState<StoreStamp[]>([]);
  const [userId,    setUserId]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (isFocused && userId) load(userId);
  }, [isFocused]);

  const init = async () => {
    const session = await getSession();
    const uid = session?.user.id ?? null;
    setUserId(uid);
    if (uid) await load(uid);
    setLoading(false);
  };

  const load = async (uid: string) => {
    try {
      const list = await fetchMyStamps(uid);
      setStamps(list);
    } catch (e) {
      console.error('스탬프 로드 오류:', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (userId) await load(userId);
    setRefreshing(false);
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.homeBtn}
          onPress={() => navigation.navigate('CustomerTabs', { screen: 'Home' })}
        >
          <Text style={s.homeBtnText}>🏠 홈</Text>
        </TouchableOpacity>
        <Text style={s.title}>🍀 스탬프 카드</Text>
        <TouchableOpacity
          style={s.scanBtn}
          onPress={() => navigation.navigate('StoreCheckin')}
        >
          <Text style={s.scanBtnText}>📷 QR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* 요약 */}
        <View style={[s.summaryCard, SHADOW.card]}>
          <View style={s.summaryItem}>
            <Text style={s.summaryNum}>{stamps.length}</Text>
            <Text style={s.summaryLabel}>방문 가게</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryNum}>{stamps.reduce((a, b) => a + b.stampCount, 0)}</Text>
            <Text style={s.summaryLabel}>총 스탬프</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryNum}>{stamps.filter(x => x.stampCount >= x.stampGoal).length}</Text>
            <Text style={s.summaryLabel}>완성 카드</Text>
          </View>
        </View>

        {/* 안내 배너 */}
        <View style={s.guideBanner}>
          <Text style={s.guideBannerText}>
            📍 가게 QR 스캔 → 스탬프 적립 · 당일 1회 · 영수증 인증과 중복 불가
          </Text>
        </View>

        {/* 가게별 카드 */}
        {stamps.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🍀</Text>
            <Text style={s.emptyTitle}>아직 방문한 가게가 없어요</Text>
            <Text style={s.emptyDesc}>가게에 방문해 QR 스캔으로 스탬프를 모아보세요!</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => navigation.navigate('StoreCheckin')}
            >
              <Text style={s.emptyBtnText}>📷 QR 스캔 시작</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {stamps.map(item => (
              <StoreStampCard
                key={item.storeId}
                item={item}
                onCheckin={() => navigation.navigate('StoreCheckin')}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 스타일 ───────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  card:          { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, gap: 10 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storeName:     { fontSize: 16, fontWeight: '800', color: COLORS.text },
  category:      { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  badge:         { backgroundColor: COLORS.primary + '18', borderRadius: 20,
                   paddingHorizontal: 12, paddingVertical: 4,
                   borderWidth: 1, borderColor: COLORS.primary + '40' },
  badgeText:     { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  badgeComplete: { backgroundColor: '#FFF3CD', borderColor: '#F0C040' },
  badgeTextComplete: { color: '#B8860B' },

  progressBg:      { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progressFill:    { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  progressComplete:{ backgroundColor: '#F0C040' },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stamp:     { width: 44, height: 44, borderRadius: 22,
               backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
               borderWidth: 1.5, borderColor: COLORS.border },
  stampFilled:{ backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  stampEmoji: { fontSize: 20 },
  stampNum:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '700' },

  rewardBox:      { flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: '#FFF9E6', borderRadius: RADIUS.sm,
                    padding: 10, borderWidth: 1, borderColor: '#FFD700' },
  rewardBoxComplete: { backgroundColor: '#FFFBEB', borderColor: '#F0C040' },
  rewardIcon: { fontSize: 16 },
  rewardText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#7A5C00' },

  hint:  { fontSize: 11, color: COLORS.textMuted },
});

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.background },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title:     { fontSize: 18, fontWeight: '800', color: COLORS.text },
  homeBtn:   { backgroundColor: COLORS.white, borderRadius: RADIUS.sm,
               paddingHorizontal: 12, paddingVertical: 7,
               borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card },
  homeBtnText:{ fontSize: 13, fontWeight: '700', color: COLORS.text },
  scanBtn:   { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
               paddingHorizontal: 12, paddingVertical: 7 },
  scanBtnText:{ fontSize: 13, fontWeight: '700', color: '#fff' },

  container: { padding: 16, paddingBottom: 40, gap: 12 },

  summaryCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
                 padding: 20, flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNum:  { fontSize: 26, fontWeight: '900', color: COLORS.primary },
  summaryLabel:{ fontSize: 11, color: COLORS.textMuted },
  summaryDivider: { width: 1, height: 36, backgroundColor: COLORS.border },

  guideBanner:  { backgroundColor: '#F0F7FF', borderRadius: RADIUS.md,
                  padding: 12, borderWidth: 1, borderColor: '#BFD7FF' },
  guideBannerText: { fontSize: 12, color: '#2563EB', fontWeight: '600', lineHeight: 18 },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  emptyDesc:  { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn:   { marginTop: 8, backgroundColor: COLORS.primary,
                borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:{ fontSize: 14, fontWeight: '700', color: '#fff' },
});

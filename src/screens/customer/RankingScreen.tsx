import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  getDistrictRanking,
  getMyStats,
  RankingEntry,
} from '../../lib/services/receiptService';
import { fetchDistricts, DistrictRow } from '../../lib/services/districtService';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function RankingScreen() {
  const navigation = useNavigation<any>();

  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | undefined>(undefined);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [myStats, setMyStats] = useState<{ totalAmount: number; receiptCount: number; couponUsedCount: number } | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    loadRanking();
  }, [selectedDistrictId]);

  const init = async () => {
    // 상권 목록 로드
    const dList = await fetchDistricts();
    setDistricts(dList.filter(d => d.is_active));

    // 현재 유저
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (uid) {
      setMyUserId(uid);
      const stats = await getMyStats(uid);
      setMyStats(stats);
    }

    await loadRanking();
    setLoading(false);
  };

  const loadRanking = async () => {
    try {
      const data = await getDistrictRanking(selectedDistrictId);
      setRanking(data);
    } catch { /* 조용히 처리 */ }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRanking();
    if (myUserId) {
      const stats = await getMyStats(myUserId);
      setMyStats(stats);
    }
    setRefreshing(false);
  }, [selectedDistrictId, myUserId]);

  const myRankEntry = myUserId
    ? ranking.find(r => r.userId === myUserId)
    : null;

  const renderRankItem = ({ item, index }: { item: RankingEntry; index: number }) => {
    const isMe = item.userId === myUserId;
    const medal = RANK_MEDALS[item.rankNo] ?? `${item.rankNo}`;

    return (
      <View style={[
        styles.rankItem,
        isMe && styles.rankItemMe,
        index === 0 && styles.rankItemFirst,
        SHADOW.card,
      ]}>
        {/* 순위 */}
        <View style={styles.rankNo}>
          <Text style={[styles.rankNoText, item.rankNo <= 3 && styles.rankNoMedal]}>
            {medal}
          </Text>
        </View>

        {/* 아바타 + 닉네임 */}
        <View style={styles.rankUser}>
          <View style={[styles.avatar, isMe && styles.avatarMe]}>
            <Text style={styles.avatarEmoji}>{item.avatarEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nickRow}>
              <Text style={[styles.nickname, isMe && styles.nicknameMe]} numberOfLines={1}>
                {item.nickname}
              </Text>
              {isMe && <View style={styles.meTag}><Text style={styles.meTagText}>나</Text></View>}
            </View>
            <Text style={styles.receiptCount}>영수증 {item.receiptCount}회 인증</Text>
          </View>
        </View>

        {/* 통계 */}
        <View style={styles.rankStats}>
          <Text style={[styles.rankAmount, isMe && styles.rankAmountMe]}>
            {(item.totalAmount / 10000).toFixed(1)}만원
          </Text>
          <View style={styles.couponBadge}>
            <Text style={styles.couponBadgeText}>🎟 {item.couponUsedCount}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingCont}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>랭킹 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏆 매출 랭킹</Text>
        <TouchableOpacity
          style={styles.receiptBtn}
          onPress={() => navigation.navigate('ReceiptScan')}
        >
          <Text style={styles.receiptBtnText}>🧾 인증</Text>
        </TouchableOpacity>
      </View>

      {/* 내 통계 카드 */}
      {myStats && (
        <View style={styles.myStatCard}>
          <View style={styles.myStatRow}>
            <View style={styles.myStatItem}>
              <Text style={styles.myStatValue}>{myStats.totalAmount.toLocaleString()}원</Text>
              <Text style={styles.myStatLabel}>총 인증 매출</Text>
            </View>
            <View style={styles.myStatDivider} />
            <View style={styles.myStatItem}>
              <Text style={styles.myStatValue}>{myStats.receiptCount}회</Text>
              <Text style={styles.myStatLabel}>영수증 인증</Text>
            </View>
            <View style={styles.myStatDivider} />
            <View style={styles.myStatItem}>
              <Text style={styles.myStatValue}>{myStats.couponUsedCount}건</Text>
              <Text style={styles.myStatLabel}>쿠폰 사용</Text>
            </View>
          </View>
          {myRankEntry && (
            <View style={styles.myRankBadge}>
              <Text style={styles.myRankBadgeText}>
                현재 {selectedDistrictId ? districts.find(d => d.id === selectedDistrictId)?.name : '전체'} 순위: {myRankEntry.rankNo}위
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 상권 필터 탭 */}
      <View style={styles.districtTabs}>
        <TouchableOpacity
          style={[styles.distTab, !selectedDistrictId && styles.distTabActive]}
          onPress={() => setSelectedDistrictId(undefined)}
        >
          <Text style={[styles.distTabText, !selectedDistrictId && styles.distTabTextActive]}>
            전체
          </Text>
        </TouchableOpacity>
        {districts.map(d => (
          <TouchableOpacity
            key={d.id}
            style={[styles.distTab, selectedDistrictId === d.id && styles.distTabActive]}
            onPress={() => setSelectedDistrictId(d.id)}
          >
            <Text style={[styles.distTabText, selectedDistrictId === d.id && styles.distTabTextActive]}>
              {d.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 랭킹 헤더 */}
      <View style={styles.rankHeader}>
        <Text style={styles.rankHeaderLeft}>순위  닉네임</Text>
        <Text style={styles.rankHeaderRight}>매출액  쿠폰</Text>
      </View>

      {/* 랭킹 리스트 */}
      {ranking.length === 0 ? (
        <View style={styles.emptyCont}>
          <Text style={styles.emptyEmoji}>🧾</Text>
          <Text style={styles.emptyText}>아직 인증된 영수증이 없어요</Text>
          <Text style={styles.emptySub}>가맹점 방문 후 영수증을 인증해보세요!</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('ReceiptScan')}
          >
            <Text style={styles.emptyBtnText}>첫 번째로 인증하기 🏆</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={ranking}
          keyExtractor={item => item.userId}
          renderItem={renderRankItem}
          contentContainerStyle={styles.listCont}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loadingCont: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { fontSize: 22, color: COLORS.text, paddingRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  receiptBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  receiptBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },

  // 내 통계
  myStatCard: {
    backgroundColor: COLORS.primary, padding: 16, gap: 10,
  },
  myStatRow: { flexDirection: 'row', alignItems: 'center' },
  myStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  myStatValue: { fontSize: 16, fontWeight: '900', color: COLORS.white },
  myStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  myStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },
  myRankBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.sm,
    padding: 6, alignItems: 'center',
  },
  myRankBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.white },

  // 상권 탭
  districtTabs: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  distTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
  },
  distTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  distTabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  distTabTextActive: { color: COLORS.white },

  // 랭킹 헤더
  rankHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  rankHeaderLeft: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  rankHeaderRight: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },

  // 랭킹 아이템
  listCont: { padding: 12, gap: 8, paddingBottom: 40 },
  rankItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  rankItemMe: {
    borderColor: COLORS.primary, borderWidth: 2,
    backgroundColor: COLORS.primaryLight,
  },
  rankItemFirst: {
    borderColor: '#FFD700', borderWidth: 2,
    backgroundColor: '#FFFEF0',
  },
  rankNo: { width: 36, alignItems: 'center' },
  rankNoText: { fontSize: 20, fontWeight: '800', color: COLORS.textMuted },
  rankNoMedal: { fontSize: 24 },
  rankUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  avatarMe: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  avatarEmoji: { fontSize: 20 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nickname: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  nicknameMe: { color: COLORS.primary },
  meTag: {
    backgroundColor: COLORS.primary, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  meTagText: { fontSize: 10, fontWeight: '800', color: COLORS.white },
  receiptCount: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  rankStats: { alignItems: 'flex-end', gap: 4 },
  rankAmount: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  rankAmountMe: { color: COLORS.primary },
  couponBadge: {
    backgroundColor: COLORS.primaryLight, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  couponBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  // 빈 상태
  emptyCont: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 8,
  },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 16,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getSession } from '../../lib/services/authService';
import {
  getOrCreateWallet, getWalletTransactions,
  txTypeLabel, Wallet, WalletTransaction,
} from '../../lib/services/walletService';

const A = {
  bg:      '#F2F2F7',
  surface: '#FFFFFF',
  fill:    '#E5E5EA',
  label:   '#1C1C1E',
  label2:  '#636366',
  label3:  '#8E8E93',
  sep:     '#C6C6C8',
  blue:    '#007AFF',
  green:   '#34C759',
  orange:  '#FF6F0F',
  red:     '#FF3B30',
};

export default function WalletScreen() {
  const navigation = useNavigation<any>();
  const [userId,   setUserId]   = useState<string | null>(null);
  const [wallet,   setWallet]   = useState<Wallet | null>(null);
  const [txList,   setTxList]   = useState<WalletTransaction[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { init(); }, []));

  const init = async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    setUserId(session.user.id);
    await load(session.user.id);
    setLoading(false);
  };

  const load = async (uid: string) => {
    const [w, txs] = await Promise.all([
      getOrCreateWallet(uid),
      getWalletTransactions(uid, 50),
    ]);
    setWallet(w);
    setTxList(txs);
  };

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await load(userId);
    setRefreshing(false);
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={A.orange} />
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loginPrompt}>
          <Text style={s.loginEmoji}>💰</Text>
          <Text style={s.loginTitle}>로그인이 필요해요</Text>
          <Text style={s.loginDesc}>언니코인을 적립하고 사용하려면{'\n'}로그인해주세요</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={s.loginBtnText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>‹ 뒤로</Text>
        </TouchableOpacity>
        <Text style={s.title}>💰 언니코인 지갑</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={A.orange} />}
      >
        {/* ── 잔액 카드 ── */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>현재 잔액</Text>
          <Text style={s.balanceAmount}>
            {(wallet?.balance ?? 0).toLocaleString()}
            <Text style={s.balanceUnit}> UNNI</Text>
          </Text>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statVal}>{(wallet?.total_earned ?? 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>누적 적립</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{(wallet?.total_spent ?? 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>누적 사용</Text>
            </View>
          </View>

          {/* 체크인 버튼 */}
          <TouchableOpacity
            style={s.checkinBtn}
            onPress={() => navigation.navigate('StoreCheckin')}
            activeOpacity={0.85}
          >
            <Text style={s.checkinBtnText}>📍 가게 QR 스캔하여 적립하기</Text>
          </TouchableOpacity>
        </View>

        {/* ── 적립 방법 안내 ── */}
        <Text style={s.sectionTitle}>적립 방법</Text>
        <View style={s.guideCard}>
          {[
            { icon: '🏪', label: '가게 방문 QR 스캔', point: '+50' },
            { icon: '🎟', label: '쿠폰 사용',         point: '+30' },
            { icon: '🧾', label: '영수증 인증',        point: '+30' },
            { icon: '📅', label: '매일 출석',          point: '+5'  },
          ].map((item, index) => (
            <View key={item.label} style={[s.guideRow, index > 0 && s.guideSep]}>
              <Text style={s.guideIcon}>{item.icon}</Text>
              <Text style={s.guideLabel}>{item.label}</Text>
              <Text style={s.guidePoint}>{item.point} UNNI</Text>
            </View>
          ))}
        </View>

        {/* ── 거래 내역 ── */}
        <Text style={s.sectionTitle}>거래 내역</Text>

        {txList.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>🪙</Text>
            <Text style={s.emptyText}>아직 거래 내역이 없어요{'\n'}가게를 방문하고 코인을 모아보세요!</Text>
          </View>
        ) : (
          <View style={{ borderRadius: 13, overflow: 'hidden', backgroundColor: A.surface }}>
            {txList.map((tx, index) => {
              const isEarn = tx.amount > 0;
              const date = new Date(tx.created_at);
              const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
              const isLast = index === txList.length - 1;
              return (
                <View key={tx.id} style={[s.txCard, !isLast && s.txCardSep]}>
                  <View style={s.txLeft}>
                    <Text style={s.txType}>{txTypeLabel(tx.type)}</Text>
                    {tx.description && (
                      <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                    )}
                    <Text style={s.txDate}>{dateStr}</Text>
                  </View>
                  <View style={s.txRight}>
                    <Text style={[s.txAmount, { color: isEarn ? A.green : A.red }]}>
                      {isEarn ? '+' : ''}{tx.amount.toLocaleString()}
                    </Text>
                    <Text style={s.txBalance}>잔액 {tx.balance_after.toLocaleString()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: A.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: A.sep,
    backgroundColor: A.surface,
  },
  backText: { fontSize: 17, color: A.blue, fontWeight: '400' },
  title:    { fontSize: 17, fontWeight: '600', color: A.label },
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13, color: A.label3, textTransform: 'uppercase',
    letterSpacing: 0.4, fontWeight: '400', marginBottom: -4,
  },
  // Apple Wallet card
  balanceCard: { backgroundColor: A.orange, borderRadius: 20, padding: 28, gap: 4, alignItems: 'center' },
  balanceLabel:  { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500', letterSpacing: 0.2 },
  balanceAmount: { fontSize: 48, fontWeight: '700', color: '#fff', letterSpacing: -2 },
  balanceUnit:   { fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
  statsRow:    { flexDirection: 'row', marginTop: 12, alignSelf: 'stretch' },
  statItem:    { flex: 1, alignItems: 'center', gap: 3 },
  statVal:     { fontSize: 16, fontWeight: '600', color: '#fff' },
  statLabel:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '400' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.4)', height: 40, alignSelf: 'center' },
  checkinBtn: {
    marginTop: 12, backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24,
    alignSelf: 'stretch', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  checkinBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  // Guide card (iOS table)
  guideCard: { backgroundColor: A.surface, borderRadius: 13, overflow: 'hidden' },
  guideRow:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
  },
  guideSep:  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: A.sep },
  guideIcon:  { fontSize: 20, width: 28, textAlign: 'center' },
  guideLabel: { flex: 1, fontSize: 15, color: A.label, fontWeight: '400' },
  guidePoint: { fontSize: 15, fontWeight: '600', color: A.green },
  // TX list
  txCard: {
    backgroundColor: A.surface,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  txCardSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: A.sep },
  txLeft:   { flex: 1, gap: 2 },
  txType:   { fontSize: 15, fontWeight: '500', color: A.label },
  txDesc:   { fontSize: 13, color: A.label3 },
  txDate:   { fontSize: 12, color: A.label3 },
  txRight:  { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontSize: 17, fontWeight: '600' },
  txBalance:{ fontSize: 12, color: A.label3 },
  // Empty
  emptyBox:   { alignItems: 'center', paddingTop: 48, gap: 14 },
  emptyEmoji: { fontSize: 52 },
  emptyText:  { fontSize: 15, color: A.label3, textAlign: 'center', lineHeight: 22 },
  // Login prompt
  loginPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  loginEmoji:  { fontSize: 60 },
  loginTitle:  { fontSize: 22, fontWeight: '700', color: A.label, letterSpacing: -0.3 },
  loginDesc:   { fontSize: 15, color: A.label3, textAlign: 'center', lineHeight: 22 },
  loginBtn:    { backgroundColor: A.orange, borderRadius: 14, paddingHorizontal: 36, paddingVertical: 15 },
  loginBtnText:{ color: '#fff', fontSize: 17, fontWeight: '600' },
});

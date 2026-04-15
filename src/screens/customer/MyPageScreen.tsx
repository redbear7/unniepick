import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal,
  TouchableOpacity, ScrollView, Switch, Alert,
  TextInput, ActivityIndicator, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  getNotificationOptIn,
  setNotificationOptIn,
  requestNotificationPermission,
} from '../../lib/notifications';
import {
  getCurrentUserProfile,
  updateProfile,
  signOut,
} from '../../lib/services/naverAuthService';
import { getMyStats } from '../../lib/services/receiptService';
import { supabase } from '../../lib/supabase';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';

// ── 동물 캐릭터 5종 ──────────────────────────────────────────────────────────
const CHARACTERS = [
  { emoji: '🐻', name: '곰돌이' },
  { emoji: '🐱', name: '고양이' },
  { emoji: '🐶', name: '강아지' },
  { emoji: '🐰', name: '토끼' },
  { emoji: '🦊', name: '여우' },
];

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

// ── 프로필 편집 모달 ─────────────────────────────────────────────────────────
function ProfileEditModal({
  visible,
  currentNickname,
  currentEmoji,
  onSave,
  onClose,
}: {
  visible: boolean;
  currentNickname: string;
  currentEmoji: string;
  onSave: (nickname: string, emoji: string) => Promise<void>;
  onClose: () => void;
}) {
  const [nickname, setNickname] = useState(currentNickname);
  const [emoji,    setEmoji]    = useState(currentEmoji);
  const [saving,   setSaving]   = useState(false);

  // 모달 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (visible) {
      setNickname(currentNickname);
      setEmoji(currentEmoji);
    }
  }, [visible, currentNickname, currentEmoji]);

  const handleSave = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      Alert.alert('닉네임을 입력해주세요');
      return;
    }
    if (trimmed.length > 10) {
      Alert.alert('닉네임은 10자 이내로 입력해주세요');
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed, emoji);
      onClose();
    } catch (e: any) {
      Alert.alert('저장 실패', e.message ?? '다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* backdrop: flex 영역의 위쪽을 채워 탭하면 닫힘 */}
      <View style={{ flex: 1 }}>
        <Pressable style={[pm.backdrop, { flex: 1 }]} onPress={onClose} />

        {/* KAV가 sheet를 직접 감싸야 키보드 올라올 때 sheet가 함께 밀림 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={pm.sheet}>
            {/* 핸들 */}
            <View style={pm.handle} />

            <Text style={pm.title}>프로필 편집</Text>

            {/* 선택된 캐릭터 미리보기 */}
            <View style={pm.preview}>
              <Text style={pm.previewEmoji}>{emoji}</Text>
            </View>

            {/* 캐릭터 선택 */}
            <Text style={pm.sectionLabel}>캐릭터 선택</Text>
            <View style={pm.charRow}>
              {CHARACTERS.map((c) => (
                <TouchableOpacity
                  key={c.emoji}
                  style={[pm.charBtn, emoji === c.emoji && pm.charBtnActive]}
                  onPress={() => setEmoji(c.emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={pm.charEmoji}>{c.emoji}</Text>
                  <Text style={[pm.charName, emoji === c.emoji && pm.charNameActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 닉네임 입력 */}
            <Text style={pm.sectionLabel}>닉네임</Text>
            <TextInput
              style={pm.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="닉네임 입력 (최대 10자)"
              placeholderTextColor={A.label3}
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <Text style={pm.inputHint}>{nickname.trim().length} / 10자</Text>

            {/* 저장 버튼 */}
            <TouchableOpacity
              style={[pm.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={pm.saveBtnText}>저장하기</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── 스탬프 카드 타입 ──────────────────────────────────────────────────────────
interface StampCardRow {
  id:             string;
  store_id:       string;
  stamp_count:    number;
  required_count: number;
  store?: { id: string; name: string; emoji?: string; category?: string } | null;
}

// ── 메인 화면 ────────────────────────────────────────────────────────────────
export default function MyPageScreen() {
  const navigation = useNavigation<any>();
  const bottomPad = useMiniPlayerPadding(true);
  const [notificationOn,  setNotificationOn]  = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [user, setUser] = useState<{
    uid: string; nickname: string; avatarEmoji: string;
  } | null>(null);
  const [stats,      setStats]      = useState({ totalAmount: 0, receiptCount: 0, couponUsedCount: 0 });
  const [stampCards, setStampCards] = useState<StampCardRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      getNotificationOptIn().then(setNotificationOn);
    }, [])
  );

  const loadUser = async () => {
    const profile = await getCurrentUserProfile();
    setUser(profile);
    if (profile?.uid) {
      const s = await getMyStats(profile.uid);
      setStats(s);
      // 스탬프 카드 (가게별)
      const { data } = await supabase
        .from('stamp_cards')
        .select('id, store_id, stamp_count, required_count, store:stores(id, name, emoji, category)')
        .eq('user_id', profile.uid)
        .order('stamp_count', { ascending: false });
      setStampCards((data ?? []) as StampCardRow[]);
    }
  };

  const handleSaveProfile = async (nickname: string, emoji: string) => {
    await updateProfile(nickname, emoji);
    await loadUser(); // 화면 즉시 갱신
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('알림 권한 필요', '설정 > 언니픽 > 알림에서 권한을 허용해주세요');
        return;
      }
      Alert.alert('알림 설정 완료!', '쿠폰 · 타임세일 알림을 받을 수 있어요 🎉');
    }
    setNotificationOn(value);
    await setNotificationOptIn(value);
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃', style: 'destructive',
        onPress: async () => {
          await signOut();
          setUser(null);
          navigation.navigate('Login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>마이페이지</Text>

        {/* ── 프로필 카드 ── */}
        <Text style={styles.sectionHeader}>프로필</Text>
        {user ? (
          <View style={styles.profileCard}>
            {/* 아바타 (탭 → 편집) */}
            <TouchableOpacity
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.8}
              style={styles.avatarWrap}
            >
              <Text style={styles.avatar}>{user.avatarEmoji}</Text>
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditBadgeText}>✏️</Text>
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user.nickname}님</Text>
              <View style={styles.loginBadge}>
                <Text style={styles.loginBadgeText}>✅ 로그인 중</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditModalVisible(true)}
            >
              <Text style={styles.editBtnText}>✏️ 편집</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.loginCard}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.loginCardEmoji}>🐻</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.loginCardTitle}>로그인 / 회원가입</Text>
              <Text style={styles.loginCardSub}>쿠폰 · 스탬프 · 랭킹 이용 가능</Text>
            </View>
            <Text style={styles.loginCardArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── 요약 통계 ── */}
        <Text style={styles.sectionHeader}>활동 요약</Text>
        <View style={styles.statsCard}>
          {[
            {
              num: stats.totalAmount > 0 ? `${(stats.totalAmount / 10000).toFixed(1)}만` : '0',
              label: '인증 매출',
            },
            { num: String(stats.receiptCount),    label: '영수증' },
            { num: String(stats.couponUsedCount), label: '쿠폰 사용' },
          ].map((item, index) => (
            <View key={item.label} style={[styles.statBox, index > 0 && styles.statBorder]}>
              <Text style={styles.statNum}>{item.num}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── 홈에서 이동된 퀵 링크 ── */}
        <Text style={styles.sectionHeader}>바로가기</Text>
        <View style={styles.quickCard}>
          {[
            { emoji: '🎟', label: '쿠폰 피드',   onPress: () => navigation.navigate('CouponList') },
            { emoji: '🧾', label: '영수증 인증', onPress: () => navigation.navigate('ReceiptScan') },
            { emoji: '🏆', label: '매출 랭킹',   onPress: () => navigation.navigate('Ranking') },
            { emoji: '📍', label: '지도',         onPress: () => navigation.navigate('Map') },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.quickItem}
              onPress={item.onPress} activeOpacity={0.82}>
              <Text style={styles.quickEmoji}>{item.emoji}</Text>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 내 스탬프 (가게별) ── */}
        <Text style={styles.sectionHeader}>내 스탬프</Text>
        <View style={styles.stampSection}>
          <View style={styles.stampHeader}>
            <Text style={styles.stampHeaderTitle}>🍀 내 스탬프</Text>
            {stampCards.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('StampCard')} activeOpacity={0.7}>
                <Text style={styles.stampHeaderMore}>전체보기 →</Text>
              </TouchableOpacity>
            )}
          </View>

          {stampCards.length === 0 ? (
            <View style={styles.stampEmpty}>
              <Text style={styles.stampEmptyText}>
                가맹점 방문 후 스탬프를 모아보세요!
              </Text>
              <TouchableOpacity style={styles.stampEmptyBtn}
                onPress={() => navigation.navigate('Map')} activeOpacity={0.8}>
                <Text style={styles.stampEmptyBtnText}>📍 주변 가게 찾기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* 합산 표시 */}
              <View style={styles.stampTotalRow}>
                <Text style={styles.stampTotalText}>
                  총{' '}
                  <Text style={styles.stampTotalNum}>
                    {stampCards.reduce((sum, c) => sum + c.stamp_count, 0)}
                  </Text>
                  개 보유
                </Text>
                <Text style={styles.stampTotalSub}>{stampCards.length}개 가게</Text>
              </View>

              {/* 가게별 스탬프 */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={styles.stampScroll} contentContainerStyle={styles.stampScrollInner}>
                {stampCards.map(card => {
                  const pct = Math.min(card.stamp_count / card.required_count, 1);
                  return (
                    <TouchableOpacity key={card.id}
                      style={styles.stampStoreCard}
                      onPress={() => navigation.navigate('StoreHome', { storeId: card.store_id })}
                      activeOpacity={0.82}>
                      <Text style={styles.stampStoreEmoji}>{card.store?.emoji ?? '🏪'}</Text>
                      <Text style={styles.stampStoreName} numberOfLines={1}>{card.store?.name ?? '가게'}</Text>
                      {/* 도트 진행 */}
                      <View style={styles.stampDots}>
                        {Array.from({ length: Math.min(card.required_count, 10) }).map((_, i) => (
                          <View key={i} style={[styles.stampDot, i < card.stamp_count && styles.stampDotFilled]} />
                        ))}
                      </View>
                      <Text style={styles.stampCount}>
                        {card.stamp_count}/{card.required_count}
                      </Text>
                      {/* 진행 바 */}
                      <View style={styles.stampBar}>
                        <View style={[styles.stampBarFill, { width: `${pct * 100}%` as any }]} />
                      </View>
                      {card.stamp_count >= card.required_count && (
                        <View style={styles.stampComplete}>
                          <Text style={styles.stampCompleteText}>🎉 리워드 완성!</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>

        {/* ── 알림 설정 ── */}
        <Text style={styles.sectionHeader}>알림 설정</Text>
        <View style={styles.notifCard}>
          <Text style={styles.notifTitle}>🔔 단골 혜택 알림</Text>
          <Text style={styles.notifDesc}>쿠폰 발급 · 타임세일 · 근처 매장 알림을 받아요</Text>
          <View style={styles.notifRow}>
            <View style={styles.notifLeft}>
              <Text style={styles.notifLabel}>쿠폰 · 타임세일 알림받기</Text>
              <Text style={styles.notifSub}>
                {notificationOn ? '✅ 단골 알림 활성화됨' : '알림을 켜면 특별 혜택을 놓치지 않아요'}
              </Text>
            </View>
            <Switch
              value={notificationOn}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: A.fill, true: A.orange }}
              thumbColor="#fff"
              ios_backgroundColor={A.fill}
            />
          </View>
        </View>

        {/* ── 메뉴 리스트 ── */}
        <Text style={styles.sectionHeader}>서비스</Text>
        <View style={styles.menuCard}>
          {[
            { icon: '💰', label: '언니코인 지갑',  onPress: () => navigation.navigate('Wallet') },
            { icon: '🍀', label: '스탬프 카드',    onPress: () => navigation.navigate('StampCard'), badge: 'NEW' },
            { icon: '🎡', label: '행운 돌림판',    onPress: () => navigation.navigate('SpinWheel'), badge: 'NEW' },
            { icon: '🧾', label: '영수증 인증',   onPress: () => navigation.navigate('ReceiptScan') },
            { icon: '🏆', label: '매출 랭킹',     onPress: () => navigation.navigate('Ranking') },
            { icon: '🎟', label: '쿠폰 사용 내역',  onPress: () => navigation.navigate('CouponList') },
            { icon: '🎵', label: '음악 취향 설정',  onPress: () => navigation.navigate('MusicTaste'), badge: 'NEW' },
            { icon: '❤️', label: '관심 가게',       onPress: () => navigation.navigate('Interest') },
            { icon: '📍', label: '주변 맛집 지도',onPress: () => navigation.navigate('Map') },
          ].map((item, index, arr) => {
            const isLast = index === arr.length - 1;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, isLast && styles.menuItemLast]}
                onPress={item.onPress}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {(item as any).badge && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{(item as any).badge}</Text>
                  </View>
                )}
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── 로그아웃 ── */}
        {user && (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        )}

        {/* ── 관리자 메뉴 ── */}
        <Text style={styles.sectionHeader}>관리자</Text>
        <View style={styles.adminSection}>
          <TouchableOpacity
            style={styles.storeApplyBtn}
            onPress={() => navigation.navigate('StoreApply')}
          >
            <Text style={styles.storeApplyBtnText}>🏪 사장님 가입신청</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ownerBtn}
            onPress={() => navigation.navigate('OwnerLogin')}
          >
            <Text style={styles.ownerBtnText}>🍖 사장님 로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.superAdminBtn}
            onPress={() => navigation.navigate('SuperAdminLogin')}
          >
            <Text style={styles.superAdminBtnText}>🛡️ 시샵</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── 프로필 편집 모달 ── */}
      {user && (
        <ProfileEditModal
          visible={editModalVisible}
          currentNickname={user.nickname}
          currentEmoji={user.avatarEmoji}
          onSave={handleSaveProfile}
          onClose={() => setEditModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ── 모달 스타일 ──────────────────────────────────────────────────────────────
const pm = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: A.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 48, gap: 8,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: A.fill, alignSelf: 'center', marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '600', color: A.label, textAlign: 'center' },

  // 미리보기
  preview: {
    alignItems: 'center', justifyContent: 'center',
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: A.bg, alignSelf: 'center',
    borderWidth: 2.5, borderColor: A.orange, marginVertical: 8,
  },
  previewEmoji: { fontSize: 50 },

  sectionLabel: {
    fontSize: 13, fontWeight: '400', color: A.label3,
    marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.4,
  },

  // 캐릭터 선택
  charRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  charBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
    borderColor: A.sep, backgroundColor: A.bg, gap: 4,
  },
  charBtnActive: {
    borderColor: A.orange,
    backgroundColor: 'rgba(255,111,15,0.08)',
    borderWidth: 1.5,
  },
  charEmoji: { fontSize: 28 },
  charName:  { fontSize: 10, fontWeight: '500', color: A.label3 },
  charNameActive: { color: A.orange },

  // 닉네임 입력
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: A.sep,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 17, color: A.label, backgroundColor: A.bg, marginTop: 4,
  },
  inputHint: { fontSize: 12, color: A.label3, textAlign: 'right' },

  // 저장 버튼
  saveBtn: {
    backgroundColor: A.orange, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },
});

// ── 화면 스타일 ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: A.bg },
  container: { paddingBottom: 40 },
  title: {
    fontSize: 34, fontWeight: '700', color: A.label,
    letterSpacing: -0.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  sectionHeader: {
    fontSize: 13, fontWeight: '400', color: A.label3,
    textTransform: 'uppercase', letterSpacing: 0.4,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
  },

  // Profile
  profileCard: {
    backgroundColor: A.surface, marginHorizontal: 16, borderRadius: 13,
    padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatarWrap: { position: 'relative' },
  avatar: { fontSize: 48 },
  avatarEditBadge: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: A.orange, borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: A.bg,
  },
  avatarEditBadgeText: { fontSize: 9 },
  userName: { fontSize: 20, fontWeight: '600', color: A.label, letterSpacing: -0.3 },
  loginBadge: {
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 4,
  },
  loginBadgeText: { fontSize: 11, fontWeight: '600', color: A.green },
  editBtn: {
    backgroundColor: A.fill, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  editBtnText: { fontSize: 14, fontWeight: '500', color: A.blue },

  loginCard: {
    backgroundColor: A.surface, marginHorizontal: 16, borderRadius: 13,
    padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  loginCardEmoji: { fontSize: 44 },
  loginCardTitle: { fontSize: 17, fontWeight: '600', color: A.label },
  loginCardSub: { fontSize: 13, color: A.label3, marginTop: 2 },
  loginCardArrow: { fontSize: 20, color: A.label3 },

  // Stats - ONE card with internal hairline separators
  statsCard: {
    backgroundColor: A.surface, marginHorizontal: 16, borderRadius: 13,
    flexDirection: 'row',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 4 },
  statBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: A.sep,
  },
  statNum:   { fontSize: 22, fontWeight: '700', color: A.orange, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: A.label3 },

  // Quick links - ONE card, cells 25% each
  quickCard: {
    backgroundColor: A.surface, marginHorizontal: 16, borderRadius: 13,
    flexDirection: 'row',
  },
  quickItem: { width: '25%', paddingVertical: 18, alignItems: 'center', gap: 6 },
  quickEmoji: { fontSize: 26 },
  quickLabel: { fontSize: 11, fontWeight: '500', color: A.label, textAlign: 'center' },

  // Stamp
  stampSection: {
    backgroundColor: A.surface, marginHorizontal: 16, borderRadius: 13,
    padding: 16, gap: 10,
  },
  stampHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stampHeaderTitle: { fontSize: 15, fontWeight: '600', color: A.label },
  stampHeaderMore: { fontSize: 15, color: A.blue, fontWeight: '400' },
  stampEmpty: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  stampEmptyText: { fontSize: 14, color: A.label3, textAlign: 'center' },
  stampEmptyBtn: {
    backgroundColor: A.fill, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9,
  },
  stampEmptyBtnText: { fontSize: 14, fontWeight: '500', color: A.blue },
  stampTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stampTotalText: { fontSize: 13, color: A.label3 },
  stampTotalNum: { fontSize: 20, fontWeight: '700', color: A.orange, letterSpacing: -0.3 },
  stampTotalSub: { fontSize: 12, color: A.label3, marginLeft: 'auto' },
  stampScroll: { marginTop: 4 },
  stampScrollInner: { gap: 10, paddingRight: 4, paddingBottom: 4 },
  stampStoreCard: {
    width: 130, backgroundColor: A.bg, borderRadius: 10,
    padding: 12, gap: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: A.sep,
  },
  stampStoreEmoji: { fontSize: 24 },
  stampStoreName: { fontSize: 12, fontWeight: '600', color: A.label },
  stampDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 },
  stampDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: A.fill },
  stampDotFilled: { backgroundColor: A.orange },
  stampCount: { fontSize: 11, color: A.label3, fontWeight: '500' },
  stampBar: { height: 3, backgroundColor: A.fill, borderRadius: 2 },
  stampBarFill: { height: 3, backgroundColor: A.orange, borderRadius: 2 },
  stampComplete: {
    backgroundColor: 'rgba(255,204,0,0.15)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start',
  },
  stampCompleteText: { fontSize: 10, fontWeight: '700', color: '#CC8800' },

  // Notification
  notifCard: {
    backgroundColor: A.surface, marginHorizontal: 16, borderRadius: 13,
    paddingHorizontal: 16, paddingVertical: 14, gap: 8,
  },
  notifTitle: { fontSize: 15, fontWeight: '600', color: A.label },
  notifDesc: { fontSize: 13, color: A.label3 },
  notifRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 4,
  },
  notifLeft: { flex: 1, gap: 2, paddingRight: 16 },
  notifLabel: { fontSize: 15, fontWeight: '400', color: A.label },
  notifSub: { fontSize: 13, color: A.label3 },

  // Menu (iOS Settings list)
  menuCard: {
    backgroundColor: A.surface, marginHorizontal: 16, borderRadius: 13,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: A.sep,
    gap: 14, minHeight: 48,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon:  { fontSize: 20, width: 28, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 17, fontWeight: '400', color: A.label },
  menuArrow: { fontSize: 16, color: A.label3 },
  menuBadge: {
    backgroundColor: A.orange, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2, marginRight: 4,
  },
  menuBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Logout
  logoutBtn: {
    backgroundColor: A.surface, marginHorizontal: 16, borderRadius: 13,
    padding: 16, alignItems: 'center',
  },
  logoutText: { fontSize: 17, color: A.red, fontWeight: '400' },

  // Admin
  adminSection: { paddingHorizontal: 16, gap: 10 },
  adminSectionLabel: {
    fontSize: 13, color: A.label3, textTransform: 'uppercase',
    letterSpacing: 0.4, fontWeight: '400',
  },
  storeApplyBtn: {
    backgroundColor: A.orange, borderRadius: 14, padding: 15, alignItems: 'center',
  },
  storeApplyBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  ownerBtn: {
    backgroundColor: A.label, borderRadius: 14, padding: 15, alignItems: 'center',
  },
  ownerBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  superAdminBtn: {
    backgroundColor: '#1A1A2E', borderRadius: 14, padding: 15, alignItems: 'center',
    borderWidth: 1, borderColor: '#FF3B30',
  },
  superAdminBtnText: { fontSize: 15, color: '#FF3B30', fontWeight: '600' },
});

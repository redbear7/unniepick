/**
 * StoreFeedScreen — 가게 공지 피드 화면
 *
 * 모크업 v3 ② 공지 피드를 React Native로 구현.
 * 기존 서비스 레이어(couponService, postService, favoriteService, musicService)를 연결.
 * GlobalMiniPlayer는 전역 절대 위치로 이미 렌더되어 있으므로 패딩만 처리.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,

  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { supabase } from '../../lib/supabase';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { useMiniPlayerPadding } from '../../hooks/useMiniPlayerPadding';

// ── 서비스 ────────────────────────────────────────────────────────
import { fetchStore, StoreRow } from '../../lib/services/storeService';
import {
  CouponRow,
  CouponKind,
  COUPON_KIND_CONFIG,
  claimCoupon,
} from '../../lib/services/couponService';
import { StorePostRow } from '../../lib/services/postService';
import { isFavorite, toggleFavorite } from '../../lib/services/favoriteService';
import {
  StoreAnnouncement,
  fetchMyAnnouncements,
} from '../../lib/services/musicService';

// ── 빠른공지 샘플 ────────────────────────────────────────────────
const SAMPLE_NOTICES = [
  { id: 'sq1', text: '✅ 오늘 영업합니다! 잠시 후 쿠폰 발급 예정이에요 🎟' },
  { id: 'sq2', text: '⚡ 타임세일 시작! 지금 바로 쿠폰 발급받으세요!' },
  { id: 'sq3', text: '🍜 오늘 점심 특선 — 돈코츠 라멘+군만두 세트 8,900원!' },
  { id: 'sq4', text: '⏰ 영업 마감 1시간 전입니다. 서두르세요!' },
  { id: 'sq5', text: '🙏 오늘도 방문해주셔서 감사합니다!' },
];

// ── 테마 상수 ─────────────────────────────────────────────────────
const C = {
  bg: '#F0F2F5',
  card: '#FFFFFF',
  card2: '#F7F8FA',
  border: 'rgba(0,0,0,0.08)',
  divider: 'rgba(0,0,0,0.06)',
  text: '#191F28',
  text2: '#4E5968',
  text3: '#8B95A1',
  brand: '#FF6F0F',      // 오렌지 포인트
  yellow: '#FEE500',
  timesale: '#FF6B6B',   // 타임세일 레드
  green: '#0AC86E',
};

// ── 라우트 타입 ────────────────────────────────────────────────────
type StoreFeedParams = {
  StoreFeed: {
    storeId: string;
    storeName: string;
    storeEmoji?: string;
  };
};

// ── 카운트다운 훅 ──────────────────────────────────────────────────
function useCountdown(expiresAt: string): string {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      if (diff === 0) { setRemaining('마감'); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setRemaining(
        h > 0
          ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

// ── 타임세일 쿠폰 카운트다운 서브컴포넌트 ─────────────────────────
function TimerBadge({ expiresAt }: { expiresAt: string }) {
  const t = useCountdown(expiresAt);
  return (
    <View style={styles.timerBadge}>
      <Text style={styles.timerLabel}>마감까지</Text>
      <Text style={styles.timerVal}>{t}</Text>
    </View>
  );
}

// ── 쿠폰 카드 ────────────────────────────────────────────────────
interface CouponCardProps {
  coupon: CouponRow;
  userId: string | null;
  onClaim: (id: string) => void;
  claiming: boolean;
  expired?: boolean;
}

function CouponCard({ coupon, userId, onClaim, claiming, expired }: CouponCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(coupon.pick_count ?? 0);
  const isTimesale = coupon.coupon_kind === 'timesale';
  const cfg = COUPON_KIND_CONFIG[coupon.coupon_kind as CouponKind] ?? COUPON_KIND_CONFIG.regular;

  const pct = coupon.total_quantity
    ? Math.round((coupon.issued_count / coupon.total_quantity) * 100)
    : 0;

  const discountLabel =
    coupon.discount_type === 'percent'
      ? `${coupon.discount_value}% 할인`
      : `${coupon.discount_value.toLocaleString()}원 할인`;

  const toggleLike = () => {
    setLiked(p => !p);
    setLikeCount(p => (liked ? p - 1 : p + 1));
  };

  return (
    <View style={[
      styles.couponCard,
      isTimesale && styles.couponTimesale,
      expired && styles.couponExpired,
    ]}>
      {/* 마감 배지 */}
      {expired && (
        <View style={styles.expiredBadge}>
          <Text style={styles.expiredBadgeText}>마감</Text>
        </View>
      )}

      {/* 상단 정보 */}
      <View style={styles.cpTop}>
        <Text style={styles.cpEmoji}>{cfg.emoji}</Text>
        <View style={styles.cpInfo}>
          {isTimesale && (
            <View style={styles.tsTag}>
              <Text style={styles.tsTagText}>⚡ TIMESALE</Text>
            </View>
          )}
          <Text style={[
            styles.cpVal,
            isTimesale && { color: C.timesale },
          ]}>
            {discountLabel}
          </Text>
          <Text style={styles.cpDesc} numberOfLines={1}>{coupon.title}</Text>
        </View>
        {isTimesale && !expired && <TimerBadge expiresAt={coupon.expires_at} />}
      </View>

      {/* 진행 바 (수량 있을 때) */}
      {coupon.total_quantity && (
        <View style={styles.cpProgWrap}>
          <View style={styles.cpProgBar}>
            <View style={[
              styles.cpProgFill,
              isTimesale && { backgroundColor: C.timesale },
              { width: `${pct}%` as any },
            ]} />
          </View>
          <View style={styles.cpStock}>
            <Text style={styles.cpStockText}>
              남은 수량 <Text style={styles.cpStockNum}>{coupon.total_quantity - coupon.issued_count}</Text>개
            </Text>
            <Text style={styles.cpStockText}>{pct}% 발급</Text>
          </View>
        </View>
      )}

      {/* 1줄 액션바 */}
      {!expired && (
        <View style={styles.cpAbar}>
          <TouchableOpacity style={styles.cpAbarLike} onPress={toggleLike}>
            <Text style={styles.cpAbarIc}>{liked ? '❤️' : '🤍'}</Text>
            <Text style={[styles.cpAbarCnt, liked && { color: C.brand }]}>
              좋아요픽 {likeCount}
            </Text>
          </TouchableOpacity>
          <View style={styles.cpAbarDivider} />
          <TouchableOpacity
            style={styles.cpClaimBtn}
            onPress={() => onClaim(coupon.id)}
            disabled={claiming}
          >
            {claiming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.cpClaimBtnText}>🎟 쿠폰발급</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cpShareBtn}
            onPress={() => Alert.alert('', '링크가 복사됐어요 📋')}
          >
            <Text style={styles.cpShareText}>↗ 공유</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── 사장님 채팅 버블 ──────────────────────────────────────────────
function ChatBubble({ post, storeName }: { post: StorePostRow; storeName: string }) {
  const ts = new Date(post.created_at).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit',
  });
  return (
    <View style={styles.chatMsg}>
      <View style={styles.chatAv}>
        <Text style={{ fontSize: 16 }}>👑</Text>
      </View>
      <View style={styles.chatBody}>
        <View style={styles.chatName}>
          <Text style={styles.chatNameText}>{storeName}</Text>
          <View style={styles.ownerPill}><Text style={styles.ownerPillText}>사장님</Text></View>
        </View>
        <View style={styles.chatBubble}>
          <Text style={styles.chatBubbleText}>{post.content}</Text>
        </View>
        <Text style={styles.chatTs}>{ts}</Text>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
//  메인 화면
// ════════════════════════════════════════════════════════════════
export default function StoreFeedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<StoreFeedParams, 'StoreFeed'>>();
  const { storeId, storeName, storeEmoji = '🏪' } = route.params;

  const bottomPad = useMiniPlayerPadding(false);

  // ── 상태 ────────────────────────────────────────────────────
  const [store, setStore]               = useState<StoreRow | null>(null);
  const [activeCoupons, setActiveCoupons] = useState<CouponRow[]>([]);
  const [expiredCoupons, setExpiredCoupons] = useState<CouponRow[]>([]);
  const [posts, setPosts]               = useState<StorePostRow[]>([]);
  const [quickNotices, setQuickNotices] = useState<StoreAnnouncement[]>([]);
  const [pinnedText, setPinnedText]     = useState('');
  const [isFollowed, setIsFollowed]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [bizOpen, setBizOpen]           = useState(false);
  const [userId, setUserId]             = useState<string | null>(null);
  const [claimingId, setClaimingId]     = useState<string | null>(null);
  const [qnVisible, setQnVisible]       = useState(false);
  const [inputText, setInputText]       = useState('');

  // ── 데이터 로드 ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sessionData }, storeData] = await Promise.all([
        supabase.auth.getSession(),
        fetchStore(storeId),
      ]);
      const uid = sessionData.session?.user.id ?? null;
      setUserId(uid);
      setStore(storeData);

      // 쿠폰 (활성 + 만료)
      const { data: coupons } = await supabase
        .from('coupons')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      const now = new Date().toISOString();
      setActiveCoupons(
        (coupons ?? []).filter(c => c.is_active && c.expires_at > now) as CouponRow[]
      );
      setExpiredCoupons(
        (coupons ?? []).filter(c => !c.is_active || c.expires_at <= now) as CouponRow[]
      );

      // 가게 포스트
      const { data: postData } = await supabase
        .from('store_posts')
        .select('id, store_id, owner_id, content, linked_coupon_id, like_count, pick_count, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(20);
      setPosts((postData ?? []) as StorePostRow[]);

      // 빠른공지 (TTS 공지 목록 재활용)
      const notices = await fetchMyAnnouncements(storeId);
      setQuickNotices(notices);
      if (notices.length > 0) setPinnedText(notices[0].text);

      // 팔로우 상태
      if (uid) {
        const fav = await isFavorite(uid, storeId);
        setIsFollowed(fav);
      }
    } catch (e) {
      console.error('StoreFeedScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  // ── 쿠폰 발급 ────────────────────────────────────────────────
  const handleClaim = async (couponId: string) => {
    if (!userId) {
      Alert.alert('로그인 필요', '쿠폰을 받으려면 로그인해주세요.');
      return;
    }
    if (claimingId) return;
    setClaimingId(couponId);
    try {
      await claimCoupon(userId, couponId);
      Alert.alert('쿠폰 발급 완료!', '쿠폰함에서 확인하세요 🎟', [
        {
          text: '쿠폰함 보기',
          onPress: () => navigation.navigate('Wallet'),
        },
        { text: '계속', style: 'cancel' },
      ]);
    } catch (e: any) {
      Alert.alert('알림', e.message ?? '발급에 실패했어요');
    } finally {
      setClaimingId(null);
    }
  };

  // ── 팔로우 토글 ──────────────────────────────────────────────
  const handleFollow = async () => {
    if (!userId) {
      Alert.alert('로그인 필요', '팔로우하려면 로그인해주세요.');
      return;
    }
    try {
      const result = await toggleFavorite(userId, storeId);
      setIsFollowed(result);
    } catch (e) {
      console.error('toggleFavorite error:', e);
    }
  };

  // ── 빠른공지 선택 ─────────────────────────────────────────────
  const pickNotice = (text: string) => {
    setInputText(text);
    setQnVisible(false);
  };

  // ════════════════════════════════════════════════════════════
  //  렌더
  // ════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── 헤더 ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerAv}>
              <Text style={{ fontSize: 18 }}>{storeEmoji}</Text>
            </View>
            <View>
              <Text style={styles.headerName} numberOfLines={1}>{storeName}</Text>
              {store?.address && (
                <Text style={styles.headerAddr} numberOfLines={1}>{store.address}</Text>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.followBtn, isFollowed && styles.followBtnOn]}
              onPress={handleFollow}
            >
              <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextOn]}>
                {isFollowed ? '✓ 팔로잉' : '+ 팔로우'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 가게 정보 패널 (접기/펼치기) ───────────────────── */}
        <TouchableOpacity
          style={styles.bizToggle}
          onPress={() => setBizOpen(p => !p)}
        >
          <Text style={styles.bizToggleText}>{bizOpen ? '▴ 정보 접기' : '▾ 정보 보기'}</Text>
          {store?.name && <Text style={styles.bizToggleHint}>{store.name}</Text>}
        </TouchableOpacity>

        {bizOpen && store && (
          <View style={styles.bizPanel}>
            {store.address ? (
              <View style={styles.bizRow}>
                <Text style={styles.bizIc}>📍</Text>
                <Text style={styles.bizVal}>{store.address}</Text>
              </View>
            ) : null}
            {store.open_time && store.close_time && (
              <View style={styles.bizRow}>
                <Text style={styles.bizIc}>🕐</Text>
                <Text style={styles.bizVal}>{store.open_time} – {store.close_time}</Text>
              </View>
            )}
            {store.phone ? (
              <View style={styles.bizRow}>
                <Text style={styles.bizIc}>📞</Text>
                <Text style={styles.bizVal}>{store.phone}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── 고정 공지 바 ─────────────────────────────────── */}
        {pinnedText !== '' && (
          <View style={styles.pinnedBar}>
            <View style={styles.pinnedLbl}><Text style={styles.pinnedLblText}>공지</Text></View>
            <Text style={styles.pinnedText} numberOfLines={1}>{pinnedText}</Text>
          </View>
        )}

        {/* ── 피드 ─────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brand} size="large" />
          </View>
        ) : (
          <ScrollView
            style={styles.feed}
            contentContainerStyle={{ paddingBottom: bottomPad + 60 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 진행중 쿠폰 섹션 */}
            {activeCoupons.length > 0 && (
              <>
                <View style={styles.feedSec}>
                  <Text style={styles.feedSecDot}>●</Text>
                  <Text style={styles.feedSecText}>진행중 쿠폰</Text>
                </View>
                {activeCoupons.map(c => (
                  <CouponCard
                    key={c.id}
                    coupon={c}
                    userId={userId}
                    onClaim={handleClaim}
                    claiming={claimingId === c.id}
                  />
                ))}
              </>
            )}

            {/* 마감된 쿠폰 섹션 */}
            {expiredCoupons.length > 0 && (
              <>
                <View style={[styles.feedSec, { marginTop: 8 }]}>
                  <Text style={[styles.feedSecDot, { color: C.text3 }]}>○</Text>
                  <Text style={[styles.feedSecText, { color: C.text3 }]}>마감된 쿠폰</Text>
                </View>
                {expiredCoupons.map(c => (
                  <CouponCard
                    key={c.id}
                    coupon={c}
                    userId={userId}
                    onClaim={handleClaim}
                    claiming={false}
                    expired
                  />
                ))}
              </>
            )}

            {/* 쿠폰도 포스트도 없을 때 */}
            {activeCoupons.length === 0 && posts.length === 0 && expiredCoupons.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>아직 등록된 소식이 없어요</Text>
              </View>
            )}

            {/* 사장님 포스트 (채팅 버블) */}
            {posts.length > 0 && (
              <View style={styles.postsWrap}>
                {posts.map(p => (
                  <ChatBubble key={p.id} post={p} storeName={storeName} />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* ── 입력창 + 등록 버튼 ───────────────────────────── */}
        <View style={styles.inputBar}>
          {/* 입력창 클릭 → 빠른공지 모달 */}
          <TouchableOpacity
            style={styles.inputField}
            onPress={() => setQnVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13, color: C.text3 }}>
              사장님만 공지를 올릴 수 있어요
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.qnBtn}
            onPress={() => setQnVisible(true)}
          >
            <Text style={styles.qnBtnText}>등록</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── 빠른공지 바텀 시트 (Modal · 배경 흐림 없음) ──────── */}
      <Modal
        visible={qnVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQnVisible(false)}
      >
        {/* 배경 투명 — 흐리게 효과 없음 */}
        <View style={styles.qnOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setQnVisible(false)}
          />
          <View style={styles.qnSheet}>
            <View style={styles.qnHandle} />
            <View style={styles.qnHeader}>
              <Text style={styles.qnTitle}>⚡ 자주 쓰는 공지</Text>
              <TouchableOpacity onPress={() => setQnVisible(false)}>
                <Text style={styles.qnClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={quickNotices.length > 0 ? quickNotices : SAMPLE_NOTICES}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => (
                <View style={styles.qnItem}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => { pickNotice(item.text); setQnVisible(false); }}
                  >
                    <Text style={styles.qnItemText}>{item.text}</Text>
                  </TouchableOpacity>
                  <View style={styles.qnItemActs}>
                    <TouchableOpacity style={styles.qnIe}>
                      <Text style={styles.qnIeText}>✏️ 수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.qnId}>
                      <Text style={styles.qnIdText}>🗑 삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.qnDivider} />}
              ListFooterComponent={() => (
                <TouchableOpacity style={styles.qnAddRow}>
                  <Text style={styles.qnAddText}>➕ 새 공지 추가</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
//  스타일
// ════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── 헤더 ──────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: C.text2 },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAv: {
    width: 36, height: 36,
    borderRadius: 11,
    backgroundColor: '#F2F4F6',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
    flexShrink: 0,
  },
  headerName: {
    fontSize: 15, fontWeight: '800', color: C.text,
  },
  headerAddr: {
    fontSize: 11, color: C.text2, marginTop: 1,
  },
  headerRight: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  followBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: C.brand,
    borderWidth: 0,
  },
  followBtnOn: {
    backgroundColor: '#F2F4F6',
    borderWidth: 1, borderColor: C.border,
  },
  followBtnText: {
    fontSize: 11, fontWeight: '800', color: '#fff',
  },
  followBtnTextOn: {
    color: C.text3,
  },

  // ── 가게 정보 패널 ─────────────────────────────────────────
  bizToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  bizToggleText: {
    fontSize: 11, fontWeight: '700', color: C.text3,
  },
  bizToggleHint: {
    fontSize: 11, color: C.text3,
  },
  bizPanel: {
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 14, paddingVertical: 10,
    gap: 6,
  },
  bizRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  bizIc: { fontSize: 13, width: 18, textAlign: 'center' },
  bizVal: { fontSize: 12, color: C.text2, flex: 1 },

  // ── 고정 공지 바 ───────────────────────────────────────────
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(254,229,0,0.08)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(254,229,0,0.15)',
    gap: 8,
  },
  pinnedLbl: {
    backgroundColor: '#FEE500',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 20,
  },
  pinnedLblText: { fontSize: 10, fontWeight: '800', color: '#1A1200' },
  pinnedText: { flex: 1, fontSize: 12, color: C.text2 },

  // ── 피드 ───────────────────────────────────────────────────
  feed: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  feedSec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingTop: 14, paddingBottom: 6,
  },
  feedSecDot: { fontSize: 8, color: C.brand },
  feedSecText: {
    fontSize: 10, fontWeight: '800', color: C.brand,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.text3 },

  // ── 쿠폰 카드 ──────────────────────────────────────────────
  couponCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(254,229,0,0.25)',
    ...SHADOW.card,
  },
  couponTimesale: {
    borderColor: 'rgba(255,107,107,0.35)',
  },
  couponExpired: {
    opacity: 0.5,
  },
  expiredBadge: {
    position: 'absolute',
    top: 10, right: 10,
    backgroundColor: 'rgba(100,100,100,0.6)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
    zIndex: 1,
  },
  expiredBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  cpTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13, paddingTop: 10, paddingBottom: 6,
  },
  cpEmoji: { fontSize: 22 },
  cpInfo: { flex: 1 },
  tsTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)',
    borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 1,
    marginBottom: 3,
  },
  tsTagText: { fontSize: 9, fontWeight: '800', color: '#FF6B6B' },
  cpVal: {
    fontSize: 18, fontWeight: '900', color: '#FFD93D',
    letterSpacing: -0.5, lineHeight: 22,
  },
  cpDesc: { fontSize: 10, color: C.text2, marginTop: 1 },

  timerBadge: { alignItems: 'flex-end', gap: 1, flexShrink: 0 },
  timerLabel: { fontSize: 9, color: C.text3 },
  timerVal: {
    fontSize: 14, fontWeight: '800', color: '#FF6B6B',
    fontVariant: ['tabular-nums'],
  },

  cpProgWrap: { paddingHorizontal: 13, paddingBottom: 6 },
  cpProgBar: {
    height: 3,
    backgroundColor: '#E8EAED',
    borderRadius: 2,
    overflow: 'hidden',
  },
  cpProgFill: {
    height: '100%',
    backgroundColor: '#FFD93D',
    borderRadius: 2,
  },
  cpStock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cpStockText: { fontSize: 9, color: C.text3 },
  cpStockNum: { color: '#FFD93D', fontWeight: '700' },

  cpAbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: C.divider,
  },
  cpAbarLike: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cpAbarIc: { fontSize: 14 },
  cpAbarCnt: { fontSize: 11, fontWeight: '700', color: C.text3 },
  cpAbarDivider: {
    width: 1, height: 16,
    backgroundColor: C.divider,
  },
  cpClaimBtn: {
    backgroundColor: C.brand,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 9,
    minWidth: 80,
    alignItems: 'center',
  },
  cpClaimBtnText: {
    fontSize: 12, fontWeight: '800', color: '#fff',
  },
  cpShareBtn: {
    backgroundColor: '#F2F4F6',
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8,
  },
  cpShareText: { fontSize: 11, fontWeight: '700', color: C.text2 },

  // ── 사장님 채팅 버블 ───────────────────────────────────────
  postsWrap: { paddingHorizontal: 14, gap: 12, marginTop: 4 },
  chatMsg: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  chatAv: {
    width: 32, height: 32,
    borderRadius: 11,
    backgroundColor: '#FF6F0F',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  chatBody: { flex: 1 },
  chatName: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 4,
  },
  chatNameText: { fontSize: 11, fontWeight: '700', color: C.text2 },
  ownerPill: {
    backgroundColor: '#FEE500',
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4,
  },
  ownerPillText: { fontSize: 8, fontWeight: '800', color: '#1A1200' },
  chatBubble: {
    backgroundColor: '#F2F4F6',
    borderWidth: 1, borderColor: C.border,
    borderRadius: 4, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomRightRadius: 14,
    paddingHorizontal: 12, paddingVertical: 9,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  chatBubbleText: {
    fontSize: 13, color: C.text, lineHeight: 20,
  },
  chatTs: { fontSize: 10, color: C.text3, marginTop: 3 },

  // ── 입력창 ─────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 18,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.card,
  },
  inputField: {
    flex: 1,
    backgroundColor: '#F2F4F6',
    borderWidth: 1, borderColor: C.border,
    borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 13, color: C.text,
    maxHeight: 72,
  },
  qnBtn: {
    backgroundColor: 'rgba(254,229,0,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(254,229,0,0.4)',
    borderRadius: 20,
    paddingHorizontal: 11, paddingVertical: 9,
    flexShrink: 0,
  },
  qnBtnText: { fontSize: 12, fontWeight: '800', color: '#B8A200' },

  // ── 빠른공지 바텀 시트 (Modal · 배경 흐림 없음) ───────────
  qnOverlay: {
    flex: 1,
    backgroundColor: 'transparent', // 배경 흐리게 없음
    justifyContent: 'flex-end',
  },
  qnSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingBottom: 34,
    maxHeight: '72%',
    // 그림자로 시각적 분리감
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  qnHandle: {
    width: 36, height: 4,
    backgroundColor: '#E8EAED',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  qnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  qnTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  qnClose: { fontSize: 18, color: C.text3, padding: 4 },
  qnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13,
    gap: 8,
  },
  qnItemText: {
    flex: 1, fontSize: 13, color: C.text2, lineHeight: 20,
  },
  qnItemActs: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  qnIe: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#F2F4F6',
    borderWidth: 1, borderColor: C.border,
  },
  qnIeText: { fontSize: 10, fontWeight: '700', color: C.text2 },
  qnId: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(255,59,48,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)',
  },
  qnIdText: { fontSize: 10, fontWeight: '700', color: '#FF3B30' },
  qnDivider: { height: 1, backgroundColor: C.divider, marginHorizontal: 18 },
  qnAddRow: {
    paddingHorizontal: 18, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: C.divider,
    alignItems: 'center',
    marginTop: 4,
  },
  qnAddText: { fontSize: 13, fontWeight: '700', color: C.brand },
});

// Step 4: 내 주변 가게 팔로우 (최소 5개) + 약관 동의
// 위치 권한 → Supabase 가게 조회 → 팔로우 선택 → 약관 바텀시트 → 완료
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { PALETTE, FONT_FAMILY } from '../../../constants/theme';
import TermsSheet, { TermsState } from '../components/TermsSheet';

export interface NearbyStore {
  id:       string;
  name:     string;
  category: string;
  emoji:    string;
  distance: number; // meters
}

interface Props {
  loadStores: (lat: number, lng: number) => Promise<NearbyStore[]>;
  onDone:     (followed: string[], terms: TermsState) => void;
  loading?:   boolean;
}

const MIN_FOLLOW = 5;

export default function NearbyStoresStep({ loadStores, onDone, loading }: Props) {
  const [stores,     setStores]     = useState<NearbyStore[]>([]);
  const [followed,   setFollowed]   = useState<string[]>([]);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [fetching,   setFetching]   = useState(true);
  const [locName,    setLocName]    = useState('내 위치');
  const [locDenied,  setLocDenied]  = useState(false);

  const fetchStores = useCallback(async () => {
    setFetching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocDenied(true);
        // 위치 없이 폴백: 전체 가게 조회 (lat=0,lng=0 → 서버에서 거리 무시)
        const all = await loadStores(0, 0);
        setStores(all);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;

      // 역지오코딩 — 동 이름
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const dong = place?.district || place?.subregion || place?.city || '';
        if (dong) setLocName(dong);
      } catch { /* ignore */ }

      const results = await loadStores(lat, lng);
      setStores(results);
    } catch {
      setStores([]);
    } finally {
      setFetching(false);
    }
  }, [loadStores]);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const toggleFollow = (id: string) => {
    setFollowed(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const hasMin = followed.length >= MIN_FOLLOW;

  const handleCtaPress = () => {
    if (!hasMin) return;
    setSheetOpen(true);
  };

  const handleAgree = (terms: TermsState) => {
    setSheetOpen(false);
    onDone(followed, terms);
  };

  const renderStore = ({ item: s }: { item: NearbyStore }) => {
    const isFollowed = followed.includes(s.id);
    return (
      <View style={[ns.card, isFollowed && ns.cardFollowed]}>
        <View style={[ns.avatar, isFollowed && ns.avatarFollowed]}>
          <Text style={ns.emoji}>{s.emoji || '🏪'}</Text>
        </View>
        <View style={ns.info}>
          <Text style={ns.storeName} numberOfLines={1}>{s.name}</Text>
          <Text style={ns.storeMeta}>{s.category} · {s.distance}m</Text>
        </View>
        <TouchableOpacity
          style={[ns.followBtn, isFollowed && ns.followBtnActive]}
          onPress={() => toggleFollow(s.id)}
          activeOpacity={0.8}
        >
          <Text style={[ns.followBtnText, isFollowed && ns.followBtnTextActive]}>
            {isFollowed ? '팔로잉' : '+ 팔로우'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={ns.flex}>
      {/* 헤더 */}
      <View style={ns.header}>
        <Text style={ns.title}>내 주변 가까운 가게를{'\n'}팔로우 해보세요</Text>
        <View style={ns.locRow}>
          <Text style={ns.locPin}>📍</Text>
          <Text style={ns.locName}>{locDenied ? '위치 권한 없음' : locName}</Text>
          {!locDenied && <Text style={ns.locSub}> · 가까운 순</Text>}
        </View>

        {/* 진행 바 */}
        <View style={ns.progressRow}>
          <View style={ns.progressBg}>
            <View
              style={[
                ns.progressFill,
                { width: `${Math.min(followed.length, MIN_FOLLOW) / MIN_FOLLOW * 100}%` },
                hasMin && ns.progressFillDone,
              ]}
            />
          </View>
          <Text style={[ns.progressCount, hasMin && ns.progressCountDone]}>
            {followed.length}/{MIN_FOLLOW}
          </Text>
        </View>
        <Text style={ns.progressHint}>
          {hasMin
            ? '좋아요! 더 팔로우해도 돼요'
            : `언니픽에서 둘러볼 가게를 ${MIN_FOLLOW}곳 선택해주세요`}
        </Text>
      </View>

      {/* 가게 리스트 */}
      {fetching ? (
        <View style={ns.loadingBox}>
          <ActivityIndicator color={PALETTE.orange500} />
          <Text style={ns.loadingText}>주변 가게를 불러오는 중…</Text>
        </View>
      ) : stores.length === 0 ? (
        <View style={ns.emptyBox}>
          <Text style={ns.emptyEmoji}>🏪</Text>
          <Text style={ns.emptyTitle}>주변에 등록된 가게가 없어요</Text>
          <Text style={ns.emptySub}>
            {locDenied
              ? '위치 권한을 허용하면 주변 가게를 볼 수 있어요'
              : '반경을 넓혀 다시 시도해볼게요'}
          </Text>
          <TouchableOpacity style={ns.retryBtn} onPress={fetchStores} activeOpacity={0.8}>
            <Text style={ns.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={s => s.id}
          renderItem={renderStore}
          contentContainerStyle={ns.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 하단 CTA */}
      <View style={ns.footer}>
        <TouchableOpacity
          style={[ns.btn, !hasMin && ns.btnDisabled]}
          onPress={handleCtaPress}
          disabled={!hasMin || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={ns.btnText}>
                {hasMin
                  ? `팔로우 완료 (${followed.length})`
                  : `${MIN_FOLLOW - followed.length}곳 더 선택해주세요`}
              </Text>
          }
        </TouchableOpacity>
      </View>

      {/* 약관 바텀시트 */}
      {sheetOpen && (
        <TermsSheet onAgree={handleAgree} onClose={() => setSheetOpen(false)} />
      )}
    </View>
  );
}

const ns = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.gray150,
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 24,
    fontWeight: '900',
    color: PALETTE.gray900,
    letterSpacing: -0.8,
    marginBottom: 10,
    lineHeight: 32,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  locPin: { fontSize: 14, marginRight: 4 },
  locName: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.orange500,
  },
  locSub: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: PALETTE.gray500,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  progressBg: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: PALETTE.gray150,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PALETTE.orange300,
    borderRadius: 3,
  },
  progressFillDone: { backgroundColor: PALETTE.orange500 },
  progressCount: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    fontWeight: '800',
    color: PALETTE.gray600,
    minWidth: 32,
    textAlign: 'right',
  },
  progressCountDone: { color: PALETTE.orange500 },
  progressHint: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    color: PALETTE.gray500,
    lineHeight: 18,
  },

  loadingBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: {
    fontFamily: FONT_FAMILY, fontSize: 13, color: PALETTE.gray500,
  },
  emptyBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 8,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: {
    fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: '800',
    color: PALETTE.gray800, letterSpacing: -0.3,
  },
  emptySub: {
    fontFamily: FONT_FAMILY, fontSize: 13, color: PALETTE.gray500,
    textAlign: 'center', lineHeight: 20,
  },
  retryBtn: {
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 24,
    backgroundColor: PALETTE.gray100, borderRadius: 999,
  },
  retryBtnText: {
    fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: '700',
    color: PALETTE.gray700,
  },
  listContent: { padding: 16, gap: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardFollowed: { borderColor: PALETTE.orange500 },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: PALETTE.gray100,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarFollowed: { backgroundColor: PALETTE.orange50 },
  emoji: { fontSize: 26 },
  info: { flex: 1, minWidth: 0 },
  storeName: {
    fontFamily: FONT_FAMILY,
    fontSize: 15, fontWeight: '800',
    color: PALETTE.gray900, marginBottom: 3,
  },
  storeMeta: {
    fontFamily: FONT_FAMILY,
    fontSize: 12, color: PALETTE.gray500,
  },
  followBtn: {
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: PALETTE.gray200,
    flexShrink: 0,
  },
  followBtnActive: {
    backgroundColor: PALETTE.orange500,
    borderColor: PALETTE.orange500,
  },
  followBtnText: {
    fontFamily: FONT_FAMILY,
    fontSize: 13, fontWeight: '800',
    color: PALETTE.gray900,
  },
  followBtnTextActive: { color: '#FFFFFF' },

  footer: {
    paddingHorizontal: 24, paddingVertical: 12,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PALETTE.gray150,
  },
  btn: {
    backgroundColor: PALETTE.orange500,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PALETTE.orange500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: PALETTE.gray200,
    shadowOpacity: 0, elevation: 0,
  },
  btnText: {
    fontFamily: FONT_FAMILY,
    fontSize: 16, fontWeight: '900',
    color: '#FFFFFF', letterSpacing: -0.3,
  },
});

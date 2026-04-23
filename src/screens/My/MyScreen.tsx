/**
 * MyScreen — 사용자 MY 탭 오케스트레이터
 *
 * Block A: ProfileHeader (아바타 · 닉네임 · 레벨 · 카운트)
 * Block B: ExpiringCouponsCard (0개 시 null)
 * Block C: MenuGroup × 3 (활동 · 혜택 · 계정)
 * Block D: AccountActions (사장님앱 · 로그아웃 · 탈퇴 · 버전)
 *
 * 엣지 케이스 7종 모두 처리 (핸드오프 Section 06)
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { PALETTE } from '../../constants/theme';
import { useMySummary }        from './hooks/useMySummary';
import { useExpiringCoupons }  from './hooks/useExpiringCoupons';

import ProfileHeader       from './sections/ProfileHeader';
import ExpiringCouponsCard from './sections/ExpiringCouponsCard';
import MenuGroup           from './sections/MenuGroup';
import AccountActions      from './sections/AccountActions';

import { MENU_GROUPS }     from './constants/menuConfig';
import type { MenuGroupData, MenuRowData } from './sections/MenuGroup';

// ── 생일 엣지 케이스 헬퍼 ─────────────────────────────────────────
function isBirthdayMonth(birthMonth: number | null): boolean {
  if (birthMonth == null) return false;
  return new Date().getMonth() + 1 === birthMonth;
}

// ── 메뉴 subtext 동적 조합 ──────────────────────────────────────
function resolveSub(
  subKey: string | undefined,
  staticSub: string | null | undefined,
  summary: ReturnType<typeof useMySummary>['summary'],
): string | null {
  if (!subKey) return staticSub ?? null;

  switch (subKey) {
    case 'wallet':
      return `보유 ${summary.walletCount} · 사용임박`;    // 사용임박은 useExpiringCoupons 로 보정 가능
    case 'following':
      return `${summary.followingCount}곳`;
    case 'stamp':
      return '모으는 중';
    case 'location':
      return summary.locationName ?? null;  // null → 오렌지 텍스트로 대체 (아래 처리)
    case 'invite':
      return summary.inviteCount > 0
        ? `초대 ${summary.inviteCount}회 · 누적 ${(summary.inviteCount * 3000).toLocaleString()}원`
        : '최대 5,000원';
    case 'birthday': {
      const isThisMonth = isBirthdayMonth(summary.birthMonth);
      if (isThisMonth) return '생일 쿠폰 받기';                    // 배지는 아래서 처리
      if (summary.birthMonth) return `${summary.birthMonth}월 생일 · 준비중`;
      return '생일 등록하면 쿠폰을 받을 수 있어요';
    }
    default:
      return staticSub ?? null;
  }
}

// ── badge 동적 조합 ────────────────────────────────────────────────
function resolveBadge(
  item: typeof MENU_GROUPS[0]['items'][0],
  summary: ReturnType<typeof useMySummary>['summary'],
  expiringCount: number,
): string | null {
  if (item.subKey === 'wallet') {
    return expiringCount > 0 ? String(expiringCount) : null;
  }
  if (item.subKey === 'invite') {
    return summary.inviteCount === 0 ? 'NEW' : null;  // 이미 초대 이력 있으면 NEW 제거
  }
  if (item.badge === 'new') return null; // 나머지 new badge는 위에서 처리
  return null;
}

// ── disabled 동적 조합 ─────────────────────────────────────────────
function resolveDisabled(
  item: typeof MENU_GROUPS[0]['items'][0],
  summary: ReturnType<typeof useMySummary>['summary'],
): boolean {
  if (item.subKey === 'birthday') {
    return !isBirthdayMonth(summary.birthMonth);  // 당월이 아니면 disabled
  }
  return item.disabled ?? false;
}

export default function MyScreen() {
  const navigation = useNavigation<any>();
  const { summary, loading, error, refetch }           = useMySummary();
  const { coupons: expiring, loading: expLoading, refetch: expRefetch } = useExpiringCoupons();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([refetch(), expRefetch()]);
    setRefreshing(false);
  }, [refetch, expRefetch]);

  // ── 메뉴 그룹 동적 조합 ────────────────────────────────────────
  const menuGroupData: MenuGroupData[] = useMemo(() => {
    return MENU_GROUPS.map(group => ({
      title: group.title,
      rows: group.items.map((item): MenuRowData => {
        const sub      = resolveSub(item.subKey, item.staticSub, summary);
        const badge    = resolveBadge(item, summary, expiring.length);
        const disabled = resolveDisabled(item, summary);

        // 위치 미설정 → sub를 오렌지 텍스트 "위치 설정 필요" 로 표현
        // (sub가 null이고 subKey='location') → sub에 특수값
        const finalSub = item.subKey === 'location' && !summary.locationName
          ? '⚠️ 위치 설정 필요'
          : sub;

        return {
          icon:       item.icon,
          label:      item.label,
          sub:        finalSub,
          badge:      badge ?? undefined,
          disabled,
          isBirthday: item.subKey === 'birthday',
          onPress:    () => handleMenuPress(item.route, item.subKey),
        };
      }),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, expiring.length, navigation]);

  // ── 라우팅 ──────────────────────────────────────────────────────
  const handleMenuPress = (route: string, subKey?: string) => {
    switch (route) {
      case 'ReceiptReview':
        navigation.navigate('ReceiptReview');
        break;
      case 'Wallet':
        navigation.navigate('Wallet');
        break;
      case 'MyEdit':
        navigation.navigate('ProfileEdit');
        break;
      case 'MyLocation':
        navigation.navigate('MyLocation');
        break;
      case 'MyNotices':
        navigation.navigate('AnnouncementBoard');
        break;
      default:
        // Phase 2 미구현 화면 — 토스트 대신 Alert
        Alert.alert('준비 중', '곧 열릴 예정이에요 😊');
        break;
    }
  };

  const handleStatPress = (key: 'wallet' | 'following' | 'used') => {
    if (key === 'wallet') navigation.navigate('Wallet');
    else Alert.alert('준비 중', '곧 열릴 예정이에요 😊');
  };

  // ── 로딩 스켈레톤 ──────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        <ActivityIndicator style={s.loader} color={PALETTE.orange500} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      {/* status bar 배경을 주황으로 채움 */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PALETTE.orange500}
          />
        }
      >
        {/* Block A: 프로필 헤더 */}
        <ProfileHeader
          summary={summary}
          onStatPress={handleStatPress}
        />

        {/* Block B: 긴급 쿠폰 (0개면 null) */}
        {!expLoading && (
          <ExpiringCouponsCard
            coupons={expiring}
            onPress={() => navigation.navigate('Wallet')}
          />
        )}

        {/* Block C: 메뉴 그룹 3종 */}
        {menuGroupData.map(group => (
          <MenuGroup key={group.title} group={group} />
        ))}

        {/* Block D: 하단 액션 */}
        <AccountActions
          walletCount={summary.walletCount}
          onLogout={() => {
            // onAuthStateChange → SIGNED_OUT → navigationRef.reset PhoneAuth
            // 별도 navigation.reset 불필요
          }}
        />

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: PALETTE.gray100 },
  scroll: { flex: 1, backgroundColor: PALETTE.gray100 },
  loader: { flex: 1, marginTop: 80, backgroundColor: PALETTE.gray100 },
});

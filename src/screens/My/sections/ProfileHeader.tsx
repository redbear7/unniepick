// ProfileHeader — 아바타 · 닉네임 · 생일(마스킹) · 전화(마스킹) · 레벨 · 통계카드
import React, { useState } from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PALETTE } from '../../../constants/theme';
import LevelProgress from './LevelProgress';
import type { MySummary } from '../hooks/useMySummary';

interface Props {
  summary:     MySummary;
  onStatPress: (key: 'wallet' | 'following' | 'used') => void;
}

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  '브론즈': { bg: 'rgba(255,255,255,0.25)', text: '#FFFFFF' },
  '실버':   { bg: 'rgba(255,255,255,0.25)', text: '#FFFFFF' },
  '골드':   { bg: 'rgba(255,255,255,0.25)', text: '#FFFFFF' },
};

// ── 전화번호 포맷 ─────────────────────────────────────────────────
function formatPhone(raw: string | null): { full: string; masked: string } | null {
  if (!raw) return null;
  // 숫자만 추출 후 국가코드(82) 제거
  const digits = raw.replace(/\D/g, '');
  let local = digits;
  if (digits.startsWith('82') && digits.length >= 11) {
    // "821012345678" → "01012345678"
    local = '0' + digits.slice(2);
  }
  if (local.length === 11) {
    const full   = `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
    const masked = `${local.slice(0, 3)}-●●●●-${local.slice(7)}`;
    return { full, masked };
  }
  if (local.length === 10) {
    const p = local.startsWith('02') ? 2 : 3;
    const full   = `${local.slice(0, p)}-${local.slice(p, p + 4)}-${local.slice(p + 4)}`;
    const masked = `${local.slice(0, p)}-●●●●-${local.slice(p + 4)}`;
    return { full, masked };
  }
  // 길이 불명확 — 뒤 4자리만 노출
  if (local.length >= 8) {
    const masked = `${local.slice(0, 3)}-●●●●-${local.slice(-4)}`;
    return { full: raw, masked };
  }
  return { full: raw, masked: raw };
}

// ── 생일 포맷 ────────────────────────────────────────────────────
function formatBirth(month: number | null, day: number | null): { full: string; masked: string } | null {
  if (!month) return null;
  const full   = day ? `${month}월 ${day}일` : `${month}월`;
  const masked = day ? `●월 ●●일` : `●월`;
  return { full, masked };
}

export default function ProfileHeader({ summary, onStatPress }: Props) {
  const insets = useSafeAreaInsets();
  const { nickname, joinedDays, level, levelProgress, pointToNext, nextLevel,
          birthMonth, birthDay, phone, walletCount, followingCount, usedCount } = summary;

  const [showBirth, setShowBirth] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const initial    = nickname?.[0] ?? '언';
  const levelColor = LEVEL_COLORS[level] ?? LEVEL_COLORS['브론즈'];
  const displayDays = Math.max(1, joinedDays);

  const birth = formatBirth(birthMonth, birthDay);
  const phoneInfo = formatPhone(phone);

  const stats = [
    { n: walletCount,    label: '보유 쿠폰', key: 'wallet'    as const },
    { n: followingCount, label: '팔로잉',    key: 'following' as const },
    { n: usedCount,      label: '사용 완료', key: 'used'      as const },
  ];

  return (
    <View>
      {/* ── 주황 헤더 영역 ── */}
      <View style={[s.headerBg, { paddingTop: insets.top + 16 }]}>

        {/* 상단: 아바타 · 이름·레벨 */}
        <View style={s.top}>
          {/* 아바타 */}
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>

          {/* 이름 + 레벨 + 부가정보 */}
          <View style={s.info}>
            {/* 닉네임 + 레벨 뱃지 */}
            <View style={s.nameRow}>
              <Text style={s.nickname} numberOfLines={1}>{nickname}</Text>
              <View style={[s.levelBadge, { backgroundColor: levelColor.bg }]}>
                <Text style={[s.levelText, { color: levelColor.text }]}>{level}</Text>
              </View>
            </View>

            {/* 가입일 */}
            <Text style={s.joinedDays}>언니픽과 함께한 지 {displayDays}일째 🌸</Text>

            {/* 생일 (마스킹) */}
            {birth ? (
              <TouchableOpacity
                style={s.maskRow}
                onPress={() => setShowBirth(v => !v)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 0, right: 12 }}
              >
                <Ionicons name="gift-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={s.maskText}>
                  {showBirth ? birth.full : birth.masked}
                </Text>
                <Ionicons
                  name={showBirth ? 'eye-off-outline' : 'eye-outline'}
                  size={13}
                  color="rgba(255,255,255,0.55)"
                />
              </TouchableOpacity>
            ) : (
              <View style={s.maskRow}>
                <Ionicons name="gift-outline" size={14} color="rgba(255,255,255,0.45)" />
                <Text style={[s.maskText, { color: 'rgba(255,255,255,0.45)' }]}>생일 미등록</Text>
              </View>
            )}

            {/* 휴대폰 (마스킹) */}
            {phoneInfo && (
              <TouchableOpacity
                style={s.maskRow}
                onPress={() => setShowPhone(v => !v)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 0, right: 12 }}
              >
                <Ionicons name="phone-portrait-outline" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={s.maskText}>
                  {showPhone ? phoneInfo.full : phoneInfo.masked}
                </Text>
                <Ionicons
                  name={showPhone ? 'eye-off-outline' : 'eye-outline'}
                  size={13}
                  color="rgba(255,255,255,0.55)"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 레벨 프로그레스바 */}
        <View style={s.progressWrap}>
          <LevelProgress
            level={level}
            levelProgress={levelProgress}
            pointToNext={pointToNext}
            nextLevel={nextLevel}
          />
        </View>
      </View>

      {/* ── 3분할 통계 카드 ── */}
      <View style={s.statsCard}>
        {stats.map((st, i) => (
          <TouchableOpacity
            key={st.key}
            style={[s.statItem, i > 0 && s.statBorder]}
            onPress={() => onStatPress(st.key)}
            activeOpacity={0.7}
          >
            <Text style={s.statNum}>{st.n}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerBg: {
    backgroundColor:   PALETTE.orange500,
    paddingHorizontal: 20,
    paddingBottom:     24,
  },

  top: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           12,
  },

  // 아바타
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth:     2,
    borderColor:     'rgba(255,255,255,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    marginTop:       2,
  },
  avatarText: {
    fontFamily:   'WantedSans-Black',
    fontSize:      27,
    fontWeight:    '900',
    color:         '#FFFFFF',
    lineHeight:    32,
    letterSpacing: -0.5,
  },

  // 이름 영역
  info:    { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nickname: {
    fontFamily:   'WantedSans-Black',
    fontSize:      19,
    fontWeight:    '900',
    color:         '#FFFFFF',
    letterSpacing: -0.4,
    flexShrink:    1,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      6,
    flexShrink:        0,
  },
  levelText: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 0.3,
  },
  joinedDays: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    13,
    fontWeight:  '500',
    color:       'rgba(255,255,255,0.8)',
    lineHeight:  17,
  },

  // 마스킹 행
  maskRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    paddingVertical: 1,
  },
  maskText: {
    fontFamily:   'WantedSans-Medium',
    fontSize:      14,
    fontWeight:    '500',
    color:         'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
    lineHeight:    18,
  },

  // 프로그레스
  progressWrap: { marginTop: 16 },

  // 통계 카드
  statsCard: {
    flexDirection:    'row',
    backgroundColor:  '#FFFFFF',
    marginHorizontal: 16,
    marginTop:        -18,
    borderRadius:     16,
    paddingVertical:  16,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 4 },
    shadowOpacity:    0.10,
    shadowRadius:     12,
    elevation:        6,
    marginBottom:     4,
  },
  statItem: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 2,
  },
  statBorder: {
    borderLeftWidth:  1,
    borderLeftColor:  PALETTE.gray150,
  },
  statNum: {
    fontFamily:   'WantedSans-Black',
    fontSize:      25,
    fontWeight:    '900',
    color:         PALETTE.gray900,
    letterSpacing: -0.5,
    lineHeight:    29,
  },
  statLabel: {
    fontFamily: 'WantedSans-Medium',
    fontSize:    12,
    fontWeight:  '500',
    color:       PALETTE.gray500,
    marginTop:   5,
    lineHeight:  15,
  },
});

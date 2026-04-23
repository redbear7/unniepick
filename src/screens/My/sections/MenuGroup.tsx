// MenuGroup — 활동·혜택·계정 공용 컴포넌트 (Block C)
// 배지: count(빨강 숫자) · new(빨강 "NEW") · null
// v2: 생일 쿠폰 disabled → CTA 스타일로 변환
import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { PALETTE } from '../../../constants/theme';

export interface MenuRowData {
  icon:         string;
  label:        string;
  sub?:         string | null;
  badge?:       string | null;   // "2" | "NEW" | null
  disabled?:    boolean;
  isBirthday?:  boolean;         // 생일 쿠폰 특별 처리용
  onPress:      () => void;
}

export interface MenuGroupData {
  title: string;
  rows:  MenuRowData[];
}

interface Props {
  group: MenuGroupData;
}

function MenuRow({ icon, label, sub, badge, disabled, isBirthday, onPress }: MenuRowData) {
  // 생일 쿠폰 미등록 상태 → CTA 스타일
  if (isBirthday && disabled) {
    return (
      <TouchableOpacity style={ms.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[ms.iconBox, { backgroundColor: '#FFF0F0' }]}>
          <Text style={ms.icon}>{icon}</Text>
        </View>
        <View style={ms.textBox}>
          <Text style={ms.label} numberOfLines={1}>{label}</Text>
          <Text style={[ms.sub, { color: PALETTE.gray400 }]} numberOfLines={1}>
            생일 등록하면 쿠폰을 받을 수 있어요
          </Text>
        </View>
        {/* 등록 CTA 버튼 */}
        <View style={ms.ctaBtn}>
          <Text style={ms.ctaBtnText}>등록하기</Text>
        </View>
        <Text style={ms.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[ms.row, disabled && ms.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {/* 아이콘 */}
      <View style={ms.iconBox}>
        <Text style={ms.icon}>{icon}</Text>
      </View>

      {/* 텍스트 */}
      <View style={ms.textBox}>
        <Text style={[ms.label, disabled && ms.labelDisabled]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={ms.sub} numberOfLines={1}>{sub}</Text>
        ) : null}
      </View>

      {/* 배지 */}
      {badge ? (
        <View style={ms.badge}>
          <Text style={ms.badgeText}>{badge}</Text>
        </View>
      ) : null}

      {/* 쉐브론 */}
      <Text style={[ms.chevron, disabled && ms.chevronDisabled]}>›</Text>
    </TouchableOpacity>
  );
}

export default function MenuGroup({ group }: Props) {
  return (
    <View style={gs.wrap}>
      {/* 섹션 라벨 */}
      <Text style={gs.title}>{group.title}</Text>

      {/* 흰 카드 */}
      <View style={gs.card}>
        {group.rows.map((row, i) => (
          <View key={row.label}>
            <MenuRow {...row} />
            {i < group.rows.length - 1 && <View style={gs.divider} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── MenuRow styles ───────────────────────────────────────────────
const ms = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  rowDisabled: { opacity: 0.5 },

  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: PALETTE.gray100,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  icon: { fontSize: 19 },

  textBox: { flex: 1, minWidth: 0 },
  label: {
    fontFamily:    'WantedSans-Bold',
    fontSize:       15,
    fontWeight:     '700',
    color:          PALETTE.gray900,
    letterSpacing:  -0.3,
    lineHeight:     19,
  },
  labelDisabled: { color: PALETTE.gray500 },
  sub: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     12,
    fontWeight:   '500',
    color:        PALETTE.gray500,
    lineHeight:   15,
    marginTop:    3,
  },

  badge: {
    backgroundColor:  PALETTE.red500,
    borderRadius:     10,
    paddingHorizontal: 7,
    paddingVertical:   4,
    flexShrink:        0,
  },
  badgeText: {
    fontFamily:    'WantedSans-ExtraBold',
    fontSize:       10,
    fontWeight:     '800',
    color:          '#FFFFFF',
    letterSpacing:  0.2,
  },

  chevron: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     20,
    fontWeight:   '300',
    color:        PALETTE.gray400,
    lineHeight:   24,
    flexShrink:   0,
  },
  chevronDisabled: { color: PALETTE.gray200 },

  // 생일 등록 CTA 버튼
  ctaBtn: {
    backgroundColor:   PALETTE.orange500,
    borderRadius:      8,
    paddingHorizontal: 10,
    paddingVertical:   5,
    flexShrink:        0,
    marginRight:       4,
  },
  ctaBtnText: {
    fontFamily:    'WantedSans-Bold',
    fontSize:       11,
    fontWeight:     '700',
    color:          '#FFFFFF',
    letterSpacing:  -0.2,
  },
});

// ── MenuGroup styles ─────────────────────────────────────────────
const gs = StyleSheet.create({
  wrap: { marginTop: 14 },
  title: {
    fontFamily:    'WantedSans-Bold',
    fontSize:       12,
    fontWeight:     '700',
    color:          PALETTE.gray500,
    letterSpacing:  0.3,
    paddingHorizontal: 20,
    paddingBottom:   8,
    paddingTop:      6,
  },
  card: {
    borderTopWidth:    1,
    borderBottomWidth: 1,
    borderColor:       PALETTE.gray150,
  },
  divider: {
    height: 1,
    backgroundColor: PALETTE.gray100,
    marginLeft: 62,  // 아이콘 너비(18+12+12+18=62) 뒤부터
  },
});

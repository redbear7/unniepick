/**
 * FilterBar — 정렬 pill 3종 + 필터 드롭다운
 *
 * 정렬: 거리순 | 인기순 | 최신순
 * 필터: 쿠폰 있는 매장만 | 영업 중
 * GPS 거부 시 거리순 비활성화 → 인기순 기본
 */
import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { F } from '../../constants/typography';
import { PALETTE } from '../../constants/theme';

export type SortKey = 'distance' | 'popular' | 'newest';
export type PriceMax = null | 6000 | 8000 | 12000 | 20000;

export interface FilterState {
  couponOnly: boolean;
  openOnly:   boolean;
  priceMax:   PriceMax;    // null = 전체
}

// 가격 칩 목록
const PRICE_CHIPS: { label: string; value: PriceMax }[] = [
  { label: '전체',       value: null  },
  { label: '~6,000원',  value: 6000  },
  { label: '~8,000원',  value: 8000  },
  { label: '~12,000원', value: 12000 },
  { label: '~20,000원', value: 20000 },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'distance', label: '거리순' },
  { key: 'popular',  label: '인기순' },
  { key: 'newest',   label: '최신순' },
];

interface Props {
  sort:     SortKey;
  onSort:   (k: SortKey) => void;
  filter:   FilterState;
  onFilter: (f: FilterState) => void;
  gpsOk:   boolean;
}

export default function FilterBar({ sort, onSort, filter, onFilter, gpsOk }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = (filter.couponOnly ? 1 : 0) + (filter.openOnly ? 1 : 0)
                    + (filter.priceMax != null ? 1 : 0);

  return (
    <View>
      {/* ── 정렬 + 필터 버튼 행 ── */}
      <View style={s.row}>
        <View style={s.sortRow}>
          {SORTS.map(({ key, label }) => {
            const active     = sort === key;
            const disabled   = key === 'distance' && !gpsOk;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => { if (!disabled) onSort(key); }}
                activeOpacity={0.7}
                style={[
                  s.pill,
                  active   && s.pillActive,
                  disabled && s.pillDisabled,
                ]}
              >
                <Text style={[
                  s.pillText,
                  active   && s.pillTextActive,
                  disabled && s.pillTextDisabled,
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 필터 버튼 */}
        <TouchableOpacity
          onPress={() => setOpen(v => !v)}
          activeOpacity={0.7}
          style={[s.filterBtn, activeCount > 0 && s.filterBtnOn]}
        >
          <Ionicons
            name="options-outline"
            size={14}
            color={activeCount > 0 ? PALETTE.orange500 : PALETTE.gray600}
          />
          <Text style={[s.filterTxt, activeCount > 0 && s.filterTxtOn]}>필터</Text>
          {activeCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── 가격대 칩 행 ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.priceRow}
      >
        {PRICE_CHIPS.map(({ label, value }) => {
          const active = filter.priceMax === value;
          return (
            <TouchableOpacity
              key={String(value)}
              onPress={() => onFilter({ ...filter, priceMax: value })}
              activeOpacity={0.7}
              style={[s.priceChip, active && s.priceChipActive]}
            >
              {value != null && <Text style={s.priceChipIcon}>💰</Text>}
              <Text style={[s.priceChipTxt, active && s.priceChipTxtActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── 드롭다운 ── */}
      {open && (
        <View style={s.dropdown}>
          <FilterChip
            emoji="🎟"
            label="쿠폰 있는 매장만"
            active={filter.couponOnly}
            onToggle={() => onFilter({ ...filter, couponOnly: !filter.couponOnly })}
          />
          <FilterChip
            emoji="🟢"
            label="영업 중"
            active={filter.openOnly}
            onToggle={() => onFilter({ ...filter, openOnly: !filter.openOnly })}
          />
        </View>
      )}
    </View>
  );
}

function FilterChip({
  emoji, label, active, onToggle,
}: {
  emoji: string; label: string; active: boolean; onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={[s.chip, active && s.chipOn]}
    >
      <Text>{emoji}</Text>
      <Text style={[s.chipTxt, active && s.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:    8,
    gap:                8,
  },
  sortRow: {
    flex:          1,
    flexDirection: 'row',
    gap:           6,
  },

  // 정렬 pill
  pill: {
    paddingHorizontal: 12,
    paddingVertical:    6,
    borderRadius:      20,
    borderWidth:        1,
    borderColor:       PALETTE.gray200,
    backgroundColor:   '#FFFFFF',
  },
  pillActive: {
    backgroundColor: PALETTE.gray900,
    borderColor:     PALETTE.gray900,
  },
  pillDisabled: { opacity: 0.35 },
  pillText: {
    ...F.bold,
    fontSize:   12,
    color:      PALETTE.gray700,
  },
  pillTextActive:   { color: '#FFFFFF' },
  pillTextDisabled: { color: PALETTE.gray400 },

  // 필터 버튼
  filterBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:                4,
    paddingHorizontal: 10,
    paddingVertical:    6,
    borderRadius:      20,
    borderWidth:        1,
    borderColor:       PALETTE.gray200,
    backgroundColor:   '#FFFFFF',
  },
  filterBtnOn: {
    backgroundColor: PALETTE.orange50,
    borderColor:     PALETTE.orange500,
  },
  filterTxt: {
    ...F.bold,
    fontSize:   12,
    color:      PALETTE.gray700,
  },
  filterTxtOn: { color: PALETTE.orange500 },
  badge: {
    minWidth:        16,
    height:          16,
    borderRadius:     8,
    backgroundColor: PALETTE.orange500,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  badgeTxt: {
    ...F.bold,
    fontSize:   10,
    color:      '#FFFFFF',
  },

  // 가격 칩 행
  priceRow: {
    paddingHorizontal: 16,
    paddingBottom:      8,
    gap:                6,
    flexDirection:     'row',
  },
  priceChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:                4,
    paddingHorizontal: 12,
    paddingVertical:    6,
    borderRadius:      20,
    borderWidth:        1,
    borderColor:       PALETTE.gray200,
    backgroundColor:   '#FFFFFF',
  },
  priceChipActive: {
    backgroundColor: '#FFF3EB',
    borderColor:     PALETTE.orange500,
  },
  priceChipIcon: { fontSize: 11 },
  priceChipTxt: {
    ...F.bold,
    fontSize:   12,
    color:      PALETTE.gray700,
  },
  priceChipTxtActive: { color: PALETTE.orange500 },

  // 드롭다운
  dropdown: {
    marginHorizontal: 16,
    marginBottom:      8,
    flexDirection:    'row',
    flexWrap:         'wrap',
    gap:               8,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:                6,
    paddingHorizontal: 12,
    paddingVertical:    8,
    borderRadius:      20,
    borderWidth:        1,
    borderColor:       PALETTE.gray200,
    backgroundColor:   '#FFFFFF',
  },
  chipOn: {
    borderColor:     PALETTE.orange500,
    backgroundColor: PALETTE.orange50,
  },
  chipTxt: {
    ...F.bold,
    fontSize:   12,
    color:      PALETTE.gray700,
  },
  chipTxtOn: { color: PALETTE.orange500 },
});

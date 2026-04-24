/**
 * CategoryGrid — 카테고리 아이콘 가로 스크롤
 * 8종: 전체🏠 카페☕ 음식🍜 미용✂️ 네일💅 편의점🏪 베이커리🥐 기타📦
 */
import React from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { F } from '../../constants/typography';
import { PALETTE } from '../../constants/theme';

export interface CategoryItem {
  key:   string;
  label: string;
  emoji: string;
}

export const CATEGORIES: CategoryItem[] = [
  { key: '전체',    label: '전체',    emoji: '🏠' },
  { key: '카페',    label: '카페',    emoji: '☕' },
  { key: '음식',    label: '음식',    emoji: '🍜' },
  { key: '미용',    label: '미용',    emoji: '✂️' },
  { key: '네일',    label: '네일',    emoji: '💅' },
  { key: '편의점',  label: '편의점',  emoji: '🏪' },
  { key: '베이커리', label: '베이커리', emoji: '🥐' },
  { key: '기타',    label: '기타',    emoji: '📦' },
];

/** 카테고리 키 → store.category 포함 여부 판단 */
export function matchCategory(storeCategory: string, key: string): boolean {
  if (key === '전체') return true;
  const c = storeCategory.toLowerCase();
  switch (key) {
    case '카페':    return c.includes('카페') || c.includes('커피');
    case '음식':    return (
      c.includes('음식') || c.includes('한식') || c.includes('분식') ||
      c.includes('치킨') || c.includes('고기') || c.includes('중식') ||
      c.includes('일식') || c.includes('양식') || c.includes('패스트푸드') ||
      c.includes('식당') || c.includes('음식점')
    );
    case '미용':    return c.includes('미용') || c.includes('헤어') || c.includes('살롱');
    case '네일':    return c.includes('네일');
    case '편의점':  return c.includes('편의점');
    case '베이커리': return c.includes('베이커리') || c.includes('빵') || c.includes('제과');
    case '기타':    return true; // 위 어디에도 안 걸리면 기타 (ExploreScreen에서 처리)
    default:       return false;
  }
}

interface Props {
  selected: string;
  onSelect: (key: string) => void;
}

export default function CategoryGrid({ selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.container}
    >
      {CATEGORIES.map(cat => {
        const active = cat.key === selected;
        return (
          <TouchableOpacity
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            style={[s.item, active && s.itemActive]}
            activeOpacity={0.7}
          >
            <View style={[s.iconWrap, active && s.iconWrapActive]}>
              <Text style={s.emoji}>{cat.emoji}</Text>
            </View>
            <Text style={[s.label, active && s.labelActive]} numberOfLines={1}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical:    6,
    gap: 2,
  },

  item: {
    alignItems:        'center',
    paddingHorizontal:  8,
    paddingVertical:    6,
    borderRadius:      20,
    minWidth:          56,
  },
  itemActive: {
    backgroundColor: PALETTE.orange50,
  },

  iconWrap: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: PALETTE.gray100,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  iconWrapActive: {
    backgroundColor: PALETTE.orange500,
    shadowColor:     PALETTE.orange500,
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.3,
    shadowRadius:    6,
    elevation:       4,
  },

  emoji: { fontSize: 18 },

  label: {
    ...F.medium,
    fontSize:   11,
    color:      PALETTE.gray600,
    lineHeight: 14,
    textAlign:  'center',
  },
  labelActive: {
    ...F.bold,
    color:      PALETTE.orange600,
  },
});

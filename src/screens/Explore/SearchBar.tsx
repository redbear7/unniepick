/**
 * SearchBar — 검색 입력 + 지도 토글 버튼
 * ExploreScreen 상단 고정 영역 첫 번째 줄
 */
import React from 'react';
import {
  StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { F } from '../../constants/typography';
import { PALETTE } from '../../constants/theme';

interface Props {
  value:       string;
  onChange:    (v: string) => void;
  mapActive:   boolean;
  onToggleMap: () => void;
}

export default function SearchBar({ value, onChange, mapActive, onToggleMap }: Props) {
  return (
    <View style={s.row}>
      {/* ── 검색 입력 영역 ── */}
      <View style={s.inputWrap}>
        <Ionicons name="search" size={16} color={PALETTE.gray400} />
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChange}
          placeholder="가게 이름 · 카테고리 검색"
          placeholderTextColor={PALETTE.gray400}
          returnKeyType="search"
          clearButtonMode="never"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChange('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={PALETTE.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── 지도 토글 ── */}
      <TouchableOpacity
        onPress={onToggleMap}
        style={[s.mapBtn, mapActive && s.mapBtnActive]}
        activeOpacity={0.8}
      >
        <Ionicons
          name={mapActive ? 'map' : 'map-outline'}
          size={20}
          color={mapActive ? '#FFFFFF' : PALETTE.gray600}
        />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingTop:        10,
    paddingBottom:     4,
    gap:               8,
  },
  inputWrap: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   PALETTE.gray100,
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  input: {
    flex:       1,
    fontFamily: F.medium,
    fontSize:   14,
    color:      PALETTE.gray900,
    padding:    0,
  },
  mapBtn: {
    width:           44,
    height:          44,
    borderRadius:    12,
    backgroundColor: PALETTE.gray100,
    alignItems:      'center',
    justifyContent:  'center',
  },
  mapBtnActive: {
    backgroundColor: PALETTE.orange500,
    // 오렌지 그림자
    shadowColor:   PALETTE.orange500,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius:  8,
    elevation:     6,
  },
});

/**
 * HomeLocationBar — 상단 고정 위치바
 * 로고(showBrand) + 📍 동 선택 드롭다운 + 검색/알림 아이콘
 * HomeScreens.jsx:11 포팅
 */
import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  loc?:       string;
  onChange?:  () => void;
  showBrand?: boolean;
  onSearch?:  () => void;
  onAlarm?:   () => void;
  hasAlarm?:  boolean;
}

export default function HomeLocationBar({
  loc       = '상남동',
  onChange,
  showBrand = false,
  onSearch,
  onAlarm,
  hasAlarm  = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      {/* 좌측: 로고 + 위치 선택 */}
      <View style={styles.left}>
        {showBrand && (
          <Text style={styles.brand}>언니픽</Text>
        )}
        <TouchableOpacity style={styles.locBtn} onPress={onChange} activeOpacity={0.7}>
          <Text style={styles.pin}>📍</Text>
          <Text style={styles.locName}>{loc}</Text>
          <Ionicons name="chevron-down" size={14} color="#4E5968" />
        </TouchableOpacity>
      </View>

      {/* 우측: 검색 · 알림 */}
      <View style={styles.right}>
        <TouchableOpacity style={styles.iconBtn} onPress={onSearch} activeOpacity={0.7}>
          <Ionicons name="search" size={22} color="#4E5968" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onAlarm} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={22} color="#4E5968" />
          {hasAlarm && <View style={styles.alarmDot} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 16,
    paddingBottom:   12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECEF',
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    flex:          1,
    minWidth:      0,
  },
  brand: {
    fontSize:    20,
    fontWeight:  '900',
    color:       '#FF6F0F',
    letterSpacing: -0.8,
    flexShrink:  0,
  },
  locBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    paddingVertical:   6,
    paddingHorizontal: 8,
    borderRadius:  10,
    flexShrink:    1,
    minWidth:      0,
  },
  pin: { fontSize: 15 },
  locName: {
    fontSize:    16,
    fontWeight:  '800',
    color:       '#191F28',
    letterSpacing: -0.3,
  },
  right: {
    flexDirection: 'row',
    gap:           8,
    flexShrink:    0,
  },
  iconBtn: {
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  alarmDot: {
    position:        'absolute',
    top:             4,
    right:           4,
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#FF6F0F',
    borderWidth:     1.5,
    borderColor:     '#FFFFFF',
  },
});

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
  loc?:            string;
  onChange?:       () => void;
  showBrand?:      boolean;
  onSearch?:       () => void;
  onAlarm?:        () => void;
  hasAlarm?:       boolean;
  /** 저장된 위치가 선택된 경우 라벨 전달 → '현재위치' 칩 표시 */
  savedLocLabel?:  string | null;
  /** '현재위치' 칩 클릭 시 GPS 위치로 리셋 */
  onResetToGPS?:   () => void;
}

export default function HomeLocationBar({
  loc       = '상남동',
  onChange,
  showBrand = false,
  onSearch,
  onAlarm,
  hasAlarm  = false,
  savedLocLabel,
  onResetToGPS,
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

        {/* 저장 위치 선택 시: '현재위치' 리셋 칩 */}
        {savedLocLabel != null && (
          <TouchableOpacity style={styles.gpsChip} onPress={onResetToGPS} activeOpacity={0.7}>
            <Ionicons name="navigate" size={11} color="#FF6F0F" />
            <Text style={styles.gpsChipText}>현재위치</Text>
          </TouchableOpacity>
        )}
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
    fontFamily:   'WantedSans-Black',
    fontSize:     22,
    fontWeight:   '900',
    color:        '#FF6F0F',
    letterSpacing: -1.0,
    flexShrink:   0,
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
    fontFamily:   'WantedSans-Bold',
    fontSize:     17,
    fontWeight:   '700',
    color:        '#191F28',
    letterSpacing: -0.3,
  },
  gpsChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      20,
    backgroundColor:   '#FFF3EB',
    borderWidth:       1,
    borderColor:       '#FFD4A8',
  },
  gpsChipText: {
    fontSize:   11,
    fontWeight: '700',
    color:      '#FF6F0F',
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

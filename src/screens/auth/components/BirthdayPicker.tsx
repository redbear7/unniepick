// BirthdayPicker — iOS 스타일 휠 피커 바텀시트 (월 · 일)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FONT_FAMILY } from '../../../constants/theme';

const ITEM_H  = 44;
const VISIBLE = 5;          // 보이는 아이템 수
const PADDING = ITEM_H * 2; // 상하 패딩 → 선택 항목이 중앙으로

interface Props {
  initialMonth: number;
  initialDay: number;
  onConfirm: (month: number, day: number) => void;
  onCancel: () => void;
}

function daysInMonth(m: number) {
  return [1, 3, 5, 7, 8, 10, 12].includes(m) ? 31 : m === 2 ? 29 : 30;
}

// ── Wheel ─────────────────────────────────────────────────────────
function Wheel({
  values,
  value,
  onChange,
  suffix,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  const ref       = useRef<ScrollView>(null);
  const mounted   = useRef(false);
  const scrolling = useRef(false);

  // 외부 value 변경 시 스크롤
  useEffect(() => {
    const idx = values.indexOf(value);
    if (idx < 0) return;
    const delay = mounted.current ? 0 : 60;
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: idx * ITEM_H, animated: mounted.current });
      mounted.current = true;
    }, delay);
    return () => clearTimeout(t);
  }, [value, values]);

  const handleScrollEnd = useCallback(
    (e: any) => {
      if (scrolling.current) return;
      const raw    = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
      const clamped = Math.max(0, Math.min(values.length - 1, raw));
      // 스냅 보정
      ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
      const next = values[clamped];
      if (next !== value) onChange(next);
    },
    [values, value, onChange],
  );

  return (
    <ScrollView
      ref={ref}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onScrollBeginDrag={() => { scrolling.current = false; }}
      onMomentumScrollEnd={handleScrollEnd}
      onScrollEndDrag={handleScrollEnd}
      contentContainerStyle={{ paddingVertical: PADDING }}
      style={s.wheel}
    >
      {values.map((v) => (
        <View key={v} style={s.wheelItem}>
          <Text style={[s.wheelText, v === value && s.wheelTextActive]}>
            {v}{suffix}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ── BirthdayPicker ───────────────────────────────────────────────
export default function BirthdayPicker({ initialMonth, initialDay, onConfirm, onCancel }: Props) {
  const [month, setMonth] = useState(initialMonth || 1);
  const [day,   setDay]   = useState(initialDay   || 1);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const maxDay = daysInMonth(month);
  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [month, maxDay]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, tension: 70, friction: 10, useNativeDriver: true,
    }).start();
  }, []);

  const months = Array.from({ length: 12 },  (_, i) => i + 1);
  const days   = Array.from({ length: maxDay }, (_, i) => i + 1);

  const handleConfirm = () => onConfirm(month, day);

  return (
    <Modal transparent animationType="none" onRequestClose={onCancel}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onCancel}>
        <Animated.View
          style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Grabber */}
          <View style={s.grabber} />

          {/* 툴바 */}
          <View style={s.toolbar}>
            <TouchableOpacity onPress={onCancel} style={s.toolbarBtn}>
              <Text style={s.cancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={s.toolbarTitle}>{month}월 {day}일</Text>
            <TouchableOpacity onPress={handleConfirm} style={s.toolbarBtn}>
              <Text style={s.confirmText}>확인</Text>
            </TouchableOpacity>
          </View>

          {/* 휠 */}
          <View style={s.wheels}>
            {/* 선택 하이라이트 */}
            <View style={s.selectionBar} pointerEvents="none" />
            <Wheel values={months} value={month} onChange={setMonth} suffix="월" />
            <Wheel values={days}   value={day}   onChange={setDay}   suffix="일" />
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 34,
  },
  grabber: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginTop: 8, marginBottom: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  toolbarBtn: { padding: 4 },
  cancelText:  { fontSize: 17, color: '#007AFF', fontFamily: FONT_FAMILY },
  confirmText: { fontSize: 17, fontWeight: '600', color: '#007AFF', fontFamily: FONT_FAMILY },
  toolbarTitle: { fontSize: 15, fontWeight: '600', color: '#191F28', fontFamily: FONT_FAMILY },
  wheels: {
    flexDirection: 'row',
    height: ITEM_H * VISIBLE,
    paddingHorizontal: 16,
    position: 'relative',
  },
  selectionBar: {
    position: 'absolute',
    left: 16, right: 16,
    top: ITEM_H * 2,
    height: ITEM_H,
    backgroundColor: 'rgba(120,120,128,0.12)',
    borderRadius: 8,
  },
  wheel: { flex: 1, height: ITEM_H * VISIBLE },
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 22,
    color: '#ADB5BD',
    fontFamily: FONT_FAMILY,
    fontWeight: '400',
  },
  wheelTextActive: {
    color: '#191F28',
    fontWeight: '600',
  },
});

// BirthdayPicker — iOS 스타일 휠 피커 바텀시트 (월 · 일)
//
// 핵심 수정사항:
//  1. onLayout 으로 초기 위치 설정 (mounted + timeout 제거)
//  2. lastSettled ref → onScrollEndDrag + onMomentumScrollEnd 중복 onChange 방지
//  3. settling ref → 프로그래매틱 scrollTo 가 onChange 재호출하는 것 방지
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
const VISIBLE = 5;

interface Props {
  initialMonth: number;
  initialDay:   number;
  onConfirm: (month: number, day: number) => void;
  onCancel:  () => void;
}

function daysInMonth(m: number) {
  return [1, 3, 5, 7, 8, 10, 12].includes(m) ? 31 : m === 2 ? 29 : 30;
}

// ── Wheel ─────────────────────────────────────────────────────────
interface WheelProps {
  values:   number[];
  value:    number;
  onChange: (v: number) => void;
  suffix:   string;
}

function Wheel({ values, value, onChange, suffix }: WheelProps) {
  const ref          = useRef<ScrollView>(null);
  const settling     = useRef(false);   // 프로그래매틱 scrollTo 중
  const lastSettled  = useRef(value);   // 중복 onChange 방지
  const prevValue    = useRef(value);

  // ── 프로그래매틱 scrollTo (settling 플래그로 감싸기) ───────────
  const scrollToIdx = useCallback((idx: number, animated: boolean) => {
    settling.current = true;
    ref.current?.scrollTo({ y: idx * ITEM_H, animated });
    // 애니메이션 끝날 때까지 대기 (animated=true → 350ms, false → 50ms)
    setTimeout(() => { settling.current = false; }, animated ? 400 : 80);
  }, []);

  // ── 1) 마운트 시 초기 위치: onLayout 에서 설정 ─────────────────
  const handleLayout = useCallback(() => {
    const idx = values.indexOf(value);
    if (idx >= 0) scrollToIdx(idx, false);
  }, []); // 최초 1회만

  // ── 2) 외부 value 변경 (예: 월 변경 → 일 클램프) ───────────────
  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    lastSettled.current = value;
    const idx = values.indexOf(value);
    if (idx >= 0) scrollToIdx(idx, true);
  }, [value, values, scrollToIdx]);

  // ── 3) 유저 스크롤 완료 → 스냅 + onChange ─────────────────────
  const handleSettle = useCallback((offsetY: number) => {
    if (settling.current) return;

    const raw     = Math.round(offsetY / ITEM_H);
    const idx     = Math.max(0, Math.min(values.length - 1, raw));
    const next    = values[idx];

    // 이미 같은 값이면 스킵 (이중 이벤트 방지)
    if (next === lastSettled.current) return;
    lastSettled.current = next;
    onChange(next);
  }, [values, onChange]);

  return (
    <ScrollView
      ref={ref}
      onLayout={handleLayout}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={(e) => handleSettle(e.nativeEvent.contentOffset.y)}
      onScrollEndDrag={(e)      => handleSettle(e.nativeEvent.contentOffset.y)}
      contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
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

  // 월 변경 시 일 클램프
  const handleMonthChange = useCallback((m: number) => {
    setMonth(m);
    setDay(d => {
      const max = daysInMonth(m);
      return d > max ? max : d;
    });
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, tension: 70, friction: 10, useNativeDriver: true,
    }).start();
  }, []);

  const months = Array.from({ length: 12 },   (_, i) => i + 1);
  const days   = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <Modal transparent animationType="none" onRequestClose={onCancel}>
      {/* 백드롭과 시트를 flex 컨테이너로 분리 — 시트 안 버튼 탭이 막히지 않도록 */}
      <View style={s.container}>
        {/* 위쪽 어두운 영역 탭 → 닫기 */}
        <TouchableOpacity style={s.dismissArea} activeOpacity={1} onPress={onCancel} />

        {/* 시트 (TouchableOpacity 외부) */}
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Grabber */}
          <View style={s.grabber} />

          {/* 툴바 */}
          <View style={s.toolbar}>
            <TouchableOpacity onPress={onCancel} style={s.toolbarBtn}>
              <Text style={s.cancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={s.toolbarTitle}>{month}월 {day}일</Text>
            <TouchableOpacity onPress={() => onConfirm(month, day)} style={s.toolbarBtn}>
              <Text style={s.confirmText}>확인</Text>
            </TouchableOpacity>
          </View>

          {/* 휠 */}
          <View style={s.wheels}>
            {/* 선택 하이라이트 */}
            <View style={s.selectionBar} pointerEvents="none" />
            <Wheel
              values={months}
              value={month}
              onChange={handleMonthChange}
              suffix="월"
            />
            <Wheel
              key={maxDay}        // maxDay 바뀌면 day 휠 완전 리마운트
              values={days}
              value={day}
              onChange={setDay}
              suffix="일"
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  toolbarBtn:   { padding: 4 },
  cancelText:   { fontSize: 17, color: '#007AFF', fontFamily: FONT_FAMILY },
  confirmText:  { fontSize: 17, fontWeight: '600', color: '#007AFF', fontFamily: FONT_FAMILY },
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

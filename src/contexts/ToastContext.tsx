import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── 타입 ─────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info' | 'warn';

interface ToastContextType {
  show: (message: string, type?: ToastType, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

// ─── 설정 ─────────────────────────────────────────────────────────
const CONFIG: Record<ToastType, { bg: string; emoji: string }> = {
  success: { bg: '#2DB87A', emoji: '✅' },
  error:   { bg: '#E94560', emoji: '❌' },
  info:    { bg: '#5B67CA', emoji: 'ℹ️' },
  warn:    { bg: '#FF6B3D', emoji: '⚠️' },
};

// ─── Provider ─────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets   = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [msg,     setMsg]     = useState('');
  const [type,    setType]    = useState<ToastType>('success');
  const [visible, setVisible] = useState(false);

  const show = (message: string, t: ToastType = 'success', durationMs = 2800) => {
    // 기존 타이머 초기화
    if (timerRef.current) clearTimeout(timerRef.current);
    slideY.stopAnimation();

    setMsg(message);
    setType(t);
    setVisible(true);

    // 등장
    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();

    // 자동 퇴장
    timerRef.current = setTimeout(() => {
      Animated.timing(slideY, {
        toValue: -120,
        duration: 280,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, durationMs);
  };

  const cfg = CONFIG[type];

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {/* ── 토스트 오버레이 ── */}
      {visible && (
        <Animated.View
          style={[
            ts.toast,
            { backgroundColor: cfg.bg, top: insets.top + 12 },
            { transform: [{ translateY: slideY }] },
          ]}
          pointerEvents="none"
        >
          <Text style={ts.emoji}>{cfg.emoji}</Text>
          <Text style={ts.message} numberOfLines={3}>{msg}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const ts = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  emoji:   { fontSize: 18 },
  message: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff', lineHeight: 20 },
});

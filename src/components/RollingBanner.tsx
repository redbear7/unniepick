import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { fetchActiveAnnouncements } from '../lib/services/announcementService';

const HOLD_MS  = 2800; // 텍스트 유지 시간 (ms)
const ENTER_MS = 380;  // 밑→위 등장 시간
const EXIT_MS  = 280;  // 위로 퇴장 시간
const OFFSET   = 20;   // 슬라이드 이동 거리 (px)

interface Props {
  refreshKey?: number;
}

export default function RollingBanner({ refreshKey }: Props) {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<string[]>([]);
  const [index, setIndex]       = useState(0);
  const [ready, setReady]       = useState(false);

  const translateY = useRef(new Animated.Value(OFFSET)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const animRef    = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      animRef.current?.stop();
    };
  }, [refreshKey]);

  const load = async () => {
    const data = await fetchActiveAnnouncements();
    if (!mountedRef.current) return;
    setMessages(data);
    if (data.length > 0) setReady(true);
  };

  useEffect(() => {
    if (!ready || messages.length === 0) return;
    playLoop(0);
    return () => { animRef.current?.stop(); };
  }, [ready, messages]);

  const playLoop = (idx: number) => {
    if (!mountedRef.current) return;

    // 다음 메시지 세팅 & 시작 위치 초기화 (아래)
    setIndex(idx);
    translateY.setValue(OFFSET);
    opacity.setValue(0);

    animRef.current = Animated.sequence([
      // ① 밑에서 위로 올라오며 등장
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: ENTER_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ENTER_MS,
          useNativeDriver: true,
        }),
      ]),
      // ② 잠시 유지
      Animated.delay(HOLD_MS),
      // ③ 위로 올라가며 퇴장
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -OFFSET,
          duration: EXIT_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: EXIT_MS,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animRef.current.start(({ finished }) => {
      if (!finished || !mountedRef.current) return;
      playLoop((idx + 1) % messages.length);
    });
  };

  if (!ready || messages.length === 0) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navigation.navigate('AnnouncementBoard')}
    >
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📢</Text>
        </View>
        <View style={styles.textClip}>
          <Animated.Text
            style={[styles.text, { opacity, transform: [{ translateY }] }]}
            numberOfLines={1}
          >
            {messages[index]}
          </Animated.Text>
        </View>
        <View style={styles.arrowWrap}>
          <Text style={styles.arrow}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  iconWrap: {
    paddingHorizontal: 10,
  },
  icon: { fontSize: 13 },
  textClip: {
    flex: 1,
    height: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  arrowWrap: {
    paddingHorizontal: 10,
  },
  arrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
});

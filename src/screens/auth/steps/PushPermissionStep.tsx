/**
 * Step 6: 푸시 알림 권한 요청 (풀스크린)
 *
 * 거부해도 홈 진입 허용 — "나중에 설정할게요" 링크 제공
 * 수락 시 registerPushToken() 호출 후 onDone()
 *
 * AuthFlow.jsx:887 PushPermissionStep 포팅 (basic variant)
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../lib/supabase';
import { registerPushToken } from '../../../lib/services/pushService';
import { PALETTE } from '../../../constants/theme';
import { T } from '../../../constants/typography';

interface Props {
  onDone: () => void;
}

const BULLETS: [string, string, string][] = [
  ['🎁', '새 쿠폰 알림',    '팔로우 가게가 쿠폰 발행 시'],
  ['⏰', '만료 임박 알림',  '저장한 쿠폰 만료 3일 · 1일 전'],
  ['🔥', '긴급 딜 알림',    '내 주변 한정 수량 오픈'],
];

export default function PushPermissionStep({ onDone }: Props) {
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        // 백그라운드로 토큰 저장 — 실패해도 홈 진입 허용
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) registerPushToken(user.id).catch(() => {});
        });
      }
    } catch { /* 무시 — 항상 진행 */ }
    setLoading(false);
    onDone();
  };

  const handleSkip = () => onDone();

  return (
    <View style={s.root}>
      {/* 중앙 본문 */}
      <View style={s.body}>
        {/* 아이콘 */}
        <View style={s.iconBox}>
          <Text style={s.iconEmoji}>🔔</Text>
          {/* 빨간 뱃지 */}
          <View style={s.badge} />
        </View>

        {/* 타이틀 + 설명 */}
        <View style={s.textBlock}>
          <Text style={s.title}>좋은 쿠폰을 놓치지 마세요</Text>
          <Text style={s.sub}>
            팔로우한 가게의 새 쿠폰과{'\n'}만료 임박 알림을 받아보세요.
          </Text>
        </View>

        {/* 용도 리스트 */}
        <View style={s.bulletBox}>
          {BULLETS.map(([emo, title, desc]) => (
            <View key={title} style={s.bulletRow}>
              <View style={s.bulletIcon}>
                <Text style={s.bulletEmoji}>{emo}</Text>
              </View>
              <View style={s.bulletText}>
                <Text style={s.bulletTitle}>{title}</Text>
                <Text style={s.bulletDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 하단 CTA */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.btn}
          onPress={handleRequest}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={s.btnText}>알림 받기</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} disabled={loading} style={s.skipBtn}>
          <Text style={s.skipText}>나중에 설정할게요</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#FFFFFF' },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 28,
  },

  // 아이콘
  iconBox: {
    width: 128, height: 128, borderRadius: 36,
    backgroundColor: PALETTE.orange50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PALETTE.orange500,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15, shadowRadius: 30,
    elevation: 4,
  },
  iconEmoji: { fontSize: 64 },
  badge: {
    position: 'absolute',
    top: 22, right: 22,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: PALETTE.orange500,
    borderWidth: 3, borderColor: '#FFFFFF',
  },

  // 텍스트
  textBlock:  { alignItems: 'center', gap: 14 },
  title: {
    ...T.title24,
    color: PALETTE.gray900,
    textAlign: 'center',
  },
  sub: {
    ...T.body15,
    color: PALETTE.gray600,
    textAlign: 'center',
  },

  // 용도 리스트
  bulletBox: {
    width: '100%',
    backgroundColor: PALETTE.gray100,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  bulletRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletIcon:  {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bulletEmoji: { fontSize: 18 },
  bulletText:  { flex: 1, minWidth: 0 },
  bulletTitle: { ...T.label14, color: PALETTE.gray900, marginBottom: 2 },
  bulletDesc:  { ...T.caption12, color: PALETTE.gray500 },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  btn: {
    backgroundColor: PALETTE.orange500,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PALETTE.orange500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26, shadowRadius: 16,
    elevation: 4,
  },
  btnText: { ...T.btn16, color: '#FFFFFF' },
  skipBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    ...T.btn14,
    color: PALETTE.gray500,
  },
});

/**
 * Step 4: 위치 권한 요청 (풀스크린)
 *
 * 거부 시 진행 불가 — 설정 앱 안내 배너 + 재요청 CTA 표시
 * 수락 시 onNext() 호출
 *
 * AuthFlow.jsx:817 LocationPermissionStep 포팅 (basic variant)
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { PALETTE } from '../../../constants/theme';
import { T } from '../../../constants/typography';

interface Props {
  onNext: () => void;
}

const BULLETS: [string, string, string][] = [
  ['🛡️', '쿠폰 부정 사용 방지',  '실제 방문 위치를 확인해 중복·원격 사용을 차단해요'],
  ['📍', '내 주변 가게 · 쿠폰',  '반경 500m 핫플과 긴급 딜을 실시간으로 보여줘요'],
  ['🏃', '자동 체크인',           '매장 근처에서 도장 적립 · 쿠폰을 자동으로 사용해요'],
];

export default function LocationPermissionStep({ onNext }: Props) {
  const [denied,  setDenied]  = useState(false);
  const [loading, setLoading] = useState(true); // 진입 시 즉시 체크

  // ── 진입 즉시 현재 권한 상태 확인 ────────────────────────────────
  // 이미 허용 → 자동 다음 단계
  // 미결정   → 버튼으로 요청 (OS 팝업 표시)
  // 거부     → 설정 안내 배너 표시
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        onNext(); // 이미 허용 → 스킵
      } else if (status === 'denied') {
        setDenied(true);  // 이미 거부 → 설정 안내
        setLoading(false);
      } else {
        setLoading(false); // 미결정 → 버튼 표시
      }
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        onNext();
      } else {
        setDenied(true);
      }
    } catch {
      setDenied(true);
    } finally {
      setLoading(false);
    }
  };

  const openSettings = () => Linking.openSettings();

  // 권한 상태 초기 체크 중 — 빈 화면 대신 로딩 표시
  if (loading) {
    return (
      <View style={s.root}>
        <ActivityIndicator style={{ flex: 1 }} color={PALETTE.orange500} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* 중앙 본문 */}
      <View style={s.body}>
        {/* 아이콘 + 필수 배지 */}
        <View>
          <View style={s.iconBox}>
            <Text style={s.iconEmoji}>📍</Text>
          </View>
          <View style={s.requiredBadge}>
            <Text style={s.requiredBadgeText}>필수</Text>
          </View>
        </View>

        {/* 타이틀 + 설명 */}
        <View style={s.textBlock}>
          <Text style={s.title}>위치 권한이 필수예요</Text>
          <Text style={s.sub}>
            쿠폰 부정 사용 방지를 위해{'\n'}실제 방문 위치 인증이 반드시 필요해요.
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

        {/* 거부 시 안내 배너 */}
        {denied && (
          <View style={s.deniedBanner}>
            <Text style={s.deniedIcon}>🔒</Text>
            <Text style={s.deniedText}>
              위치 권한 없이는 서비스 이용이 불가해요.{'\n'}
              쿠폰 부정 사용 방지를 위한 필수 인증입니다.
            </Text>
            <TouchableOpacity
              style={s.settingsBtn}
              onPress={openSettings}
              activeOpacity={0.8}
            >
              <Text style={s.settingsBtnText}>설정에서 위치 허용하기 →</Text>
            </TouchableOpacity>
          </View>
        )}
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
            : <Text style={s.btnText}>
                {denied ? '다시 권한 허용하기' : '위치 권한 허용하기'}
              </Text>
          }
        </TouchableOpacity>
        <Text style={s.hint}>위치 정보는 쿠폰 인증 외 목적으로 사용되지 않아요</Text>
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
  requiredBadge: {
    position: 'absolute',
    bottom: -6, right: -6,
    backgroundColor: PALETTE.orange500,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  requiredBadgeText: {
    fontFamily: 'WantedSans-Bold',
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
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

  // 거부 배너
  deniedBanner: {
    width: '100%',
    backgroundColor: '#FFF1F0',
    borderWidth: 1.5,
    borderColor: '#FFCCC7',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  deniedIcon: { fontSize: 22 },
  deniedText: {
    ...T.body13,
    color: '#C0392B',
    textAlign: 'center',
    lineHeight: 20,
  },
  settingsBtn: {
    marginTop: 4,
    backgroundColor: PALETTE.orange500,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  settingsBtnText: {
    fontFamily: 'WantedSans-Bold',
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

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
  btnText:  { ...T.btn16, color: '#FFFFFF' },
  hint: {
    ...T.caption11,
    color: PALETTE.gray500,
    textAlign: 'center',
    marginTop: 10,
  },
});

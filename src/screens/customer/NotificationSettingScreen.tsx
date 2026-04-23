import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, RADIUS, SHADOW, TYPE } from '../../constants/theme';
import { getSession } from '../../lib/services/authService';
import {
  NotifSetting,
  fetchNotifSetting, upsertNotifSetting,
} from '../../lib/services/notificationService';

// ── 설정 항목 목록 ──────────────────────────────────────────────────
const SETTING_ITEMS: {
  key: keyof Omit<NotifSetting, 'user_id'>;
  emoji: string;
  label: string;
  desc: string;
}[] = [
  { key: 'coupon',     emoji: '🎟', label: '쿠폰 알림',      desc: '새 쿠폰 발급 시 알림' },
  { key: 'stamp',      emoji: '🍀', label: '스탬프 알림',    desc: '스탬프 적립 및 리워드 달성 시 알림' },
  { key: 'coin',       emoji: '🪙', label: '포인트 알림',      desc: '포인트 적립 및 만료 예정 알림' },
  { key: 'expiry',     emoji: '⏰', label: '만료 임박 알림', desc: '쿠폰 만료 D-3, D-1 알림' },
  { key: 'nearby_fav', emoji: '❤️', label: '찜 매장 소식',   desc: '찜한 매장의 새 쿠폰·이벤트 알림' },
  { key: 'nearby_new', emoji: '📍', label: '주변 신규 매장', desc: '내 주변에 새 매장 등록 시 알림' },
  { key: 'event',      emoji: '📣', label: '이벤트·공지',    desc: '프로모션 및 앱 공지 알림' },
];

export default function NotificationSettingScreen() {
  const navigation = useNavigation<any>();
  const [userId,  setUserId]  = useState<string | null>(null);
  const [setting, setSetting] = useState<NotifSetting | null>(null);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    getSession().then(async s => {
      if (!s) return;
      setUserId(s.user.id);
      const data = await fetchNotifSetting(s.user.id);
      setSetting(data);
    });
  }, []);

  const toggleAll = (value: boolean) => {
    if (!setting) return;
    const next: NotifSetting = {
      ...setting,
      coupon: value, stamp: value, coin: value,
      expiry: value, nearby_fav: value, nearby_new: value, event: value,
    };
    setSetting(next);
    save(next);
  };

  const toggle = (key: keyof Omit<NotifSetting, 'user_id'>) => {
    if (!setting) return;
    const next = { ...setting, [key]: !setting[key] };
    setSetting(next);
    save(next);
  };

  const save = async (s: NotifSetting) => {
    setSaving(true);
    await upsertNotifSetting(s).catch(() => {});
    setSaving(false);
  };

  const allOn = setting
    ? Object.entries(setting)
        .filter(([k]) => k !== 'user_id')
        .every(([, v]) => v === true)
    : false;

  if (!setting) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={ss.header}>
        <TouchableOpacity style={ss.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={ss.headerTitle}>알림 설정</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 전체 토글 */}
        <View style={[ss.card, ss.allRow, SHADOW.sm]}>
          <View style={ss.allLeft}>
            <Text style={ss.allLabel}>전체 알림</Text>
            <Text style={ss.allDesc}>{allOn ? '모든 알림이 켜져 있어요' : '일부 알림이 꺼져 있어요'}</Text>
          </View>
          <Switch
            value={allOn}
            onValueChange={toggleAll}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* 개별 설정 */}
        <View style={[ss.card, SHADOW.sm]}>
          {SETTING_ITEMS.map((item, i) => (
            <View key={item.key}>
              <View style={ss.row}>
                <View style={ss.emojiWrap}>
                  <Text style={ss.emoji}>{item.emoji}</Text>
                </View>
                <View style={ss.rowText}>
                  <Text style={ss.rowLabel}>{item.label}</Text>
                  <Text style={ss.rowDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={setting[item.key] as boolean}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#fff"
                />
              </View>
              {i < SETTING_ITEMS.length - 1 && <View style={ss.divider} />}
            </View>
          ))}
        </View>

        {/* 안내 */}
        <View style={ss.notice}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
          <Text style={ss.noticeText}>
            알림을 받으려면 기기의 알림 권한도 허용되어 있어야 해요.{'\n'}
            설정 {'>'} 언니픽 {'>'} 알림 에서 확인할 수 있어요.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {saving && (
        <View style={ss.savingBadge}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={ss.savingText}>저장 중...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn:     { padding: 8 },
  headerTitle: { ...TYPE.h2, flex: 1, textAlign: 'center', color: COLORS.text },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginHorizontal: 16, marginTop: 16,
    overflow: 'hidden',
  },

  // 전체 토글
  allRow:  { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  allLeft: { flex: 1 },
  allLabel: { ...TYPE.h3, color: COLORS.text },
  allDesc:  { ...TYPE.c1, color: COLORS.textMuted, marginTop: 2 },

  // 개별 행
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  emojiWrap: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji:   { fontSize: 20 },
  rowText: { flex: 1 },
  rowLabel: { ...TYPE.l1, color: COLORS.text },
  rowDesc:  { ...TYPE.c1, color: COLORS.textMuted, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 68 },

  // 안내
  notice: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    marginHorizontal: 20, marginTop: 16,
  },
  noticeText: { ...TYPE.c1, color: COLORS.textMuted, flex: 1, lineHeight: 18 },

  // 저장 중
  savingBadge: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: COLORS.text, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  savingText: { ...TYPE.l2, color: '#fff' },
});

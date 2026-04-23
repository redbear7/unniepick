import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, RADIUS, SHADOW, TYPE } from '../../constants/theme';
import { getSession } from '../../lib/services/authService';
import {
  NotifRow, NotifType,
  fetchNotifications, markAsRead, markAllAsRead, deleteNotif,
  NOTIF_META, formatNotifTime,
} from '../../lib/services/notificationService';

// ── 필터 목록 ──────────────────────────────────────────────────────
const FILTERS: { key: NotifType | 'all'; label: string }[] = [
  { key: 'all',    label: '전체' },
  { key: 'coupon', label: '🎟 쿠폰' },
  { key: 'stamp',  label: '🍀 스탬프' },
  { key: 'coin',   label: '🪙 포인트' },
  { key: 'expiry', label: '⏰ 만료' },
  { key: 'nearby', label: '📍 주변' },
  { key: 'event',  label: '📣 이벤트' },
];

// ── 개별 알림 셀 ────────────────────────────────────────────────────
function NotifItem({
  item, onRead, onDelete,
}: {
  item: NotifItem_T;
  onRead:   (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const meta      = NOTIF_META[item.type];
  const slideX    = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);

  const handlePress = () => {
    if (!item.is_read) onRead(item.id);
  };

  const handleSwipe = () => {
    setSwiped(true);
    Animated.timing(slideX, {
      toValue: -80, duration: 200, useNativeDriver: true,
    }).start();
  };

  const handleCancel = () => {
    setSwiped(false);
    Animated.timing(slideX, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start();
  };

  return (
    <View style={s.itemWrapper}>
      {/* 삭제 버튼 (슬라이드 후 노출) */}
      <TouchableOpacity
        style={s.deleteAction}
        onPress={() => onDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={s.deleteActionText}>삭제</Text>
      </TouchableOpacity>

      <Animated.View style={[s.itemRow, { transform: [{ translateX: slideX }] }]}>
        <TouchableOpacity
          style={[s.item, !item.is_read && s.itemUnread]}
          onPress={handlePress}
          onLongPress={handleSwipe}
          activeOpacity={0.75}
        >
          {/* 아이콘 */}
          <View style={[s.iconWrap, { backgroundColor: meta.color + '18' }]}>
            <Text style={s.iconEmoji}>{meta.emoji}</Text>
          </View>

          {/* 내용 */}
          <View style={s.itemContent}>
            <View style={s.itemTopRow}>
              <Text style={s.itemTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={s.itemTime}>{formatNotifTime(item.created_at)}</Text>
            </View>
            <Text style={s.itemBody} numberOfLines={2}>{item.body}</Text>
          </View>

          {/* 미읽음 점 */}
          {!item.is_read && <View style={[s.unreadDot, { backgroundColor: meta.color }]} />}
        </TouchableOpacity>

        {/* 슬라이드 후 취소 */}
        {swiped && (
          <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
            <Text style={s.cancelText}>취소</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

type NotifItem_T = NotifRow;

// ── 메인 화면 ───────────────────────────────────────────────────────
export default function NotificationScreen() {
  const navigation = useNavigation<any>();
  const [userId,     setUserId]     = useState<string | null>(null);
  const [notifs,     setNotifs]     = useState<NotifRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<NotifType | 'all'>('all');

  // 유저 확인
  useEffect(() => {
    getSession().then(s => { if (s) setUserId(s.user.id); });
  }, []);

  // 알림 로드
  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchNotifications(userId);
      setNotifs(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // 읽음 처리
  const handleRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await markAsRead(id);
  };

  // 삭제
  const handleDelete = async (id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    await deleteNotif(id);
  };

  // 전체 읽음
  const handleReadAll = async () => {
    if (!userId) return;
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    await markAllAsRead(userId);
  };

  // 필터링
  const filtered = filter === 'all' ? notifs : notifs.filter(n => n.type === filter);
  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>알림</Text>
        <TouchableOpacity
          style={s.settingBtn}
          onPress={() => navigation.navigate('NotificationSetting')}
        >
          <Ionicons name="settings-outline" size={20} color={COLORS.textMuted} />
          <Text style={s.settingText}>알림설정</Text>
        </TouchableOpacity>
      </View>

      {/* 필터 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterWrap}
        contentContainerStyle={s.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 전체 읽음 버튼 */}
      {unreadCount > 0 && (
        <TouchableOpacity style={s.readAllBtn} onPress={handleReadAll}>
          <Ionicons name="checkmark-done-outline" size={14} color={COLORS.primary} />
          <Text style={s.readAllText}>전체 읽음 ({unreadCount})</Text>
        </TouchableOpacity>
      )}

      {/* 알림 목록 */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          style={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔔</Text>
              <Text style={s.emptyTitle}>알림이 없어요</Text>
              <Text style={s.emptyBody}>
                {filter === 'all'
                  ? '새로운 쿠폰·스탬프·이벤트 알림이\n여기에 표시돼요'
                  : `${NOTIF_META[filter as NotifType]?.label ?? ''} 알림이 없어요`}
              </Text>
            </View>
          ) : (
            <>
              {filtered.map(n => (
                <NotifItem
                  key={n.id}
                  item={n}
                  onRead={handleRead}
                  onDelete={handleDelete}
                />
              ))}
              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn:     { padding: 8 },
  headerTitle: { ...TYPE.h2, flex: 1, textAlign: 'center', color: COLORS.text },
  settingBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  settingText: { ...TYPE.c1, color: COLORS.textMuted },

  // 필터
  filterWrap:    { flexGrow: 0, backgroundColor: COLORS.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary },
  filterText:       { ...TYPE.l2, color: COLORS.textMuted },
  filterTextActive: { color: COLORS.primary, fontWeight: '700' },

  // 전체 읽음
  readAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8,
  },
  readAllText: { ...TYPE.c1, color: COLORS.primary, fontWeight: '700' },

  // 목록
  list: { flex: 1 },

  // 알림 아이템
  itemWrapper: { position: 'relative', overflow: 'hidden' },
  deleteAction: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  deleteActionText: { ...TYPE.c2, color: '#fff', fontWeight: '700' },

  itemRow: { flexDirection: 'row' },
  item: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  itemUnread: { backgroundColor: '#FFFAF7' },

  iconWrap: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconEmoji:   { fontSize: 22 },
  itemContent: { flex: 1, gap: 3 },
  itemTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle:   { ...TYPE.l1, color: COLORS.text, flex: 1, marginRight: 8 },
  itemTime:    { ...TYPE.c2, color: COLORS.textMuted, flexShrink: 0 },
  itemBody:    { ...TYPE.b3, color: COLORS.textSub, lineHeight: 20 },

  unreadDot: {
    width: 8, height: 8, borderRadius: 4, flexShrink: 0,
    marginTop: 4, alignSelf: 'flex-start',
  },

  cancelBtn:   { justifyContent: 'center', paddingHorizontal: 12, backgroundColor: COLORS.surface },
  cancelText:  { ...TYPE.l2, color: COLORS.textMuted },

  // 빈 상태
  empty: {
    flex: 1, alignItems: 'center', paddingTop: 80, gap: 10,
  },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { ...TYPE.h3, color: COLORS.text },
  emptyBody:  { ...TYPE.b3, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
});

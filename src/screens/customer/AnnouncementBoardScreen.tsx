import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, SafeAreaView, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  AnnouncementRow,
  fetchActiveAnnouncementRows,
  incrementViewCount,
} from '../../lib/services/announcementService';

// Android 에서 LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AnnouncementBoardScreen() {
  const navigation = useNavigation();
  const [notices, setNotices]       = useState<AnnouncementRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchActiveAnnouncementRows();
    setNotices(rows);
    setLoading(false);
    // 게시판 진입 시 조회수 일괄 증가
    rows.forEach(r => incrementViewCount(r.id));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => (prev === id ? null : id));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

  const renderItem = ({ item, index }: { item: AnnouncementRow; index: number }) => {
    const isOpen = expandedId === item.id;
    // 제목이 없으면 content 의 앞부분을 제목처럼 표시
    const displayTitle = item.title?.trim() || item.content;
    const hasContent   = item.content?.trim() && item.content.trim() !== item.title?.trim();

    return (
      <View style={styles.card}>
        {/* ── 제목 행 (항상 표시) ── */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => hasContent && toggleExpand(item.id)}
          style={styles.titleRow}
        >
          {/* 번호 뱃지 */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{index + 1}</Text>
          </View>

          {/* 제목 텍스트 */}
          <Text style={[styles.title, !hasContent && { color: COLORS.textMuted ?? '#999' }]} numberOfLines={isOpen ? undefined : 2}>
            {displayTitle}
          </Text>

          {/* 펼치기 화살표 (내용 있을 때만) */}
          {hasContent && (
            <Text style={[styles.chevron, isOpen && styles.chevronUp]}>›</Text>
          )}
        </TouchableOpacity>

        {/* 날짜 */}
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>

        {/* ── 본문 (펼쳐졌을 때만) ── */}
        {isOpen && hasContent && (
          <View style={styles.contentBox}>
            <View style={styles.divider} />
            <Text style={styles.content}>{item.content}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📢 공지사항</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : notices.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
          <Text style={styles.emptyText}>등록된 공지사항이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background ?? '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white ?? '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    ...SHADOW,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.text ?? '#222',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text ?? '#222',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted ?? '#999',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.white ?? '#fff',
    borderRadius: typeof RADIUS === 'object' ? RADIUS.lg : (RADIUS ?? 12),
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    ...SHADOW,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text ?? '#222',
    lineHeight: 21,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.textMuted ?? '#aaa',
    transform: [{ rotate: '90deg' }],
    lineHeight: 26,
  },
  chevronUp: {
    transform: [{ rotate: '-90deg' }],
  },
  date: {
    fontSize: 11,
    color: COLORS.textMuted ?? '#bbb',
    marginTop: 6,
    marginLeft: 34,   // badge 너비(24) + gap(10)
  },
  contentBox: {
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginBottom: 12,
  },
  content: {
    fontSize: 14,
    color: COLORS.text ?? '#444',
    lineHeight: 22,
  },
});

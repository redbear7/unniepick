import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getSession } from '../../lib/services/authService';

interface StoreInfo {
  id: string;
  name: string;
  category: string;
  address?: string;
}

export default function StoreQRScreen() {
  const navigation = useNavigation<any>();
  const [store,   setStore]   = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStore(); }, []);

  const loadStore = async () => {
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    const { data } = await supabase
      .from('stores')
      .select('id, name, category, address')
      .eq('owner_id', session.user.id)
      .eq('is_active', true)
      .single();
    setStore(data ?? null);
    setLoading(false);
  };

  const qrValue = store ? `unniepick://checkin?store=${store.id}` : '';

  const handleShare = async () => {
    if (!store) return;
    try {
      await Share.share({
        title: `${store.name} 픽포인트 QR`,
        message: `${store.name} 방문 시 아래 링크로 픽포인트를 적립하세요!\nhttps://unniepick.app/checkin?store=${store.id}`,
      });
    } catch { /* 무시 */ }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!store) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.backText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={s.title}>방문 QR</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}>
          <Text style={s.noStoreEmoji}>🏪</Text>
          <Text style={s.noStoreText}>등록된 가게가 없어요{'\n'}가게 승인 후 QR이 발급됩니다</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={s.title}>방문 QR</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.container}>
        {/* QR 포스터 카드 */}
        <View style={[s.poster, SHADOW.card]}>
          {/* 상단 헤더 */}
          <View style={s.posterHeader}>
            <Text style={s.posterLogo}>언니픽 💰</Text>
            <Text style={s.posterSub}>방문하고 픽포인트 받기</Text>
          </View>

          {/* QR 코드 */}
          <View style={s.qrBox}>
            <QRCode
              value={qrValue}
              size={200}
              color="#1a1a1a"
              backgroundColor="#fff"
            />
          </View>

          {/* 가게 정보 */}
          <View style={s.posterInfo}>
            <Text style={s.posterStoreName}>{store.name}</Text>
            <Text style={s.posterCategory}>{store.category}</Text>
            {store.address && (
              <Text style={s.posterAddress} numberOfLines={1}>📍 {store.address}</Text>
            )}
          </View>

          {/* 적립 안내 */}
          <View style={s.earnBadge}>
            <Text style={s.earnBadgeText}>🎁 방문 시 +50 UNNI 적립 · 하루 1회</Text>
          </View>
        </View>

        {/* 안내 */}
        <View style={[s.guideCard, SHADOW.card]}>
          <Text style={s.guideTitle}>📌 사용 방법</Text>
          <Text style={s.guideText}>① 이 QR을 프린트해서 카운터에 붙여주세요</Text>
          <Text style={s.guideText}>② 고객이 앱으로 스캔하면 자동 적립돼요</Text>
          <Text style={s.guideText}>③ 업주는 아무것도 안 해도 됩니다 😊</Text>
        </View>

        {/* 공유 버튼 */}
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Text style={s.shareBtnText}>📤 QR 링크 공유하기</Text>
        </TouchableOpacity>

        <Text style={s.notice}>
          ※ QR코드는 변경되지 않습니다. 프린트 후 영구 사용 가능합니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.background },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               padding: 20, paddingBottom: 8 },
  backText:  { fontSize: 16, color: COLORS.primary, fontFamily: 'WantedSans-SemiBold', fontWeight: '600' },
  title:     { fontSize: 18, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: COLORS.text },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  noStoreEmoji: { fontSize: 56 },
  noStoreText:  { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 24 },
  container: { flex: 1, padding: 20, gap: 14, alignItems: 'center' },

  // QR 포스터
  poster: {
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    padding: 24, alignItems: 'center', gap: 16, width: '100%',
    borderWidth: 2, borderColor: COLORS.primary,
  },
  posterHeader:   { alignItems: 'center', gap: 4 },
  posterLogo:     { fontSize: 20, fontFamily: 'WantedSans-Black', fontWeight: '900', color: COLORS.primary },
  posterSub:      { fontSize: 13, color: COLORS.textMuted, fontFamily: 'WantedSans-SemiBold', fontWeight: '600' },
  qrBox: {
    padding: 16, backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 2, borderColor: COLORS.border,
  },
  posterInfo:     { alignItems: 'center', gap: 4 },
  posterStoreName:{ fontSize: 20, fontFamily: 'WantedSans-Black', fontWeight: '900', color: COLORS.text },
  posterCategory: { fontSize: 13, color: COLORS.textMuted },
  posterAddress:  { fontSize: 12, color: COLORS.textMuted, maxWidth: 220 },
  earnBadge: {
    backgroundColor: COLORS.primary + '15', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  earnBadgeText: { fontSize: 13, fontFamily: 'WantedSans-Bold', fontWeight: '700', color: COLORS.primary },

  // 안내 카드
  guideCard:  { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 16,
                gap: 6, width: '100%' },
  guideTitle: { fontSize: 13, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  guideText:  { fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },

  // 공유 버튼
  shareBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontFamily: 'WantedSans-ExtraBold', fontWeight: '800' },
  notice: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
});

// AccountActions — 사장님앱 링크 · 로그아웃 · 회원탈퇴 · 버전 (Block D)
// 로그아웃·탈퇴: iOS 네이티브 Alert 2단계 확인
// 탈퇴 시 보유 쿠폰 수 표시 (엣지 케이스 7번)
import React from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { PALETTE } from '../../../constants/theme';

const APP_VERSION = '1.0.0';
const OWNER_APP_URL = 'https://apps.apple.com/app/unniepick-owner'; // placeholder

interface Props {
  walletCount: number;
  onLogout:    () => void;  // navigation.reset → PhoneAuth 는 onAuthStateChange 가 처리
}

export default function AccountActions({ walletCount, onLogout }: Props) {

  // ── 로그아웃 2단계 ────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            onLogout();
          },
        },
      ],
    );
  };

  // ── 회원탈퇴 2단계 ────────────────────────────────────────────
  const handleWithdraw = () => {
    Alert.alert(
      '회원탈퇴',
      `정말 탈퇴하시겠어요?\n쿠폰 ${walletCount}장이 삭제됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: () => {
            // 2단계 최종 확인
            Alert.alert(
              '탈퇴 확인',
              '탈퇴 후에는 복구가 불가해요. 계속하시겠어요?',
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '진짜 탈퇴',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (session?.user?.id) {
                        // soft delete — profiles.deleted_at 업데이트
                        await supabase
                          .from('profiles')
                          .update({ deleted_at: new Date().toISOString() })
                          .eq('id', session.user.id)
                          .then(() => {});   // 실패해도 진행
                      }
                    } catch { /* ignore */ }
                    await supabase.auth.signOut();
                    onLogout();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <View style={s.wrap}>
      {/* 사장님 앱 배너 */}
      <TouchableOpacity
        style={s.ownerBanner}
        onPress={() => Linking.openURL(OWNER_APP_URL).catch(() => {})}
        activeOpacity={0.8}
      >
        <Text style={s.ownerText}>가게 사장님이신가요?</Text>
        <Text style={s.ownerLink}>사장님 앱 다운로드 ›</Text>
      </TouchableOpacity>

      {/* 로그아웃 · 회원탈퇴 */}
      <View style={s.actionRow}>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={s.actionBtn}>
          <Text style={s.actionText}>로그아웃</Text>
        </TouchableOpacity>
        <Text style={s.dot}>·</Text>
        <TouchableOpacity onPress={handleWithdraw} activeOpacity={0.7} style={s.actionBtn}>
          <Text style={s.actionText}>회원탈퇴</Text>
        </TouchableOpacity>
      </View>

      {/* 버전 */}
      <Text style={s.version}>UnniePick v{APP_VERSION}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingTop:    20,
    paddingBottom: 40,
    alignItems:    'center',
    gap:            0,
  },

  // 사장님 배너
  ownerBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:              6,
    marginHorizontal: 20,
    padding:          12,
    paddingHorizontal: 14,
    borderRadius:     12,
    backgroundColor:  '#FFFFFF',
    borderWidth:      1,
    borderColor:      PALETTE.gray150,
    width:            '90%',
  },
  ownerText: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     13,
    fontWeight:   '500',
    color:        PALETTE.gray600,
    lineHeight:   18,
  },
  ownerLink: {
    fontFamily:  'WantedSans-ExtraBold',
    fontSize:     13,
    fontWeight:   '800',
    color:        PALETTE.orange500,
    lineHeight:   18,
  },

  // 로그아웃·탈퇴
  actionRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             14,
    marginTop:       14,
    marginBottom:    10,
  },
  actionBtn: { paddingVertical: 6 },
  actionText: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     13,
    fontWeight:   '500',
    color:        PALETTE.gray500,
    lineHeight:   17,
  },
  dot: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     13,
    color:        PALETTE.gray300,
  },

  // 버전
  version: {
    fontFamily:  'WantedSans-Medium',
    fontSize:     11,
    fontWeight:   '500',
    color:        PALETTE.gray400,
    lineHeight:   15,
  },
});

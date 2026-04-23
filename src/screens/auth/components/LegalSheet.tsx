/**
 * LegalSheet — 개인정보처리방침 / 이용약관 바텀시트
 *
 * 두 탭을 상단에 표시하고, 각 탭 콘텐츠를 스크롤로 열람.
 * Modal + 슬라이드업 애니메이션으로 표시.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE } from '../../../constants/theme';
import { F, T } from '../../../constants/typography';

export type LegalTab = 'privacy' | 'terms';

interface Props {
  visible:  boolean;
  initTab?: LegalTab;
  onClose:  () => void;
}

const SH = Dimensions.get('window').height;

// ─────────────────────────────────────────────────────────────────────────────
// 개인정보처리방침 내용
// ─────────────────────────────────────────────────────────────────────────────
const PRIVACY_CONTENT = `언니픽(이하 "앱")은 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.

제1조 (수집하는 개인정보 항목)

앱은 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.

■ 필수 수집 항목
• 휴대폰 번호 (본인인증 및 계정 식별 목적)

■ 선택 수집 항목
• 닉네임, 생년월일 (프로필 설정)
• 위치 정보 (주변 가게 추천, GPS 기반)
• 기기 알림 식별 정보 (알림 발송 목적)

■ 서비스 이용 중 자동 수집
• 앱 이용 기록, 접속 로그, 쿠폰 사용 내역
• 기기 정보 (OS 버전, 앱 버전)


제2조 (개인정보 수집 및 이용 목적)

① 본인 인증 및 계정 관리
② 쿠폰·혜택 서비스 제공
③ 주변 가게 추천 (위치 기반)
④ 공지사항, 이벤트 안내 (앱 푸시 알림)
⑤ 서비스 개선 및 통계 분석


제3조 (개인정보 보유 및 이용 기간)

이용자의 개인정보는 서비스 이용 계약이 유지되는 동안 보유하며, 탈퇴 또는 동의 철회 시 지체 없이 삭제합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.

• 전자상거래 관련 기록: 5년 (전자상거래법)
• 소비자 불만·분쟁 기록: 3년 (전자상거래법)
• 접속 로그: 3개월 (통신비밀보호법)


제4조 (개인정보의 제3자 제공)

앱은 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 아래의 경우 예외로 합니다.

• 이용자가 사전에 동의한 경우
• 법령에 의거하거나 수사기관의 적법한 절차에 따른 경우


제5조 (개인정보 처리 위탁)

앱은 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁합니다.

• 수탁자: Supabase Inc. / 위탁 업무: 데이터베이스 호스팅
• 수탁자: Expo (Expo Push Notification) / 위탁 업무: 푸시 알림 발송


제6조 (이용자의 권리 및 행사 방법)

이용자는 언제든지 아래 권리를 행사할 수 있습니다.

① 개인정보 열람 요청
② 오류 정정 요청
③ 삭제 요청 (탈퇴 처리)
④ 처리 정지 요청

권리 행사는 앱 내 [마이페이지 → 계정 설정 → 탈퇴] 또는 고객센터 이메일로 요청하실 수 있습니다.


제7조 (개인정보의 안전성 확보 조치)

앱은 개인정보 보호를 위해 다음과 같은 조치를 취하고 있습니다.

• 데이터 전송 시 HTTPS/TLS 암호화
• 비밀번호 등 민감 정보 암호화 저장
• 접근 권한 최소화 및 접근 로그 관리


제8조 (위치정보 처리)

앱은 주변 가게 추천 기능 제공을 위해 이용자의 위치 정보를 수집합니다. 위치 정보 수집은 이용자의 명시적 동의 후에만 이루어지며, 서비스 제공 목적 외 사용하지 않습니다.


제9조 (개인정보 보호책임자)

개인정보 관련 문의는 아래로 연락해 주세요.

• 책임자: 언니픽 운영팀
• 이메일: support@unniepick.com


제10조 (고지 의무)

본 방침은 2025년 01월 01일부터 시행됩니다. 내용이 변경될 경우 앱 내 공지사항을 통해 사전 안내합니다.`;

// ─────────────────────────────────────────────────────────────────────────────
// 이용약관 내용
// ─────────────────────────────────────────────────────────────────────────────
const TERMS_CONTENT = `본 약관은 언니픽(이하 "앱")이 제공하는 서비스의 이용 조건 및 절차, 기타 필요한 사항을 규정합니다.

제1조 (목적)

이 약관은 언니픽 서비스(이하 "서비스")의 이용과 관련하여 앱과 이용자 사이의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.


제2조 (서비스 이용 자격)

① 만 14세 이상의 개인이면 누구나 가입할 수 있습니다.
② 가입 시 본인의 정확한 정보를 입력해야 합니다.
③ 타인의 명의를 사용하거나 허위 정보를 입력한 경우, 계정이 즉시 삭제될 수 있습니다.


제3조 (서비스 내용)

앱은 다음과 같은 서비스를 제공합니다.

① 창원 지역 뷰티·식음료 가맹점 쿠폰 및 혜택 정보 제공
② 쿠폰 다운로드 및 사용
③ 가게 메뉴 가격 제보 및 조회
④ 가게 팔로우 및 알림
⑤ 회원 등급 및 포인트 적립 서비스
⑥ 기타 앱이 정하는 부가 서비스


제4조 (이용 요금)

현재 서비스의 기본 이용은 무료입니다. 단, 일부 유료 기능이 추가될 경우 사전에 고지하며, 이용자의 동의를 구합니다.


제5조 (이용자의 의무)

이용자는 다음 행위를 해서는 안 됩니다.

① 허위 정보(가격 제보 포함)를 의도적으로 입력하는 행위
② 타인의 계정을 도용하는 행위
③ 서비스 운영을 방해하거나 시스템을 해킹하는 행위
④ 욕설, 비방, 음란한 내용을 게시하는 행위
⑤ 앱의 서비스를 이용해 영리 목적의 광고를 무단 게시하는 행위
⑥ 저작권 등 지적재산권을 침해하는 행위


제6조 (쿠폰 사용 정책)

① 쿠폰은 해당 가맹점에서만 사용 가능합니다.
② 발급된 쿠폰은 유효기간 내에만 사용할 수 있습니다.
③ 쿠폰은 양도, 판매, 환불이 불가합니다.
④ 가맹점 사정에 따라 쿠폰 내용이 변경될 수 있으며, 이 경우 사전에 공지합니다.


제7조 (가격 제보 정책)

① 제보한 가격 정보는 운영자 검토 후 게시됩니다.
② 허위 제보가 확인된 경우 보상이 취소되고 계정 이용이 제한될 수 있습니다.
③ 제보된 가격은 앱 내 콘텐츠로 활용될 수 있습니다.


제8조 (포인트 및 등급 정책)

① 포인트는 앱 내 활동(쿠폰 사용, 가격 제보, 출석 등)을 통해 적립됩니다.
② 포인트는 앱 내에서만 사용 가능하며 현금으로 전환되지 않습니다.
③ 부정한 방법으로 획득한 포인트는 회수될 수 있습니다.
④ 6개월 이상 비활동 시 레벨이 강등될 수 있습니다.


제9조 (서비스 변경 및 중단)

① 앱은 서비스 내용을 변경할 수 있으며, 중요한 변경은 사전에 공지합니다.
② 천재지변, 기술적 장애 등 불가피한 사유로 서비스가 일시 중단될 수 있습니다.
③ 서비스 종료 시 최소 30일 전 공지합니다.


제10조 (책임 제한)

① 앱은 이용자가 제공한 정보의 정확성에 대해 책임지지 않습니다.
② 이용자의 귀책사유로 발생한 서비스 이용 장애에 대해 책임지지 않습니다.
③ 가맹점의 사정으로 발생한 쿠폰 사용 불가 등에 대해 앱의 책임은 제한됩니다.


제11조 (분쟁 해결)

본 약관과 관련된 분쟁은 대한민국 법을 준거법으로 하며, 창원지방법원을 전속 관할 법원으로 합니다.


제12조 (약관 변경)

앱은 약관을 변경할 수 있으며, 변경 시 최소 7일 전 앱 내 공지를 통해 고지합니다.


부칙

이 약관은 2025년 01월 01일부터 시행됩니다.`;

// ─────────────────────────────────────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
export default function LegalSheet({ visible, initTab = 'privacy', onClose }: Props) {
  const [tab, setTab] = useState<LegalTab>(initTab);
  const slideY = useRef(new Animated.Value(SH)).current;

  // initTab이 바뀔 때 탭 동기화
  useEffect(() => { setTab(initTab); }, [initTab]);

  // visible 변경 시 슬라이드 애니메이션
  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: SH,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* 딤 배경 */}
      <Pressable style={s.overlay} onPress={onClose} />

      {/* 시트 */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* 핸들 */}
        <View style={s.handle} />

        {/* 탭 바 */}
        <View style={s.tabBar}>
          {(['privacy', 'terms'] as LegalTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'privacy' ? '개인정보처리방침' : '이용약관'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 구분선 */}
        <View style={s.divider} />

        {/* 콘텐츠 */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.content}>
            {tab === 'privacy' ? PRIVACY_CONTENT : TERMS_CONTENT}
          </Text>
        </ScrollView>

        {/* 닫기 버튼 */}
        <View style={s.footer}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.closeBtnText}>확인</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const SHEET_HEIGHT = SH * 0.82;

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.gray300,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },

  // 탭 바
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: PALETTE.gray100,
  },
  tabBtnActive: {
    backgroundColor: PALETTE.orange500,
  },
  tabText: {
    fontFamily: F.semiBold,
    fontSize: 14,
    color: PALETTE.gray500,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  divider: {
    height: 1,
    backgroundColor: PALETTE.gray150,
    marginTop: 14,
    marginHorizontal: 20,
  },

  // 콘텐츠 스크롤
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  content: {
    fontFamily: F.regular,
    fontSize: 13,
    lineHeight: 22,
    color: PALETTE.gray700,
    letterSpacing: -0.1,
  },

  // 닫기 버튼
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: PALETTE.gray150,
  },
  closeBtn: {
    backgroundColor: PALETTE.orange500,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: F.bold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});

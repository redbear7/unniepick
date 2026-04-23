// TermsSheet — 약관 동의 바텀시트 (전체·이용·개인정보·마케팅)
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE } from '../../../constants/theme';
import { T, F } from '../../../constants/typography';

export interface TermsState {
  tos:       boolean;
  privacy:   boolean;
  marketing: boolean;
}

interface Props {
  onAgree: (terms: TermsState) => void;
  onClose: () => void;
}

interface TermRowProps {
  checked:  boolean;
  onChange: () => void;
  label:    string;
  required?: boolean;
  bold?:    boolean;
}

function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <View style={[cs.circle, checked && cs.circleActive]}>
      {checked && (
        <Text style={cs.checkMark}>✓</Text>
      )}
    </View>
  );
}

function TermRow({ checked, onChange, label, required, bold }: TermRowProps) {
  return (
    <TouchableOpacity onPress={onChange} style={cs.row} activeOpacity={0.7}>
      <CheckCircle checked={checked} />
      <Text style={[cs.label, bold && cs.labelBold]} numberOfLines={1}>
        {required && <Text style={cs.required}>[필수] </Text>}
        {!required && !bold && <Text style={cs.optional}>[선택] </Text>}
        {label}
      </Text>
      {!bold && <Text style={cs.arrow}>보기 ›</Text>}
    </TouchableOpacity>
  );
}

export default function TermsSheet({ onAgree, onClose }: Props) {
  const [agreed, setAgreed] = useState<TermsState & { all: boolean }>({
    all: false, tos: false, privacy: false, marketing: false,
  });
  const slideAnim = useRef(new Animated.Value(400)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(bgAnim, { toValue: 1, duration: 260, useNativeDriver: false }),
    ]).start();
  }, []);

  const toggleAll = () => {
    const v = !agreed.all;
    setAgreed({ all: v, tos: v, privacy: v, marketing: v });
  };

  const toggleOne = (key: keyof TermsState) => {
    const next = { ...agreed, [key]: !agreed[key] };
    next.all = next.tos && next.privacy && next.marketing;
    setAgreed(next);
  };

  const canAgree = agreed.tos && agreed.privacy;

  const handleAgree = () => {
    onAgree({ tos: agreed.tos, privacy: agreed.privacy, marketing: agreed.marketing });
  };

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)'],
  });

  return (
    <Animated.View style={[cs.backdrop, { backgroundColor: bgColor }]}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[cs.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Grabber */}
        <View style={cs.grabber} />

        <Text style={cs.title}>약관에 동의해주세요</Text>
        <Text style={cs.sub}>서비스 이용을 위해 아래 약관에 동의가 필요해요</Text>

        <View style={cs.box}>
          <TermRow checked={agreed.all}       onChange={toggleAll}               label="전체 동의" bold />
          <View style={cs.divider} />
          <TermRow checked={agreed.tos}       onChange={() => toggleOne('tos')}       label="이용약관 동의"          required />
          <TermRow checked={agreed.privacy}   onChange={() => toggleOne('privacy')}   label="개인정보 수집·이용 동의" required />
          <TermRow checked={agreed.marketing} onChange={() => toggleOne('marketing')} label="마케팅 알림 수신 동의" />
        </View>

        <TouchableOpacity
          style={[cs.btn, !canAgree && cs.btnDisabled]}
          onPress={handleAgree}
          disabled={!canAgree}
          activeOpacity={0.85}
        >
          <Text style={cs.btnText}>동의하고 시작하기</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const cs = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 24,
    paddingBottom: 34,
  },
  grabber: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: PALETTE.gray200,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    ...T.terms20,
    color: PALETTE.gray900,
    marginBottom: 6,
  },
  sub: {
    ...T.body13,
    color: PALETTE.gray500,
    marginBottom: 16,
  },
  box: {
    backgroundColor: PALETTE.gray100,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PALETTE.gray150,
    marginHorizontal: -14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  circle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: PALETTE.gray300,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  circleActive: {
    backgroundColor: PALETTE.orange500,
    borderColor: PALETTE.orange500,
  },
  checkMark: {
    fontSize: 12, fontWeight: '700', color: '#FFFFFF',
  },
  label: {
    flex: 1,
    ...T.terms14,
    color: PALETTE.gray900,
  },
  labelBold: { ...T.terms15, color: PALETTE.gray900 },
  required: { color: PALETTE.orange500 },
  optional: { color: PALETTE.gray500 },
  arrow: {
    fontFamily: F.medium,
    fontSize: 12,
    color: PALETTE.gray500,
  },
  btn: {
    backgroundColor: PALETTE.orange500,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PALETTE.orange500,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: PALETTE.gray200,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    ...T.btn16,
    color: '#FFFFFF',
  },
});

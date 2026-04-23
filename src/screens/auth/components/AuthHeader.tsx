// AuthHeader — 뒤로가기 버튼 + DotIndicator ●●○○
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PALETTE } from '../../../constants/theme';
import { F } from '../../../constants/typography';

interface Props {
  step: number;
  total: number;
  onBack: () => void;
  canBack?: boolean;
  rightAction?: React.ReactNode;
}

function DotIndicator({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            s.dot,
            i + 1 <= step
              ? { backgroundColor: PALETTE.orange500, width: i + 1 === step ? 22 : 7 }
              : { backgroundColor: PALETTE.gray200, width: 7 },
          ]}
        />
      ))}
    </View>
  );
}

export default function AuthHeader({ step, total, onBack, canBack = true, rightAction }: Props) {
  return (
    <View style={s.container}>
      <View style={s.row}>
        <TouchableOpacity
          onPress={onBack}
          disabled={!canBack}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[s.backChevron, !canBack && s.backChevronHidden]}>‹</Text>
        </TouchableOpacity>
        {rightAction ?? <View style={s.spacer} />}
      </View>
      <DotIndicator step={step} total={total} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingTop: 14,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backChevron: {
    fontSize: 32,
    fontFamily: F.regular,
    color: PALETTE.gray800,
    lineHeight: 36,
  },
  backChevronHidden: {
    color: 'transparent',
  },
  spacer: { width: 40 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingBottom: 6,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
});

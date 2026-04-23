// LevelProgress — 레벨 프로그레스바 + 다음 레벨까지
// 엣지: 0% → "브론즈 시작", 100% → "실버 승급 대기 중"
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PALETTE } from '../../../constants/theme';

interface Props {
  level:         string;
  levelProgress: number;  // 0–1
  pointToNext:   number;
  nextLevel:     string;
}

export default function LevelProgress({ level, levelProgress, pointToNext, nextLevel }: Props) {
  const pct     = Math.max(0, Math.min(1, levelProgress));
  const pctText = Math.round(pct * 100);

  // 엣지 케이스 텍스트 분기
  const leftText = (() => {
    if (pct >= 1)  return `${nextLevel} 승급 대기 중`;
    if (pct === 0) return `${level} 시작`;
    return `${nextLevel}까지 `;
  })();

  const showPoint = pct > 0 && pct < 1;

  return (
    <View style={s.wrap}>
      <View style={s.row}>
        <Text style={s.left}>
          {leftText}
          {showPoint && (
            <Text style={s.accent}>{pointToNext}P</Text>
          )}
        </Text>
        <Text style={s.right}>{pctText}%</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${pctText}%` as any }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 16 },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   6,
  },
  left: {
    fontFamily:    'WantedSans-Medium',
    fontSize:       12,
    fontWeight:     '500',
    color:          'rgba(255,255,255,0.75)',
    lineHeight:     14,
    letterSpacing:  -0.1,
  },
  accent: {
    fontFamily:   'WantedSans-Bold',
    fontSize:      11,
    fontWeight:    '700',
    color:         '#FFE0C0',
  },
  right: {
    fontFamily:   'WantedSans-Bold',
    fontSize:      11,
    fontWeight:    '700',
    color:         '#FFFFFF',
    lineHeight:    14,
  },
  track: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
});

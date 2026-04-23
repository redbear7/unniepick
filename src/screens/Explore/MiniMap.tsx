/**
 * MiniMap — Phase 1 SVG 플레이스홀더 지도
 *
 * - 지도 배경 격자 + 도로 라인 (SVG)
 * - 유저 위치 핀 (중앙, orange)
 * - 매장 핀 최대 4개 (고정 오프셋)
 * - 하단 pill: "📍 반경 500m · N곳"
 *
 * Phase 2: react-native-maps + MapKit 교체 예정
 */
import React from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import Svg, {
  Circle, G, Line, Path, Rect, Text as SvgText,
} from 'react-native-svg';
import { F } from '../../constants/typography';
import { PALETTE } from '../../constants/theme';
import type { ExploreStore } from './hooks/useExploreStores';

// 카드 임의 오프셋 (SVG 좌표계 기준, 중앙 기준 ±)
const STORE_OFFSETS = [
  { dx: -55, dy: -38 },
  { dx:  62, dy: -28 },
  { dx: -40, dy:  44 },
  { dx:  48, dy:  50 },
];

interface Props {
  stores:    ExploreStore[];
  storeCount: number;
}

export default function MiniMap({ stores, storeCount }: Props) {
  const W = 380; // SVG 내부 너비
  const H = 160; // SVG 내부 높이
  const CX = W / 2;
  const CY = H / 2;

  const pins = stores.slice(0, 4).map((s, i) => ({
    ...s,
    ...STORE_OFFSETS[i],
  }));

  return (
    <View style={s.wrap}>
      {/* SVG 지도 */}
      <Svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={StyleSheet.absoluteFill}
      >
        {/* 배경 */}
        <Rect x="0" y="0" width={W} height={H} fill="#E8F0E0" />

        {/* 격자 도로 */}
        {[-80, -40, 0, 40, 80].map(offset => (
          <G key={`h${offset}`}>
            <Line
              x1="0" y1={CY + offset}
              x2={W}  y2={CY + offset}
              stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"
            />
            <Line
              x1={CX + offset} y1="0"
              x2={CX + offset} y2={H}
              stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"
            />
          </G>
        ))}

        {/* 반경 원 */}
        <Circle cx={CX} cy={CY} r={60}
          fill="rgba(255,111,15,0.08)"
          stroke={PALETTE.orange300}
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        {/* 매장 핀들 */}
        {pins.map((p, i) => (
          <G key={p.id} transform={`translate(${CX + p.dx},${CY + p.dy})`}>
            <Circle r="14" fill="#FFFFFF"
              stroke={PALETTE.orange500} strokeWidth="1.5"
            />
            <SvgText
              textAnchor="middle"
              dy="5"
              fontSize="14"
            >
              {p.emoji}
            </SvgText>
          </G>
        ))}

        {/* 유저 위치 핀 (중앙) */}
        {/* 그림자 원 */}
        <Circle cx={CX} cy={CY + 1} r="12" fill="rgba(255,111,15,0.20)" />
        {/* 핀 몸통 */}
        <Path
          d={`M${CX},${CY - 20} a12,12 0 0 1 0,24 a12,12 0 0 1 0,-24 Z`}
          fill={PALETTE.orange500}
        />
        {/* 핀 꼭짓점 */}
        <Path
          d={`M${CX - 5},${CY + 4} L${CX + 5},${CY + 4} L${CX},${CY + 14} Z`}
          fill={PALETTE.orange500}
        />
        {/* 핀 중앙 흰 점 */}
        <Circle cx={CX} cy={CY - 8} r="4" fill="#FFFFFF" />
      </Svg>

      {/* 하단 pill */}
      <View style={s.pill}>
        <Text style={s.pillText}>📍 반경 500m · {storeCount}곳</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    height:          180,
    marginHorizontal: 0,
    overflow:        'hidden',
    backgroundColor: '#E8F0E0',
    position:        'relative',
    alignItems:      'center',
    justifyContent:  'flex-end',
    paddingBottom:    12,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:    7,
    borderWidth:      1,
    borderColor:     'rgba(255,111,15,0.25)',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.10,
    shadowRadius:    6,
    elevation:       4,
  },
  pillText: {
    fontFamily: F.semiBold,
    fontSize:   12,
    color:      PALETTE.gray800,
  },
});

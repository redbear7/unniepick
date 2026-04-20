/**
 * StoreAvatar — 매장 아바타 원형
 * 이름 기반 컬러 해싱 · 이모지 fallback · size sm/md/lg
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  name:   string;
  emoji?: string;
  size?:  Size;
}

const SIZE_MAP: Record<Size, number> = { sm: 32, md: 40, lg: 52 };
const FONT_MAP: Record<Size, number> = { sm: 16, md: 20, lg: 26 };

const PALETTE = [
  '#FF6F0F', '#FF3D71', '#0AC86E', '#3D8EFF',
  '#9B5DE5', '#F15BB5', '#00BBF9', '#FEE440',
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function StoreAvatar({ name, emoji, size = 'md' }: Props) {
  const dim  = SIZE_MAP[size];
  const font = FONT_MAP[size];

  return (
    <View style={[
      styles.circle,
      { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: hashColor(name) },
    ]}>
      <Text style={{ fontSize: font }}>{emoji ?? name.charAt(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
});

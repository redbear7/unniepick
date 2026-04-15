import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Mood = 'happy' | 'excited' | 'celebrate' | 'default';

interface Props {
  mood?: Mood;
  size?: number;
  message?: string;
}

const EMOJI: Record<Mood, string> = {
  happy: '🐻',
  excited: '🐻‍❄️',
  celebrate: '🎉',
  default: '🐻',
};

const MESSAGES: Record<Mood, string> = {
  happy: '오늘도 맛있겠다!',
  excited: '새 쿠폰이 왔어요!',
  celebrate: '스탬프 완성! 축하해요!',
  default: '안녕하세요!',
};

export default function PickiCharacter({ mood = 'default', size = 60, message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.emoji, { fontSize: size }]}>{EMOJI[mood]}</Text>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{message ?? MESSAGES[mood]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  emoji: {
    lineHeight: 72,
  },
  bubble: {
    backgroundColor: '#FFF0E6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#FFD93D',
  },
  bubbleText: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '600',
  },
});

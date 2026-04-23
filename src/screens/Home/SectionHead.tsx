/**
 * SectionHead — 섹션 제목 + 부제 + 우측 액션 버튼
 * 모든 홈 섹션이 공유. HomeScreens.jsx:47 포팅
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  title:    string;
  sub?:     string;
  action?:  string;
  onAction?: () => void;
}

export default function SectionHead({ title, sub, action, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.action}>{action} ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    paddingHorizontal: 20,
    paddingTop:     20,
    paddingBottom:  10,
  },
  textWrap: { flex: 1, minWidth: 0 },
  title: {
    fontFamily:   'WantedSans-ExtraBold',
    fontSize:     18,
    fontWeight:   '800',
    color:        '#191F28',
    letterSpacing: -0.4,
  },
  sub: {
    fontSize:    13,
    fontWeight:  '500',
    color:       '#6B7684',
    marginTop:   4,
    letterSpacing: -0.2,
  },
  action: {
    fontSize:    13,
    fontWeight:  '600',
    color:       '#4E5968',
    letterSpacing: -0.2,
    flexShrink:  0,
  },
});

/**
 * SignUpScreen — PhoneAuth로 리다이렉트
 *
 * 가입은 SMS 인증 전용. PhoneAuthScreen이 실제 플로우를 담당.
 */

import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';

export default function SignUpScreen() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    navigation.replace('PhoneAuth');
  }, [navigation]);

  return null;
}

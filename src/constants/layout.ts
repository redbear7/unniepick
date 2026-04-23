import { Platform } from 'react-native';

/** 커스텀 탭바 높이 (iOS notch 고려) */
export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 82 : 64;

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '../constants/layout';

/**
 * 하단 패딩 반환 (음악 기능 제거로 단순화)
 * @param isTabScreen - 탭바가 있는 화면이면 true (기본값: false)
 */
export function useMiniPlayerPadding(isTabScreen = false): number {
  const insets = useSafeAreaInsets();
  const base = isTabScreen ? TAB_BAR_HEIGHT : 0;
  return base + insets.bottom + 16;
}

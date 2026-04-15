import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMusicPlayer } from '../contexts/MusicPlayerContext';
import { MINI_PLAYER_HEIGHT } from '../components/GlobalMiniPlayer';
import { TAB_BAR_HEIGHT } from '../navigation';

/**
 * 미니 플레이어가 떠 있을 때 콘텐츠가 가리지 않도록 하단 패딩 반환
 * @param isTabScreen - 탭바가 있는 화면이면 true (기본값: false)
 */
export function useMiniPlayerPadding(isTabScreen = false): number {
  const { currentTrack } = useMusicPlayer();
  const insets = useSafeAreaInsets();

  const base = isTabScreen ? TAB_BAR_HEIGHT : 0;

  if (!currentTrack) return base + insets.bottom + 16;
  return base + MINI_PLAYER_HEIGHT + insets.bottom + 16;
}

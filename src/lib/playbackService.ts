import TrackPlayer, { Event } from 'react-native-track-player';

/**
 * RNTP 백그라운드 서비스 — 잠금화면/콘트롤센터 버튼 처리
 * index.ts 에서 TrackPlayer.registerPlaybackService(() => PlaybackService) 로 등록
 */
export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay,  () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop,  () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteSeek,  ({ position }) => TrackPlayer.seekTo(position));
}

import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/lib/playbackService';

import App from './App';

// RNTP 잠금화면/콘트롤센터 서비스 등록 (registerRootComponent 전에 호출)
TrackPlayer.registerPlaybackService(() => PlaybackService);

registerRootComponent(App);

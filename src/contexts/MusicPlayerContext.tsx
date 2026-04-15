import React, {
  createContext, useContext, useRef, useState,
  useEffect, useCallback,
} from 'react';
import TrackPlayer, {
  Capability, State,
  useProgress, usePlaybackState, useActiveTrack,
} from 'react-native-track-player';
import { MusicTrack, logListeningHistory } from '../lib/services/musicService';
import { isDucked } from '../lib/volumeDuck';
import { supabase } from '../lib/supabase';

// ─── 이모지 → Twemoji CDN 아트워크 URL ──────────────────────────
function emojiToArtworkUrl(emoji: string): string {
  if (!emoji) return '';
  try {
    const codepoints = [...emoji]
      .map(c => c.codePointAt(0)?.toString(16))
      .filter((cp): cp is string => !!cp && cp !== 'fe0f');
    if (!codepoints.length) return '';
    return `https://cdn.jsdelivr.net/npm/twemoji@14.0.2/2/72x72/${codepoints.join('-')}.png`;
  } catch { return ''; }
}

// ─── 크로스페이드 설정 ────────────────────────────────────────────
const CROSSFADE_SECS    = 3;    // 페이드아웃 시작 시점 (트랙 종료 N초 전)
const FADE_OUT_STEPS    = 90;   // 90 * 33ms ≈ 3초
const FADE_IN_STEPS     = 30;   // 30 * 33ms ≈ 1초
const FADE_INTERVAL_MS  = 33;

// ─── 타입 ────────────────────────────────────────────────────────
export interface MusicPlayerState {
  currentTrack:      MusicTrack | null;
  isPlaying:         boolean;
  progress:          number;
  elapsed:           number;
  duration:          number;
  crossfadeEnabled:  boolean;
  setCrossfadeEnabled: (v: boolean) => void;
  play:    (track: MusicTrack) => Promise<void>;
  playAll: (tracks: MusicTrack[], startIndex?: number) => Promise<void>;
  toggle:  () => Promise<void>;
  stop:    () => Promise<void>;
}

const MusicPlayerContext = createContext<MusicPlayerState | null>(null);

export function useMusicPlayer(): MusicPlayerState {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error('useMusicPlayer must be inside MusicPlayerProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────
export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [isReady,          setIsReady]          = useState(false);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(true);

  // RNTP 훅
  const { position, duration } = useProgress(200);      // 크로스페이드용 200ms 폴링
  const { state: playbackState } = usePlaybackState();
  const activeRNTPTrack = useActiveTrack();

  // 트랙 맵 & 상태 refs
  const trackMapRef      = useRef<Map<string, MusicTrack>>(new Map());
  const playbackStateRef = useRef<State | undefined>(undefined);
  const prevTrackIdRef   = useRef<string | undefined>(undefined);
  const fadeOutTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeInTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFadingOutRef   = useRef(false);

  playbackStateRef.current = playbackState as State | undefined;

  // RNTP active track → MusicTrack
  const currentTrack: MusicTrack | null =
    activeRNTPTrack ? (trackMapRef.current.get(String(activeRNTPTrack.id)) ?? null) : null;

  // ── 크로스페이드 페이드 헬퍼 ──────────────────────────────────
  function clearFadeTimers() {
    if (fadeOutTimerRef.current) { clearInterval(fadeOutTimerRef.current); fadeOutTimerRef.current = null; }
    if (fadeInTimerRef.current)  { clearInterval(fadeInTimerRef.current);  fadeInTimerRef.current = null; }
  }

  function startFadeOut() {
    if (isFadingOutRef.current) return;
    clearFadeTimers();
    isFadingOutRef.current = true;
    let vol = 1.0;
    const dec = 1 / FADE_OUT_STEPS;
    fadeOutTimerRef.current = setInterval(() => {
      vol = Math.max(0, vol - dec);
      TrackPlayer.setVolume(vol).catch(() => {});
      if (vol <= 0) { clearInterval(fadeOutTimerRef.current!); fadeOutTimerRef.current = null; }
    }, FADE_INTERVAL_MS);
  }

  function startFadeIn() {
    if (isDucked()) return;   // TTS 덕킹 중이면 페이드인 생략
    clearFadeTimers();
    isFadingOutRef.current = false;
    TrackPlayer.setVolume(0).catch(() => {});
    let vol = 0;
    const inc = 1 / FADE_IN_STEPS;
    fadeInTimerRef.current = setInterval(() => {
      vol = Math.min(1, vol + inc);
      TrackPlayer.setVolume(vol).catch(() => {});
      if (vol >= 1) { clearInterval(fadeInTimerRef.current!); fadeInTimerRef.current = null; }
    }, FADE_INTERVAL_MS);
  }

  // ── 트랙 변경 감지 → 페이드인 + 청취 기록 ───────────────────
  useEffect(() => {
    const id = activeRNTPTrack?.id as string | undefined;
    if (!id) { prevTrackIdRef.current = undefined; return; }
    if (id !== prevTrackIdRef.current) {
      const isFirst = prevTrackIdRef.current === undefined;
      prevTrackIdRef.current = id;
      if (!isFirst && crossfadeEnabled) {
        startFadeIn();
      }
      // 청취 기록 저장 (로그인된 경우에만)
      supabase.auth.getSession().then(({ data }) => {
        const userId = data.session?.user.id;
        if (userId) logListeningHistory(userId, id);
      });
    }
  }, [activeRNTPTrack?.id, crossfadeEnabled]);

  // ── 진행률 감시 → 트랙 끝에서 페이드아웃 ────────────────────
  useEffect(() => {
    if (!crossfadeEnabled || !activeRNTPTrack) return;
    const isPlaying = playbackStateRef.current === State.Playing;
    if (!isPlaying || duration < CROSSFADE_SECS * 2) return;  // 짧은 트랙 제외
    const remaining = duration - position;
    if (remaining > 0 && remaining <= CROSSFADE_SECS) {
      startFadeOut();
    }
  }, [position, duration, crossfadeEnabled, activeRNTPTrack]);

  // ── 크로스페이드 ON/OFF 전환 시 볼륨 복원 ─────────────────────
  useEffect(() => {
    if (!crossfadeEnabled) {
      clearFadeTimers();
      isFadingOutRef.current = false;
      TrackPlayer.setVolume(1).catch(() => {});
    }
  }, [crossfadeEnabled]);

  // ── TrackPlayer 초기화 (1회) ──────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
        await TrackPlayer.updateOptions({
          capabilities: [
            Capability.Play, Capability.Pause, Capability.Stop,
            Capability.SeekTo, Capability.SkipToNext, Capability.SkipToPrevious,
          ],
          compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
          progressUpdateEventInterval: 1,
        });
        if (mounted) setIsReady(true);
      } catch {
        if (mounted) setIsReady(true);
      }
    })();
    return () => {
      mounted = false;
      clearFadeTimers();
    };
  }, []);

  // ── RNTP 트랙 변환 헬퍼 ──────────────────────────────────────
  function toRNTPTrack(track: MusicTrack) {
    trackMapRef.current.set(track.id, track);
    return {
      id:       track.id,
      url:      track.audio_url,
      title:    track.title,
      artist:   track.artist,
      artwork:  emojiToArtworkUrl(track.cover_emoji),
      duration: track.duration_sec,
    };
  }

  // ── 단일 트랙 재생 ────────────────────────────────────────────
  const play = useCallback(async (track: MusicTrack) => {
    if (!isReady) return;
    const isSame  = String(activeRNTPTrack?.id) === track.id;
    const playing = playbackStateRef.current === State.Playing;
    if (isSame) {
      playing ? await TrackPlayer.pause() : await TrackPlayer.play();
      return;
    }
    clearFadeTimers();
    isFadingOutRef.current = false;
    prevTrackIdRef.current = undefined;   // 단독 재생은 페이드인 없이 시작
    await TrackPlayer.reset();
    await TrackPlayer.setVolume(1);
    await TrackPlayer.add(toRNTPTrack(track));
    await TrackPlayer.play();
  }, [isReady, activeRNTPTrack]);

  // ── 플레이리스트 전체 재생 ────────────────────────────────────
  const playAll = useCallback(async (tracks: MusicTrack[], startIndex = 0) => {
    if (!isReady || !tracks.length) return;
    clearFadeTimers();
    isFadingOutRef.current = false;
    prevTrackIdRef.current = undefined;
    await TrackPlayer.reset();
    await TrackPlayer.setVolume(1);
    await TrackPlayer.add(tracks.map(toRNTPTrack));
    if (startIndex > 0) await TrackPlayer.skip(startIndex);
    await TrackPlayer.play();
  }, [isReady]);

  // ── 토글 ─────────────────────────────────────────────────────
  const toggle = useCallback(async () => {
    if (!isReady) return;
    playbackStateRef.current === State.Playing
      ? await TrackPlayer.pause()
      : await TrackPlayer.play();
  }, [isReady]);

  // ── 정지 ─────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    if (!isReady) return;
    clearFadeTimers();
    isFadingOutRef.current = false;
    await TrackPlayer.reset();
    await TrackPlayer.setVolume(1);
  }, [isReady]);

  const isPlaying = playbackState === State.Playing || playbackState === State.Buffering;
  const progress  = duration > 0 ? position / duration : 0;

  return (
    <MusicPlayerContext.Provider value={{
      currentTrack,
      isPlaying,
      progress,
      elapsed:  Math.floor(position),
      duration: Math.floor(duration),
      crossfadeEnabled,
      setCrossfadeEnabled,
      play, playAll, toggle, stop,
    }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

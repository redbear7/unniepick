/**
 * KakaoShareWebView — 카카오 링크 공유 모달
 *
 * 사용법:
 *   import KakaoShareWebView from '@/components/KakaoShareWebView';
 *   import { buildStoreShareHtml } from '@/lib/services/kakaoShareService';
 *
 *   const [shareVisible, setShareVisible] = useState(false);
 *   ...
 *   <KakaoShareWebView
 *     visible={shareVisible}
 *     onClose={() => setShareVisible(false)}
 *     html={buildStoreShareHtml(store)}
 *   />
 */

import React, { useRef } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { PALETTE } from '../constants/theme';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  html:     string;
}

export default function KakaoShareWebView({ visible, onClose, html }: Props) {
  const wvRef = useRef<WebView>(null);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'SHARE_TRIGGERED') {
        // 공유 트리거 후 2초 뒤 자동 닫기
        setTimeout(onClose, 2000);
      }
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* 핸들 + 헤더 */}
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.headerTitle}>💬 카카오톡 공유</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* WebView */}
          <WebView
            ref={wvRef}
            style={s.webview}
            source={{ html, baseUrl: 'https://unniepick.com' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleMessage}
            // 카카오 SDK → KakaoTalk 앱 열기 허용
            onShouldStartLoadWithRequest={(req) => {
              const { url } = req;
              // kakaolink://, kakaotalk:// 등 외부 앱 링크는 RN Linking으로 처리
              if (
                !url.startsWith('http') &&
                !url.startsWith('about:') &&
                !url.startsWith('data:')
              ) {
                Linking.openURL(url).catch((e) =>
                  console.warn('[KakaoShare] openURL 실패:', url, e)
                );
                return false;
              }
              return true;
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const SHEET_HEIGHT = 380;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: PALETTE.gray200,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.gray100,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.gray900,
  },
  closeBtn: {
    padding: 4,
  },
  closeTxt: {
    fontSize: 17,
    color: PALETTE.gray500,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

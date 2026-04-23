/**
 * 카카오 링크 (공유) — WebView 기반 Kakao JS SDK 활용
 *
 * ⚠️ 카카오 개발자 콘솔 설정 필요:
 *   내 애플리케이션 → 앱 설정 → 플랫폼 → Web 플랫폼 등록
 *   - 사이트 도메인: http://localhost  (개발)
 *   - 사이트 도메인: https://unniepick.com  (프로덕션)
 *
 * 사용법:
 *   import { buildStoreShareHtml, buildCouponShareHtml } from '@/lib/services/kakaoShareService';
 *   <KakaoShareWebView visible={v} onClose={() => setV(false)} html={buildStoreShareHtml(store)} />
 */

const JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
const WEB_BASE = 'https://unniepick.com'; // 프로덕션 도메인 (딥링크 웹 fallback)

export interface ShareStore {
  id:        string;
  name:      string;
  emoji?:    string | null;
  category?: string | null;
  address?:  string | null;
  imageUrl?: string | null;
  couponCount?: number;
}

export interface ShareCoupon {
  id:           string;
  title:        string;
  discountText: string;  // "30% 할인", "5,000원 할인", "무료제공"
  storeName:    string;
  expiresAt?:   string | null;  // ISO date string
  imageUrl?:    string | null;
}

/** 가게 공유 HTML */
export function buildStoreShareHtml(store: ShareStore): string {
  const title = `${store.emoji ?? '🏪'} ${store.name}`;
  const lines: string[] = [];
  if (store.category) lines.push(store.category);
  if (store.address)  lines.push(`📍 ${store.address}`);
  if (store.couponCount) lines.push(`🎟 쿠폰 ${store.couponCount}개`);
  const description = lines.join('\n') || '언니픽에서 확인하세요!';

  return buildHtml({
    title,
    description,
    imageUrl:    store.imageUrl ?? null,
    appDeepLink: `unniepick://store/${store.id}`,
    webUrl:      `${WEB_BASE}/store/${store.id}`,
    btnLabel:    '가게 보기',
  });
}

/** 쿠폰 공유 HTML */
export function buildCouponShareHtml(coupon: ShareCoupon): string {
  const title = `🎟 ${coupon.title}`;
  const lines: string[] = [`${coupon.storeName} · ${coupon.discountText}`];
  if (coupon.expiresAt) {
    const d = new Date(coupon.expiresAt).toLocaleDateString('ko-KR', {
      month: 'long', day: 'numeric',
    });
    lines.push(`⏰ ${d}까지`);
  }

  return buildHtml({
    title,
    description: lines.join('\n'),
    imageUrl:    coupon.imageUrl ?? null,
    appDeepLink: `unniepick://coupon/${coupon.id}`,
    webUrl:      `${WEB_BASE}/coupon/${coupon.id}`,
    btnLabel:    '쿠폰 받기',
  });
}

/* ─────────────────── 내부 HTML 빌더 ─────────────────── */

interface SharePayload {
  title:       string;
  description: string;
  imageUrl:    string | null;
  appDeepLink: string;
  webUrl:      string;
  btnLabel:    string;
}

function buildHtml(p: SharePayload): string {
  // Kakao.Share.sendDefault Feed 객체 (JSON.stringify로 직렬화)
  const content: Record<string, unknown> = {
    title:       p.title,
    description: p.description,
    link: {
      mobileWebUrl: p.webUrl,
      webUrl:       p.webUrl,
    },
  };
  if (p.imageUrl) {
    content.imageUrl = p.imageUrl;
  }

  const feedObj = JSON.stringify({
    objectType: 'feed',
    content,
    buttons: [
      {
        title: p.btnLabel,
        link: {
          androidExecutionParams: `link=${encodeURIComponent(p.appDeepLink)}`,
          iosExecutionParams:     `link=${encodeURIComponent(p.appDeepLink)}`,
          mobileWebUrl:           p.webUrl,
          webUrl:                 p.webUrl,
        },
      },
    ],
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;
      background:#fff;
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      height:100vh;gap:16px;
    }
    .logo{font-size:40px;}
    .msg{font-size:14px;color:#6B7684;font-weight:500;}
    .spinner{
      width:36px;height:36px;
      border:3px solid #FEE50040;
      border-top:3px solid #FEE500;
      border-radius:50%;
      animation:spin .7s linear infinite;
    }
    @keyframes spin{to{transform:rotate(360deg);}}
    .retry{
      margin-top:4px;font-size:13px;color:#FF6F0F;
      text-decoration:underline;cursor:pointer;
    }
    .err{font-size:12px;color:#E53935;margin-top:8px;max-width:280px;text-align:center;}
  </style>
</head>
<body>
  <div class="logo">💬</div>
  <div class="spinner" id="spin"></div>
  <p class="msg" id="msg">카카오톡으로 공유 중...</p>
  <p class="retry" onclick="doShare()" id="retry" style="display:none;">다시 시도</p>
  <p class="err" id="err"></p>

  <script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
    crossorigin="anonymous"
    onload="onSdkLoad()"
    onerror="onSdkErr()"></script>
  <script>
    var feed = ${feedObj};
    var tried = false;

    function onSdkLoad() {
      try {
        if (!Kakao.isInitialized()) Kakao.init('${JS_KEY}');
        doShare();
      } catch(e) {
        showErr('초기화 오류: ' + e.message);
      }
    }

    function onSdkErr() {
      showErr('카카오 SDK 로드 실패\\n네트워크 연결을 확인해주세요.');
    }

    function doShare() {
      tried = true;
      document.getElementById('retry').style.display = 'none';
      document.getElementById('err').textContent = '';
      document.getElementById('spin').style.display = 'block';
      document.getElementById('msg').textContent = '카카오톡으로 공유 중...';
      try {
        if (!Kakao.isInitialized()) Kakao.init('${JS_KEY}');
        Kakao.Share.sendDefault(feed);
        // 공유 트리거 후 성공 메시지
        setTimeout(function() {
          document.getElementById('spin').style.display = 'none';
          document.getElementById('msg').textContent = '카카오톡이 열렸어요!';
          document.getElementById('retry').style.display = 'block';
          if (window.ReactNativeWebView)
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'SHARE_TRIGGERED'}));
        }, 600);
      } catch(e) {
        showErr(e.message || '공유 오류');
      }
    }

    function showErr(msg) {
      document.getElementById('spin').style.display = 'none';
      document.getElementById('msg').textContent = '공유에 실패했어요';
      document.getElementById('retry').style.display = 'block';
      document.getElementById('err').textContent = msg;
      if (window.ReactNativeWebView)
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'SHARE_ERROR',msg:msg}));
    }
  </script>
</body>
</html>`;
}

/**
 * 카카오맵 WebView HTML 템플릿
 * React Native WebView 에 임베드되어 양방향 메시지로 동작
 *
 * RN → WebView : injectJavaScript (window.moveMap / window.setStores / ...)
 * WebView → RN : ReactNativeWebView.postMessage (JSON)
 *
 * ⚠️ 구조 원칙
 *  - window.* 명령 함수들은 SDK와 무관하게 첫 번째 <script>에서 즉시 정의
 *  - SDK 로드는 onload/onerror 콜백으로만 처리 → 로드 실패해도 window.panMap 등 undefined 방지
 */

export function buildKakaoMapHtml(kakaoJsKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100vh; overflow:hidden; }
    #err-banner {
      display:none; position:fixed; top:0; left:0; right:0;
      background:#E53935; color:#fff; font-size:12px;
      padding:6px 12px; text-align:center; z-index:9999;
    }
    .dist-chip {
      display:flex; align-items:center; gap:4px;
      background:#FF6F0F; color:#fff;
      border-radius:20px; border:2px solid #fff;
      padding:5px 10px; cursor:pointer;
      font-size:12px; font-weight:800;
      box-shadow:0 2px 6px rgba(0,0,0,0.2);
    }
    .dist-tail {
      width:0; height:0;
      border-left:6px solid transparent; border-right:6px solid transparent;
      border-top:8px solid #FF6F0F; margin:-1px auto 0;
    }
    .my-loc {
      width:18px; height:18px; border-radius:50%;
      background:rgba(66,133,244,0.9);
      border:2px solid #fff;
      box-shadow:0 0 0 6px rgba(66,133,244,0.2);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="err-banner"></div>

  <!-- ① window.* 명령 함수 즉시 정의 (SDK 로드 성공/실패와 무관) -->
  <script>
    var map = null;
    var myLocOverlay = null;
    var storeOverlays = {};
    var distOverlays  = [];
    var selectedId    = null;
    var C = { brand:'#FF6F0F', red:'#E53935', gray:'#ADB5BD' };

    /* ── 유틸 ─────────────────────────────── */
    function send(data) {
      if (window.ReactNativeWebView)
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
    function esc(s) {
      return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function showErr(msg) {
      var b = document.getElementById('err-banner');
      b.textContent = msg; b.style.display = 'block';
      send({ type:'MAP_ERROR', message: msg });
    }

    /* ── RN → WebView 명령 (map이 null이면 조용히 무시) ─────────── */
    window.moveMap = function(lat, lng, level) {
      if (!map) return;
      map.setCenter(new kakao.maps.LatLng(lat, lng));
      if (level) map.setLevel(level);
    };

    window.panMap = function(lat, lng, level) {
      if (!map) return;
      map.panTo(new kakao.maps.LatLng(lat, lng));
      if (level) setTimeout(function(){ map.setLevel(level); }, 350);
    };

    window.setMyLocation = function(lat, lng) {
      if (!map) return;
      var pos = new kakao.maps.LatLng(lat, lng);
      if (!myLocOverlay) {
        myLocOverlay = new kakao.maps.CustomOverlay({
          position: pos,
          content: '<div class="my-loc"></div>',
          yAnchor: 0.5, zIndex: 3
        });
        myLocOverlay.setMap(map);
      } else {
        myLocOverlay.setPosition(pos);
      }
    };

    window.setDistricts = function(arr) {
      if (!map) return;
      distOverlays.forEach(function(o){ o.setMap(null); });
      distOverlays = [];
      if (!arr || !arr.length) return;
      arr.forEach(function(d) {
        if (!d.latitude || !d.longitude) return;
        var content =
          '<div onclick="onDist(\\'' + esc(d.id) + '\\')" ' +
          'style="display:flex;flex-direction:column;align-items:center;">' +
          '<div class="dist-chip">🗺 ' + esc(d.name) + '</div>' +
          '<div class="dist-tail"></div></div>';
        var ov = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(d.latitude, d.longitude),
          content: content, yAnchor: 1, zIndex: 2
        });
        ov.setMap(map);
        distOverlays.push(ov);
      });
    };

    function _setStoresImpl(arr, selId) {
      if (!map) return;
      if (selId !== undefined) selectedId = selId;
      Object.keys(storeOverlays).forEach(function(k){ storeOverlays[k].setMap(null); });
      storeOverlays = {};
      if (!arr || !arr.length) return;
      arr.forEach(function(s){ renderStore(s); });
    }

    window.setStores = function(arr, selId) {
      window.__stores = arr;
      _setStoresImpl(arr, selId);
    };

    window.setSelectedStore = function(id) {
      selectedId = id;
      Object.keys(storeOverlays).forEach(function(k){ storeOverlays[k].setMap(null); });
      storeOverlays = {};
      if (window.__stores) _setStoresImpl(window.__stores, id);
    };

    /* ── 마커 렌더 ─────────────────────────── */
    function renderStore(s) {
      var color     = s.has_timesale ? C.red : (s.coupon_count > 0 ? C.brand : C.gray);
      var isSel     = selectedId === s.id;
      var chipBg    = isSel ? color : '#fff';
      var textColor = isSel ? '#fff' : (s.coupon_count > 0 || s.has_timesale ? color : '#4E5968');
      var fw        = isSel ? '900' : '700';
      var scale     = isSel ? 'transform:scale(1.08);' : '';
      var shadow    = isSel ? '0 3px 10px rgba(0,0,0,0.28)' : '0 2px 6px rgba(0,0,0,0.18)';
      var zIndex    = isSel ? 10 : 5;

      var content =
        '<div onclick="onStore(\\'' + esc(s.id) + '\\')" ' +
        'style="display:flex;flex-direction:column;align-items:center;">' +
        '<div style="display:flex;align-items:center;gap:4px;background:' + chipBg +
          ';border-radius:20px;border:2px solid ' + color +
          ';padding:5px 10px;box-shadow:' + shadow +
          ';max-width:130px;font-family:-apple-system,sans-serif;' + scale + '">' +
        '<span style="font-size:14px;">' + esc(s.emoji) + '</span>' +
        '<span style="font-size:12px;font-weight:' + fw + ';color:' + textColor +
          ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">' +
          esc(s.label) + '</span>' +
        '</div>' +
        '<div style="width:0;height:0;border-left:5px solid transparent;' +
          'border-right:5px solid transparent;border-top:7px solid ' +
          color + ';margin-top:-1px;"></div>' +
        '</div>';

      var ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(s.latitude, s.longitude),
        content: content, yAnchor: 1, zIndex: zIndex
      });
      ov.setMap(map);
      storeOverlays[s.id] = ov;
    }

    function onStore(id) { send({ type:'MARKER_PRESS', storeId: id }); }
    function onDist(id)  { send({ type:'DISTRICT_PRESS', id: id }); }

    /* ── ② 지도 직접 초기화 (autoload 기본값 사용, kakao.maps.load() 없음) ── */
    function initKakaoMap() {
      try {
        var container = document.getElementById('map');
        map = new kakao.maps.Map(container, {
          center: new kakao.maps.LatLng(35.2340, 128.6668),
          level:  5
        });

        kakao.maps.event.addListener(map, 'idle', function() {
          var c  = map.getCenter();
          var b  = map.getBounds();
          var sw = b.getSouthWest();
          var ne = b.getNorthEast();
          send({
            type: 'REGION_CHANGE',
            lat: c.getLat(), lng: c.getLng(),
            latitudeDelta: ne.getLat() - sw.getLat(),
            longitudeDelta: ne.getLng() - sw.getLng()
          });
        });

        kakao.maps.event.addListener(map, 'click', function() {
          send({ type:'MAP_PRESS' });
        });

        send({ type:'MAP_READY' });
      } catch(e) {
        showErr('지도 초기화 실패: ' + e.message);
      }
    }
  </script>

  <!-- ③ SDK 로드 (autoload=false 제거 → 기본 autoload 사용, kakao.maps.load() 불필요) -->
  <script
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}"
    onload="initKakaoMap()"
    onerror="showErr('카카오맵 SDK 로드 실패. 네트워크 또는 앱키를 확인하세요.')">
  </script>
</body>
</html>`;
}

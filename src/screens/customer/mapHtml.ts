/**
 * 카카오맵 WebView HTML 템플릿
 * React Native WebView 에 임베드되어 양방향 메시지로 동작
 *
 * RN → WebView : injectJavaScript (window.moveMap / window.setStores / ...)
 * WebView → RN : ReactNativeWebView.postMessage (JSON)
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

    .chip {
      display:flex; align-items:center; gap:4px;
      border-radius:20px; border:2px solid;
      padding:5px 10px; cursor:pointer;
      box-shadow:0 2px 6px rgba(0,0,0,0.18);
      font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;
      max-width:130px;
    }
    .chip-label {
      font-size:12px; font-weight:700;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90px;
    }
    .chip-tail {
      width:0; height:0;
      border-left:5px solid transparent; border-right:5px solid transparent;
      border-top:7px solid; margin:-1px auto 0;
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
  <script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJsKey}&autoload=false"></script>
  <script>
    var map, myLocOverlay;
    var storeOverlays  = {};
    var distOverlays   = [];
    var selectedId     = null;
    var C = { brand:'#FF6F0F', red:'#E53935', gray:'#ADB5BD' };

    kakao.maps.load(function() {
      var container = document.getElementById('map');
      map = new kakao.maps.Map(container, {
        center: new kakao.maps.LatLng(35.2340, 128.6668),
        level:  5
      });

      /* 지도 드래그·줌 완료 → region 전달 */
      kakao.maps.event.addListener(map, 'idle', function() {
        var c  = map.getCenter();
        var b  = map.getBounds();
        var sw = b.getSouthWest();
        var ne = b.getNorthEast();
        send({ type:'REGION_CHANGE',
          lat: c.getLat(), lng: c.getLng(),
          latitudeDelta: ne.getLat() - sw.getLat(),
          longitudeDelta: ne.getLng() - sw.getLng()
        });
      });

      /* 빈 곳 클릭 → 선택 해제 */
      kakao.maps.event.addListener(map, 'click', function() {
        send({ type:'MAP_PRESS' });
      });

      send({ type:'MAP_READY' });
    });

    /* ─────────────────── 유틸 ─────────────────── */
    function send(data) {
      if (window.ReactNativeWebView)
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    /* ─────────────────── RN → WebView 명령 ─────────────────── */

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
      distOverlays.forEach(function(o){ o.setMap(null); });
      distOverlays = [];
      if (!arr || !arr.length) return;
      arr.forEach(function(d) {
        if (!d.latitude || !d.longitude) return;
        var content = '<div onclick="onDist(\\'' + esc(d.id) + '\\')" style="display:flex;flex-direction:column;align-items:center;">' +
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

    window.setStores = function(arr, selId) {
      selectedId = selId !== undefined ? selId : selectedId;
      /* 기존 오버레이 제거 */
      Object.keys(storeOverlays).forEach(function(k){
        storeOverlays[k].setMap(null);
      });
      storeOverlays = {};
      if (!arr || !arr.length) return;
      arr.forEach(function(s) {
        renderStore(s);
      });
    };

    window.setSelectedStore = function(id) {
      selectedId = id;
      Object.keys(storeOverlays).forEach(function(k){
        storeOverlays[k].setMap(null);
      });
      storeOverlays = {};
      /* 현재 stores 배열에서 다시 렌더 — window.__stores 에 캐시 */
      if (window.__stores) window.setStores(window.__stores, id);
    };

    /* stores 캐시 지원 */
    var _origSetStores = window.setStores;
    window.setStores = function(arr, selId) {
      window.__stores = arr;
      _origSetStores(arr, selId);
    };

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
        '<div onclick="onStore(\\'' + esc(s.id) + '\\')" style="display:flex;flex-direction:column;align-items:center;">' +
        '<div style="display:flex;align-items:center;gap:4px;background:' + chipBg +
          ';border-radius:20px;border:2px solid ' + color +
          ';padding:5px 10px;box-shadow:' + shadow +
          ';max-width:130px;font-family:-apple-system,sans-serif;' + scale + '">' +
        '<span style="font-size:14px;">' + esc(s.emoji) + '</span>' +
        '<span style="font-size:12px;font-weight:' + fw + ';color:' + textColor +
          ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">' +
          esc(s.label) + '</span>' +
        '</div>' +
        '<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ' +
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
  </script>
</body>
</html>`;
}

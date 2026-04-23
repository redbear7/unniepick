# Edge Functions 배포 가이드 — Spec 01

## 시크릿 등록

```bash
# trigger-geofence 전용
supabase secrets set GEOFENCE_SHARED_SECRET=<랜덤_32자_비밀>

# verify-redeem 전용
# EXPO_PUBLIC_REDEEM_SECRET (.env)와 반드시 동일한 값으로 설정
supabase secrets set REDEEM_HMAC_SECRET=unniepick-redeem-secret-v1

# (선택) 운영 환경에서는 강한 비밀 사용
# REDEEM_HMAC_SECRET=$(openssl rand -hex 32)
# supabase secrets set REDEEM_HMAC_SECRET=$REDEEM_HMAC_SECRET
# 그리고 앱 .env.production에 동일 값:
# EXPO_PUBLIC_REDEEM_SECRET=$REDEEM_HMAC_SECRET
```

## 배포

```bash
supabase functions deploy trigger-geofence
supabase functions deploy verify-redeem
```

## 로컬 테스트

```bash
supabase functions serve trigger-geofence --env-file .env.local
```

`.env.local` 예시:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEOFENCE_SHARED_SECRET=dev_secret
REDEEM_HMAC_SECRET=unniepick-redeem-secret-v1
```

## Widget App Group 설정

Xcode에서 Main Target + UPWidget Target 양쪽 모두:
1. Signing & Capabilities → `+` → App Groups
2. `group.com.unniepick.shared` 추가

## Live Activity 설정

1. Main Target Signing & Capabilities → `+` → Live Activities
2. Info.plist에 `NSSupportsLiveActivities = YES` (이미 추가됨)

## Widget Target 추가

1. Xcode → File → New → Target → Widget Extension
2. Product Name: `UPWidget`
3. Include Live Activity: NO
4. `ios/UPWidget/` 파일 2개를 새 타겟에 포함
5. Deployment Target: iOS 16.0+
6. Bundle ID: `com.bangju.unniepick.widget`

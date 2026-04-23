import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const NOTIF_KEY = (id: string) => `notif_expiry_${id}`;

const NOTIFICATION_OPT_IN_KEY = 'notification_opt_in';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

// 알림 권한 요청
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

// 알림 opt-in 저장
export async function setNotificationOptIn(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(NOTIFICATION_OPT_IN_KEY, value ? 'true' : 'false');
}

// 알림 opt-in 조회
export async function getNotificationOptIn(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(NOTIFICATION_OPT_IN_KEY);
  return val === 'true';
}

// 쿠폰 알림 발송 (즉시)
export async function sendCouponNotification(couponTitle: string, discount: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎟 새 쿠폰이 도착했어요!',
      body: `${couponTitle} - ${discount} 할인 쿠폰을 지금 바로 받으세요!`,
      data: { type: 'coupon' },
      sound: true,
    },
    trigger: null, // 즉시 발송
  });
}

// 타임세일 알림 발송 (즉시)
export async function sendTimeSaleNotification(
  storeName: string,
  discount: string,
  endsAt: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚡ ${storeName} 타임세일!`,
      body: `${discount} 할인! ${endsAt}까지만 진행돼요. 지금 바로 달려오세요!`,
      data: { type: 'timesale' },
      sound: true,
    },
    trigger: null, // 즉시 발송
  });
}

// ─── 쿠폰 만료 하루 전 예약 알림 ────────────────────────────────
// 만료일 전날 오전 10시에 로컬 알림 예약
export async function scheduleCouponExpiryReminder(
  userCouponId: string,
  couponTitle: string,
  storeName: string,
  expiresAt: string,
): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const expiryDate = new Date(expiresAt);
    // 만료 하루 전 오전 10시
    const reminderDate = new Date(expiryDate);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(10, 0, 0, 0);

    if (reminderDate <= new Date()) return; // 이미 지난 경우 스킵

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ 쿠폰 만료 하루 전이에요!',
        body: `🏪 ${storeName} "${couponTitle}" 쿠폰이 내일 만료돼요. 잊지 마세요!`,
        data: { type: 'expiry_reminder', userCouponId },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
    });

    // 나중에 취소할 수 있도록 SecureStore에 저장
    await SecureStore.setItemAsync(NOTIF_KEY(userCouponId), notifId);
  } catch { /* 알림 스케줄 실패는 무시 */ }
}

// 예약 알림 취소 (쿠폰 반납 시)
export async function cancelCouponExpiryReminder(userCouponId: string): Promise<void> {
  try {
    const notifId = await SecureStore.getItemAsync(NOTIF_KEY(userCouponId));
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId);
      await SecureStore.deleteItemAsync(NOTIF_KEY(userCouponId));
    }
  } catch { /* 무시 */ }
}

// 방문 유도 알림 (근처 매장)
export async function sendNearbyStoreNotification(storeName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `📍 ${storeName} 근처에 계시네요!`,
      body: '팔로워 전용 쿠폰이 기다리고 있어요. 지금 확인해보세요!',
      data: { type: 'nearby' },
      sound: true,
    },
    trigger: null,
  });
}

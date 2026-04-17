import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';

import { ToastProvider } from '../contexts/ToastContext';
import { navigationRef } from './navigationRef';
import { supabase, clearInvalidSession } from '../lib/supabase';

// ── 고객 화면 ──────────────────────────────────────────────────────
import HomeScreen              from '../screens/customer/HomeScreen';
import CouponDetailScreen      from '../screens/customer/CouponDetailScreen';
import MyCouponQRScreen        from '../screens/customer/MyCouponQRScreen';
import StampCardScreen         from '../screens/customer/StampCardScreen';
import ReceiptScanScreen       from '../screens/customer/ReceiptScanScreen';
import RankingScreen           from '../screens/customer/RankingScreen';
import LoginScreen             from '../screens/customer/LoginScreen';
import SignUpScreen            from '../screens/customer/SignUpScreen';
import AnnouncementBoardScreen from '../screens/customer/AnnouncementBoardScreen';
import StoreHomeScreen         from '../screens/customer/StoreHomeScreen';
import WalletScreen            from '../screens/customer/WalletScreen';
import StoreCheckinScreen      from '../screens/customer/StoreCheckinScreen';
import SpinWheelScreen         from '../screens/customer/SpinWheelScreen';
import MapScreen               from '../screens/customer/MapScreen';
import NearbyFeedScreen        from '../screens/customer/NearbyFeedScreen';
import StoreFeedScreen         from '../screens/customer/StoreFeedScreen';

// ── 인증 화면 ──────────────────────────────────────────────────────
import PhoneAuthScreen         from '../screens/auth/PhoneAuthScreen';

// ── 사장님 화면 ────────────────────────────────────────────────────
import OwnerLoginScreen        from '../screens/owner/OwnerLoginScreen';
import OwnerDashboardScreen    from '../screens/owner/OwnerDashboardScreen';
import CouponCreateScreen      from '../screens/owner/CouponCreateScreen';
import CouponManageScreen      from '../screens/owner/CouponManageScreen';
import QRScannerScreen         from '../screens/owner/QRScannerScreen';
import StoreApplyScreen        from '../screens/owner/StoreApplyScreen';
import StoreQRScreen           from '../screens/owner/StoreQRScreen';

// ── 최고관리자 화면 ────────────────────────────────────────────────
import SuperAdminLoginScreen        from '../screens/superadmin/SuperAdminLoginScreen';
import SuperAdminDashboardScreen    from '../screens/superadmin/SuperAdminDashboardScreen';
import SuperAdminCouponCreateScreen from '../screens/superadmin/SuperAdminCouponCreateScreen';
import SuperAdminPlaylistScreen     from '../screens/superadmin/SuperAdminPlaylistScreen';

const RootStack = createNativeStackNavigator();
const Tab       = createBottomTabNavigator();

export const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 82 : 64;

const ACTIVE   = '#FF6F0F';  // 활성: 오렌지
const INACTIVE = '#ADB5BD';  // 비활성: 회색

// ── 탭 아이콘 (이모지) ────────────────────────────────────────────
function TabIcon({ emoji, active }: { emoji: string; active: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: active ? 1 : 0.5 }}>{emoji}</Text>
  );
}

// ── 하단 탭 ───────────────────────────────────────────────────────
function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth:  StyleSheet.hairlineWidth,
          borderTopColor:  '#E5E8EB',
          height: TAB_BAR_HEIGHT,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen}
        options={{
          tabBarLabel: '홈',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" active={focused} />,
        }} />
      <Tab.Screen name="NearbyFeed" component={NearbyFeedScreen}
        options={{
          tabBarLabel: '탐색',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" active={focused} />,
        }} />
      <Tab.Screen name="Wallet" component={WalletScreen}
        options={{
          tabBarLabel: '쿠폰함',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎟" active={focused} />,
        }} />
    </Tab.Navigator>
  );
}

// ══════════════════════════════════════════════════════════════════
//  루트 내비게이션
//
//  단일 스택으로 구성 — initialRouteName 으로 로그인/비로그인 분기
//  로그아웃 시: onAuthStateChange → navigationRef.reset → PhoneAuth
// ══════════════════════════════════════════════════════════════════
export default function Navigation() {
  const [authLoading,  setAuthLoading]  = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('PhoneAuth');
  const notifResponseRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // 초기 세션 확인 — Refresh Token 만료 시 자동 정리
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error?.message?.includes('Refresh Token')) {
        await clearInvalidSession();
        setInitialRoute('PhoneAuth');
      } else {
        setInitialRoute(data.session ? 'CustomerTabs' : 'PhoneAuth');
      }
      setAuthLoading(false);
    });

    // 로그인/로그아웃 이벤트
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: 'PhoneAuth' }] });
        }
      }
    });

    // ── 푸시 알림 탭 핸들러 ────────────────────────────────────────
    notifResponseRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (!navigationRef.isReady()) return;

      switch (data?.type) {
        // 가게 등록 승인 → 사장님 로그인 화면으로 이동
        case 'store_approved':
          navigationRef.navigate('OwnerLogin' as never);
          break;
        // 슈퍼어드민 공지 → 홈
        case 'superadmin':
          navigationRef.navigate('CustomerTabs' as never);
          break;
        // 쿠폰/타임세일 → 쿠폰함
        case 'owner':
        case 'coupon':
          navigationRef.navigate('CustomerTabs' as never);
          break;
        default:
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
      notifResponseRef.current?.remove();
    };
  }, []);

  // ── 인증 확인 중 — 오렌지 스플래시 ──────────────────────────────
  if (authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6F0F' }}>
        <Text style={{ fontSize: 52, marginBottom: 20 }}>🎟</Text>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  return (
    <ToastProvider>
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          {/* ── 인증 ─────────────────────────────────────────────── */}
          <RootStack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
          <RootStack.Screen name="Login"     component={LoginScreen} />
          <RootStack.Screen name="SignUp"    component={SignUpScreen} />

          {/* ── 고객 (탭 + 서브) ──────────────────────────────────── */}
          <RootStack.Screen name="CustomerTabs"      component={CustomerTabs} />
          <RootStack.Screen name="CouponDetail"      component={CouponDetailScreen} />
          <RootStack.Screen name="MyCouponQR"        component={MyCouponQRScreen} />
          <RootStack.Screen name="StoreHome"         component={StoreHomeScreen} />
          <RootStack.Screen name="StoreFeed"         component={StoreFeedScreen} options={{ headerShown: false }} />
          <RootStack.Screen name="StampCard"         component={StampCardScreen} />
          <RootStack.Screen name="StoreCheckin"      component={StoreCheckinScreen} />
          <RootStack.Screen name="SpinWheel"         component={SpinWheelScreen} />
          <RootStack.Screen name="ReceiptScan"       component={ReceiptScanScreen} />
          <RootStack.Screen name="Ranking"           component={RankingScreen} />
          <RootStack.Screen name="AnnouncementBoard" component={AnnouncementBoardScreen} />
          <RootStack.Screen name="Map"               component={MapScreen} />

          {/* ── 사장님 ────────────────────────────────────────────── */}
          <RootStack.Screen name="OwnerLogin"     component={OwnerLoginScreen} />
          <RootStack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
          <RootStack.Screen name="CouponCreate"   component={CouponCreateScreen} />
          <RootStack.Screen name="CouponManage"   component={CouponManageScreen} />
          <RootStack.Screen name="QRScanner"      component={QRScannerScreen} />
          <RootStack.Screen name="StoreApply"     component={StoreApplyScreen} />
          <RootStack.Screen name="StoreQR"        component={StoreQRScreen} />

          {/* ── 최고관리자 ────────────────────────────────────────── */}
          <RootStack.Screen name="SuperAdminLogin"        component={SuperAdminLoginScreen} />
          <RootStack.Screen name="SuperAdminDashboard"    component={SuperAdminDashboardScreen} />
          <RootStack.Screen name="SuperAdminCouponCreate" component={SuperAdminCouponCreateScreen} />
          <RootStack.Screen name="SuperAdminPlaylist"     component={SuperAdminPlaylistScreen} options={{ headerShown: false }} />
        </RootStack.Navigator>
      </NavigationContainer>
    </ToastProvider>
  );
}

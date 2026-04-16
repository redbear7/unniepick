import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import { ToastProvider } from '../contexts/ToastContext';
import { navigationRef } from './navigationRef';
import { supabase } from '../lib/supabase';

// ── 고객 화면 ──────────────────────────────────────────────────────
import HomeScreen              from '../screens/customer/HomeScreen';
import CouponDetailScreen      from '../screens/customer/CouponDetailScreen';
import MyCouponQRScreen        from '../screens/customer/MyCouponQRScreen';
import StampCardScreen         from '../screens/customer/StampCardScreen';
import MapScreen               from '../screens/customer/MapScreen';
import ReceiptScanScreen       from '../screens/customer/ReceiptScanScreen';
import RankingScreen           from '../screens/customer/RankingScreen';
import LoginScreen             from '../screens/customer/LoginScreen';
import SignUpScreen            from '../screens/customer/SignUpScreen';
import AnnouncementBoardScreen from '../screens/customer/AnnouncementBoardScreen';
import StoreHomeScreen         from '../screens/customer/StoreHomeScreen';
import WalletScreen            from '../screens/customer/WalletScreen';
import StoreCheckinScreen      from '../screens/customer/StoreCheckinScreen';
import SpinWheelScreen         from '../screens/customer/SpinWheelScreen';
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

const ACTIVE   = '#191F28';  // 활성: 진한 차콜 (당근마켓식)
const INACTIVE = '#ADB5BD';  // 비활성: 회색

// ── 탭 아이콘 모음 ────────────────────────────────────────────────
function IconHome({ color }: { color: string }) {
  const filled = color === ACTIVE;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <Path
          d="M10.55 2.533a2 2 0 0 1 2.9 0l7 7.467A2 2 0 0 1 21 11.467V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8.533a2 2 0 0 1 .55-1.387l7-7.467Z"
          fill={color}
        />
      ) : (
        <Path
          d="M10.55 2.533a2 2 0 0 1 2.9 0l7 7.467A2 2 0 0 1 21 11.467V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8.533a2 2 0 0 1 .55-1.387l7-7.467Z"
          stroke={color} strokeWidth={1.7} fill="none"
        />
      )}
      <Path d="M9 22v-6h6v6" stroke={filled ? '#fff' : color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function IconSearch({ color }: { color: string }) {
  const filled = color === ACTIVE;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7.5}
        fill={filled ? color : 'none'}
        stroke={color} strokeWidth={filled ? 0 : 1.7}
      />
      {filled && <Circle cx={11} cy={11} r={5} fill="#fff" />}
      <Path d="M17 17l3.5 3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconCoupon({ color }: { color: string }) {
  const filled = color === ACTIVE;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 9a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v1.5a1.5 1.5 0 0 0 0 3V15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1.5a1.5 1.5 0 0 0 0-3V9Z"
        fill={filled ? color : 'none'}
        stroke={color} strokeWidth={filled ? 0 : 1.7}
      />
      {filled
        ? <Path d="M8 8v8M8 12h8" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
        : <Path d="M8 8v8M8 12h8" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      }
    </Svg>
  );
}

function IconMap({ color }: { color: string }) {
  const filled = color === ACTIVE;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"
        fill={filled ? color : 'none'}
        stroke={color} strokeWidth={filled ? 0 : 1.7}
      />
      <Circle cx={12} cy={9} r={2.5}
        fill={filled ? '#fff' : 'none'}
        stroke={filled ? 'none' : color} strokeWidth={1.7}
      />
    </Svg>
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
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen}
        options={{ tabBarLabel: '홈', tabBarIcon: ({ color }) => <IconHome color={color} /> }} />
      <Tab.Screen name="NearbyFeed" component={NearbyFeedScreen}
        options={{ tabBarLabel: '탐색', tabBarIcon: ({ color }) => <IconSearch color={color} /> }} />
      <Tab.Screen name="Wallet" component={WalletScreen}
        options={{ tabBarLabel: '쿠폰함', tabBarIcon: ({ color }) => <IconCoupon color={color} /> }} />
      <Tab.Screen name="Map" component={MapScreen}
        options={{ tabBarLabel: '지도', tabBarIcon: ({ color }) => <IconMap color={color} /> }} />
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

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data }) => {
      setInitialRoute(data.session ? 'CustomerTabs' : 'PhoneAuth');
      setAuthLoading(false);
    });

    // 로그인/로그아웃 이벤트
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // 로그아웃 → PhoneAuth 로 스택 리셋
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: 'PhoneAuth' }] });
        }
      }
    });

    return () => subscription.unsubscribe();
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

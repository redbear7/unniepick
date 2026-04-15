import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { COLORS } from '../constants/theme';
import { ToastProvider } from '../contexts/ToastContext';
import { MusicPlayerProvider } from '../contexts/MusicPlayerContext';
import GlobalMiniPlayer, { MINI_PLAYER_HEIGHT } from '../components/GlobalMiniPlayer';
import { navigationRef } from './navigationRef';

// Customer Screens
import HomeScreen from '../screens/customer/HomeScreen';
import CouponListScreen from '../screens/customer/CouponListScreen';
import CouponDetailScreen from '../screens/customer/CouponDetailScreen';
import MyCouponQRScreen from '../screens/customer/MyCouponQRScreen';
import StampCardScreen from '../screens/customer/StampCardScreen';
import MyPageScreen from '../screens/customer/MyPageScreen';
import MapScreen from '../screens/customer/MapScreen';
import ReceiptScanScreen from '../screens/customer/ReceiptScanScreen';
import RankingScreen from '../screens/customer/RankingScreen';
import LoginScreen from '../screens/customer/LoginScreen';
import SignUpScreen from '../screens/customer/SignUpScreen';
import AnnouncementBoardScreen from '../screens/customer/AnnouncementBoardScreen';
import InterestScreen from '../screens/customer/InterestScreen';
import MusicScreen from '../screens/customer/MusicScreen';
import PlaylistDetailScreen from '../screens/customer/PlaylistDetailScreen';
import StoreHomeScreen from '../screens/customer/StoreHomeScreen';
import WalletScreen from '../screens/customer/WalletScreen';
import StoreCheckinScreen from '../screens/customer/StoreCheckinScreen';
import SpinWheelScreen from '../screens/customer/SpinWheelScreen';

// Owner Screens
import OwnerLoginScreen from '../screens/owner/OwnerLoginScreen';
import OwnerDashboardScreen from '../screens/owner/OwnerDashboardScreen';
import CouponCreateScreen from '../screens/owner/CouponCreateScreen';
import CouponManageScreen from '../screens/owner/CouponManageScreen';
import QRScannerScreen from '../screens/owner/QRScannerScreen';
import StoreApplyScreen from '../screens/owner/StoreApplyScreen';
import StoreQRScreen from '../screens/owner/StoreQRScreen';
import OwnerMusicScreen from '../screens/owner/OwnerMusicScreen';

// Super Admin Screens
import SuperAdminLoginScreen from '../screens/superadmin/SuperAdminLoginScreen';
import SuperAdminDashboardScreen from '../screens/superadmin/SuperAdminDashboardScreen';
import SuperAdminCouponCreateScreen from '../screens/superadmin/SuperAdminCouponCreateScreen';
import SuperAdminPlaylistScreen from '../screens/superadmin/SuperAdminPlaylistScreen';
import MusicTasteScreen from '../screens/customer/MusicTasteScreen';
import StoreFeedScreen from '../screens/customer/StoreFeedScreen';
import NearbyFeedScreen from '../screens/customer/NearbyFeedScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── 탭바 높이 (미니플레이어가 탭바 바로 위에 위치)
export const TAB_BAR_HEIGHT = 64;

function CustomerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          paddingBottom: 8,
          paddingTop: 4,
          height: TAB_BAR_HEIGHT,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: '홈', tabBarIcon: () => <Text style={{ fontSize: 22 }}>🏠</Text> }}
      />
      <Tab.Screen
        name="NearbyFeed"
        component={NearbyFeedScreen}
        options={{ tabBarLabel: '주변', tabBarIcon: () => <Text style={{ fontSize: 22 }}>💬</Text> }}
      />
      <Tab.Screen
        name="CouponList"
        component={CouponListScreen}
        options={{ tabBarLabel: '쿠폰', tabBarIcon: () => <Text style={{ fontSize: 22 }}>🎟</Text> }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarLabel: '지도', tabBarIcon: () => <Text style={{ fontSize: 22 }}>📍</Text> }}
      />
      <Tab.Screen
        name="Music"
        component={MusicScreen}
        options={{ tabBarLabel: '뮤직', tabBarIcon: () => <Text style={{ fontSize: 22 }}>🎵</Text> }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageScreen}
        options={{ tabBarLabel: '마이', tabBarIcon: () => <Text style={{ fontSize: 22 }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  return (
    <MusicPlayerProvider>
      <ToastProvider>
        {/* flex:1 래퍼 — GlobalMiniPlayer의 absolute 기준점 */}
        <View style={{ flex: 1 }}>
          <NavigationContainer ref={navigationRef}>
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
              {/* 고객 화면 */}
              <RootStack.Screen name="CustomerTabs" component={CustomerTabs} />
              <RootStack.Screen name="CouponDetail" component={CouponDetailScreen} />
              <RootStack.Screen name="MyCouponQR" component={MyCouponQRScreen} />

              {/* 인증 */}
              <RootStack.Screen name="Login" component={LoginScreen} />
              <RootStack.Screen name="SignUp" component={SignUpScreen} />

              {/* 영수증 인증 + 랭킹 */}
              <RootStack.Screen name="ReceiptScan" component={ReceiptScanScreen} />
              <RootStack.Screen name="Ranking" component={RankingScreen} />

              {/* 공지 게시판 */}
              <RootStack.Screen name="AnnouncementBoard" component={AnnouncementBoardScreen} />

              {/* 가게 미니 홈피 + 스탬프 카드 */}
              <RootStack.Screen name="StoreHome" component={StoreHomeScreen} />
              <RootStack.Screen name="StampCard" component={StampCardScreen} />

              {/* 플레이리스트 상세 */}
              <RootStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />

              {/* 지갑 · 체크인 · 미니게임 */}
              <RootStack.Screen name="Wallet"       component={WalletScreen} />
              <RootStack.Screen name="StoreCheckin" component={StoreCheckinScreen} />
              <RootStack.Screen name="SpinWheel"    component={SpinWheelScreen} />

              {/* 사장님 화면 */}
              <RootStack.Screen name="OwnerLogin" component={OwnerLoginScreen} />
              <RootStack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
              <RootStack.Screen name="CouponCreate" component={CouponCreateScreen} />
              <RootStack.Screen name="CouponManage" component={CouponManageScreen} />
              <RootStack.Screen name="QRScanner" component={QRScannerScreen} />
              <RootStack.Screen name="StoreApply" component={StoreApplyScreen} />
              <RootStack.Screen name="StoreQR"    component={StoreQRScreen} />
              <RootStack.Screen name="OwnerMusic" component={OwnerMusicScreen} />

              {/* 최고관리자 화면 */}
              <RootStack.Screen name="SuperAdminLogin" component={SuperAdminLoginScreen} />
              <RootStack.Screen name="SuperAdminDashboard" component={SuperAdminDashboardScreen} />
              <RootStack.Screen name="SuperAdminCouponCreate" component={SuperAdminCouponCreateScreen} />
              <RootStack.Screen name="SuperAdminPlaylist" component={SuperAdminPlaylistScreen} options={{ headerShown: false }} />
              <RootStack.Screen name="MusicTaste" component={MusicTasteScreen} options={{ headerShown: false }} />

              {/* 가게 공지 피드 (모크업 v3 ② 공지피드) */}
              <RootStack.Screen name="StoreFeed" component={StoreFeedScreen} options={{ headerShown: false }} />

              {/* 위치 기반 채팅 목록은 탭으로 등록됨 — 추가 스택 진입은 없음 */}
            </RootStack.Navigator>
          </NavigationContainer>

          {/* 전역 미니 플레이어 — 모든 화면 위에 절대 위치 */}
          <GlobalMiniPlayer />
        </View>
      </ToastProvider>
    </MusicPlayerProvider>
  );
}

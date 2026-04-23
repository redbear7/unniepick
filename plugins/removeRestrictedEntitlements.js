const { withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * 무료 Apple 개발자 계정으로 빌드할 때
 * Sign In with Apple, Push Notifications entitlements 제거
 * (유료 계정 전환 시 이 플러그인 제거)
 */
module.exports = function withRemoveRestrictedEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['com.apple.developer.applesignin'];
    delete config.modResults['aps-environment'];
    return config;
  });
};

import React, { useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMGlobal from '../CMGlobal';
import CMProfileImage from './CMProfileImage';

const menuItems = [
  { label: 'Recruit Players', route: CMConstants.screenName.recruitPlayers, icon: 'person-add-outline', type: 'stack' },
  { label: 'My Players', route: CMConstants.screenName.myPlayers, icon: 'people-outline', type: 'stack' },
  { label: 'Player Invites', route: CMConstants.screenName.playerInvites, icon: 'paper-plane-outline', type: 'stack' },
  { label: 'Player Claims', route: CMConstants.screenName.playerClaims, icon: 'checkbox-outline', type: 'stack' },
  { label: 'Home', route: 'Home', icon: 'home-outline', type: 'tab' },
  { label: 'Matches', route: 'Matches', icon: 'document-text-outline', type: 'tab' },
  { label: 'League', route: 'League', icon: 'basketball-outline', type: 'tab' },
  { label: 'Settings', route: 'Settings', icon: 'settings-outline', type: 'tab' },
];

const CMHamburgerMenu = ({ navigation, themeMode, currentRoute }: any) => {
  const [visible, setVisible] = useState(false);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;

  const colors = useMemo(
    () => ({
      border: CMConstants.color.green,
      icon: CMConstants.color.green,
      text: isDarkMode ? CMConstants.color.white : CMConstants.color.black,
      subtitle: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey,
      modalBackground: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white,
      overlay: 'rgba(0,0,0,0.28)',
      divider: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1,
      activeBackground: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey2,
    }),
    [isDarkMode],
  );

  const globalUser = CMGlobal?.user || {};
  const userName = globalUser?.name || 'CHMPST User';
  const userRole = globalUser?.role === 'admin' ? 'Administrator' : 'Coach';
  const userAvatar = globalUser?.avatar;

  const closeAndRun = (action: () => void) => {
    setVisible(false);
    requestAnimationFrame(() => {
      setTimeout(action, 140);
    });
  };

  const navigateTo = (item: any) => {
    if (item.route === currentRoute) {
      setVisible(false);
      return;
    }

    closeAndRun(() => {
      if (item.type === 'tab') {
        if (typeof navigation?.jumpTo === 'function') {
          navigation.jumpTo(item.route);
          return;
        }
        navigation.navigate(item.route);
        return;
      }

      const parentNavigation = navigation?.getParent?.();
      if (parentNavigation?.navigate) {
        parentNavigation.navigate(item.route);
        return;
      }
      navigation.navigate(item.route);
    });
  };

  return (
    <>
      <TouchableOpacity
        style={{
          ...CMCommonStyles.circle(CMConstants.height.iconBigEx),
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: colors.border,
        }}
        activeOpacity={0.8}
        onPress={() => setVisible(true)}
      >
        <Ionicons
          name="menu-outline"
          size={CMConstants.height.icon}
          color={colors.icon}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              backgroundColor: colors.overlay,
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  width: 260,
                  height: '100%',
                  backgroundColor: colors.modalBackground,
                  borderRightWidth: 1,
                  borderRightColor: colors.divider,
                  paddingTop: 56,
                  paddingHorizontal: CMConstants.space.normal,
                  paddingBottom: CMConstants.space.normal,
                }}
              >
                <View
                  style={{
                    paddingBottom: CMConstants.space.normal,
                    marginBottom: CMConstants.space.small,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CMProfileImage radius={44} imgURL={userAvatar} isUser />
                    <View style={{ marginLeft: CMConstants.space.smallEx, flex: 1 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: CMConstants.fontSize.normal,
                          fontWeight: '700',
                        }}
                        numberOfLines={1}
                      >
                        {userName}
                      </Text>
                      <Text
                        style={{
                          color: colors.subtitle,
                          fontSize: CMConstants.fontSize.smallEx,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {userRole}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      closeAndRun(() => {
                        const parentNavigation = navigation?.getParent?.();
                        if (parentNavigation?.navigate) {
                          parentNavigation.navigate(CMConstants.screenName.editProfile, { user: globalUser });
                          return;
                        }
                        navigation.navigate(CMConstants.screenName.editProfile, { user: globalUser });
                      });
                    }}
                    style={{
                      marginTop: CMConstants.space.small,
                      borderWidth: 1,
                      borderColor: colors.divider,
                      borderRadius: CMConstants.radius.small,
                      paddingVertical: CMConstants.space.smallEx - 2,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: CMConstants.fontSize.small,
                        fontWeight: '600',
                      }}
                    >
                      View Profile
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  {menuItems.map((item) => {
                    const isActive = item.route === currentRoute;
                    return (
                      <TouchableOpacity
                        key={item.route}
                        activeOpacity={0.85}
                        onPress={() => navigateTo(item)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: CMConstants.space.small,
                          paddingVertical: CMConstants.space.smallEx + 4,
                          marginBottom: CMConstants.space.smallEx,
                          borderRadius: CMConstants.radius.small,
                          backgroundColor: isActive ? colors.activeBackground : 'transparent',
                          borderWidth: isActive ? 1 : 0,
                          borderColor: isActive ? CMConstants.color.green : 'transparent',
                        }}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={18}
                          color={isActive ? CMConstants.color.green : colors.text}
                          style={{ marginRight: CMConstants.space.smallEx }}
                        />
                        <Text
                          style={{
                            color: isActive ? CMConstants.color.green : colors.text,
                            fontSize: CMConstants.fontSize.normal,
                            fontWeight: isActive ? '700' : '500',
                          }}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View
                  style={{
                    paddingTop: CMConstants.space.small,
                    borderTopWidth: 1,
                    borderTopColor: colors.divider,
                  }}
                >
                  <Text
                    style={{
                      color: colors.subtitle,
                      fontSize: CMConstants.fontSize.smallEx,
                      textAlign: 'center',
                    }}
                  >
                    CHMPST
                  </Text>
                </View>
              </View>
            </TouchableWithoutFeedback>

            <View style={{ flex: 1 }} />
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

export default CMHamburgerMenu;

import { createStackNavigator } from '@react-navigation/stack';
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMConstants from '../CMConstants';
import CMMainScreen from '../screens/CMMainScreen';
import CMNavigationStyle from './CMNavigationStyle';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMRipple from '../components/CMRipple';
import CMEditProfileScreen from '../screens/CMEditProfileScreen';
import CMEditTeamScreen from '../screens/CMEditTeamScreen';
import CMEditLeagueScreen from '../screens/CMEditLeagueScreen';
import CMLeagueSettingsScreen from '../screens/CMLeagueSettingsScreen';
import CMSeasonHistoryScreen from '../screens/CMSeasonHistoryScreen';
import CMSeasonScheduleScreen from '../screens/CMSeasonScheduleScreen';
import CMGenerateScheduleScreen from '../screens/CMGenerateScheduleScreen';
import CMEditMatchScreen from '../screens/CMEditMatchScreen';
import CMChangePwdScreen from '../screens/CMChangePwdScreen';
import CMLeagueDetailsScreen from '../screens/CMLeagueDetailsScreen';
import CMPlayersScreen from '../screens/CMPlayersScreen';
import CMPlayerDetailsScreen from '../screens/CMPlayerDetailsScreen';
import CMPlayersOfTeamScreen from '../screens/CMPlayersOfTeamScreen';
import CMEditPlayerScreen from '../screens/CMEditPlayerScreen';
import CMEditPlayerStatsScreen from '../screens/CMEditPlayerStatsScreen';
import CMEditEventScreen from '../screens/CMEditEventScreen';
import CMMatchPlayersStatsScreen from '../screens/CMMatchPlayersStatsScreen';
import CMScoreboardScreen from '../screens/CMScoreboardScreen';
import CMNewsDetailScreen from '../screens/CMNewsDetailScreen';
import CMTeamManagementScreen from '../screens/CMTeamManagement';
import CMTeamManagementTabScreen from '../screens/CMTeamManagementTabScreen';
import CMAllTopPlayersScreen from '../screens/CMAllTopPlayersScreen';
import CMRecruitPlayersScreen from '../screens/CMRecruitPlayersScreen';
import CMMyPlayersScreen from '../screens/CMMyPlayersScreen';
import CMPlayerInvitesScreen from '../screens/CMPlayerInvitesScreen';
import CMPlayerClaimsScreen from '../screens/CMPlayerClaimsScreen';
import CMPlayoffBracketScreen from '../screens/CMPlayoffBracketScreen';
import CMPlayoffScheduleScreen from '../screens/CMPlayoffScheduleScreen';
import CMSeasonCompleteScreen from '../screens/CMSeasonCompleteScreen';
import CMPaywallScreen from '../screens/CMPaywallScreen';
import CMGlobal from '../CMGlobal';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import { canEditLeague } from '../helper/CMPermissionHelper';

const Stack = createStackNavigator();

const CMCoachStackNavigatorRoutes = (props: any) => {
  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const navigation = useNavigation();
  
  useEffect(() => {
    // Update theme when navigation state changes
    const unsubscribe = navigation.addListener('state', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
    });
    return unsubscribe;
  }, [navigation]);
  
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;

  return (
    <Stack.Navigator initialRouteName={CMConstants.screenName.main}>
      <Stack.Screen
        name={CMConstants.screenName.main}
        component={CMMainScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Main',
          headerBackTitle: '',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.editProfile}
        component={CMEditProfileScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Edit Profile',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.changePwd}
        component={CMChangePwdScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Change Password',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.editTeam}
        component={CMEditTeamScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Edit Team',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.editLeague}
        component={CMEditLeagueScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Edit League',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.leagueSettings}
        component={CMLeagueSettingsScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Commissioner Settings',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.seasonHistory}
        component={CMSeasonHistoryScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Season History',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.seasonSchedule}
        component={CMSeasonScheduleScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Season Schedule',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.generateSchedule}
        component={CMGenerateScheduleScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Generate Schedule',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.playoffBracket}
        component={CMPlayoffBracketScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Playoff Bracket',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.playoffSchedule}
        component={CMPlayoffScheduleScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Playoff Schedule',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.seasonComplete}
        component={CMSeasonCompleteScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Season Complete',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.leagueDetails}
        component={CMLeagueDetailsScreen}
        options={({ navigation, route }) => {
          // Check if user can edit the league (is the creator/admin)
          const league = route.params && 'league' in route.params ? (route.params.league as { [name: string]: any }) : null;
          // Get user ID - works for both regular Firebase auth and Apple Sign In
          const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
          const isAdmin = CMGlobal.user?.role === 'admin';
          const isLeagueAdmin = isAdmin || (league && currentUserId && league.adminId && league.adminId === currentUserId);

          return {
            ...CMNavigationStyle.header(themeMode),
            title: 'League',
            headerBackTitle: '',
            headerShown: true,
            headerTitleContainerStyle: {
              paddingRight: 0,
              marginRight: 0,
              marginLeft: -CMConstants.space.smallEx,
            },
            headerRight: () => {
              // Only show buttons if user is the league creator/admin
              if (!isLeagueAdmin) {
                return null;
              }

              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: CMConstants.space.smallEx }}>
                  {/* Add Match Button */}
                  <CMRipple
                    containerStyle={{
                      ...CMCommonStyles.circle(CMConstants.height.iconBig),
                      marginRight: CMConstants.space.smallEx - 4,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      if (route.params && 'league' in route.params) {
                        navigation.navigate(CMConstants.screenName.editMatch, {
                          isEdit: false,
                          league: route.params.league,
                        });
                      }
                    }}
                  >
                    <Ionicons
                      name="add-outline"
                      size={CMConstants.height.iconBig}
                      color={headerTextColor}
                    />
                  </CMRipple>
                  {/* Settings Button */}
                  <CMRipple
                    containerStyle={{
                      ...CMCommonStyles.circle(CMConstants.height.iconBig),
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      if (route.params && 'league' in route.params) {
                        navigation.navigate(CMConstants.screenName.leagueSettings, {
                          league: route.params.league,
                        });
                      }
                    }}
                  >
                    <Ionicons
                      name="settings-outline"
                      size={CMConstants.height.iconBig}
                      color={headerTextColor}
                    />
                  </CMRipple>
                </View>
              );
            },
          };
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.players}
        component={CMPlayersScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Players',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.playerDetails}
        component={CMPlayerDetailsScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Player Details',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="AllTopPlayers"
        component={CMAllTopPlayersScreen}
        options={({ navigation }) => {
          // Get current theme when screen is focused
          const currentTheme = CMGlobal.themeMode || CMConstants.themeMode.light;
          const isDark = currentTheme === CMConstants.themeMode.dark;
          return {
            headerStyle: {
              backgroundColor: isDark ? CMConstants.color.darkGrey : CMConstants.color.white,
            },
            headerTintColor: isDark ? CMConstants.color.white : CMConstants.color.black,
            headerTitleStyle: {
              color: isDark ? CMConstants.color.white : CMConstants.color.black,
              fontSize: CMConstants.fontSize.largeEx,
              fontWeight: 'bold',
            },
            title: 'All Top Players',
            headerBackTitle: '',
            headerShown: true,
          };
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.recruitPlayers}
        component={CMRecruitPlayersScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Recruit Players',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.myPlayers}
        component={CMMyPlayersScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'My Players',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.playerInvites}
        component={CMPlayerInvitesScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Player Invites',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.playerClaims}
        component={CMPlayerClaimsScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Player Claims',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.playersOfTeam}
        component={CMPlayersOfTeamScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Players',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.editPlayer}
        component={CMEditPlayerScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Edit Player',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.editPlayerStats}
        component={CMEditPlayerStatsScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Add Player Stats',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.editEvent}
        component={CMEditEventScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Edit Event',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.editMatch}
        component={CMEditMatchScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Edit Match',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.matchPlayersStats}
        component={CMMatchPlayersStatsScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Match Player Stats',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.scoreboard}
        component={CMScoreboardScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Scoreboard',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.paywall}
        component={CMPaywallScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'League Plans',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.newsDetail}
        component={CMNewsDetailScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'League News',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.teamManagement}
        component={CMTeamManagementScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Team Management',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name={CMConstants.screenName.teamManagementTab}
        component={CMTeamManagementTabScreen}
        options={{
          ...CMNavigationStyle.header(themeMode),
          title: 'Team Management',
          headerBackTitle: '',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
};

export default CMCoachStackNavigatorRoutes;

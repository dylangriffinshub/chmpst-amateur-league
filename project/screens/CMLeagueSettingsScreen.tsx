import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, Text, ScrollView, Switch, Dimensions, Alert, TextInput, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMRipple from '../components/CMRipple';
import CMProfileImage from '../components/CMProfileImage';
import CMImagePicker from '../helper/CMImagePicker';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import CMGlobal from '../CMGlobal';
import CMPermissionHelper from '../helper/CMPermissionHelper';
import { getAuth } from '@react-native-firebase/auth';
import firestore, { Timestamp, getFirestore, collection, doc, setDoc } from '@react-native-firebase/firestore';
import CMLoadingDialog from '../dialog/CMLoadingDialog';

const CMLeagueSettingsScreen = ({ navigation, route }: CMNavigationProps) => {
  const [loading, setLoading] = useState(false);
  const [league, setLeague] = useState<any>(route.params?.league || {});
  const [teamCount, setTeamCount] = useState(0);
  const insets = useSafeAreaInsets();

  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;

  // Get screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const isSmallDevice = screenWidth < 375;
  const isLargeDevice = screenWidth > 414;
  const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;
  const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0;

  // League settings state
  const [maxTeams, setMaxTeams] = useState(league?.maxTeamSize || 15);
  const [enablePlayoffs, setEnablePlayoffs] = useState(league?.enablePlayoffs ?? true);
  const [playoffTeams, setPlayoffTeams] = useState(league?.playoffTeams || 6);
  // Season phase flags (regular season vs playoffs)
  const [regularSeasonEnded, setRegularSeasonEnded] = useState(league?.regularSeasonEnded ?? false);
  const [playoffsStarted, setPlayoffsStarted] = useState(league?.playoffsStarted ?? false);
  const [scheduleType, setScheduleType] = useState(league?.scheduleType || 'Round Robin');
  const [enableTeamStats, setEnableTeamStats] = useState(league?.enableTeamStats ?? true);
  const [enablePlayerStats, setEnablePlayerStats] = useState(league?.enablePlayerStats ?? true);
  const [seasonName, setSeasonName] = useState(league?.seasonName || '');
  const [profileImagePath, setProfileImagePath] = useState(league?.avatar || '');
  const [isEditingSeasonName, setIsEditingSeasonName] = useState(false);
  const [hasPlayoffMatches, setHasPlayoffMatches] = useState(false);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);

  // Helper: allowed playoff team counts (2, 4, 8, 16) limited by team count / maxTeams
  const getAllowedPlayoffSizes = () => {
    const limit = teamCount || maxTeams || 0;
    const baseSizes = [2, 4, 8, 16];
    return baseSizes.filter(size => size <= limit);
  };

  // Load league data
  useEffect(() => {
    const loadLeagueData = () => {
      const leagueId = route.params?.league?.id || league?.id;
      console.log('[LeagueSettings] loadLeagueData leagueId:', leagueId);
      if (leagueId) {
        CMFirebaseHelper.getLeague(leagueId, (response: { [name: string]: any }) => {
          console.log('[LeagueSettings] getLeague response:', response);
          if (response.isSuccess && response.value) {
            const updatedLeague = { ...(route.params?.league || league || {}), ...response.value };
            setLeague(updatedLeague);
            
            // Get team count from teamsId array
            const teamsId = updatedLeague.teamsId || [];
            const teamsLength = teamsId.length || 0;
            setTeamCount(teamsLength);
            
            // Set league settings (will be overridden by season settings if season exists)
            // Max teams should reflect current league team count
            setMaxTeams(teamsLength || (updatedLeague.maxTeamSize || 15));
            setEnablePlayoffs(updatedLeague.enablePlayoffs ?? true);
            setPlayoffTeams(updatedLeague.playoffTeams || 6);
            setScheduleType(updatedLeague.scheduleType || 'Round Robin');
            setEnableTeamStats(updatedLeague.enableTeamStats ?? true);
            setEnablePlayerStats(updatedLeague.enablePlayerStats ?? true);
            setRegularSeasonEnded(updatedLeague.regularSeasonEnded ?? false);
            setPlayoffsStarted(updatedLeague.playoffsStarted ?? false);
            const currentSeasonName = updatedLeague.seasonName || '';
            console.log('[LeagueSettings] loadLeagueData currentSeasonName from league:', currentSeasonName);
            // Verify that this season still has matches; if not, clear it
            if (currentSeasonName) {
              firestore()
                .collection('matches')
                .where('leagueId', '==', leagueId)
                .get()
                .then((snapshot: any) => {
                  let hasMatchesForSeason = false;
                  snapshot.forEach((doc: any) => {
                    const data = doc.data();
                    const matchSeasonName = (data.seasonName || '').trim().toLowerCase();
                    if (matchSeasonName === currentSeasonName.trim().toLowerCase()) {
                      hasMatchesForSeason = true;
                    }
                  });

                  console.log('[LeagueSettings] loadLeagueData hasMatchesForSeason:', hasMatchesForSeason);

                  if (hasMatchesForSeason) {
                    setSeasonName(currentSeasonName);
                  } else {
                    console.log('[LeagueSettings] loadLeagueData clearing seasonName because no matches found for this season');
                    setSeasonName('');
                    CMFirebaseHelper.updateLeague(leagueId, { seasonName: '' }, () => {});
                  }
                })
                .catch((error: any) => {
                  console.log('[LeagueSettings] loadLeagueData error checking matches for season:', error);
                  setSeasonName(currentSeasonName);
                });
            } else {
              setSeasonName('');
            }
            setProfileImagePath(updatedLeague.avatar || '');
            setRegularSeasonEnded(updatedLeague.regularSeasonEnded ?? false);
            setPlayoffsStarted(updatedLeague.playoffsStarted ?? false);
            
            // Load season settings if season exists
            if (currentSeasonName) {
              CMFirebaseHelper.getSeasonSettings(leagueId, currentSeasonName, (seasonResponse: { [name: string]: any }) => {
                if (seasonResponse.isSuccess && seasonResponse.value) {
                  const seasonSettings = seasonResponse.value;
                  if (seasonSettings.roundType) {
                    setScheduleType(seasonSettings.roundType);
                  }
                  if (seasonSettings.maxTeams !== undefined) {
                    setMaxTeams(seasonSettings.maxTeams);
                  }
                  if (seasonSettings.enablePlayoffs !== undefined) {
                    setEnablePlayoffs(seasonSettings.enablePlayoffs);
                  }
                  if (seasonSettings.playoffTeams !== undefined) {
                    setPlayoffTeams(seasonSettings.playoffTeams);
                  }
                  if (seasonSettings.enableTeamStats !== undefined) {
                    setEnableTeamStats(seasonSettings.enableTeamStats);
                  }
                  if (seasonSettings.enablePlayerStats !== undefined) {
                    setEnablePlayerStats(seasonSettings.enablePlayerStats);
                  }
                }
              });
            }
          }
        });
      } else if (route.params?.league) {
        // Use initial league data if available
        const initialLeague = route.params.league;
        setLeague(initialLeague);
        const teamsId = initialLeague.teamsId || [];
        setTeamCount(teamsId.length);
        setMaxTeams(initialLeague.maxTeamSize || 15);
        setSeasonName(initialLeague.seasonName || '');
        setProfileImagePath(initialLeague.avatar || '');
        // CRITICAL: Set playoff status flags from initial league data
        setRegularSeasonEnded(initialLeague.regularSeasonEnded ?? false);
        setPlayoffsStarted(initialLeague.playoffsStarted ?? false);
        setEnablePlayoffs(initialLeague.enablePlayoffs ?? true);
        setPlayoffTeams(initialLeague.playoffTeams || 6);
        setScheduleType(initialLeague.scheduleType || 'Round Robin');
      }
    };

    loadLeagueData();
  }, [route.params?.league?.id]);

  // Load season settings when season exists
  useEffect(() => {
    const loadSeasonSettings = () => {
      const leagueId = route.params?.league?.id || league?.id;
      const currentSeasonName = seasonName || league?.seasonName;
      if (leagueId && currentSeasonName) {
        CMFirebaseHelper.getSeasonSettings(leagueId, currentSeasonName, (response: { [name: string]: any }) => {
          if (response.isSuccess && response.value) {
            const seasonSettings = response.value;
            // Update settings from season data
            if (seasonSettings.roundType) {
              setScheduleType(seasonSettings.roundType);
            }
            if (seasonSettings.maxTeams !== undefined) {
              setMaxTeams(seasonSettings.maxTeams);
            }
            if (seasonSettings.enablePlayoffs !== undefined) {
              setEnablePlayoffs(seasonSettings.enablePlayoffs);
            }
            if (seasonSettings.playoffTeams !== undefined) {
              setPlayoffTeams(seasonSettings.playoffTeams);
            }
            if (seasonSettings.enableTeamStats !== undefined) {
              setEnableTeamStats(seasonSettings.enableTeamStats);
            }
            if (seasonSettings.enablePlayerStats !== undefined) {
              setEnablePlayerStats(seasonSettings.enablePlayerStats);
            }
          }
        });
      }
    };
    loadSeasonSettings();
  }, [seasonName, league?.id, route.params?.league?.id]);

  // Check if playoff matches exist and if season is complete
  useEffect(() => {
    console.log('[LeagueSettings] hasPlayoffMatches useEffect - league?.id:', league?.id, 'seasonName:', seasonName);
    if (league?.id && seasonName) {
      CMFirebaseHelper.getMatches(league.id, (response: { [name: string]: any }) => {
        if (response.isSuccess && Array.isArray(response.value)) {
          const normalizedSeasonName = (seasonName || '').trim().toLowerCase();
          const playoffMatches = (response.value as any[]).filter(m => {
            const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
            const isPlayoff = !!m.isPlayoff;
            return isPlayoff && matchSeasonName === normalizedSeasonName;
          });
          console.log('[LeagueSettings] hasPlayoffMatches - found', playoffMatches.length, 'playoff matches');
          setHasPlayoffMatches(playoffMatches.length > 0);
          
          // Check if season is complete (final round match is finished)
          if (playoffMatches.length > 0) {
            // Find the highest round (final round)
            const rounds = playoffMatches.map(m => m.playoffRound || 1);
            const maxRound = Math.max(...rounds);
            const finalRoundMatches = playoffMatches.filter(m => (m.playoffRound || 1) === maxRound);
            
            // Final round should have only 1 match (2 teams)
            if (finalRoundMatches.length === 1) {
              const finalMatch = finalRoundMatches[0];
              const isFinalMatchFinished = finalMatch.status === CMConstants.gameStatus.finished;
              setIsSeasonComplete(isFinalMatchFinished);
            } else {
              setIsSeasonComplete(false);
            }
          } else {
            setIsSeasonComplete(false);
          }
        } else {
          console.log('[LeagueSettings] hasPlayoffMatches - getMatches failed or not array');
          setHasPlayoffMatches(false);
          setIsSeasonComplete(false);
        }
      });
    } else {
      console.log('[LeagueSettings] hasPlayoffMatches - no league.id or seasonName, setting to false');
      setHasPlayoffMatches(false);
      setIsSeasonComplete(false);
    }
  }, [league?.id, seasonName]);

  // Reload league data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const leagueId = route.params?.league?.id || league?.id;
      console.log('[LeagueSettings] focus listener leagueId:', leagueId);
      if (leagueId) {
        CMFirebaseHelper.getLeague(leagueId, (response: { [name: string]: any }) => {
          console.log('[LeagueSettings] focus getLeague response:', response);
          if (response.isSuccess && response.value) {
            const updatedLeague = { ...(route.params?.league || league || {}), ...response.value };
            setLeague(updatedLeague);
            const currentSeasonName = updatedLeague.seasonName || '';
            console.log('[LeagueSettings] focus currentSeasonName from league:', currentSeasonName);
            // Verify that this season still has matches; if not, clear it
            if (currentSeasonName) {
              firestore()
                .collection('matches')
                .where('leagueId', '==', leagueId)
                .get()
                .then((snapshot: any) => {
                  let hasMatchesForSeason = false;
                  snapshot.forEach((doc: any) => {
                    const data = doc.data();
                    const matchSeasonName = (data.seasonName || '').trim().toLowerCase();
                    if (matchSeasonName === currentSeasonName.trim().toLowerCase()) {
                      hasMatchesForSeason = true;
                    }
                  });

                  console.log('[LeagueSettings] focus hasMatchesForSeason:', hasMatchesForSeason);

                  if (hasMatchesForSeason) {
                    setSeasonName(currentSeasonName);
                  } else {
                    console.log('[LeagueSettings] focus clearing seasonName because no matches found for this season');
                    setSeasonName('');
                    CMFirebaseHelper.updateLeague(leagueId, { seasonName: '' }, () => {});
                  }
                })
                .catch((error: any) => {
                  console.log('[LeagueSettings] focus error checking matches for season:', error);
                  setSeasonName(currentSeasonName);
                });
            } else {
              setSeasonName('');
            }
            // Update other settings as needed
            const teamsId = updatedLeague.teamsId || [];
            setTeamCount(teamsId.length);
            setMaxTeams(updatedLeague.maxTeamSize || 15);
            setEnablePlayoffs(updatedLeague.enablePlayoffs ?? true);
            setPlayoffTeams(updatedLeague.playoffTeams || 6);
            setScheduleType(updatedLeague.scheduleType || 'Round Robin');
            setEnableTeamStats(updatedLeague.enableTeamStats ?? true);
            setEnablePlayerStats(updatedLeague.enablePlayerStats ?? true);
            setProfileImagePath(updatedLeague.avatar || '');
            // CRITICAL: Update playoff status flags to show correct message
            const newRegularSeasonEnded = updatedLeague.regularSeasonEnded ?? false;
            const newPlayoffsStarted = updatedLeague.playoffsStarted ?? false;
            console.log('[LeagueSettings] focus updating flags - regularSeasonEnded:', newRegularSeasonEnded, 'playoffsStarted:', newPlayoffsStarted);
            setRegularSeasonEnded(newRegularSeasonEnded);
            setPlayoffsStarted(newPlayoffsStarted);
            
            // Check for playoff matches and season completion
            if (currentSeasonName) {
              CMFirebaseHelper.getMatches(leagueId, (matchesResponse: { [name: string]: any }) => {
                if (matchesResponse.isSuccess && Array.isArray(matchesResponse.value)) {
                  const normalizedSeasonName = (currentSeasonName || '').trim().toLowerCase();
                  const playoffMatches = (matchesResponse.value as any[]).filter(m => {
                    const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
                    const isPlayoff = !!m.isPlayoff;
                    return isPlayoff && matchSeasonName === normalizedSeasonName;
                  });
                  console.log('[LeagueSettings] focus - found', playoffMatches.length, 'playoff matches');
                  setHasPlayoffMatches(playoffMatches.length > 0);
                  
                  // Check if season is complete (final round match is finished)
                  if (playoffMatches.length > 0) {
                    const rounds = playoffMatches.map(m => m.playoffRound || 1);
                    const maxRound = Math.max(...rounds);
                    const finalRoundMatches = playoffMatches.filter(m => (m.playoffRound || 1) === maxRound);
                    
                    if (finalRoundMatches.length === 1) {
                      const finalMatch = finalRoundMatches[0];
                      const isFinalMatchFinished = finalMatch.status === CMConstants.gameStatus.finished;
                      setIsSeasonComplete(isFinalMatchFinished);
                    } else {
                      setIsSeasonComplete(false);
                    }
                  } else {
                    setIsSeasonComplete(false);
                  }
                } else {
                  console.log('[LeagueSettings] focus - getMatches failed or not array');
                  setHasPlayoffMatches(false);
                  setIsSeasonComplete(false);
                }
              });
            } else {
              console.log('[LeagueSettings] focus - no currentSeasonName, setting hasPlayoffMatches to false');
              setHasPlayoffMatches(false);
              setIsSeasonComplete(false);
            }
            
            // Load season settings if season exists
            if (currentSeasonName) {
              CMFirebaseHelper.getSeasonSettings(leagueId, currentSeasonName, (seasonResponse: { [name: string]: any }) => {
                if (seasonResponse.isSuccess && seasonResponse.value) {
                  const seasonSettings = seasonResponse.value;
                  if (seasonSettings.roundType) {
                    setScheduleType(seasonSettings.roundType);
                  }
                  if (seasonSettings.maxTeams !== undefined) {
                    setMaxTeams(seasonSettings.maxTeams);
                  }
                  if (seasonSettings.enablePlayoffs !== undefined) {
                    setEnablePlayoffs(seasonSettings.enablePlayoffs);
                  }
                  if (seasonSettings.playoffTeams !== undefined) {
                    setPlayoffTeams(seasonSettings.playoffTeams);
                  }
                  if (seasonSettings.enableTeamStats !== undefined) {
                    setEnableTeamStats(seasonSettings.enableTeamStats);
                  }
                  if (seasonSettings.enablePlayerStats !== undefined) {
                    setEnablePlayerStats(seasonSettings.enablePlayerStats);
                  }
                }
              });
            }
          }
        });
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.league?.id]);

  // Dynamic colors based on theme
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const chevronColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1;
  const inputBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;

  useEffect(() => {
    navigation.setOptions({
      title: 'Commissioner Settings',
      headerStyle: {
        backgroundColor: headerBackgroundColor,
      },
      headerTintColor: headerTextColor,
      headerTitleStyle: {
        color: headerTextColor,
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold' as const,
      },
      headerTitleContainerStyle: {
        paddingRight: 0,
        marginRight: 0,
        marginLeft: -CMConstants.space.smallEx,
      },
      headerLeft: () => (
        <CMRipple
          containerStyle={{
            marginLeft: CMConstants.space.smallEx,
            padding: CMConstants.space.smallEx,
          }}
          onPress={() => {
            // Go back to previous screen (should be League Details)
            navigation.goBack();
          }}
          color={headerTextColor}
        >
          <Ionicons
            name="arrow-back"
            size={CMConstants.height.icon}
            color={headerTextColor}
          />
        </CMRipple>
      ),
    });
  }, [navigation, league, headerBackgroundColor, headerTextColor]);

  const onBtnProfileImage = () => {
    CMImagePicker.showImagePicker(1, (isSuccess: boolean, response: any) => {
      if (!isSuccess) {
        return;
      }
      setProfileImagePath(response.path);
      // Update league with new image
      if (league?.id) {
        CMFirebaseHelper.uploadImage(
          response.path,
          `leagues/${league.id}/avatar.jpg`,
        ).then((uploadResponse: any) => {
          if (uploadResponse.isSuccess) {
            CMFirebaseHelper.updateLeague(league.id, { avatar: uploadResponse.value }, () => {});
          }
        });
      }
    });
  };

  const handleCreateSeason = () => {
    // Navigate to schedule generation screen
    navigation.navigate(CMConstants.screenName.generateSchedule, {
      league: league,
      currentSeasonName: seasonName,
    });
  };

  const handleEndSeason = () => {
    Alert.alert(
      'End Season',
      'Are you sure you want to end the regular season? Standings will be frozen and you can start playoffs from the Standings tab. This will not delete any games.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Season',
          style: 'destructive',
          onPress: () => {
            if (league?.id && seasonName) {
              setLoading(true);
              // Mark regular season as ended; playoffs can now be started from Standings tab
              CMFirebaseHelper.updateLeague(
                league.id,
                {
                  regularSeasonEnded: true,
                  playoffsStarted: false,
                },
                (response: { [name: string]: any }) => {
                  setLoading(false);
                  if (response.isSuccess) {
                    setRegularSeasonEnded(true);
                    setPlayoffsStarted(false);
                    setLeague({ ...league, regularSeasonEnded: true, playoffsStarted: false });
                    CMAlertDlgHelper.showAlertWithOK('Regular season ended. You can now start playoffs from the Standings tab.');
                  } else {
                    CMAlertDlgHelper.showAlertWithOK(response.value || 'Failed to end season.');
                  }
                },
              );
            }
          },
        },
      ],
    );
  };

  const handleResetSeason = () => {
    Alert.alert(
      'Reset Season',
      'This will open the schedule generation page with your current season settings. You can regenerate or modify the schedule. Existing matches will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Season',
          style: 'destructive',
          onPress: () => {
            if (league?.id && seasonName) {
              // First, find the actual season name from matches (in case season name was changed)
              firestore()
                .collection('matches')
                .where('leagueId', '==', league.id)
                .get()
                .then(async (snapshot: any) => {
                  // Find the most common season name in matches
                  const seasonNameCounts = new Map<string, number>();
                  snapshot.forEach((doc: any) => {
                    const data = doc.data();
                    const matchSeasonName = (data.seasonName || '').trim();
                    if (matchSeasonName) {
                      seasonNameCounts.set(matchSeasonName, (seasonNameCounts.get(matchSeasonName) || 0) + 1);
                    }
                  });
                  
                  // Use the most common season name, or fall back to current season name
                  let seasonNameToUse = seasonName;
                  if (seasonNameCounts.size > 0) {
                    const mostCommonSeasonName = Array.from(seasonNameCounts.entries())
                      .sort((a, b) => b[1] - a[1])[0][0];
                    seasonNameToUse = mostCommonSeasonName;
                  }
                  
                  // Load current season settings and navigate to generate schedule with that data
                  CMFirebaseHelper.getSeasonSettings(league.id, seasonNameToUse, (response: { [name: string]: any }) => {
                    let seasonData: any = null;
                    
                    if (response.isSuccess && response.value) {
                      seasonData = response.value;
                    } else {
                      // No season settings found, extract from matches
                      const gameDaysSet = new Set<string>();
                      const timeSlotsSet = new Set<string>();
                      const locationsSet = new Set<string>();
                      let earliestDate: Date | null = null;
                      
                      snapshot.forEach((doc: any) => {
                        const data = doc.data();
                        const matchSeasonName = (data.seasonName || '').trim();
                        
                        // Only process matches from the original season
                        if (matchSeasonName.toLowerCase() === seasonNameToUse.toLowerCase()) {
                          if (data.dateTime) {
                            let matchDate: Date | null = null;
                            if (data.dateTime?.toDate && typeof data.dateTime.toDate === 'function') {
                              matchDate = data.dateTime.toDate();
                            } else if (data.dateTime?.seconds) {
                              matchDate = new Date(data.dateTime.seconds * 1000);
                            }
                            
                            if (matchDate instanceof Date) {
                              if (!earliestDate || matchDate.getTime() < earliestDate.getTime()) {
                                earliestDate = matchDate;
                              }
                              
                              // Extract day of week
                              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                              const dayName = dayNames[matchDate.getDay()];
                              if (dayName) gameDaysSet.add(dayName);
                              
                              // Extract time slot
                              const hours = matchDate.getHours();
                              const minutes = matchDate.getMinutes();
                              const period = hours >= 12 ? 'PM' : 'AM';
                              const displayHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                              const timeString = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
                              timeSlotsSet.add(timeString);
                            }
                          }
                          
                          if (data.location) {
                            locationsSet.add(data.location);
                          }
                        }
                      });
                      
                      if (gameDaysSet.size > 0 || timeSlotsSet.size > 0 || locationsSet.size > 0 || earliestDate) {
                        seasonData = {
                          gameDays: Array.from(gameDaysSet).sort(),
                          timeSlots: Array.from(timeSlotsSet).sort(),
                          locations: Array.from(locationsSet).sort(),
                        };
                        if (earliestDate) {
                          const date = earliestDate as Date;
                          seasonData.startDate = {
                            seconds: Math.floor(date.getTime() / 1000),
                            nanoseconds: 0,
                          };
                        }
                      }
                    }
                  
                    if (seasonData) {
                      // Convert Firestore Timestamp to serializable format for navigation
                      const serializableData: any = { ...seasonData };
                      
                      if (seasonData.startDate) {
                        // Convert Firestore Timestamp to plain object with seconds/nanoseconds
                        if (seasonData.startDate.toDate && typeof seasonData.startDate.toDate === 'function') {
                          // Firestore Timestamp object - convert to plain object
                          serializableData.startDate = {
                            seconds: seasonData.startDate.seconds || (seasonData.startDate._seconds || 0),
                            nanoseconds: seasonData.startDate.nanoseconds || (seasonData.startDate._nanoseconds || 0),
                          };
                        } else if (seasonData.startDate.seconds !== undefined) {
                          // Already in plain object format
                          serializableData.startDate = seasonData.startDate;
                        } else if (seasonData.startDate instanceof Date) {
                          // Convert Date to Timestamp-like object
                          serializableData.startDate = {
                            seconds: Math.floor(seasonData.startDate.getTime() / 1000),
                            nanoseconds: 0,
                          };
                        }
                      }
                      
                      navigation.navigate(CMConstants.screenName.generateSchedule, {
                        league: league,
                        currentSeasonName: seasonName, // Use current season name for display
                        seasonData: serializableData, // Pass season data to pre-fill the form
                        isResetSeason: true, // Flag to indicate this is from Reset Season
                      });
                    } else {
                      // No season data found at all, navigate with empty data
                      navigation.navigate(CMConstants.screenName.generateSchedule, {
                        league: league,
                        currentSeasonName: seasonName,
                        seasonData: {},
                        isResetSeason: true,
                      });
                    }
                  });
                })
                .catch((error: any) => {
                  // Fallback: navigate with empty data
                  navigation.navigate(CMConstants.screenName.generateSchedule, {
                    league: league,
                    currentSeasonName: seasonName,
                    seasonData: {},
                    isResetSeason: true,
                  });
                });
            }
          },
        },
      ],
    );
  };

  const handleSeedTestData = async () => {
    if (!league?.id) {
      CMAlertDlgHelper.showAlertWithOK('League ID is required.');
      return;
    }

    // Check if user is admin
    const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
    const isAdmin = CMGlobal.user?.role === 'admin';
    if (!isAdmin) {
      CMAlertDlgHelper.showAlertWithOK('This feature is only available for admin users.');
      return;
    }

    Alert.alert(
      'Seed Test Data',
      'This will create:\n• Players for all teams\n• A test season with matches\n• Playoff matches\n• Match scores and player stats\n\nThis may take a while. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Data',
          onPress: async () => {
            setLoading(true);
            try {
              const db = getFirestore();
              const testSeasonName = seasonName || `Test Season ${new Date().getFullYear()}`;
              
              // Step 1: Get all teams
              CMFirebaseHelper.getTeamsByLeague(league.id, async (teamsResp: { [name: string]: any }) => {
                if (!teamsResp.isSuccess || !Array.isArray(teamsResp.value) || teamsResp.value.length < 2) {
                  setLoading(false);
                  CMAlertDlgHelper.showAlertWithOK('Need at least 2 teams to create test data.');
                  return;
                }

                const teams = teamsResp.value;
                const teamIds = teams.map((t: any) => t.id);

                // Step 2: Get existing players for each team
                CMFirebaseHelper.getPlayers(teamIds, async (playersResp: { [name: string]: any }) => {
                  const existingPlayers = playersResp.isSuccess && Array.isArray(playersResp.value) 
                    ? playersResp.value 
                    : [];
                  
                  const playersByTeam = new Map<string, any[]>();
                  teams.forEach((team: any) => {
                    playersByTeam.set(team.id, existingPlayers.filter((p: any) => p.teamId === team.id));
                  });

                  // Step 3: Create players for teams that don't have any (3-5 players per team)
                  const playerPromises: Promise<void>[] = [];
                  teams.forEach((team: any) => {
                    const existing = playersByTeam.get(team.id) || [];
                    const needed = Math.max(0, 5 - existing.length);
                    
                    for (let i = 0; i < needed; i++) {
                      const playerId = CMFirebaseHelper.getNewDocumentId('players');
                      const playerData = {
                        id: playerId,
                        teamId: team.id,
                        name: `Player ${i + existing.length + 1} ${team.name}`,
                        position: ['PG', 'SG', 'SF', 'PF', 'C'][i % 5],
                        deleted: false,
                      };
                      
                      playerPromises.push(
                        new Promise<void>((resolve) => {
                          CMFirebaseHelper.createPlayer(playerId, playerData, () => {
                            existing.push({ ...playerData, id: playerId });
                            resolve();
                          });
                        })
                      );
                    }
                  });

                  await Promise.all(playerPromises);

                  // Reload players after creation
                  CMFirebaseHelper.getPlayers(teamIds, async (updatedPlayersResp: { [name: string]: any }) => {
                    const allPlayers = updatedPlayersResp.isSuccess && Array.isArray(updatedPlayersResp.value)
                      ? updatedPlayersResp.value
                      : [];

                    // Step 4: Create regular season matches (simple round robin)
                    const regularMatches: any[] = [];
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 30); // Start 30 days ago
                    
                    let matchDate = new Date(startDate);
                    let week = 1;
                    let matchIndex = 0;

                    // Create matches: each team plays every other team once
                    for (let i = 0; i < teams.length; i++) {
                      for (let j = i + 1; j < teams.length; j++) {
                        const matchId = CMFirebaseHelper.getNewDocumentId('matches');
                        const matchDateTime = new Date(matchDate);
                        matchDateTime.setHours(18, 0, 0, 0); // 6 PM

                        const match = {
                          id: matchId,
                          leagueId: league.id,
                          teamAId: teams[i].id,
                          teamBId: teams[j].id,
                          name: `${teams[i].name} vs ${teams[j].name}`,
                          dateTime: Timestamp.fromDate(matchDateTime),
                          location: 'Test Location 1',
                          status: CMConstants.gameStatus.finished,
                          teamAScore: Math.floor(Math.random() * 40) + 20, // 20-60
                          teamBScore: Math.floor(Math.random() * 40) + 20,
                          week: week,
                          seasonName: testSeasonName,
                          isPlayoff: false,
                        };

                        regularMatches.push(match);
                        matchIndex++;
                        
                        // Move to next week every 3 matches
                        if (matchIndex % 3 === 0) {
                          week++;
                          matchDate.setDate(matchDate.getDate() + 7);
                        } else {
                          matchDate.setDate(matchDate.getDate() + 1);
                        }
                      }
                    }

                    // Save regular season matches
                    const matchSavePromises = regularMatches.map((match) => 
                      new Promise<void>((resolve) => {
                        CMFirebaseHelper.setMatch(match.id, match, () => resolve());
                      })
                    );
                    await Promise.all(matchSavePromises);

                    // Step 5: Create player stats for regular season matches
                    const statsPromises: Promise<void>[] = [];
                    regularMatches.forEach((match) => {
                      const teamAPlayers = allPlayers.filter((p: any) => p.teamId === match.teamAId);
                      const teamBPlayers = allPlayers.filter((p: any) => p.teamId === match.teamBId);

                      // Create stats for team A players
                      teamAPlayers.forEach((player: any) => {
                        const statId = CMFirebaseHelper.getNewDocumentId('playerStats');
                        const points = Math.floor(Math.random() * 20) + 5; // 5-25 points
                        const statData = {
                          id: statId,
                          playerId: player.id,
                          leagueId: league.id,
                          matchId: match.id,
                          pointsPerGame: points,
                          points: points,
                          assists: Math.floor(Math.random() * 5),
                          rebounds: Math.floor(Math.random() * 8),
                          steals: Math.floor(Math.random() * 3),
                          blocks: Math.floor(Math.random() * 2),
                          turnovers: Math.floor(Math.random() * 3),
                          dayTime: match.dateTime,
                        };

                        statsPromises.push(
                          setDoc(doc(collection(db, 'playerStats'), statId), statData).then(() => {})
                        );
                      });

                      // Create stats for team B players
                      teamBPlayers.forEach((player: any) => {
                        const statId = CMFirebaseHelper.getNewDocumentId('playerStats');
                        const points = Math.floor(Math.random() * 20) + 5;
                        const statData = {
                          id: statId,
                          playerId: player.id,
                          leagueId: league.id,
                          matchId: match.id,
                          pointsPerGame: points,
                          points: points,
                          assists: Math.floor(Math.random() * 5),
                          rebounds: Math.floor(Math.random() * 8),
                          steals: Math.floor(Math.random() * 3),
                          blocks: Math.floor(Math.random() * 2),
                          turnovers: Math.floor(Math.random() * 3),
                          dayTime: match.dateTime,
                        };

                        statsPromises.push(
                          setDoc(doc(collection(db, 'playerStats'), statId), statData).then(() => {})
                        );
                      });
                    });

                    await Promise.all(statsPromises);

                    // Step 6: Create playoff matches (if playoffs enabled)
                    if (enablePlayoffs && teams.length >= playoffTeams) {
                      const topTeams = teams.slice(0, playoffTeams);
                      const playoffRound1Matches: any[] = [];
                      const playoffDate = new Date(matchDate);
                      playoffDate.setDate(playoffDate.getDate() + 7);

                      // Create first round playoff matches
                      for (let i = 0; i < topTeams.length / 2; i++) {
                        const teamA = topTeams[i];
                        const teamB = topTeams[topTeams.length - 1 - i];
                        
                        const matchId = CMFirebaseHelper.getNewDocumentId('matches');
                        const matchDateTime = new Date(playoffDate);
                        matchDateTime.setHours(18, 0, 0, 0);
                        matchDateTime.setDate(matchDateTime.getDate() + i);

                        const match = {
                          id: matchId,
                          leagueId: league.id,
                          teamAId: teamA.id,
                          teamBId: teamB.id,
                          name: `${teamA.name} vs ${teamB.name}`,
                          dateTime: Timestamp.fromDate(matchDateTime),
                          location: 'Playoff Location',
                          status: CMConstants.gameStatus.finished,
                          teamAScore: Math.floor(Math.random() * 30) + 30, // 30-60
                          teamBScore: Math.floor(Math.random() * 30) + 30,
                          seasonName: testSeasonName,
                          isPlayoff: true,
                          playoffRound: 1,
                          playoffPosition: i,
                          playoffMatchupId: `round1-${i}`,
                        };

                        playoffRound1Matches.push(match);
                      }

                      // Save playoff matches
                      const playoffSavePromises = playoffRound1Matches.map((match) =>
                        new Promise<void>((resolve) => {
                          CMFirebaseHelper.setMatch(match.id, match, () => resolve());
                        })
                      );
                      await Promise.all(playoffSavePromises);

                      // Create player stats for playoff matches
                      const playoffStatsPromises: Promise<void>[] = [];
                      playoffRound1Matches.forEach((match) => {
                        const teamAPlayers = allPlayers.filter((p: any) => p.teamId === match.teamAId);
                        const teamBPlayers = allPlayers.filter((p: any) => p.teamId === match.teamBId);

                        teamAPlayers.forEach((player: any) => {
                          const statId = CMFirebaseHelper.getNewDocumentId('playerStats');
                          const points = Math.floor(Math.random() * 25) + 10;
                          const statData = {
                            id: statId,
                            playerId: player.id,
                            leagueId: league.id,
                            matchId: match.id,
                            pointsPerGame: points,
                            points: points,
                            assists: Math.floor(Math.random() * 6),
                            rebounds: Math.floor(Math.random() * 10),
                            steals: Math.floor(Math.random() * 4),
                            blocks: Math.floor(Math.random() * 3),
                            turnovers: Math.floor(Math.random() * 3),
                            dayTime: match.dateTime,
                          };
                          playoffStatsPromises.push(
                            setDoc(doc(collection(db, 'playerStats'), statId), statData).then(() => {})
                          );
                        });

                        teamBPlayers.forEach((player: any) => {
                          const statId = CMFirebaseHelper.getNewDocumentId('playerStats');
                          const points = Math.floor(Math.random() * 25) + 10;
                          const statData = {
                            id: statId,
                            playerId: player.id,
                            leagueId: league.id,
                            matchId: match.id,
                            pointsPerGame: points,
                            points: points,
                            assists: Math.floor(Math.random() * 6),
                            rebounds: Math.floor(Math.random() * 10),
                            steals: Math.floor(Math.random() * 4),
                            blocks: Math.floor(Math.random() * 3),
                            turnovers: Math.floor(Math.random() * 3),
                            dayTime: match.dateTime,
                          };
                          playoffStatsPromises.push(
                            setDoc(doc(collection(db, 'playerStats'), statId), statData).then(() => {})
                          );
                        });
                      });

                      await Promise.all(playoffStatsPromises);
                    }

                    // Step 7: Update league with season name and flags
                    await new Promise<void>((resolve) => {
                      CMFirebaseHelper.updateLeague(
                        league.id,
                        {
                          seasonName: testSeasonName,
                          regularSeasonEnded: true,
                          playoffsStarted: enablePlayoffs && teams.length >= playoffTeams,
                        },
                        () => resolve()
                      );
                    });

                    // Step 8: Save season settings
                    await new Promise<void>((resolve) => {
                      CMFirebaseHelper.setSeasonSettings(
                        league.id,
                        testSeasonName,
                        {
                          startDate: Timestamp.fromDate(startDate),
                          gameDays: ['Monday', 'Wednesday', 'Friday'],
                          timeSlots: ['6:00 PM', '7:00 PM', '8:00 PM'],
                          locations: ['Test Location 1', 'Test Location 2'],
                          roundType: 'Round Robin',
                          enablePlayoffs: enablePlayoffs,
                        },
                        () => resolve()
                      );
                    });

                    setLoading(false);
                    CMAlertDlgHelper.showAlertWithOK(
                      'Test data created successfully! You can now view the Season Complete page.',
                      () => {
                        // Reload league data
                        if (league?.id) {
                          CMFirebaseHelper.getLeague(league.id, (response: { [name: string]: any }) => {
                            if (response.isSuccess && response.value) {
                              setLeague({ ...league, ...response.value });
                              setSeasonName(testSeasonName);
                              setRegularSeasonEnded(true);
                              setPlayoffsStarted(enablePlayoffs && teams.length >= playoffTeams);
                            }
                          });
                        }
                      }
                    );
                  });
                });
              });
            } catch (error: any) {
              setLoading(false);
              console.error('Error seeding test data:', error);
              CMAlertDlgHelper.showAlertWithOK('Failed to create test data. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteLeague = () => {
    Alert.alert(
      'Delete League',
      'Are you sure you want to delete this league? This will permanently delete the league and ALL associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (league?.id) {
              setLoading(true);
              const canDelete = await CMPermissionHelper.canEditLeague(league.id, league);
              if (!canDelete) {
                CMPermissionHelper.showPermissionDenied();
                setLoading(false);
                return;
              }
              CMFirebaseHelper.deleteLeague(league.id, (response: { [name: string]: any }) => {
                setLoading(false);
                if (response.isSuccess) {
                  navigation.goBack();
                } else {
                  CMAlertDlgHelper.showAlertWithOK('Failed to delete league.');
                }
              });
            }
          },
        },
      ],
    );
  };

  // Update all matches when season name changes
  const updateSeasonNameInMatches = async (leagueId: string, oldSeasonName: string, newSeasonName: string) => {
    if (!leagueId || !oldSeasonName || !newSeasonName || oldSeasonName === newSeasonName) {
      return;
    }
    
    try {
      setLoading(true);
      const snapshot = await firestore()
        .collection('matches')
        .where('leagueId', '==', leagueId)
        .get();

      const batch = firestore().batch();
      let updateCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.seasonName === oldSeasonName) {
          batch.update(doc.ref, { seasonName: newSeasonName });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        // Also update the season settings document name
        CMFirebaseHelper.getSeasonSettings(leagueId, oldSeasonName, (response: { [name: string]: any }) => {
          if (response.isSuccess && response.value) {
            // Save settings with new season name
            CMFirebaseHelper.setSeasonSettings(leagueId, newSeasonName, response.value, () => {});
          }
        });
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      CMAlertDlgHelper.showAlertWithOK('Failed to update matches with new season name. Please try again.');
    }
  };

  const updateLeagueSetting = (key: string, value: any) => {
    if (league?.id) {
      CMFirebaseHelper.updateLeague(league.id, { [key]: value }, () => {});
      // Also save to season settings if season exists
      const currentSeasonName = seasonName || league?.seasonName;
      if (currentSeasonName) {
        CMFirebaseHelper.setSeasonSettings(league.id, currentSeasonName, { [key]: value }, () => {});
      }
    }
  };

  const renderSettingRow = (
    label: string,
    value: string | number | React.ReactNode,
    onPress?: () => void,
    showChevron: boolean = true,
  ) => (
    <CMRipple
      containerStyle={[
        styles.settingRow,
        {
          backgroundColor: cardBackgroundColor,
          borderColor: cardBorderColor,
        },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text
        style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
          justifyContent: 'flex-end',
          minWidth: 0,
          marginLeft: CMConstants.space.normal, // more space between label and value
        }}
      >
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text
            style={[styles.settingValue, { color: labelColor, fontSize: 14 * fontScale }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {value}
          </Text>
        ) : (
          value
        )}
        {showChevron && onPress && (
          <Ionicons
            name="chevron-forward"
            size={16 * iconScale}
            color={chevronColor}
            style={{ marginLeft: CMConstants.space.smallEx }}
          />
        )}
      </View>
    </CMRipple>
  );

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      {/* {console.log('[LeagueSettings] render - league.id:', league?.id, 'seasonName state:', seasonName, 'league.seasonName:', league?.seasonName)} */}
      <CMLoadingDialog visible={loading} />


      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: CMConstants.space.normal, paddingBottom: CMConstants.space.normal }}
        showsVerticalScrollIndicator={false}
      >
        {/* League Info Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
            League Info
          </Text>
          {renderSettingRow(
            'League Name',
            league?.name || 'ELITE Basketball League',
            () => {
              navigation.navigate(CMConstants.screenName.editLeague, {
                isEdit: true,
                league: league,
              });
            },
          )}
          {renderSettingRow(
            'League Logo',
            (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CMProfileImage
                  radius={30}
                  imgURL={profileImagePath}
                  style={{ width: 30, height: 30 }}
                />
              </View>
            ),
            onBtnProfileImage,
          )}
          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: cardBackgroundColor,
                borderColor: cardBorderColor,
              },
            ]}
          >
            <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
              Season Name
            </Text>
            {isEditingSeasonName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                <TextInput
                  style={[
                    styles.seasonNameInput,
                    {
                      backgroundColor: inputBackgroundColor,
                      borderColor: inputBorderColor,
                      color: inputTextColor,
                      fontSize: 14 * fontScale,
                    },
                  ]}
                  value={seasonName}
                  onChangeText={setSeasonName}
                  placeholder="Enter season name"
                  placeholderTextColor={placeholderColor}
                  autoFocus={true}
                  onSubmitEditing={() => {
                    setIsEditingSeasonName(false);
                    Keyboard.dismiss();
                    if (league?.id && seasonName.trim()) {
                      const oldSeasonName = league?.seasonName || '';
                      const newSeasonName = seasonName.trim();
                      if (oldSeasonName && oldSeasonName !== newSeasonName) {
                        // Update all matches with old season name to new season name
                        updateSeasonNameInMatches(league.id, oldSeasonName, newSeasonName);
                      }
                      updateLeagueSetting('seasonName', newSeasonName);
                    }
                  }}
                  onBlur={() => {
                    setIsEditingSeasonName(false);
                    if (league?.id && seasonName.trim()) {
                      const oldSeasonName = league?.seasonName || '';
                      const newSeasonName = seasonName.trim();
                      if (oldSeasonName && oldSeasonName !== newSeasonName) {
                        // Update all matches with old season name to new season name
                        updateSeasonNameInMatches(league.id, oldSeasonName, newSeasonName);
                      }
                      updateLeagueSetting('seasonName', newSeasonName);
                    }
                  }}
                />
                <CMRipple
                  containerStyle={{ marginLeft: CMConstants.space.smallEx }}
                  onPress={() => {
                    setIsEditingSeasonName(false);
                    Keyboard.dismiss();
                    if (league?.id && seasonName.trim()) {
                      updateLeagueSetting('seasonName', seasonName.trim());
                    }
                  }}
                >
                  <Ionicons name="checkmark" size={20 * iconScale} color={CMConstants.color.green} />
                </CMRipple>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.settingValue, { color: seasonName ? textColor : labelColor, fontSize: 14 * fontScale }]}>
                  {seasonName || 'No season set'}
                </Text>
                <CMRipple
                  containerStyle={{ marginLeft: CMConstants.space.smallEx }}
                  onPress={() => setIsEditingSeasonName(true)}
                >
                  <Ionicons name="create-outline" size={18 * iconScale} color={CMConstants.color.green} />
                </CMRipple>
              </View>
            )}
          </View>
          {renderSettingRow(
            'Teams',
            `${teamCount}${league?.maxTeamSize ? `/${league.maxTeamSize}` : ''}`,
            undefined,
            false,
          )}
        </View>

        {/* Season Controls Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
            Season Controls
          </Text>
          {/* {console.log('[LeagueSettings] SeasonControls - seasonName state:', seasonName, 'trimmed empty:', !seasonName || (typeof seasonName === 'string' && seasonName.trim() === ''), 'regularSeasonEnded:', regularSeasonEnded, 'playoffsStarted:', playoffsStarted, 'hasPlayoffMatches:', hasPlayoffMatches)} */}
          
          {/* Dev/Test Button - Only for Admin */}
          {(() => {
            const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
            const isAdmin = CMGlobal.user?.role === 'admin';
            return isAdmin && __DEV__;
          })() && (
            <CMRipple
              containerStyle={[
                styles.actionButton,
                {
                  backgroundColor: CMConstants.color.green,
                  marginBottom: CMConstants.space.smallEx,
                },
              ]}
              onPress={handleSeedTestData}
            >
              <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>
                🧪 Seed Test Data (Admin)
              </Text>
            </CMRipple>
          )}

          {(!seasonName || (typeof seasonName === 'string' && seasonName.trim() === '')) || (isSeasonComplete && hasPlayoffMatches) ? (
            // No season exists OR season complete - show Create Season button
            <CMRipple
              containerStyle={[
                styles.actionButton,
                {
                  backgroundColor: CMConstants.color.green,
                },
              ]}
              onPress={handleCreateSeason}
            >
              <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>Create Season</Text>
            </CMRipple>
          ) : regularSeasonEnded && playoffsStarted && hasPlayoffMatches ? (
            // Playoffs in progress - show message instead of buttons (only if playoff matches exist)
            <View
              style={[
                styles.actionButton,
                {
                  backgroundColor: CMConstants.color.green,
                },
              ]}
            >
              <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>
                Playoffs is started and processing
              </Text>
            </View>
          ) : (
            // Season exists - show End Season and Reset Season buttons
            <>
              <CMRipple
                containerStyle={[
                  styles.actionButton,
                  {
                    backgroundColor: CMConstants.color.red,
                    marginBottom: CMConstants.space.smallEx,
                  },
                ]}
                onPress={handleEndSeason}
              >
                <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>End Season</Text>
              </CMRipple>
              <CMRipple
                containerStyle={[
                  styles.actionButton,
                  {
                    backgroundColor: CMConstants.color.red,
                  },
                ]}
                onPress={handleResetSeason}
              >
                <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>Reset Season</Text>
              </CMRipple>
            </>
          )}
        </View>

        {/* Competition Format Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
            Competition Format
          </Text>
          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: cardBackgroundColor,
                borderColor: cardBorderColor,
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
              Max Teams
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.settingValue, { color: textColor, fontSize: 14 * fontScale }]}>
                {teamCount || maxTeams}
              </Text>
            </View>
          </View>
          {enablePlayoffs && (
            <View
              style={[
                styles.settingRow,
                {
                  backgroundColor: cardBackgroundColor,
                  borderColor: cardBorderColor,
                  justifyContent: 'space-between',
                },
              ]}
            >
              <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
                Playoff Teams
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CMRipple
                  containerStyle={styles.plusMinusButton}
                  onPress={() => {
                    if (!enablePlayoffs) {
                      return;
                    }
                    const allowed = getAllowedPlayoffSizes();
                    if (allowed.length === 0) {
                      return;
                    }
                    const currentIndex = allowed.indexOf(playoffTeams);
                    const targetIndex = currentIndex > 0 ? currentIndex - 1 : 0;
                    const newValue = allowed[targetIndex];
                    if (newValue !== playoffTeams) {
                      setPlayoffTeams(newValue);
                      updateLeagueSetting('playoffTeams', newValue);
                    }
                  }}
                >
                  <Ionicons name="remove" size={20 * iconScale} color={CMConstants.color.green} />
                </CMRipple>
                <Text style={[styles.settingValue, { color: textColor, fontSize: 14 * fontScale, marginHorizontal: CMConstants.space.smallEx }]}>
                  {playoffTeams}
                </Text>
                <CMRipple
                  containerStyle={styles.plusMinusButton}
                  onPress={() => {
                    if (!enablePlayoffs) {
                      return;
                    }
                    const allowed = getAllowedPlayoffSizes();
                    if (allowed.length === 0) {
                      return;
                    }
                    // If current value is not in allowed list, snap to first allowed
                    const currentIndex = allowed.indexOf(playoffTeams);
                    let targetIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
                    if (targetIndex >= allowed.length) {
                      targetIndex = allowed.length - 1;
                    }
                    const newValue = allowed[targetIndex];
                    if (newValue !== playoffTeams) {
                      setPlayoffTeams(newValue);
                      updateLeagueSetting('playoffTeams', newValue);
                    }
                  }}
                >
                  <Ionicons name="add" size={20 * iconScale} color={CMConstants.color.green} />
                </CMRipple>
              </View>
            </View>
          )}
          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: cardBackgroundColor,
                borderColor: cardBorderColor,
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
              Enable Playoffs
            </Text>
            <Switch
              value={enablePlayoffs}
              onValueChange={(value) => {
                setEnablePlayoffs(value);
                updateLeagueSetting('enablePlayoffs', value);
              }}
              trackColor={{ false: cardBorderColor, true: CMConstants.color.green }}
              thumbColor={CMConstants.color.white}
            />
          </View>
          {renderSettingRow('Schedule Type', scheduleType, undefined, false)}
        </View>

        {/* Permissions Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
            Permissions
          </Text>
          {renderSettingRow(
            'Transfer Commissioner',
            '',
            () => {
              // TODO: Navigate to transfer commissioner
            },
          )}
          {renderSettingRow(
            'Admin Roles',
            '',
            () => {
              // TODO: Navigate to admin roles
            },
          )}
        </View>

        {/* Stats Tracking Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
            Stats Tracking
          </Text>
          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: cardBackgroundColor,
                borderColor: cardBorderColor,
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
              Enable Team Stats
            </Text>
            <Switch
              value={enableTeamStats}
              onValueChange={(value) => {
                setEnableTeamStats(value);
                updateLeagueSetting('enableTeamStats', value);
              }}
              trackColor={{ false: cardBorderColor, true: CMConstants.color.green }}
              thumbColor={CMConstants.color.white}
            />
          </View>
          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: cardBackgroundColor,
                borderColor: cardBorderColor,
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
              Enable Player Stats
            </Text>
            <Switch
              value={enablePlayerStats}
              onValueChange={(value) => {
                setEnablePlayerStats(value);
                updateLeagueSetting('enablePlayerStats', value);
              }}
              trackColor={{ false: cardBorderColor, true: CMConstants.color.green }}
              thumbColor={CMConstants.color.white}
            />
          </View>
        </View>

        {/* Delete League Button */}
        <CMRipple
          containerStyle={[
            styles.deleteButton,
            {
              backgroundColor: CMConstants.color.red,
              marginTop: CMConstants.space.normal,
              marginBottom: CMConstants.space.normal + insets.bottom,
            },
          ]}
          onPress={handleDeleteLeague}
        >
          <Text style={[styles.deleteButtonText, { fontSize: 14 * fontScale }]}>Delete League</Text>
        </CMRipple>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = {
  section: {
    marginTop: CMConstants.space.normal,
  },
  sectionTitle: {
    fontWeight: 'bold' as const,
    marginBottom: CMConstants.space.small, // more space between title and content
  },
  settingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    marginBottom: CMConstants.space.smallEx - 2,
  },
  settingLabel: {
    fontWeight: '500' as const,
  },
  settingValue: {
    fontWeight: '400' as const,
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: CMConstants.color.darkGrey,
  },
  actionButton: {
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.normal,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionButtonText: {
    color: CMConstants.color.white,
    fontWeight: '600' as const,
  },
  plusMinusButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.normal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: CMConstants.color.white,
    fontWeight: '600' as const,
  },
  seasonNameInput: {
    flex: 1,
    minWidth: 100,
    maxWidth: 200,
    paddingVertical: CMConstants.space.smallEx - 4,
    paddingHorizontal: CMConstants.space.smallEx,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1,
    textAlign: 'right' as const,
  },
};

export default CMLeagueSettingsScreen;

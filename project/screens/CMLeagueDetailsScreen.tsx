import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, ViewStyle, Text, FlatList, Linking, Alert, Dimensions, ScrollView, Image } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'react-native-toast-notifications';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMTeamCell from '../components/CMTeamCell';
import CMStandingCell from '../components/CMStandingCell';
import CMPlayerStatCell from '../components/CMPlayerStatCell';
import CMRipple from '../components/CMRipple';
import CMToast from '../components/CMToast';
import CMProfileImage from '../components/CMProfileImage';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import CMGlobal from '../CMGlobal';
import CMPermissionHelper from '../helper/CMPermissionHelper';
import { getAuth } from '@react-native-firebase/auth';

const CMLeagueDetailsScreen = ({ navigation, route }: CMNavigationProps) => {
  const [teams, setTeams] = useState<{ [name: string]: any }[]>([]);
  const [standings, setStandings] = useState<{ [name: string]: any }[]>([]);
  const [playerStats, setPlayerStats] = useState<{ [name: string]: any }[]>([]);

  const [players, setPlayers] = useState<{ [name: string]: any }[]>([]);
  // Ensure league has a valid structure with id
  const initialLeague = route.params?.league || {};
  const [league, setLeague] = useState<{ [name: string]: any }>(initialLeague);

  const [refreshingTeams, setRefreshingTeams] = useState(false);
  const [refreshingStandings, setRefreshingStandings] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [statsIndex, setStatsIndex] = useState(0);
  const [newsArticles, setNewsArticles] = useState<any[]>([]);
  const [refreshingNews, setRefreshingNews] = useState(false);

  // Season highlights for header section
  const [seasonChampion, setSeasonChampion] = useState<{ [name: string]: any } | null>(null);
  const [topScorer, setTopScorer] = useState<{ [name: string]: any } | null>(null);
  const [intenseMatch, setIntenseMatch] = useState<{
    match: { [name: string]: any };
    teamA?: { [name: string]: any } | null;
    teamB?: { [name: string]: any } | null;
    margin: number;
  } | null>(null);

  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  const Tab = createMaterialTopTabNavigator();
  
  // Track initial tab from route params
  const initialTab = route.params?.initialTab || 'Teams';

  // Get screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const isSmallDevice = screenWidth < 375;
  const isLargeDevice = screenWidth > 414;
  
  // Calculate responsive scaling factors
  const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;
  const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0;

  // Listen for theme changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
    });
    return unsubscribe;
  }, [navigation]);

  // Dynamic colors based on theme
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;

  // Local background images for season highlights
  const championBG = require('../../assets/images/championBG.png');
  const topScoreBG = require('../../assets/images/topscoreBG.png');
  const intenseBG = require('../../assets/images/intenseBG.png');
  const tabBarBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const tabBarBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const tabBarInactiveColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;

  // Generic URL opening function
  const openUrl = async (url: string, platform: string) => {
    if (!url || url.trim().length === 0) {
      Alert.alert('No URL', `No ${platform} URL available for this league.`);
      return;
    }

    try {
      let finalUrl = url.trim();
      
      // Handle Instagram URLs - convert @username to full URL
      if (platform === 'Instagram' && finalUrl.startsWith('@')) {
        const username = finalUrl.substring(1);
        finalUrl = `https://instagram.com/${username}`;
      }
      
      // Handle Facebook URLs - convert @username to full URL if needed
      if (platform === 'Facebook' && finalUrl.startsWith('@')) {
        const username = finalUrl.substring(1);
        finalUrl = `https://facebook.com/${username}`;
      }

      // Check if the URL is valid
      const supported = await Linking.canOpenURL(finalUrl);
      if (supported) {
        await Linking.openURL(finalUrl);
      } else {
        Alert.alert('Error', `Cannot open ${platform} URL. Please check if the URL is valid.`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to open ${platform} URL.`);
    }
  };

  const loadPlayers = (teamsId: string[]) => {
    CMFirebaseHelper.getPlayers(
      teamsId,
      (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          setPlayers(response.value);
        }
      },
    );
  };

  const loadTeams = (teamsId: string[]) => {
    setRefreshingTeams(true);
    CMFirebaseHelper.getTeams(teamsId, (response: { [name: string]: any }) => {
      setRefreshingTeams(false);
      if (response.isSuccess) {
        setTeams(response.value);
      }
    });
  };

  const loadStandings = () => {
    setRefreshingStandings(true);
    CMFirebaseHelper.getMatches(
      league.id,
      (response: { [name: string]: any }) => {
        setRefreshingStandings(false);
        if (response.isSuccess) {
          const data: { [name: string]: any } = {};
          teams.forEach(team => {
            data[team.id] = { team: team, game: 0, win: 0, lose: 0 };
          });
          response.value.forEach((match: { [name: string]: any }) => {
            // 1) Only count games from the current season (if a season is set)
            if (league?.seasonName) {
              const matchSeasonName = match.seasonName || 'Legacy Season';
              if (matchSeasonName !== league.seasonName) {
                return;
              }
            }

            // 2) Only count games that have actually been played (finished)
            if (match.status !== CMConstants.gameStatus.finished) {
              return;
            }

            const teamA = data[match.teamAId] ?? { team: teams.find(t => t.id === match.teamAId), game: 0, win: 0, lose: 0 };
            const teamB = data[match.teamBId] ?? { team: teams.find(t => t.id === match.teamBId), game: 0, win: 0, lose: 0 };

            teamA['game']++;
            teamB['game']++;

            if (match.teamAScore > match.teamBScore) {
              teamA['win']++;
              teamB['lose']++;
            } else if (match.teamBScore > match.teamAScore) {
              teamA['lose']++;
              teamB['win']++;
            } else {
              // In cases of a tie (if ever supported), count as a game but not win/lose
            }

            data[match.teamAId] = teamA;
            data[match.teamBId] = teamB;
          });

          const standings: { [name: string]: any }[] = [];
          for (let key in data) {
            standings.push(data[key]);
          }

          standings.sort((standing1, standing2) => {
            if (standing1.win > standing2.win) {
              return -1;
            } else if (standing1.win < standing2.win) {
              return 1;
            } else {
              return standing1.lose - standing2.lose;
            }
          });

          setStandings(standings);

          // Season champion: top team in standings
          if (standings.length > 0) {
            setSeasonChampion(standings[0]);
          } else {
            setSeasonChampion(null);
          }

          // Most intense match: smallest scoring margin among finished games this season
          let bestMatch: { [name: string]: any } | null = null;
          let bestMargin = Number.MAX_SAFE_INTEGER;

          response.value.forEach((match: { [name: string]: any }) => {
            if (league?.seasonName) {
              const matchSeasonName = match.seasonName || 'Legacy Season';
              if (matchSeasonName !== league.seasonName) {
                return;
              }
            }

            if (match.status !== CMConstants.gameStatus.finished) {
              return;
            }

            const aScore = typeof match.teamAScore === 'number' ? match.teamAScore : 0;
            const bScore = typeof match.teamBScore === 'number' ? match.teamBScore : 0;
            const margin = Math.abs(aScore - bScore);

            if (margin > 0 && margin < bestMargin) {
              bestMargin = margin;
              bestMatch = match;
            }
          });

          if (bestMatch) {
            const teamAObj = teams.find(t => t.id === bestMatch!.teamAId) || null;
            const teamBObj = teams.find(t => t.id === bestMatch!.teamBId) || null;
            setIntenseMatch({
              match: bestMatch,
              teamA: teamAObj,
              teamB: teamBObj,
              margin: bestMargin,
            });
          } else {
            setIntenseMatch(null);
          }
        }
      },
    );
  };

  const loadPlayerStats = () => {
    setRefreshingStats(true);

    // Validate league.id before making the query - check for undefined, null, empty string, or non-string
    if (!league?.id || typeof league.id !== 'string' || league.id.trim().length === 0) {
      console.warn('CMLeagueDetailsScreen: Invalid league.id in loadPlayerStats, skipping query');
      setPlayerStats([]);
      setRefreshingStats(false);
      return;
    }

    // Get player average stats for this league from playerAverageStats collection
    CMFirebaseHelper.getPlayerAverageStatsByLeague(league.id, (response: { [name: string]: any }) => {
      if (response.isSuccess && Array.isArray(response.value)) {
        const averageStats = response.value;
        const stats: { [name: string]: any }[] = [];

        // For each average stat, get the player and team details
        averageStats.forEach((avgStat: any) => {
          const player = players.find((p: any) => p.id === avgStat.playerId);
          const team = teams.find((t: any) => player && t.id === player.teamId);

          if (player) {
            stats.push({
              player: player,
              team: team,
              points: Math.round(avgStat.averagePoints || 0),
              assists: Math.round(avgStat.averageAssists || 0),
              rebounds: Math.round(avgStat.averageRebounds || 0),
              blocks: Math.round(avgStat.averageBlocks || 0),
              steals: Math.round(avgStat.averageSteals || 0),
              matches: avgStat.matches || 0,
            });
          }
        });

        // Top scorer for highlights (by points per game)
        if (stats.length > 0) {
          const sortedByPoints = [...stats].sort((a, b) => (b.points || 0) - (a.points || 0));
          setTopScorer(sortedByPoints[0]);
        } else {
          setTopScorer(null);
        }

        // Sort by the currently selected stat
        const sortByStat = () => {
          switch (statsIndex) {
            case 0: // Points
              return stats.sort((stat1, stat2) => stat2.points - stat1.points);
            case 1: // Assists
              return stats.sort((stat1, stat2) => stat2.assists - stat1.assists);
            case 2: // Rebounds
              return stats.sort((stat1, stat2) => stat2.rebounds - stat1.rebounds);
            case 3: // Blocks
              return stats.sort((stat1, stat2) => stat2.blocks - stat1.blocks);
            case 4: // Steals
              return stats.sort((stat1, stat2) => stat2.steals - stat1.steals);
            default:
              return stats.sort((stat1, stat2) => stat2.points - stat1.points);
          }
        };

        sortByStat();
        setPlayerStats(stats);
      } else {
        setPlayerStats([]);
      }
      setRefreshingStats(false);
    });
  };

  useEffect(() => {
    navigation.setOptions({
      title: league?.name || 'League Details',
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
    });

    // Only load teams/players if league has valid ID
    if (league?.id && typeof league.id === 'string' && league.id.trim().length > 0) {
      loadTeams(league.teamsId ?? []);
      loadPlayers(league.teamsId ?? []);
      // Load news throughout the season
      loadNews();
    } else {
      console.warn('CMLeagueDetailsScreen: Invalid league object on mount, league.id:', league?.id);
    }
  }, []);

  // Handle initialTab parameter when navigating to this screen
  useEffect(() => {
    const initialTab = route.params?.initialTab;
    if (initialTab && (initialTab === 'Teams' || initialTab === 'Standings' || initialTab === 'Stats')) {
      // Update league state if needed (in case params changed)
      if (route.params?.league) {
        setLeague(route.params.league);
      }
    }
  }, [route.params?.initialTab, route.params?.league]);

  const loadNews = () => {
    if (!league?.id) return;
    // Load news throughout the season, not just when season is complete
    setRefreshingNews(true);
    CMFirebaseHelper.getNews('league', league.id, 20, (response: { [name: string]: any }) => {
      setRefreshingNews(false);
      if (response.isSuccess && Array.isArray(response.value)) {
        setNewsArticles(response.value);
      }
    });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Validate league.id before fetching
      if (!league?.id || typeof league.id !== 'string' || league.id.trim().length === 0) {
        console.warn('CMLeagueDetailsScreen: Invalid league.id, skipping reload');
        return;
      }

      // Reload league data first to get updated teamsId, then reload teams
      CMFirebaseHelper.getLeague(league.id, (response: { [name: string]: any }) => {
        if (response.isSuccess && response.value) {
          // Ensure the league has a valid ID
          const updatedLeague = { ...league, ...response.value };
          if (!updatedLeague.id) {
            updatedLeague.id = league.id; // Preserve original ID if not in response
          }
          // Update state with latest league data
          setLeague(updatedLeague);
          // Update route params with latest league data
          route.params.league = updatedLeague;
          // Reload teams with updated teamsId
          loadTeams(updatedLeague.teamsId ?? []);
          loadPlayers(updatedLeague.teamsId ?? []);
          // Reload news throughout the season
          loadNews();
        } else {
          // Fallback to using existing league data if fetch fails
          loadTeams(league.teamsId ?? []);
        }
      });
    });

    return unsubscribe;
  }, [navigation, league.id]);

  useEffect(() => {
    if (teams.length > 0) {
      loadStandings();
    } else {
      setStandings([]);
    }
  }, [teams]);

  useEffect(() => {
    if (players.length > 0 && teams.length > 0) {
      loadPlayerStats();
    } else {
      setPlayerStats([]);
    }
  }, [players, teams]);

  const onEditTeam = (team: {[name: string]: any}) => {
    navigation.navigate(CMConstants.screenName.editTeam, {
      isEdit: true,
      team: team
    });
  };

  const onDeleteTeam = async (team: {[name: string]: any}) => {
    // Check permission before allowing delete (same as + button - only league creators can delete)
    if (league?.id) {
      const canDelete = await CMPermissionHelper.canEditLeague(league.id, league);
      if (!canDelete) {
        CMPermissionHelper.showPermissionDenied();
        return;
      }
    }

    CMAlertDlgHelper.showConfirmAlert(
      'Delete Team',
      `Are you sure you want to delete "${team.name}"? This will permanently delete the team and ALL associated data. This action cannot be undone.`,
      (confirmed: boolean) => {
        if (confirmed) {
          CMFirebaseHelper.deleteTeamWithAssociatedData(team.id, (response: {[name: string]: any}) => {
            if (response.isSuccess) {
              CMToast.makeText(toast, response.value);
              // Reload teams list after successful deletion
              loadTeams(league.teamsId ?? []);
            } else {
              CMToast.makeText(toast, response.value);
            }
          });
        }
      }
    );
  };

  const onViewTeam = (team: {[name: string]: any}) => {
    navigation.navigate(CMConstants.screenName.teamManagement, {
      team: team
    });
  };

  const TeamsTab = () => {
    // Check if current user is the league admin or has admin role
    // Works for both regular Firebase auth and Apple Sign In users
    const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
    const isAdmin = CMGlobal.user?.role === 'admin';
    const isLeagueAdmin = isAdmin || (league?.adminId && currentUserId && league.adminId === currentUserId);
    
    return (
      <View
        style={{
          flex: 1,
          paddingHorizontal: CMConstants.space.normal,
          backgroundColor: backgroundColor,
          paddingTop: CMConstants.space.small,
        }}
      >
        <CMRipple
          containerStyle={[
            styles.addTeamButton,
            !isLeagueAdmin && { opacity: 0.5 } // Disable visual style
          ]}
          onPress={() => {
            // Only allow adding team if user is the league admin
            if (!isLeagueAdmin) {
              CMAlertDlgHelper.showAlertWithOK('Only the league administrator can add teams to this league.');
              return;
            }
            navigation.navigate(CMConstants.screenName.editTeam, {
              isEdit: false,
              league: league,
              team: {}
            });
          }}
          disabled={!isLeagueAdmin} // Disable the button
        >
          <Ionicons 
            name="add" 
            size={CMConstants.height.icon} 
            color={isLeagueAdmin ? (isDarkMode ? CMConstants.color.white : CMConstants.color.black) : CMConstants.color.grey} 
          />
          <Text style={[
            styles.addTeamButtonText,
            { color: isLeagueAdmin ? (isDarkMode ? CMConstants.color.white : CMConstants.color.black) : CMConstants.color.grey}
          ]}>
            Add Team
          </Text>
        </CMRipple>
        
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { 
            color: textColor,
            fontSize: CMConstants.fontSize.smallEx * fontScale
          }]}>All teams</Text>
          <View style={[styles.teamsCountContainer, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor, borderWidth: 1 }]}>
            <Text style={[styles.teamsCountLabel, { color: labelColor }]}>
              {(league.teamsId ?? []).length}/{league.maxTeamSize} joined
            </Text>
          </View>
        </View>
        <FlatList
          style={{ flex: 0, marginBottom: insets.bottom }}
          refreshing={refreshingTeams}
          onRefresh={() => {
            loadTeams(league.teamsId ?? []);
          }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews
          data={teams.filter(team => team.name != null)}
          renderItem={({ item, separators }) => (
            <CMTeamCell
              team={item}
              onPress={() => {
                navigation.navigate(CMConstants.screenName.players, {
                  team: item,
                  players: players.filter(player => {
                    return player.teamId == item.id;
                  }),
                });
              }}
              onView={() => onViewTeam(item)}
              onEdit={() => onEditTeam(item)}
              onDelete={() => onDeleteTeam(item)}
            />
          )}
          ItemSeparatorComponent={({ highlighted }) => (
            <View style={{ height: CMConstants.space.smallEx }} />
          )}
        />
      </View>
    );
  };

  const StandingsTab = () => {
    // Check if current user is the league admin or has admin role (for playoffs control)
    const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
    const isAdmin = CMGlobal.user?.role === 'admin';
    const isLeagueAdmin = isAdmin || (league?.adminId && currentUserId && league.adminId === currentUserId);

    const [hasPlayoffMatches, setHasPlayoffMatches] = useState(false);
    const [isPlayoffsComplete, setIsPlayoffsComplete] = useState(false);

    // Check if playoff matches exist and if playoffs are complete
    useEffect(() => {
      if (league?.id && league?.seasonName) {
        CMFirebaseHelper.getMatches(league.id, (response: { [name: string]: any }) => {
          if (response.isSuccess && Array.isArray(response.value)) {
            const normalizedSeasonName = (league.seasonName || '').trim().toLowerCase();
            const playoffMatches = (response.value as any[]).filter(m => {
              const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
              const isPlayoff = !!m.isPlayoff;
              return isPlayoff && matchSeasonName === normalizedSeasonName;
            });
            setHasPlayoffMatches(playoffMatches.length > 0);
            
            // Check if playoffs are complete (final round match is finished)
            if (playoffMatches.length > 0) {
              // Find the highest round (final round)
              const rounds = playoffMatches.map(m => m.playoffRound || 1);
              const maxRound = Math.max(...rounds);
              const finalRoundMatches = playoffMatches.filter(m => (m.playoffRound || 1) === maxRound);
              
              // Final round should have only 1 match (2 teams)
              if (finalRoundMatches.length === 1) {
                const finalMatch = finalRoundMatches[0];
                const isFinalMatchFinished = finalMatch.status === CMConstants.gameStatus.finished;
                setIsPlayoffsComplete(isFinalMatchFinished);
              } else {
                setIsPlayoffsComplete(false);
              }
            } else {
              setIsPlayoffsComplete(false);
            }
          } else {
            setHasPlayoffMatches(false);
            setIsPlayoffsComplete(false);
          }
        });
      } else {
        setHasPlayoffMatches(false);
        setIsPlayoffsComplete(false);
      }
    }, [league?.id, league?.seasonName]);

    const canShowStartPlayoffs =
      !!league?.seasonName &&
      league?.enablePlayoffs !== false &&
      league?.regularSeasonEnded === true &&
      (!league?.playoffsStarted || !hasPlayoffMatches);

    const canShowPlayoffsInProgress =
      !!league?.seasonName &&
      league?.enablePlayoffs !== false &&
      league?.regularSeasonEnded === true &&
      league?.playoffsStarted === true &&
      hasPlayoffMatches &&
      !isPlayoffsComplete;

    const canShowSeasonComplete =
      !!league?.seasonName &&
      league?.enablePlayoffs !== false &&
      league?.regularSeasonEnded === true &&
      league?.playoffsStarted === true &&
      hasPlayoffMatches &&
      isPlayoffsComplete;

    const handleStartPlayoffs = () => {
      if (!isLeagueAdmin) {
        CMPermissionHelper.showPermissionDenied();
        return;
      }
      if (!league?.id) {
        return;
      }

      // Navigate to playoff bracket screen
      navigation.navigate(CMConstants.screenName.playoffBracket, {
        league: league,
        standings: standings,
      });
    };

    const handlePlayoffsInProgress = () => {
      if (!league?.id) {
        return;
      }

      navigation.navigate(CMConstants.screenName.playoffSchedule, {
        league: league,
        playoffTeams: league?.playoffTeams || 4,
      });
    };

    const handleSeasonComplete = () => {
      if (!league?.id) {
        return;
      }

      // Navigate to playoff schedule to show completion screen
      navigation.navigate(CMConstants.screenName.playoffSchedule, {
        league: league,
        playoffTeams: league?.playoffTeams || 4,
      });
    };

    return (
      <View
        style={{
          flex: 1,
          paddingHorizontal: CMConstants.space.normal,
          backgroundColor: backgroundColor,
          paddingTop: CMConstants.space.smallEx,
        }}
      >
        {/* Start / In-Progress Playoffs Button - At the top */}
        {canShowStartPlayoffs && (
          <CMRipple
            containerStyle={[
              styles.seasonHistoryButton,
              {
                backgroundColor: CMConstants.color.green,
                marginBottom: CMConstants.space.normal,
              },
            ]}
            onPress={handleStartPlayoffs}
          >
            <Ionicons
              name="trophy-outline"
              size={20 * iconScale}
              color={CMConstants.color.white}
              style={{ marginRight: CMConstants.space.smallEx }}
            />
            <Text style={[styles.seasonHistoryButtonText, { fontSize: 14 * fontScale }]}>Start Playoffs</Text>
          </CMRipple>
        )}

        {canShowPlayoffsInProgress && (
          <CMRipple
            containerStyle={[
              styles.seasonHistoryButton,
              {
                backgroundColor: CMConstants.color.darkGrey2,
                marginBottom: CMConstants.space.normal,
                borderWidth: 1,
                borderColor: CMConstants.color.green,
              },
            ]}
            onPress={handlePlayoffsInProgress}
          >
            <Ionicons
              name="trophy-outline"
              size={20 * iconScale}
              color={CMConstants.color.green}
              style={{ marginRight: CMConstants.space.smallEx }}
            />
            <Text style={[styles.seasonHistoryButtonText, { fontSize: 14 * fontScale, color: CMConstants.color.green }]}>
              Playoffs in Progress
            </Text>
          </CMRipple>
        )}


        <View style={[styles.standingsHeader, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
          <Text style={[styles.standingsHeaderText, { color: textColor }]}>Team</Text>
          <Text style={styles.standingsHeaderStat}>G</Text>
          <Text style={styles.standingsHeaderStat}>W</Text>
          <Text style={styles.standingsHeaderStat}>L</Text>
        </View>
        <FlatList
          style={{ flex: 0 }}
          refreshing={refreshingStandings}
          onRefresh={() => {
            if (teams.length > 0) {
              loadStandings();
            }
          }}
          initialNumToRender={standings.length}
          data={standings}
          renderItem={({ item, separators }) => (
            <CMStandingCell
              standing={item}
              onPress={() => {
                // navigation.navigate(CMConstants.screenName.leagueDetails, {league: item})
              }}
            />
          )}
          ItemSeparatorComponent={({ highlighted }) => (
            <View style={{ height: 0 }} />
          )}
          ListFooterComponent={
            <View>
              {/* Season Schedule Button - Current Season */}
              {league?.seasonName && !canShowStartPlayoffs && !isPlayoffsComplete && (
                <CMRipple
                  containerStyle={[
                    styles.seasonHistoryButton,
                    {
                      backgroundColor: CMConstants.color.green,
                      marginTop: CMConstants.space.normal,
                      marginBottom: CMConstants.space.smallEx,
                    },
                  ]}
                  onPress={() => {
                    navigation.navigate(CMConstants.screenName.seasonSchedule, {
                      league: league,
                    });
                  }}
                >
                  <Ionicons name="calendar-outline" size={20 * iconScale} color={CMConstants.color.white} style={{ marginRight: CMConstants.space.smallEx }} />
                  <Text style={[styles.seasonHistoryButtonText, { fontSize: 14 * fontScale }]}>Season Schedule</Text>
                </CMRipple>
              )}
              {/* Season History Button - All Seasons */}
              <CMRipple
                containerStyle={[
                  styles.seasonHistoryButton,
                  {
                    backgroundColor: CMConstants.color.green,
                    marginTop: league?.seasonName ? 0 : CMConstants.space.normal,
                    marginBottom: insets.bottom + CMConstants.space.normal,
                  },
                ]}
                onPress={() => {
                  navigation.navigate(CMConstants.screenName.seasonHistory, {
                    league: league,
                  });
                }}
              >
                <Ionicons name="time-outline" size={20 * iconScale} color={CMConstants.color.white} style={{ marginRight: CMConstants.space.smallEx }} />
                <Text style={[styles.seasonHistoryButtonText, { fontSize: 14 * fontScale }]}>Season History</Text>
              </CMRipple>
            </View>
          }
        />
      </View>
    );
  };

  const StatsTab = () => {
    return (
      <View
        style={{
          flex: 1,
          paddingHorizontal: CMConstants.space.normal,
          backgroundColor: backgroundColor,
          paddingTop: CMConstants.space.smallEx,
        }}
      >
        <View style={styles.statsHeader}>
          <Text style={[styles.statsHeaderPlayerText, { color: textColor }]}>Player</Text>
          <View style={styles.statsSortButtons}>
            <CMRipple
              containerStyle={[styles.statsSortButton, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }, statsIndex === 0 && styles.statsSortButtonActive]}
              onPress={() => {
                setStatsIndex(0);
                const stats: { [name: string]: any }[] = [...playerStats];
                stats.sort((stat1, stat2) => stat2.points - stat1.points);
                setPlayerStats(stats);
              }}
            >
              <Text style={[styles.statsSortButtonText, statsIndex === 0 && styles.statsSortButtonTextActive]}>
                P
              </Text>
            </CMRipple>
            <CMRipple
              containerStyle={[styles.statsSortButton, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }, statsIndex === 1 && styles.statsSortButtonActive]}
              onPress={() => {
                setStatsIndex(1);
                const stats: { [name: string]: any }[] = [...playerStats];
                stats.sort((stat1, stat2) => stat2.assists - stat1.assists);
                setPlayerStats(stats);
              }}
            >
              <Text style={[styles.statsSortButtonText, statsIndex === 1 && styles.statsSortButtonTextActive]}>
                A
              </Text>
            </CMRipple>
            <CMRipple
              containerStyle={[styles.statsSortButton, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }, statsIndex === 2 && styles.statsSortButtonActive]}
              onPress={() => {
                setStatsIndex(2);
                const stats: { [name: string]: any }[] = [...playerStats];
                stats.sort((stat1, stat2) => stat2.rebounds - stat1.rebounds);
                setPlayerStats(stats);
              }}
            >
              <Text style={[styles.statsSortButtonText, statsIndex === 2 && styles.statsSortButtonTextActive]}>
                R
              </Text>
            </CMRipple>
            <CMRipple
              containerStyle={[styles.statsSortButton, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }, statsIndex === 3 && styles.statsSortButtonActive]}
              onPress={() => {
                setStatsIndex(3);
                const stats: { [name: string]: any }[] = [...playerStats];
                stats.sort((stat1, stat2) => stat2.blocks - stat1.blocks);
                setPlayerStats(stats);
              }}
            >
              <Text style={[styles.statsSortButtonText, statsIndex === 3 && styles.statsSortButtonTextActive]}>
                B
              </Text>
            </CMRipple>
            <CMRipple
              containerStyle={[styles.statsSortButton, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }, statsIndex === 4 && styles.statsSortButtonActive]}
              onPress={() => {
                setStatsIndex(4);
                const stats: { [name: string]: any }[] = [...playerStats];
                stats.sort((stat1, stat2) => stat2.steals - stat1.steals);
                setPlayerStats(stats);
              }}
            >
              <Text style={[styles.statsSortButtonText, statsIndex === 4 && styles.statsSortButtonTextActive]}>
                S
              </Text>
            </CMRipple>
          </View>
        </View>
        <FlatList
          style={{ flex: 0, marginBottom: insets.bottom }}
          refreshing={refreshingStats}
          onRefresh={() => {
            loadPlayerStats();
          }}
          initialNumToRender={playerStats.length}
          data={playerStats}
          renderItem={({ item, index, separators }) => (
            <CMPlayerStatCell
              playerStat={item}
              index={index}
              onPress={() => {
                // navigation.navigate(CMConstants.screenName.leagueDetails, {league: item})
              }}
            />
          )}
          ItemSeparatorComponent={({ highlighted }) => (
            <View style={{ height: 0 }} />
          )}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      <View style={styles.leagueHeader}>
        <View style={styles.leagueImageContainer}>
          <CMProfileImage radius={50} imgURL={league.avatar} />
        </View>
        <View style={styles.leagueInfoContainer}>
          <Text style={[styles.leagueName, { 
            color: textColor,
            fontSize: CMConstants.fontSize.large * fontScale
          }]} numberOfLines={1}>
            {league.name}
          </Text>
          {(league.city || league.state || league.country) && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={labelColor} />
              <Text style={[styles.locationText, { color: labelColor }]} numberOfLines={1}>
                {[league.city, league.state, league.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          <View style={styles.leagueMetaRow}>
            {league.instagramUrl && (
              <CMRipple
                containerStyle={styles.socialIconButton}
                onPress={() => openUrl(league.instagramUrl, 'Instagram')}
              >
                <Ionicons
                  name={'logo-instagram'}
                  size={CMConstants.height.icon}
                  color={CMConstants.color.green}
                />
              </CMRipple>
            )}
            <View style={[styles.teamsCountBadge, { backgroundColor: cardBackgroundColor }]}>
              <Ionicons name="people" size={10} color={CMConstants.color.green} />
              <Text style={styles.teamsCountText}>
                {league.teamsId?.length || 0} {league.teamsId?.length >= 2 ? 'Teams' : 'Team'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Season Highlights Section - champion, top scorer, intense match, and regular news */}
      {(seasonChampion || topScorer || intenseMatch || (newsArticles && newsArticles.length > 0)) && (
        <View style={{ paddingTop: CMConstants.space.normal, paddingBottom: CMConstants.space.smallEx }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: CMConstants.space.normal,
              marginBottom: CMConstants.space.smallEx,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="flame"
                size={20 * iconScale}
                color={CMConstants.color.green}
                style={{ marginRight: CMConstants.space.smallEx }}
              />
              <Text
                style={{
                  color: textColor,
                  fontSize: (CMConstants.fontSize.medium + 2) * fontScale,
                  fontWeight: '700',
                }}
              >
                Season Highlights
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: CMConstants.space.normal,
              paddingRight: CMConstants.space.normal,
            }}
          >
            {/* Champion card */}
            {seasonChampion?.team && (
              <CMRipple
                containerStyle={{
                  width: screenWidth * 0.65,
                  borderRadius: CMConstants.radius.normal,
                  marginRight: CMConstants.space.small,
                  borderWidth: 1,
                  borderColor: cardBorderColor,
                  overflow: 'hidden',
                  backgroundColor: cardBackgroundColor,
                }}
                onPress={() => {
                  navigation.navigate(CMConstants.screenName.newsDetail, {
                    highlightType: 'champion',
                    league,
                    team: seasonChampion.team,
                    context: {
                      teamName: seasonChampion.team.name,
                      record: `${seasonChampion.win}-${seasonChampion.lose}`,
                    },
                  });
                }}
              >
                <Image source={championBG} style={{ width: '100%', height: 70 }} resizeMode="cover" />
                <View
                  style={{
                    paddingHorizontal: CMConstants.space.smallEx,
                    paddingVertical: CMConstants.space.smallEx - 2,
                  }}
                >
                  <Text
                    style={{
                      color: labelColor,
                      fontSize: 12 * fontScale,
                      textTransform: 'uppercase',
                      marginBottom: CMConstants.space.smallEx / 2,
                    }}
                  >
                    {league?.seasonComplete ? 'Season Champion' : 'The Team Leading'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CMProfileImage radius={22} imgURL={seasonChampion.team.avatar || league.avatar} />
                    <View style={{ marginLeft: CMConstants.space.smallEx, flex: 1 }}>
                      <Text
                        style={{ color: textColor, fontSize: 16 * fontScale, fontWeight: '700' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {seasonChampion.team.name}
                      </Text>
                      <Text style={{ color: labelColor, fontSize: 12 * fontScale }}>
                        {seasonChampion.win} W - {seasonChampion.lose} L
                      </Text>
                    </View>
                  </View>
                </View>
              </CMRipple>
            )}

            {/* Top scorer card */}
            {topScorer && (
              <CMRipple
                containerStyle={{
                  width: screenWidth * 0.65,
                  borderRadius: CMConstants.radius.normal,
                  marginRight: CMConstants.space.small,
                  borderWidth: 1,
                  borderColor: cardBorderColor,
                  overflow: 'hidden',
                  backgroundColor: cardBackgroundColor,
                }}
                onPress={() => {
                  navigation.navigate(CMConstants.screenName.newsDetail, {
                    highlightType: 'topScorer',
                    league,
                    player: topScorer.player,
                    team: topScorer.team,
                    context: {
                      playerName: topScorer.player?.name,
                      teamName: topScorer.team?.name,
                      pointsPerGame: topScorer.points,
                    },
                  });
                }}
              >
                <Image source={topScoreBG} style={{ width: '100%', height: 70 }} resizeMode="cover" />
                <View
                  style={{
                    paddingHorizontal: CMConstants.space.smallEx,
                    paddingVertical: CMConstants.space.smallEx - 2,
                  }}
                >
                  <Text
                    style={{
                      color: labelColor,
                      fontSize: 12 * fontScale,
                      textTransform: 'uppercase',
                      marginBottom: CMConstants.space.smallEx / 2,
                    }}
                  >
                    Top Scorer
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: CMConstants.space.smallEx }}>
                    <CMProfileImage radius={22} imgURL={topScorer.player?.avatar} isUser={true} />
                    <View style={{ marginLeft: CMConstants.space.smallEx, flex: 1 }}>
                      <Text
                        style={{ color: textColor, fontSize: 16 * fontScale, fontWeight: '700' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {topScorer.player?.name}
                      </Text>
                      <Text
                        style={{ color: labelColor, fontSize: 12 * fontScale }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {topScorer.team?.name || 'Unknown Team'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: CMConstants.color.green, fontSize: 14 * fontScale, fontWeight: '700' }}>
                    {topScorer.points?.toFixed ? topScorer.points.toFixed(1) : topScorer.points} PPG
                  </Text>
                </View>
              </CMRipple>
            )}

            {/* Most intense match card */}
            {intenseMatch && (
              <CMRipple
                containerStyle={{
                  width: screenWidth * 0.65,
                  borderRadius: CMConstants.radius.normal,
                  marginRight: CMConstants.space.small,
                  borderWidth: 1,
                  borderColor: cardBorderColor,
                  overflow: 'hidden',
                  backgroundColor: cardBackgroundColor,
                }}
                onPress={() => {
                  navigation.navigate(CMConstants.screenName.newsDetail, {
                    highlightType: 'intenseMatch',
                    league,
                    match: intenseMatch.match,
                    context: {
                      teamAName: intenseMatch.teamA?.name || 'Team A',
                      teamBName: intenseMatch.teamB?.name || 'Team B',
                      scoreLine: `${intenseMatch.match.teamAScore} - ${intenseMatch.match.teamBScore}`,
                      margin: intenseMatch.margin,
                    },
                  });
                }}
              >
                <Image source={intenseBG} style={{ width: '100%', height: 70 }} resizeMode="cover" />
                <View
                  style={{
                    paddingHorizontal: CMConstants.space.smallEx,
                    paddingVertical: CMConstants.space.smallEx - 2,
                  }}
                >
                  <Text
                    style={{
                      color: labelColor,
                      fontSize: 12 * fontScale,
                      textTransform: 'uppercase',
                      marginBottom: CMConstants.space.smallEx / 2,
                    }}
                  >
                    Most Intense Match
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: CMConstants.space.smallEx }}>
                    <CMProfileImage radius={18} imgURL={intenseMatch.teamA?.avatar} />
                    <Text
                      style={{
                        color: textColor,
                        fontSize: 14 * fontScale,
                        fontWeight: '700',
                        marginHorizontal: CMConstants.space.smallEx,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {intenseMatch.teamA?.name || 'Team A'} vs {intenseMatch.teamB?.name || 'Team B'}
                    </Text>
                    <CMProfileImage radius={18} imgURL={intenseMatch.teamB?.avatar} />
                  </View>
                  <Text style={{ color: textColor, fontSize: 14 * fontScale, fontWeight: '700' }}>
                    {intenseMatch.match.teamAScore} - {intenseMatch.match.teamBScore}
                  </Text>
                  <Text style={{ color: labelColor, fontSize: 12 * fontScale }}>
                    Decided by {intenseMatch.margin} pts
                  </Text>
                </View>
              </CMRipple>
            )}

            {/* Regular news article cards */}
            {newsArticles.map((newsItem: any) => {
              const scoreA = newsItem.matchData?.scoreA ?? 0;
              const scoreB = newsItem.matchData?.scoreB ?? 0;
              const teamAName = newsItem.matchData?.teamAName || 'Team A';
              const teamBName = newsItem.matchData?.teamBName || 'Team B';
              const teamAAvatar = newsItem.matchData?.teamAAvatar;
              const teamBAvatar = newsItem.matchData?.teamBAvatar;
              const topPlayerName = newsItem.matchData?.topPlayerName;
              const topPlayerPoints = newsItem.matchData?.topPlayerPoints;

              return (
                <CMRipple
                  key={newsItem.id}
                  containerStyle={{
                    width: screenWidth * 0.65,
                    borderRadius: CMConstants.radius.normal,
                    marginRight: CMConstants.space.small,
                    borderWidth: 1,
                    borderColor: cardBorderColor,
                    overflow: 'hidden',
                    backgroundColor: cardBackgroundColor,
                  }}
                  onPress={() => {
                    // Navigate to match detail or news detail
                    if (newsItem.matchId) {
                      CMFirebaseHelper.getMatch(newsItem.matchId, (matchResponse: { [name: string]: any }) => {
                        if (matchResponse.isSuccess && matchResponse.value) {
                          const match = matchResponse.value;
                          navigation.navigate(CMConstants.screenName.newsDetail, {
                            highlightType: 'intenseMatch',
                            league,
                            match: match,
                            context: {
                              teamAName: teamAName,
                              teamBName: teamBName,
                              scoreLine: `${scoreA} - ${scoreB}`,
                              margin: Math.abs(scoreA - scoreB),
                            },
                          });
                        }
                      });
                    }
                  }}
                >
                  <Image source={intenseBG} style={{ width: '100%', height: 70 }} resizeMode="cover" />
                  <View
                    style={{
                      paddingHorizontal: CMConstants.space.smallEx,
                      paddingVertical: CMConstants.space.smallEx - 2,
                    }}
                  >
                    <Text
                      style={{
                        color: labelColor,
                        fontSize: 11 * fontScale,
                        textTransform: 'uppercase',
                        marginBottom: CMConstants.space.smallEx / 2,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      Match Result
                    </Text>
                    <Text
                      style={{
                        color: textColor,
                        fontSize: 13 * fontScale,
                        fontWeight: '700',
                        marginBottom: CMConstants.space.smallEx / 2,
                      }}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {newsItem.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: CMConstants.space.smallEx / 2 }}>
                      <CMProfileImage radius={16} imgURL={teamAAvatar} />
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 12 * fontScale,
                          fontWeight: '600',
                          marginHorizontal: CMConstants.space.smallEx / 2,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {teamAName}
                      </Text>
                      <Text style={{ color: CMConstants.color.green, fontSize: 12 * fontScale, fontWeight: '700' }}>
                        {scoreA}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <CMProfileImage radius={16} imgURL={teamBAvatar} />
                      <Text
                        style={{
                          color: textColor,
                          fontSize: 12 * fontScale,
                          fontWeight: '600',
                          marginHorizontal: CMConstants.space.smallEx / 2,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {teamBName}
                      </Text>
                      <Text style={{ color: CMConstants.color.green, fontSize: 12 * fontScale, fontWeight: '700' }}>
                        {scoreB}
                      </Text>
                    </View>
                    {topPlayerName && topPlayerPoints != null && (
                      <Text
                        style={{
                          color: labelColor,
                          fontSize: 10 * fontScale,
                          marginTop: CMConstants.space.smallEx / 2,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {topPlayerName} {topPlayerPoints} pts
                      </Text>
                    )}
                  </View>
                </CMRipple>
              );
            })}
          </ScrollView>
        </View>
      )}

      <Tab.Navigator
        initialRouteName={initialTab}
        screenOptions={{
          tabBarStyle: {
            backgroundColor: tabBarBackgroundColor,
            borderTopColor: tabBarBorderColor,
            borderTopWidth: 1,
          },
          tabBarIndicatorStyle: { backgroundColor: CMConstants.color.green, height: 3 },
          tabBarLabelStyle: {
            fontFamily: CMConstants.font.semiBold,
            fontSize: CMConstants.fontSize.smallEx * fontScale,
            includeFontPadding: false,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          },
          tabBarActiveTintColor: CMConstants.color.green,
          tabBarInactiveTintColor: tabBarInactiveColor,
        }}
      >
        <Tab.Screen name="Teams" component={TeamsTab} />
        <Tab.Screen name="Standings" component={StandingsTab} />
        <Tab.Screen name="Stats" component={StatsTab} />
      </Tab.Navigator>
    </SafeAreaView>
  );
};

const styles = {
  leagueHeader: {
    flexDirection: 'row' as const,
    padding: CMConstants.space.smallEx,
    paddingTop: CMConstants.space.smallEx,
    alignItems: 'center' as const,
  } as ViewStyle,
  leagueImageContainer: {
    borderWidth: 2,
    borderColor: CMConstants.color.green,
    borderRadius: 50,
    padding: 2,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  leagueInfoContainer: {
    flex: 1,
    marginLeft: CMConstants.space.smallEx,
  },
  leagueName: {
    // fontSize is now set dynamically in component
    fontWeight: 'bold' as const,
    color: CMConstants.color.white,
    fontFamily: CMConstants.font.bold,
    marginBottom: CMConstants.space.smallEx - 2,
  },
  locationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: CMConstants.space.smallEx - 2,
  },
  locationText: {
    fontSize: CMConstants.fontSize.smallEx * 0.9,
    color: CMConstants.color.semiLightGrey,
    fontFamily: CMConstants.font.regular,
    marginLeft: 4,
  },
  leagueMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: CMConstants.space.smallEx - 2,
  },
  socialIconButton: {
    ...CMCommonStyles.circle(CMConstants.height.iconBig),
    borderWidth: 2,
    borderColor: CMConstants.color.green,
    backgroundColor: CMConstants.color.darkGrey2,
    alignItems: 'center' as const,
    justifyContent: 'center',
    marginRight: CMConstants.space.smallEx,
  },
  teamsCountBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: CMConstants.color.darkGrey2,
    paddingHorizontal: CMConstants.space.smallEx - 2,
    paddingVertical: 2,
    borderRadius: CMConstants.radius.smallEx - 1,
    borderWidth: 1,
    borderColor: CMConstants.color.green,
  },
  teamsCountText: {
    fontSize: CMConstants.fontSize.smallEx - 1,
    color: CMConstants.color.green,
    fontFamily: CMConstants.font.semiBold,
    marginLeft: 3,
  },
  addTeamButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center',
    backgroundColor: CMConstants.color.green,
    height: CMConstants.height.buttonNormal * 0.9,
    paddingHorizontal: CMConstants.space.smallEx,
    borderRadius: CMConstants.radius.normal,
    marginBottom: CMConstants.space.smallEx,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    gap: CMConstants.space.smallEx,
  } as ViewStyle,
  addTeamButtonText: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.bold,
    letterSpacing: 0.3,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.smallEx - 2,
    marginBottom: CMConstants.space.smallEx - 2,
  } as ViewStyle,
  sectionHeaderText: {
    // fontSize is now set dynamically in component
    fontWeight: '600' as const,
    color: CMConstants.color.white,
    fontFamily: CMConstants.font.semiBold,
  },
  teamsCountContainer: {
    backgroundColor: CMConstants.color.darkGrey2,
    paddingHorizontal: CMConstants.space.smallEx - 2,
    paddingVertical: 2,
    borderRadius: CMConstants.radius.smallEx - 1,
    borderWidth: 1,
    borderColor: CMConstants.color.darkGrey3,
  },
  teamsCountLabel: {
    fontSize: CMConstants.fontSize.smallEx - 1,
    color: CMConstants.color.semiLightGrey,
    fontFamily: CMConstants.font.regular,
  },
  standingsHeader: {
    flexDirection: 'row' as const,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.smallEx,
    backgroundColor: CMConstants.color.darkGrey2,
    borderRadius: CMConstants.radius.smallEx,
    marginBottom: CMConstants.space.smallEx,
    borderWidth: 1,
    borderColor: CMConstants.color.darkGrey3,
  } as ViewStyle,
  standingsHeaderText: {
    flex: 1,
    fontSize: CMConstants.fontSize.small,
    fontWeight: '600' as const,
    color: CMConstants.color.white,
    fontFamily: CMConstants.font.semiBold,
  },
  standingsHeaderStat: {
    width: 50,
    textAlign: 'center' as const,
    fontSize: CMConstants.fontSize.small,
    fontWeight: '600' as const,
    color: CMConstants.color.green,
    fontFamily: CMConstants.font.semiBold,
  },
  statsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.smallEx,
    marginBottom: CMConstants.space.smallEx,
  } as ViewStyle,
  statsHeaderPlayerText: {
    flex: 1,
    fontSize: CMConstants.fontSize.small,
    fontWeight: '600' as const,
    color: CMConstants.color.white,
    fontFamily: CMConstants.font.semiBold,
  },
  statsSortButtons: {
    flexDirection: 'row' as const,
    gap: CMConstants.space.smallEx / 2,
  },
  statsSortButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center',
    borderWidth: 1,
  } as ViewStyle,
  statsSortButtonActive: {
    backgroundColor: CMConstants.color.green,
    borderColor: CMConstants.color.green,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  } as ViewStyle,
  statsSortButtonText: {
    fontSize: CMConstants.fontSize.smallEx,
    fontWeight: '600' as const,
    color: CMConstants.color.semiLightGrey,
    fontFamily: CMConstants.font.semiBold,
  },
  statsSortButtonTextActive: {
    color: CMConstants.color.white,
    fontWeight: '700' as const,
  },
  seasonHistoryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.normal,
  },
  seasonHistoryButtonText: {
    color: CMConstants.color.white,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
};

export default CMLeagueDetailsScreen;

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Modal, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMConstants from '../CMConstants';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMProfileImage from '../components/CMProfileImage';
import CMGlobal from '../CMGlobal';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMRipple from '../components/CMRipple';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, query, where } from '@react-native-firebase/firestore';
import { getFirestore } from '@react-native-firebase/firestore';

interface Player {
  id: string;
  name: string;
  avatar?: string;
  teamId: string;
}

interface Team {
  id: string;
  name: string;
  avatar?: string;
}

interface PlayerStat {
  playerId: string;
  pointsPerGame?: number;
  points?: number;
  assists?: number;
  rebounds?: number;
  steals?: number;
  blocks?: number;
  matchId?: string;
}

interface PlayerAverage {
  player: Player;
  team: Team;
  pointsPerGame: number;
  assistsPerGame: number;
  reboundsPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  defensiveScore: number;
  mvpScore: number;
  games: number;
}

interface Award {
  type: 'MVP' | 'Defensive Player' | 'Most Improved' | 'Scoring Leader';
  player: Player;
  team: Team;
  value: number;
  label: string;
  playerAverage?: PlayerAverage;
}

const CMSeasonCompleteScreen = ({ navigation, route }: CMNavigationProps) => {
  const league = route.params?.league || {};
  const seasonName = league?.seasonName || '';
  const fromHistory = route.params?.fromHistory === true;
  const insets = useSafeAreaInsets();
  const themeMode = CMGlobal.themeMode || CMConstants.themeMode.light;
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const labelColor = isDarkMode ? CMConstants.color.lightGrey : CMConstants.color.darkGrey;
  
  const [loading, setLoading] = useState(true);
  const [awards, setAwards] = useState<Award[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedAward, setSelectedAward] = useState<Award | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [seasonStartDate, setSeasonStartDate] = useState<Date | null>(null);
  const [seasonEndDate, setSeasonEndDate] = useState<Date | null>(null);
  
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;

    navigation.setOptions({
      title: 'Season Awards',
      headerTitleStyle: {
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold' as const,
      },
      headerLeft: () => (
        <CMRipple
          containerStyle={{
            marginLeft: CMConstants.space.smallEx,
            padding: CMConstants.space.smallEx,
          }}
          onPress={() => {
            // If opened from history, simply go back. Otherwise, go to league details.
            if (fromHistory) {
              navigation.goBack();
              return;
            }

            if (league?.id) {
              navigation.navigate(CMConstants.screenName.leagueDetails, {
                league: league,
              });
            } else {
              navigation.goBack();
            }
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
  }, [navigation, league, isDarkMode, fromHistory]);

  useEffect(() => {
    if (!league?.id || !seasonName) {
      setLoading(false);
      return;
    }

    loadSeasonAwards();
  }, [league?.id, seasonName]);

  const loadSeasonAwards = async () => {
    if (!league?.id || !seasonName) return;

    setLoading(true);
    try {
      // Load teams
      CMFirebaseHelper.getTeamsByLeague(league.id, (teamsResponse: { [name: string]: any }) => {
        if (!teamsResponse.isSuccess || !Array.isArray(teamsResponse.value)) {
          setLoading(false);
          return;
        }

        const teamsList = teamsResponse.value as Team[];
        setTeams(teamsList);
        const teamIds = teamsList.map(t => t.id);

        if (teamIds.length === 0) {
          setLoading(false);
          return;
        }

        // Load players
        CMFirebaseHelper.getPlayers(teamIds, (playersResponse: { [name: string]: any }) => {
          if (!playersResponse.isSuccess || !Array.isArray(playersResponse.value)) {
            setLoading(false);
            return;
          }

          const playersList = playersResponse.value as Player[];
          setPlayers(playersList);

          // Load matches for this season to get match IDs
          CMFirebaseHelper.getMatches(league.id, (matchesResponse: { [name: string]: any }) => {
            if (!matchesResponse.isSuccess || !Array.isArray(matchesResponse.value)) {
              setLoading(false);
              return;
            }

            const allMatches = matchesResponse.value as any[];
            const normalizedSeasonName = (seasonName || '').trim().toLowerCase();

            // Filter matches for this season
            const seasonMatches = allMatches.filter(m => {
              const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
              return matchSeasonName === normalizedSeasonName;
            });

            const seasonMatchIds = seasonMatches.map(m => m.id);

            // Compute season start/end dates from matches
            if (seasonMatches.length > 0) {
              const matchDates: Date[] = seasonMatches
                .map(m => {
                  const dt = m.dateTime;
                  if (!dt) return null;
                  // Firestore Timestamp
                  if (dt.toDate) {
                    return dt.toDate();
                  }
                  // JS Date
                  if (dt instanceof Date) {
                    return dt;
                  }
                  // Fallback parse
                  return new Date(dt);
                })
                .filter(Boolean) as Date[];

              if (matchDates.length > 0) {
                matchDates.sort((a, b) => a.getTime() - b.getTime());
                setSeasonStartDate(matchDates[0]);
                setSeasonEndDate(matchDates[matchDates.length - 1]);
              }
            }

            if (seasonMatchIds.length === 0) {
              setLoading(false);
              return;
            }

            // Load player stats for this season (filter by match IDs)
            const playerStatsQuery = query(
              collection(getFirestore(), 'playerStats'),
              where('leagueId', '==', league.id)
            );

            getDocs(playerStatsQuery)
              .then(snapshot => {
                const allStats: PlayerStat[] = [];
                snapshot.forEach((statDoc: any) => {
                  const stat = statDoc.data() as PlayerStat;
                  // Filter by season match IDs
                  if (stat.matchId && seasonMatchIds.includes(stat.matchId)) {
                    allStats.push(stat);
                  }
                });

                // Calculate player aggregates
                const playerStatsMap = new Map<string, {
                  points: number;
                  assists: number;
                  rebounds: number;
                  steals: number;
                  blocks: number;
                  games: number;
                }>();

                allStats.forEach(stat => {
                  const existing = playerStatsMap.get(stat.playerId) || {
                    points: 0,
                    assists: 0,
                    rebounds: 0,
                    steals: 0,
                    blocks: 0,
                    games: 0,
                  };

                  existing.points += stat.pointsPerGame || stat.points || 0;
                  existing.assists += stat.assists || 0;
                  existing.rebounds += stat.rebounds || 0;
                  existing.steals += stat.steals || 0;
                  existing.blocks += stat.blocks || 0;
                  existing.games += 1;

                  playerStatsMap.set(stat.playerId, existing);
                });

                // Calculate averages and awards
                const playerAverages: Array<{
                  player: Player;
                  team: Team;
                  pointsPerGame: number;
                  assistsPerGame: number;
                  reboundsPerGame: number;
                  stealsPerGame: number;
                  blocksPerGame: number;
                  defensiveScore: number;
                  mvpScore: number;
                  games: number;
                }> = [];

                playerStatsMap.forEach((stats, playerId) => {
                  const player = playersList.find(p => p.id === playerId);
                  if (!player || stats.games === 0) return;

                  const team = teamsList.find(t => t.id === player.teamId);
                  if (!team) return;

                  const pointsPerGame = stats.points / stats.games;
                  const assistsPerGame = stats.assists / stats.games;
                  const reboundsPerGame = stats.rebounds / stats.games;
                  const stealsPerGame = stats.steals / stats.games;
                  const blocksPerGame = stats.blocks / stats.games;

                  // MVP Score: weighted combination of points, assists, rebounds
                  const mvpScore = pointsPerGame * 1.0 + assistsPerGame * 0.5 + reboundsPerGame * 0.5;

                  // Defensive Score: steals + blocks
                  const defensiveScore = stealsPerGame + blocksPerGame;

                  playerAverages.push({
                    player,
                    team,
                    pointsPerGame,
                    assistsPerGame,
                    reboundsPerGame,
                    stealsPerGame,
                    blocksPerGame,
                    defensiveScore,
                    mvpScore,
                    games: stats.games,
                  });
                });

                // Calculate awards
                const calculatedAwards: Award[] = [];

                // MVP - Highest MVP score
                if (playerAverages.length > 0) {
                  const mvp = playerAverages.reduce((best, current) => 
                    current.mvpScore > best.mvpScore ? current : best
                  );
                  calculatedAwards.push({
                    type: 'MVP',
                    player: mvp.player,
                    team: mvp.team,
                    value: mvp.mvpScore,
                    label: `${mvp.pointsPerGame.toFixed(1)} PPG`,
                    playerAverage: mvp,
                  });
                }

                // Defensive Player - Highest defensive score
                if (playerAverages.length > 0) {
                  const defensive = playerAverages.reduce((best, current) => 
                    current.defensiveScore > best.defensiveScore ? current : best
                  );
                  calculatedAwards.push({
                    type: 'Defensive Player',
                    player: defensive.player,
                    team: defensive.team,
                    value: defensive.defensiveScore,
                    label: `${defensive.stealsPerGame.toFixed(1)} SPG, ${defensive.blocksPerGame.toFixed(1)} BPG`,
                    playerAverage: defensive,
                  });
                }

                // Most Improved - Player with most games played (proxy for improvement/consistency)
                // Alternative: could use improvement over time if we had historical data
                if (playerAverages.length > 0) {
                  const mostImproved = playerAverages.reduce((best, current) => 
                    current.games > best.games ? current : best
                  );
                  calculatedAwards.push({
                    type: 'Most Improved',
                    player: mostImproved.player,
                    team: mostImproved.team,
                    value: mostImproved.games,
                    label: `${mostImproved.games} games`,
                    playerAverage: mostImproved,
                  });
                }

                // Scoring Leader - Highest points per game
                if (playerAverages.length > 0) {
                  const scoring = playerAverages.reduce((best, current) => 
                    current.pointsPerGame > best.pointsPerGame ? current : best
                  );
                  calculatedAwards.push({
                    type: 'Scoring Leader',
                    player: scoring.player,
                    team: scoring.team,
                    value: scoring.pointsPerGame,
                    label: `${scoring.pointsPerGame.toFixed(1)} PPG`,
                    playerAverage: scoring,
                  });
                }

                setAwards(calculatedAwards);
                setLoading(false);
              })
              .catch(error => {
                console.error('Error loading player stats:', error);
                setLoading(false);
              });
          });
        });
      });
    } catch (error) {
      console.error('Error loading season awards:', error);
      setLoading(false);
    }
  };

  const formatSeasonDateRange = (start: Date | null, end: Date | null): string => {
    if (!start || !end) {
      return '';
    }
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString(undefined, options);
    const endStr = end.toLocaleDateString(undefined, options);
    return `${startStr} - ${endStr}`;
  };

  const getAwardIcon = (type: string) => {
    switch (type) {
      case 'MVP':
        return 'trophy';
      case 'Defensive Player':
        return 'shield';
      case 'Most Improved':
        return 'arrow-up';
      case 'Scoring Leader':
        return 'basketball';
      default:
        return 'trophy';
    }
  };

  const getAwardIconColor = (type: string) => {
    switch (type) {
      case 'MVP':
        return '#FFD700'; // Gold
      case 'Defensive Player':
        return '#4A90E2'; // Blue
      case 'Most Improved':
        return '#FFD700'; // Gold
      case 'Scoring Leader':
        return '#FF6B35'; // Orange
      default:
        return CMConstants.color.green;
    }
  };

  const handleViewAward = (award: Award) => {
    setSelectedAward(award);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedAward(null);
  };

  const handleViewPlayerDetails = () => {
    if (selectedAward) {
      handleCloseModal();
      navigation.navigate(CMConstants.screenName.playerDetails, {
        player: selectedAward.player,
        league: league,
      });
    }
  };


  const getAwardTitle = (type: string): string => {
    switch (type) {
      case 'MVP':
        return 'SEASON MVP';
      case 'Defensive Player':
        return 'DEFENSIVE PLAYER';
      case 'Most Improved':
        return 'MOST IMPROVED PLAYER';
      case 'Scoring Leader':
        return 'SCORING LEADER';
      default:
        return type.toUpperCase();
    }
  };

  const getAwardStatsText = (award: Award): string => {
    if (!award.playerAverage) return award.label;

    const avg = award.playerAverage;
    switch (award.type) {
      case 'MVP':
        return `${avg.pointsPerGame.toFixed(1)} PPG | ${avg.reboundsPerGame.toFixed(1)} RPG | ${avg.assistsPerGame.toFixed(1)} APG`;
      case 'Defensive Player':
        return `${avg.reboundsPerGame.toFixed(1)} RPG | ${avg.blocksPerGame.toFixed(1)} BPG | ${avg.stealsPerGame.toFixed(1)} SPG`;
      case 'Most Improved':
        return `${avg.pointsPerGame.toFixed(1)} PPG | ${avg.reboundsPerGame.toFixed(1)} RPG | ${avg.assistsPerGame.toFixed(1)} APG`;
      case 'Scoring Leader':
        return `${avg.pointsPerGame.toFixed(1)} PPG | ${avg.reboundsPerGame.toFixed(1)} RPG | ${avg.assistsPerGame.toFixed(1)} APG`;
      default:
        return award.label;
    }
  };

  if (loading) {
    return (
      <View style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor, flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={CMConstants.color.green} />
        <Text style={{ color: labelColor, marginTop: CMConstants.space.normal }}>Loading season awards...</Text>
      </View>
    );
  }

  return (
    <View style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor, flex: 1 }]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + CMConstants.space.normal,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Season Complete Banner */}
        <View
          style={{
            backgroundColor: cardBackgroundColor,
            paddingVertical: CMConstants.space.normal,
            paddingHorizontal: CMConstants.space.normal,
            marginBottom: CMConstants.space.normal,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Confetti effect - simple dots */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}>
            {[...Array(20)].map((_, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#FFD700',
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                }}
              />
            ))}
          </View>
          
          <CMRipple
            containerStyle={{
              backgroundColor: CMConstants.color.green,
              paddingVertical: CMConstants.space.smallEx,
              borderRadius: CMConstants.radius.normal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => {}}
          >
            <Text style={{ color: CMConstants.color.white, fontSize: 16, fontWeight: '700' }}>
              Season Complete
            </Text>
          </CMRipple>
        </View>

        {/* Season Awards Section */}
        <View style={{ paddingHorizontal: CMConstants.space.normal }}>
          <Text style={{ color: textColor, fontSize: 24, fontWeight: '700', marginBottom: CMConstants.space.normal }}>
            Season Awards
          </Text>

          {awards.length === 0 ? (
            <View style={{ padding: CMConstants.space.normal, alignItems: 'center' }}>
              <Text style={{ color: labelColor, fontSize: 14, textAlign: 'center' }}>
                No awards available. Player stats may not be recorded for this season.
              </Text>
            </View>
          ) : (
            awards.map((award, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: cardBackgroundColor,
                  borderColor: cardBorderColor,
                  borderWidth: 1,
                  borderRadius: CMConstants.radius.normal,
                  padding: CMConstants.space.normal,
                  marginBottom: CMConstants.space.smallEx,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {/* Award Icon */}
                <View style={{ marginRight: CMConstants.space.normal }}>
                  <Ionicons
                    name={getAwardIcon(award.type)}
                    size={32}
                    color={getAwardIconColor(award.type)}
                  />
                </View>

                {/* Award Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textColor, fontSize: 16, fontWeight: '700' }}>
                    {award.type}
                  </Text>
                  <Text style={{ color: textColor, fontSize: 14, fontWeight: '600', marginTop: 2 }}>
                    {award.player.name}
                  </Text>
                  <Text style={{ color: labelColor, fontSize: 12, marginTop: 2 }}>
                    {award.team.name}
                  </Text>
                </View>

                {/* View Button */}
                <CMRipple
                  containerStyle={{
                    backgroundColor: CMConstants.color.green,
                    paddingVertical: CMConstants.space.smallEx / 2,
                    paddingHorizontal: CMConstants.space.normal,
                    borderRadius: CMConstants.radius.small,
                  }}
                  onPress={() => handleViewAward(award)}
                >
                  <Text style={{ color: CMConstants.color.white, fontSize: 12, fontWeight: '600' }}>
                    View
                  </Text>
                </CMRipple>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Award Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: CMConstants.space.normal,
          }}
        >
          {selectedAward ? (
            <View
              style={{
                width: '100%',
                maxWidth: screenWidth * 0.9,
                height: screenHeight * 0.75,
                backgroundColor: backgroundColor,
                borderRadius: CMConstants.radius.normal,
                overflow: 'hidden',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: CMConstants.space.normal,
                  paddingVertical: CMConstants.space.smallEx, // shorter title bar
                  backgroundColor: cardBackgroundColor,
                  borderBottomWidth: 1,
                  borderBottomColor: cardBorderColor,
                }}
              >
                <CMRipple
                  containerStyle={{
                    padding: CMConstants.space.smallEx,
                  }}
                  onPress={handleCloseModal}
                >
                  <Ionicons name="close" size={24} color={textColor} />
                </CMRipple>
                <Text
                  style={{
                    color: textColor,
                    fontSize: 16, // smaller title text
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    flex: 1,
                    textAlign: 'center',
                    marginRight: 40, // Balance the close button
                  }}
                  numberOfLines={1} // single line title
                  ellipsizeMode="tail"
                >
                  {getAwardTitle(selectedAward.type)}
                </Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Content */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  padding: CMConstants.space.normal,
                  alignItems: 'center',
                  paddingBottom: CMConstants.space.normal * 2,
                }}
                showsVerticalScrollIndicator={false}
              >
                {/* Player Image */}
                <CMProfileImage
                  radius={120}
                  imgURL={selectedAward.player.avatar}
                  isUser={true}
                />

                {/* Season name and date range with line separator */}
                <View
                  style={{
                    width: '100%',
                    alignItems: 'center',
                    marginTop: CMConstants.space.normal,
                  }}
                >
                  <View
                    style={{
                      width: '90%',
                      height: 1,
                      backgroundColor: cardBorderColor,
                      marginBottom: CMConstants.space.smallEx,
                    }}
                  />
                  {/* Season name */}
                  {seasonName ? (
                    <Text
                      style={{
                        color: textColor,
                        fontSize: 17,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {seasonName}
                    </Text>
                  ) : null}
                  {/* Date range */}
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 15,
                      fontWeight: '600',
                      letterSpacing: 1.2,
                      marginTop: seasonName ? CMConstants.space.smallEx / 4 : 0,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {seasonStartDate && seasonEndDate
                      ? formatSeasonDateRange(seasonStartDate, seasonEndDate)
                      : ''}
                  </Text>
                </View>

                {/* Player Name */}
                <Text
                  style={{
                    color: textColor,
                    fontSize: 28,
                    fontWeight: '700',
                    marginTop: CMConstants.space.normal,
                    textAlign: 'center',
                  }}
                >
                  {selectedAward.player.name}
                </Text>

                {/* Team Name */}
                <Text
                  style={{
                    color: textColor,
                    fontSize: 16,
                    marginTop: CMConstants.space.smallEx,
                    textAlign: 'center',
                  }}
                >
                  {selectedAward.team.name}
                </Text>

                {/* Stats with line separator */}
                <View
                  style={{
                    width: '100%',
                    alignItems: 'center',
                    marginTop: CMConstants.space.normal,
                  }}
                >
                  <View
                    style={{
                      width: '90%',
                      height: 1,
                      backgroundColor: cardBorderColor,
                      marginBottom: CMConstants.space.smallEx,
                    }}
                  />
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 16,
                      textAlign: 'center',
                    }}
                  >
                    {getAwardStatsText(selectedAward)}
                  </Text>
                </View>
              </ScrollView>

              {/* Detail View Button */}
              <View
                style={{
                  padding: CMConstants.space.normal,
                }}
              >
                <CMRipple
                  containerStyle={{
                    width: '100%',
                    backgroundColor: CMConstants.color.green,
                    paddingVertical: CMConstants.space.smallEx,
                    borderRadius: CMConstants.radius.normal,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={handleViewPlayerDetails}
                >
                  <Text
                    style={{
                      color: CMConstants.color.white,
                      fontSize: 16,
                      fontWeight: '700',
                    }}
                  >
                    DETAIL VIEW
                  </Text>
                </CMRipple>
              </View>
            </View>
          ) : (
            <View style={{ padding: CMConstants.space.normal }}>
              <Text style={{ color: textColor }}>Loading award details...</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

export default CMSeasonCompleteScreen;

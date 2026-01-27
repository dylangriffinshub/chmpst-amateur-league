import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Dimensions, SafeAreaView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMConstants from '../CMConstants';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMGlobal from '../CMGlobal';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMRipple from '../components/CMRipple';
import CMProfileImage from '../components/CMProfileImage';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import { getAuth } from '@react-native-firebase/auth';
import CMPermissionHelper from '../helper/CMPermissionHelper';

interface BracketTeam {
  id: string;
  name: string;
  record: string;
  seed: number;
  avatar?: string;
}

interface BracketMatchup {
  id: string;
  round: number;
  position: number;
  teamA?: BracketTeam;
  teamB?: BracketTeam;
  scoreA?: number;
  scoreB?: number;
  winner?: 'A' | 'B';
}

const CMPlayoffBracketScreen = ({ navigation, route }: CMNavigationProps) => {
  const league = route.params?.league || {};
  const initialStandings = route.params?.standings || [];
  const insets = useSafeAreaInsets();
  
  const [standings, setStandings] = useState<any[]>(initialStandings);
  const [bracket, setBracket] = useState<BracketMatchup[]>([]);
  const [loading, setLoading] = useState(false);

  const themeMode = CMGlobal.themeMode || CMConstants.themeMode.light;
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;

  const screenWidth = Dimensions.get('window').width;
  const isSmallDevice = screenWidth < 375;
  const isLargeDevice = screenWidth > 414;
  const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;
  const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0;
  const CONNECTOR_HEIGHT = CMConstants.space.large;

  // Check if user is admin
  const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
  const isAdmin = CMGlobal.user?.role === 'admin';
  const isLeagueAdmin = isAdmin || (league?.adminId && currentUserId && league.adminId === currentUserId);

  // Get playoff teams count from league settings
  const playoffTeams = league?.playoffTeams || 4;
  const enablePlayoffs = league?.enablePlayoffs !== false;

  // Generate bracket from standings
  const generateBracket = useMemo(() => {
    if (!standings || standings.length === 0 || !enablePlayoffs) {
      return [];
    }

    // Get top N teams (where N = playoffTeams)
    const topTeams = standings.slice(0, playoffTeams);
    
    if (topTeams.length < 2) {
      return [];
    }

    const matchups: BracketMatchup[] = [];
    
    // Generate first round matchups: 1st vs 4th, 2nd vs 3rd, etc.
    // Highest seed vs lowest seed pattern
    const numFirstRoundGames = Math.floor(playoffTeams / 2);
    const firstRoundMatchups: BracketMatchup[] = [];
    
    for (let i = 0; i < numFirstRoundGames; i++) {
      const teamAIndex = i; // Higher seed (1st, 2nd, 3rd...)
      const teamBIndex = playoffTeams - 1 - i; // Lower seed (4th, 3rd, 2nd...)
      
      if (teamAIndex < topTeams.length && teamBIndex < topTeams.length && teamAIndex < teamBIndex) {
        const teamA = topTeams[teamAIndex];
        const teamB = topTeams[teamBIndex];
        
        firstRoundMatchups.push({
          id: `round1-${i}`,
          round: 1,
          position: i,
          teamA: {
            id: teamA.team?.id || '',
            name: teamA.team?.name || 'TBD',
            record: `${teamA.win || 0}-${teamA.lose || 0}`,
            seed: teamAIndex + 1,
            avatar: teamA.team?.avatar || '',
          },
          teamB: {
            id: teamB.team?.id || '',
            name: teamB.team?.name || 'TBD',
            record: `${teamB.win || 0}-${teamB.lose || 0}`,
            seed: teamBIndex + 1,
            avatar: teamB.team?.avatar || '',
          },
        });
      }
    }

    matchups.push(...firstRoundMatchups);

    // Generate subsequent rounds (semi-finals, finals, etc.)
    let currentRound = 1;
    let currentRoundMatchups = firstRoundMatchups.length;
    
    while (currentRoundMatchups > 1) {
      currentRound++;
      const nextRoundMatchups: BracketMatchup[] = [];
      const numNextRoundGames = Math.floor(currentRoundMatchups / 2);
      
      for (let i = 0; i < numNextRoundGames; i++) {
        nextRoundMatchups.push({
          id: `round${currentRound}-${i}`,
          round: currentRound,
          position: i,
        });
      }
      
      matchups.push(...nextRoundMatchups);
      currentRoundMatchups = nextRoundMatchups.length;
    }

    return matchups;
  }, [standings, playoffTeams, enablePlayoffs]);

  useEffect(() => {
    setBracket(generateBracket);
  }, [generateBracket]);

  useEffect(() => {
    navigation.setOptions({
      title: league?.name || 'Playoffs',
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
  }, [navigation, league, headerBackgroundColor, headerTextColor]);

  const handleGenerateBracket = async () => {
    if (!isLeagueAdmin) {
      CMPermissionHelper.showPermissionDenied();
      return;
    }

    if (!league?.id) {
      return;
    }

    CMAlertDlgHelper.showConfirmAlert(
      'Generate Bracket',
      'This will generate the playoff bracket and start the playoffs. Continue?',
      async (isYes: boolean) => {
        if (!isYes) {
          return;
        }

        setLoading(true);
        
        // Update league to mark playoffs as started
        CMFirebaseHelper.updateLeague(
          league.id,
          {
            playoffsStarted: true,
          },
          (response: { [name: string]: any }) => {
            setLoading(false);
            if (response.isSuccess) {
              const updatedLeague = { ...league, playoffsStarted: true };
              navigation.navigate(CMConstants.screenName.playoffSchedule, {
                league: updatedLeague,
                bracket,
                playoffTeams,
              });
            } else {
              CMAlertDlgHelper.showAlertWithOK(response.value || 'Failed to generate bracket.');
            }
          },
        );
      },
    );
  };

  const renderMatchup = (matchup: BracketMatchup, index: number, totalInRound: number) => {
    const isFinal = matchup.round === Math.ceil(Math.log2(playoffTeams));
    const hasTeams = !!matchup.teamA && !!matchup.teamB;
    
    return (
      <View
        key={matchup.id}
        style={{
          marginBottom: index < totalInRound - 1 ? CMConstants.space.normal : 0,
          alignItems: 'center',
        }}
      >
        {/* Actual matchup card: one model per match (two teams + score placeholder) */}
        {hasTeams && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: cardBackgroundColor,
              borderColor: cardBorderColor,
              borderWidth: 1,
              borderRadius: CMConstants.radius.normal,
              paddingVertical: CMConstants.space.smallEx,
              paddingHorizontal: CMConstants.space.smallEx,
              minWidth: 180,
              maxWidth: 220,
            }}
          >
            {/* Teams column */}
            <View style={{ flex: 1, marginRight: CMConstants.space.smallEx }}>
              {/* Team A row (logo + name) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <CMProfileImage
                  radius={20}
                  imgURL={matchup.teamA!.avatar || ''}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{ color: textColor, fontSize: 12 * fontScale, fontWeight: '600' }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {matchup.teamA!.name}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: cardBorderColor, marginVertical: 4 }} />

              {/* Team B row (logo + name) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <CMProfileImage
                  radius={20}
                  imgURL={matchup.teamB!.avatar || ''}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{ color: textColor, fontSize: 12 * fontScale, fontWeight: '600' }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {matchup.teamB!.name}
                </Text>
              </View>
            </View>

            {/* Score / next stage placeholder */}
            <View
              style={{
                width: 50,
                height: 52,
                borderRadius: CMConstants.radius.smallEx,
                backgroundColor: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="trophy-outline"
                size={16 * iconScale}
                color={CMConstants.color.green}
                style={{ marginBottom: 2 }}
              />
              <Text style={{ color: textColor, fontSize: 11 * fontScale }}>- : -</Text>
            </View>
          </View>
        )}
        
        {/* Placeholder for future rounds */}
        {!hasTeams && !isFinal && (
          <View
            style={{
              backgroundColor: cardBackgroundColor,
              borderColor: cardBorderColor,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderRadius: CMConstants.radius.smallEx,
              padding: CMConstants.space.smallEx,
              minWidth: 120,
              minHeight: 60,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: labelColor, fontSize: 10 * fontScale }}>
              (?-?)
            </Text>
          </View>
        )}
        
        {/* Final Trophy Icon */}
        {isFinal && !hasTeams && (
          <View
            style={{
              backgroundColor: cardBackgroundColor,
              borderColor: cardBorderColor,
              borderWidth: 1,
              borderRadius: CMConstants.radius.normal,
              padding: CMConstants.space.normal,
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 120,
              minHeight: 80,
            }}
          >
            <Ionicons name="trophy" size={28 * iconScale} color={CMConstants.color.green} />
            <Text style={{ color: textColor, fontSize: 11 * fontScale, fontWeight: '600', marginTop: CMConstants.space.smallEx }}>
              FINAL
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderBracket = () => {
    if (bracket.length === 0) {
      return (
        <View style={{ padding: CMConstants.space.normal, alignItems: 'center' }}>
          <Text style={{ color: labelColor }}>Not enough teams for playoffs.</Text>
          <Text style={{ color: labelColor, marginTop: CMConstants.space.smallEx }}>
            Need at least 2 teams. Currently: {standings.length} teams.
          </Text>
        </View>
      );
    }

    // Group matchups by round
    const rounds: { [round: number]: BracketMatchup[] } = {};
    bracket.forEach(matchup => {
      if (!rounds[matchup.round]) {
        rounds[matchup.round] = [];
      }
      rounds[matchup.round].push(matchup);
    });

    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

    return (
      <View style={{ width: '100%' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: CMConstants.space.smallEx }}
        >
          <View style={{ flexDirection: 'row', paddingHorizontal: CMConstants.space.small }}>
            {roundNumbers.map((round, roundIndex) => {
              const isFinalRound = roundIndex === roundNumbers.length - 1;
              return (
                <View
                  key={round}
                  style={{
                    alignItems: 'center',
                    justifyContent: isFinalRound ? 'center' : 'flex-start',
                    marginRight: isFinalRound ? 0 : CMConstants.space.normal,
                    minWidth: 150,
                  }}
                >
                  {rounds[round].map((matchup, index) =>
                    renderMatchup(matchup, index, rounds[round].length),
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor, flex: 1 }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + CMConstants.space.normal }}
      >
        {/* League Header - logo, name, season, cup */}
        <View
          style={{
            paddingTop: CMConstants.space.normal,
            paddingBottom: CMConstants.space.small,
            alignItems: 'center',
          }}
        >
          <CMProfileImage
            radius={80}
            imgURL={league?.avatar}
            style={{
              borderWidth: 2,
              borderColor: CMConstants.color.green,
              shadowColor: CMConstants.color.green,
              shadowOpacity: 0.6,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          <Text
            style={{
              color: textColor,
              fontSize: 20 * fontScale,
              fontWeight: '600',
              marginTop: CMConstants.space.smallEx,
            }}
            numberOfLines={1}
          >
            {league?.name || 'Playoffs'}
          </Text>
          {league?.seasonName && (
            <Text
              style={{
                color: labelColor,
                fontSize: 14 * fontScale,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              Playoffs • {league.seasonName}
            </Text>
          )}

          {/* Divider line between season name and cup icon */}
          <View
            style={{
              height: 1,
              width: '80%',
              backgroundColor: cardBorderColor,
              marginTop: CMConstants.space.smallEx,
              alignSelf: 'center',
            }}
          />

          {/* Cup icon under header with horizontal line */}
          <View
            style={{
              marginTop: CMConstants.space.smallEx,
              marginBottom: CMConstants.space.smallEx / 2,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  height: 1,
                  width: 60,
                  backgroundColor: cardBorderColor,
                  marginRight: CMConstants.space.smallEx,
                }}
              />
              <Ionicons
                name="trophy"
                size={35 * iconScale}
                color={CMConstants.color.green}
              />
              <View
                style={{
                  height: 1,
                  width: 60,
                  backgroundColor: cardBorderColor,
                  marginLeft: CMConstants.space.smallEx,
                }}
              />
            </View>
            <Text
              style={{
                color: labelColor,
                fontSize: 10 * fontScale,
                marginTop: 4,
                letterSpacing: 1,
              }}
            >
              FINAL
            </Text>
          </View>
        </View>

        {/* Bracket */}
        {renderBracket()}

        {/* Message */}
        {bracket.length > 0 && (
          <View style={{ padding: CMConstants.space.normal, alignItems: 'center' }}>
            <Text style={{ color: labelColor, fontSize: 12 * fontScale, textAlign: 'center' }}>
              All matchups are set. Let the playoffs begin!
            </Text>
          </View>
        )}

        {/* Generate Bracket Button */}
        {isLeagueAdmin && bracket.length > 0 && (
          <View style={{ paddingHorizontal: CMConstants.space.normal, marginTop: CMConstants.space.normal }}>
            <CMRipple
              containerStyle={{
                backgroundColor: CMConstants.color.red,
                paddingVertical: CMConstants.space.smallEx,
                borderRadius: CMConstants.radius.normal,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={handleGenerateBracket}
            >
              <Text style={{ color: CMConstants.color.white, fontSize: 14 * fontScale, fontWeight: '600' }}>
                Generate Bracket
              </Text>
            </CMRipple>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CMPlayoffBracketScreen;

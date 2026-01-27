import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CMNavigationProps from '../navigation/CMNavigationProps';
import CMConstants from '../CMConstants';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMGlobal from '../CMGlobal';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMRipple from '../components/CMRipple';
import CMPermissionHelper from '../helper/CMPermissionHelper';
import CMLoadingDialog from '../dialog/CMLoadingDialog';

interface MatchItem {
  id: string;
  name: string;
  dateTime: FirebaseFirestoreTypes.Timestamp;
  location: string;
  week?: number;
  seasonName?: string;
  data: any;
  status?: string;
  teamAScore?: number;
  teamBScore?: number;
}

interface WeekGroup {
  week: number;
  matches: MatchItem[];
}

const CMSeasonScheduleScreen = ({ navigation, route }: CMNavigationProps) => {
  const initialLeague = route.params?.league || {};
  const [league, setLeague] = useState<any>(initialLeague);
  const [selectedSeasonName, setSelectedSeasonName] = useState<string>(
    route.params?.selectedSeasonName || initialLeague?.seasonName || '',
  );
  const readOnly = route.params?.readOnly ?? false;
  const [loading, setLoading] = useState<boolean>(true);
  const [weeks, setWeeks] = useState<WeekGroup[]>([]);
  const [matchPermissions, setMatchPermissions] = useState<{ [matchId: string]: boolean }>({});
  const [hasPlayoffMatches, setHasPlayoffMatches] = useState<boolean>(false);
  const insets = useSafeAreaInsets();

  const themeMode = CMGlobal.themeMode || CMConstants.themeMode.light;
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;

  // Load league (do not override selectedSeasonName)
  useEffect(() => {
    if (league?.id) {
      CMFirebaseHelper.getLeague(league.id, (response: { [name: string]: any }) => {
        if (response.isSuccess && response.value) {
          setLeague({ ...league, ...response.value });
        }
      });
    }
  }, [league?.id]);

  const loadSchedule = useCallback(async () => {
    if (!league?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const snapshot = await firestore()
        .collection('matches')
        .where('leagueId', '==', league.id)
        .orderBy('dateTime', 'asc')
        .get();

      const matches: MatchItem[] = [];
      let currentSeasonName = selectedSeasonName || league.seasonName;

      // Count season names in matches to find the actual season name used
      const seasonNameCounts = new Map<string, number>();
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        const matchSeasonName = (data.seasonName || '').trim();
        if (matchSeasonName) {
          seasonNameCounts.set(matchSeasonName, (seasonNameCounts.get(matchSeasonName) || 0) + 1);
        }
      });

      // If current season name doesn't match any matches, use the most common one
      if (currentSeasonName && seasonNameCounts.size > 0) {
        const currentSeasonNameLower = currentSeasonName.toLowerCase();
        const hasMatchingSeasonName = Array.from(seasonNameCounts.keys()).some(
          name => name.toLowerCase() === currentSeasonNameLower
        );

        if (!hasMatchingSeasonName) {
          // Current season name doesn't match any matches, use the most common one
          const mostCommonSeasonName = Array.from(seasonNameCounts.entries())
            .sort((a, b) => b[1] - a[1])[0][0];
          console.log(`Season name changed - using "${mostCommonSeasonName}" instead of "${currentSeasonName}" to find matches`);
          currentSeasonName = mostCommonSeasonName;
        }
      }

      // First pass: determine if this season has playoff matches
      let hasPlayoffForSeason = false;
      const normalizedCurrentSeasonLower = currentSeasonName ? currentSeasonName.trim().toLowerCase() : '';
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        const matchSeasonName = (data.seasonName || '').trim().toLowerCase();
        const isPlayoff = !!data.isPlayoff;
        if (
          normalizedCurrentSeasonLower &&
          matchSeasonName === normalizedCurrentSeasonLower &&
          isPlayoff
        ) {
          hasPlayoffForSeason = true;
        }
      });

      // Second pass: build regular-season matches only
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        const match: MatchItem = {
          id: data.id || doc.id,
          name: data.name,
          dateTime: data.dateTime,
          location: data.location || '',
          week: data.week,
          seasonName: data.seasonName,
          data: { id: data.id || doc.id, ...data },
          status: data.status,
          teamAScore: typeof data.teamAScore === 'number' ? data.teamAScore : 0,
          teamBScore: typeof data.teamBScore === 'number' ? data.teamBScore : 0,
        };

        // Only include regular season games here; playoff games are shown via separate button/page
        if (data.isPlayoff) {
          return;
        }

        // Only include matches from the current season (case-insensitive comparison)
        if (currentSeasonName) {
          const matchSeasonName = (match.seasonName || '').trim().toLowerCase();
          const currentSeasonNameLower = currentSeasonName.trim().toLowerCase();
          if (!matchSeasonName || matchSeasonName !== currentSeasonNameLower) {
            return;
          }
        } else {
          // If no current season, only show matches without seasonName (legacy)
          if (match.seasonName) {
            return;
          }
        }

        matches.push(match);
      });

      // Group by week (fallback to 1 if missing)
      const weekMap = new Map<number, MatchItem[]>();
      matches.forEach(match => {
        const week = match.week || 1;
        if (!weekMap.has(week)) {
          weekMap.set(week, []);
        }
        weekMap.get(week)!.push(match);
      });

      const grouped: WeekGroup[] = Array.from(weekMap.entries())
        .map(([week, ms]) => ({
          week,
          matches: ms.sort((a, b) => a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime()),
        }))
        .sort((a, b) => a.week - b.week);

      // Show matches immediately (don't wait for permissions)
      setWeeks(grouped);
      setHasPlayoffMatches(hasPlayoffForSeason);
      setLoading(false);

      // Load permissions in parallel (non-blocking)
      Promise.all(
        matches.map(async (match) => {
          try {
            const canEdit = await CMPermissionHelper.canEditMatch(match.id, match.data);
            return { matchId: match.id, canEdit };
          } catch (error) {
            return { matchId: match.id, canEdit: false };
          }
        })
      ).then((permissionResults) => {
        const permissions: { [matchId: string]: boolean } = {};
        permissionResults.forEach(({ matchId, canEdit }) => {
          permissions[matchId] = canEdit;
        });
        setMatchPermissions(permissions);
      });
    } catch (e) {
      console.error('Error loading schedule:', e);
      setLoading(false);
    }
  }, [league?.id, league?.seasonName]);

  useEffect(() => {
    const seasonTitle = selectedSeasonName || league?.seasonName || 'Season Schedule';
    navigation.setOptions({
      title: seasonTitle,
      headerTitleStyle: {
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold' as const,
      },
    });
  }, [navigation, league?.seasonName, selectedSeasonName]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Reload schedule when screen comes into focus (e.g., after editing a match)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSchedule();
    });
    return unsubscribe;
  }, [navigation, loadSchedule]);

  const formatDateTime = (dt: FirebaseFirestoreTypes.Timestamp) => {
    const d = dt.toDate();
    const dateStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return { dateStr, timeStr };
  };

  const formatDateOnly = (d?: Date) => {
    if (!d) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const currentSeasonName = selectedSeasonName || league?.seasonName || '';

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor, flex: 1 }]}>
      <CMLoadingDialog visible={loading} />

      {!loading && weeks.length === 0 && (
        <View style={{ padding: CMConstants.space.normal }}>
          <Text style={{ color: labelColor }}>No games found for this season.</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingHorizontal: CMConstants.space.normal, 
          paddingTop: CMConstants.space.smallEx,
          paddingBottom: insets.bottom + CMConstants.space.normal 
        }}
      >
        {/* History-only controls (when opened from Season History) */}
        {readOnly && (
          <>
            {/* Playoffs button (for this season) */}
            {hasPlayoffMatches && (
              <View style={{ marginTop: CMConstants.space.normal, marginBottom: CMConstants.space.smallEx }}>
                <CMRipple
                  containerStyle={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: CMConstants.space.smallEx,
                    borderRadius: CMConstants.radius.normal,
                    backgroundColor: CMConstants.color.green,
                  }}
                  onPress={() => {
                    if (!league?.id) return;
                    navigation.navigate(CMConstants.screenName.playoffSchedule, {
                      league: {
                        ...league,
                        seasonName: currentSeasonName,
                      },
                      playoffTeams: league?.playoffTeams || 4,
                      fromHistory: true,
                      seasonName: currentSeasonName,
                    });
                  }}
                >
                  <Ionicons
                    name="trophy-outline"
                    size={18}
                    color={CMConstants.color.white}
                    style={{ marginRight: CMConstants.space.smallEx }}
                  />
                  <Text style={{ color: CMConstants.color.white, fontSize: 14, fontWeight: '600' }}>
                    View Playoffs for this Season
                  </Text>
                </CMRipple>
              </View>
            )}

            {/* Season Complete / Awards button below playoff button */}
            <View style={{ marginBottom: CMConstants.space.smallEx }}>
              <CMRipple
                containerStyle={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: CMConstants.space.smallEx,
                  borderRadius: CMConstants.radius.normal,
                  backgroundColor: CMConstants.color.darkGrey3,
                }}
                onPress={() => {
                  if (!league?.id) return;
                  navigation.navigate(CMConstants.screenName.seasonComplete, {
                    league: {
                      ...league,
                      seasonName: currentSeasonName,
                    },
                    fromHistory: true,
                  });
                }}
              >
                <Ionicons
                  name="trophy"
                  size={18}
                  color={CMConstants.color.green}
                  style={{ marginRight: CMConstants.space.smallEx }}
                />
                <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>
                  Season Awards
                </Text>
              </CMRipple>
            </View>
          </>
        )}
        {weeks.map(week => (
          <View key={week.week} style={{ 
            marginBottom: CMConstants.space.normal,
            marginTop: week.week === 1
              ? (readOnly ? CMConstants.space.smallEx : CMConstants.space.normal)
              : 0,
          }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: CMConstants.space.smallEx,
                paddingHorizontal: CMConstants.space.small,
                borderRadius: CMConstants.radius.normal,
                borderWidth: 1,
                borderColor: cardBorderColor,
                backgroundColor: cardBackgroundColor,
              }}
            >
              <Text style={{ color: textColor, fontWeight: '600' }}>
                Week {week.week}
              </Text>
              {week.matches.length > 0 && (
                <Text style={{ color: labelColor, fontSize: CMConstants.fontSize.smallEx }}>
                  {formatDateOnly(week.matches[0].dateTime.toDate())}
                  {week.matches.length > 1 &&
                    ` - ${formatDateOnly(week.matches[week.matches.length - 1].dateTime.toDate())}`}
                </Text>
              )}
            </View>
            {week.matches.map(match => {
              const { dateStr, timeStr } = formatDateTime(match.dateTime);
              const isPlayed = match.status === CMConstants.gameStatus.finished;
              const canEdit = matchPermissions[match.id] ?? false;
              const showEditButton = !readOnly && canEdit;
              return (
                <View
                  key={match.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: CMConstants.space.smallEx,
                    paddingHorizontal: CMConstants.space.small,
                    borderRadius: CMConstants.radius.normal,
                    borderWidth: 1,
                    borderColor: cardBorderColor,
                    backgroundColor: cardBackgroundColor,
                    marginTop: CMConstants.space.smallEx,
                  }}
                >
                  <View style={{ flex: 1, marginRight: CMConstants.space.smallEx }}>
                    <Text style={{ color: textColor, fontWeight: '600' }} numberOfLines={1}>
                      {match.name}
                    </Text>
                    <Text style={{ color: labelColor, marginTop: 2, fontSize: CMConstants.fontSize.smallEx }}>
                      {timeStr} • {match.location || 'TBD'} • {dateStr}
                    </Text>
                    <Text style={{ color: labelColor, marginTop: 2, fontSize: CMConstants.fontSize.smallEx }}>
                      Score: {match.teamAScore ?? 0} : {match.teamBScore ?? 0}
                    </Text>
                    <Text
                      style={{
                        color: isPlayed ? CMConstants.color.green : labelColor,
                        marginTop: 2,
                        fontSize: CMConstants.fontSize.smallEx,
                      }}
                    >
                      {isPlayed ? 'Status: Played' : 'Status: Not played yet'}
                    </Text>
                  </View>
                  {showEditButton && (
                    <CMRipple
                      containerStyle={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={() => {
                        navigation.navigate(CMConstants.screenName.editMatch, {
                          match: match.data,
                          isEdit: true,
                        });
                      }}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={CMConstants.color.green}
                      />
                    </CMRipple>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CMSeasonScheduleScreen;

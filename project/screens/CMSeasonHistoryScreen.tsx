import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, FlatList, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

import CMNavigationProps from '../navigation/CMNavigationProps';
import CMConstants from '../CMConstants';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMRipple from '../components/CMRipple';
import CMGlobal from '../CMGlobal';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';

interface SeasonInfo {
  seasonName: string;
  gameCount: number;
  // Separate counts for regular season and playoff games
  regularGameCount: number;
  playoffGameCount: number;
  startDate?: Date;
  endDate?: Date;
}

const CMSeasonHistoryScreen = ({ navigation, route }: CMNavigationProps) => {
  const initialLeague = route.params?.league || {};
  const [league, setLeague] = useState<any>(initialLeague);
  const [loading, setLoading] = useState<boolean>(true);
  const [seasons, setSeasons] = useState<SeasonInfo[]>([]);

  const themeMode = CMGlobal.themeMode || CMConstants.themeMode.light;
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;

  // Load league to get current seasonName
  useEffect(() => {
    if (league?.id) {
      CMFirebaseHelper.getLeague(league.id, (response: { [name: string]: any }) => {
        if (response.isSuccess && response.value) {
          setLeague({ ...league, ...response.value });
        }
      });
    }
  }, [league?.id]);

  const loadSeasons = useCallback(async () => {
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

      // Group matches by seasonName
      const seasonMap = new Map<string, { matches: any[] }>();
      
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        const seasonName = data.seasonName || 'Legacy Season';
        
        if (!seasonMap.has(seasonName)) {
          seasonMap.set(seasonName, { matches: [] });
        }
        seasonMap.get(seasonName)!.matches.push({
          dateTime: data.dateTime,
          ...data,
        });
      });

      // Build season info list
      const seasonList: SeasonInfo[] = Array.from(seasonMap.entries()).map(([seasonName, data]) => {
        const matches = data.matches;
        const regularMatches = matches.filter(m => !m.isPlayoff);
        const playoffMatches = matches.filter(m => !!m.isPlayoff);
        const dates = matches
          .map(m => m.dateTime?.toDate?.() || (m.dateTime ? new Date(m.dateTime.seconds * 1000) : null))
          .filter(d => d !== null) as Date[];
        
        dates.sort((a, b) => a.getTime() - b.getTime());
        
        return {
          seasonName,
          gameCount: matches.length,
          regularGameCount: regularMatches.length,
          playoffGameCount: playoffMatches.length,
          startDate: dates.length > 0 ? dates[0] : undefined,
          endDate: dates.length > 0 ? dates[dates.length - 1] : undefined,
        };
      });

      // Sort by start date (newest first)
      seasonList.sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return b.startDate.getTime() - a.startDate.getTime();
      });

      setSeasons(seasonList);
    } catch (e) {
      console.error('Error loading seasons:', e);
    } finally {
      setLoading(false);
    }
  }, [league?.id]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Season History',
      headerTitleStyle: {
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold' as const,
      },
    });
  }, [navigation]);

  useEffect(() => {
    loadSeasons();
  }, [loadSeasons]);

  const formatDate = (date?: Date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDeleteSeason = (seasonName: string) => {
    if (!league?.id) {
      return;
    }

    Alert.alert(
      'Delete Season',
      `Are you sure you want to delete the season "${seasonName}"?\n\nThis will permanently delete ALL games in this season for this league. This includes:\n\n• All scheduled games in this season\n• Their scores and schedule data\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const snapshot = await firestore()
                .collection('matches')
                .where('leagueId', '==', league.id)
                .get();

              const batch = firestore().batch();
              snapshot.forEach(doc => {
                const data = doc.data() as any;
                const matchSeasonName = data.seasonName || 'Legacy Season';
                if (matchSeasonName === seasonName) {
                  batch.delete(doc.ref);
                }
              });

              await batch.commit();

              // If we deleted the current active season, clear it on the league
              if (league.seasonName === seasonName) {
                await new Promise<void>((resolve) => {
                  CMFirebaseHelper.updateLeague(
                    league.id,
                    {
                      seasonName: '',
                      regularSeasonEnded: false,
                      playoffsStarted: false,
                    },
                    (response: { [name: string]: any }) => {
                      if (response.isSuccess) {
                        setLeague({
                          ...league,
                          seasonName: '',
                          regularSeasonEnded: false,
                          playoffsStarted: false,
                        });
                      }
                      resolve();
                    },
                  );
                });
              }

              // Reload seasons after delete
              await loadSeasons();

              Alert.alert(
                'Season Deleted',
                `The season "${seasonName}" and all of its games have been deleted.`,
              );
            } catch (e) {
              console.error('Error deleting season:', e);
              Alert.alert(
                'Delete Failed',
                'An error occurred while deleting this season. Please try again.',
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const renderSeasonItem = ({ item }: { item: SeasonInfo }) => {
    // Check if this season is the current active season (not completed)
    // A season is current if it matches league.seasonName AND the season is not complete
    const isCurrentSeason = league?.seasonName === item.seasonName && !league?.seasonComplete;
    const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
    const isAdmin = CMGlobal.user?.role === 'admin';
    const isLeagueAdmin = isAdmin || (league?.adminId && currentUserId && league.adminId === currentUserId);
    
    return (
      <View
        style={{
          backgroundColor: cardBackgroundColor,
          borderColor: cardBorderColor,
          borderWidth: 1,
          borderRadius: CMConstants.radius.normal,
          padding: CMConstants.space.normal,
          marginBottom: CMConstants.space.smallEx,
        }}
      >
        {/* Main tap area → view season schedule */}
        <CMRipple
          containerStyle={{}}
          onPress={() => {
            navigation.navigate(CMConstants.screenName.seasonSchedule, {
              league,
              selectedSeasonName: item.seasonName,
              readOnly: true,
            });
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: textColor, fontWeight: '600', fontSize: 16 }}>
                  {item.seasonName}
                </Text>
                {isCurrentSeason && (
                  <View
                    style={{
                      backgroundColor: CMConstants.color.green,
                      paddingHorizontal: CMConstants.space.smallEx,
                      paddingVertical: 2,
                      borderRadius: 4,
                      marginLeft: CMConstants.space.smallEx,
                    }}
                  >
                    <Text style={{ color: CMConstants.color.white, fontSize: 10, fontWeight: '600' }}>
                      CURRENT
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: labelColor, fontSize: 12, marginTop: 2 }}>
                Season: {item.regularGameCount} {item.regularGameCount === 1 ? 'game' : 'games'}
                {item.playoffGameCount > 0
                  ? ` • Playoffs: ${item.playoffGameCount} ${item.playoffGameCount === 1 ? 'game' : 'games'}`
                  : ''}
              </Text>
              {item.startDate && item.endDate && (
                <Text style={{ color: labelColor, fontSize: 12, marginTop: 2 }}>
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={labelColor} />
          </View>
        </CMRipple>
        {/* Optional admin-only Delete Season button (does not allow editing games) */}
        {isLeagueAdmin && (
          <View
            style={{
              marginTop: CMConstants.space.smallEx,
              flexDirection: 'row',
              justifyContent: 'flex-end',
            }}
          >
            <CMRipple
              containerStyle={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: CMConstants.space.normal,
                paddingVertical: CMConstants.space.smallEx,
                borderRadius: CMConstants.radius.normal,
                borderWidth: 1,
                borderColor: CMConstants.color.red,
              }}
              onPress={() => handleDeleteSeason(item.seasonName)}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={CMConstants.color.red}
                style={{ marginRight: CMConstants.space.smallEx }}
              />
              <Text style={{ color: CMConstants.color.red, fontSize: 12, fontWeight: '600' }}>
                Delete Season
              </Text>
            </CMRipple>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor, flex: 1 }]}>
      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: CMConstants.space.normal }}>
          <ActivityIndicator color={CMConstants.color.green} />
          <Text style={{ color: labelColor, marginLeft: CMConstants.space.smallEx }}>Loading seasons...</Text>
        </View>
      )}

      {!loading && seasons.length === 0 && (
        <View style={{ padding: CMConstants.space.normal }}>
          <Text style={{ color: labelColor }}>No seasons found for this league.</Text>
        </View>
      )}

      {!loading && seasons.length > 0 && (
        <FlatList
          data={seasons}
          renderItem={renderSeasonItem}
          keyExtractor={(item) => item.seasonName}
          contentContainerStyle={{ padding: CMConstants.space.normal }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default CMSeasonHistoryScreen;


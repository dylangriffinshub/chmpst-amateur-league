import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMUtils from '../utils/CMUtils';
import CMRipple from '../components/CMRipple';
import CMProfileImage from '../components/CMProfileImage';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import { getFirestore, collection, query, where, getDocs } from '@react-native-firebase/firestore';
import CMGlobal from '../CMGlobal';

interface TopPlayer {
  id: string;
  playerId: string;
  leagueId: string;
  matches: number;
  averagePoints: number;
  averageRebounds: number;
  averageAssists: number;
  averageSteals: number;
  averageBlocks: number;
  averageTurnovers: number;
  player?: any;
  team?: {
    id: string;
    name: string;
    avatar?: string;
  };
  league?: {
    id: string;
    name: string;
    avatar?: string;
    city?: string;
  };
}

const CMAllTopPlayersScreen = ({ navigation, route }: CMNavigationProps) => {
  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  const insets = useSafeAreaInsets();

  // Listen for theme changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
    });
    return unsubscribe;
  }, [navigation]);

  // Update navigation header when theme changes
  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white,
      },
      headerTintColor: isDarkMode ? CMConstants.color.white : CMConstants.color.black,
      headerTitleStyle: {
        color: isDarkMode ? CMConstants.color.white : CMConstants.color.black,
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold',
      },
    });
  }, [themeMode, isDarkMode, navigation]);

  // Dynamic colors based on theme
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const closeButtonBackground = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1;
  const closeButtonIconColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey2;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const dropdownBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const dropdownBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const dropdownOptionBackground = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1;

  const initialTimeframe: string = route.params?.timeframe || 'This Season';
  const [selectedTimeframe, setSelectedTimeframe] = useState(initialTimeframe);
  const [allPlayers, setAllPlayers] = useState<TopPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allPlayerStats, setAllPlayerStats] = useState<any[]>([]); // Store calculated stats without player details

  // Search state
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Sort options
  type SortOption = 'Points' | 'Assists' | 'Rebounds' | 'Steals' | 'Blocks' | null;
  type FilterMetricOption = 'All' | 'Points' | 'Assists' | 'Rebounds' | 'Steals' | 'Blocks';
  type PositionOption = 'All' | 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  const [selectedSort, setSelectedSort] = useState<SortOption>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [showAdvancedFilterModal, setShowAdvancedFilterModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionOption>('All');
  const [selectedMetric, setSelectedMetric] = useState<FilterMetricOption>('All');
  const [draftTimeframe, setDraftTimeframe] = useState(selectedTimeframe);
  const [draftPosition, setDraftPosition] = useState<PositionOption>(selectedPosition);
  const [draftMetric, setDraftMetric] = useState<FilterMetricOption>(selectedMetric);
  const timeframeOptions = ['This Week', 'This Month', 'This Season'];
  const positionOptions: PositionOption[] = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];
  const metricOptions: FilterMetricOption[] = ['All', 'Points', 'Assists', 'Rebounds', 'Steals', 'Blocks'];

  const ITEMS_PER_PAGE = 10;
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadedPlayerDetails, setLoadedPlayerDetails] = useState<Set<string>>(new Set());

  // Helper function to get date range based on timeframe
  const getDateRangeForTimeframe = (timeframe: string): { startDate: Date; endDate: Date } | null => {
    const now = new Date();
    const endDate = now;
    let startDate: Date;

    switch (timeframe) {
      case 'This Week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate };
      
      case 'This Month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate };
      
      case 'This Season':
        return null;
      
      default:
        return null;
    }
  };

  // Load all players based on timeframe - calculate stats only, fetch details progressively
  useEffect(() => {
    const loadAllPlayers = async () => {
      setIsLoading(true);
      setAllPlayers([]);
      setLoadedPlayerDetails(new Set());
      console.log('Loading all players for timeframe:', selectedTimeframe);

      const dateRange = getDateRangeForTimeframe(selectedTimeframe);
      const calculatedStats: any[] = [];

      // Fetch all leagues
      CMFirebaseHelper.getAllLeagues(async (leaguesResponse: any) => {
        if (leaguesResponse.isSuccess) {
          const leagues = leaguesResponse.value as any[];
          const nextCities: string[] = Array.from(
            new Set(
              leagues
                .map((league: any) => (typeof league?.city === 'string' ? league.city.trim() : ''))
                .filter((city: string) => city.length > 0)
            )
          ).sort((a, b) => a.localeCompare(b));
          setCityOptions(nextCities);

          if (leagues.length === 0) {
            setCityOptions([]);
            setAllPlayers([]);
            setIsLoading(false);
            return;
          }

          // Process all leagues in PARALLEL for much faster loading
          const leaguePromises = leagues.map(async (league: { id: unknown; name: any; }) => {
            try {
              if (typeof league.id !== 'string' || !league.id) {
                return [];
              }
              const leagueId = league.id;

              // For "This Week", find best single game performance
              if (selectedTimeframe === 'This Week') {
                const statsQuery = query(collection(getFirestore(), 'playerStats'), where('leagueId', '==', leagueId));
                const statsSnapshot = await getDocs(statsQuery);
                
                const playerBestGames = new Map<string, any>();
                
                statsSnapshot.forEach((doc: { data: () => any; }) => {
                  const stat = doc.data();
                  
                  if (dateRange && stat.dayTime) {
                    const statDate = stat.dayTime.toDate();
                    if (statDate < dateRange.startDate || statDate > dateRange.endDate) {
                      return;
                    }
                  }
                  
                  const points = Number(stat.pointsPerGame) || 0;
                  const playerId = stat.playerId;
                  const uniqueKey = `${leagueId}_${playerId}`;

                  if (!playerBestGames.has(uniqueKey) || points > playerBestGames.get(uniqueKey).points) {
                    playerBestGames.set(uniqueKey, {
                      playerId,
                      leagueId,
                      points,
                      assists: Number(stat.assists) || 0,
                      rebounds: Number(stat.rebounds) || 0,
                      steals: Number(stat.steals) || 0,
                      blocks: Number(stat.blocks) || 0,
                      turnovers: Number(stat.turnovers) || 0,
                      league: league,
                    });
                  }
                });

                return Array.from(playerBestGames.values());
              }
              // For "This Month", calculate averages
              else if (selectedTimeframe === 'This Month') {
                const statsQuery = query(collection(getFirestore(), 'playerStats'), where('leagueId', '==', leagueId));
                const statsSnapshot = await getDocs(statsQuery);
                
                const playerStatsMap = new Map<string, any[]>();
                
                statsSnapshot.forEach((doc: { data: () => any; }) => {
                  const stat = doc.data();
                  
                  if (dateRange && stat.dayTime) {
                    const statDate = stat.dayTime.toDate();
                    if (statDate < dateRange.startDate || statDate > dateRange.endDate) {
                      return;
                    }
                  }
                  
                  const playerId = stat.playerId;
                  const uniqueKey = `${leagueId}_${playerId}`;
                  
                  if (!playerStatsMap.has(uniqueKey)) {
                    playerStatsMap.set(uniqueKey, []);
                  }
                  playerStatsMap.get(uniqueKey)?.push({ ...stat, league });
                });

                const leagueStats: any[] = [];
                for (const [uniqueKey, stats] of playerStatsMap) {
                  const totalPoints = stats.reduce((sum, s) => sum + (Number(s.pointsPerGame) || 0), 0);
                  const totalAssists = stats.reduce((sum, s) => sum + (Number(s.assists) || 0), 0);
                  const totalRebounds = stats.reduce((sum, s) => sum + (Number(s.rebounds) || 0), 0);
                  const totalSteals = stats.reduce((sum, s) => sum + (Number(s.steals) || 0), 0);
                  const totalBlocks = stats.reduce((sum, s) => sum + (Number(s.blocks) || 0), 0);
                  const totalTurnovers = stats.reduce((sum, s) => sum + (Number(s.turnovers) || 0), 0);
                  const matchCount = stats.length;

                  leagueStats.push({
                    playerId: stats[0].playerId,
                    leagueId,
                    matches: matchCount,
                    points: totalPoints / matchCount,
                    assists: totalAssists / matchCount,
                    rebounds: totalRebounds / matchCount,
                    steals: totalSteals / matchCount,
                    blocks: totalBlocks / matchCount,
                    turnovers: totalTurnovers / matchCount,
                    league: stats[0].league,
                  });
                }
                return leagueStats;
              }
              // For "This Season", use playerAverageStats
              else {
                const statsResponse = await new Promise<any>((resolve) => {
                  CMFirebaseHelper.getPlayerAverageStatsByLeague(leagueId, resolve);
                });

                if (statsResponse.isSuccess && Array.isArray(statsResponse.value) && statsResponse.value.length > 0) {
                  return statsResponse.value.map((stat: any) => ({
                    ...stat,
                    league: league,
                    points: stat.averagePoints,
                  }));
                }
                return [];
              }
            } catch (error) {
              console.log('Error loading stats for league:', league.name, error);
              return [];
            }
          });

          // Wait for all leagues to load in parallel
          const allLeagueStats = await Promise.all(leaguePromises);
          calculatedStats.push(...allLeagueStats.flat());

          // Sort all players by points
          calculatedStats.sort((a, b) => (b.points || 0) - (a.points || 0));

          console.log(`Calculated stats for ${calculatedStats.length} total players`);

          // Store calculated stats
          setAllPlayerStats(calculatedStats);

          // Load player details for first 10 only
          await loadPlayerDetails(calculatedStats.slice(0, ITEMS_PER_PAGE));
          
          setDisplayedCount(ITEMS_PER_PAGE);
          setIsLoading(false);
        } else {
          setCityOptions([]);
          setAllPlayerStats([]);
          setAllPlayers([]);
          setDisplayedCount(ITEMS_PER_PAGE);
          setIsLoading(false);
        }
      });
    };

    loadAllPlayers();
  }, [selectedTimeframe]);

  // Function to load player details progressively - OPTIMIZED with parallel loading
  const loadPlayerDetails = async (statsToLoad: any[]) => {
    const newLoadedIds = new Set(loadedPlayerDetails);
    
    // Filter out already loaded players
    const statsToFetch = statsToLoad.filter(stat => !newLoadedIds.has(stat.playerId));
    
    if (statsToFetch.length === 0) {
      return; // All players already loaded
    }

    // Load all player details in PARALLEL for much faster loading
    const playerPromises = statsToFetch.map(async (stat) => {
      const playerId = stat.playerId;
      
      try {
        const playerResponse = await new Promise<any>((resolve) => {
          CMFirebaseHelper.getPlayerWithTeam(playerId, resolve);
        });

        if (playerResponse.isSuccess) {
          const playerData = playerResponse.value;
          return {
            id: stat.id || `${stat.leagueId}${stat.playerId}`,
            playerId: stat.playerId || '',
            leagueId: stat.leagueId || '',
            matches: stat.matches || 0,
            averagePoints: stat.points || stat.averagePoints || 0,
            averageAssists: stat.assists || stat.averageAssists || 0,
            averageRebounds: stat.rebounds || stat.averageRebounds || 0,
            averageSteals: stat.steals || stat.averageSteals || 0,
            averageBlocks: stat.blocks || stat.averageBlocks || 0,
            averageTurnovers: stat.turnovers || stat.averageTurnovers || 0,
            player: playerData,
            team: playerData.team,
            league: stat.league,
          } as TopPlayer;
        }
        return null;
      } catch (error) {
        console.log('Error loading player details:', playerId, error);
        return null;
      }
    });

    // Wait for all players to load in parallel
    const newPlayers = (await Promise.all(playerPromises)).filter((p): p is TopPlayer => p !== null);
    
    // Update loaded IDs
    newPlayers.forEach(p => newLoadedIds.add(p.playerId));
    setLoadedPlayerDetails(newLoadedIds);
    setAllPlayers(prev => [...prev, ...newPlayers]);
  };

  // Sort calculated stats based on selected option
  const sortedStats = useMemo(() => {
    if (!selectedSort) {
      // No sort selected, return original order (sorted by points)
      return [...allPlayerStats];
    }

    const sorted = [...allPlayerStats];
    sorted.sort((a, b) => {
      let valueA = 0;
      let valueB = 0;

      switch (selectedSort) {
        case 'Points':
          valueA = a.points || a.averagePoints || 0;
          valueB = b.points || b.averagePoints || 0;
          break;
        case 'Assists':
          valueA = a.assists || a.averageAssists || 0;
          valueB = b.assists || b.averageAssists || 0;
          break;
        case 'Rebounds':
          valueA = a.rebounds || a.averageRebounds || 0;
          valueB = b.rebounds || b.averageRebounds || 0;
          break;
        case 'Steals':
          valueA = a.steals || a.averageSteals || 0;
          valueB = b.steals || b.averageSteals || 0;
          break;
        case 'Blocks':
          valueA = a.blocks || a.averageBlocks || 0;
          valueB = b.blocks || b.averageBlocks || 0;
          break;
      }

      return valueB - valueA; // Sort descending (highest first)
    });
    return sorted;
  }, [allPlayerStats, selectedSort]);

  const cityFilteredStats = useMemo(() => {
    return selectedCity
      ? sortedStats.filter((stat) => stat.league?.city === selectedCity)
      : sortedStats;
  }, [sortedStats, selectedCity]);

  const getPlayerPosition = useCallback((player: any): string => {
    const rawPosition = typeof player?.position === 'string' ? player.position.trim().toUpperCase() : '';
    return positionOptions.includes(rawPosition as PositionOption) ? rawPosition : '';
  }, []);

  // Get displayed players (with details loaded)
  const sortedPlayers = useMemo(() => {
    // Map filtered stats to loaded player details
    return cityFilteredStats
      .map(stat => allPlayers.find(p => p.playerId === stat.playerId))
      .filter(p => p !== undefined) as TopPlayer[];
  }, [cityFilteredStats, allPlayers]);

  const positionFilteredPlayers = useMemo(() => {
    if (selectedPosition === 'All') {
      return sortedPlayers;
    }

    return sortedPlayers.filter((player) => getPlayerPosition(player.player) === selectedPosition);
  }, [sortedPlayers, selectedPosition, getPlayerPosition]);

  // Filter players based on search text
  const filteredPlayers = useMemo(() => {
    if (!searchText.trim()) {
      return positionFilteredPlayers;
    }

    const searchLower = searchText.toLowerCase();
    return positionFilteredPlayers.filter(player => 
      player.player?.name?.toLowerCase().includes(searchLower) ||
      player.team?.name?.toLowerCase().includes(searchLower) ||
      player.league?.name?.toLowerCase().includes(searchLower) ||
      player.league?.city?.toLowerCase().includes(searchLower)
    );
  }, [positionFilteredPlayers, searchText]);

  // Reset and load new data when sort or city changes
  useEffect(() => {
    const loadSortedData = async () => {
      setDisplayedCount(ITEMS_PER_PAGE);
      // Load player details for first 10 of the currently filtered list
      const firstBatch = cityFilteredStats.slice(0, ITEMS_PER_PAGE);
      await loadPlayerDetails(firstBatch);
    };
    
    if (cityFilteredStats.length > 0) {
      loadSortedData();
    } else {
      setDisplayedCount(ITEMS_PER_PAGE);
    }
  }, [selectedSort, selectedCity, cityFilteredStats]);

  useEffect(() => {
    if (selectedPosition !== 'All' && cityFilteredStats.length > 0) {
      loadPlayerDetails(cityFilteredStats);
    }
  }, [selectedPosition, cityFilteredStats]);

  useEffect(() => {
    if (selectedMetric !== 'All') {
      setSelectedSort(selectedMetric);
    }
  }, [selectedMetric]);

  useEffect(() => {
    setSelectedMetric(selectedSort ?? 'All');
  }, [selectedSort]);

  const displayedPlayers = filteredPlayers.slice(0, displayedCount);
  const hasMore = displayedCount < filteredPlayers.length;

  // Get screen width for responsive design
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isSmallDevice = screenWidth < 375; // iPhone SE and similar small devices
  const isLargeDevice = screenWidth > 414; // iPhone Plus and larger devices/tablets
  
  // Calculate responsive scaling factors
  const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;
  const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0;

  useEffect(() => {
    console.log(`Initial load: Showing ${Math.min(ITEMS_PER_PAGE, allPlayers.length)} of ${allPlayers.length} players`);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || displayedCount >= filteredPlayers.length) return;

    setIsLoadingMore(true);
    
    // Calculate next batch to load
    const nextCount = Math.min(displayedCount + ITEMS_PER_PAGE, cityFilteredStats.length);
    const nextBatch = cityFilteredStats.slice(displayedCount, nextCount);
    
    console.log(`Loading more: ${displayedCount} -> ${nextCount} (total: ${cityFilteredStats.length})`);
    
    // Load player details for next batch in PARALLEL
    await loadPlayerDetails(nextBatch);
    
    setDisplayedCount(nextCount);
    setIsLoadingMore(false);
  }, [isLoadingMore, displayedCount, cityFilteredStats, filteredPlayers.length, loadedPlayerDetails]);

  const renderPlayerItem = ({ item, index }: { item: TopPlayer; index: number }) => {
    return (
      <View style={styles.playerCard}>
        <CMRipple
          containerStyle={[styles.topPlayerScoreRow, { paddingVertical: 6, alignItems: 'center', backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}
          onPress={() => {
            navigation.navigate(CMConstants.screenName.playerDetails, {
              player: item.player,
              team: item.team,
              league: item.league
            });
          }}
        >
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{index + 1}</Text>
          </View>
          <CMProfileImage
            radius={32}
            style={[styles.topPlayerProfileImage]}
            imgURL={item.league?.avatar}
          />
          <View style={{ width: 2 }}></View>
          <CMProfileImage
            radius={24}
            style={styles.topPlayerProfileImage}
            imgURL={item.player?.avatar}
            isUser={true}
          />

          <View style={[styles.topPlayerInfoContainer, { flex: 1, minWidth: 70, maxWidth: 130 }]}>
            <Text style={[styles.topPlayerName, { color: textColor, fontSize: 12 }]} numberOfLines={1} ellipsizeMode="tail">
              {item.player?.name || 'Unknown Player'}
            </Text>

            <View style={styles.topPlayerTeamRow}>
              <CMProfileImage
                radius={14}
                imgURL={item.team?.avatar}
              />
              <View style={styles.topPlayerTeamInfo}>
                <Text style={[styles.topPlayerTeamName, { color: placeholderColor, fontSize: 10 }]} numberOfLines={1} ellipsizeMode="tail">
                  {item.team?.name || 'Unknown Team'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.topPlayerStatsContainer, { flexShrink: 0, marginLeft: CMConstants.space.smallEx - 4 }]}>
            <View>
              <Text style={[styles.topPlayerStatTitle, { fontSize: 10 }]}>P</Text>
              <Text style={[styles.topPlayerStatValue, { color: textColor, fontSize: 10 }]}>
                {Math.round(item.averagePoints)}
              </Text>
            </View>
            <View>
              <Text style={[styles.topPlayerStatTitle, { fontSize: 10 }]}>A</Text>
              <Text style={[styles.topPlayerStatValue, { color: textColor, fontSize: 10 }]}>
                {Math.round(item.averageAssists)}
              </Text>
            </View>
            <View>
              <Text style={[styles.topPlayerStatTitle, { fontSize: 10 }]}>R</Text>
              <Text style={[styles.topPlayerStatValue, { color: textColor, fontSize: 10 }]}>
                {Math.round(item.averageRebounds)}
              </Text>
            </View>
            <View>
              <Text style={[styles.topPlayerStatTitle, { fontSize: 10 }]}>B</Text>
              <Text style={[styles.topPlayerStatValue, { color: textColor, fontSize: 10 }]}>
                {Math.round(item.averageBlocks)}
              </Text>
            </View>
            <View>
              <Text style={[styles.topPlayerStatTitle, { fontSize: 10 }]}>S</Text>
              <Text style={[styles.topPlayerStatValue, { color: textColor, fontSize: 10 }]}>
                {Math.round(item.averageSteals)}
              </Text>
            </View>
          </View>
        </CMRipple>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={CMConstants.color.green} />
      </View>
    );
  };

  const openAdvancedFilterModal = () => {
    setShowCityDropdown(false);
    setDraftTimeframe(selectedTimeframe);
    setDraftPosition(selectedPosition);
    setDraftMetric(selectedMetric);
    setShowAdvancedFilterModal(true);
  };

  const closeAdvancedFilterModal = () => {
    setShowAdvancedFilterModal(false);
  };

  const applyAdvancedFilters = () => {
    setSelectedTimeframe(draftTimeframe);
    setSelectedPosition(draftPosition);
    setSelectedMetric(draftMetric);
    if (draftMetric === 'All') {
      setSelectedSort(null);
    } else {
      setSelectedSort(draftMetric);
    }
    closeAdvancedFilterModal();
  };

  const renderFilterChip = (
    label: string,
    isSelected: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.advancedFilterChip,
        {
          backgroundColor: isSelected ? CMConstants.color.green : dropdownOptionBackground,
          borderColor: isSelected ? CMConstants.color.green : dropdownBorderColor,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.advancedFilterChipText,
          { color: isSelected ? CMConstants.color.white : textColor },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      <View
        style={{
          paddingTop: (CMUtils.isAndroid ? insets.top : 0) + CMConstants.space.normal,
          paddingHorizontal: CMConstants.space.normal,
          paddingBottom: CMConstants.space.small,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
        }}
      >
        {!isSearching ? (
          <>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { 
                color: textColor,
                fontSize: (CMConstants.fontSize.medium + 2) * fontScale
              }]}>Top Players - {selectedTimeframe}</Text>
            </View>
            <CMRipple
              containerStyle={{
                ...CMCommonStyles.circle(CMConstants.height.iconBigEx),
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: CMConstants.color.green,
              }}
              onPress={() => {
                setIsSearching(true);
              }}
            >
              <Ionicons
                name={'search-outline'}
                size={CMConstants.height.icon}
                color={CMConstants.color.green}
              />
            </CMRipple>
          </>
        ) : (
          <View style={{ width: '100%', position: 'relative', justifyContent: 'center' }}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: inputBackgroundColor, color: inputTextColor, borderWidth: isDarkMode ? 0 : 1, borderColor: isDarkMode ? 'transparent' : CMConstants.color.lightGrey }]}
              value={searchText}
              onChangeText={text => setSearchText(text)}
              placeholder="Search players, teams, leagues..."
              placeholderTextColor={placeholderColor}
              keyboardType="default"
              onSubmitEditing={Keyboard.dismiss}
              blurOnSubmit={false}
              underlineColorAndroid="transparent"
              returnKeyType="done"
              autoFocus={true}
            />
            <View
              style={{
                position: 'absolute',
                right: CMConstants.space.smallEx,
                width: CMConstants.height.iconBig,
                height: CMConstants.height.iconBig,
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
              }}
            >
              <CMRipple
                containerStyle={{
                  ...CMCommonStyles.circle(CMConstants.height.iconBig),
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: closeButtonBackground,
                }}
                onPress={() => {
                  setSearchText('');
                  setIsSearching(false);
                  Keyboard.dismiss();
                }}
              >
                <Ionicons
                  name={'close'}
                  size={CMConstants.height.icon}
                  color={closeButtonIconColor}
                />
              </CMRipple>
            </View>
          </View>
        )}
      </View>

      {/* Sort Dropdown */}
      <View style={styles.sortContainer}>
        <View style={styles.filterControls}>
        <View style={{ position: 'relative', zIndex: 1002 }}>
          <TouchableOpacity
            style={[styles.sortDropdown, styles.cityDropdown, { backgroundColor: dropdownBackgroundColor, borderColor: CMConstants.color.green }]}
            onPress={() => {
              setShowCityDropdown(!showCityDropdown);
            }}
          >
            <Text style={[styles.sortDropdownText, { color: selectedCity ? CMConstants.color.green : placeholderColor }]}>
              {selectedCity || 'City'}
            </Text>
            <Ionicons
              name={showCityDropdown ? "chevron-up" : "chevron-down"}
              size={12}
              color={CMConstants.color.green}
              style={{ marginLeft: CMConstants.space.smallEx - 2 }}
            />
          </TouchableOpacity>

          {showCityDropdown && (
            <View style={[styles.sortDropdownMenu, styles.cityDropdownMenu, { backgroundColor: dropdownBackgroundColor, borderColor: CMConstants.color.green }]}>
              <TouchableOpacity
                style={[styles.sortDropdownOption, { borderBottomColor: dropdownBorderColor }]}
                onPress={() => {
                  setSelectedCity(null);
                  setShowCityDropdown(false);
                }}
              >
                <Text style={[styles.sortDropdownOptionText, { color: textColor }, !selectedCity && { color: CMConstants.color.green, fontWeight: '600' as const }]}>
                  All Cities
                </Text>
                {!selectedCity ? (
                  <Ionicons name="checkmark" size={12} color={CMConstants.color.green} style={{ marginLeft: CMConstants.space.smallEx }} />
                ) : (
                  <View style={{ width: 12 + CMConstants.space.smallEx }} />
                )}
              </TouchableOpacity>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={styles.cityDropdownScroll}
              >
                {cityOptions.map((city, index) => (
                  <TouchableOpacity
                    key={city}
                    style={[
                      styles.sortDropdownOption,
                      { borderBottomColor: dropdownBorderColor },
                      index === cityOptions.length - 1 && { borderBottomWidth: 0 }
                    ]}
                    onPress={() => {
                      setSelectedCity(city);
                      setShowCityDropdown(false);
                    }}
                  >
                    <Text style={[styles.sortDropdownOptionText, { color: textColor }, selectedCity === city && { color: CMConstants.color.green, fontWeight: '600' as const }]}>
                      {city}
                    </Text>
                    {selectedCity === city ? (
                      <Ionicons name="checkmark" size={12} color={CMConstants.color.green} style={{ marginLeft: CMConstants.space.smallEx }} />
                    ) : (
                      <View style={{ width: 12 + CMConstants.space.smallEx }} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterIconButton, { backgroundColor: dropdownBackgroundColor, borderColor: CMConstants.color.green }]}
          onPress={openAdvancedFilterModal}
        >
          <Ionicons
            name="options-outline"
            size={14}
            color={CMConstants.color.green}
          />
        </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={CMConstants.color.green} />
          <Text style={[styles.loadingText, { color: placeholderColor }]}>Loading players...</Text>
        </View>
      ) : (
        <FlatList
          data={displayedPlayers}
          renderItem={renderPlayerItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: CMConstants.space.normal, paddingBottom: insets.bottom + CMConstants.space.small }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          onScroll={() => {
            if (showCityDropdown) {
              setShowCityDropdown(false);
            }
          }}
          scrollEventThrottle={16}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: placeholderColor }]}>
                {searchText.trim() ? 'No matching players found' : 'No players found'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showAdvancedFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeAdvancedFilterModal}
      >
        <View style={styles.advancedFilterOverlay}>
          <View style={[styles.advancedFilterModal, { backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white, borderColor: dropdownBorderColor }]}>
            <View style={styles.advancedFilterHeader}>
              <Text style={[styles.advancedFilterTitle, { color: textColor }]}>Filter</Text>
              <TouchableOpacity onPress={closeAdvancedFilterModal}>
                <Ionicons name="close" size={18} color={placeholderColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.advancedFilterSection}>
              <Text style={[styles.advancedFilterLabel, { color: placeholderColor }]}>Timeframe</Text>
              <View style={styles.advancedFilterChipRow}>
                {timeframeOptions.map((option) =>
                  renderFilterChip(option, draftTimeframe === option, () => setDraftTimeframe(option))
                )}
              </View>
            </View>

            <View style={styles.advancedFilterSection}>
              <Text style={[styles.advancedFilterLabel, { color: placeholderColor }]}>Position</Text>
              <View style={styles.advancedFilterChipRow}>
                {positionOptions.map((option) =>
                  renderFilterChip(option, draftPosition === option, () => setDraftPosition(option))
                )}
              </View>
            </View>

            <View style={styles.advancedFilterSection}>
              <Text style={[styles.advancedFilterLabel, { color: placeholderColor }]}>Stat</Text>
              <View style={styles.advancedFilterChipRow}>
                {metricOptions.map((option) =>
                  renderFilterChip(option, draftMetric === option, () => setDraftMetric(option))
                )}
              </View>
            </View>

            <View style={styles.advancedFilterActions}>
              <TouchableOpacity
                style={styles.advancedFilterActionButton}
                onPress={closeAdvancedFilterModal}
              >
                <Text style={[styles.advancedFilterActionText, { color: placeholderColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advancedFilterApplyButton, { backgroundColor: CMConstants.color.green }]}
                onPress={applyAdvancedFilters}
              >
                <Text style={[styles.advancedFilterActionText, { color: CMConstants.color.white }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = {
  headerTitle: {
    // fontSize is now set dynamically in component
    fontWeight: 'bold' as const,
    letterSpacing: 0.5,
  },
  searchInput: {
    width: '100%' as const,
    height: CMConstants.height.textInput,
    borderRadius: CMConstants.radius.normal,
    paddingLeft: CMConstants.space.small,
    paddingRight: CMConstants.height.iconBig + CMConstants.space.small + CMConstants.space.smallEx,
    fontSize: CMConstants.fontSize.normal,
  },
  sortContainer: {
    paddingHorizontal: CMConstants.space.normal,
    paddingVertical: CMConstants.space.smallEx,
    alignItems: 'flex-end' as const,
  },
  filterControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    columnGap: CMConstants.space.smallEx,
  },
  filterIconButton: {
    width: 34,
    height: 34,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1.5,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sortDropdown: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: CMConstants.space.smallEx,
    paddingVertical: CMConstants.space.smallEx - 2,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1.5,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 100,
  },
  cityDropdown: {
    minWidth: 120,
  },
  sortDropdownText: {
    fontSize: CMConstants.fontSize.smallEx * 0.9,
    fontWeight: '600' as const,
  },
  sortDropdownMenu: {
    position: 'absolute' as const,
    top: 35,
    right: 0,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1.5,
    minWidth: 100,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 1000,
    overflow: 'hidden' as const,
    paddingBottom: CMConstants.space.smallEx - 2,
  },
  cityDropdownMenu: {
    maxHeight: 260,
  },
  cityDropdownScroll: {
    maxHeight: 210,
  },
  sortDropdownOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: CMConstants.space.smallEx - 4,
    paddingHorizontal: CMConstants.space.smallEx - 2,
    borderBottomWidth: 0.5,
    marginHorizontal: CMConstants.space.smallEx - 2,
    marginVertical: 1,
  },
  sortDropdownOptionText: {
    fontSize: CMConstants.fontSize.small * 0.9,
    fontWeight: '500' as const,
  },
  playerCard: {
    marginBottom: CMConstants.space.smallEx - 2,
  },
  rankBadge: {
    width: 20,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: CMConstants.space.smallEx - 4,
    flexShrink: 0,
  },
  rankBadgeText: {
    color: CMConstants.color.green,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  topPlayerScoreRow: {
    flexDirection: 'row' as const,
    flex: 1,
    padding: CMConstants.space.smallEx - 4,
    borderWidth: 1,
    borderRadius: CMConstants.radius.normal,
    overflow: 'visible' as const,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    flexWrap: 'nowrap' as const,
  },
  topPlayerProfileImage: {},
  topPlayerInfoContainer: {
    flex: 1,
    marginLeft: CMConstants.space.smallEx - 4,
    marginRight: CMConstants.space.smallEx - 4,
    minWidth: 70,
  },
  topPlayerName: {
    fontWeight: '700' as const,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  topPlayerTeamRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 2,
  },
  topPlayerTeamInfo: {
    flex: 1,
    marginLeft: 3,
    justifyContent: 'center' as const,
  },
  topPlayerTeamName: {
  },
  topPlayerStatsContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexShrink: 0,
  },
  topPlayerStatValue: {
    width: 24,
    textAlign: 'center' as const,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  topPlayerStatTitle: {
    width: 24,
    textAlign: 'center' as const,
    fontWeight: '700' as const,
    color: CMConstants.color.green,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  loadingFooter: {
    paddingVertical: CMConstants.space.normal,
    alignItems: 'center' as const,
  },
  emptyContainer: {
    padding: CMConstants.space.normal,
    alignItems: 'center' as const,
  },
  emptyText: {
    fontSize: CMConstants.fontSize.normal,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: CMConstants.space.normal,
  },
  loadingText: {
    marginTop: CMConstants.space.small,
    fontSize: CMConstants.fontSize.normal,
  },
  advancedFilterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: CMConstants.space.normal,
  },
  advancedFilterModal: {
    width: '100%' as const,
    maxWidth: 320,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    padding: CMConstants.space.normal,
  },
  advancedFilterHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: CMConstants.space.normal,
  },
  advancedFilterTitle: {
    fontSize: CMConstants.fontSize.normal,
    fontWeight: '700' as const,
  },
  advancedFilterSection: {
    marginBottom: CMConstants.space.normal,
  },
  advancedFilterLabel: {
    fontSize: CMConstants.fontSize.small,
    fontWeight: '600' as const,
    marginBottom: CMConstants.space.smallEx,
  },
  advancedFilterChipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: CMConstants.space.smallEx,
  },
  advancedFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: CMConstants.space.small,
    paddingVertical: CMConstants.space.smallEx - 3,
  },
  advancedFilterChipText: {
    fontSize: CMConstants.fontSize.smallEx,
    fontWeight: '600' as const,
  },
  advancedFilterActions: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: CMConstants.space.smallEx,
  },
  advancedFilterActionButton: {
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.small,
  },
  advancedFilterApplyButton: {
    borderRadius: CMConstants.radius.small,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
  },
  advancedFilterActionText: {
    fontSize: CMConstants.fontSize.small,
    fontWeight: '700' as const,
  },
};

export default CMAllTopPlayersScreen;

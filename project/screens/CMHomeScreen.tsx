import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
  TextInput,
  Keyboard,
  FlatList,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMUtils from '../utils/CMUtils';
import CMRipple from '../components/CMRipple';
import CMProfileImage from '../components/CMProfileImage';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMGlobal from '../CMGlobal';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, query, where, getDocs } from '@react-native-firebase/firestore';
import CMHamburgerMenu from '../components/CMHamburgerMenu';
import LinearGradient from 'react-native-linear-gradient';

interface LatestScore {
  id: string;
  dateTime: Date;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  round: string;
  game: string;
  series: string;
  leagueId: string;
  leagueName: string;
  leagueLogo: string;
  teamALogo: string;
  teamBLogo: string;
  status?: string;
  league?: {
    id: string;
    name: string;
    avatar?: string;
    teamsId?: string[];
    maxTeamSize?: number;
    adminId?: string;
    inviteId?: string;
  };
  topPlayerFromMatch?: {
    id: string;
    name: string;
    avatar?: string;
    points: number;
    rebounds: number;
    assists: number;
    teamName: string;
  };
}

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
  player?: any; // Allow full player object with all fields including birthDate, etc.
  team?: {
    id: string;
    name: string;
    avatar?: string;
  };
  league?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

const CMHomeScreen = ({ navigation, route }: CMNavigationProps) => {
  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('');

  // Get screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isSmallDevice = screenWidth < 375; // iPhone SE and similar
  const isLargeDevice = screenWidth > 414; // iPhone Plus and larger devices/tablets
  
  // Calculate responsive scaling factors
  const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;
  const buttonHeightScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0;
  const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0;

  // Background image for Latest News & Scores cards
  const homeNewsBG = require('../../assets/images/homeBG1.png');

  // Listen for theme changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
    });
    return unsubscribe;
  }, [navigation]);

  // Dynamic colors based on theme
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey2;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const closeButtonBackground = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1;
  const closeButtonIconColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const newsCardTextColor = CMConstants.color.white;

  // Load user name on mount
  useEffect(() => {
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      if (CMGlobal.user?.name) {
        setUserName(CMGlobal.user.name);
      } else {
        CMFirebaseHelper.getUser(currentUser.uid, (response: {[name: string]: any}) => {
          if (response.isSuccess && response.value?.name) {
            setUserName(response.value.name);
            CMGlobal.user = response.value;
          }
        });
      }
    }
  }, []);

  // Load more configuration
  const LOAD_MORE_LIMIT = 2;

  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [isLoadingTopPlayers, setIsLoadingTopPlayers] = useState(true);
  const [latestScores, setLatestScores] = useState<LatestScore[]>([]);
  const [isLoadingLatestScores, setIsLoadingLatestScores] = useState(false);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [newsArticles, setNewsArticles] = useState<any[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);

  // Show more state management
  const [latestScoresDisplayCount, setLatestScoresDisplayCount] = useState(LOAD_MORE_LIMIT);
  const [topPlayersDisplayCount, setTopPlayersDisplayCount] = useState(LOAD_MORE_LIMIT);

  // Top Players timeframe filter
  type TimeframeFilter = 'This Week' | 'This Month' | 'This Season';
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeFilter>('This Season');
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0, width: 0 });
  const dropdownButtonRef = useRef<View>(null);
  const timeframeOptions: TimeframeFilter[] = ['This Week', 'This Month', 'This Season'];
  const leaguesCacheRef = useRef<any[]>([]);
  const hasInitializedRef = useRef(false);
  const hasSeenFocusRef = useRef(false);
  const playerWithTeamCacheRef = useRef<Map<string, any>>(new Map());
  const latestScoresCacheRef = useRef<Map<string, LatestScore[]>>(new Map());
  const topPlayersCacheRef = useRef<Map<string, TopPlayer[]>>(new Map());
  const newsCacheRef = useRef<any[] | null>(null);

  const getAllLeaguesAsync = async (forceRefresh: boolean = false): Promise<any[]> => {
    if (!forceRefresh && leaguesCacheRef.current.length > 0) {
      return leaguesCacheRef.current;
    }

    return new Promise((resolve) => {
      CMFirebaseHelper.getAllLeagues((response: any) => {
        const nextLeagues = response.isSuccess && Array.isArray(response.value) ? response.value : [];
        leaguesCacheRef.current = nextLeagues;
        resolve(nextLeagues);
      });
    });
  };

  const getMatchesOfLeaguesAsync = (leagueIds: string[]): Promise<any[]> => {
    if (leagueIds.length === 0) {
      return Promise.resolve([]);
    }

    return new Promise((resolve) => {
      CMFirebaseHelper.getMatchesOfLeagues(leagueIds, (response: any) => {
        resolve(response.isSuccess && Array.isArray(response.value) ? response.value : []);
      });
    });
  };

  const getTeamByIdAsync = (teamId: string): Promise<any | null> => {
    return new Promise((resolve) => {
      CMFirebaseHelper.getTeamById(teamId, (response: any) => {
        resolve(response.isSuccess ? { id: teamId, ...response.value } : null);
      });
    });
  };

  const getPlayerWithTeamAsync = (playerId: string): Promise<any | null> => {
    if (playerWithTeamCacheRef.current.has(playerId)) {
      return Promise.resolve(playerWithTeamCacheRef.current.get(playerId));
    }

    return new Promise((resolve) => {
      CMFirebaseHelper.getPlayerWithTeam(playerId, (response: any) => {
        if (response.isSuccess) {
          playerWithTeamCacheRef.current.set(playerId, response.value);
          resolve(response.value);
        } else {
          resolve(null);
        }
      });
    });
  };

  const sortLeaguesForDisplay = (leagueItems: any[]) => {
    return [...leagueItems].sort((a, b) => {
      if (selectedLeagueId) {
        if (a.id === selectedLeagueId) return -1;
        if (b.id === selectedLeagueId) return 1;
      }
      return 0;
    });
  };

  const loadHomeSections = async (forceRefresh: boolean = false) => {
    const allLeagues = await getAllLeaguesAsync(forceRefresh);
    await Promise.all([
      loadLeagues(allLeagues),
      loadLatestScores(allLeagues, forceRefresh),
      loadNews(allLeagues, forceRefresh),
    ]);
  };

  const loadInitialHomeData = async () => {
    const allLeagues = await getAllLeaguesAsync(true);
    await Promise.all([
      loadLeagues(allLeagues),
      loadLatestScores(allLeagues, true),
      loadNews(allLeagues, true),
      loadTopPlayers(allLeagues, true),
    ]);
    hasInitializedRef.current = true;
  };

  // Load top players data
  useEffect(() => {
    loadInitialHomeData();
  }, []);

  const loadNews = async (allLeaguesParam?: any[], forceRefresh: boolean = false) => {
    setIsLoadingNews(true);

    try {
      if (!forceRefresh && newsCacheRef.current) {
        setNewsArticles(newsCacheRef.current);
        return;
      }

      const allLeagues = allLeaguesParam && allLeaguesParam.length > 0
        ? allLeaguesParam
        : await getAllLeaguesAsync();

      if (allLeagues.length === 0) {
        setNewsArticles([]);
        return;
      }

      const leagueIds = allLeagues.map((league: any) => league.id).filter(Boolean);
      const allMatches = await getMatchesOfLeaguesAsync(leagueIds);
      const matchesByLeague = new Map<string, any[]>();

      allMatches.forEach((match: any) => {
        if (!match.leagueId) return;
        if (!matchesByLeague.has(match.leagueId)) {
          matchesByLeague.set(match.leagueId, []);
        }
        matchesByLeague.get(match.leagueId)!.push(match);
      });

      const teamCache = new Map<string, any | null>();
      const completedSeasonResults = await Promise.all(
        allLeagues.map(async (league: any) => {
          if (!league.id) return null;

          const leagueMatches = matchesByLeague.get(league.id) || [];
          if (leagueMatches.length === 0) return null;

          const seasonMap = new Map<string, any[]>();
          leagueMatches.forEach((match: any) => {
            const seasonName = match.seasonName || 'Legacy Season';
            if (!seasonMap.has(seasonName)) {
              seasonMap.set(seasonName, []);
            }
            seasonMap.get(seasonName)!.push(match);
          });

          const completedSeasonsForLeague: Array<{ seasonName: string; endDate: Date; matches: any[] }> = [];

          for (const [seasonName, seasonMatches] of seasonMap.entries()) {
            const normalizedSeasonName = seasonName.trim().toLowerCase();
            const playoffMatches = seasonMatches.filter((m: any) => {
              const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
              return m.isPlayoff && matchSeasonName === normalizedSeasonName;
            });

            if (playoffMatches.length === 0) continue;

            const rounds = playoffMatches.map((m: any) => m.playoffRound || 1);
            const maxRound = Math.max(...rounds);
            const finalRoundMatches = playoffMatches.filter((m: any) => (m.playoffRound || 1) === maxRound);
            if (finalRoundMatches.length !== 1) continue;

            const finalMatch = finalRoundMatches[0];
            if (finalMatch.status !== CMConstants.gameStatus.finished) continue;

            const matchDates: Date[] = seasonMatches
              .map((m: any) => {
                const dt = m.dateTime;
                if (!dt) return null;
                if (dt.toDate) return dt.toDate();
                if (dt instanceof Date) return dt;
                return new Date(dt);
              })
              .filter(Boolean) as Date[];

            if (matchDates.length === 0) continue;

            matchDates.sort((a, b) => b.getTime() - a.getTime());
            completedSeasonsForLeague.push({
              seasonName,
              endDate: matchDates[0],
              matches: seasonMatches,
            });
          }

          if (completedSeasonsForLeague.length === 0) return null;

          completedSeasonsForLeague.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
          const mostRecentSeason = completedSeasonsForLeague[0];
          const normalizedSeasonName = mostRecentSeason.seasonName.trim().toLowerCase();
          const playoffMatches = mostRecentSeason.matches.filter((m: any) => {
            const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
            return m.isPlayoff && matchSeasonName === normalizedSeasonName;
          });
          const rounds = playoffMatches.map((m: any) => m.playoffRound || 1);
          const maxRound = Math.max(...rounds);
          const finalMatch = playoffMatches.find((m: any) => (m.playoffRound || 1) === maxRound);

          if (!finalMatch) return null;

          const getCachedTeam = async (teamId?: string) => {
            if (!teamId) return null;
            if (teamCache.has(teamId)) return teamCache.get(teamId) ?? null;
            const team = await getTeamByIdAsync(teamId);
            teamCache.set(teamId, team);
            return team;
          };

          const [teamA, teamB] = await Promise.all([
            getCachedTeam(finalMatch.teamAId),
            getCachedTeam(finalMatch.teamBId),
          ]);

          return {
            id: `${league.id}_${mostRecentSeason.seasonName}`,
            leagueId: league.id,
            leagueName: league.name || 'League',
            leagueLogo: league.avatar,
            seasonName: mostRecentSeason.seasonName,
            endDate: mostRecentSeason.endDate,
            finalMatch: {
              ...finalMatch,
              teamA,
              teamB,
            },
          };
        })
      );

      const completedSeasons = completedSeasonResults.filter(Boolean) as any[];
      completedSeasons.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
      newsCacheRef.current = completedSeasons;
      setNewsArticles(completedSeasons);
    } finally {
      setIsLoadingNews(false);
    }
  };

  // Reload top players when timeframe changes or selected league changes
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    loadTopPlayers(leaguesCacheRef.current);
  }, [selectedTimeframe, selectedLeagueId]);

  // Reload latest scores when selected league changes
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    loadLatestScores(leaguesCacheRef.current);
  }, [selectedLeagueId]);

  // Reload latest scores when screen comes into focus (e.g., after adding stats)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!hasSeenFocusRef.current) {
        hasSeenFocusRef.current = true;
        return;
      }

      loadHomeSections(true);
      loadTopPlayers(leaguesCacheRef.current, true);
    });

    return unsubscribe;
  }, [navigation]);

  // Reload leagues when selection changes to update the order
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    loadLeagues(leaguesCacheRef.current);
  }, [selectedLeagueId]);

  // Filter latest scores based on search text
  const filteredLatestScores = useMemo(() => {
    if (!searchText.trim()) {
      return latestScores;
    }
    const searchLower = searchText.toLowerCase();
    return latestScores.filter(score => 
      score.teamA?.toLowerCase().includes(searchLower) ||
      score.teamB?.toLowerCase().includes(searchLower) ||
      score.leagueName?.toLowerCase().includes(searchLower) ||
      score.series?.toLowerCase().includes(searchLower)
    );
  }, [latestScores, searchText]);

  // Filter top players based on search text
  const filteredTopPlayers = useMemo(() => {
    if (!searchText.trim()) {
      return topPlayers;
    }
    const searchLower = searchText.toLowerCase();
    return topPlayers.filter(player => 
      player.player?.name?.toLowerCase().includes(searchLower) ||
      player.team?.name?.toLowerCase().includes(searchLower) ||
      player.league?.name?.toLowerCase().includes(searchLower)
    );
  }, [topPlayers, searchText]);

  // Load leagues for the leagues section
  const loadLeagues = async (allLeaguesParam?: any[]) => {
    setIsLoadingLeagues(true);
    const allLeagues = allLeaguesParam && allLeaguesParam.length > 0
      ? allLeaguesParam
      : await getAllLeaguesAsync();
    setLeagues(allLeagues);
    setIsLoadingLeagues(false);
  };

  // Function to get latest match with top player data for a league using Firebase helper
  const getLatestMatchWithTopPlayer = (leagueId: string): Promise<any> => {
    return new Promise((resolve) => {
      CMFirebaseHelper.getLatestMatchByLeague(leagueId, (response: {[name: string]: any}) => {
        if (response.isSuccess) {
          resolve(response.value);
        } else {
          resolve(null);
        }
      });
    });
  };

  const loadLatestScores = async (allLeaguesParam?: any[], forceRefresh: boolean = false) => {
    setIsLoadingLatestScores(true);

    try {
      const allLeagues = allLeaguesParam && allLeaguesParam.length > 0
        ? allLeaguesParam
        : await getAllLeaguesAsync();

      if (allLeagues.length === 0) {
        setLatestScores([]);
        return;
      }

      const cacheKey = selectedLeagueId || 'all';
      if (!forceRefresh && latestScoresCacheRef.current.has(cacheKey)) {
        setLatestScores(latestScoresCacheRef.current.get(cacheKey) || []);
        return;
      }

      const leaguesToProcess = selectedLeagueId
        ? allLeagues.filter((league: { id: string }) => league.id === selectedLeagueId)
        : allLeagues;

      const leaguePromises: Array<Promise<LatestScore | null>> = leaguesToProcess.map(async (league: any): Promise<LatestScore | null> => {
        try {
          const match = await getLatestMatchWithTopPlayer(league.id);

          if (!match) return null;

          const [teamAResponse, teamBResponse] = await Promise.all([
            getTeamByIdAsync(match.teamAId),
            getTeamByIdAsync(match.teamBId),
          ]);

          if (!teamAResponse || !teamBResponse) {
            return null;
          }

          const leagueLocation = [league.city, league.state].filter(Boolean).join(', ');
         // console.log('Processed latest match for league:', new Date(match.dateTime._seconds));
          return {
            id: match.id,
            dateTime: new Date(match.dateTime._seconds * 1000),
            teamA: teamAResponse.name || 'Unknown Team',
            teamB: teamBResponse.name || 'Unknown Team',
            scoreA: match.teamAScore || 0,
            scoreB: match.teamBScore || 0,
            round: 'Match',
            game: match.name || 'Match',
            series: leagueLocation || match.location || 'Arena',
            leagueId: league.id || '',
            leagueName: league.name || 'Unknown League',
            leagueLogo: league.avatar || '',
            teamALogo: teamAResponse.avatar || '',
            teamBLogo: teamBResponse.avatar || '',
            status: match.status || CMConstants.gameStatus.notStarted,
            league: {
              id: league.id || '',
              name: league.name || 'Unknown League',
              avatar: league.avatar || '',
              teamsId: league.teamsId || [],
              maxTeamSize: league.maxTeamSize || 8,
              adminId: league.adminId || '',
              inviteId: league.inviteId || '',
            },
            topPlayerFromMatch: match.topPlayerFromMatch,
          };
        } catch (error) {
          return null;
        }
      });

      const scoreItems = await Promise.all(leaguePromises);
      const latestScoresData = scoreItems.filter((item): item is LatestScore => item !== null);

      latestScoresData.sort((a, b) => {
        const totalScoreA = (a.scoreA || 0) + (a.scoreB || 0);
        const totalScoreB = (b.scoreA || 0) + (b.scoreB || 0);
        return totalScoreB - totalScoreA;
      });

      latestScoresCacheRef.current.set(cacheKey, latestScoresData);
      setLatestScores(latestScoresData);
    } finally {
      setIsLoadingLatestScores(false);
    }
  };


  // Helper function to get date range based on timeframe
  const getDateRangeForTimeframe = (timeframe: TimeframeFilter): { startDate: Date; endDate: Date } | null => {
    const now = new Date();
    const endDate = now;
    let startDate: Date;

    switch (timeframe) {
      case 'This Week':
        // Get start of current week (Sunday)
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate };
      
      case 'This Month':
        // Get start of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate };
      
      case 'This Season':
        // No date filtering for season
        return null;
      
      default:
        return null;
    }
  };

  const loadTopPlayers = async (allLeaguesParam?: any[], forceRefresh: boolean = false) => {
    setIsLoadingTopPlayers(true);

    const dateRange = getDateRangeForTimeframe(selectedTimeframe);
    try {
      const allLeagues = allLeaguesParam && allLeaguesParam.length > 0
        ? allLeaguesParam
        : await getAllLeaguesAsync();

      const leaguesToProcess = selectedLeagueId 
        ? allLeagues.filter((league: any) => league.id === selectedLeagueId)
        : allLeagues;
      const allPlayerStats: any[] = [];
      const cacheKey = `${selectedTimeframe}::${selectedLeagueId || 'all'}`;

      if (leaguesToProcess.length === 0) {
        setTopPlayers([]);
        return;
      }

      if (!forceRefresh && topPlayersCacheRef.current.has(cacheKey)) {
        setTopPlayers(topPlayersCacheRef.current.get(cacheKey) || []);
        return;
      }

      if (selectedTimeframe === 'This Week') {
        const leaguePromises = leaguesToProcess.map(async (league: any) => {
          try {
            const statsQuery = query(collection(getFirestore(), 'playerStats'), where('leagueId', '==', league.id));
            const statsSnapshot = await getDocs(statsQuery);

            const playerBestGames = new Map<string, any>();

            statsSnapshot.forEach((doc: any) => {
              const stat = doc.data();
              if (dateRange && stat.dayTime) {
                const statDate = stat.dayTime.toDate();
                if (statDate < dateRange.startDate || statDate > dateRange.endDate) {
                  return;
                }
              }

              const points = Number(stat.pointsPerGame) || 0;
              const playerId = stat.playerId;
              const uniqueKey = `${league.id}_${playerId}`;

              if (!playerBestGames.has(uniqueKey) || points > playerBestGames.get(uniqueKey).points) {
                playerBestGames.set(uniqueKey, {
                  playerId,
                  leagueId: league.id,
                  points,
                  assists: Number(stat.assists) || 0,
                  rebounds: Number(stat.rebounds) || 0,
                  steals: Number(stat.steals) || 0,
                  blocks: Number(stat.blocks) || 0,
                  turnovers: Number(stat.turnovers) || 0,
                  league,
                });
              }
            });

            return Array.from(playerBestGames.values());
          } catch (error) {
            return [];
          }
        });

        const allLeagueStats = await Promise.all(leaguePromises);
        allPlayerStats.push(...allLeagueStats.flat());
        allPlayerStats.sort((a, b) => (b.points || 0) - (a.points || 0));
        const top10 = allPlayerStats.slice(0, 10);

        const playerPromises = top10.map(async (stat) => {
          const playerData = await getPlayerWithTeamAsync(stat.playerId);
          if (playerData) {
            return {
              id: `${stat.leagueId}${stat.playerId}`,
              playerId: stat.playerId,
              leagueId: stat.leagueId,
              matches: 1,
              averagePoints: stat.points,
              averageAssists: stat.assists,
              averageRebounds: stat.rebounds,
              averageSteals: stat.steals,
              averageBlocks: stat.blocks,
              averageTurnovers: stat.turnovers,
              player: playerData,
              team: playerData.team,
              league: stat.league,
            };
          }
          return null;
        });

        const topPlayers = (await Promise.all(playerPromises)).filter((p) => p !== null) as TopPlayer[];
        topPlayersCacheRef.current.set(cacheKey, topPlayers);
        setTopPlayers(topPlayers);
      } else if (selectedTimeframe === 'This Month') {
        const leaguePromises = leaguesToProcess.map(async (league: any) => {
          try {
            const statsQuery = query(collection(getFirestore(), 'playerStats'), where('leagueId', '==', league.id));
            const statsSnapshot = await getDocs(statsQuery);

            const playerStatsMap = new Map<string, any[]>();

            statsSnapshot.forEach((doc: any) => {
              const stat = doc.data();
              if (dateRange && stat.dayTime) {
                const statDate = stat.dayTime.toDate();
                if (statDate < dateRange.startDate || statDate > dateRange.endDate) {
                  return;
                }
              }

              const playerId = stat.playerId;
              const uniqueKey = `${league.id}_${playerId}`;

              if (!playerStatsMap.has(uniqueKey)) {
                playerStatsMap.set(uniqueKey, []);
              }
              playerStatsMap.get(uniqueKey)?.push({ ...stat, league });
            });

            const leaguePlayerStats: any[] = [];
            for (const [, stats] of playerStatsMap) {
              const totalPoints = stats.reduce((sum, s) => sum + (Number(s.pointsPerGame) || 0), 0);
              const totalAssists = stats.reduce((sum, s) => sum + (Number(s.assists) || 0), 0);
              const totalRebounds = stats.reduce((sum, s) => sum + (Number(s.rebounds) || 0), 0);
              const totalSteals = stats.reduce((sum, s) => sum + (Number(s.steals) || 0), 0);
              const totalBlocks = stats.reduce((sum, s) => sum + (Number(s.blocks) || 0), 0);
              const totalTurnovers = stats.reduce((sum, s) => sum + (Number(s.turnovers) || 0), 0);
              const matchCount = stats.length;

              leaguePlayerStats.push({
                playerId: stats[0].playerId,
                leagueId: league.id,
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

            return leaguePlayerStats;
          } catch (error) {
            return [];
          }
        });

        const allLeagueStats = await Promise.all(leaguePromises);
        allPlayerStats.push(...allLeagueStats.flat());
        allPlayerStats.sort((a, b) => (b.points || 0) - (a.points || 0));
        const top10 = allPlayerStats.slice(0, 10);

        const playerPromises = top10.map(async (stat) => {
          const playerData = await getPlayerWithTeamAsync(stat.playerId);
          if (playerData) {
            return {
              id: `${stat.leagueId}${stat.playerId}`,
              playerId: stat.playerId,
              leagueId: stat.leagueId,
              matches: stat.matches,
              averagePoints: stat.points,
              averageAssists: stat.assists,
              averageRebounds: stat.rebounds,
              averageSteals: stat.steals,
              averageBlocks: stat.blocks,
              averageTurnovers: stat.turnovers,
              player: playerData,
              team: playerData.team,
              league: stat.league,
            };
          }
          return null;
        });

        const topPlayers = (await Promise.all(playerPromises)).filter((p) => p !== null) as TopPlayer[];
        topPlayersCacheRef.current.set(cacheKey, topPlayers);
        setTopPlayers(topPlayers);
      } else {
        const leaguePromises = leaguesToProcess.map(async (league: any) => {
          try {
            const statsResponse = await new Promise<any>((resolve) => {
              CMFirebaseHelper.getPlayerAverageStatsByLeague(league.id, resolve);
            });

            if (statsResponse.isSuccess && Array.isArray(statsResponse.value) && statsResponse.value.length > 0) {
              return statsResponse.value.map((stat: any) => ({
                ...stat,
                league,
                points: stat.averagePoints,
              }));
            }
            return [];
          } catch (error) {
            return [];
          }
        });

        const allLeagueStats = await Promise.all(leaguePromises);
        allPlayerStats.push(...allLeagueStats.flat());
        allPlayerStats.sort((a, b) => (b.points || 0) - (a.points || 0));
        const top10 = allPlayerStats.slice(0, 10);

        const playerPromises = top10.map(async (stat) => {
          const playerData = await getPlayerWithTeamAsync(stat.playerId);
          if (playerData) {
            return {
              id: stat.id || `${stat.leagueId}${stat.playerId}`,
              playerId: stat.playerId || '',
              leagueId: stat.leagueId || '',
              matches: stat.matches || 0,
              averagePoints: stat.averagePoints || 0,
              averageAssists: stat.averageAssists || 0,
              averageRebounds: stat.averageRebounds || 0,
              averageSteals: stat.averageSteals || 0,
              averageBlocks: stat.averageBlocks || 0,
              averageTurnovers: stat.averageTurnovers || 0,
              player: playerData,
              team: playerData.team,
              league: stat.league,
            };
          }
          return null;
        });

        const topPlayers = (await Promise.all(playerPromises)).filter((p) => p !== null) as TopPlayer[];
        topPlayersCacheRef.current.set(cacheKey, topPlayers);
        setTopPlayers(topPlayers);
      }
    } finally {
      setIsLoadingTopPlayers(false);
    }
  };



  const renderLatestScoreItem = ({ item }: { item: LatestScore }) => {
    
    return (
    <CMRipple
      containerStyle={[styles.topPlayerCardContent, { marginBottom: 3 }]}
      onPress={() => {
        // Navigate to league detail screen
        navigation.navigate(CMConstants.screenName.leagueDetails, {
          league: item.league
        });
      }}
    >
    


      {/* <View style={[styles.scoreRow, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}> */}
        <LinearGradient
                      colors={[
                        CMConstants.color.greenDark+'50',
                        
                        '#74f7bc',
                        CMConstants.color.greenDark+'50',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{
                        paddingLeft: 3,
                        borderRadius: CMConstants.radius.normal,
                        marginBottom: 2,
                        width:'100%'
                      }}
                    >
        <View style={[styles.scoreRow, { backgroundColor: CMConstants.color.darkGrey2, width: '100%', borderColor: cardBorderColor }]}>
          <View style={[styles.leagueIconGame, {backgroundColor: 'transparent', borderColor: CMConstants.color.greenDark+'25', borderWidth: 1, borderRadius: CMConstants.radius.normal, justifyContent: 'center', alignItems: 'center'}]}>
        <CMProfileImage
          radius={75}
          // style={styles.leagueIconGame}
          imgURL={item.leagueLogo}
        />
        </View>
        {/* Match Details */}
        <View style={{ flex: 1, marginHorizontal: 10, position: 'relative', justifyContent: 'left' }}>
          {/* LIVE Badge - Positioned absolutely in top-right - Only show if match is in progress */}
          {/* {true && (
            <View style={[styles.liveBadge, { position: 'absolute', top: 0, right: 0, zIndex: 10 }]}>
              <View style={styles.liveDot} />
              <Text style={[styles.liveText, {
                fontSize: 10 * fontScale
              }]}>LIVE</Text>
            </View>
          )} */}
          
          {/* Match Info - Now has full width */}
          <View style={{ marginBottom: CMConstants.space.smallEx - 2, paddingRight: item.status === CMConstants.gameStatus.inProgress ? 60 : 0 }}>
            <Text style={[styles.scoreSubtitle, { 
              color: placeholderColor,
              fontSize: 11 * fontScale
            }]} numberOfLines={3} ellipsizeMode="tail">
              <Text style={{ fontWeight: 'bold', color: placeholderColor }}>{item.leagueName}</Text> - {item.series}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
  {/* Team A: logo + name centered */}
  <View style={{ flex: 1, alignItems: 'center' }}>
    <CMProfileImage radius={48} imgURL={item.teamALogo} />
    <Text
      style={[styles.teamName, { color: textColor, fontSize: 11 * fontScale, textAlign: 'center' }]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {item.teamA}
    </Text>
  </View>
  {/* Scores + vs — fixed width per score so double digits don't shift layout */}
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {item.status !== CMConstants.gameStatus.notStarted && (
    <Text style={[styles.teamScore, { color: item.status === CMConstants.gameStatus.finished && item.scoreA > item.scoreB ? CMConstants.color.green : textColor, fontSize: 36 * fontScale, width: 52, textAlign: 'center' }]}>
      {item.scoreA}
    </Text>)}
    {item.status === CMConstants.gameStatus.inProgress ? (
      <View style={[styles.liveBadge ]}>
              <View style={styles.liveDot} />
              <Text style={[styles.liveText, {
                fontSize: 10 * fontScale
              }]}>LIVE</Text>
            </View>
  
    ) : item.status === CMConstants.gameStatus.notStarted ? (
    <View style={{alignItems: 'center' }}>
      <Text style={{ fontSize: 14 * fontScale, color: placeholderColor, fontWeight: 'bold', marginHorizontal: 6}}>
      {new Date(item.dateTime).toLocaleDateString()}
    </Text>
    <Text style={{ fontSize: 18 * fontScale, color: placeholderColor, fontWeight: 'bold', marginHorizontal: 6}}>
      {new Date(item.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </Text>

    </View>
    ) : 
    (
    <Text style={{ fontSize: 18 * fontScale, color: placeholderColor, fontWeight: 'bold', marginHorizontal: 6}}>
      FINAL
    </Text>
    )
    }
    {item.status !== CMConstants.gameStatus.notStarted  && (
    <Text style={[styles.teamScore, { color: item.status === CMConstants.gameStatus.finished && item.scoreB > item.scoreA ? CMConstants.color.green : textColor, fontSize: 36 * fontScale, width: 52, textAlign: 'center' }]}>
      {item.scoreB}
    </Text>
    )}
  </View>
  {/* Team B: logo + name centered */}
  <View style={{ flex: 1, alignItems: 'center' }}>
    <CMProfileImage radius={48} imgURL={item.teamBLogo} />
    <Text
      style={[styles.teamName, { color: textColor, fontSize: 11 * fontScale, textAlign: 'center' }]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {item.teamB}
    </Text>
  </View>
</View>

          {/* Top Player from Match */}
          {item.topPlayerFromMatch && (
            <View style={[styles.topPlayerFromMatchContainer, ]}>
              <View style={styles.topPlayerFromMatchInfo}>
                <CMProfileImage
                  radius={16}
                  imgURL={item.topPlayerFromMatch.avatar}
                  isUser={true}
                />
                <Text style={[styles.topPlayerFromMatchName, { 
                  color: textColor,
                  fontSize: 12 * fontScale
                }]}>
                  <Text style={{ fontWeight: '700', color: textColor }}>
                    {item.topPlayerFromMatch.name}
                  </Text>
                  <Text style={{ fontSize: 12 * fontScale, color: CMConstants.color.green, fontWeight: '600' }}>
                    {' '}{item.topPlayerFromMatch.points} PTS
                  </Text>
                  <Text style={{ fontSize: 12 * fontScale, color: CMConstants.color.lightGrey, fontWeight: '600' }}>
                    {' | '}{item.topPlayerFromMatch.rebounds || 0} REB
                  </Text>
                  <Text style={{ fontSize: 12 * fontScale, color: CMConstants.color.lightGrey, fontWeight: '600' }}>
                    {' | '}{item.topPlayerFromMatch.assists || 0} AST
                  </Text>
                </Text>
              </View>
            </View>
          )}
        </View>
        </View>
              </LinearGradient>
      {/* </View> */}

    </CMRipple>
    );
  };




  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      {/* Modern Header */}
      <View
        style={{
          paddingTop: (CMUtils.isAndroid ? insets.top : 0) + CMConstants.space.normal,
          paddingHorizontal: CMConstants.space.normal,
          paddingBottom: CMConstants.space.small,
        }}
      >
        {!isSearching ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <View style={{ position: 'absolute', left: 0 }}>
              <CMHamburgerMenu
                navigation={navigation}
                themeMode={themeMode}
                currentRoute="Home"
              />
            </View>
            <Image
              source={require('../../assets/images/logo.png')}
              style={{ width: 120, height: 40, resizeMode: 'contain' }}
            />
            <CMRipple
              containerStyle={{
                ...CMCommonStyles.circle(CMConstants.height.iconBigEx),
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: CMConstants.color.green,
                position: 'absolute',
                right: 0,
              }}
              onPress={() => {
                setIsSearching(true);
              }}
            >
                <Ionicons
                  name={'search-outline'}
                  size={CMConstants.height.icon * iconScale}
                  color={CMConstants.color.green}
                />
            </CMRipple>
            {/* <CMRipple
              containerStyle={{
                ...CMCommonStyles.circle(CMConstants.height.iconBigEx),
                justifyContent: 'center',
                alignItems: 'center',
                marginLeft: CMConstants.space.smallEx,
                borderWidth: 2,
                borderColor: CMConstants.color.green,
              }}
              onPress={() => {
                navigation.navigate(CMConstants.screenName.settings);
              }}
            >
              <Ionicons
                name={'settings-outline'}
                size={CMConstants.height.icon}
                color={CMConstants.color.green}
              />
            </CMRipple> */}
          </View>
        ) : (
          <View style={{ width: '100%', position: 'relative', justifyContent: 'center' }}>
            <TextInput
              style={{
                width: '100%',
                height: CMConstants.height.textInput * buttonHeightScale,
                backgroundColor: inputBackgroundColor,
                borderRadius: CMConstants.radius.normal,
                paddingLeft: CMConstants.space.small,
                paddingRight: CMConstants.height.iconBig + CMConstants.space.small + CMConstants.space.smallEx,
                color: inputTextColor,
                fontSize: CMConstants.fontSize.normal * fontScale,
                borderWidth: isDarkMode ? 0 : 1,
                borderColor: isDarkMode ? 'transparent' : CMConstants.color.lightGrey,
              }}
              value={searchText}
              onChangeText={text => setSearchText(text)}
              placeholder="Search"
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
                  size={CMConstants.height.icon * iconScale}
                  color={closeButtonIconColor}
                />
              </CMRipple>
            </View>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: CMConstants.space.small }}
          showsVerticalScrollIndicator={false}
          onScroll={() => {
            if (showTimeframeDropdown) {
              setShowTimeframeDropdown(false);
            }
          }}
          scrollEventThrottle={16}
        >
        {/* Leagues Section */}
        <View style={[styles.section, { marginBottom: 2}]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="trophy" size={20 * iconScale} color={CMConstants.color.green} style={{ marginHorizontal: CMConstants.space.smallEx }} />
              <Text style={[styles.sectionTitle, { 
                color: textColor,
                fontSize: (CMConstants.fontSize.medium + 2) * fontScale,
                fontStyle: 'italic',
              }]}>LEAGUES</Text>
              {selectedLeagueId && (
                <CMRipple
                  containerStyle={[styles.clearFilterButton, { 
                    backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey1,
                    marginLeft: CMConstants.space.normal,
                  }]}
                  onPress={() => setSelectedLeagueId(null)}
                >
                  <Ionicons
                    name="close-circle"
                    size={14 * iconScale}
                    color={CMConstants.color.green}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.clearFilterText, {
                    fontSize: 11 * fontScale,
                    color: CMConstants.color.green
                  }]}>Clear Filter</Text>
                </CMRipple>
              )}
            </View>
            <CMRipple
              containerStyle={styles.viewAllButton}
              onPress={() => {
                navigation.navigate('League');
              }}
            >
              <Text style={[styles.viewAllText, {
                fontSize: 12 * fontScale,
                color: CMConstants.color.green
              }]}>VIEW ALL</Text>
            </CMRipple>
          </View>

          {isLoadingLeagues ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={CMConstants.color.green} />
            </View>
          ) : leagues.length > 0 ? (
            <FlatList
              data={leagues}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id || Math.random().toString()}
              contentContainerStyle={styles.leaguesListContainer}
              renderItem={({ item }) => {
                const isSelected = selectedLeagueId === item.id;
                return (
                  <CMRipple
                    containerStyle={styles.leagueIconContainer}
                    onPress={() => {
                      // Toggle league selection to filter honor page
                      if (isSelected) {
                        setSelectedLeagueId(null);
                      } else {
                        setSelectedLeagueId(item.id);
                      }
                    }}
                  >
                    <LinearGradient
                      colors={['#3cf7a3',
                        CMConstants.color.greenAccent+'50',

                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        padding: isSelected ? 2 : 0,
                        borderRadius: 100,
                        marginBottom: 2,
                      }}
                    >
                    <View style={[
                      styles.leagueIconWrapper,
                      isSelected && styles.leagueIconWrapperSelected
                    ]}>
                      <CMProfileImage
                        radius={100}
                        border={!isSelected}
                        imgURL={item.avatar}
                      />
                    </View>
                    </LinearGradient>
                  </CMRipple>
                );
              }}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { 
                color: placeholderColor,
                fontSize: 14 * fontScale
              }]}>No leagues available</Text>
            </View>
          )}
        </View>

        {/* Latest News & Scores Section */}
        <View style={styles.section}>
          {/* <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flame" size={20 * iconScale} color={CMConstants.color.green} style={{ marginHo: CMConstants.space.smallEx }} />
              <Text style={[styles.sectionTitle, { 
                color: textColor,
                fontSize: (CMConstants.fontSize.medium + 2) * fontScale
              }]}>Latest News & Scores</Text>
            </View>
            <CMRipple
              containerStyle={styles.arrowButton}
              onPress={() => {
                navigation.navigate('Activity Feed');
              }}
            >
              <Ionicons name="chevron-forward" size={20 * iconScale} color={CMConstants.color.green} />
            </CMRipple>
          </View> */}

          {/* News Articles Carousel */}
          {isLoadingNews ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={CMConstants.color.green} />
            </View>
          ) : newsArticles.length > 0 ? (
            <FlatList
              data={newsArticles}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ marginTop: CMConstants.space.smallEx }}
              renderItem={({ item }) => {
                // Item is now a completed season, not a match news item
                const finalMatch = item.finalMatch;
                if (!finalMatch) return null;

                const scoreA = finalMatch.teamAScore ?? 0;
                const scoreB = finalMatch.teamBScore ?? 0;
                const teamAName = finalMatch.teamA?.name || 'Team A';
                const teamBName = finalMatch.teamB?.name || 'Team B';
                const winnerName = scoreA > scoreB ? teamAName : teamBName;
                const scoreLine = `${scoreA} - ${scoreB}`;
                const margin = Math.abs(scoreA - scoreB);

                const teamAAvatar = finalMatch.teamA?.avatar;
                const teamBAvatar = finalMatch.teamB?.avatar;
                const leagueLogo = item.leagueLogo;
                const seasonLabel = item.seasonName ? `Season "${item.seasonName}"` : 'this season';

                return (
                  <CMRipple
                    containerStyle={{
                      width: screenWidth * 1,
                      paddingHorizontal: CMConstants.space.smallEx,
                    }}
                    onPress={() => {
                      // Navigate to news detail page for the completed season
                      if (item.leagueId) {
                        CMFirebaseHelper.getLeague(item.leagueId, (response: { [name: string]: any }) => {
                          const leagueForArticle = response.isSuccess && response.value 
                            ? { ...response.value, seasonName: item.seasonName }
                            : { id: item.leagueId, name: item.leagueName, seasonName: item.seasonName };
                          
                          // Get the winning team for context
                          const winningTeam = scoreA > scoreB ? finalMatch.teamA : finalMatch.teamB;
                          
                          navigation.navigate(CMConstants.screenName.newsDetail, {
                            highlightType: 'champion',
                            league: leagueForArticle,
                            team: winningTeam,
                            context: {
                              teamName: winningTeam?.name || winnerName,
                              record: 'Champions', // Could calculate actual record if needed
                            },
                          });
                        });
                      }
                    }}
                  >
                    <ImageBackground
                      source={homeNewsBG}
                      style={{
                        width: '100%',
                        borderRadius: CMConstants.radius.normal,
                        overflow: 'hidden',
                      }}
                      imageStyle={{
                        borderRadius: CMConstants.radius.normal,
                      }}
                    >
                      {/* Semi-transparent overlay to increase contrast */}
                        {/* Gradient overlay */}
  <LinearGradient
    colors={[
      'rgba(0,0,0,1)',
      'rgba(0,0,0,0.35)',
      'rgba(0,0,0,1)',
    ]}
    start={{ x: 0, y: 0.5 }}
    end={{ x: 1, y: 0.5 }}
    style={{
      paddingHorizontal: CMConstants.space.smallEx,
      paddingVertical: CMConstants.space.smallEx * 1.8,
      minHeight: 100,
      //paddingRight: CMConstants.space.smallEx * 9,
      justifyContent: 'space-between',
    }}
  >
    {/* content */}

                        {/* Text block */}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: CMConstants.space.smallEx / 2, justifyContent:"space-between", width:"100%" }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="flame" size={16 * iconScale} color={CMConstants.color.green} style={{ marginHorizontal: CMConstants.space.smallEx }} />
                             <Text style={[styles.sectionTitle, { 
                              color: textColor,
                              fontSize: (CMConstants.fontSize.smallEx - 2) * fontScale,
                            }]}>LATEST NEWS</Text>
                          </View>
                          <View style={{width:16 * iconScale, height:16 * iconScale, justifyContent:'center', alignItems:'center'}}>
                                <Ionicons name="chevron-forward" size={16 * iconScale} color={CMConstants.color.green} />

                          </View>
                          </View>
                          {/* Title line: season completed */}
                          <View
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: CMConstants.space.smallEx / 2,
  }}
>
  {leagueLogo ? (
    <View style={{ marginRight: 6 }}>
      <CMProfileImage radius={30} imgURL={leagueLogo} />
    </View>
  ) : null}

  <Text
    style={{
      color: newsCardTextColor,
      fontSize: 14 * fontScale,
      fontWeight: '700',
      flexShrink: 1,
    }}
    numberOfLines={1}
    ellipsizeMode="tail"
  >
    {item.leagueName} - {seasonLabel} Complete
  </Text>
</View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: CMConstants.space.smallEx / 2, justifyContent: 'space-between', width: '100%' }}>
                          {/* Subtitle: winner */}
                          <Text
                            style={{
                              color: newsCardTextColor,
                              fontSize: 18 * fontScale,
                              fontWeight: 'bold',
                              marginBottom: CMConstants.space.smallEx / 2,
                              width:"45%"
                            }}
                          >
                            {winnerName} Wins Championship
                          </Text>

                          {/* Team rows with logos and scores */}
                          <View
                            style={{
                              marginTop: CMConstants.space.smallEx / 4,
                              backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey1,
                              padding: CMConstants.space.small / 2,
                              borderRadius: CMConstants.radius.small,
                              borderWidth: 1,
                              borderColor: isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.lightGrey,
                              justifyContent: 'center',
                            }}
                          >
                            {/* Team A row */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: CMConstants.space.smallEx / 3,
                              }}
                            >
                              <CMProfileImage radius={18} imgURL={teamAAvatar} />
                              <Text
                                style={{
                                  color: newsCardTextColor,
                                  fontSize: 13 * fontScale,
                                  fontWeight: 'bold',
                                  marginLeft: CMConstants.space.smallEx / 2,
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {teamAName} <Text style={{ color: scoreA > scoreB ? CMConstants.color.green : newsCardTextColor }}> {scoreA}</Text>
                              </Text>
                            </View>

                            {/* Team B row */}
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}
                            >
                              <CMProfileImage radius={18} imgURL={teamBAvatar} />
                              <Text
                                style={{
                                  color: newsCardTextColor,
                                  fontSize: 13 * fontScale,
                                  fontWeight: 'bold',
                                  marginLeft: CMConstants.space.smallEx / 2,
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {teamBName} <Text style={{ color: scoreB > scoreA ? CMConstants.color.green : newsCardTextColor }}> {scoreB}</Text>
                              </Text>
                            </View>
                          </View>
                        </View>
                        </View>
                        
                        </LinearGradient>
                    </ImageBackground>
                    
                  </CMRipple>
                );
              }}
            />
          ) : null}
        </View>

        {/* Live Matches Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: CMConstants.space.smallEx }}>
              <Ionicons name="pulse-outline" size={20 * iconScale} color={CMConstants.color.green} style={{ marginRight: CMConstants.space.smallEx }} />
              <Text style={[styles.sectionTitle, { 
                color: textColor,
                fontSize: (CMConstants.fontSize.medium + 2) * fontScale,
                fontStyle: 'italic',
              }]}>MATCHES</Text>
            </View>
            <CMRipple
              containerStyle={styles.arrowButton}
              onPress={() => {
                navigation.navigate('Activity Feed');
              }}
            >
              <Ionicons name="chevron-forward" size={20 * iconScale} color={CMConstants.color.green} />
            </CMRipple>
          </View>

          {isLoadingLatestScores ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={CMConstants.color.green} />
            </View>
          ) : filteredLatestScores.length > 0 ? (
            <>
              <FlatList
                data={filteredLatestScores.slice(0, latestScoresDisplayCount)}
                renderItem={renderLatestScoreItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ width: '100%' }}
                ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
              />
              {filteredLatestScores.length > latestScoresDisplayCount ? (
                <CMRipple
                  containerStyle={styles.showMoreButton}
                  onPress={() => {
                    setLatestScoresDisplayCount(prev => Math.min(prev + LOAD_MORE_LIMIT, filteredLatestScores.length));
                  }}
                >
                  <Text style={[styles.showMoreText, {
                    fontSize: 14 * fontScale
                  }]}>Show More</Text>
                </CMRipple>
              ) : latestScoresDisplayCount > LOAD_MORE_LIMIT ? (
                <CMRipple
                  containerStyle={styles.showMoreButton}
                  onPress={() => {
                    setLatestScoresDisplayCount(LOAD_MORE_LIMIT);
                  }}
                >
                  <Text style={[styles.showMoreText, {
                    fontSize: 14 * fontScale
                  }]}>Show Less</Text>
                </CMRipple>
              ) : null}
            </>
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { 
                color: placeholderColor,
                fontSize: 14 * fontScale
              }]}>
                {searchText.trim() ? 'No results found' : 'No latest scores available'}
              </Text>
            </View>
          )}
        </View>

        {/* Top Players Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { zIndex: 1000, position: 'relative' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flame" size={20 * iconScale} color={CMConstants.color.green} style={{ marginRight: CMConstants.space.smallEx }} />
              <Text style={[styles.sectionTitle, { 
                color: textColor,
                fontSize: CMConstants.fontSize.large * fontScale
              }]}>CHMP | Rankings</Text>
            </View>
            
            {/* Timeframe Dropdown */}
            <View 
              ref={dropdownButtonRef}
              style={{ position: 'relative', zIndex: 1001 }}
            >
              <TouchableOpacity
                style={[styles.timeframeDropdown, { backgroundColor: cardBackgroundColor }]}
                onPress={() => {
                  if (dropdownButtonRef.current) {
                    dropdownButtonRef.current.measureInWindow((x, y, width, height) => {
                      setDropdownPosition({ 
                        x: x, 
                        y: y + height + (CMUtils.isAndroid ? insets.top : 0), 
                        width: width 
                      });
                      setShowTimeframeDropdown(!showTimeframeDropdown);
                    });
                  } else {
                    setShowTimeframeDropdown(!showTimeframeDropdown);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeframeDropdownText, {
                  fontSize: CMConstants.fontSize.smallEx * fontScale * 0.9
                }]}>{selectedTimeframe}</Text>
                <Ionicons
                  name={showTimeframeDropdown ? "chevron-up" : "chevron-down"}
                  size={12 * iconScale}
                  color={CMConstants.color.green}
                  style={{ marginLeft: CMConstants.space.smallEx - 2 }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Top Players List - Similar to CMPlayerStatCell */}
          <View style={styles.topPlayersList}>
            {isLoadingTopPlayers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={CMConstants.color.green} />
              </View>
            ) : filteredTopPlayers.length > 0 ? (
              <>
                {filteredTopPlayers.slice(0, topPlayersDisplayCount).map((player, index) => {
                  const placeBackgroundColor = index === 0 ? CMConstants.color.gold : index === 1 ? CMConstants.color.silver : index === 2 ? CMConstants.color.bronze : 'transparent';  
                  return (
                  <View key={player.id} style={{ marginBottom: CMConstants.space.smallEx - 2, marginHorizontal: 3, width: 150 }}>
                    {/* <LinearGradient
                      colors={[
                        CMConstants.color.greenAccent+'90',
                        "#fff",
                        CMConstants.color.greenAccent+'90',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        padding: 2,
                        borderRadius: CMConstants.radius.normal,
                        marginBottom: 2,
                      }}
                    > */}

                    <CMRipple
                      containerStyle={[styles.topPlayerScoreRow, { paddingVertical: 8, alignItems: 'center', backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}
                      onPress={() => {
                        // Navigate to player details screen
                        navigation.navigate(CMConstants.screenName.playerDetails, {
                          player: player.player,
                          team: player.team,
                          league: player.league
                        });
                      }}
                    >
                      <View style={{justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center', width:"100%"}}>
                      <Text style={{fontSize: 16 * fontScale, color: CMConstants.color.darkGrey3, fontWeight: 'bold', width: 32, height: 32, textAlign: 'center', backgroundColor: placeBackgroundColor, borderRadius: 12, padding: 2, textAlignVertical: 'center'}}>
                        {index + 1}
                      </Text>
                      <CMProfileImage
                        radius={24}
                        style={[styles.topPlayerProfileImage]}
                        imgURL={player.league?.avatar}
                      />
                      </View>
                      <View style={{ width: 3 }}></View>
                      {/* Player Profile Image */}
                      <CMProfileImage
                        radius={64}
                        style={styles.topPlayerProfileImage}
                        imgURL={player.player?.avatar}
                        isUser={true}
                      />

                      {/* Player Info */}
                      <View style={[styles.topPlayerInfoContainer, { flex: 1, minWidth: 70, maxWidth: 140 }]}>
                      <Text style={[styles.topPlayerName, { 
                        color: textColor,
                        fontSize: 12 * fontScale,
                        textAlign: 'center',
                      }]} numberOfLines={1} ellipsizeMode="tail">
                        {player.player?.name || 'Unknown Player'}
                      </Text>

                        <View style={styles.topPlayerTeamRow}>
                        {/* <CMProfileImage
                          radius={16}
                          imgURL={player.team?.avatar}
                        /> */}
                          <View style={styles.topPlayerTeamInfo}>
                            <Text style={[styles.topPlayerTeamName, { 
                              color: placeholderColor,
                              fontSize: 10 * fontScale,
                              textAlign: 'center',
                            }]} numberOfLines={1}>
                              {player.team?.name || 'Unknown Team'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Stats */}
                      <View style={styles.topPlayerStatsContainer}>
                        <View>
                          <Text style={[styles.topPlayerStatValue, { 
                            color: CMConstants.color.green,
                            fontSize: 13 * fontScale
                          }]}>
                            {Math.round(player.averagePoints)}
                          </Text>
                          <Text style={[styles.topPlayerStatTitle, {
                            fontSize: 13 * fontScale
                          }]}>
                            PTS
                          </Text>
                          </View>
                        <View>
                          <Text style={[styles.topPlayerStatValue, { 
                            color: textColor,
                            fontSize: 13 * fontScale
                          }]}>
                            {Math.round(player.averageAssists)}
                          </Text>
                          <Text style={[styles.topPlayerStatTitle, {
                            fontSize: 13 * fontScale
                          }]}>
                            AST
                          </Text>
                          
                        </View>
                        <View>
                          <Text style={[styles.topPlayerStatValue, { 
                            color: textColor,
                            fontSize: 13 * fontScale
                          }]}>
                            {Math.round(player.averageRebounds)}
                          </Text>
                          <Text style={[styles.topPlayerStatTitle, {
                            fontSize: 13 * fontScale
                          }]}>
                            REB
                          </Text>
                          
                        </View>
                        {/* <View>
                          <Text style={[styles.topPlayerStatValue, { 
                            color: textColor,
                            fontSize: 13 * fontScale
                          }]}>
                            {Math.round(player.averageBlocks)}
                          </Text>
                          <Text style={[styles.topPlayerStatTitle, {
                            fontSize: 13 * fontScale
                          }]}>
                            B
                          </Text>
                          
                        </View>
                        <View>
                          <Text style={[styles.topPlayerStatValue, { 
                            color: textColor,
                            fontSize: 13 * fontScale
                          }]}>
                            {Math.round(player.averageSteals)}
                          </Text>
                          <Text style={[styles.topPlayerStatTitle, {
                            fontSize: 13 * fontScale
                          }]}>
                            S
                          </Text>
                          
                        </View> */}
                      </View>
                    </CMRipple>
                    {/* </LinearGradient> */}
                  </View>
                )})}
                
              </>
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={[styles.noDataText, { 
                  color: placeholderColor,
                  fontSize: 14 * fontScale
                }]}>
                  {searchText.trim() ? 'No results found' : 'No top players found'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.showButtonsContainer}>
                  {filteredTopPlayers.length > 0 && (
                    <CMRipple
                      containerStyle={styles.showAllButton}
                      onPress={() => {
                        navigation.navigate('AllTopPlayers', {
                          players: filteredTopPlayers,
                          timeframe: selectedTimeframe,
                        });
                      }}
                    >
                      <Text style={[styles.showAllText, {
                        fontSize: 14 * fontScale
                      }]}>Show All</Text>
                    </CMRipple>
                  )}
                  {filteredTopPlayers.length > topPlayersDisplayCount ? (
                    <CMRipple
                      containerStyle={styles.showMoreButton}
                      onPress={() => {
                        setTopPlayersDisplayCount(prev => Math.min(prev + LOAD_MORE_LIMIT, filteredTopPlayers.length));
                      }}
                    >
                      <Text style={[styles.showMoreText, {
                      fontSize: 14 * fontScale
                    }]}>Show More</Text>
                    </CMRipple>
                  ) : topPlayersDisplayCount > LOAD_MORE_LIMIT ? (
                    <CMRipple
                      containerStyle={styles.showMoreButton}
                      onPress={() => {
                        setTopPlayersDisplayCount(LOAD_MORE_LIMIT);
                      }}
                    >
                      <Text style={[styles.showMoreText, {
                      fontSize: 14 * fontScale
                    }]}>Show Less</Text>
                    </CMRipple>
                  ) : null}
                </View>
        </View>
      </ScrollView>
      </View>

      {/* Dropdown Modal - Rendered outside ScrollView to prevent clipping */}
      <Modal
        visible={showTimeframeDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimeframeDropdown(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
          activeOpacity={1}
          onPress={() => setShowTimeframeDropdown(false)}
        >
          <View
            style={[
              styles.dropdownMenu,
              {
                position: 'absolute',
                top: dropdownPosition.y || 200,
                right: CMConstants.space.normal,
                width: dropdownPosition.width || 160,
                backgroundColor: cardBackgroundColor,
              }
            ]}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {timeframeOptions.map((option, index) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dropdownOption,
                  { borderBottomColor: cardBorderColor },
                  index === timeframeOptions.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={() => {
                  setSelectedTimeframe(option);
                  setShowTimeframeDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dropdownOptionText,
                  { 
                    color: textColor,
                    fontSize: CMConstants.fontSize.small * fontScale * 0.9
                  },
                  selectedTimeframe === option && styles.dropdownOptionTextSelected
                ]}>
                  {option}
                </Text>
                {selectedTimeframe === option ? (
                  <Ionicons
                    name="checkmark"
                    size={12 * iconScale}
                    color={CMConstants.color.green}
                    style={{ marginLeft: CMConstants.space.smallEx }}
                  />
                ) : (
                  <View style={{ width: 12 + CMConstants.space.smallEx }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = {
  section: {
    marginBottom: CMConstants.space.smallEx,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
    position: 'relative' as const,
  },
  sectionTitle: {
    // fontSize is now set dynamically in component
    fontWeight: 'bold' as const,
    letterSpacing: 0.5,
  },
  arrowButton: {
    ...CMCommonStyles.circle(CMConstants.height.iconBig),
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  scoreItem: {
    flexDirection: 'column' as const,
  },
  scoreHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: CMConstants.space.smallEx,
  },
  scoreContent: {
    flexDirection: 'column' as const,
  },


  playerCard: {
    backgroundColor: CMConstants.color.darkGrey2,
    borderRadius: CMConstants.radius.normal,
    padding: CMConstants.space.small,
    marginBottom: CMConstants.space.smallEx,
  },
  playerItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.small,
  },
  playerLeft: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    marginRight: CMConstants.space.small,
    width: 60,
  },
  playerIconContainer: {
    marginBottom: CMConstants.space.smallEx,
    width: 32,
    height: 32,
  },
  playerIcon: {
    width: 28,
    height: 28,
  },
  playerProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CMConstants.color.lightGrey2,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  playerInfo: {
    flex: 1,
    marginLeft: CMConstants.space.small,
  },
  playerTeamRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 4,
  },

  teamLogoText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold' as const,
  },
  playerFirstName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: CMConstants.color.black,
    marginBottom: 0,
  },
  playerLastName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: CMConstants.color.black,
    marginBottom: 2,
  },
  playerTeam: {
    fontSize: 12,
    color: CMConstants.color.grey,
  },
  playerStats: {
    flexDirection: 'column' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
    flex: 1,
    paddingRight: 8,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: CMConstants.color.black,
    textAlign: 'right' as const,
    marginBottom: 2,
  },
  scoreCard: {
    borderRadius: CMConstants.radius.small,
    flexDirection: 'row' as const,
    marginHorizontal: 1,
    marginBottom: CMConstants.space.smallEx,
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const
  },

  scoreRow: {
    flexDirection: 'row' as const,
    flex: 1,
    borderRadius: CMConstants.radius.normal,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    //paddingHorizontal: CMConstants.space.smallEx,
    //paddingVertical: CMConstants.space.smallEx,
                            borderTopWidth: 1,
                        borderBottomWidth: 1,
                        borderRightWidth: 1,
                        borderColor: CMConstants.color.semiLightGrey,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    height: 112
    //marginBottom: CMConstants.space.smallEx,
  },
  topPlayersCard: {
    width: '100%',
  },

  topPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    marginBottom: 10,
    borderRadius: CMConstants.radius.small,
  },

  topPlayerInfo: {
    flex: 1,
  },

  champLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CMConstants.color.denim,
    justifyContent: 'center',
    alignItems: 'center',
  },

  champText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: 'white',
  },

  scoreSubtitle: {
    // fontSize is now set dynamically in component
    marginBottom: 2,

  },

  teamRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 2,
  },

  teamLeft: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    flex: 1,
    marginRight: CMConstants.space.smallEx,
  },

  teamLogo: {
    width: 16,
    height: 16,
    marginRight: 4,
    borderRadius: 50,
  },

  teamName: {
    // fontSize is now set dynamically in component
    fontWeight: '500' as const,
    paddingVertical: 4,
    marginLeft: 4,
    flex: 1,
  },

  teamScore: {
    // fontSize is now set dynamically in component
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },

  // Top Players List Styles (similar to CMPlayerStatCell)
  topPlayersList: {
    width: '100%' as const,
    flexDirection: 'row' as const,
    flex: 1,
  },
  topPlayerCard: {
    borderRadius: CMConstants.radius.small,
    flexDirection: 'column' as const,
    marginHorizontal: 3,
    marginBottom: CMConstants.space.smallEx,
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  topPlayerScoreRow: {
    flexDirection: 'column' as const,
    flex: 1,
    padding: CMConstants.space.smallEx - 2,
    borderRadius: CMConstants.radius.normal,
    overflow: 'visible' as const,
    borderWidth: 1,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    flexWrap: 'nowrap' as const,
  },
  topPlayerCardContent: {
    flex: 1,
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    backgroundColor: 'transparent',
  },
  topPlayerProfileImage: {
  },
  topPlayerInfoContainer: {
    flex: 1,
    marginLeft: CMConstants.space.smallEx - 2,
    marginRight: CMConstants.space.smallEx - 2,
    minWidth: 80,
  },
  topPlayerName: {
    // fontSize is now set dynamically in component
    fontWeight: '700' as const,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  topPlayerLeagueName: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: CMConstants.color.denim,
    marginBottom: 4,
  },
  topPlayerTeamRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 1,
    marginBottom: 2,
  },
  topPlayerTeamInfo: {
    flex: 1,
    marginLeft: 3,
    justifyContent: 'center' as const,
  },
  topPlayerTeamName: {
    // fontSize is now set dynamically in component
  },
  topPlayerStatsContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexShrink: 0,
    marginLeft: CMConstants.space.smallEx - 2,
  },
  topPlayerStatValue: {
    width: 34,
    textAlign: 'center' as const,
    // fontSize is now set dynamically in component
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  topPlayerStatTitle: {
    width: 34,
    textAlign: 'center' as const,
    // fontSize is now set dynamically in component
    fontWeight: '700' as const,
    color: CMConstants.color.green,
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  performanceScoreContainer: {
    alignItems: 'center' as const,
    marginLeft: CMConstants.space.small,
    paddingHorizontal: CMConstants.space.small,
    paddingVertical: CMConstants.space.smallEx,
    backgroundColor: CMConstants.color.denim,
    borderRadius: CMConstants.radius.small,
  },
  performanceScoreLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: CMConstants.color.white,
    marginBottom: 2,
  },
  performanceScoreValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: CMConstants.color.white,
  },
  loadingContainer: {
    padding: CMConstants.space.normal,
    alignItems: 'center' as const,
  },
  loadingText: {
    // fontSize is now set dynamically in component
  },
  showButtonsContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.smallEx - 4,
    marginTop: CMConstants.space.smallEx - 4,
    marginBottom: 0,
  },
  showAllButton: {
    paddingVertical: 5,
  },
  showAllText: {
    // fontSize is now set dynamically in component
    fontWeight: '500' as const,
    color: CMConstants.color.green,
    textDecorationLine: 'underline' as const,
  },
  showMoreButton: {
    alignSelf: 'flex-end' as const,
    paddingVertical: 5,
  },
  showMoreText: {
    // fontSize is now set dynamically in component
    fontWeight: '500' as const,
    color: CMConstants.color.green,
    textDecorationLine: 'underline' as const,
  },
  noDataContainer: {
    padding: CMConstants.space.normal,
    alignItems: 'center' as const,
  },
  noDataText: {
    // fontSize is now set dynamically in component
  },
  topPlayerFromMatchContainer: {
    // paddingVertical: CMConstants.space.smallEx - 4,
    paddingHorizontal: CMConstants.space.smallEx - 2,
    marginTop: CMConstants.space.smallEx - 4,
    marginBottom: CMConstants.space.smallEx - 4,
    // borderRadius: CMConstants.radius.small - 2,
  //  backgroundColor: CMConstants.color.lightGrey1,
    alignSelf: 'stretch' as const,
    // borderWidth: 1,
    // borderColor: CMConstants.color.green + '30',
    // shadowColor: CMConstants.color.green,
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.1,
    // shadowRadius: 2,
    // elevation: 1,
  },
  topPlayerFromMatchInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'left' as const,
  },
  topPlayerFromMatchName: {
    // fontSize is now set dynamically in component
    fontWeight: '600' as const,
    marginHorizontal: CMConstants.space.smallEx - 4,
  },
  topPlayerFromMatchStats: {
    alignItems: 'flex-start' as const,
  },
  topPlayerFromMatchStat: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: CMConstants.color.denim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: CMConstants.color.red + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CMConstants.color.red,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CMConstants.color.red,
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: CMConstants.color.red,
    letterSpacing: 0.5,
  },
  timeframeDropdown: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: CMConstants.space.smallEx,
    paddingVertical: CMConstants.space.smallEx - 2,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1.5,
    borderColor: CMConstants.color.green,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 100,
  },
  timeframeDropdownText: {
    // fontSize is now set dynamically in component
    fontWeight: '600' as const,
    color: CMConstants.color.green,
  },
  dropdownMenu: {
    borderRadius: CMConstants.radius.small,
    borderWidth: 1.5,
    borderColor: CMConstants.color.green,
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
  dropdownOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: CMConstants.space.smallEx - 4,
    paddingHorizontal: CMConstants.space.smallEx - 2,
    borderBottomWidth: 0.5,
    marginHorizontal: CMConstants.space.smallEx - 2,
    marginVertical: 1,
  },
  dropdownOptionSelected: {
  },
  dropdownOptionText: {
    // fontSize is now set dynamically in component
    fontWeight: '500' as const,
  },
  dropdownOptionTextSelected: {
    color: CMConstants.color.green,
    fontWeight: '600' as const,
  },
  leaguesListContainer: {
    paddingVertical: 0,
    paddingHorizontal: CMConstants.space.smallEx,
  },
  leagueIconContainer: {
    marginRight: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  leagueIconWrapper: {
    borderRadius: 100,
    padding: 0,
    // borderWidth: 2,
    // borderColor: 'transparent',
  },
  leagueIconWrapperSelected: {
    borderColor: CMConstants.color.green,
  },
  leagueIcon: {
    width: 80,
    height: 100,
  },
  leagueIconGame: {
    width: 112,
    height: 112,
  },
  viewAllButton: {
    paddingVertical: 4,
    paddingHorizontal: CMConstants.space.smallEx,
  },
  viewAllText: {
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  clearFilterButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: CMConstants.space.smallEx,
    paddingVertical: 4,
    borderRadius: CMConstants.radius.small,
  },
  clearFilterText: {
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
};

export default CMHomeScreen;

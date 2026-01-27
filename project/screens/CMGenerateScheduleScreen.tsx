import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SafeAreaView, View, Text, ScrollView, Switch, Dimensions, Alert, TextInput, Keyboard, TouchableOpacity, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMRipple from '../components/CMRipple';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import CMGlobal from '../CMGlobal';
import CMLoadingDialog from '../dialog/CMLoadingDialog';
import firestore from '@react-native-firebase/firestore';
import CMProfileImage from '../components/CMProfileImage';

interface Game {
  id: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  date: Date;
  time: string;
  location: string;
  week: number;
}

interface WeekSchedule {
  week: number;
  games: Game[];
}

const CMGenerateScheduleScreen = ({ navigation, route }: CMNavigationProps) => {
  const [loading, setLoading] = useState(false);
  const [league, setLeague] = useState<any>(route.params?.league || {});
  const [teams, setTeams] = useState<any[]>([]);
  const insets = useSafeAreaInsets();

  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;

  // Get screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const isSmallDevice = screenWidth < 375;
  const isLargeDevice = screenWidth > 414;
  const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;
  const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0;

  // Required fields
  const [seasonName, setSeasonName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gameDays, setGameDays] = useState<string[]>([]);
  const [showGameDaysPicker, setShowGameDaysPicker] = useState(false);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [showTimeSlotsPicker, setShowTimeSlotsPicker] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  
  const [showLocationsPicker, setShowLocationsPicker] = useState(false);
  const [roundType, setRoundType] = useState('Double Round Robin');
  const [showRoundPicker, setShowRoundPicker] = useState(false);

  // Season name UX
  const [seasonNameConfirmed, setSeasonNameConfirmed] = useState(false);
  const seasonNameInputRef = useRef<TextInput | null>(null);

  // Additional settings
  const [homeAwayBalance, setHomeAwayBalance] = useState('Balanced');
  const [enablePlayoffs, setEnablePlayoffs] = useState(true);

  // Generated schedule
  const [schedule, setSchedule] = useState<WeekSchedule[]>([]);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTimeSlot, setTempTimeSlot] = useState(new Date());
  const [editGameModalVisible, setEditGameModalVisible] = useState(false);
  const [editingGame, setEditingGame] = useState<{ game: Game; week: number } | null>(null);
  const [editGameLocation, setEditGameLocation] = useState('');
  const [editGameDay, setEditGameDay] = useState('');
  const [editGameTimeSlot, setEditGameTimeSlot] = useState('');
  const [editTeamAId, setEditTeamAId] = useState<string | null>(null);
  const [editTeamBId, setEditTeamBId] = useState<string | null>(null);
  const [showEditTeamPicker, setShowEditTeamPicker] = useState<'A' | 'B' | null>(null);
  const [showEditGameDayPicker, setShowEditGameDayPicker] = useState(false);
  const [showEditGameTimeSlotPicker, setShowEditGameTimeSlotPicker] = useState(false);
  const [showEditGameLocationPicker, setShowEditGameLocationPicker] = useState(false);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const roundTypes = ['Single Round Robin', 'Double Round Robin', 'Triple Round Robin'];

  // Listen for theme changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
    });
    return unsubscribe;
  }, [navigation]);

  // Load league and teams
  useEffect(() => {
    if (league?.id) {
      CMFirebaseHelper.getLeague(league.id, (response: { [name: string]: any }) => {
        if (response.isSuccess && response.value) {
          setLeague({ ...league, ...response.value });
          // Load teams
          if (response.value.teamsId && response.value.teamsId.length > 0) {
            CMFirebaseHelper.getTeams(response.value.teamsId, (teamsResponse: { [name: string]: any }) => {
              if (teamsResponse.isSuccess) {
                setTeams(teamsResponse.value || []);
              }
            });
          }
        }
      });
    } else if (route.params?.league) {
      setLeague(route.params.league);
      if (route.params.league.teamsId && route.params.league.teamsId.length > 0) {
        CMFirebaseHelper.getTeams(route.params.league.teamsId, (teamsResponse: { [name: string]: any }) => {
          if (teamsResponse.isSuccess) {
            setTeams(teamsResponse.value || []);
          }
        });
      }
    }
  }, [route.params?.league?.id]);

  // Load season data if provided (from Reset Season) - runs after league is loaded
  useEffect(() => {
    const loadSeasonData = async () => {
      let seasonData = route.params?.seasonData;
      
      // If no season data provided but we have league and season name, load it
      if (!seasonData && route.params?.isResetSeason && league?.id && route.params?.currentSeasonName) {
        try {
          // First try with current season name
          let response = await new Promise<{ isSuccess: boolean; value: any }>((resolve) => {
            CMFirebaseHelper.getSeasonSettings(league.id, route.params.currentSeasonName, resolve);
          });
          
          // If not found, try to find the actual season name from matches
          if (!response.isSuccess || !response.value) {
            const firestore = require('@react-native-firebase/firestore').default;
            const snapshot = await firestore()
              .collection('matches')
              .where('leagueId', '==', league.id)
              .get();
            
            // Find the most common season name in matches
            const seasonNameCounts = new Map<string, number>();
            snapshot.forEach((doc: any) => {
              const data = doc.data();
              const matchSeasonName = (data.seasonName || '').trim();
              if (matchSeasonName) {
                seasonNameCounts.set(matchSeasonName, (seasonNameCounts.get(matchSeasonName) || 0) + 1);
              }
            });
            
            if (seasonNameCounts.size > 0) {
              const mostCommonSeasonName = Array.from(seasonNameCounts.entries())
                .sort((a, b) => b[1] - a[1])[0][0];
              
              response = await new Promise<{ isSuccess: boolean; value: any }>((resolve) => {
                CMFirebaseHelper.getSeasonSettings(league.id, mostCommonSeasonName, resolve);
              });
            }
          }
          
          if (response.isSuccess && response.value) {
            seasonData = response.value;
          } else {
            // If season settings not found, try to extract from existing matches
            try {
              const firestore = require('@react-native-firebase/firestore').default;
              const snapshot = await firestore()
                .collection('matches')
                .where('leagueId', '==', league.id)
                .get();
              
              if (snapshot.size > 0) {
                // Extract unique values from matches
                const gameDaysSet = new Set<string>();
                const timeSlotsSet = new Set<string>();
                const locationsSet = new Set<string>();
                let earliestDate: Date | null = null as Date | null;
                
                snapshot.forEach((doc: any) => {
                  const data = doc.data();
                  const matchSeasonName = (data.seasonName || '').trim();
                  const currentSeasonName = (route.params.currentSeasonName || '').trim();
                  
                  // Only process matches from this season
                  if (matchSeasonName.toLowerCase() === currentSeasonName.toLowerCase()) {
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
                
                if (gameDaysSet.size > 0 || timeSlotsSet.size > 0 || locationsSet.size > 0 || earliestDate !== null) {
                  const extractedData: any = {
                    gameDays: Array.from(gameDaysSet).sort(),
                    timeSlots: Array.from(timeSlotsSet).sort(),
                    locations: Array.from(locationsSet).sort(),
                  };
                  if (earliestDate) {
                    const dateValue = earliestDate as Date;
                    extractedData.startDate = { seconds: Math.floor(dateValue.getTime() / 1000) };
                  }
                  seasonData = extractedData;
                }
              }
            } catch (extractError) {
              // Silently handle extraction errors
            }
          }
        } catch (error) {
          // Silently handle loading errors
        }
      }
      
      if (seasonData) {
        // Pre-fill form with season data
        if (route.params.currentSeasonName) {
          setSeasonName(route.params.currentSeasonName);
          setSeasonNameConfirmed(true);
        }
      if (seasonData.startDate) {
        // Handle different Timestamp formats
        let startDateValue: Date;
        if (seasonData.startDate.toDate && typeof seasonData.startDate.toDate === 'function') {
          // Firestore Timestamp object with toDate method
          startDateValue = seasonData.startDate.toDate();
        } else if (seasonData.startDate.seconds !== undefined) {
          // Plain object with seconds property
          startDateValue = new Date(seasonData.startDate.seconds * 1000);
        } else if (seasonData.startDate instanceof Date) {
          // Already a Date object
          startDateValue = seasonData.startDate;
        } else {
          // Fallback to current date
          startDateValue = new Date();
        }
        setStartDate(startDateValue);
      }
      // Load arrays - check if they exist and are arrays (even if empty, set them)
      if (seasonData.gameDays !== undefined) {
        if (Array.isArray(seasonData.gameDays)) {
          setGameDays(seasonData.gameDays);
        } else {
          setGameDays([]);
        }
      }
      if (seasonData.timeSlots !== undefined) {
        if (Array.isArray(seasonData.timeSlots)) {
          setTimeSlots(seasonData.timeSlots);
        } else {
          setTimeSlots([]);
        }
      }
      if (seasonData.locations !== undefined) {
        if (Array.isArray(seasonData.locations)) {
          setLocations(seasonData.locations);
        } else {
          setLocations([]);
        }
      }
      if (seasonData.roundType) {
        setRoundType(seasonData.roundType);
      }
      if (seasonData.homeAwayBalance) {
        setHomeAwayBalance(seasonData.homeAwayBalance);
      }
      if (seasonData.enablePlayoffs !== undefined) {
        setEnablePlayoffs(seasonData.enablePlayoffs);
      }
      }
    };
    
    loadSeasonData();
  }, [route.params?.seasonData, route.params?.currentSeasonName, route.params?.isResetSeason, league?.id]);

  // Load existing matches/schedule if resetting season
  useEffect(() => {
    const loadExistingSchedule = async () => {
      if (route.params?.isResetSeason && league?.id && route.params?.currentSeasonName) {
        // Wait for teams to load if not available yet
        if (teams.length === 0) {
          return;
        }
        try {
          setLoading(true);
          // Query all matches for the league (like Season Schedule does), then filter by seasonName in JavaScript
          // This avoids index requirements and handles edge cases better
          const snapshot = await firestore()
            .collection('matches')
            .where('leagueId', '==', league.id)
            .get();

          const matches: Game[] = [];
          const teamMap = new Map<string, any>();
          teams.forEach(team => {
            teamMap.set(team.id, team);
          });

          // First, try to find matches using the current season name
          let currentSeasonName = (route.params.currentSeasonName || '').trim();
          
          // Count season names in matches to find the actual season name used
          const seasonNameCounts = new Map<string, number>();
          snapshot.forEach(doc => {
            const data = doc.data() as any;
            const matchSeasonName = (data.seasonName || '').trim();
            if (matchSeasonName) {
              seasonNameCounts.set(matchSeasonName, (seasonNameCounts.get(matchSeasonName) || 0) + 1);
            }
          });

          // If no matches found with current season name, use the most common season name in matches
          if (seasonNameCounts.size > 0) {
            const mostCommonSeasonName = Array.from(seasonNameCounts.entries())
              .sort((a, b) => b[1] - a[1])[0][0];
            
            // Check if current season name matches any existing season name (case-insensitive)
            const currentSeasonNameLower = currentSeasonName.toLowerCase();
            const hasMatchingSeasonName = Array.from(seasonNameCounts.keys()).some(
              name => name.toLowerCase() === currentSeasonNameLower
            );

            if (!hasMatchingSeasonName) {
              // Current season name doesn't match any matches, use the most common one
              currentSeasonName = mostCommonSeasonName;
            }
          }

          snapshot.forEach(doc => {
            const data = doc.data() as any;
            
            // Filter by seasonName in JavaScript (more flexible than Firestore query)
            // Use case-insensitive comparison and trim whitespace to handle edge cases
            const matchSeasonName = (data.seasonName || '').trim();
            if (!matchSeasonName || matchSeasonName.toLowerCase() !== currentSeasonName.toLowerCase()) {
              return; // Skip matches that don't match the season
            }

            const matchDate = data.dateTime?.toDate?.() || (data.dateTime?.seconds ? new Date(data.dateTime.seconds * 1000) : new Date());
            
            // Format time from date
            const hours = matchDate.getHours();
            const minutes = matchDate.getMinutes();
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
            const timeString = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;

            const teamA = teamMap.get(data.teamAId);
            const teamB = teamMap.get(data.teamBId);

            if (teamA && teamB) {
              matches.push({
                id: data.id || doc.id,
                teamAId: data.teamAId,
                teamBId: data.teamBId,
                teamAName: teamA.name || 'Team A',
                teamBName: teamB.name || 'Team B',
                date: matchDate,
                time: timeString,
                location: data.location || '',
                week: data.week || 1,
              });
            }
          });

          // Sort matches by dateTime in JavaScript (since we can't use orderBy with composite query)
          matches.sort((a, b) => a.date.getTime() - b.date.getTime());

          // Group by week
          const weekMap = new Map<number, Game[]>();
          matches.forEach(game => {
            if (!weekMap.has(game.week)) {
              weekMap.set(game.week, []);
            }
            weekMap.get(game.week)!.push(game);
          });

          const weekSchedules: WeekSchedule[] = Array.from(weekMap.entries())
            .map(([week, games]) => ({ week, games }))
            .sort((a, b) => a.week - b.week);

          setSchedule(weekSchedules);
          setLoading(false);
        } catch (error) {
          // Show user-friendly error
          CMAlertDlgHelper.showAlertWithOK(
            'Unable to load existing schedule. The matches still exist in the database, but there was an error loading them. Please try again or check your network connection.'
          );
          setLoading(false);
        }
      }
    };

    loadExistingSchedule();
  }, [route.params?.isResetSeason, route.params?.currentSeasonName, league?.id, teams.length]);


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
    const isResetSeason = route.params?.isResetSeason || false;
    navigation.setOptions({
      title: isResetSeason ? 'Reset Season Schedule' : 'Generate New Season Schedule',
      headerStyle: {
        backgroundColor: headerBackgroundColor,
      },
      headerTintColor: headerTextColor,
      headerTitleStyle: {
        color: headerTextColor,
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold' as const,
      },
      headerRight: () => (
        <CMRipple
          containerStyle={{
            ...CMCommonStyles.circle(CMConstants.height.iconBig),
            marginRight: CMConstants.space.normal,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="close"
            size={CMConstants.height.iconBig}
            color={headerTextColor}
          />
        </CMRipple>
      ),
      headerTitleContainerStyle: {
        paddingRight: 0,
        marginRight: 0,
        marginLeft: -CMConstants.space.smallEx,
      },
    });
  }, [route.params?.isResetSeason, navigation, headerBackgroundColor, headerTextColor]);

  const toggleGameDay = (day: string) => {
    setGameDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${period}`;
  };

  const addTimeSlot = () => {
    const formattedTime = formatTime(tempTimeSlot);
    if (!timeSlots.includes(formattedTime)) {
      setTimeSlots([...timeSlots, formattedTime]);
      setShowTimePicker(false);
    }
  };

  const removeTimeSlot = (time: string) => {
    setTimeSlots(prev => prev.filter(t => t !== time));
  };

  const addLocation = () => {
    if (newLocationInput.trim() && !locations.includes(newLocationInput.trim())) {
      setLocations([...locations, newLocationInput.trim()]);
      setNewLocationInput('');
      Keyboard.dismiss();
    }
  };

  const removeLocation = (location: string) => {
    setLocations(prev => prev.filter(l => l !== location));
  };

  // Round Robin schedule generation algorithm with balanced distribution
  const generateRoundRobinSchedule = useCallback((teamIds: string[], rounds: number): Game[] => {
    const games: Game[] = [];
    const numTeams = teamIds.length;
    
    if (numTeams < 2) return games;

    // Generate all matchups
    const matchups: { teamA: string; teamB: string }[] = [];
    for (let round = 0; round < rounds; round++) {
      for (let i = 0; i < numTeams; i++) {
        for (let j = i + 1; j < numTeams; j++) {
          if (round % 2 === 0) {
            matchups.push({ teamA: teamIds[i], teamB: teamIds[j] });
          } else {
            matchups.push({ teamA: teamIds[j], teamB: teamIds[i] });
          }
        }
      }
    }

    // Use selected time slots
    if (timeSlots.length === 0) return games;

    // Calculate total available game slots per week
    const slotsPerWeek = gameDays.length * timeSlots.length;
    
    // Calculate how many weeks we need
    const totalGames = matchups.length;
    const totalWeeks = Math.ceil(totalGames / slotsPerWeek);
    
    // Track team games per week to ensure balance
    const teamGamesPerWeek: Map<number, Map<string, number>> = new Map();
    const teamGamesPerDay: Map<number, Map<string, Map<string, number>>> = new Map(); // week -> teamId -> Map of dayName -> count
    
    // Initialize tracking maps
    for (let week = 1; week <= totalWeeks; week++) {
      teamGamesPerWeek.set(week, new Map());
      teamGamesPerDay.set(week, new Map());
      teamIds.forEach(teamId => {
        teamGamesPerWeek.get(week)!.set(teamId, 0);
        teamGamesPerDay.get(week)!.set(teamId, new Map());
        gameDays.forEach(dayName => {
          teamGamesPerDay.get(week)!.get(teamId)!.set(dayName, 0);
        });
      });
    }

    // Calculate target games per team per week
    const targetGamesPerTeamPerWeek = totalGames / (numTeams * totalWeeks);
    const maxGamesPerTeamPerWeek = Math.ceil(targetGamesPerTeamPerWeek);

    // Shuffle matchups for better distribution
    const shuffledMatchups = [...matchups].sort(() => Math.random() - 0.5);

    // Track time slot usage to ensure all time slots are used
    const timeSlotUsage: Map<number, Map<number, number>> = new Map(); // week -> timeIndex -> count
    
    // Initialize time slot usage tracking
    for (let week = 1; week <= totalWeeks; week++) {
      timeSlotUsage.set(week, new Map());
      for (let timeIndex = 0; timeIndex < timeSlots.length; timeIndex++) {
        timeSlotUsage.get(week)!.set(timeIndex, 0);
      }
    }

    // Assign each matchup to a week, day, and time slot
    shuffledMatchups.forEach((matchup, matchupIndex) => {
      let assigned = false;
      let bestWeek = 1;
      let bestDayIndex = 0;
      let bestTimeIndex = 0;
      let bestScore = Infinity;

      // Try to find the best slot for this matchup
      for (let week = 1; week <= totalWeeks; week++) {
        const weekTeamGames = teamGamesPerWeek.get(week)!;
        const weekTeamDays = teamGamesPerDay.get(week)!;
        const weekTimeSlotUsage = timeSlotUsage.get(week)!;
        
        const teamAGames = weekTeamGames.get(matchup.teamA) || 0;
        const teamBGames = weekTeamGames.get(matchup.teamB) || 0;
        
        // Skip if either team already has too many games this week
        if (teamAGames >= maxGamesPerTeamPerWeek || teamBGames >= maxGamesPerTeamPerWeek) {
          continue;
        }

        // Try each day and time slot
        for (let dayIndex = 0; dayIndex < gameDays.length; dayIndex++) {
          const teamADays = weekTeamDays.get(matchup.teamA) || new Map();
          const teamBDays = weekTeamDays.get(matchup.teamB) || new Map();
          const dayName = gameDays[dayIndex];
          
          // Allow up to 3 games per day per team
          const teamADayCount = teamADays.get(dayName) || 0;
          const teamBDayCount = teamBDays.get(dayName) || 0;
          if (teamADayCount >= 3 || teamBDayCount >= 3) {
            continue;
          }

          for (let timeIndex = 0; timeIndex < timeSlots.length; timeIndex++) {
            // Check if this slot is already taken
            const isSlotTaken = games.some(g => {
              const gWeek = g.week;
              const gDayName = daysOfWeek[g.date.getDay()];
              const gDayIndex = gameDays.indexOf(gDayName);
              const gTimeIndex = timeSlots.indexOf(g.time);
              return gWeek === week && gDayIndex === dayIndex && gTimeIndex === timeIndex;
            });

            if (isSlotTaken) continue;

            // Calculate score (lower is better)
            // Prefer: weeks where teams have fewer games, time slots that are used less
            const timeSlotCount = weekTimeSlotUsage.get(timeIndex) || 0;
            const score = (teamAGames + teamBGames) * 10 + timeSlotCount;
            
            if (score < bestScore) {
              bestScore = score;
              bestWeek = week;
              bestDayIndex = dayIndex;
              bestTimeIndex = timeIndex;
              assigned = true;
            }
          }
        }
      }

      // If we found a slot, assign the game
      if (assigned) {
        const weekTeamGames = teamGamesPerWeek.get(bestWeek)!;
        const weekTeamDays = teamGamesPerDay.get(bestWeek)!;
        const weekTimeSlotUsage = timeSlotUsage.get(bestWeek)!;
        
        // Update tracking
        weekTeamGames.set(matchup.teamA, (weekTeamGames.get(matchup.teamA) || 0) + 1);
        weekTeamGames.set(matchup.teamB, (weekTeamGames.get(matchup.teamB) || 0) + 1);
        
        // Update time slot usage
        weekTimeSlotUsage.set(bestTimeIndex, (weekTimeSlotUsage.get(bestTimeIndex) || 0) + 1);
        
        const dayName = gameDays[bestDayIndex];
        if (!weekTeamDays.get(matchup.teamA)) weekTeamDays.set(matchup.teamA, new Map());
        if (!weekTeamDays.get(matchup.teamB)) weekTeamDays.set(matchup.teamB, new Map());
        const teamADayCount = weekTeamDays.get(matchup.teamA)!.get(dayName) || 0;
        const teamBDayCount = weekTeamDays.get(matchup.teamB)!.get(dayName) || 0;
        weekTeamDays.get(matchup.teamA)!.set(dayName, teamADayCount + 1);
        weekTeamDays.get(matchup.teamB)!.set(dayName, teamBDayCount + 1);

        // Calculate the actual date - find the first occurrence of the selected day in the target week
        let gameDate = new Date(startDate);
        const weeksToAdd = bestWeek - 1;
        
        // Start from the beginning of the target week (same day of week as start date)
        gameDate.setDate(gameDate.getDate() + (weeksToAdd * 7));
        
        // Find the correct day of week within that week
        // Get the day index of the start date (0 = Sunday, 1 = Monday, etc.)
        const startDayIndex = startDate.getDay();
        const targetDayIndex = daysOfWeek.indexOf(dayName);
        
        // Calculate days to add to reach the target day within the week
        let daysToAdd = targetDayIndex - startDayIndex;
        if (daysToAdd < 0) {
          daysToAdd += 7; // Move to next week if the target day is before the start day
        }
        
        gameDate.setDate(gameDate.getDate() + daysToAdd);
        
        // Verify the date is correct (should match the selected game day)
        const finalDayName = daysOfWeek[gameDate.getDay()];
        if (finalDayName !== dayName) {
          // If it doesn't match, find the next occurrence
          while (daysOfWeek[gameDate.getDay()] !== dayName) {
            gameDate.setDate(gameDate.getDate() + 1);
          }
        }

        const selectedTime = timeSlots[bestTimeIndex];
        const selectedLocation = locations[matchupIndex % locations.length];

        const teamA = teams.find(t => t.id === matchup.teamA);
        const teamB = teams.find(t => t.id === matchup.teamB);

        if (teamA && teamB) {
          games.push({
            id: `game-${matchupIndex}`,
            teamAId: matchup.teamA,
            teamBId: matchup.teamB,
            teamAName: teamA.name || 'Team A',
            teamBName: teamB.name || 'Team B',
            date: new Date(gameDate),
            time: selectedTime,
            location: selectedLocation,
            week: bestWeek,
          });
        }
      } else {
        // Fallback: assign to first available slot if no perfect match found
        // This ensures all games are scheduled
        for (let week = 1; week <= totalWeeks; week++) {
          for (let dayIndex = 0; dayIndex < gameDays.length; dayIndex++) {
            for (let timeIndex = 0; timeIndex < timeSlots.length; timeIndex++) {
              const isSlotTaken = games.some(g => {
                const gWeek = g.week;
                const gDayName = daysOfWeek[g.date.getDay()];
                const gDayIndex = gameDays.indexOf(gDayName);
                const gTimeIndex = timeSlots.indexOf(g.time);
                return gWeek === week && gDayIndex === dayIndex && gTimeIndex === timeIndex;
              });

              if (!isSlotTaken) {
                const dayName = gameDays[dayIndex];
                let gameDate = new Date(startDate);
                const weeksToAdd = week - 1;
                gameDate.setDate(gameDate.getDate() + (weeksToAdd * 7));
                const startDayIndex = startDate.getDay();
                const targetDayIndex = daysOfWeek.indexOf(dayName);
                let daysToAdd = targetDayIndex - startDayIndex;
                if (daysToAdd < 0) daysToAdd += 7;
                gameDate.setDate(gameDate.getDate() + daysToAdd);

                const selectedTime = timeSlots[timeIndex];
                const selectedLocation = locations[matchupIndex % locations.length];

                const teamA = teams.find(t => t.id === matchup.teamA);
                const teamB = teams.find(t => t.id === matchup.teamB);

                if (teamA && teamB) {
                  games.push({
                    id: `game-${matchupIndex}`,
                    teamAId: matchup.teamA,
                    teamBId: matchup.teamB,
                    teamAName: teamA.name || 'Team A',
                    teamBName: teamB.name || 'Team B',
                    date: new Date(gameDate),
                    time: selectedTime,
                    location: selectedLocation,
                    week: week,
                  });
                  assigned = true;
                  break;
                }
              }
              if (assigned) break;
            }
            if (assigned) break;
          }
          if (assigned) break;
        }
      }
    });

    // Sort games by week, then by date and time
    games.sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      if (a.date.getTime() !== b.date.getTime()) return a.date.getTime() - b.date.getTime();
      return a.time.localeCompare(b.time);
    });

    return games;
  }, [startDate, gameDays, timeSlots, locations, teams]);

  const handleGenerateSchedule = useCallback(() => {
    // Validate all required fields
    if (!seasonName || !seasonName.trim()) {
      CMAlertDlgHelper.showAlertWithOK('Please enter a season name.');
      return;
    }
    if (!startDate) {
      CMAlertDlgHelper.showAlertWithOK('Please select a start date.');
      return;
    }
    if (gameDays.length === 0) {
      CMAlertDlgHelper.showAlertWithOK('Please select at least one game day.');
      return;
    }
    if (timeSlots.length === 0) {
      CMAlertDlgHelper.showAlertWithOK('Please select at least one time slot.');
      return;
    }
    if (locations.length === 0) {
      CMAlertDlgHelper.showAlertWithOK('Please add at least one location.');
      return;
    }
    if (roundType === '') {
      CMAlertDlgHelper.showAlertWithOK('Please select a round type.');
      return;
    }
    if (teams.length < 2) {
      CMAlertDlgHelper.showAlertWithOK('You need at least 2 teams to generate a schedule.');
      return;
    }

    const teamIds = teams.map(t => t.id);
    const rounds = roundType.includes('Double') ? 2 : roundType.includes('Triple') ? 3 : 1;
    
    const games = generateRoundRobinSchedule(teamIds, rounds);

    // Group games by week
    const weekMap = new Map<number, Game[]>();
    games.forEach(game => {
      if (!weekMap.has(game.week)) {
        weekMap.set(game.week, []);
      }
      weekMap.get(game.week)!.push(game);
    });

    const weekSchedules: WeekSchedule[] = Array.from(weekMap.entries())
      .map(([week, games]) => ({ week, games }))
      .sort((a, b) => a.week - b.week);

    setSchedule(weekSchedules);
  }, [startDate, gameDays, timeSlots, roundType, teams, generateRoundRobinSchedule]);

  const handleGenerate = () => {
    handleGenerateSchedule();
  };

  const handlePublishSchedule = async () => {
    if (schedule.length === 0) {
      CMAlertDlgHelper.showAlertWithOK('Please generate a schedule first.');
      return;
    }

    if (!seasonName || !seasonName.trim()) {
      CMAlertDlgHelper.showAlertWithOK('Please enter a season name.');
      return;
    }

    if (league?.id) {
      setLoading(true);

      try {
        const isResetSeason = !!route.params?.isResetSeason;
        const normalizedSeasonName = seasonName.trim().toLowerCase();

        // If we are resetting an existing season, remove old matches for this league+season first
        if (isResetSeason) {
          await new Promise<void>((resolve) => {
            CMFirebaseHelper.getMatches(league.id, async (response: { [name: string]: any }) => {
              if (response.isSuccess && Array.isArray(response.value)) {
                const matchesForSeason = (response.value as any[]).filter(m => {
                  const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
                  return matchSeasonName === normalizedSeasonName;
                });

                if (matchesForSeason.length > 0) {
                  await Promise.all(
                    matchesForSeason.map(m => new Promise<void>((deleteResolve) => {
                      if (!m.id) {
                        deleteResolve();
                        return;
                      }
                      CMFirebaseHelper.deleteMatch(m.id, () => {
                        deleteResolve();
                      });
                    })),
                  );
                }
              }
              resolve();
            });
          });
        }

        // Create matches from current schedule
        const allGames = schedule.flatMap(week => week.games);
        const matchPromises = allGames.map((game) => {
          const matchDate = new Date(game.date);
          const [time, period] = game.time.split(' ');
          const [hours, minutes] = time.split(':');
          let hour = parseInt(hours, 10);
          if (period === 'PM' && hour !== 12) hour += 12;
          if (period === 'AM' && hour === 12) hour = 0;
          matchDate.setHours(hour, parseInt(minutes, 10), 0, 0);

          const match = {
            id: CMFirebaseHelper.getNewDocumentId('matches'),
            leagueId: league.id,
            teamAId: game.teamAId,
            teamBId: game.teamBId,
            name: `${game.teamAName} vs ${game.teamBName}`,
            dateTime: firestore.Timestamp.fromDate(matchDate),
            location: game.location,
            status: CMConstants.gameStatus.notStarted,
            teamAScore: 0,
            teamBScore: 0,
            week: game.week,
            seasonName: seasonName.trim(),
          };

          return new Promise((resolve) => {
            CMFirebaseHelper.setMatch(match.id, match, (response: { [name: string]: any }) => {
              resolve(response);
            });
          });
        });

        await Promise.all(matchPromises);

        // Save season settings to seasons collection
        const seasonSettings = {
          startDate: firestore.Timestamp.fromDate(startDate),
          gameDays,
          timeSlots,
          locations,
          roundType,
          homeAwayBalance,
          enablePlayoffs,
        };
        
        await new Promise<void>((resolve) => {
          CMFirebaseHelper.setSeasonSettings(league.id, seasonName.trim(), seasonSettings, () => {
            resolve();
          });
        });

        // Update league with current season name and reset season phase flags
        await new Promise<void>((resolve) => {
          CMFirebaseHelper.updateLeague(
            league.id,
            {
              seasonName: seasonName.trim(),
              regularSeasonEnded: false,
              playoffsStarted: false,
            },
            () => {
              resolve();
            },
          );
        });

        setLoading(false);
        CMAlertDlgHelper.showAlertWithOK(
          route.params?.isResetSeason
            ? 'Season schedule updated successfully!'
            : 'Season and schedule created successfully!',
          () => {
            // Navigate back to settings page
            navigation.navigate(CMConstants.screenName.leagueSettings, {
              league: league,
            });
          },
        );
      } catch (e) {
        setLoading(false);
        CMAlertDlgHelper.showAlertWithOK('Failed to save season schedule. Please try again.');
      }
    }
  };

  const handleEditGame = (game: Game, week: number) => {
    setEditingGame({ game, week });

    // Initialize edit state from existing game values and global settings
    const currentDayName = daysOfWeek[game.date.getDay()];
    const initialDay = gameDays.includes(currentDayName)
      ? currentDayName
      : (gameDays[0] || currentDayName);
    const initialTimeSlot = timeSlots.includes(game.time)
      ? game.time
      : (timeSlots[0] || game.time);
    const initialLocation = locations.includes(game.location)
      ? game.location
      : (locations[0] || game.location);

    setEditGameDay(initialDay);
    setEditGameTimeSlot(initialTimeSlot);
    setEditGameLocation(initialLocation);
    setEditTeamAId(game.teamAId);
    setEditTeamBId(game.teamBId);

    setEditGameModalVisible(true);
  };

  const handleSaveEditedGame = () => {
    if (!editingGame) {
      setEditGameModalVisible(false);
      setEditingGame(null);
      return;
    }

    const { game, week } = editingGame;

    // Resolve teams
    const teamAId = editTeamAId || game.teamAId;
    const teamBId = editTeamBId || game.teamBId;

    if (teamAId === teamBId) {
      CMAlertDlgHelper.showAlertWithOK('Please select two different teams.');
      return;
    }

    const teamA = teams.find(t => t.id === teamAId);
    const teamB = teams.find(t => t.id === teamBId);

    const newTeamAName = teamA?.name || game.teamAName;
    const newTeamBName = teamB?.name || game.teamBName;

    // Resolve day, time slot and location
    const resolvedDay = editGameDay || daysOfWeek[game.date.getDay()] || (gameDays[0] || daysOfWeek[startDate.getDay()]);
    const resolvedTimeSlot = editGameTimeSlot || game.time || (timeSlots[0] || formatTime(game.date));
    const resolvedLocation = editGameLocation || game.location || (locations[0] || 'Location');

    // Compute new date/time based on startDate, week and day/time slot
    const newDate = computeGameDateTime(week, resolvedDay, resolvedTimeSlot);

    const updatedSchedule = schedule.map(weekSchedule => {
      if (weekSchedule.week !== week) return weekSchedule;
      return {
        ...weekSchedule,
        games: weekSchedule.games.map(g =>
          g.id === game.id
            ? {
                ...g,
                teamAId,
                teamBId,
                teamAName: newTeamAName,
                teamBName: newTeamBName,
                date: newDate,
                time: resolvedTimeSlot,
                location: resolvedLocation,
              }
            : g,
        ),
      };
    });

    setSchedule(updatedSchedule);
    setEditGameModalVisible(false);
    setEditingGame(null);
  };

  const handleCancelEditGame = () => {
    setEditGameModalVisible(false);
    setEditingGame(null);
    setShowEditTeamPicker(null);
    setShowEditGameDayPicker(false);
    setShowEditGameTimeSlotPicker(false);
    setShowEditGameLocationPicker(false);
  };

  const handleDeleteGame = (game: Game, week: number) => {
    Alert.alert(
      'Delete Game',
      `Are you sure you want to delete ${game.teamAName} vs ${game.teamBName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSchedule(prev => prev.map(weekSchedule => {
              if (weekSchedule.week === week) {
                return {
                  ...weekSchedule,
                  games: weekSchedule.games.filter(g => g.id !== game.id),
                };
              }
              return weekSchedule;
            }).filter(weekSchedule => weekSchedule.games.length > 0));
          },
        },
      ],
    );
  };

  const getDayOfWeek = (date: Date): string => {
    return daysOfWeek[date.getDay()];
  };

  const getTeamLogo = (teamId: string): string => {
    const team = teams.find(t => t.id === teamId);
    return team?.avatar || '';
  };

  const renderSettingRow = (
    label: string,
    value: string | React.ReactNode,
    onPress?: () => void,
    icon?: string,
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
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
        {icon && (
          <Ionicons
            name={icon}
            size={20 * iconScale}
            color={CMConstants.color.green}
            style={{ marginRight: CMConstants.space.smallEx }}
          />
        )}
        <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
        {typeof value === 'string' ? (
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
        {onPress && (
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const computeGameDateTime = (week: number, dayName: string, timeString: string): Date => {
    // Start from league start date and week number
    let gameDate = new Date(startDate);
    const weeksToAdd = week - 1;
    gameDate.setDate(gameDate.getDate() + weeksToAdd * 7);

    // Align to correct day of week within that week
    const startDayIndex = startDate.getDay();
    const targetDayIndex = daysOfWeek.indexOf(dayName);
    let daysToAdd = targetDayIndex - startDayIndex;
    if (daysToAdd < 0) daysToAdd += 7;
    gameDate.setDate(gameDate.getDate() + daysToAdd);

    // Apply time slot (e.g. "7:00 PM")
    const [timePart, period] = timeString.split(' ');
    const [hours, minutes] = timePart.split(':');
    let hour = parseInt(hours, 10);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    gameDate.setHours(hour, parseInt(minutes, 10), 0, 0);

    return gameDate;
  };

  const getEditingTeamName = (side: 'A' | 'B', game: Game): string => {
    if (side === 'A') {
      if (editTeamAId) {
        const t = teams.find(team => team.id === editTeamAId);
        if (t?.name) return t.name;
      }
      return game.teamAName || 'Team A';
    } else {
      if (editTeamBId) {
        const t = teams.find(team => team.id === editTeamBId);
        if (t?.name) return t.name;
      }
      return game.teamBName || 'Team B';
    }
  };

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      <CMLoadingDialog visible={loading} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: CMConstants.space.normal, paddingBottom: CMConstants.space.normal }}
        showsVerticalScrollIndicator={false}
      >
        {/* Schedule Generation Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
            Schedule Settings
          </Text>
          
          {/* Season Name */}
          <View
            style={[
              styles.settingRow,
              {
                backgroundColor: cardBackgroundColor,
                borderColor: cardBorderColor,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <Ionicons
                name="trophy-outline"
                size={20 * iconScale}
                color={CMConstants.color.green}
                style={{ marginRight: CMConstants.space.smallEx }}
              />
              <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
                Season Name
              </Text>
              <Text style={[styles.settingLabel, { color: CMConstants.color.red, fontSize: 14 * fontScale, marginLeft: 2 }]}>
                *
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
              <TextInput
                ref={seasonNameInputRef}
                style={[
                  styles.seasonNameInput,
                  {
                    color: seasonName ? textColor : labelColor,
                    fontSize: 14 * fontScale,
                    textAlign: 'right',
                  },
                ]}
                value={seasonName}
                editable={!seasonNameConfirmed}
                onChangeText={(text) => {
                  setSeasonName(text);
                  setSeasonNameConfirmed(false);
                }}
                placeholder="Enter season name"
                placeholderTextColor={placeholderColor}
              />
              <CMRipple
                containerStyle={styles.seasonNameCheckButton}
                disabled={!seasonName || !seasonName.trim()}
                onPress={() => {
                  if (!seasonName || !seasonName.trim()) {
                    return;
                  }
                  if (seasonNameConfirmed) {
                    // Allow editing again
                    setSeasonNameConfirmed(false);
                    // Focus input for convenience
                    seasonNameInputRef.current?.focus();
                  } else {
                    // Confirm current name
                    setSeasonNameConfirmed(true);
                    Keyboard.dismiss();
                  }
                }}
              >
                <Ionicons
                  name={seasonNameConfirmed ? 'create-outline' : 'checkmark-outline'}
                  size={18 * iconScale}
                  color={seasonNameConfirmed ? labelColor : CMConstants.color.green}
                />
              </CMRipple>
            </View>
          </View>

          {/* Start Date */}
          {renderSettingRow(
            'Start Date *',
            formatDate(startDate),
            () => {
              setShowDatePicker(true);
            },
            'calendar-outline',
          )}

          {/* Game Days */}
          {renderSettingRow(
            'Game Days *',
            gameDays.length > 0 ? gameDays.join(', ') : 'Select days',
            () => setShowGameDaysPicker(true),
            'game-controller-outline',
          )}

          {/* Time Slots */}
          {renderSettingRow(
            'Time Slots *',
            timeSlots.length > 0 ? timeSlots.join(', ') : 'Add time slots',
            () => setShowTimeSlotsPicker(true),
            'time-outline',
          )}

          {/* Locations */}
          {renderSettingRow(
            'Locations *',
            locations.length > 0 ? locations.join(', ') : 'Add locations',
            () => setShowLocationsPicker(true),
            'location-outline',
          )}

          {/* Rounds */}
          {renderSettingRow(
            'Rounds',
            roundType,
            () => setShowRoundPicker(true),
            'refresh-outline',
          )}
        </View>

        {/* Additional Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
            Additional Settings
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
              Home/Away
            </Text>
            <Text style={[styles.settingValue, { color: labelColor, fontSize: 14 * fontScale }]}>
              {homeAwayBalance}
            </Text>
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
              Enable Playoffs
            </Text>
            <Switch
              value={enablePlayoffs}
              onValueChange={setEnablePlayoffs}
              trackColor={{ false: cardBorderColor, true: CMConstants.color.green }}
              thumbColor={CMConstants.color.white}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', gap: CMConstants.space.smallEx }}>
            <CMRipple
              containerStyle={[
                styles.actionButton,
                {
                  backgroundColor: CMConstants.color.green,
                  flex: 1,
                  opacity: (seasonName && seasonName.trim() && startDate && gameDays.length > 0 && timeSlots.length > 0 && locations.length > 0 && roundType !== '') ? 1 : 0.5,
                },
              ]}
              onPress={handleGenerate}
              disabled={!seasonName || !seasonName.trim() || !startDate || gameDays.length === 0 || timeSlots.length === 0 || locations.length === 0 || roundType === ''}
            >
              {schedule.length > 0 ? (
                <>
                  <Ionicons name="refresh" size={18 * iconScale} color={CMConstants.color.white} style={{ marginRight: CMConstants.space.smallEx - 4 }} />
                  <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>Regenerate</Text>
                </>
              ) : (
                <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>Generate</Text>
              )}
            </CMRipple>
            <CMRipple
              containerStyle={[
                styles.actionButton,
                {
                  backgroundColor: CMConstants.color.green,
                  flex: 1,
                  opacity: schedule.length > 0 ? 1 : 0.5,
                },
              ]}
              onPress={handlePublishSchedule}
              disabled={schedule.length === 0}
            >
              <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>
                {route.params?.isResetSeason ? 'Republish Schedule' : 'Publish Schedule'}
              </Text>
            </CMRipple>
          </View>
        </View>

        {/* Schedule Statistics */}
        {schedule.length > 0 && (() => {
          const allGames = schedule.flatMap(week => week.games);
          const totalGames = allGames.length;
          const totalWeeks = schedule.length;
          const avgGamesPerWeek = totalGames / totalWeeks;
          const gamesPerTeam = totalGames / teams.length;
          
          // Calculate date range
          const dates = allGames.map(g => g.date.getTime()).sort((a, b) => a - b);
          const startDateSchedule = new Date(dates[0]);
          const endDateSchedule = new Date(dates[dates.length - 1]);
          const durationDays = Math.ceil((endDateSchedule.getTime() - startDateSchedule.getTime()) / (1000 * 60 * 60 * 24));
          const durationWeeks = Math.ceil(durationDays / 7);
          
          // Calculate games per week distribution
          const gamesPerWeek = schedule.map(week => week.games.length);
          const minGamesPerWeek = Math.min(...gamesPerWeek);
          const maxGamesPerWeek = Math.max(...gamesPerWeek);
          
          // Calculate unique locations and time slots used
          const uniqueLocations = new Set(allGames.map(g => g.location));
          const uniqueTimeSlots = new Set(allGames.map(g => g.time));
          
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
                Schedule Statistics
              </Text>
              
              <View style={[styles.statsContainer, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                {/* Row 1: Total Games & Total Weeks */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Total Games</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 18 * fontScale }]}>{totalGames}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Total Weeks</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 18 * fontScale }]}>{totalWeeks}</Text>
                  </View>
                </View>
                
                {/* Row 2: Avg Games/Week & Games/Team */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Avg Games/Week</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 18 * fontScale }]}>{avgGamesPerWeek.toFixed(1)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Games/Team</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 18 * fontScale }]}>{gamesPerTeam.toFixed(1)}</Text>
                  </View>
                </View>
                
                {/* Row 3: Games per Week Range */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Games/Week Range</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 18 * fontScale }]}>
                      {minGamesPerWeek === maxGamesPerWeek ? minGamesPerWeek : `${minGamesPerWeek}-${maxGamesPerWeek}`}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Duration</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 18 * fontScale }]}>{durationWeeks} weeks</Text>
                  </View>
                </View>
                
                {/* Row 4: Date Range */}
                <View style={[styles.statsRow, { borderTopWidth: 1, borderTopColor: cardBorderColor, paddingTop: CMConstants.space.smallEx, marginTop: CMConstants.space.smallEx }]}>
                  <View style={[styles.statItem, { flex: 1 }]}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Start Date</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 14 * fontScale }]}>
                      {startDateSchedule.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={[styles.statItem, { flex: 1 }]}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>End Date</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 14 * fontScale }]}>
                      {endDateSchedule.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
                
                {/* Row 5: Locations & Time Slots */}
                <View style={[styles.statsRow, { borderTopWidth: 1, borderTopColor: cardBorderColor, paddingTop: CMConstants.space.smallEx, marginTop: CMConstants.space.smallEx }]}>
                  <View style={[styles.statItem, { flex: 1 }]}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Locations Used</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 14 * fontScale }]}>{uniqueLocations.size}</Text>
                  </View>
                  <View style={[styles.statItem, { flex: 1 }]}>
                    <Text style={[styles.statLabel, { color: labelColor, fontSize: 12 * fontScale }]}>Time Slots Used</Text>
                    <Text style={[styles.statValue, { color: textColor, fontSize: 14 * fontScale }]}>{uniqueTimeSlots.size}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Generated Schedule */}
        {schedule.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor, fontSize: 16 * fontScale }]}>
              Generated Schedule
            </Text>
            {schedule.map((weekSchedule) => (
              <View key={weekSchedule.week} style={styles.weekContainer}>
                <View style={[styles.weekHeader, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                  <Text style={[styles.weekTitle, { color: textColor, fontSize: 14 * fontScale }]}>
                    Week {weekSchedule.week}
                  </Text>
                </View>
                {weekSchedule.games.map((game, index) => {
                  const dayOfWeek = getDayOfWeek(game.date);
                  
                  return (
                    <View
                      key={game.id}
                      style={[
                        styles.gameRow,
                        {
                          backgroundColor: cardBackgroundColor,
                          borderColor: cardBorderColor,
                        },
                      ]}
                    >
                      {/* Main Content */}
                      <View style={styles.gameContent}>
                        {/* Upper Line: Team A vs Team B */}
                        <View style={styles.gameTeamsRow}>
                          <Text style={[styles.teamName, { color: textColor, fontSize: 13 * fontScale }]} numberOfLines={1}>
                            {game.teamAName}
                          </Text>
                          <Text style={[styles.vsText, { color: CMConstants.color.green, fontSize: 12 * fontScale, marginHorizontal: CMConstants.space.smallEx }]}>
                            VS
                          </Text>
                          <Text style={[styles.teamName, { color: textColor, fontSize: 13 * fontScale }]} numberOfLines={1}>
                            {game.teamBName}
                          </Text>
                        </View>

                        {/* Lower Line: Time, Location, Day */}
                        <View style={styles.gameDetailsRow}>
                          <Text style={[styles.gameDetail, { color: labelColor, fontSize: 11 * fontScale }]}>
                            {game.time}
                          </Text>
                          <Text style={[styles.gameDetailSeparator, { color: labelColor, fontSize: 11 * fontScale, marginHorizontal: CMConstants.space.smallEx - 4 }]}>
                            •
                          </Text>
                          <Text style={[styles.gameDetail, { color: labelColor, fontSize: 11 * fontScale }]} numberOfLines={1}>
                            {game.location}
                          </Text>
                          <Text style={[styles.gameDetailSeparator, { color: labelColor, fontSize: 11 * fontScale, marginHorizontal: CMConstants.space.smallEx - 4 }]}>
                            •
                          </Text>
                          <View style={[styles.dayBadge, { backgroundColor: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1 }]}>
                            <Text style={[styles.dayText, { color: textColor, fontSize: 10 * fontScale }]}>
                              {dayOfWeek}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.gameActions}>
                        <CMRipple
                          containerStyle={styles.editGameButton}
                          onPress={() => handleEditGame(game, weekSchedule.week)}
                        >
                          <Ionicons name="create-outline" size={18 * iconScale} color={CMConstants.color.green} />
                        </CMRipple>
                        <CMRipple
                          containerStyle={styles.deleteGameButton}
                          onPress={() => handleDeleteGame(game, weekSchedule.week)}
                        >
                          <Ionicons name="trash-outline" size={18 * iconScale} color={CMConstants.color.red} />
                        </CMRipple>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit Game Modal */}
      {editGameModalVisible && editingGame && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>
                Edit Game
              </Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={handleCancelEditGame}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>

            {/* Teams */}
            <View style={{ marginBottom: CMConstants.space.normal }}>
              <Text style={[styles.settingLabel, { color: labelColor, fontSize: 12 * fontScale, marginBottom: CMConstants.space.smallEx - 4 }]}>
                Teams
              </Text>
              <Text
                style={[
                  styles.weekTitle,
                  { color: textColor, fontSize: 14 * fontScale, textAlign: 'center', marginBottom: CMConstants.space.smallEx },
                ]}
                numberOfLines={1}
              >
                {`${getEditingTeamName('A', editingGame.game)}  VS  ${getEditingTeamName('B', editingGame.game)}`}
              </Text>

              {renderSettingRow(
                'Team A',
                getEditingTeamName('A', editingGame.game),
                () => setShowEditTeamPicker('A'),
                'person-outline',
              )}
              {renderSettingRow(
                'Team B',
                getEditingTeamName('B', editingGame.game),
                () => setShowEditTeamPicker('B'),
                'person-outline',
              )}
            </View>

            {/* Game Day */}
            {renderSettingRow(
              'Game Day',
              editGameDay || 'Select day',
              () => setShowEditGameDayPicker(true),
              'calendar-outline',
            )}

            {/* Time Slot */}
            {renderSettingRow(
              'Time Slot',
              editGameTimeSlot || 'Select time',
              () => setShowEditGameTimeSlotPicker(true),
              'time-outline',
            )}

            {/* Auto Date Preview */}
            {editingGame && (
              <View style={[styles.settingRow, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
                <Text style={[styles.settingLabel, { color: textColor, fontSize: 14 * fontScale }]}>
                  Date (auto)
                </Text>
                <Text style={[styles.settingValue, { color: labelColor, fontSize: 14 * fontScale }]}>
                  {editGameDay && editGameTimeSlot
                    ? formatDate(computeGameDateTime(editingGame.week, editGameDay, editGameTimeSlot))
                    : formatDate(editingGame.game.date)}
                </Text>
              </View>
            )}

            {/* Location */}
            {renderSettingRow(
              'Location',
              editGameLocation || 'Select location',
              () => setShowEditGameLocationPicker(true),
              'location-outline',
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', marginTop: CMConstants.space.normal, justifyContent: 'flex-end' }}>
              <CMRipple
                containerStyle={[
                  styles.actionButton,
                  {
                    backgroundColor: cardBackgroundColor,
                    marginRight: CMConstants.space.smallEx,
                  },
                ]}
                onPress={handleCancelEditGame}
              >
                <Text style={[styles.actionButtonText, { color: labelColor, fontSize: 14 * fontScale }]}>
                  Cancel
                </Text>
              </CMRipple>
              <CMRipple
                containerStyle={[
                  styles.actionButton,
                  {
                    backgroundColor: CMConstants.color.green,
                  },
                ]}
                onPress={handleSaveEditedGame}
              >
                <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>
                  Save
                </Text>
              </CMRipple>
            </View>
          </View>
        </View>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
              setStartDate(selectedDate);
            }
          }}
        />
      )}

      {/* Game Days Picker Modal */}
      {showGameDaysPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Select Game Days</Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={() => setShowGameDaysPicker(false)}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>
            <View style={styles.optionsContainer}>
              {daysOfWeek.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: gameDays.includes(day) ? CMConstants.color.green : cardBackgroundColor,
                      borderColor: cardBorderColor,
                    },
                  ]}
                  onPress={() => toggleGameDay(day)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: gameDays.includes(day) ? CMConstants.color.white : textColor,
                        fontSize: 14 * fontScale,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Edit Game Day Picker Modal */}
      {showEditGameDayPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Select Game Day</Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={() => setShowEditGameDayPicker(false)}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>
            <View style={styles.optionsContainer}>
              {gameDays.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: editGameDay === day ? CMConstants.color.green : cardBackgroundColor,
                      borderColor: cardBorderColor,
                    },
                  ]}
                  onPress={() => {
                    setEditGameDay(day);
                    setShowEditGameDayPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: editGameDay === day ? CMConstants.color.white : textColor,
                        fontSize: 14 * fontScale,
                      },
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Time Slots Picker Modal */}
      {showTimeSlotsPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Time Slots</Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={() => setShowTimeSlotsPicker(false)}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>
            <View style={styles.addLocationContainer}>
              <CMRipple
                containerStyle={[
                  styles.locationInput,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    paddingVertical: CMConstants.space.smallEx,
                    paddingHorizontal: CMConstants.space.normal,
                    justifyContent: 'center',
                  },
                ]}
                onPress={() => {
                  // Close modal to ensure time picker is accessible
                  // Use longer delay on iOS to ensure modal fully closes (iOS doesn't allow modal stacking)
                  setShowTimeSlotsPicker(false);
                  const delay = Platform.OS === 'ios' ? 500 : 200;
                  setTimeout(() => {
                    setShowTimePicker(true);
                  }, delay);
                }}
              >
                <Text style={[{ color: inputTextColor, fontSize: 14 * fontScale }]}>
                  {formatTime(tempTimeSlot)}
                </Text>
              </CMRipple>
              <CMRipple
                containerStyle={[styles.addButton, { backgroundColor: CMConstants.color.green }]}
                onPress={addTimeSlot}
              >
                <Ionicons name="add" size={20 * iconScale} color={CMConstants.color.white} />
              </CMRipple>
            </View>
            <View style={styles.locationsList}>
              {timeSlots.map((time) => (
                <View
                  key={time}
                  style={[
                    styles.locationItem,
                    {
                      backgroundColor: cardBackgroundColor,
                      borderColor: cardBorderColor,
                    },
                  ]}
                >
                  <Text style={[styles.locationText, { color: textColor, fontSize: 14 * fontScale }]}>
                    {time}
                  </Text>
                  <CMRipple
                    containerStyle={styles.removeButton}
                    onPress={() => removeTimeSlot(time)}
                  >
                    <Ionicons name="close-circle" size={20 * iconScale} color={CMConstants.color.red} />
                  </CMRipple>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Edit Game Time Slot Picker Modal */}
      {showEditGameTimeSlotPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Select Time Slot</Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={() => setShowEditGameTimeSlotPicker(false)}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>
            <View style={styles.optionsContainer}>
              {timeSlots.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: editGameTimeSlot === time ? CMConstants.color.green : cardBackgroundColor,
                      borderColor: cardBorderColor,
                    },
                  ]}
                  onPress={() => {
                    setEditGameTimeSlot(time);
                    setShowEditGameTimeSlotPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: editGameTimeSlot === time ? CMConstants.color.white : textColor,
                        fontSize: 14 * fontScale,
                      },
                    ]}
                  >
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Time Picker for Time Slots */}
      {showTimePicker && (
        Platform.OS === 'ios' ? (
          <Modal
            visible={showTimePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => {
              setShowTimePicker(false);
              setTimeout(() => {
                setShowTimeSlotsPicker(true);
              }, 300);
            }}
          >
            <View style={[styles.modalOverlay, { zIndex: 2000, justifyContent: 'flex-end' }]}>
              <View style={[
                styles.timePickerContainer,
                {
                  backgroundColor: cardBackgroundColor,
                  borderTopLeftRadius: CMConstants.radius.normal * 2,
                  borderTopRightRadius: CMConstants.radius.normal * 2,
                  borderWidth: 1,
                  borderColor: cardBorderColor,
                  borderBottomWidth: 0,
                }
              ]}>
                {/* Handle bar for visual distinction */}
                <View style={styles.timePickerHandle}>
                  <View style={[styles.handleBar, { backgroundColor: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey }]} />
                </View>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Select Time</Text>
                  <CMRipple
                    containerStyle={styles.closeButton}
                    onPress={() => {
                      setShowTimePicker(false);
                      setTimeout(() => {
                        setShowTimeSlotsPicker(true);
                      }, 300);
                    }}
                  >
                    <Ionicons name="close" size={24 * iconScale} color={textColor} />
                  </CMRipple>
                </View>
                <View style={{ alignItems: 'center', paddingVertical: CMConstants.space.normal, backgroundColor: cardBackgroundColor }}>
                  <DateTimePicker
                    value={tempTimeSlot}
                    mode="time"
                    display="spinner"
                    textColor={isDarkMode ? CMConstants.color.white : CMConstants.color.black}
                    onChange={(event, selectedTime) => {
                      if (event.type === 'set' && selectedTime) {
                        setTempTimeSlot(selectedTime);
                      }
                    }}
                  />
                  <CMRipple
                    containerStyle={[
                      styles.actionButton,
                      {
                        backgroundColor: CMConstants.color.green,
                        marginTop: CMConstants.space.normal,
                        paddingHorizontal: CMConstants.space.large,
                      },
                    ]}
                    onPress={() => {
                      setShowTimePicker(false);
                      setTimeout(() => {
                        setShowTimeSlotsPicker(true);
                      }, 300);
                    }}
                  >
                    <Text style={[styles.actionButtonText, { fontSize: 14 * fontScale }]}>Done</Text>
                  </CMRipple>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <View style={[styles.modalOverlay, { zIndex: 2000 }]}>
            <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor, maxHeight: '50%' as any }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Select Time</Text>
                <CMRipple
                  containerStyle={styles.closeButton}
                  onPress={() => {
                    setShowTimePicker(false);
                    setTimeout(() => {
                      setShowTimeSlotsPicker(true);
                    }, 300);
                  }}
                >
                  <Ionicons name="close" size={24 * iconScale} color={textColor} />
                </CMRipple>
              </View>
              <View style={{ alignItems: 'center', paddingVertical: CMConstants.space.normal, backgroundColor: cardBackgroundColor }}>
                <DateTimePicker
                  value={tempTimeSlot}
                  mode="time"
                  display="default"
                  onChange={(event, selectedTime) => {
                    if (event.type === 'set' && selectedTime) {
                      setTempTimeSlot(selectedTime);
                      setShowTimePicker(false);
                      setTimeout(() => {
                        setShowTimeSlotsPicker(true);
                      }, 300);
                    } else if (event.type === 'dismissed') {
                      setShowTimePicker(false);
                      setTimeout(() => {
                        setShowTimeSlotsPicker(true);
                      }, 300);
                    }
                  }}
                />
              </View>
            </View>
          </View>
        )
      )}

      {/* Locations Picker Modal */}
      {showLocationsPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Locations</Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={() => setShowLocationsPicker(false)}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>
            <View style={styles.addLocationContainer}>
              <TextInput
                style={[
                  styles.locationInput,
                  {
                    backgroundColor: inputBackgroundColor,
                    borderColor: inputBorderColor,
                    color: inputTextColor,
                    fontSize: 14 * fontScale,
                  },
                ]}
                value={newLocationInput}
                onChangeText={setNewLocationInput}
                placeholder="Add location"
                placeholderTextColor={placeholderColor}
                onSubmitEditing={addLocation}
              />
              <CMRipple
                containerStyle={[styles.addButton, { backgroundColor: CMConstants.color.green }]}
                onPress={addLocation}
              >
                <Ionicons name="add" size={20 * iconScale} color={CMConstants.color.white} />
              </CMRipple>
            </View>
            <View style={styles.locationsList}>
              {locations.map((location) => (
                <View
                  key={location}
                  style={[
                    styles.locationItem,
                    {
                      backgroundColor: cardBackgroundColor,
                      borderColor: cardBorderColor,
                    },
                  ]}
                >
                  <Text style={[styles.locationText, { color: textColor, fontSize: 14 * fontScale }]}>
                    {location}
                  </Text>
                  <CMRipple
                    containerStyle={styles.removeButton}
                    onPress={() => removeLocation(location)}
                  >
                    <Ionicons name="close-circle" size={20 * iconScale} color={CMConstants.color.red} />
                  </CMRipple>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Edit Game Location Picker Modal */}
      {showEditGameLocationPicker && (
        <Modal
          visible={showEditGameLocationPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditGameLocationPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.selectionModalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Select Location</Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={() => setShowEditGameLocationPicker(false)}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>
            <ScrollView
              style={styles.selectionListScroll}
              contentContainerStyle={styles.locationsList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {locations.map((location) => (
                <TouchableOpacity
                  key={location}
                  style={[
                    styles.locationItem,
                    {
                      backgroundColor: editGameLocation === location ? CMConstants.color.green : cardBackgroundColor,
                      borderColor: cardBorderColor,
                    },
                  ]}
                  onPress={() => {
                    setEditGameLocation(location);
                    setShowEditGameLocationPicker(false);
                  }}
                >
                  <Text style={[styles.locationText, { color: textColor, fontSize: 14 * fontScale }]}>
                    {location}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Edit Game Team Picker Modal */}
      {showEditTeamPicker && editingGame && (
        <Modal
          visible={!!showEditTeamPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditTeamPicker(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.selectionModalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>
                Select Team {showEditTeamPicker}
              </Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={() => setShowEditTeamPicker(null)}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>
            <ScrollView
              style={styles.selectionListScroll}
              contentContainerStyle={styles.locationsList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {teams
                .filter(t => {
                  // Exclude the other selected team to avoid duplicates
                  const otherId =
                    showEditTeamPicker === 'A'
                      ? (editTeamBId || editingGame.game.teamBId)
                      : (editTeamAId || editingGame.game.teamAId);
                  return t.id !== otherId;
                })
                .map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      styles.locationItem,
                      {
                        backgroundColor:
                          (showEditTeamPicker === 'A' ? editTeamAId || editingGame.game.teamAId : editTeamBId || editingGame.game.teamBId) === team.id
                            ? CMConstants.color.green
                            : cardBackgroundColor,
                        borderColor: cardBorderColor,
                      },
                    ]}
                    onPress={() => {
                      if (showEditTeamPicker === 'A') {
                        setEditTeamAId(team.id);
                      } else {
                        setEditTeamBId(team.id);
                      }
                      setShowEditTeamPicker(null);
                    }}
                  >
                    <Text style={[styles.locationText, { color: textColor, fontSize: 14 * fontScale }]}>
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Round Type Picker Modal */}
      {showRoundPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBackgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 16 * fontScale }]}>Select Round Type</Text>
              <CMRipple
                containerStyle={styles.closeButton}
                onPress={() => setShowRoundPicker(false)}
              >
                <Ionicons name="close" size={24 * iconScale} color={textColor} />
              </CMRipple>
            </View>
            <View style={styles.optionsContainer}>
              {roundTypes.map((round) => (
                <TouchableOpacity
                  key={round}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: roundType === round ? CMConstants.color.green : cardBackgroundColor,
                      borderColor: cardBorderColor,
                    },
                  ]}
                  onPress={() => {
                    setRoundType(round);
                    setShowRoundPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: roundType === round ? CMConstants.color.white : textColor,
                        fontSize: 14 * fontScale,
                      },
                    ]}
                  >
                    {round}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = {
  section: {
    marginTop: CMConstants.space.normal,
  },
  sectionTitle: {
    fontWeight: 'bold' as const,
    marginBottom: CMConstants.space.small,
  },
  settingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.small,
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
  actionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.normal,
  },
  actionButtonText: {
    color: CMConstants.color.white,
    fontWeight: '600' as const,
  },
  weekContainer: {
    marginBottom: CMConstants.space.normal,
  },
  statsContainer: {
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    padding: CMConstants.space.normal,
    marginBottom: CMConstants.space.normal,
  },
  statsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: CMConstants.space.smallEx,
  },
  statItem: {
    flex: 1,
    alignItems: 'center' as const,
    paddingHorizontal: CMConstants.space.smallEx,
  },
  statLabel: {
    fontWeight: '400' as const,
    marginBottom: CMConstants.space.smallEx - 4,
    textAlign: 'center' as const,
  },
  statValue: {
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  weekHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    marginBottom: CMConstants.space.smallEx - 2,
  },
  weekTitle: {
    fontWeight: '600' as const,
  },
  addGameButton: {
    width: 32,
    height: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  gameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.smallEx,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    marginBottom: CMConstants.space.smallEx - 2,
  },
  gameContent: {
    flex: 1,
    marginRight: CMConstants.space.smallEx,
  },
  gameTeamsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  gameDetailsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  editTeamsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: CMConstants.space.smallEx,
  },
  teamName: {
    fontWeight: '600' as const,
    flex: 1,
    minWidth: 0,
  },
  gameDetail: {
    fontWeight: '400' as const,
  },
  gameDetailSeparator: {
    fontWeight: '400' as const,
  },
  vsText: {
    fontWeight: '700' as const,
  },
  dayBadge: {
    paddingHorizontal: CMConstants.space.smallEx,
    paddingVertical: 2,
    borderRadius: CMConstants.radius.small,
  },
  dayText: {
    fontWeight: '600' as const,
  },
  gameActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: CMConstants.space.smallEx - 4,
  },
  editGameButton: {
    width: 32,
    height: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  deleteGameButton: {
    width: 32,
    height: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1000,
  },
  modalContent: {
    width: '90%' as any,
    maxHeight: '80%' as any,
    borderRadius: CMConstants.radius.normal,
    padding: CMConstants.space.normal,
  },
  selectionModalContent: {
    width: '90%' as any,
    maxHeight: '70%' as any,
  },
  selectionListScroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  timePickerContainer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: CMConstants.space.normal,
    paddingBottom: CMConstants.space.large,
    maxHeight: '60%' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  timePickerHandle: {
    alignItems: 'center' as const,
    paddingTop: CMConstants.space.smallEx,
    paddingBottom: CMConstants.space.smallEx,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: CMConstants.space.normal,
  },
  modalTitle: {
    fontWeight: 'bold' as const,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  optionsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: CMConstants.space.smallEx,
  },
  optionItem: {
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center' as const,
  },
  optionText: {
    fontWeight: '500' as const,
  },
  addLocationContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: CMConstants.space.normal,
    gap: CMConstants.space.smallEx,
  },
  locationInput: {
    flex: 1,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1,
  },
  seasonNameInput: {
    flex: 1,
    textAlign: 'right' as const,
    minWidth: 100,
  },
  seasonNameCheckButton: {
    width: 24,
    height: 24,
    marginLeft: CMConstants.space.smallEx,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  locationsList: {
    gap: CMConstants.space.smallEx,
  },
  locationItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1,
  },
  locationText: {
    flex: 1,
    fontWeight: '400' as const,
  },
  removeButton: {
    width: 24,
    height: 24,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  datePickerModal: {
    borderRadius: CMConstants.radius.normal,
    padding: CMConstants.space.normal,
    width: '90%',
    maxWidth: 400,
  },
  datePickerTitle: {
    fontWeight: 'bold' as const,
    marginBottom: CMConstants.space.normal,
    textAlign: 'center' as const,
  },
  datePickerButton: {
    paddingVertical: CMConstants.space.smallEx,
    paddingHorizontal: CMConstants.space.normal,
    borderRadius: CMConstants.radius.small,
  },
  datePickerButtonText: {
    color: CMConstants.color.white,
    fontWeight: '600' as const,
    fontSize: CMConstants.fontSize.normal,
  },
};

export default CMGenerateScheduleScreen;

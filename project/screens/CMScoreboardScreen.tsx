import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Orientation from 'react-native-orientation-locker';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMUtils from '../utils/CMUtils';
import CMRipple from '../components/CMRipple';
import CMScoreboardCourt from '../components/CMScoreboardCourt';
import CMStatInputModal from '../components/CMStatInputModal';
import CMShotChartModal from '../components/CMShotChartModal';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMNewsGeneratorHelper from '../helper/CMNewsGeneratorHelper';
import { getFirestore, collection, query, where, getDocs } from '@react-native-firebase/firestore';

interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  avatar?: string;
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    fouls: number;
    blocks: number;
    turnovers: number;
    steals: number;
  };
}

interface GameState {
  homeScore: number;
  visitorScore: number;
  homeFouls: number;
  visitorFouls: number;
  quarter: number;
  timeRemaining: number;
  status: string;
}

const CMScoreboardScreen = ({ navigation, route }: CMNavigationProps) => {
  const insets = useSafeAreaInsets();
  const themeMode = CMConstants.themeMode.light;
  const screenDimensions = Dimensions.get('window');

  console.log('CMScoreboardScreen rendered');
  console.log('Route params:', route.params);
  console.log('Match data:', route.params?.match);

  const [gameState, setGameState] = useState<GameState>({
    homeScore: 0,
    visitorScore: 0,
    homeFouls: 0,
    visitorFouls: 0,
    quarter: 1,
    timeRemaining: 600, // 10 minutes in seconds
    status: CMConstants.gameStatus.notStarted,
  });

  const [homeTeam, setHomeTeam] = useState<any>({});
  const [visitorTeam, setVisitorTeam] = useState<any>({});
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [visitorPlayers, setVisitorPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showStatModal, setShowStatModal] = useState(false);
  const [showShotChart, setShowShotChart] = useState(false);
  // Cache random positions so they don't change on every render
  const [playerPositions, setPlayerPositions] = useState<{
    [id: string]: { x: number; y: number };
  }>({});

  const gameTimer = useRef<NodeJS.Timeout | null>(null);
  const { match } = route.params || {};

  // Configure navigation header
  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Hide the navigation header
    });
  }, [navigation]);

  useEffect(() => {
    // All users can access scoreboard - subscription removed
    loadGameData();

    // Lock orientation to landscape only for this scoreboard screen
    const lockOrientation = () => {
      Orientation.lockToLandscape();
      console.log('Scoreboard screen loaded - orientation locked to landscape');
    };

    lockOrientation();

    // Add navigation listener to handle orientation when leaving the screen
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      // Unlock orientation when navigating away from scoreboard
      Orientation.unlockAllOrientations();
      console.log('Scoreboard screen leaving - orientation unlocked');
    });

    // Add focus listener to handle when screen loses focus
    const focusUnsubscribe = navigation.addListener('blur', () => {
      // Unlock orientation when screen loses focus
      Orientation.unlockAllOrientations();
      console.log('Scoreboard screen lost focus - orientation unlocked');
    });

    return () => {
      if (gameTimer.current) {
        clearInterval(gameTimer.current);
      }
      // Unlock orientation when component unmounts
      Orientation.unlockAllOrientations();
      console.log('Scoreboard screen unmounting - orientation unlocked');
      unsubscribe();
      focusUnsubscribe();
    };
  }, [navigation]);

  useEffect(() => {
    if (gameState.status === CMConstants.gameStatus.inProgress) {
      startGameTimer();
    } else {
      stopGameTimer();
    }

    // When game status changes to finished, update Firebase and generate news
    if (gameState.status === CMConstants.gameStatus.finished && match?.id) {
      // Update match status in Firebase
      CMFirebaseHelper.updateMatch(
        match.id,
        {
          status: CMConstants.gameStatus.finished,
          teamAScore: gameState.homeScore,
          teamBScore: gameState.visitorScore,
          lastUpdated: new Date().toISOString(),
        },
        (response: { [name: string]: any }) => {
          if (response.isSuccess) {
            console.log('[Scoreboard] Match status updated to finished');
            
            // Update top scorer first, then generate news
            CMFirebaseHelper.updateMatchTopScorer(match.id, (topScorerResponse: { [name: string]: any }) => {
              if (topScorerResponse.isSuccess) {
                console.log('[Scoreboard] Top scorer updated');
              }
              
              // Generate news article in background
              CMNewsGeneratorHelper.onMatchCompleted(match.id)
                .then(result => {
                  if (result.isSuccess) {
                    console.log('[Scoreboard] News article generated:', result.value);
                  } else {
                    console.warn('[Scoreboard] Failed to generate news:', result.error);
                  }
                })
                .catch(error => {
                  console.error('[Scoreboard] Error generating news:', error);
                });
            });
          }
        }
      );
    }
  }, [gameState.status, match?.id]);

  // Save/update player stats to playerStats collection (for top scorer calculation)
  const savePlayerStatToCollection = async (
    playerId: string,
    playerStats: Player['stats'],
  ) => {
    if (!match?.leagueId || !match?.id) return;

    try {
      // Find existing playerStats document for this player/match/league
      const existingStatsQuery = query(
        collection(getFirestore(), 'playerStats'),
        where('playerId', '==', playerId),
        where('matchId', '==', match.id),
        where('leagueId', '==', match.leagueId)
      );
      const existingStatsSnapshot = await getDocs(existingStatsQuery);

      const statData = {
        playerId: playerId,
        leagueId: match.leagueId,
        matchId: match.id,
        dayTime: new Date(),
        pointsPerGame: playerStats.points || 0,
        assists: playerStats.assists || 0,
        rebounds: playerStats.rebounds || 0,
        turnovers: playerStats.turnovers || 0,
        steals: playerStats.steals || 0,
        blocks: playerStats.blocks || 0,
      };

      if (existingStatsSnapshot.empty) {
        // Create new playerStats document
        const playerStatId = CMFirebaseHelper.getNewDocumentId(CMConstants.collectionName.playerStats);
        await firestore()
          .collection('playerStats')
          .doc(playerStatId)
          .set({ ...statData, id: playerStatId });
        console.log('Player stat created in playerStats collection for top scorer');
      } else {
        // Update existing playerStats document
        const existingDoc = existingStatsSnapshot.docs[0];
        await existingDoc.ref.update(statData);
        console.log('Player stat updated in playerStats collection for top scorer');
      }
    } catch (error) {
      console.error('Error saving player stat to collection:', error);
    }
  };

  const updatePlayerStatsInFirebase = (
    playerId: string,
    statType: string,
    value: number,
  ) => {
    if (!selectedPlayer || !match?.leagueId) return;

    // Create league-specific stats structure to prevent mixing data between leagues
    const leagueStatsKey = `leagueStats.${match.leagueId}`;
    const playerUpdateData = {
      [leagueStatsKey]: {
        [statType]: value,
        lastUpdated: new Date().toISOString(),
        leagueId: match.leagueId,
        matchId: match.id,
      },
      lastUpdated: new Date().toISOString(),
    };

    // Update players collection with league-specific stats
    CMFirebaseHelper.updatePlayer(
      playerId,
      playerUpdateData,
      (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          console.log(
            'Player league stats updated in players collection:',
            playerUpdateData,
          );
        } else {
          console.error(
            'Failed to update player league stats in players collection:',
            response.value,
          );
        }
      },
    );
  };

  const updateMatchScoresInFirebase = () => {
    if (!match?.id) return;

    // Update match document with current scores
    const matchUpdateData = {
      teamAScore: gameState.homeScore,
      teamBScore: gameState.visitorScore,
      lastUpdated: new Date().toISOString(),
    };

    // Use updateMatch to update the match scores
    CMFirebaseHelper.updateMatch(
      match.id,
      matchUpdateData,
      (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          console.log('Match scores updated in Firebase:', matchUpdateData);
        } else {
          console.error(
            'Failed to update match scores in Firebase:',
            response.value,
          );
        }
      },
    );
  };

  const loadGameData = () => {
    if (match?.teamAId && match?.teamBId) {
      // Load teams
      CMFirebaseHelper.getTeams(
        [match.teamAId, match.teamBId],
        (response: { [name: string]: any }) => {
          if (response.isSuccess) {
            setHomeTeam(response.value[0]);
            setVisitorTeam(response.value[1]);

            // Load players for both teams
            loadTeamPlayers(response.value[0].id, setHomePlayers);
            loadTeamPlayers(response.value[1].id, setVisitorPlayers);
          }
        },
      );
    }
  };

  const loadTeamPlayers = (
    teamId: string,
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
  ) => {
    CMFirebaseHelper.getPlayers(
      [teamId],
      (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          const playersWithStats = response.value.map((player: any) => ({
            ...player,
            stats: {
              points: 0,
              rebounds: 0,
              assists: 0,
              fouls: 0,
              blocks: 0,
              turnovers: 0,
              steals: 0,
            },
          }));
          setPlayers(playersWithStats);
          // After players load for a team, assign random positions
          setPlayerPositions(prev => {
            const updated = { ...prev };
            playersWithStats.forEach((p: Player) => {
              if (!updated[p.id]) {
                updated[p.id] = { x: 0, y: 0 };
              }
            });
            return updated;
          });
        }
      },
    );
  };

  // Fixed positioning is now handled by getPlayerPosition function
  // No need for random positioning logic anymore

  const startGameTimer = () => {
    gameTimer.current = setInterval(() => {
      setGameState(prev => {
        if (prev.timeRemaining > 0) {
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        } else {
          // End quarter
          if (prev.quarter < 4) {
            return { ...prev, quarter: prev.quarter + 1, timeRemaining: 600 };
          } else {
            // End game
            return { ...prev, status: CMConstants.gameStatus.finished };
          }
        }
      });
    }, 1000);
  };

  const stopGameTimer = () => {
    if (gameTimer.current) {
      clearInterval(gameTimer.current);
      gameTimer.current = null;
    }
  };

  const toggleGameStatus = () => {
    setGameState(prev => ({
      ...prev,
      status:
        prev.status === CMConstants.gameStatus.inProgress
          ? CMConstants.gameStatus.paused
          : CMConstants.gameStatus.inProgress,
    }));
  };

  const onPlayerPress = (player: Player) => {
    // If clicking the same player, deselect. Otherwise, select the new player
    if (selectedPlayer?.id === player.id) {
      setSelectedPlayer(null);
      setShowStatModal(false);
    } else {
      setSelectedPlayer(player);
      // Show the stat input modal to track scores
      setShowStatModal(true);
    }
  };

  const onStatInput = (statType: string, value: any) => {
    console.log('onStatInput called with:', {
      statType,
      value,
      selectedPlayer,
    });

    if (!selectedPlayer) {
      // Show a message that a player needs to be selected first
      console.log('Please select a player first');
      return;
    }

    // Determine which team the selected player belongs to
    const isHomeTeamPlayer = homePlayers.some(
      player => player.id === selectedPlayer.id,
    );
    const isVisitorTeamPlayer = visitorPlayers.some(
      player => player.id === selectedPlayer.id,
    );

    if (!isHomeTeamPlayer && !isVisitorTeamPlayer) {
      console.log('Player not found in any team');
      return;
    }

    const updatePlayerStats = (
      players: Player[],
      playerId: string,
      updates: any,
    ) => {
      return players.map(player =>
        player.id === playerId
          ? { ...player, stats: { ...player.stats, ...updates } }
          : player,
      );
    };

    // Update player stats
    if (statType === CMConstants.statType.points) {
      let points = 0;

      // Handle direct button input (value is a number)
      if (typeof value === 'number') {
        points = value;
      } else {
        // Handle modal input (value is an object with shotType and result)
        const { shotType, result } = value;
        // Safety guard: if a made 2PT/3PT arrives without assistedBy while teammates exist, ignore (assist modal should handle)
        if (
          result === CMConstants.shotResult.made &&
          (shotType === CMConstants.shotType.twoPoint || shotType === CMConstants.shotType.threePoint) &&
          !value.assistedBy
        ) {
          const teamList = isHomeTeamPlayer ? homePlayers : isVisitorTeamPlayer ? visitorPlayers : [];
          if (teamList.filter(p => p.id !== selectedPlayer.id).length > 0) {
            // Wait for assistedBy selection; do not update points yet
            setShowStatModal(true);
            return;
          }
        }
        points =
          result === CMConstants.shotResult.made
            ? shotType === CMConstants.shotType.threePoint
              ? 3
              : shotType === CMConstants.shotType.twoPoint
              ? 2
              : 1
            : 0;
      }

      console.log('Processing points:', {
        points,
        isHomeTeamPlayer,
        isVisitorTeamPlayer,
      });

      // Update only the team that the player belongs to
      if (isHomeTeamPlayer) {
        console.log('Updating home team player and score');
        const updatedPoints = selectedPlayer.stats.points + points;
        setHomePlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, {
            points: updatedPoints,
          }),
        );
        // Update home team score
        setGameState(prev => ({
          ...prev,
          homeScore: prev.homeScore + points,
        }));

        // If assistedBy provided, increment assist for that teammate
        let assistedByPlayer = null;
        if (value && typeof value === 'object' && value.assistedBy) {
          const assistedById = value.assistedBy as string
          const assistCount = (homePlayers.find(p => p.id === assistedById)?.stats.assists || 0) + 1;
          assistedByPlayer = homePlayers.find(p => p.id === assistedById);
          setHomePlayers(prev => prev.map(p => p.id === assistedById ? { ...p, stats: { ...p.stats, assists: assistCount } } : p))
        }

        // Update player stats in Firebase (players collection)
        updatePlayerStatsInFirebase(
          selectedPlayer.id,
          'points',
          updatedPoints,
        );
        if (value && typeof value === 'object' && value.assistedBy) {
          updatePlayerStatsInFirebase(value.assistedBy, 'assists', (homePlayers.find(p => p.id === value.assistedBy)?.stats.assists || 0) + 1)
        }

        // Save player stats to playerStats collection (for top scorer calculation)
        const updatedPlayerStats = {
          ...selectedPlayer.stats,
          points: updatedPoints,
        };
        savePlayerStatToCollection(selectedPlayer.id, updatedPlayerStats);

        // If assistedBy, also update their stats in playerStats collection
        if (assistedByPlayer) {
          const updatedAssistStats = {
            ...assistedByPlayer.stats,
            assists: (assistedByPlayer.stats.assists || 0) + 1,
          };
          savePlayerStatToCollection(value.assistedBy, updatedAssistStats);
        }

        // Update match scores in Firebase for activity feed
        updateMatchScoresInFirebase();
        
        // Update top scorer for this match
        CMFirebaseHelper.updateMatchTopScorer(match.id, (response: {[name: string]: any}) => {
          if (response.isSuccess) {
            console.log('Top scorer updated for match:', response.data);
          } else {
            console.log('Failed to update top scorer:', response.value);
          }
        });
      } else if (isVisitorTeamPlayer) {
        console.log('Updating visitor team player and score');
        const updatedPoints = selectedPlayer.stats.points + points;
        setVisitorPlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, {
            points: updatedPoints,
          }),
        );
        // Update visitor team score
        setGameState(prev => ({
          ...prev,
          visitorScore: prev.visitorScore + points,
        }));

        // If assistedBy provided, increment assist for that teammate
        let assistedByPlayer = null;
        if (value && typeof value === 'object' && value.assistedBy) {
          const assistedById = value.assistedBy as string
          const assistCount = (visitorPlayers.find(p => p.id === assistedById)?.stats.assists || 0) + 1;
          assistedByPlayer = visitorPlayers.find(p => p.id === assistedById);
          setVisitorPlayers(prev => prev.map(p => p.id === assistedById ? { ...p, stats: { ...p.stats, assists: assistCount } } : p))
        }

        // Update player stats in Firebase (players collection)
        updatePlayerStatsInFirebase(
          selectedPlayer.id,
          'points',
          updatedPoints,
        );
        if (value && typeof value === 'object' && value.assistedBy) {
          updatePlayerStatsInFirebase(value.assistedBy, 'assists', (visitorPlayers.find(p => p.id === value.assistedBy)?.stats.assists || 0) + 1)
        }

        // Save player stats to playerStats collection (for top scorer calculation)
        const updatedPlayerStats = {
          ...selectedPlayer.stats,
          points: updatedPoints,
        };
        savePlayerStatToCollection(selectedPlayer.id, updatedPlayerStats);

        // If assistedBy, also update their stats in playerStats collection
        if (assistedByPlayer) {
          const updatedAssistStats = {
            ...assistedByPlayer.stats,
            assists: (assistedByPlayer.stats.assists || 0) + 1,
          };
          savePlayerStatToCollection(value.assistedBy, updatedAssistStats);
        }

        // Update match scores in Firebase for activity feed
        updateMatchScoresInFirebase();
        
        // Update top scorer for this match
        CMFirebaseHelper.updateMatchTopScorer(match.id, (response: {[name: string]: any}) => {
          if (response.isSuccess) {
            console.log('Top scorer updated for match:', response.data);
          } else {
            console.log('Failed to update top scorer:', response.value);
          }
        });
      }
    } else if (statType === CMConstants.statType.rebounds) {
      const updateRebounds = selectedPlayer.stats.rebounds + 1;
      if (isHomeTeamPlayer) {
        setHomePlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, {
            rebounds: updateRebounds,
          }),
        );
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(
          selectedPlayer.id,
          'rebounds',
          updateRebounds,
        );
        // Save to playerStats collection
        savePlayerStatToCollection(selectedPlayer.id, {
          ...selectedPlayer.stats,
          rebounds: updateRebounds,
        });
      } else if (isVisitorTeamPlayer) {
        setVisitorPlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, {
            rebounds: updateRebounds,
          }),
        );
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(
          selectedPlayer.id,
          'rebounds',
          updateRebounds,
        );
        // Save to playerStats collection
        savePlayerStatToCollection(selectedPlayer.id, {
          ...selectedPlayer.stats,
          rebounds: updateRebounds,
        });
      }
    } else if (statType === CMConstants.statType.assists) {
      const updateAssists = selectedPlayer.stats.assists + 1;
      if (isHomeTeamPlayer) {
        setHomePlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, {
            assists: updateAssists,
          }),
        );
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(
          selectedPlayer.id,
          'assists',
          updateAssists,
        );
        // Save to playerStats collection
        savePlayerStatToCollection(selectedPlayer.id, {
          ...selectedPlayer.stats,
          assists: updateAssists,
        });
      } else if (isVisitorTeamPlayer) {
        setVisitorPlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, {
            assists: updateAssists,
          }),
        );
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(
          selectedPlayer.id,
          'assists',
          updateAssists,
        );
        // Save to playerStats collection
        savePlayerStatToCollection(selectedPlayer.id, {
          ...selectedPlayer.stats,
          assists: updateAssists,
        });
      }
    } else if (statType === CMConstants.statType.blocks) {
      const updateBlocks = selectedPlayer.stats.blocks + 1;
      if (isHomeTeamPlayer) {
        setHomePlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, {
            blocks: updateBlocks,
          }),
        );
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(selectedPlayer.id, 'blocks', updateBlocks);
        // Save to playerStats collection
        savePlayerStatToCollection(selectedPlayer.id, {
          ...selectedPlayer.stats,
          blocks: updateBlocks,
        });
      } else if (isVisitorTeamPlayer) {
        setVisitorPlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, {
            blocks: updateBlocks,
          }),
        );
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(selectedPlayer.id, 'blocks', updateBlocks);
        // Save to playerStats collection
        savePlayerStatToCollection(selectedPlayer.id, {
          ...selectedPlayer.stats,
          blocks: updateBlocks,
        });
      }
    } else if (statType === CMConstants.statType.steals) {
      const updateSteals = selectedPlayer.stats.steals + 1;
      if (isHomeTeamPlayer) {
        setHomePlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, { steals: updateSteals }),
        );
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(selectedPlayer.id, 'steals', updateSteals);
        // Save to playerStats collection
        savePlayerStatToCollection(selectedPlayer.id, {
          ...selectedPlayer.stats,
          steals: updateSteals,
        });
      } else if (isVisitorTeamPlayer) {
        setVisitorPlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, { steals: updateSteals }),
        );
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(selectedPlayer.id, 'steals', updateSteals);
        // Save to playerStats collection
        savePlayerStatToCollection(selectedPlayer.id, {
          ...selectedPlayer.stats,
          steals: updateSteals,
        });
      }
    } else if (statType === CMConstants.statType.fouls) {
      const updateFouls = selectedPlayer.stats.fouls + 1;
      if (isHomeTeamPlayer) {
        setHomePlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, { fouls: updateFouls }),
        );
        // Update home team fouls
        setGameState(prev => ({
          ...prev,
          homeFouls: prev.homeFouls + 1,
        }));
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(selectedPlayer.id, 'fouls', updateFouls);
        // Note: Fouls typically not part of playerStats collection for top scorer calculation
      } else if (isVisitorTeamPlayer) {
        setVisitorPlayers(prev =>
          updatePlayerStats(prev, selectedPlayer.id, { fouls: updateFouls }),
        );
        // Update visitor team fouls
        setGameState(prev => ({
          ...prev,
          visitorFouls: prev.visitorFouls + 1,
        }));
        // Update player stats in Firebase
        updatePlayerStatsInFirebase(selectedPlayer.id, 'fouls', updateFouls);
        // Note: Fouls typically not part of playerStats collection for top scorer calculation
      }
    }

    setShowStatModal(false);
    // Keep selectedPlayer so stats indicators remain visible
  };

  // Sync selectedPlayer with latest stats from players arrays
  useEffect(() => {
    if (selectedPlayer) {
      const allPlayers = [...homePlayers, ...visitorPlayers];
      const currentPlayer = allPlayers.find(p => p.id === selectedPlayer.id);
      if (currentPlayer && JSON.stringify(currentPlayer.stats) !== JSON.stringify(selectedPlayer.stats)) {
        setSelectedPlayer(currentPlayer);
      }
    }
  }, [homePlayers, visitorPlayers, selectedPlayer?.id]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  };

  // Fixed on-court positions for 5 players per team matching the desired layout
  const getSubstitutePosition = (index: number, isHomeTeam: boolean) => {
    const width = screenDimensions.width;
    const height = screenDimensions.height;
    
    // Court uses 85% of screen, so position substitutes at ~88% of screen height
    // This ensures they're below the court but still visible
    const bottomY = height * 0.88; // Position at 88% of screen height

    if (isHomeTeam) {
      // Home team substitutes on the left side, below the court
      return {
        x: 30 + index * 45, // Spaced along the left side
        y: bottomY,
      };
    } else {
      // Visitor team substitutes on the right side, below the court
      return {
        x: width - 30 - (2 - index) * 45 - 18, // Spaced along the right side (account for jersey width)
        y: bottomY,
      };
    }
  };

  const getPlayerPosition = (index: number, isHomeTeam: boolean) => {
    const width = screenDimensions.width - 100;
    const height = screenDimensions.height - 100;
    const playerSize = 20;
    const margin = 20;
    const scoreboardTop = 20;
    const scoreboardHeight = 30;

    // Calculate court boundaries
    const yMin = scoreboardTop + scoreboardHeight + margin;
    const yMax = height - playerSize - margin;
    const courtHeight = yMax - yMin;

    // Calculate left and right court boundaries
    const leftCourtX = margin;
    const rightCourtX = width - margin - playerSize;
    const centerX = width / 2;

    if (isHomeTeam) {
      // Home team (Blue Jerseys - Left Side)
      // Layout: Two on the sides, three in front in a line
      const positions = [
        // Top-left corner (side position)
        {
          x: 0,
          y: courtHeight * 0.1,
        },
        // Upper-left area (front line)
        {
          x: leftCourtX + 230,
          y: yMin + courtHeight * 0.25,
        },
        // Middle-left (front line)
        {
          x: 20,
          y: 650 * 0.4,
        },
        // Lower-left (front line)
        {
          x: 50 + 180,
          y: 120 + courtHeight * 0.55,
        },
        // Bottom-left corner (side position)
        {
          x: 100 + 80,
          y: yMin + 100 + courtHeight * 0.7,
        },
      ];

      return positions[index % 5];
    } else {
      // Visitor team (Red Jerseys - Right Side)
      // Layout: Mirror of home team but on the right side
      const positions = [
        // Top-right corner (side position) - mirror of home top-left
        {
          x: width - 20,
          y: courtHeight * 0.1,
        },
        // Upper-right area (front line) - mirror of home upper-left
        {
          x: width - 230,
          y: yMin + courtHeight * 0.25,
        },
        // Middle-right (front line) - mirror of home middle-left
        {
          x: width - 20,
          y: 700 * 0.4,
        },
        // Lower-right (front line) - mirror of home lower-left
        {
          x: width - (100 + 180),
          y: 120 + courtHeight * 0.55,
        },
        // Bottom-right corner (side position) - mirror of home bottom-left
        {
          x: width - (100 + 80),
          y: yMin + 100 + courtHeight * 0.7,
        },
      ];

      return positions[index % 5];
    }
  };

  return (
    <SafeAreaView
      style={[CMCommonStyles.bodyMain(themeMode), styles.container]}
    >
      {/* Custom Back Button */}
      <View style={styles.backButtonContainer}>
        <CMRipple
          containerStyle={styles.backButton}
          onPress={() => {
            // Unlock orientation before navigating back
            Orientation.unlockAllOrientations();
            console.log('Back button pressed - orientation unlocked');
            navigation.goBack();
          }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={CMConstants.color.white}
          />
        </CMRipple>
      </View>

      {/* Floating Scoreboard Box on Court */}
      <View style={styles.floatingScoreboard}>
        <View style={styles.teamScore}>
          <Text style={styles.teamName}>HOME</Text>
          <Text style={styles.scoreText}>{gameState.homeScore}</Text>
          <Text style={styles.foulsText}>Fouls {gameState.homeFouls}</Text>
        </View>

        <View style={styles.gameInfo}>
          <Text style={styles.timeText}>
            {formatTime(gameState.timeRemaining)}
          </Text>
          <Text style={styles.quarterText}>Q{gameState.quarter}</Text>

          <CMRipple
            containerStyle={styles.playButton}
            onPress={toggleGameStatus}
          >
            <Ionicons
              name={
                gameState.status === CMConstants.gameStatus.inProgress
                  ? 'pause'
                  : 'play'
              }
              size={20}
              color={CMConstants.color.white}
            />
          </CMRipple>
        </View>

        <View style={styles.teamScore}>
          <Text style={styles.teamName}>VISITOR</Text>
          <Text style={styles.scoreText}>{gameState.visitorScore}</Text>
          <Text style={styles.foulsText}>Fouls {gameState.visitorFouls}</Text>
        </View>
      </View>

      {/* Full Screen Court */}
      <View style={styles.courtContainer}>
        <View style={styles.basketballCourt}>
          {/* Basketball Court Background Image */}
          <Image
            source={require('../../assets/images/img_court.png')}
            style={[
              styles.courtBackgroundImage,
              {
                width: screenDimensions.height * 0.85, // Reduced to leave space for substitutes
                height: screenDimensions.width * 0.85, // Reduced to leave space for substitutes
                left: (screenDimensions.width - screenDimensions.height * 0.85) / 2,
                top: (screenDimensions.height * 0.85 - screenDimensions.width * 0.85) / 2,
              } as any,
            ]}
            resizeMode="stretch"
          />

          {/* Court lines are drawn in the PNG; no custom overlays */}

          {/* Home Team Players - On Court (First 5) */}
          {homePlayers.slice(0, 5).map((player, index) => {
            console.log(
              'Rendering home player:',
              player.name,
              'with stats:',
              player.stats,
            );
            const position = getPlayerPosition(index, true);
            const isGameRunning =
              gameState.status === CMConstants.gameStatus.inProgress;
            return (
              <View key={player.id}>
                <CMRipple
                  containerStyle={[
                    styles.playerOnCourt,
                    {
                      position: 'absolute' as const,
                      left: position.x,
                      top: position.y,
                    },
                    selectedPlayer?.id === player.id &&
                      styles.selectedPlayerOnCourt,
                    !isGameRunning && styles.disabledPlayer,
                  ]}
                  onPress={
                    isGameRunning ? () => onPlayerPress(player) : () => {}
                  }
                >
                  <Image
                    source={require('../../assets/images/football.png')}
                    style={styles.jerseyIcon}
                    resizeMode="contain"
                  />
                  <View style={styles.jerseyNumberOverlay}>
                    <Text
                      style={[
                        styles.playerJerseyNumber,
                        !isGameRunning && styles.disabledPlayerText,
                      ]}
                    >
                      {player.number}
                    </Text>
                  </View>
                  {selectedPlayer?.id === player.id && (
                    <Text style={[styles.playerNameOnCourt]}>
                      {player.name || 'Player'}
                    </Text>
                  )}
                </CMRipple>

                {/* Player Stats Card - Only show when selected */}
                {selectedPlayer?.id === player.id && (
                  <View
                    style={{
                      position: 'absolute',
                      left: position.x + 90,
                      top: position.y - 20,
                      backgroundColor: CMConstants.color.darkGrey2,
                      borderRadius: CMConstants.radius.normal + 2,
                      padding: CMConstants.space.smallEx,
                      paddingHorizontal: CMConstants.space.small,
                      minWidth: 65,
                      zIndex: 1000,
                      borderWidth: 2,
                      borderColor: CMConstants.color.green,
                      shadowColor: CMConstants.color.green,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      elevation: 10,
                    }}
                  >
                    {/* Points - Highlighted */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'baseline', 
                      marginBottom: 5,
                      paddingBottom: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: CMConstants.color.darkGrey3,
                    }}>
                      <View style={{ 
                        width: 4, 
                        height: 4, 
                        borderRadius: 2, 
                        backgroundColor: CMConstants.color.green,
                        marginRight: 6,
                        marginTop: 1,
                      }} />
                      <Text
                        style={{
                          color: CMConstants.color.green,
                          fontSize: CMConstants.fontSize.medium,
                          fontFamily: CMConstants.font.bold,
                          letterSpacing: 0.5,
                        }}
                      >
                        {selectedPlayer.stats.points}
                      </Text>
                      <Text
                        style={{
                          color: CMConstants.color.semiLightGrey,
                          fontSize: CMConstants.fontSize.smallEx,
                          fontFamily: CMConstants.font.regular,
                          marginLeft: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        pts
                      </Text>
                    </View>
                    {/* Rebounds */}
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
                      <View style={{ 
                        width: 3, 
                        height: 3, 
                        borderRadius: 1.5, 
                        backgroundColor: CMConstants.color.white,
                        marginRight: 6,
                        marginTop: 1,
                        opacity: 0.7,
                      }} />
                      <Text
                        style={{
                          color: CMConstants.color.white,
                          fontSize: CMConstants.fontSize.small,
                          fontFamily: CMConstants.font.semiBold,
                        }}
                      >
                        {selectedPlayer.stats.rebounds}
                      </Text>
                      <Text
                        style={{
                          color: CMConstants.color.semiLightGrey,
                          fontSize: CMConstants.fontSize.smallEx,
                          fontFamily: CMConstants.font.regular,
                          marginLeft: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        Rbs
                      </Text>
                    </View>
                    {/* Assists */}
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <View style={{ 
                        width: 3, 
                        height: 3, 
                        borderRadius: 1.5, 
                        backgroundColor: CMConstants.color.white,
                        marginRight: 6,
                        marginTop: 1,
                        opacity: 0.7,
                      }} />
                      <Text
                        style={{
                          color: CMConstants.color.white,
                          fontSize: CMConstants.fontSize.small,
                          fontFamily: CMConstants.font.semiBold,
                        }}
                      >
                        {selectedPlayer.stats.assists}
                      </Text>
                      <Text
                        style={{
                          color: CMConstants.color.semiLightGrey,
                          fontSize: CMConstants.fontSize.smallEx,
                          fontFamily: CMConstants.font.regular,
                          marginLeft: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        Ast
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {/* Visitor Team Players - On Court (First 5) */}
          {visitorPlayers.slice(0, 5).map((player, index) => {
            const position = getPlayerPosition(index, false);
            const isGameRunning =
              gameState.status === CMConstants.gameStatus.inProgress;
            return (
              <View key={player.id}>
                <CMRipple
                  containerStyle={[
                    styles.playerOnCourt,
                    {
                      position: 'absolute' as const,
                      left: position.x,
                      top: position.y,
                    },
                    selectedPlayer?.id === player.id &&
                      styles.selectedPlayerOnCourt,
                    !isGameRunning && styles.disabledPlayer,
                  ]}
                  onPress={
                    isGameRunning ? () => onPlayerPress(player) : () => {}
                  }
                >
                  <Image
                    source={require('../../assets/images/jersey.png')}
                    style={styles.jerseyIcon}
                    resizeMode="contain"
                  />
                  <View style={styles.jerseyNumberOverlay}>
                    <Text
                      style={[
                        styles.playerJerseyNumber,
                        !isGameRunning && styles.disabledPlayerText,
                      ]}
                    >
                      {player.number}
                    </Text>
                  </View>
                  {selectedPlayer?.id === player.id && (
                    <Text style={[styles.playerNameOnCourt]}>
                      {player.name || 'Player'}
                    </Text>
                  )}
                </CMRipple>

                {/* Player Stats Card - Only show when selected */}
                {selectedPlayer?.id === player.id && (
                  <View
                    style={{
                      position: 'absolute',
                      left: position.x - 75,
                      top: position.y - 20,
                      backgroundColor: CMConstants.color.darkGrey2,
                      borderRadius: CMConstants.radius.normal + 2,
                      padding: CMConstants.space.smallEx,
                      paddingHorizontal: CMConstants.space.small,
                      minWidth: 65,
                      zIndex: 1000,
                      borderWidth: 2,
                      borderColor: CMConstants.color.green,
                      shadowColor: CMConstants.color.green,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      elevation: 10,
                    }}
                  >
                    {/* Points - Highlighted */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'baseline', 
                      marginBottom: 5,
                      paddingBottom: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: CMConstants.color.darkGrey3,
                    }}>
                      <View style={{ 
                        width: 4, 
                        height: 4, 
                        borderRadius: 2, 
                        backgroundColor: CMConstants.color.green,
                        marginRight: 6,
                        marginTop: 1,
                      }} />
                      <Text
                        style={{
                          color: CMConstants.color.green,
                          fontSize: CMConstants.fontSize.medium,
                          fontFamily: CMConstants.font.bold,
                          letterSpacing: 0.5,
                        }}
                      >
                        {selectedPlayer.stats.points}
                      </Text>
                      <Text
                        style={{
                          color: CMConstants.color.semiLightGrey,
                          fontSize: CMConstants.fontSize.smallEx,
                          fontFamily: CMConstants.font.regular,
                          marginLeft: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        pts
                      </Text>
                    </View>
                    {/* Rebounds */}
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
                      <View style={{ 
                        width: 3, 
                        height: 3, 
                        borderRadius: 1.5, 
                        backgroundColor: CMConstants.color.white,
                        marginRight: 6,
                        marginTop: 1,
                        opacity: 0.7,
                      }} />
                      <Text
                        style={{
                          color: CMConstants.color.white,
                          fontSize: CMConstants.fontSize.small,
                          fontFamily: CMConstants.font.semiBold,
                        }}
                      >
                        {selectedPlayer.stats.rebounds}
                      </Text>
                      <Text
                        style={{
                          color: CMConstants.color.semiLightGrey,
                          fontSize: CMConstants.fontSize.smallEx,
                          fontFamily: CMConstants.font.regular,
                          marginLeft: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        Rbs
                      </Text>
                    </View>
                    {/* Assists */}
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <View style={{ 
                        width: 3, 
                        height: 3, 
                        borderRadius: 1.5, 
                        backgroundColor: CMConstants.color.white,
                        marginRight: 6,
                        marginTop: 1,
                        opacity: 0.7,
                      }} />
                      <Text
                        style={{
                          color: CMConstants.color.white,
                          fontSize: CMConstants.fontSize.small,
                          fontFamily: CMConstants.font.semiBold,
                        }}
                      >
                        {selectedPlayer.stats.assists}
                      </Text>
                      <Text
                        style={{
                          color: CMConstants.color.semiLightGrey,
                          fontSize: CMConstants.fontSize.smallEx,
                          fontFamily: CMConstants.font.regular,
                          marginLeft: 4,
                          textTransform: 'uppercase',
                        }}
                      >
                        Ast
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {/* Home Team Substitute Players (Last 3) */}
          {homePlayers.slice(5, 8).map((player, index) => {
            const isGameRunning =
              gameState.status === CMConstants.gameStatus.inProgress;
            const position = getSubstitutePosition(index, true);
            return (
              <View key={`sub-home-${player.id}`}>
                <CMRipple
                  containerStyle={[
                    styles.substitutePlayer,
                    {
                      position: 'absolute' as const,
                      left: position.x,
                      top: position.y,
                    },
                    selectedPlayer?.id === player.id &&
                      styles.selectedPlayerOnCourt,
                    !isGameRunning && styles.disabledPlayer,
                  ]}
                  onPress={
                    isGameRunning ? () => onPlayerPress(player) : () => {}
                  }
                >
                  <Image
                    source={require('../../assets/images/football.png')}
                    style={styles.substituteJerseyIcon}
                    resizeMode="contain"
                  />
                  <View style={styles.substituteJerseyNumberOverlay}>
                    <Text
                      style={[
                        styles.substituteJerseyNumber,
                        !isGameRunning && styles.disabledPlayerText,
                      ]}
                    >
                      {player.number}
                    </Text>
                  </View>
                </CMRipple>
              </View>
            );
          })}

          {/* Visitor Team Substitute Players (Last 3) */}
          {visitorPlayers.slice(5, 8).map((player, index) => {
            const isGameRunning =
              gameState.status === CMConstants.gameStatus.inProgress;
            const position = getSubstitutePosition(index, false);
            return (
              <View key={`sub-visitor-${player.id}`}>
                <CMRipple
                  containerStyle={[
                    styles.substitutePlayer,
                    {
                      position: 'absolute' as const,
                      left: position.x,
                      top: position.y,
                    },
                    selectedPlayer?.id === player.id &&
                      styles.selectedPlayerOnCourt,
                    !isGameRunning && styles.disabledPlayer,
                  ]}
                  onPress={
                    isGameRunning ? () => onPlayerPress(player) : () => {}
                  }
                >
                  <Image
                    source={require('../../assets/images/jersey.png')}
                    style={styles.substituteJerseyIcon}
                    resizeMode="contain"
                  />
                  <View style={styles.substituteJerseyNumberOverlay}>
                    <Text
                      style={[
                        styles.substituteJerseyNumber,
                        !isGameRunning && styles.disabledPlayerText,
                      ]}
                    >
                      {player.number}
                    </Text>
                  </View>
                </CMRipple>
              </View>
            );
          })}
        </View>
      </View>

      {/* Stat Input Modal */}
      <CMStatInputModal
        visible={showStatModal}
        onClose={() => {
          setShowStatModal(false);
          setSelectedPlayer(null);
        }}
        onStatInput={onStatInput}
        player={selectedPlayer}
        teammates={selectedPlayer ? (homePlayers.some(p => p.id === selectedPlayer.id) ? homePlayers.filter(p => p.id !== selectedPlayer.id) : visitorPlayers.filter(p => p.id !== selectedPlayer.id)) : []}
      />

      {/* Shot Chart Modal */}
      <CMShotChartModal
        visible={showShotChart}
        onClose={() => setShowShotChart(false)}
        homeTeam={homeTeam}
        visitorTeam={visitorTeam}
      />
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: CMConstants.color.black,
    overflow: 'visible' as const,
  },
  backButtonContainer: {
    position: 'absolute' as const,
    top: 100,
    left: 20,
    zIndex: 100,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CMConstants.color.darkGrey2,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: CMConstants.color.green,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingScoreboard: {
    position: 'absolute' as const,
    top: 20,
    left: '50%' as any,
    transform: [{ translateX: -170 }] as any,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: CMConstants.space.normal,
    paddingVertical: CMConstants.space.small,
    backgroundColor: CMConstants.color.darkGrey2,
    borderWidth: 2,
    borderColor: CMConstants.color.green,
    height: 80,
    width: 340,
    borderRadius: CMConstants.radius.normal + 4,
    zIndex: 1000,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  teamScore: {
    alignItems: 'center' as const,
    flex: 1,
  },
  teamName: {
    color: CMConstants.color.green,
    fontSize: CMConstants.fontSize.small + 1,
    fontFamily: CMConstants.font.bold,
    marginBottom: 4,
    textAlign: 'center' as const,
    letterSpacing: 0.5,
  },
  scoreText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.largeEx,
    fontFamily: CMConstants.font.bold,
    marginBottom: 4,
    textAlign: 'center' as const,
    letterSpacing: 1,
  },
  foulsText: {
    color: CMConstants.color.semiLightGrey,
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
    textAlign: 'center' as const,
  },
  gameInfo: {
    alignItems: 'center' as const,
    paddingHorizontal: 5,
  },
  timeText: {
    color: CMConstants.color.green,
    fontSize: CMConstants.fontSize.medium,
    fontFamily: CMConstants.font.bold,
    marginBottom: 3,
    textAlign: 'center' as const,
    letterSpacing: 0.5,
  },
  quarterText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.semiBold,
    marginBottom: 4,
    textAlign: 'center' as const,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CMConstants.color.green,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  courtContainer: {
    flex: 1,
    padding: 0,
    paddingBottom: 100, // Leave space for substitute players below the court
    overflow: 'visible' as const, // Allow substitutes to be visible outside
  },
  basketballCourt: {
    flex: 1,
    backgroundColor: CMConstants.color.transparent,
    borderRadius: 0,
    position: 'relative' as const,
    overflow: 'visible' as const, // Allow substitutes to be visible outside
  },
  courtBackgroundImage: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 0,
    width: '100%' as any,
    height: '100%' as any,
    transform: [{ rotate: '90deg' }] as any,
  },
  courtLinesOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CMConstants.radius.normal,
  },
  halfCourtLine: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: '50%' as any,
    width: 3,
    backgroundColor: CMConstants.color.white,
    marginLeft: -1.5,
  },
  freeThrowLineHome: {
    position: 'absolute' as const,
    top: '40%' as any,
    left: '20%' as any,
    right: '20%' as any,
    height: 2,
    backgroundColor: CMConstants.color.white,
  },
  freeThrowLineVisitor: {
    position: 'absolute' as const,
    top: '40%' as any,
    left: '20%' as any,
    right: '20%' as any,
    height: 2,
    backgroundColor: CMConstants.color.white,
  },
  keyAreaHome: {
    position: 'absolute' as const,
    top: '35%' as any,
    left: '25%' as any,
    right: '25%' as any,
    bottom: '25%' as any,
    borderWidth: 2,
    borderColor: CMConstants.color.white,
    backgroundColor: 'transparent',
  },
  keyAreaVisitor: {
    position: 'absolute' as const,
    top: '35%' as any,
    left: '25%' as any,
    right: '25%' as any,
    bottom: '25%' as any,
    borderWidth: 2,
    borderColor: CMConstants.color.white,
    backgroundColor: 'transparent',
  },
  threePointLineHome: {
    position: 'absolute' as const,
    top: '15%' as any,
    left: '15%' as any,
    right: '15%' as any,
    bottom: '15%' as any,
    borderWidth: 2,
    borderColor: CMConstants.color.white,
    borderRadius: 1000,
    borderStyle: 'dashed' as const,
  },
  threePointLineVisitor: {
    position: 'absolute' as const,
    top: '15%' as any,
    left: '15%' as any,
    right: '15%' as any,
    bottom: '15%' as any,
    borderWidth: 2,
    borderColor: CMConstants.color.white,
    borderRadius: 1000,
    borderStyle: 'dashed' as const,
  },

  sideLineTop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: CMConstants.color.white,
  },
  sideLineBottom: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: CMConstants.color.white,
  },
  playerOnCourt: {
    width: 80,
    height: 90,
    backgroundColor: 'transparent',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  selectedPlayerOnCourt: {
    borderWidth: 3,
    borderColor: CMConstants.color.green,
    borderRadius: CMConstants.radius.normal,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  disabledPlayer: {
    opacity: 0.5,
  },
  disabledPlayerText: {
    opacity: 0.7,
  },
  playerJerseyNumber: {
    color: CMConstants.color.black,
    fontSize: CMConstants.fontSize.medium,
    fontFamily: CMConstants.font.bold,
    textAlign: 'center' as const,
  },
  jerseyNumberContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  playerNameOnCourt: {
    position: 'absolute' as const,
    bottom: -30,
    left: 0,
    right: 0,
    textAlign: 'center' as const,
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
    backgroundColor: CMConstants.color.darkGrey2,
    borderRadius: CMConstants.radius.normal,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 1000,
    minWidth: 80,
    borderWidth: 2,
    borderColor: CMConstants.color.green,
    letterSpacing: 0.5,
  },
  jerseyIcon: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%' as any,
    height: '100%' as any,
  },
  jerseyNumberOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  substitutePlayer: {
    width: 18,
    height: 18,
    backgroundColor: 'transparent',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  substituteJerseyIcon: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%' as any,
    height: '100%' as any,
  },
  substituteJerseyNumberOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  substituteJerseyNumber: {
    color: CMConstants.color.black,
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.bold,
    textAlign: 'center' as const,
  },
  substitutePlayerName: {
    position: 'absolute' as const,
    bottom: -18,
    left: 0,
    right: 0,
    textAlign: 'center' as const,
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
    backgroundColor: CMConstants.color.black,
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 1000,
    minWidth: 40,
    borderWidth: 1,
    borderColor: CMConstants.color.white,
  },
  substituteNumbersContainer: {
    position: 'absolute' as const,
    backgroundColor: CMConstants.color.black,
    borderWidth: 1,
    borderColor: CMConstants.color.white,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 1000,
  },
  substituteNumbersText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
    textAlign: 'center' as const,
  },
};

export default CMScoreboardScreen;

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { SafeAreaView, ScrollView, View, Text, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';

import CMNavigationProps from '../navigation/CMNavigationProps';
import CMConstants from '../CMConstants';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMGlobal from '../CMGlobal';
import CMProfileImage from '../components/CMProfileImage';
import CMRipple from '../components/CMRipple';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import CMLoadingDialog from '../dialog/CMLoadingDialog';
import firestore from '@react-native-firebase/firestore';

interface BracketTeam {
  id: string;
  name: string;
  seed: number;
  avatar?: string;
}

interface BracketMatchup {
  id: string;
  round: number;
  position: number;
  teamA?: BracketTeam;
  teamB?: BracketTeam;
}

const CMPlayoffScheduleScreen = ({ navigation, route }: CMNavigationProps) => {
  const league = route.params?.league || {};
  const historySeasonName: string = route.params?.seasonName || '';
  const fromHistory: boolean = route.params?.fromHistory === true;
  const initialBracket: BracketMatchup[] = route.params?.bracket || [];
  const playoffTeams: number = route.params?.playoffTeams || league?.playoffTeams || 4;

  const insets = useSafeAreaInsets();

  const themeMode = CMGlobal.themeMode || CMConstants.themeMode.light;
  const isDarkMode = themeMode === CMConstants.themeMode.dark;
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;

  const [loading, setLoading] = useState(false);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [matchups, setMatchups] = useState<BracketMatchup[]>(initialBracket || []);
  const isGeneratingNextRound = useRef(false);
  const [scheduleById, setScheduleById] = useState<{
    [id: string]: { date?: Date; time?: Date; location?: string };
  }>({});
  const [matchScoreById, setMatchScoreById] = useState<{
    [id: string]: { teamAScore: number; teamBScore: number };
  }>({});
  const [matchStatusById, setMatchStatusById] = useState<{
    [id: string]: string; // Match ID -> status (finished, not_started, etc.)
  }>({});
  const [matchDocIdById, setMatchDocIdById] = useState<{
    [id: string]: string; // Matchup ID -> Firestore match document ID
  }>({});
  const [activePicker, setActivePicker] = useState<{
    matchId: string;
    mode: 'date' | 'time';
    value: Date;
  } | null>(null);
  const [locationEditor, setLocationEditor] = useState<{
    matchId: string;
    value: string;
  } | null>(null);
  const [isSeasonComplete, setIsSeasonComplete] = useState(false);

  const tier = Math.max(2, Math.round(Math.log2(playoffTeams || 4)));

  const roundLabels = useMemo(() => {
    if (playoffTeams >= 16) {
      return ['Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Final'];
    }
    if (playoffTeams >= 8) {
      return ['Quarter-Finals', 'Semi-Finals', 'Final'];
    }
    // Default: 4 teams
    return ['Semi-Finals', 'Final'];
  }, [playoffTeams]);

  const rounds = useMemo(() => {
    const map: { [round: number]: BracketMatchup[] } = {};
    (matchups || []).forEach(m => {
      if (!map[m.round]) {
        map[m.round] = [];
      }
      map[m.round].push(m);
    });
    const orderedRoundNumbers = Object.keys(map)
      .map(n => parseInt(n, 10))
      .sort((a, b) => a - b);
    return orderedRoundNumbers.map(roundNum => map[roundNum]);
  }, [matchups]);

  const currentRoundMatchups: BracketMatchup[] =
    rounds[selectedRoundIndex] || rounds[rounds.length - 1] || [];

  const formatDate = (d?: Date) => {
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (d?: Date) => {
    if (!d) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // Auto-generate next round when all matches in current round are completed
  const checkAndGenerateNextRound = async (
    currentMatchups: BracketMatchup[],
    currentStatuses: { [id: string]: string },
    currentScores: { [id: string]: { teamAScore: number; teamBScore: number } },
  ) => {
    if (!league?.id || !league?.seasonName || initialBracket.length > 0 || fromHistory) {
      return; // Only for "Playoffs in Progress" page
    }

    // Don't generate next round if season is already complete
    if (isSeasonComplete) {
      return;
    }

    // Prevent multiple simultaneous calls
    if (isGeneratingNextRound.current) {
      return;
    }

    isGeneratingNextRound.current = true;

    try {
      // Get all unique rounds, sorted
      const allRounds = Array.from(new Set(currentMatchups.map(m => m.round))).sort((a, b) => a - b);

      for (const round of allRounds) {
      // Get all matchups for this round
      const roundMatchups = currentMatchups.filter(m => m.round === round && m.teamA && m.teamB);

      if (roundMatchups.length === 0) continue;

      // Check if all matches in this round are finished
      const allFinished = roundMatchups.every(matchup => {
        const status = currentStatuses[matchup.id];
        return status === CMConstants.gameStatus.finished;
      });

      if (!allFinished) continue;

      // Check if next round already exists
      const nextRound = round + 1;
      const nextRoundExists = currentMatchups.some(m => m.round === nextRound);

      if (nextRoundExists) continue; // Next round already exists

      // Determine winners from this round
      const winners: BracketTeam[] = [];
      roundMatchups.forEach(matchup => {
        const scores = currentScores[matchup.id] || { teamAScore: 0, teamBScore: 0 };
        const winner = scores.teamAScore > scores.teamBScore ? matchup.teamA : matchup.teamB;
        if (winner) {
          winners.push(winner);
        }
      });

      // Check if this is the final round (only 1 match = 2 teams)
      const isFinalRound = roundMatchups.length === 1;
      
      // If final round is complete, season is done
      if (isFinalRound && allFinished) {
        setIsSeasonComplete(true);
        CMAlertDlgHelper.showAlertWithOK(
          '🎉 Season Complete! The championship has been decided!',
          () => {
            // Reload matches to update UI
      CMFirebaseHelper.getMatches(league.id, (response: { [name: string]: any }) => {
              if (response.isSuccess && Array.isArray(response.value)) {
          const normalizedSeasonName = (historySeasonName || league.seasonName || '').trim().toLowerCase();
                const playoffMatches = (response.value as any[]).filter(m => {
                  const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
                  const isPlayoff = !!m.isPlayoff;
                  return isPlayoff && matchSeasonName === normalizedSeasonName;
                });

                if (playoffMatches.length > 0) {
                  const loadedMatchups: BracketMatchup[] = [];
                  const loadedSchedule: { [id: string]: { date?: Date; time?: Date; location?: string } } = {};
                  const loadedStatuses: { [id: string]: string } = {};
                  const loadedScores: { [id: string]: { teamAScore: number; teamBScore: number } } = {};
                  const loadedMatchDocIds: { [id: string]: string } = {};

                  playoffMatches.forEach(match => {
                    const matchupId = match.playoffMatchupId || `round${match.playoffRound || 1}-${match.playoffPosition || 0}`;
                    const matchDateTime = match.dateTime?.toDate ? match.dateTime.toDate() : new Date();
                    
                    const matchDate = new Date(matchDateTime);
                    matchDate.setHours(0, 0, 0, 0);
                    const matchTime = new Date(matchDateTime);
                    matchTime.setFullYear(1970, 0, 1);

                    loadedSchedule[matchupId] = {
                      date: matchDate,
                      time: matchTime,
                      location: match.location || '',
                    };

                    loadedStatuses[matchupId] = match.status || CMConstants.gameStatus.notStarted;
                    loadedScores[matchupId] = {
                      teamAScore: typeof match.teamAScore === 'number' ? match.teamAScore : 0,
                      teamBScore: typeof match.teamBScore === 'number' ? match.teamBScore : 0,
                    };
                    
                    if (match.id) {
                      loadedMatchDocIds[matchupId] = match.id;
                    }

                    let matchup = loadedMatchups.find(
                      m => m.round === (match.playoffRound || 1) && m.position === (match.playoffPosition || 0)
                    );

                    if (!matchup) {
                      matchup = {
                        id: matchupId,
                        round: match.playoffRound || 1,
                        position: match.playoffPosition || 0,
                      };
                      loadedMatchups.push(matchup);
                    } else {
                      matchup.id = matchupId;
                    }

                    if (match.teamAId && match.teamAName) {
                      matchup.teamA = {
                        id: match.teamAId,
                        name: match.teamAName,
                        seed: match.teamASeed || 1,
                        avatar: match.teamAAvatar || '',
                      };
                    }
                    if (match.teamBId && match.teamBName) {
                      matchup.teamB = {
                        id: match.teamBId,
                        name: match.teamBName,
                        seed: match.teamBSeed || 1,
                        avatar: match.teamBAvatar || '',
                      };
                    }
                  });

                  loadedMatchups.sort((a, b) => {
                    if (a.round !== b.round) return a.round - b.round;
                    return a.position - b.position;
                  });

                  setMatchups(loadedMatchups);
                  setScheduleById(loadedSchedule);
                  setMatchStatusById(loadedStatuses);
                  setMatchScoreById(loadedScores);
                  setMatchDocIdById(loadedMatchDocIds);
                }
              }
            });
          },
        );
        isGeneratingNextRound.current = false;
        return;
      }

      // If we have winners and need to generate next round
      if (winners.length >= 2 && winners.length % 2 === 0) {
        // Generate next round matchups: 1st vs 2nd, 3rd vs 4th, etc.
        const nextRoundMatchups: BracketMatchup[] = [];
        const numMatches = winners.length / 2;

        for (let i = 0; i < numMatches; i++) {
          const teamA = winners[i * 2];
          const teamB = winners[i * 2 + 1];

          if (teamA && teamB) {
            const matchupId = `round${nextRound}-${i}`;
            nextRoundMatchups.push({
              id: matchupId,
              round: nextRound,
              position: i,
              teamA: teamA,
              teamB: teamB,
            });
          }
        }

        // Create match documents for next round
        const matchPromises = nextRoundMatchups.map(matchup => {
          const matchId = CMFirebaseHelper.getNewDocumentId('matches');
          const matchDateTime = new Date(); // Default to now, user can edit
          matchDateTime.setHours(18, 0, 0, 0); // Default to 6 PM

          const match = {
            id: matchId,
            leagueId: league.id,
            teamAId: matchup.teamA!.id,
            teamBId: matchup.teamB!.id,
            teamAName: matchup.teamA!.name,
            teamBName: matchup.teamB!.name,
            teamAAvatar: matchup.teamA!.avatar || '',
            teamBAvatar: matchup.teamB!.avatar || '',
            teamASeed: matchup.teamA!.seed,
            teamBSeed: matchup.teamB!.seed,
            name: `${matchup.teamA!.name} vs ${matchup.teamB!.name}`,
            dateTime: firestore.Timestamp.fromDate(matchDateTime),
            location: '',
            status: CMConstants.gameStatus.notStarted,
            teamAScore: 0,
            teamBScore: 0,
            seasonName: league.seasonName,
            isPlayoff: true,
            playoffRound: matchup.round,
            playoffPosition: matchup.position,
            playoffMatchupId: matchup.id,
          };

          return new Promise<void>(resolve => {
            CMFirebaseHelper.setMatch(matchId, match, (response: { [name: string]: any }) => {
              resolve();
            });
          });
        });

        await Promise.all(matchPromises);

        // Get round label name for alert
        let roundLabel = '';
        if (round === 1) {
          if (playoffTeams >= 16) {
            roundLabel = 'Round of 16';
          } else if (playoffTeams >= 8) {
            roundLabel = 'Quarter-Finals';
          } else {
            roundLabel = 'Semi-Finals';
          }
        } else if (round === 2) {
          if (playoffTeams >= 16) {
            roundLabel = 'Quarter-Finals';
          } else if (playoffTeams >= 8) {
            roundLabel = 'Semi-Finals';
          } else {
            roundLabel = 'Final';
          }
        } else if (round === 3) {
          if (playoffTeams >= 16) {
            roundLabel = 'Semi-Finals';
          } else {
            roundLabel = 'Final';
          }
        } else {
          roundLabel = 'Final';
        }

        // Show alert that stage is completed
        CMAlertDlgHelper.showAlertWithOK(
          `Stage ${round} (${roundLabel}) completed! You can now proceed to the next stage.`,
          () => {
            // Reload matches to show the new round after alert is dismissed
            CMFirebaseHelper.getMatches(league.id, (response: { [name: string]: any }) => {
              if (response.isSuccess && Array.isArray(response.value)) {
                const normalizedSeasonName = (historySeasonName || league.seasonName || '').trim().toLowerCase();
                const playoffMatches = (response.value as any[]).filter(m => {
                  const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
                  const isPlayoff = !!m.isPlayoff;
                  return isPlayoff && matchSeasonName === normalizedSeasonName;
                });

                if (playoffMatches.length > 0) {
                  const loadedMatchups: BracketMatchup[] = [];
                  const loadedSchedule: { [id: string]: { date?: Date; time?: Date; location?: string } } = {};
                  const loadedStatuses: { [id: string]: string } = {};
                  const loadedScores: { [id: string]: { teamAScore: number; teamBScore: number } } = {};
                  const loadedMatchDocIds: { [id: string]: string } = {};

                  playoffMatches.forEach(match => {
                    const matchupId = match.playoffMatchupId || `round${match.playoffRound || 1}-${match.playoffPosition || 0}`;
                    const matchDateTime = match.dateTime?.toDate ? match.dateTime.toDate() : new Date();
                    
                    const matchDate = new Date(matchDateTime);
                    matchDate.setHours(0, 0, 0, 0);
                    const matchTime = new Date(matchDateTime);
                    matchTime.setFullYear(1970, 0, 1);

                    loadedSchedule[matchupId] = {
                      date: matchDate,
                      time: matchTime,
                      location: match.location || '',
                    };

                    loadedStatuses[matchupId] = match.status || CMConstants.gameStatus.notStarted;
                    loadedScores[matchupId] = {
                      teamAScore: typeof match.teamAScore === 'number' ? match.teamAScore : 0,
                      teamBScore: typeof match.teamBScore === 'number' ? match.teamBScore : 0,
                    };
                    
                    if (match.id) {
                      loadedMatchDocIds[matchupId] = match.id;
                    }

                    let matchup = loadedMatchups.find(
                      m => m.round === (match.playoffRound || 1) && m.position === (match.playoffPosition || 0)
                    );

                    if (!matchup) {
                      matchup = {
                        id: matchupId,
                        round: match.playoffRound || 1,
                        position: match.playoffPosition || 0,
                      };
                      loadedMatchups.push(matchup);
                    } else {
                      matchup.id = matchupId;
                    }

                    if (match.teamAId && match.teamAName) {
                      matchup.teamA = {
                        id: match.teamAId,
                        name: match.teamAName,
                        seed: match.teamASeed || 1,
                        avatar: match.teamAAvatar || '',
                      };
                    }
                    if (match.teamBId && match.teamBName) {
                      matchup.teamB = {
                        id: match.teamBId,
                        name: match.teamBName,
                        seed: match.teamBSeed || 1,
                        avatar: match.teamBAvatar || '',
                      };
                    }
                  });

                  loadedMatchups.sort((a, b) => {
                    if (a.round !== b.round) return a.round - b.round;
                    return a.position - b.position;
                  });

                  setMatchups(loadedMatchups);
                  setScheduleById(loadedSchedule);
                  setMatchStatusById(loadedStatuses);
                  setMatchScoreById(loadedScores);
                  setMatchDocIdById(loadedMatchDocIds);
                }
              }
            });
          });
        }
        break; // Only generate one round at a time
      }
    } catch (error) {
      console.error('Error generating next round:', error);
      CMAlertDlgHelper.showAlertWithOK('Failed to generate next round. Please try again.');
    } finally {
      isGeneratingNextRound.current = false;
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: league?.name || 'Schedule Playoffs',
      headerTitleStyle: {
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold' as const,
      },
    });
  }, [navigation, league]);

  // Initialize match statuses for initial bracket (all not_started)
  useEffect(() => {
    if (initialBracket.length > 0 && Object.keys(matchStatusById).length === 0) {
      const initialStatuses: { [id: string]: string } = {};
      initialBracket.forEach(matchup => {
        if (matchup.id) {
          initialStatuses[matchup.id] = CMConstants.gameStatus.notStarted;
        }
      });
      setMatchStatusById(initialStatuses);
    }
  }, [initialBracket]);

  // Reload matches when screen comes into focus (to update statuses after editing)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (league?.id && league?.seasonName && initialBracket.length === 0) {
        setLoading(true);
        CMFirebaseHelper.getMatches(league.id, (response: { [name: string]: any }) => {
          setLoading(false);
          if (response.isSuccess && Array.isArray(response.value)) {
            const normalizedSeasonName = (league.seasonName || '').trim().toLowerCase();
            const playoffMatches = (response.value as any[]).filter(m => {
              const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
              const isPlayoff = !!m.isPlayoff;
              return isPlayoff && matchSeasonName === normalizedSeasonName;
            });

            if (playoffMatches.length > 0) {
              const loadedMatchups: BracketMatchup[] = [];
              const loadedSchedule: { [id: string]: { date?: Date; time?: Date; location?: string } } = {};
              const loadedStatuses: { [id: string]: string } = {};
              const loadedScores: { [id: string]: { teamAScore: number; teamBScore: number } } = {};
              const loadedMatchDocIds: { [id: string]: string } = {};

              playoffMatches.forEach(match => {
                const matchupId = match.playoffMatchupId || `round${match.playoffRound || 1}-${match.playoffPosition || 0}`;
                const matchDateTime = match.dateTime?.toDate ? match.dateTime.toDate() : new Date();
                
                const matchDate = new Date(matchDateTime);
                matchDate.setHours(0, 0, 0, 0);
                const matchTime = new Date(matchDateTime);
                matchTime.setFullYear(1970, 0, 1);

                loadedSchedule[matchupId] = {
                  date: matchDate,
                  time: matchTime,
                  location: match.location || '',
                };

                loadedStatuses[matchupId] = match.status || CMConstants.gameStatus.notStarted;
                loadedScores[matchupId] = {
                  teamAScore: typeof match.teamAScore === 'number' ? match.teamAScore : 0,
                  teamBScore: typeof match.teamBScore === 'number' ? match.teamBScore : 0,
                };
                
                // Store match document ID
                if (match.id) {
                  loadedMatchDocIds[matchupId] = match.id;
                }

                let matchup = loadedMatchups.find(
                  m => m.round === (match.playoffRound || 1) && m.position === (match.playoffPosition || 0)
                );

                if (!matchup) {
                  matchup = {
                    id: matchupId,
                    round: match.playoffRound || 1,
                    position: match.playoffPosition || 0,
                  };
                  loadedMatchups.push(matchup);
                } else {
                  matchup.id = matchupId;
                }

                if (match.teamAId && match.teamAName) {
                  matchup.teamA = {
                    id: match.teamAId,
                    name: match.teamAName,
                    seed: match.teamASeed || 1,
                    avatar: match.teamAAvatar || '',
                  };
                }
                if (match.teamBId && match.teamBName) {
                  matchup.teamB = {
                    id: match.teamBId,
                    name: match.teamBName,
                    seed: match.teamBSeed || 1,
                    avatar: match.teamBAvatar || '',
                  };
                }
              });

              loadedMatchups.sort((a, b) => {
                if (a.round !== b.round) return a.round - b.round;
                return a.position - b.position;
              });

              setMatchups(loadedMatchups);
              setScheduleById(loadedSchedule);
              setMatchStatusById(loadedStatuses);
              setMatchScoreById(loadedScores);
              setMatchDocIdById(loadedMatchDocIds);

              // Check if season is complete (final round with 1 match is finished)
              const allRounds = Array.from(new Set(loadedMatchups.map(m => m.round))).sort((a, b) => b - a);
              const finalRound = allRounds[0]; // Highest round number
              let seasonIsComplete = false;
              if (finalRound !== undefined) {
                const finalRoundMatchups = loadedMatchups.filter(m => m.round === finalRound && m.teamA && m.teamB);
                // Final round has only 1 match (2 teams)
                if (finalRoundMatchups.length === 1) {
                  const finalMatchup = finalRoundMatchups[0];
                  const finalStatus = loadedStatuses[finalMatchup.id];
                  if (finalStatus === CMConstants.gameStatus.finished) {
                    seasonIsComplete = true;
                    setIsSeasonComplete(true);
                  }
                }
              }

              // Only check if next round needs to be generated if season is not complete
              if (!seasonIsComplete) {
                checkAndGenerateNextRound(loadedMatchups, loadedStatuses, loadedScores);
              }
            }
          }
        });
      }
    });
    return unsubscribe;
  }, [navigation, league?.id, league?.seasonName, initialBracket.length]);

  // Load existing playoff matches when opening from "Playoffs in Progress"
  useEffect(() => {
    // Only load if we don't have an initial bracket (coming from "Playoffs in Progress" or history)
    if (initialBracket.length === 0 && league?.id && (league?.seasonName || historySeasonName)) {
      setLoading(true);
      CMFirebaseHelper.getMatches(league.id, (response: { [name: string]: any }) => {
        setLoading(false);
        if (response.isSuccess && Array.isArray(response.value)) {
          const normalizedSeasonName = (historySeasonName || league.seasonName || '').trim().toLowerCase();
          
          // Filter playoff matches for this season
          const playoffMatches = (response.value as any[]).filter(m => {
            const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
            const isPlayoff = !!m.isPlayoff;
            return isPlayoff && matchSeasonName === normalizedSeasonName;
          });

          if (playoffMatches.length > 0) {
            // Convert matches to BracketMatchup format
            const loadedMatchups: BracketMatchup[] = [];
            const loadedSchedule: { [id: string]: { date?: Date; time?: Date; location?: string } } = {};
            const loadedStatuses: { [id: string]: string } = {};
            const loadedScores: { [id: string]: { teamAScore: number; teamBScore: number } } = {};
            const loadedMatchDocIds: { [id: string]: string } = {};

            playoffMatches.forEach(match => {
              // Use stored playoffMatchupId if available, otherwise reconstruct from round/position
              const matchupId = match.playoffMatchupId || `round${match.playoffRound || 1}-${match.playoffPosition || 0}`;
              const matchDateTime = match.dateTime?.toDate ? match.dateTime.toDate() : new Date();
              
              // Extract date and time separately
              const matchDate = new Date(matchDateTime);
              matchDate.setHours(0, 0, 0, 0);
              const matchTime = new Date(matchDateTime);
              matchTime.setFullYear(1970, 0, 1); // Keep only time portion

              loadedSchedule[matchupId] = {
                date: matchDate,
                time: matchTime,
                location: match.location || '',
              };

              // Store match status
              loadedStatuses[matchupId] = match.status || CMConstants.gameStatus.notStarted;
              loadedScores[matchupId] = {
                teamAScore: typeof match.teamAScore === 'number' ? match.teamAScore : 0,
                teamBScore: typeof match.teamBScore === 'number' ? match.teamBScore : 0,
              };
              
              // Store match document ID
              if (match.id) {
                loadedMatchDocIds[matchupId] = match.id;
              }

              // Find or create matchup for this round/position
              let matchup = loadedMatchups.find(
                m => m.round === (match.playoffRound || 1) && m.position === (match.playoffPosition || 0)
              );

              if (!matchup) {
                matchup = {
                  id: matchupId,
                  round: match.playoffRound || 1,
                  position: match.playoffPosition || 0,
                };
                loadedMatchups.push(matchup);
              } else {
                // Ensure the matchup ID matches what we stored
                matchup.id = matchupId;
              }

              // Set teams if available
              if (match.teamAId && match.teamAName) {
                matchup.teamA = {
                  id: match.teamAId,
                  name: match.teamAName,
                  seed: match.teamASeed || 1,
                  avatar: match.teamAAvatar || '',
                };
              }
              if (match.teamBId && match.teamBName) {
                matchup.teamB = {
                  id: match.teamBId,
                  name: match.teamBName,
                  seed: match.teamBSeed || 1,
                  avatar: match.teamBAvatar || '',
                };
              }
            });

            // Sort matchups by round, then by position
            loadedMatchups.sort((a, b) => {
              if (a.round !== b.round) return a.round - b.round;
              return a.position - b.position;
            });

            setMatchups(loadedMatchups);
            setScheduleById(loadedSchedule);
            setMatchStatusById(loadedStatuses);
            setMatchScoreById(loadedScores);
            setMatchDocIdById(loadedMatchDocIds);

            // Set selected round to first round (round 1) - always show Tier 1 (first round)
            // Round 1 maps to index 0 in roundLabels regardless of playoffTeams
            setSelectedRoundIndex(0);

            // Check if season is complete (final round with 1 match is finished)
            const allRounds = Array.from(new Set(loadedMatchups.map(m => m.round))).sort((a, b) => b - a);
            const finalRound = allRounds[0]; // Highest round number
            let seasonIsComplete = false;
            if (finalRound !== undefined) {
              const finalRoundMatchups = loadedMatchups.filter(m => m.round === finalRound && m.teamA && m.teamB);
              // Final round has only 1 match (2 teams)
              if (finalRoundMatchups.length === 1) {
                const finalMatchup = finalRoundMatchups[0];
                const finalStatus = loadedStatuses[finalMatchup.id];
                if (finalStatus === CMConstants.gameStatus.finished) {
                  seasonIsComplete = true;
                  setIsSeasonComplete(true);
                }
              }
            }

            // Only check if next round needs to be generated if season is not complete
            if (!seasonIsComplete) {
              checkAndGenerateNextRound(loadedMatchups, loadedStatuses, loadedScores);
            }
          }
        }
      });
    }
  }, [league?.id, league?.seasonName, league?.playoffsStarted, initialBracket.length]);

  // Check if a round is unlocked (all previous rounds completed)
  const isRoundUnlocked = (roundIndex: number): boolean => {
    if (roundIndex === 0) return true; // First round is always unlocked
    
    // If season is complete, allow navigation to all tabs (especially final tab)
    if (isSeasonComplete) {
      return true;
    }
    
    // Check all previous rounds (rounds array is already sorted by round number)
    for (let prevIndex = 0; prevIndex < roundIndex; prevIndex++) {
      const prevRoundMatchups = rounds[prevIndex] || [];
      
      // Filter to only matchups with both teams
      const validMatchups = prevRoundMatchups.filter(m => m.teamA && m.teamB);
      
      // If there are no valid matchups in previous round, it's not unlocked
      if (validMatchups.length === 0) {
        return false;
      }
      
      // Check if all matches in previous round are completed
      const allCompleted = validMatchups.every(matchup => {
        const status = matchStatusById[matchup.id];
        return status === CMConstants.gameStatus.finished;
      });
      
      if (!allCompleted) {
        return false;
      }
    }
    
    return true;
  };

  const handleRoundTabPress = (index: number) => {
    if (isRoundUnlocked(index)) {
      setSelectedRoundIndex(index);
    } else {
      CMAlertDlgHelper.showAlertWithOK('The previous stage of the game must be completed.');
    }
  };

  const renderRoundTabs = () => {
    if (roundLabels.length <= 1) {
      return null;
    }

    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: CMConstants.space.normal,
          borderBottomWidth: 1,
          borderBottomColor: cardBorderColor,
        }}
      >
        {roundLabels.map((label, index) => {
          const isActive = index === selectedRoundIndex;
          const isUnlocked = isRoundUnlocked(index);
          return (
            <CMRipple
              key={label}
              containerStyle={{
                flex: 1,
                paddingVertical: CMConstants.space.smallEx,
                alignItems: 'center',
                opacity: isUnlocked ? 1 : 0.5,
              }}
              onPress={() => handleRoundTabPress(index)}
            >
              <Text
                style={{
                  color: isActive ? CMConstants.color.green : labelColor,
                  fontSize: 13,
                  fontWeight: isActive ? '600' : '500',
                }}
              >
                {label}
              </Text>
              {isActive && (
                <View
                  style={{
                    marginTop: CMConstants.space.smallEx / 2,
                    height: 2,
                    width: '60%',
                    backgroundColor: CMConstants.color.green,
                    borderRadius: 2,
                  }}
                />
              )}
            </CMRipple>
          );
        })}
      </View>
    );
  };

  const renderMatchCard = (matchup: BracketMatchup) => {
    const { teamA, teamB } = matchup;
    if (!teamA || !teamB) {
      return null;
    }

    const schedule = scheduleById[matchup.id] || {};
    const dateLabel = schedule.date ? formatDate(schedule.date) : 'Set Date';
    const timeLabel = schedule.time ? formatTime(schedule.time) : 'Set Time';
    const locationLabel = schedule.location || 'Set Location';
    const score = matchScoreById[matchup.id];
    const teamAScore = score?.teamAScore ?? 0;
    const teamBScore = score?.teamBScore ?? 0;
    const status = matchStatusById[matchup.id] || CMConstants.gameStatus.notStarted;
    const isFinished = status === CMConstants.gameStatus.finished;
    const matchDocId = matchDocIdById[matchup.id];

    const handleMatchCardPress = () => {
      // Only navigate if match document exists (match has been saved)
      if (matchDocId && league?.id) {
        // Load the match document and navigate to edit match screen
        CMFirebaseHelper.getMatch(matchDocId, (response: { [name: string]: any }) => {
          if (response.isSuccess && response.value) {
            navigation.navigate(CMConstants.screenName.editMatch, {
              match: response.value,
              league: league,
              isEdit: true,
              seasonName: league?.seasonName || '',
            });
          }
        });
      }
    };

    // Only make the card clickable when viewing from "Playoffs in Progress" (when match is saved)
    // When creating initial schedule, only the date/time/location buttons should be tappable
    const shouldCardBeClickable = initialBracket.length === 0 && matchDocId;

    // Teams row component (can be clickable or not)
    const teamsRow = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: CMConstants.space.smallEx,
        }}
      >
          {/* Team A: logo + name */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flex: 0.45,
              minWidth: 0,
            }}
          >
            <CMProfileImage radius={24} imgURL={teamA.avatar || ''} style={{ marginRight: 8 }} />
            <Text
              style={{ color: textColor, fontSize: 14, fontWeight: '600', flexShrink: 1 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {teamA.name}
            </Text>
          </View>

          {/* VS */}
          <View
            style={{
              flex: 0.1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: CMConstants.color.green,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              VS
            </Text>
          </View>

          {/* Team B: logo + name */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flex: 0.45,
              minWidth: 0,
            }}
          >
            <CMProfileImage radius={22} imgURL={teamB.avatar || ''} style={{ marginRight: 8 }} />
            <Text
              style={{ color: textColor, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {teamB.name}
            </Text>
          </View>
        </View>
    );

    const cardContent = (
      <>
        {/* Teams row - clickable only when viewing saved matches */}
        {shouldCardBeClickable ? (
          <CMRipple
            containerStyle={{
              marginBottom: CMConstants.space.smallEx,
            }}
            onPress={handleMatchCardPress}
          >
            {teamsRow}
          </CMRipple>
        ) : (
          teamsRow
        )}

        {/* Score & Status row - Only show on "Playoffs in Progress" page (not initial schedule) */}
        {initialBracket.length === 0 && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: CMConstants.space.smallEx,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: CMConstants.space.smallEx / 2,
                paddingHorizontal: CMConstants.space.smallEx,
                backgroundColor: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey,
                borderRadius: CMConstants.radius.smallEx,
                borderWidth: 1,
                borderColor: isFinished ? CMConstants.color.green : cardBorderColor,
              }}
            >
              <Text style={{ color: labelColor, fontSize: 11, marginRight: CMConstants.space.smallEx / 2 }}>
                Score:
              </Text>
              <Text
                style={{
                  color: textColor,
                  fontSize: 14,
                  fontWeight: '700',
                  letterSpacing: 1,
                }}
              >
                {teamAScore} : {teamBScore}
              </Text>
            </View>
            <Text
              style={{
                color: isFinished ? CMConstants.color.green : labelColor,
                fontSize: 12,
              }}
            >
              {isFinished ? 'Status: Played' : 'Status: Not played yet'}
            </Text>
          </View>
        )}

        {/* Date row */}
        <CMRipple
          containerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: CMConstants.space.smallEx / 2,
            borderTopWidth: 1,
            borderColor: cardBorderColor,
            marginHorizontal: -CMConstants.space.small,
            paddingHorizontal: CMConstants.space.small,
          }}
          onPress={(e?: any) => {
            // Stop event propagation to prevent parent card from being clicked
            if (e && e.stopPropagation) {
              e.stopPropagation();
            }
            const baseDate = schedule.date || new Date();
            setActivePicker({ matchId: matchup.id, mode: 'date', value: baseDate });
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={CMConstants.color.green}
            style={{ marginRight: CMConstants.space.smallEx }}
          />
          <Text style={{ color: labelColor, fontSize: 12, flex: 1 }}>Date</Text>
          <Text style={{ color: labelColor, fontSize: 12, marginRight: CMConstants.space.smallEx }}>
            {dateLabel}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={labelColor} />
        </CMRipple>

        {/* Time row */}
        <CMRipple
          containerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: CMConstants.space.smallEx / 2,
            borderTopWidth: 1,
            borderColor: cardBorderColor,
            marginHorizontal: -CMConstants.space.small,
            paddingHorizontal: CMConstants.space.small,
          }}
          onPress={(e?: any) => {
            // Stop event propagation to prevent parent card from being clicked
            if (e && e.stopPropagation) {
              e.stopPropagation();
            }
            const baseTime = schedule.time || new Date();
            setActivePicker({ matchId: matchup.id, mode: 'time', value: baseTime });
          }}
        >
          <Ionicons
            name="time-outline"
            size={18}
            color={CMConstants.color.green}
            style={{ marginRight: CMConstants.space.smallEx }}
          />
          <Text style={{ color: labelColor, fontSize: 12, flex: 1 }}>Time</Text>
          <Text style={{ color: labelColor, fontSize: 12, marginRight: CMConstants.space.smallEx }}>
            {timeLabel}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={labelColor} />
        </CMRipple>

        {/* Location row */}
        <CMRipple
          containerStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: CMConstants.space.smallEx / 2,
            borderTopWidth: 1,
            borderColor: cardBorderColor,
            marginHorizontal: -CMConstants.space.small,
            paddingHorizontal: CMConstants.space.small,
          }}
          onPress={(e?: any) => {
            // Stop event propagation to prevent parent card from being clicked
            if (e && e.stopPropagation) {
              e.stopPropagation();
            }
            setLocationEditor({
              matchId: matchup.id,
              value: schedule.location || '',
            });
          }}
        >
          <Ionicons
            name="location-outline"
            size={18}
            color={CMConstants.color.green}
            style={{ marginRight: CMConstants.space.smallEx }}
          />
          <Text style={{ color: labelColor, fontSize: 12, flex: 1 }}>Location</Text>
          <Text
            style={{ color: labelColor, fontSize: 12, marginRight: CMConstants.space.smallEx, maxWidth: '50%' }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {locationLabel}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={labelColor} />
        </CMRipple>
      </>
    );

    // Return card - buttons always work, teams area clickable only when viewing saved matches
    return (
      <View
        key={matchup.id}
        style={{
          backgroundColor: cardBackgroundColor,
          borderColor: cardBorderColor,
          borderWidth: 1,
          borderRadius: CMConstants.radius.normal,
          padding: CMConstants.space.small,
          marginTop: CMConstants.space.normal,
        }}
      >
        {cardContent}
      </View>
    );
  };

  const handleSaveSchedule = async () => {
    if (!league?.id || !league?.seasonName) {
      CMAlertDlgHelper.showAlertWithOK('League or season information is missing.');
      return;
    }

    // Only save matchups that actually have two teams (ignore future TBD rounds)
    const matchupsToSave = (matchups || []).filter(m => m.teamA && m.teamB);
    if (matchupsToSave.length === 0) {
      CMAlertDlgHelper.showAlertWithOK('No playoff matchups to save.');
      return;
    }

    // Validate that all matchups have date, time, and location
    const incompleteMatchups: string[] = [];
    matchupsToSave.forEach(matchup => {
      const schedule = scheduleById[matchup.id] || {};
      const missingFields: string[] = [];
      
      if (!schedule.date) {
        missingFields.push('date');
      }
      if (!schedule.time) {
        missingFields.push('time');
      }
      if (!schedule.location || schedule.location.trim() === '') {
        missingFields.push('location');
      }
      
      if (missingFields.length > 0) {
        const matchupName = `${matchup.teamA?.name || 'Team A'} vs ${matchup.teamB?.name || 'Team B'}`;
        incompleteMatchups.push(`${matchupName} (missing: ${missingFields.join(', ')})`);
      }
    });

    if (incompleteMatchups.length > 0) {
      const errorMessage = `Please complete all match details:\n\n${incompleteMatchups.join('\n')}`;
      CMAlertDlgHelper.showAlertWithOK(errorMessage);
      return;
    }

    setLoading(true);
    try {
      const normalizedSeasonName = (league.seasonName || '').trim().toLowerCase();

      // First, remove any existing playoff matches for this league + season
      await new Promise<void>(resolve => {
        CMFirebaseHelper.getMatches(league.id, async (response: { [name: string]: any }) => {
          if (response.isSuccess && Array.isArray(response.value)) {
            const existingPlayoffMatches = (response.value as any[]).filter(m => {
              const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
              const isPlayoff = !!m.isPlayoff;
              return isPlayoff && matchSeasonName === normalizedSeasonName;
            });

            if (existingPlayoffMatches.length > 0) {
              await Promise.all(
                existingPlayoffMatches.map(
                  m =>
                    new Promise<void>(deleteResolve => {
                      if (!m.id) {
                        deleteResolve();
                        return;
                      }
                      CMFirebaseHelper.deleteMatch(m.id, () => {
                        deleteResolve();
                      });
                    }),
                ),
              );
            }
          }
          resolve();
        });
      });

      // Then, create new playoff matches from current schedule
      const createPromises = matchupsToSave.map(matchup => {
        const schedule = scheduleById[matchup.id] || {};

        // Combine separate date + time into a single Date
        const baseDate = schedule.date || new Date();
        const baseTime = schedule.time || baseDate;
        const matchDateTime = new Date(baseDate);
        matchDateTime.setHours(baseTime.getHours(), baseTime.getMinutes(), 0, 0);

        const matchId = CMFirebaseHelper.getNewDocumentId('matches');
        const match = {
          id: matchId,
          leagueId: league.id,
          teamAId: matchup.teamA!.id,
          teamBId: matchup.teamB!.id,
          teamAName: matchup.teamA!.name,
          teamBName: matchup.teamB!.name,
          teamAAvatar: matchup.teamA!.avatar || '',
          teamBAvatar: matchup.teamB!.avatar || '',
          teamASeed: matchup.teamA!.seed,
          teamBSeed: matchup.teamB!.seed,
          name: `${matchup.teamA!.name} vs ${matchup.teamB!.name}`,
          dateTime: firestore.Timestamp.fromDate(matchDateTime),
          location: schedule.location || '',
          status: CMConstants.gameStatus.notStarted,
          teamAScore: 0,
          teamBScore: 0,
          seasonName: league.seasonName,
          isPlayoff: true,
          playoffRound: matchup.round,
          playoffPosition: matchup.position,
          playoffMatchupId: matchup.id, // Store the matchup ID so we can match it when loading
        };

        return new Promise(resolve => {
          CMFirebaseHelper.setMatch(matchId, match, (response: { [name: string]: any }) => {
            resolve(response);
          });
        });
      });

      await Promise.all(createPromises);

      // Ensure league is marked as having playoffs started
      if (!league.playoffsStarted && league.id) {
        await new Promise<void>(resolve => {
          CMFirebaseHelper.updateLeague(
            league.id,
            { playoffsStarted: true },
            () => {
              resolve();
            },
          );
        });
      }

      // Reload matches to show them immediately
      if (league.id && league.seasonName) {
        const normalizedSeasonName = (league.seasonName || '').trim().toLowerCase();
        CMFirebaseHelper.getMatches(league.id, (response: { [name: string]: any }) => {
          if (response.isSuccess && Array.isArray(response.value)) {
            const playoffMatches = (response.value as any[]).filter(m => {
              const matchSeasonName = (m.seasonName || '').trim().toLowerCase();
              const isPlayoff = !!m.isPlayoff;
              return isPlayoff && matchSeasonName === normalizedSeasonName;
            });

            if (playoffMatches.length > 0) {
              // Convert matches to BracketMatchup format (same logic as in useEffect)
              const loadedMatchups: BracketMatchup[] = [];
              const loadedSchedule: { [id: string]: { date?: Date; time?: Date; location?: string } } = {};
              const loadedStatuses: { [id: string]: string } = {};
              const loadedScores: { [id: string]: { teamAScore: number; teamBScore: number } } = {};
              const loadedMatchDocIds: { [id: string]: string } = {};

              playoffMatches.forEach(match => {
                const matchupId = match.playoffMatchupId || `round${match.playoffRound || 1}-${match.playoffPosition || 0}`;
                const matchDateTime = match.dateTime?.toDate ? match.dateTime.toDate() : new Date();
                
                const matchDate = new Date(matchDateTime);
                matchDate.setHours(0, 0, 0, 0);
                const matchTime = new Date(matchDateTime);
                matchTime.setFullYear(1970, 0, 1);

                loadedSchedule[matchupId] = {
                  date: matchDate,
                  time: matchTime,
                  location: match.location || '',
                };

                // Store match status
                loadedStatuses[matchupId] = match.status || CMConstants.gameStatus.notStarted;
                loadedScores[matchupId] = {
                  teamAScore: typeof match.teamAScore === 'number' ? match.teamAScore : 0,
                  teamBScore: typeof match.teamBScore === 'number' ? match.teamBScore : 0,
                };
                
                // Store match document ID
                if (match.id) {
                  loadedMatchDocIds[matchupId] = match.id;
                }

                let matchup = loadedMatchups.find(
                  m => m.round === (match.playoffRound || 1) && m.position === (match.playoffPosition || 0)
                );

                if (!matchup) {
                  matchup = {
                    id: matchupId,
                    round: match.playoffRound || 1,
                    position: match.playoffPosition || 0,
                  };
                  loadedMatchups.push(matchup);
                } else {
                  matchup.id = matchupId;
                }

                if (match.teamAId && match.teamAName) {
                  matchup.teamA = {
                    id: match.teamAId,
                    name: match.teamAName,
                    seed: match.teamASeed || 1,
                    avatar: match.teamAAvatar || '',
                  };
                }
                if (match.teamBId && match.teamBName) {
                  matchup.teamB = {
                    id: match.teamBId,
                    name: match.teamBName,
                    seed: match.teamBSeed || 1,
                    avatar: match.teamBAvatar || '',
                  };
                }
              });

              loadedMatchups.sort((a, b) => {
                if (a.round !== b.round) return a.round - b.round;
                return a.position - b.position;
              });

              setMatchups(loadedMatchups);
              setScheduleById(loadedSchedule);
              setMatchStatusById(loadedStatuses);
              setMatchScoreById(loadedScores);
              setMatchDocIdById(loadedMatchDocIds);
            }
          }
        });
      }

      setLoading(false);
      CMAlertDlgHelper.showAlertWithOK('Playoff schedule has been saved.', () => {
        // Navigate to standings page after alert is dismissed
        if (league?.id) {
          navigation.navigate(CMConstants.screenName.leagueDetails, {
            league: league,
          });
        }
      });
    } catch (e) {
      setLoading(false);
      CMAlertDlgHelper.showAlertWithOK('Failed to save playoff schedule. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor }]}>
      <CMLoadingDialog visible={loading} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + CMConstants.space.normal }}
      >
        {/* Header section */}
        <View
          style={{
            paddingTop: CMConstants.space.normal,
            paddingHorizontal: CMConstants.space.normal,
            alignItems: 'flex-start',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CMProfileImage
              radius={38}
              imgURL={league?.avatar}
              style={{
                marginRight: CMConstants.space.smallEx,
                borderWidth: 2,
                borderColor: CMConstants.color.green,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: textColor,
                  fontSize: 16,
                  fontWeight: '600',
                }}
                numberOfLines={1}
              >
                {league?.name || 'Playoffs'}
              </Text>
              <Text
                style={{
                  color: labelColor,
                  fontSize: 12,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                Schedule Playoffs • {league?.seasonName || 'Current Season'} • Tier {tier}
              </Text>
            </View>
          </View>
        </View>

        {/* Round tabs */}
        {renderRoundTabs()}

        {/* Matches list */}
        <View
          style={{
            paddingHorizontal: CMConstants.space.small, // wider cards (less side padding)
            paddingTop: CMConstants.space.smallEx, // tighter gap below tabs
          }}
        >
          {currentRoundMatchups.length > 0 ? (
            currentRoundMatchups.map(renderMatchCard)
          ) : (
            <View style={{ padding: CMConstants.space.normal, alignItems: 'center' }}>
              <Text style={{ color: labelColor, fontSize: 14, textAlign: 'center' }}>
                No matches found for this round.
              </Text>
              {initialBracket.length === 0 && (
                <Text style={{ color: labelColor, fontSize: 12, textAlign: 'center', marginTop: CMConstants.space.smallEx }}>
                  Please generate a bracket first or check if matches have been saved.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Info text - Only show when coming from bracket generation (not from "Playoffs in Progress") */}
        {currentRoundMatchups.length > 0 && initialBracket.length > 0 && (
          <View style={{ paddingHorizontal: CMConstants.space.normal, marginTop: CMConstants.space.normal }}>
            <Text style={{ color: labelColor, fontSize: 12, textAlign: 'center' }}>
              All matchups are set. Let the playoffs begin!
            </Text>
          </View>
        )}

        {/* Save Schedule button - Only show when coming from bracket generation (not from "Playoffs in Progress") */}
        {initialBracket.length > 0 && (
          <View style={{ paddingHorizontal: CMConstants.space.normal, marginTop: CMConstants.space.normal }}>
            <CMRipple
              containerStyle={{
                backgroundColor: CMConstants.color.green,
                paddingVertical: CMConstants.space.smallEx,
                borderRadius: CMConstants.radius.normal,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={handleSaveSchedule}
            >
              <Text style={{ color: CMConstants.color.white, fontSize: 14, fontWeight: '600' }}>Save Schedule</Text>
            </CMRipple>
          </View>
        )}

        {/* Season Complete button - Show when final round is complete and viewing final tab (not from history) */}
        {!fromHistory && (() => {
          // Verify final match is actually finished before showing button
          const isOnFinalTab = selectedRoundIndex === rounds.length - 1;
          const finalRoundMatchups = rounds[rounds.length - 1] || [];
          // Final round should have exactly 1 match (championship)
          const validFinalMatchups = finalRoundMatchups.filter(m => m.teamA && m.teamB);
          const isFinalRound = validFinalMatchups.length === 1;
          const finalMatchup = validFinalMatchups[0];
          const isFinalMatchFinished = finalMatchup 
            ? matchStatusById[finalMatchup.id] === CMConstants.gameStatus.finished
            : false;
          
          return isSeasonComplete && 
                 initialBracket.length === 0 && 
                 isOnFinalTab && 
                 isFinalRound &&
                 isFinalMatchFinished;
        })() && (
          <View style={{ paddingHorizontal: CMConstants.space.normal, marginTop: CMConstants.space.normal, marginBottom: CMConstants.space.normal }}>
            <CMRipple
              containerStyle={{
                backgroundColor: CMConstants.color.green,
                paddingVertical: CMConstants.space.smallEx,
                borderRadius: CMConstants.radius.normal,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
              onPress={async () => {
                if (!league?.id || !league?.seasonName) return;
                
                setLoading(true);
                try {
                  // Mark season as complete in league document
                  // Save completion timestamp and reset flags to allow creating a new season
                  await new Promise<void>((resolve, reject) => {
                    CMFirebaseHelper.updateLeague(
                      league.id,
                      { 
                        seasonComplete: true,
                        seasonCompletedAt: firestore.FieldValue.serverTimestamp(),
                        // Keep seasonName for reference, but reset these flags so UI shows "Create Season"
                        regularSeasonEnded: false,
                        playoffsStarted: false,
                      },
                      (response: { [name: string]: any }) => {
                        if (response.isSuccess) {
                          resolve();
                        } else {
                          reject(new Error(response.value || 'Failed to update league'));
                        }
                      }
                    );
                  });
                  
                  // Navigate to season complete page
                  navigation.navigate(CMConstants.screenName.seasonComplete, {
                    league: {
                      ...league,
                      seasonComplete: true,
                      regularSeasonEnded: false,
                      playoffsStarted: false,
                    },
                  });
                } catch (error) {
                  console.error('Error completing season:', error);
                  CMAlertDlgHelper.showAlertWithOK('Failed to complete season. Please try again.');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Ionicons
                name="trophy"
                size={20}
                color={CMConstants.color.white}
                style={{ marginRight: CMConstants.space.smallEx }}
              />
              <Text style={{ color: CMConstants.color.white, fontSize: 16, fontWeight: '700' }}>
                Season Complete
              </Text>
            </CMRipple>
          </View>
        )}

      </ScrollView>

      {/* Location text input modal */}
      {locationEditor && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <View
            style={{
              width: '85%',
              backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white,
              borderRadius: CMConstants.radius.normal,
              padding: CMConstants.space.normal,
              borderWidth: 1,
              borderColor: cardBorderColor,
            }}
          >
            <Text
              style={{
                color: textColor,
                fontSize: 14,
                fontWeight: '600',
                marginBottom: CMConstants.space.smallEx,
              }}
            >
              Location
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: cardBorderColor,
                borderRadius: CMConstants.radius.smallEx,
                paddingHorizontal: CMConstants.space.smallEx,
                paddingVertical: CMConstants.space.smallEx / 2,
                color: textColor,
                backgroundColor: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.white,
              }}
              placeholder="Enter location"
              placeholderTextColor={labelColor}
              value={locationEditor.value}
              onChangeText={text =>
                setLocationEditor(prev => (prev ? { ...prev, value: text } : prev))
              }
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginTop: CMConstants.space.smallEx,
              }}
            >
              <CMRipple
                containerStyle={{
                  paddingHorizontal: CMConstants.space.smallEx,
                  paddingVertical: CMConstants.space.smallEx / 2,
                  borderRadius: CMConstants.radius.smallEx,
                  marginRight: CMConstants.space.smallEx,
                }}
                onPress={() => setLocationEditor(null)}
              >
                <Text style={{ color: labelColor, fontSize: 13 }}>Cancel</Text>
              </CMRipple>
              <CMRipple
                containerStyle={{
                  paddingHorizontal: CMConstants.space.smallEx,
                  paddingVertical: CMConstants.space.smallEx / 2,
                  borderRadius: CMConstants.radius.smallEx,
                  backgroundColor: CMConstants.color.green,
                }}
                onPress={() => {
                  if (!locationEditor) return;
                  const trimmed = locationEditor.value.trim();
                  setScheduleById(prev => ({
                    ...prev,
                    [locationEditor.matchId]: {
                      ...(prev[locationEditor.matchId] || {}),
                      location: trimmed,
                    },
                  }));
                  setLocationEditor(null);
                }}
              >
                <Text style={{ color: CMConstants.color.white, fontSize: 13, fontWeight: '600' }}>
                  Save
                </Text>
              </CMRipple>
            </View>
          </View>
        </View>
      )}
      {/* Date / Time pickers */}
      {activePicker && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        >
          <View
            style={{
              // Full-width picker sheet at the bottom with rounded top corners
              // Use a slightly lighter panel in dark mode so it stands out from the background
              backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white,
              paddingBottom: insets.bottom,
              borderTopLeftRadius: CMConstants.radius.normal,
              borderTopRightRadius: CMConstants.radius.normal,
              borderTopWidth: 1,
              borderColor: cardBorderColor,
              overflow: 'hidden',
              alignItems: 'center',
            }}
          >
            {/* Picker toolbar with Done button */}
            <View
              style={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'flex-end',
                paddingHorizontal: CMConstants.space.small,
                paddingVertical: CMConstants.space.smallEx,
                borderBottomWidth: 1,
                borderBottomColor: cardBorderColor,
              }}
            >
              <CMRipple
                containerStyle={{
                  paddingHorizontal: CMConstants.space.smallEx,
                  paddingVertical: CMConstants.space.smallEx / 2,
                  borderRadius: CMConstants.radius.smallEx,
                }}
                onPress={() => {
                  if (!activePicker) {
                    setActivePicker(null);
                    return;
                  }
                  const current = activePicker.value;
                  setScheduleById(prev => {
                    const prevEntry = prev[activePicker.matchId] || {};
                    if (activePicker.mode === 'date') {
                      return {
                        ...prev,
                        [activePicker.matchId]: { ...prevEntry, date: current },
                      };
                    }
                    return {
                      ...prev,
                      [activePicker.matchId]: { ...prevEntry, time: current },
                    };
                  });
                  setActivePicker(null);
                }}
              >
                <Text
                  style={{
                    color: CMConstants.color.green,
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  Done
                </Text>
              </CMRipple>
            </View>

            <DateTimePicker
              value={activePicker.value}
              mode={activePicker.mode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              themeVariant={isDarkMode ? 'dark' : 'light'}
              textColor={isDarkMode ? CMConstants.color.white : CMConstants.color.black}
              style={{
                alignSelf: 'center',
              }}
              onChange={(event, selectedDate) => {
                if (!activePicker) return;
                if (event.type === 'dismissed') {
                  setActivePicker(null);
                  return;
                }
                const current = selectedDate || activePicker.value;
                setScheduleById(prev => {
                  const prevEntry = prev[activePicker.matchId] || {};
                  if (activePicker.mode === 'date') {
                    return {
                      ...prev,
                      [activePicker.matchId]: { ...prevEntry, date: current },
                    };
                  }
                  return {
                    ...prev,
                    [activePicker.matchId]: { ...prevEntry, time: current },
                  };
                });
                if (Platform.OS !== 'ios') {
                  setActivePicker(null);
                } else {
                  setActivePicker({ ...activePicker, value: current });
                }
              }}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default CMPlayoffScheduleScreen;


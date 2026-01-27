import React, { useState, useEffect } from 'react';
import { View, SafeAreaView, Text, Keyboard, Platform, Modal, Dimensions, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMRipple from '../components/CMRipple';
import CMConstants from '../CMConstants';
import CMLoadingDialog from '../dialog/CMLoadingDialog';
import { TextInput } from 'react-native';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import CMNewsGeneratorHelper from '../helper/CMNewsGeneratorHelper';
import CMUtils from '../utils/CMUtils';
import { getAuth } from '@react-native-firebase/auth';
import CMGlobal from '../CMGlobal';
import CMDropDownPicker from '../components/CMDropDownPicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import CMImagePicker from '../helper/CMImagePicker';
import CMImageView from '../components/CMImageView';
import CMProfileImage from '../components/CMProfileImage';
import CMPermissionHelper from '../helper/CMPermissionHelper';

const CMEditMatchScreen = ({ navigation, route }: CMNavigationProps) => {
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(route.params.match?.name ?? '');
  // Date/Time (separate inputs with strict formatting)
  const initialDate: any = route.params.match?.dateTime;
  const initialJsDate: Date = initialDate?.toDate?.() || (initialDate instanceof Date ? initialDate : undefined) || new Date();
  const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
  const initDateText = `${initialJsDate.getFullYear()}-${pad2(initialJsDate.getMonth() + 1)}-${pad2(initialJsDate.getDate())}`;
  const initTimeText = `${pad2(initialJsDate.getHours())}:${pad2(initialJsDate.getMinutes())}`;
  const [dateText, setDateText] = useState(initDateText);
  const [timeText, setTimeText] = useState(initTimeText);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState(route.params.match?.location ?? '');
  const [teamAScore, setTeamAScore] = useState(
    route.params.match?.teamAScore != null ? String(route.params.match?.teamAScore) : ''
  );
  const [teamBScore, setTeamBScore] = useState(
    route.params.match?.teamBScore != null ? String(route.params.match?.teamBScore) : ''
  );
  const [topScore, setTopScore] = useState(
    route.params.match?.topScore != null ? String(route.params.match?.topScore) : ''
  );
  const [topScorePlayerId, setTopScorePlayerId] = useState(route.params.match?.topScorePlayerId ?? '');
  const [status, setStatus] = useState(
    route.params.match?.status ?? CMConstants.gameStatus.notStarted,
  );
  const [selectedLeague, setSelectedLeague] = useState(
    route.params.match?.leagueId ?? '',
  );
  const [selectedTeamA, setSelectedTeamA] = useState(
    route.params.match?.teamAId ?? '',
  );
  const [selectedTeamB, setSelectedTeamB] = useState(
    route.params.match?.teamBId ?? '',
  );

  const [leagues, setLeagues] = useState<{ [name: string]: any }[]>([]);
  const [teams, setTeams] = useState<{ [name: string]: any }[]>([]);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [teamAOpen, setTeamAOpen] = useState(false);
  const [teamBOpen, setTeamBOpen] = useState(false);
  
  // Image and league data states
  const [matchImage, setMatchImage] = useState(route.params.match?.image ?? null);
  const [selectedLeagueData, setSelectedLeagueData] = useState<{ [name: string]: any }>({});

  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;

  // Get screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const isSmallDevice = screenWidth < 375;
  const isLargeDevice = screenWidth > 414;
  
  // Calculate responsive scaling factors
  const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;
  const buttonHeightScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0;
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
  const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const labelColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;

  useEffect(() => {
    // Set custom header
    navigation.setOptions({
      headerShown: false,
    });

    if (!route.params.isEdit) {
      // Check permissions when editing
    } else {
      const checkPermissions = async () => {
        const match = route.params.match;
        if (match && match.id) {
          const canEdit = await CMPermissionHelper.canEditMatch(match.id, match);
          if (!canEdit) {
            CMPermissionHelper.showPermissionDenied(navigation);
          }
        }
      };
      checkPermissions();
    }

    // Load user's leagues (only leagues where user is admin)
    CMFirebaseHelper.getLeagues(
      (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          let filteredLeagues = response.value;
          
          // Filter leagues based on permissions
          // Admin users can see all leagues
          // Coach users can only see leagues they created
          if (CMGlobal.user?.role !== 'admin') {
            // Get user ID - works for both regular Firebase auth and Apple Sign In
            const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
            if (currentUserId) {
              // Filter to only show leagues where user is admin
              filteredLeagues = response.value.filter((league: any) => {
                // Only show leagues where the user is the admin
                return league.adminId && league.adminId === currentUserId;
              });
              console.log('[Edit Match] Filtered leagues for non-admin user:', filteredLeagues.length, 'out of', response.value.length);
            } else {
              // If not authenticated, show no leagues
              console.log('[Edit Match] No user ID found, showing no leagues');
              filteredLeagues = [];
            }
          }
          
          setLeagues(filteredLeagues);
        }
      },
    );
    
  }, [route.params?.isEdit, route.params?.match?.id]);

  useEffect(() => {
    // Load teams when league is selected
    if (selectedLeague) {
      const league = leagues.find(l => l.id === selectedLeague);
      if (league && league.teamsId) {
        setSelectedLeagueData(league);
        CMFirebaseHelper.getTeams(
          league.teamsId,
          (response: { [name: string]: any }) => {
            if (response.isSuccess) {
              setTeams(response.value);
            }
          },
        );
      }
    }
  }, [selectedLeague, leagues]);

  const handleImagePicker = (index: number) => {
    CMImagePicker.showImagePicker(
      index,
      (success: boolean, result: any) => {
        if (success) {
          setMatchImage(result.path);
        } else {
          console.log('Image picker cancelled or failed:', result);
        }
      },
      { width: 400, height: 400 },
      true
    );
  };

  const getDisplayImage = () => {
    // If user has uploaded an image, use it
    if (matchImage) {
      return matchImage;
    }
    // Otherwise, use league logo as default
    return selectedLeagueData.avatar || null;
  };

  // Helper function to remove leading zeros from numeric input
  const removeLeadingZeros = (text: string): string => {
    if (text === '' || text === '0') {
      return text;
    }
    // Remove leading zeros
    const cleaned = text.replace(/^0+/, '');
    // If all zeros were removed, return '0' if original was just zeros, otherwise return cleaned
    return cleaned === '' ? '0' : cleaned;
  };

  const onBtnCreateMatch = async () => {
    if (name.trim().length === 0) {
      CMAlertDlgHelper.showAlertWithOK('Please enter match name.');
      return;
    }
    if (!selectedLeague) {
      CMAlertDlgHelper.showAlertWithOK('Please select a league.');
      return;
    }
    if (!selectedTeamA || !selectedTeamB) {
      CMAlertDlgHelper.showAlertWithOK('Please select both teams.');
      return;
    }
    if (selectedTeamA === selectedTeamB) {
      CMAlertDlgHelper.showAlertWithOK('Please select different teams.');
      return;
    }
    // Optional validations
    if (teamAScore && isNaN(Number(teamAScore))) {
      CMAlertDlgHelper.showAlertWithOK('Team A score must be a number.');
      return;
    }
    if (teamBScore && isNaN(Number(teamBScore))) {
      CMAlertDlgHelper.showAlertWithOK('Team B score must be a number.');
      return;
    }
    if (topScore && isNaN(Number(topScore))) {
      CMAlertDlgHelper.showAlertWithOK('Top score must be a number.');
      return;
    }

    // Validate date and time
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
    const timeRegex = /^\d{2}:\d{2}$/; // HH:mm (24h)
    if (!dateRegex.test(dateText)) {
      CMAlertDlgHelper.showAlertWithOK('Please enter date as YYYY-MM-DD.');
      return;
    }
    if (!timeRegex.test(timeText)) {
      CMAlertDlgHelper.showAlertWithOK('Please enter time as HH:mm (24-hour).');
      return;
    }

    const combinedDate = new Date(`${dateText}T${timeText}:00`);
    if (isNaN(combinedDate.getTime())) {
      CMAlertDlgHelper.showAlertWithOK('Invalid date/time. Please check the values.');
      return;
    }

    const matchId = route.params.isEdit ? route.params.match.id : CMFirebaseHelper.getNewDocumentId('matches');
    const matchData = {
      id: matchId,
      name: name.trim(),
      dateTime: combinedDate,
      location: location?.trim?.() ?? '',
      status: status,
      leagueId: selectedLeague,
      teamAId: selectedTeamA,
      teamBId: selectedTeamB,
      teamAScore: teamAScore === '' ? 0 : Number(teamAScore),
      teamBScore: teamBScore === '' ? 0 : Number(teamBScore),
      topScore: topScore === '' ? 0 : Number(topScore),
      topScorePlayerId: topScorePlayerId ?? '',
      image: matchImage, // Include the uploaded image or null
      createdBy: route.params.isEdit ? route.params.match.createdBy : getAuth().currentUser?.uid || '',
      createdAt: route.params.isEdit ? route.params.match.createdAt : new Date(),
      updatedAt: new Date(),
    };

    // Check permissions before updating
    if (route.params.isEdit) {
      const canEdit = await CMPermissionHelper.canEditMatch(matchId, route.params.match);
      if (!canEdit) {
        setLoading(false);
        CMPermissionHelper.showPermissionDenied(navigation);
        return;
      }
    }

    setLoading(true);
    
    // Add a safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      CMAlertDlgHelper.showAlertWithOK('Request timed out. Please check your internet connection and try again.');
    }, 30000); // 30 second timeout
    
    // Use updateMatch for edits, setMatch for creates
    const handleResponse = (response: { [name: string]: any }) => {
      // Clear safety timeout
      clearTimeout(safetyTimeout);
      
      // Use setTimeout to ensure callback is processed on next tick
      setTimeout(() => {
        // Clear loading state first
        setLoading(false);
        
        if (response.isSuccess) {
          // Generate news article if match is finished
          if (route.params.isEdit && matchData.status === CMConstants.gameStatus.finished) {
            // Generate news in background (don't wait for it)
            CMNewsGeneratorHelper.onMatchCompleted(matchId)
              .then(result => {
                if (result.isSuccess) {
                  console.log('[EditMatch] News article generated:', result.value);
                } else {
                  console.warn('[EditMatch] Failed to generate news:', result.error);
                }
              })
              .catch(error => {
                console.error('[EditMatch] Error generating news:', error);
              });
          }

          const successMessage = route.params.isEdit ? 'Match updated successfully!' : 'Match created successfully!';
          
          // Use InteractionManager and setTimeout to ensure loading modal fully dismisses before showing alert
          InteractionManager.runAfterInteractions(() => {
            // Additional delay to ensure loading modal is fully dismissed
            setTimeout(() => {
              // Show success alert (without callback to avoid conflicts)
              CMAlertDlgHelper.showAlertWithOK(successMessage);
              
              // Automatically navigate back after alert is shown (don't wait for user to dismiss)
              // This prevents modal conflicts
              setTimeout(() => {
                // Call callback if provided (e.g., to refresh match list)
                if (route.params.callback) {
                  try {
                    route.params.callback();
                  } catch (callbackError) {
                    console.error('Callback error:', callbackError);
                  }
                }
                
                // Navigate back
                try {
                  if (navigation.canGoBack && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    navigation.pop();
                  }
                } catch (navError) {
                  console.error('Navigation error:', navError);
                  // Fallback navigation
                  try {
                    navigation.navigate(CMConstants.screenName.main);
                  } catch (fallbackError) {
                    console.error('Fallback navigation also failed:', fallbackError);
                    // Last resort - reset navigation stack
                    try {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: CMConstants.screenName.main }],
                      });
                    } catch (resetError) {
                      console.error('Navigation reset also failed:', resetError);
                    }
                  }
                }
              }, 1500); // Wait 1.5 seconds for alert to be displayed
            }, 300); // Delay to ensure modal is fully dismissed
          });
        } else {
          // For errors, also wait for modal to dismiss
          InteractionManager.runAfterInteractions(() => {
            setTimeout(() => {
              const errorMessage = route.params.isEdit 
                ? (response.value || 'Failed to update match. Please try again.')
                : (response.value || 'Failed to create match. Please try again.');
              CMAlertDlgHelper.showAlertWithOK(errorMessage);
            }, 300);
          });
        }
      }, 0);
    };

    if (route.params.isEdit) {
      // For edits, use updateMatch to only update changed fields
      // Remove fields that shouldn't be updated (id, createdBy, createdAt)
      const { id, createdBy, createdAt, ...updates } = matchData;
      CMFirebaseHelper.updateMatch(matchId, updates, handleResponse);
    } else {
      // For creates, use setMatch
      CMFirebaseHelper.setMatch(matchId, matchData, handleResponse);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case CMConstants.gameStatus.notStarted:
        return 'Not Started';
      case CMConstants.gameStatus.inProgress:
        return 'In Progress';
      case CMConstants.gameStatus.finished:
        return 'Finished';
      case CMConstants.gameStatus.paused:
        return 'Paused';
      default:
        return 'Not Started';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case CMConstants.gameStatus.notStarted:
        return CMConstants.color.grey;
      case CMConstants.gameStatus.inProgress:
        return CMConstants.color.denim;
      case CMConstants.gameStatus.finished:
        return CMConstants.color.fireBrick;
      case CMConstants.gameStatus.paused:
        return CMConstants.color.orange;
      default:
        return CMConstants.color.grey;
    }
  };

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      <CMLoadingDialog visible={loading} />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: headerBackgroundColor }]}>
        <CMRipple
          containerStyle={styles.backButton}
          onPress={() => navigation.goBack()}
          color={isDarkMode ? CMConstants.color.white : CMConstants.color.black}
        >
          <Ionicons
            name="arrow-back"
            size={CMConstants.height.icon}
            color={headerTextColor}
          />
        </CMRipple>
        <Text style={[styles.headerTitle, { color: headerTextColor, fontSize: CMConstants.fontSize.large * fontScale }]}>
          {route.params.seasonName ? route.params.seasonName : (route.params.isEdit ? 'Edit Match' : 'Create Match')}
        </Text>
        {route.params.isEdit && route.params.match?.id && (
          <CMRipple
            containerStyle={styles.headerRightButton}
            onPress={() => {
              navigation.navigate(CMConstants.screenName.matchPlayersStats, {
                match: route.params.match,
                leagueId: route.params.match.leagueId,
              })
            }}
            color={CMConstants.color.green}
          >
            <Ionicons name={'stats-chart-outline'} size={CMConstants.height.iconBig} color={CMConstants.color.green} />
          </CMRipple>
        )}
        {(!route.params.isEdit || !route.params.match?.id) && (
          <View style={{ width: CMConstants.height.iconBig }} />
        )}
      </View>

      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.container, { paddingHorizontal: CMConstants.space.small }]}
      >
        <View style={{ paddingBottom: insets.bottom }}>
          {/* Match Image Section */}
          <View style={styles.imageSection}>
            <View style={styles.imageContainer}>
              <CMImageView 
                style={[styles.matchImage, { backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey2 }]} 
                imgURL={getDisplayImage()} 
              />
              <View style={styles.imageButtonsContainer}>
                <CMRipple
                  containerStyle={[styles.imageButton, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}
                  onPress={() => handleImagePicker(0)}
                >
                  <Ionicons name="camera-outline" size={18} color={CMConstants.color.green} />
                  <Text style={[styles.imageButtonText, { color: textColor }]}>Camera</Text>
                </CMRipple>
                <CMRipple
                  containerStyle={[styles.imageButton, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}
                  onPress={() => handleImagePicker(1)}
                >
                  <Ionicons name="images-outline" size={18} color={CMConstants.color.green} />
                  <Text style={[styles.imageButtonText, { color: textColor }]}>Gallery</Text>
                </CMRipple>
                {matchImage && (
                  <CMRipple
                    containerStyle={[styles.imageButton, { backgroundColor: CMConstants.color.red, borderColor: CMConstants.color.red }]}
                    onPress={() => setMatchImage(null)}
                  >
                    <Ionicons name="trash-outline" size={18} color={CMConstants.color.white} />
                    <Text style={[styles.imageButtonText, { color: CMConstants.color.white }]}>Remove</Text>
                  </CMRipple>
                )}
              </View>
            </View>
          </View>

          {/* Match Name */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>MATCH NAME</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
              <Ionicons name="text-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
                defaultValue={name}
                onChangeText={text => setName(text)}
                placeholder="e.g., Team A vs Team B"
                placeholderTextColor={placeholderColor}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={Keyboard.dismiss}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>
          {/* Location */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>LOCATION</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
              <Ionicons name="location-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
                defaultValue={location}
                onChangeText={text => setLocation(text)}
                placeholder="e.g., Wilson Arena"
                placeholderTextColor={placeholderColor}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={Keyboard.dismiss}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {/* Date */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>DATE (YYYY-MM-DD)</Text>
            <CMRipple
              containerStyle={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <Text style={[styles.textInput, { color: dateText ? inputTextColor : placeholderColor, fontSize: CMConstants.fontSize.normal * fontScale }]}>
                {dateText || 'e.g., 2025-08-28'}
              </Text>
              <Ionicons name="chevron-forward-outline" size={18} color={placeholderColor} />
            </CMRipple>
          </View>
          {showDatePicker && (
            <Modal
              transparent
              animationType="fade"
              visible={showDatePicker}
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={[styles.datePickerModal, { backgroundColor: cardBackgroundColor }]}>
                  <Text style={[styles.datePickerTitle, { color: textColor }]}>Select Date</Text>
                  <DateTimePicker
                    value={initialJsDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                    {...(Platform.OS === 'ios' ? { textColor: textColor } : {})}
                    onChange={(event: any, selectedDate?: Date) => {
                      if (Platform.OS !== 'ios') setShowDatePicker(false);
                      if (selectedDate) {
                        const newDate = `${selectedDate.getFullYear()}-${pad2(selectedDate.getMonth() + 1)}-${pad2(selectedDate.getDate())}`;
                        setDateText(newDate);
                      }
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: CMConstants.space.small }}>
                      <CMRipple
                        containerStyle={[styles.datePickerButton, { backgroundColor: CMConstants.color.green }]}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.datePickerButtonText}>Done</Text>
                      </CMRipple>
                    </View>
                  )}
                </View>
              </View>
            </Modal>
          )}

          {/* Time */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>TIME (HH:mm)</Text>
            <CMRipple
              containerStyle={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <Text style={[styles.textInput, { color: timeText ? inputTextColor : placeholderColor, fontSize: CMConstants.fontSize.normal * fontScale }]}>
                {timeText || 'e.g., 14:30'}
              </Text>
              <Ionicons name="chevron-forward-outline" size={18} color={placeholderColor} />
            </CMRipple>
          </View>
          {showTimePicker && (
            <Modal
              transparent
              animationType="fade"
              visible={showTimePicker}
              onRequestClose={() => setShowTimePicker(false)}
            >
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={[styles.datePickerModal, { backgroundColor: cardBackgroundColor }]}>
                  <Text style={[styles.datePickerTitle, { color: textColor }]}>Select Time</Text>
                  <DateTimePicker
                    value={initialJsDate}
                    mode="time"
                    is24Hour
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                    {...(Platform.OS === 'ios' ? { textColor: textColor } : {})}
                    onChange={(event: any, selectedDate?: Date) => {
                      if (Platform.OS !== 'ios') setShowTimePicker(false);
                      if (selectedDate) {
                        const newTime = `${pad2(selectedDate.getHours())}:${pad2(selectedDate.getMinutes())}`;
                        setTimeText(newTime);
                      }
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: CMConstants.space.small }}>
                      <CMRipple
                        containerStyle={[styles.datePickerButton, { backgroundColor: CMConstants.color.green }]}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.datePickerButtonText}>Done</Text>
                      </CMRipple>
                    </View>
                  )}
                </View>
              </View>
            </Modal>
          )}

          {/* League */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>LEAGUE</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
              <Ionicons name="trophy-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <View style={styles.dropdownWrapper}>
                <CMDropDownPicker
                  isOpened={leagueOpen}
                  themeMode={isDarkMode ? CMConstants.themeMode.dark : CMConstants.themeMode.light}
                  defaultStyle={styles.dropdownStyle}
                  defaultDropDownContainerStyle={styles.dropdownContainerStyle}
                  placeholder="Select League"
                  placeholderStyle={{ color: placeholderColor }}
                  open={leagueOpen}
                  value={selectedLeague}
                  items={leagues.map(league => ({
                    label: league.name,
                    value: league.id,
                  }))}
                  setOpen={setLeagueOpen}
                  onSelectItem={(item: any) => {
                    setSelectedLeague(item.value);
                    setSelectedTeamA('');
                    setSelectedTeamB('');
                  }}
                  setItems={setLeagues}
                  onOpen={() => {
                    setTeamAOpen(false);
                    setTeamBOpen(false);
                  }}
                  textStyle={{ color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale }}
                  labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
                  arrowIconStyle={{ tintColor: placeholderColor }}
                  itemStyle={{ 
                    paddingVertical: CMConstants.space.smallEx, 
                    paddingHorizontal: CMConstants.space.small,
                    minHeight: 44,
                  }}
                  itemSeparator={false}
                  selectedItemLabelStyle={{ 
                    color: CMConstants.color.green, 
                    fontFamily: CMConstants.font.semiBold,
                    fontWeight: '600',
                  }}
                  selectedItemContainerStyle={{
                    backgroundColor: 'transparent',
                  }}
                  tickIconStyle={{ tintColor: CMConstants.color.green }}
                  listItemContainerStyle={{
                    paddingHorizontal: 0,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Home Team */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>HOME TEAM (TEAM A)</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
              <Ionicons name="people-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <View style={styles.dropdownWrapper}>
                <CMDropDownPicker
                  isOpened={teamAOpen}
                  themeMode={isDarkMode ? CMConstants.themeMode.dark : CMConstants.themeMode.light}
                  defaultStyle={styles.dropdownStyle}
                  defaultDropDownContainerStyle={styles.dropdownContainerStyle}
                  placeholder="Select Home Team"
                  placeholderStyle={{ color: placeholderColor }}
                  open={teamAOpen}
                  value={selectedTeamA}
                  items={teams.map(team => ({
                    label: team.name || `Team ${team.id}`,
                    value: team.id,
                  }))}
                  setOpen={setTeamAOpen}
                  onSelectItem={(item: any) => setSelectedTeamA(item.value)}
                  setItems={setTeams}
                  onOpen={() => {
                    setLeagueOpen(false);
                    setTeamBOpen(false);
                  }}
                  textStyle={{ color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale }}
                  labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
                  arrowIconStyle={{ tintColor: placeholderColor }}
                  itemStyle={{ 
                    paddingVertical: CMConstants.space.smallEx, 
                    paddingHorizontal: CMConstants.space.small,
                    minHeight: 44,
                  }}
                  itemSeparator={false}
                  selectedItemLabelStyle={{ 
                    color: CMConstants.color.green, 
                    fontFamily: CMConstants.font.semiBold,
                    fontWeight: '600',
                  }}
                  selectedItemContainerStyle={{
                    backgroundColor: 'transparent',
                  }}
                  tickIconStyle={{ tintColor: CMConstants.color.green }}
                  listItemContainerStyle={{
                    paddingHorizontal: 0,
                  }}
                />
              </View>
            </View>
          </View>

          {/* Away Team */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>AWAY TEAM (TEAM B)</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
              <Ionicons name="people-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <View style={styles.dropdownWrapper}>
                <CMDropDownPicker
                  isOpened={teamBOpen}
                  themeMode={isDarkMode ? CMConstants.themeMode.dark : CMConstants.themeMode.light}
                  defaultStyle={styles.dropdownStyle}
                  defaultDropDownContainerStyle={styles.dropdownContainerStyle}
                  placeholder="Select Away Team"
                  placeholderStyle={{ color: placeholderColor }}
                  open={teamBOpen}
                  value={selectedTeamB}
                  items={teams.map(team => ({
                    label: team.name || `Team ${team.id}`,
                    value: team.id,
                  }))}
                  setOpen={setTeamBOpen}
                  onSelectItem={(item: any) => setSelectedTeamB(item.value)}
                  setItems={setTeams}
                  onOpen={() => {
                    setLeagueOpen(false);
                    setTeamAOpen(false);
                  }}
                  textStyle={{ color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale }}
                  labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
                  arrowIconStyle={{ tintColor: placeholderColor }}
                  itemStyle={{ 
                    paddingVertical: CMConstants.space.smallEx, 
                    paddingHorizontal: CMConstants.space.small,
                    minHeight: 44,
                  }}
                  itemSeparator={false}
                  selectedItemLabelStyle={{ 
                    color: CMConstants.color.green, 
                    fontFamily: CMConstants.font.semiBold,
                    fontWeight: '600',
                  }}
                  selectedItemContainerStyle={{
                    backgroundColor: 'transparent',
                  }}
                  tickIconStyle={{ tintColor: CMConstants.color.green }}
                  listItemContainerStyle={{
                    paddingHorizontal: 0,
                  }}
                />
              </View>
            </View>
          </View>
          {/* Team A Score */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>TEAM A SCORE</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
              <Ionicons name="trophy-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
                defaultValue={teamAScore}
                onChangeText={text => {
                  const cleaned = removeLeadingZeros(text);
                  setTeamAScore(cleaned);
                }}
                placeholder="e.g., 0"
                keyboardType="numeric"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={Keyboard.dismiss}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {/* Team B Score */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>TEAM B SCORE</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
              <Ionicons name="trophy-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
                defaultValue={teamBScore}
                onChangeText={text => {
                  const cleaned = removeLeadingZeros(text);
                  setTeamBScore(cleaned);
                }}
                placeholder="e.g., 0"
                keyboardType="numeric"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={Keyboard.dismiss}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {/* Top Score */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>TOP SCORE</Text>
            <View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
              <Ionicons name="star-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
                defaultValue={topScore}
                onChangeText={text => setTopScore(text)}
                placeholder="e.g., 21"
                keyboardType="numeric"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {/* Status */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>STATUS</Text>
            <View style={styles.statusContainer}>
              {CMConstants.gameStatus &&
                Object.values(CMConstants.gameStatus).map(statusValue => (
                  <CMRipple
                    key={statusValue}
                    containerStyle={[
                      styles.statusButton,
                      {
                        backgroundColor: status === statusValue ? getStatusColor(statusValue) : cardBackgroundColor,
                        borderColor: status === statusValue ? getStatusColor(statusValue) : cardBorderColor,
                      }
                    ]}
                    onPress={() => setStatus(statusValue)}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        {
                          color: status === statusValue ? CMConstants.color.white : textColor,
                          fontSize: CMConstants.fontSize.smallEx * fontScale,
                        }
                      ]}
                    >
                      {getStatusLabel(statusValue)}
                    </Text>
                  </CMRipple>
                ))}
            </View>
          </View>

          {/* Create/Update Button */}
          <CMRipple
            containerStyle={[styles.createButton, { height: CMConstants.height.buttonNormal * buttonHeightScale }]}
            onPress={onBtnCreateMatch}
            color={CMConstants.color.white}
          >
            <Text style={[styles.createButtonText, { fontSize: CMConstants.fontSize.normal * fontScale }]}>
              {route.params.isEdit ? 'Update Match' : 'Create Match'}
            </Text>
          </CMRipple>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = {
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: CMConstants.space.normal,
    paddingHorizontal: CMConstants.space.normal,
    paddingBottom: CMConstants.space.smallEx,
  } as any,
  backButton: {
    width: CMConstants.height.icon,
    height: CMConstants.height.icon,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: CMConstants.space.smallEx,
  },
  headerTitle: {
    flex: 1,
    fontFamily: CMConstants.font.bold,
    textAlign: 'left' as const,
  },
  headerRightButton: {
    ...CMCommonStyles.circle(CMConstants.height.iconBig),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: CMConstants.color.green,
  },
  container: {
    flexGrow: 1,
    paddingBottom: CMConstants.space.normal,
  },
  imageSection: {
    alignItems: 'center' as const,
    marginVertical: CMConstants.space.normal,
  },
  imageContainer: {
    alignItems: 'center' as const,
  },
  matchImage: {
    width: 200,
    height: 120,
    borderRadius: CMConstants.radius.normal,
    backgroundColor: CMConstants.color.lightGrey2,
  },
  imageButtonsContainer: {
    flexDirection: 'row' as const,
    marginTop: CMConstants.space.small,
    gap: CMConstants.space.smallEx,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CMConstants.space.small,
    paddingVertical: CMConstants.space.smallEx - 2,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    gap: CMConstants.space.smallEx / 2,
  },
  imageButtonText: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.semiBold,
  },
  inputContainer: {
    marginBottom: CMConstants.space.smallEx,
  },
  label: {
    fontFamily: CMConstants.font.semiBold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: CMConstants.space.smallEx - 2,
  },
  inputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    paddingHorizontal: CMConstants.space.normal,
  },
  inputIcon: {
    marginRight: CMConstants.space.smallEx,
    marginLeft: -4,
  },
  textInput: {
    flex: 1,
    fontFamily: CMConstants.font.regular,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  dropdownWrapper: {
    flex: 1,
    marginLeft: -6,
    alignSelf: 'stretch' as const,
  },
  dropdownStyle: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 0,
    height: undefined
  },
  dropdownContainerStyle: {
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    paddingHorizontal: CMConstants.space.small,
    paddingVertical: CMConstants.space.smallEx / 2,
    maxHeight: 220,
    marginTop: 4,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  statusContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: CMConstants.space.smallEx,
    marginTop: 4,
  },
  statusButton: {
    paddingHorizontal: CMConstants.space.smallEx,
    paddingVertical: CMConstants.space.smallEx - 2,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
  },
  statusButtonText: {
    fontFamily: CMConstants.font.semiBold,
  },
  createButton: {
    backgroundColor: CMConstants.color.green,
    borderRadius: CMConstants.radius.normal,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    width: '100%',
    marginTop: CMConstants.space.smallEx,
  },
  createButtonText: {
    color: CMConstants.color.white,
    fontFamily: CMConstants.font.bold,
    letterSpacing: 0.5,
  },
  datePickerModal: {
    borderRadius: CMConstants.radius.normal,
    padding: CMConstants.space.normal,
    width: '90%' as any,
  },
  datePickerTitle: {
    fontSize: CMConstants.fontSize.large,
    fontFamily: CMConstants.font.bold,
    marginBottom: CMConstants.space.small,
  },
  datePickerButton: {
    paddingHorizontal: CMConstants.space.normal,
    paddingVertical: CMConstants.space.smallEx,
    borderRadius: CMConstants.radius.normal,
  },
  datePickerButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.bold,
  },
};

export default CMEditMatchScreen;

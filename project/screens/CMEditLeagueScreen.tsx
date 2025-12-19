import React, { useState, useEffect } from 'react';
import { View, Text, Keyboard, Dimensions, InteractionManager } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMRipple from '../components/CMRipple';
import CMConstants from '../CMConstants';
import CMLoadingDialog from '../dialog/CMLoadingDialog';
import { TextInput } from 'react-native';
import CMImagePicker from '../helper/CMImagePicker';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import CMUtils from '../utils/CMUtils';
import { getAuth } from '@react-native-firebase/auth';
import CMGlobal from '../CMGlobal';
import CMProgressiveImage from '../components/CMProgressiveImage';
import CMPermissionHelper from '../helper/CMPermissionHelper';

/**
 * Get current user ID - works for both regular Firebase auth and Apple Sign In (REST API)
 */
const getCurrentUserId = (): string | null => {
  // For Apple Sign In users, use CMGlobal.user.id
  if (CMGlobal.user?.id) {
    return CMGlobal.user.id;
  }
  // For regular Firebase auth users, use getAuth().currentUser?.uid
  return getAuth().currentUser?.uid || null;
};

const CMEditLeagueScreen = ({ navigation, route }: CMNavigationProps) => {
  const [loading, setLoading] = useState(false);

  const insets = useSafeAreaInsets();

  const [profileImagePath, setProfileImagePath] = useState(
    route.params.league?.avatar ?? '',
  );
  const [profileImageChanged, setProfileImageChanged] = useState(false);
  const [name, setName] = useState(route.params.league?.name ?? '');
  const [maxTeamSize, setMaxTeamSize] = useState(
    route.params.league?.maxTeamSize?.toString() ?? '',
  );
  const [inviteId, setInviteId] = useState(route.params.league?.inviteId ?? '');
  const [instagramUrl, setInstagramUrl] = useState(route.params.league?.instagramUrl ?? '');
  const [city, setCity] = useState(route.params.league?.city ?? '');
  const [state, setState] = useState(route.params.league?.state ?? '');
  const [country, setCountry] = useState(route.params.league?.country ?? '');
  const [createLabel, setCreateLabel] = useState('Create League');
  const [promoCode, setPromoCode] = useState('');

  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;

  // Get screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
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
  const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey2;
  const inputBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
  const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const editImageButtonBorderColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;

  // Instagram URL validation function
  const isValidInstagramUrl = (url: string): boolean => {
    if (!url || url.trim().length === 0) {
      return true; // Empty URL is valid (optional field)
    }
    
    const trimmedUrl = url.trim();
    
    // Instagram URL patterns - more flexible to handle various Instagram URLs
    const instagramPatterns = [
      /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?.*$/, // Full Instagram URLs with any path
      /^@[a-zA-Z0-9._]+$/, // Handle @username format
      /^[a-zA-Z0-9._]+$/ // Handle just username
    ];
    
    return instagramPatterns.some(pattern => pattern.test(trimmedUrl));
  };

  const formatInstagramUrl = (url: string): string => {
    if (!url || url.trim().length === 0) {
      return '';
    }
    
    const trimmedUrl = url.trim();
    
    // If it's just a username (no @, no URL), add @
    if (/^[a-zA-Z0-9._]+$/.test(trimmedUrl)) {
      return `@${trimmedUrl}`;
    }
    
    // If it's @username, keep as is
    if (/^@[a-zA-Z0-9._]+$/.test(trimmedUrl)) {
      return trimmedUrl;
    }
    
    // If it's a full URL, keep as is
    if (/^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?$/.test(trimmedUrl)) {
      return trimmedUrl;
    }
    
    return trimmedUrl;
  };

  useEffect(() => {
    const title = route.params.isEdit ? 'Edit League' : 'Create League';
    navigation.setOptions({
      title: title,
      headerShown: false,
      headerStyle: {
        backgroundColor: backgroundColor,
      },
      headerTintColor: headerTextColor,
      headerTitleStyle: {
        color: headerTextColor,
        fontSize: CMConstants.fontSize.largeEx,
        fontWeight: 'bold',
      },
    });
    
    if (route.params.isEdit) {
      setCreateLabel('Update League');
      
      // Check permissions when editing
      const checkPermissions = async () => {
        const league = route.params.league;
        if (league && league.id) {
          const canEdit = await CMPermissionHelper.canEditLeague(league.id, league);
          if (!canEdit) {
            CMPermissionHelper.showPermissionDenied(navigation);
          }
        }
      };
      checkPermissions();
    }
  }, []);

  useEffect(() => {
    if (route.params.isEdit) {
      setCreateLabel('Update League');
    } else {
      setCreateLabel('Create League');
    }
  }, [route.params.isEdit]);

  const onBtnProfileImage = () => {
    CMImagePicker.showImagePicker(1, (isSuccess: boolean, response: any) => {
      if (!isSuccess) {
        return;
      }

      setProfileImageChanged(true);
      setProfileImagePath(response.path);
    });
  };

  const onBtnCreateLeague = () => {
    if (name.trim().length == 0) {
      CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterLeagueName);
      return;
    }
    const size = parseInt(maxTeamSize);
    if (!CMUtils.isNumeric(size)) {
      CMAlertDlgHelper.showAlertWithOK('Please enter a valid max team size.');
      return;
    }
    if (size < 2) {
      CMAlertDlgHelper.showAlertWithOK('Max team size should be minimum 2.');
      return;
    }
    if (inviteId.trim().length == 0) {
      CMAlertDlgHelper.showAlertWithOK('Please enter invite code.');
      return;
    }
    if (!isValidInstagramUrl(instagramUrl)) {
      CMAlertDlgHelper.showAlertWithOK('Please enter a valid Instagram URL, username, or @username.');
      return;
    }

    const isEdit = route.params.isEdit;
    const leagueId = isEdit ? route.params.league.id : CMFirebaseHelper.getNewDocumentId(
      CMConstants.collectionName.league,
    );
    
    const updatedLeague: { [name: string]: any } = {
      id: leagueId,
      name: name,
      maxTeamSize: size,
      inviteId: inviteId,
      instagramUrl: formatInstagramUrl(instagramUrl),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
    };

    // Preserve adminId and teamsId when editing existing leagues
    if (isEdit && route.params.league) {
      // Preserve adminId from existing league (critical for filtering)
      if (route.params.league.adminId) {
        updatedLeague.adminId = route.params.league.adminId;
      }
      // Preserve teamsId from existing league
      if (route.params.league.teamsId) {
        updatedLeague.teamsId = route.params.league.teamsId;
      }
      // Preserve avatar if image hasn't changed
      if (!profileImageChanged && route.params.league.avatar) {
        updatedLeague.avatar = route.params.league.avatar;
      } else if (!profileImageChanged && profileImagePath) {
        // Fallback to profileImagePath if league.avatar is not available
        updatedLeague.avatar = profileImagePath;
      }
    }

    // Only set adminId and teamsId for new leagues
    if (!isEdit) {
      const userId = getCurrentUserId();
      if (!userId) {
        CMAlertDlgHelper.showAlertWithOK('Please log in to create a league.');
        return;
      }
      const currentUser = getAuth().currentUser || { uid: userId }; // Create mock user object for Apple Sign In
      
      // No subscription limits - all users can create leagues with any team size
      proceedWithTeamAndLeagueCreation(updatedLeague, leagueId, userId);
      return;
    }

    // For editing existing leagues - no subscription limits
    const userId = getCurrentUserId();
    if (!userId) {
      CMAlertDlgHelper.showAlertWithOK('Please log in to edit a league.');
      return;
    }

    // No subscription limits - all users can edit leagues with any team size
    proceedWithLeagueCreation(updatedLeague, leagueId);
  };

  const proceedWithTeamAndLeagueCreation = (
    updatedLeague: { [name: string]: any },
    leagueId: string,
    userId: string
  ) => {
    // Automatically get or create a team for the user if they don't have one
    if (!CMGlobal.user || !CMGlobal.user.teamId) {
      setLoading(true);
      CMFirebaseHelper.getTeam(userId, (teamResponse: { [name: string]: any }) => {
        // Use setTimeout to ensure callback is processed on next tick, preventing UI freeze
        setTimeout(() => {
          if (!teamResponse.isSuccess) {
            setLoading(false);
            // Show the specific error message from Firebase with step info
            const errorMsg = `Step 1 (Get/Create Team) failed:\n\n${teamResponse.value || 'Failed to create team. Please try again.'}\n\nThis is a WRITE operation. If reads work but writes fail, your Firebase project likely needs to be upgraded to Blaze plan.`;
            CMAlertDlgHelper.showAlertWithOK(errorMsg);
            return;
          }
          
          // Update CMGlobal.user with the teamId
          if (!CMGlobal.user) {
            CMGlobal.user = {};
          }
          CMGlobal.user.teamId = teamResponse.value.id;
          
          // Set adminId and teamsId for new league
          updatedLeague.adminId = userId;
          updatedLeague.teamsId = [teamResponse.value.id];
          
          // All users can create leagues - no subscription required
          
          // Continue with the rest of the league creation process
          // Loading is already set to true, proceedWithLeagueCreation will handle it
          proceedWithLeagueCreation(updatedLeague, leagueId);
        }, 0);
      });
      return;
    }
    
    // Set adminId and teamsId for new league
    updatedLeague.adminId = userId;
    updatedLeague.teamsId = [CMGlobal.user.teamId];
    
    // All users can create leagues - no subscription required

    // Continue with the league creation process
    // Set loading to true before proceeding (user already has teamId, so getTeam wasn't called)
    setLoading(true);
    proceedWithLeagueCreation(updatedLeague, leagueId);
  };

  const proceedWithLeagueCreation = (updatedLeague: { [name: string]: any }, leagueId: string) => {
    const isEdit = route.params.isEdit;

    const postUploadImage = async () => {
      // Safety timeout to ensure loading is cleared even if callback never fires
      const safetyTimeout = setTimeout(() => {
        setLoading(false);
        setProfileImageChanged(false);
        const operation = isEdit ? 'update' : 'create';
        CMAlertDlgHelper.showAlertWithOK(
          `Step 2 (${operation.charAt(0).toUpperCase() + operation.slice(1)} League) timed out.\n\nThis usually means:\n\n1. Your Firebase project needs to be upgraded (most likely)\n2. Network connectivity issues\n3. Firebase security rules blocking write access\n\nPlease check your Firebase console:\n- Go to Firestore Database → Rules\n- Make sure write permissions are enabled\n- Check if upgrade to Blaze plan is required`
        );
      }, 35000); // 35 second safety timeout (slightly longer than Firebase timeout)

      const clearSafetyTimeout = () => {
        clearTimeout(safetyTimeout);
      };

      if (isEdit) {
        // Check permissions before updating
        const canEdit = await CMPermissionHelper.canEditLeague(leagueId, route.params.league);
        if (!canEdit) {
          clearSafetyTimeout();
          setLoading(false);
          CMPermissionHelper.showPermissionDenied(navigation);
          return;
        }

        CMFirebaseHelper.updateLeague(
          leagueId,
          updatedLeague,
          (response: { [name: string]: any }) => {
            clearSafetyTimeout();
            // Clear loading state first
            setLoading(false);
            setProfileImageChanged(false);
            
            if (response.isSuccess) {
              // Use InteractionManager and setTimeout to ensure loading modal fully dismisses before showing alert
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => {
                  // Show alert and navigate after a delay (don't wait for alert callback to avoid freezing)
                  CMAlertDlgHelper.showAlertWithOK('League updated successfully!');
                  
                  // Navigate after alert is shown (with delay to let user see the message)
                  setTimeout(() => {
                    InteractionManager.runAfterInteractions(() => {
                      try {
                        // Use goBack() to return to previous screen
                        if (navigation.canGoBack && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
                          navigation.goBack();
                        } else {
                          // Fallback: navigate to main screen
                          navigation.navigate(CMConstants.screenName.main);
                        }
                      } catch (error: any) {
                        // If navigation fails, log error and try alternative
                        console.error('Navigation error after league update:', error);
                        try {
                          navigation.navigate(CMConstants.screenName.main);
                        } catch (fallbackError) {
                          console.error('Fallback navigation also failed:', fallbackError);
                          // Last resort: try to reset navigation stack
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
                    });
                  }, 1500); // Wait 1.5 seconds for user to see the success message, then navigate
                }, 300); // Delay to ensure loading modal is fully dismissed
              });
            } else {
              // For errors, also wait for modal to dismiss
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => {
                  CMAlertDlgHelper.showAlertWithOK(`Step 2 (Update League) failed:\n\n${response.value || 'Failed to update league.'}`);
                }, 300);
              });
            }
          },
        );
      } else {
        CMFirebaseHelper.createLeague(
          leagueId,
          updatedLeague,
          (response: { [name: string]: any }) => {
            clearSafetyTimeout();
            
            // Use setTimeout to ensure callback is processed on next tick
            setTimeout(() => {
              // Clear loading state first
              setLoading(false);
              setProfileImageChanged(false);
              
              if (response.isSuccess) {
                // Use InteractionManager and setTimeout to ensure loading modal fully dismisses before showing alert
                InteractionManager.runAfterInteractions(() => {
                  setTimeout(() => {
                    // Show alert and navigate after a delay (don't wait for alert callback to avoid freezing)
                    CMAlertDlgHelper.showAlertWithOK(response.value || 'Created league successfully!');
                    
                    // Navigate after alert is shown (with delay to let user see the message)
                    setTimeout(() => {
                      InteractionManager.runAfterInteractions(() => {
                        setTimeout(() => {
                          try {
                            // Use goBack() to return to previous screen (league list)
                            // The league list will automatically refresh when it comes into focus
                            if (navigation.canGoBack && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
                              navigation.goBack();
                            } else {
                              // Fallback: navigate to main screen which contains league tab
                              navigation.navigate(CMConstants.screenName.main);
                            }
                          } catch (error: any) {
                            // If navigation fails, log error and try alternative
                            console.error('Navigation error after league creation:', error);
                            try {
                              navigation.navigate(CMConstants.screenName.main);
                            } catch (fallbackError) {
                              console.error('Fallback navigation also failed:', fallbackError);
                              // Last resort: try to reset navigation stack
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
                        }, 100);
                      });
                    }, 1500); // Wait 1.5 seconds for user to see the success message, then navigate
                  }, 300); // Delay to ensure loading modal is fully dismissed
                });
              } else {
                // For errors, also wait for modal to dismiss
                InteractionManager.runAfterInteractions(() => {
                  setTimeout(() => {
                    CMAlertDlgHelper.showAlertWithOK(`Step 2 (Create League) failed:\n\n${response.value || 'Failed to create league.'}`);
                  }, 300);
                });
              }
            }, 0);
          },
        );
      }
    };

    const postPurchase = () => {
      // Ensure loading is set to true (may have been set to false in promo code path)
      setLoading(true);
      
      // Add a safety timeout to prevent infinite loading
      const safetyTimeout = setTimeout(() => {
        setLoading(false);
        CMAlertDlgHelper.showAlertWithOK(
          'Image upload is taking longer than expected. This usually means:\n\n1. Your Firebase project needs to be upgraded (most likely)\n2. Network connectivity issues\n3. Firebase storage rules blocking access\n\nPlease check your Firebase console and upgrade if needed.'
        );
      }, 60000); // 60 second safety timeout

      const clearSafetyTimeout = () => {
        clearTimeout(safetyTimeout);
      };

      if (profileImageChanged && profileImagePath) {
        CMFirebaseHelper.uploadImage(
          profileImagePath,
          `league_avatar/${leagueId}.jpg`,
        ).then(response => {
          if (response.isSuccess) {
            updatedLeague['avatar'] = response.value;
          } else {
            // Image upload failed but continue with league creation without avatar
            // Don't show alert here to avoid freezing - just log the error
            let errorMsg = 'Unknown error';
            if (typeof response.value === 'object' && response.value?.message) {
              errorMsg = response.value.message;
            } else if (typeof response.value === 'string') {
              errorMsg = response.value;
            }
            console.warn('Image upload failed:', errorMsg);
          }
          // Continue with league creation regardless of image upload result
          clearSafetyTimeout();
          // Use setTimeout to prevent UI freeze
          setTimeout(() => {
            postUploadImage();
          }, 0);
        }).catch(error => {
          // Handle unexpected errors during image upload
          const errorMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
          console.warn('Image upload error:', errorMsg);
          // Continue with league creation even if image upload fails
          clearSafetyTimeout();
          // Use setTimeout to prevent UI freeze
          setTimeout(() => {
            postUploadImage();
          }, 0);
        });
      } else {
        clearSafetyTimeout();
        // Use setTimeout to prevent UI freeze
        setTimeout(() => {
          postUploadImage();
        }, 0);
      }
    };

    // Skip purchase logic for edit mode
    if (isEdit) {
      postPurchase();
    } else {
      if (promoCode.trim().length > 0) {
        setLoading(true);
        CMFirebaseHelper.getPromoCodes(
          promoCode,
          (response: { [name: string]: any }) => {
            if (response.isSuccess) {
              CMFirebaseHelper.updatePromoCode(
                response.value[0].id,
                { usedBy: getCurrentUserId() },
                (response: { [name: string]: any }) => {
                  setLoading(false);
                  if (response.isSuccess) {
                    postPurchase();
                  } else {
                    CMAlertDlgHelper.showAlertWithOK(
                      'Failed to load promo code.',
                    );
                  }
                },
              );
            } else {
              setLoading(false);
              CMAlertDlgHelper.showAlertWithOK(response.value);
            }
          },
        );
      } else {
        // All users can create leagues - proceed directly
        postPurchase();
      }
    }
  };

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      <CMLoadingDialog visible={loading} />
      
      {/* Custom Header */}
      <View style={[styles.header, { backgroundColor: backgroundColor }]}>
        <CMRipple
          containerStyle={styles.backButton}
          onPress={() => navigation.goBack()}
          color={isDarkMode ? CMConstants.color.white : CMConstants.color.black}
        >
          <Ionicons
            name="arrow-back"
            size={CMConstants.height.icon}
            color={isDarkMode ? CMConstants.color.white : CMConstants.color.black}
          />
        </CMRipple>
        <Text style={[styles.headerTitle, { color: headerTextColor, fontSize: CMConstants.fontSize.large * fontScale }]}>
          {route.params.isEdit ? 'Edit League' : 'Create League'}
        </Text>
        <View style={{ width: CMConstants.height.icon }} />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1, marginBottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        {/* Profile Image Section */}
        <View style={styles.profileImageSection}>
          <View style={styles.profileImageWrapper}>
            <CMRipple
              containerStyle={styles.profileImageContainer}
              onPress={onBtnProfileImage}
            >
              <CMProgressiveImage
                style={styles.profileImage}
                imgURL={profileImagePath}
              />
            </CMRipple>
            <CMRipple
              containerStyle={[styles.editImageButton, { borderColor: editImageButtonBorderColor }]}
              onPress={onBtnProfileImage}
            >
              <Ionicons
                name="camera"
                size={22}
                color={CMConstants.color.white}
              />
            </CMRipple>
          </View>
        </View>
        {/* Name Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>NAME</Text>
          <View style={[styles.inputWrapper, { 
            backgroundColor: inputBackgroundColor, 
            borderColor: inputBorderColor,
            minHeight: 40 * buttonHeightScale,
            paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
          }]}>
            <Ionicons
              name="people-outline"
              size={20 * iconScale}
              color={CMConstants.color.green}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
              value={name}
              onChangeText={text => setName(text)}
              placeholder="Enter league name"
              placeholderTextColor={placeholderColor}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              underlineColorAndroid="transparent"
              submitBehavior="submit"
            />
          </View>
        </View>
        {/* Max Team Size Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>MAX TEAM SIZE</Text>
          <View style={[styles.inputWrapper, { 
            backgroundColor: inputBackgroundColor, 
            borderColor: inputBorderColor,
            minHeight: 40 * buttonHeightScale,
            paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
          }]}>
            <Ionicons
              name="people-outline"
              size={20 * iconScale}
              color={CMConstants.color.green}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
              value={maxTeamSize}
              onChangeText={text => setMaxTeamSize(text)}
              placeholder="Enter max team size"
              placeholderTextColor={placeholderColor}
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              underlineColorAndroid="transparent"
              submitBehavior="submit"
            />
          </View>
        </View>

        {/* Invite Code Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>INVITE CODE</Text>
          <View style={[styles.inputWrapper, { 
            backgroundColor: inputBackgroundColor, 
            borderColor: inputBorderColor,
            minHeight: 40 * buttonHeightScale,
            paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
          }]}>
            <Ionicons
              name="key-outline"
              size={20 * iconScale}
              color={CMConstants.color.green}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
              value={inviteId}
              onChangeText={text => setInviteId(text)}
              placeholder="Enter invite code"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              underlineColorAndroid="transparent"
              submitBehavior="submit"
            />
          </View>
        </View>

        {/* Instagram URL Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>INSTAGRAM URL (OPTIONAL)</Text>
          <View style={[styles.inputWrapper, { 
            backgroundColor: inputBackgroundColor, 
            borderColor: inputBorderColor,
            minHeight: 40 * buttonHeightScale,
            paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
          }]}>
            <Ionicons
              name="logo-instagram"
              size={20 * iconScale}
              color={CMConstants.color.green}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
              value={instagramUrl}
              onChangeText={text => setInstagramUrl(text)}
              placeholder="e.g., @username, username, or https://instagram.com/username"
              placeholderTextColor={placeholderColor}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              underlineColorAndroid="transparent"
              submitBehavior="submit"
            />
          </View>
        </View>

        {/* City Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>CITY</Text>
          <View style={[styles.inputWrapper, { 
            backgroundColor: inputBackgroundColor, 
            borderColor: inputBorderColor,
            minHeight: 40 * buttonHeightScale,
            paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
          }]}>
            <Ionicons
              name="location-outline"
              size={20 * iconScale}
              color={CMConstants.color.green}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
              value={city}
              onChangeText={text => setCity(text)}
              placeholder="Enter city name"
              placeholderTextColor={placeholderColor}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              underlineColorAndroid="transparent"
              submitBehavior="submit"
            />
          </View>
        </View>

        {/* State Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>STATE</Text>
          <View style={[styles.inputWrapper, { 
            backgroundColor: inputBackgroundColor, 
            borderColor: inputBorderColor,
            minHeight: 40 * buttonHeightScale,
            paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
          }]}>
            <Ionicons
              name="location-outline"
              size={20 * iconScale}
              color={CMConstants.color.green}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
              value={state}
              onChangeText={text => setState(text)}
              placeholder="Enter state"
              placeholderTextColor={placeholderColor}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              underlineColorAndroid="transparent"
              submitBehavior="submit"
            />
          </View>
        </View>

        {/* Country Input */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>COUNTRY</Text>
          <View style={[styles.inputWrapper, { 
            backgroundColor: inputBackgroundColor, 
            borderColor: inputBorderColor,
            minHeight: 40 * buttonHeightScale,
            paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
          }]}>
            <Ionicons
              name="globe-outline"
              size={20 * iconScale}
              color={CMConstants.color.green}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
              value={country}
              onChangeText={text => setCountry(text)}
              placeholder="Enter country name"
              placeholderTextColor={placeholderColor}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              underlineColorAndroid="transparent"
              submitBehavior="submit"
            />
          </View>
        </View>
        {/* Promo Code Input (only for new leagues) */}
        {!route.params.isEdit && (
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>PROMO CODE</Text>
            <View style={[styles.inputWrapper, { 
              backgroundColor: inputBackgroundColor, 
              borderColor: inputBorderColor,
              minHeight: 40 * buttonHeightScale,
              paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
            }]}>
              <Ionicons
                name="ticket-outline"
                size={20 * iconScale}
                color={CMConstants.color.green}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
                value={promoCode}
                onChangeText={text => setPromoCode(text)}
                placeholder="Enter promo code (optional)"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                underlineColorAndroid="transparent"
                submitBehavior="submit"
              />
            </View>
          </View>
        )}

        {/* Create/Update Button */}
        <View style={styles.buttonContainer}>
          <CMRipple
            containerStyle={styles.createButton}
            onPress={onBtnCreateLeague}
            color={CMConstants.color.white}
          >
            <Text style={styles.createButtonText}>{createLabel}</Text>
          </CMRipple>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = {
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: CMConstants.space.normal,
    paddingTop: CMConstants.space.normal,
    paddingBottom: CMConstants.space.smallEx,
  },
  backButton: {
    width: CMConstants.height.icon,
    height: CMConstants.height.icon,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: CMConstants.space.smallEx,
  },
  headerTitle: {
    fontFamily: CMConstants.font.bold,
    flex: 1,
    textAlign: 'left' as const,
  },
  container: {
    paddingHorizontal: CMConstants.space.small,
    paddingBottom: CMConstants.space.normal,
  },
  profileImageSection: {
    alignSelf: 'center' as const,
    marginVertical: CMConstants.space.smallEx,
    position: 'relative' as const,
  },
  profileImageWrapper: {
    width: 120,
    height: 120,
    position: 'relative' as const,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden' as const,
    borderWidth: 3,
    borderColor: CMConstants.color.green,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  editImageButton: {
    position: 'absolute' as const,
    bottom: 4,
    right: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CMConstants.color.green,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 3,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10,
  },
  inputContainer: {
    marginBottom: CMConstants.space.smallEx,
  },
  label: {
    fontFamily: CMConstants.font.semiBold,
    marginBottom: CMConstants.space.smallEx - 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    borderColor: CMConstants.color.darkGrey3,
    paddingHorizontal: CMConstants.space.normal,
  },
  inputIcon: {
    marginRight: CMConstants.space.smallEx,
    marginLeft: -6,
  },
  textInput: {
    flex: 1,
    fontFamily: CMConstants.font.regular,
    padding: 0,
  },
  buttonContainer: {
    marginTop: CMConstants.space.smallEx,
    marginBottom: CMConstants.space.normal,
  },
  createButton: {
    backgroundColor: CMConstants.color.green,
    height: CMConstants.height.buttonNormal,
    borderRadius: CMConstants.radius.normal,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: CMConstants.color.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    width: '100%',
  },
  createButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.bold,
    letterSpacing: 0.5,
    textAlign: 'center' as const,
  },
};

export default CMEditLeagueScreen;

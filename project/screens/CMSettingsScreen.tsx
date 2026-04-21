import React, {useState, useEffect, createRef} from 'react'
import {SafeAreaView, TextStyle, ScrollView, Text, View, useColorScheme, Dimensions} from 'react-native'
import { getAuth, signOut } from '@react-native-firebase/auth'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMUtils from '../utils/CMUtils'
import CMRipple from '../components/CMRipple'
import CMLocalStorageHelper from '../helper/CMLocalStorageHelper'
import CMGlobal from '../CMGlobal'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMHamburgerMenu from '../components/CMHamburgerMenu'

const CMSettingsScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const insets = useSafeAreaInsets()
	const systemColorScheme = useColorScheme()
	const [isDarkMode, setIsDarkMode] = useState(CMGlobal.themeMode === CMConstants.themeMode.dark)

	const themeMode = CMGlobal.themeMode || CMConstants.themeMode.light

	// Get screen dimensions for responsive design
	const screenWidth = Dimensions.get('window').width
	const isSmallDevice = screenWidth < 375
	const isLargeDevice = screenWidth > 414
	const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0

	useEffect(() => {
		// Load saved theme mode on mount
		CMLocalStorageHelper.getThemeMode((isSuccess: boolean, savedTheme: string) => {
			if (isSuccess) {
				CMGlobal.themeMode = savedTheme
				setIsDarkMode(savedTheme === CMConstants.themeMode.dark)
			} else {
				// Default to system preference if no saved theme
				const systemIsDark = systemColorScheme === 'dark'
				const defaultTheme = systemIsDark ? CMConstants.themeMode.dark : CMConstants.themeMode.light
				CMGlobal.themeMode = defaultTheme
				setIsDarkMode(systemIsDark)
			}
		})
	}, [])

	const onBtnChangePassword = () => {
		// Check if user is Apple Sign In user (no Firebase session but has userId)
		const hasFirebaseSession = !!getAuth().currentUser;
		const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
		
		if (isAppleSignInUser) {
			CMAlertDlgHelper.showAlertWithOK(
				'Password Change Not Available',
				'You signed in with Apple, so password changes are managed through your Apple ID settings. To change your password, please go to Settings > Apple ID > Password & Security on your device.'
			);
			return;
		}
		
		navigation.navigate(CMConstants.screenName.changePwd)
	}

	const onBtnEditProfile = () => {
		setLoading(true)
		// Use CMGlobal.user.id for Apple Sign In users, fallback to getAuth().currentUser?.uid
		const userId = CMGlobal.user?.id || getAuth().currentUser?.uid;
		if (!userId) {
			setLoading(false)
			CMAlertDlgHelper.showAlertWithOK('User ID not found. Please sign in again.')
			return
		}
		CMFirebaseHelper.getUser(userId, (response: {[name: string]: any}) => {
			setLoading(false)
			if (response.isSuccess) {
				navigation.navigate(CMConstants.screenName.editProfile, {user: response.value})
			} else {
				CMAlertDlgHelper.showAlertWithOK(response.value)
			}
		})
	}

	const onBtnLogout = () => {
		CMAlertDlgHelper.showConfirmAlert(CMConstants.appName, 'Are you sure you want to logout?', (isYes: boolean) => {
			if (isYes) {
				// Store user info before clearing (for logging/debugging)
				const userId = CMGlobal.user?.id || getAuth().currentUser?.uid;
				const hasFirebaseSession = !!getAuth().currentUser;
				const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
				
				console.log('[Logout] Starting logout process:', {
					userId,
					hasFirebaseSession,
					isAppleSignInUser,
					hasUserData: !!CMGlobal.user
				});
				
				// Function to clear all data and navigate
				const clearDataAndNavigate = () => {
					// Clear all stored data
					CMLocalStorageHelper.removeUserCredentials(() => {
						CMLocalStorageHelper.removeAppleSignInAuth(() => {
							// Clear CMGlobal data AFTER navigation is set up
							(CMGlobal as any).restApiAuth = null;
							CMGlobal.user = null;
							
							// Navigate to auth screen
							setTimeout(() => {
								try {
									if (CMGlobal.navigation) {
										CMGlobal.navigation.replace('Auth');
									} else if (navigation) {
										navigation.replace('Auth');
									} else {
										console.error('[Logout] No navigation available');
									}
								} catch (navError) {
									console.error('[Logout] Navigation error:', navError);
								}
							}, 100);
						});
					});
				};
				
				if (isAppleSignInUser) {
					// For Apple Sign In users, just clear stored data and navigate
					console.log('[Logout] Apple Sign In user - clearing stored auth data');
					clearDataAndNavigate();
				} else if (hasFirebaseSession) {
					// For regular Firebase auth users, sign out from Firebase first
					console.log('[Logout] Regular Firebase user - signing out from Firebase');
					signOut(getAuth()).then(() => {
						console.log('[Logout] Firebase signOut successful');
						clearDataAndNavigate();
					}).catch((error) => {
						console.error('[Logout] Firebase signOut error:', error);
						// Even if signOut fails, clear local data and navigate
						clearDataAndNavigate();
					});
				} else {
					// No session at all - just clear data
					console.log('[Logout] No active session - clearing stored data');
					clearDataAndNavigate();
				}
			}
		})
	}

	const toggleTheme = () => {
		const newIsDarkMode = !isDarkMode
		setIsDarkMode(newIsDarkMode)
		const newThemeMode = newIsDarkMode ? CMConstants.themeMode.dark : CMConstants.themeMode.light
		CMGlobal.themeMode = newThemeMode
		CMLocalStorageHelper.setThemeMode(newThemeMode)
		// Force re-render by updating state
		// Note: This will require app restart or navigation refresh to fully apply theme changes
	}

	const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey2
	const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const iconBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1
	const labelColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const chevronColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog
				visible={loading}
			/>
			
			<View
				style={{
					paddingTop: (CMUtils.isAndroid ? insets.top : 0) + CMConstants.space.normal,
					paddingHorizontal: CMConstants.space.normal,
					paddingBottom: CMConstants.space.smallEx,
					justifyContent: 'center',
					alignItems: 'center',
					flexDirection: 'row',
				}}
			>
				<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
						<CMHamburgerMenu
							navigation={navigation}
							themeMode={themeMode}
							currentRoute="Settings"
						/>
						<View style={{ width: CMConstants.space.small }} />
						<Text style={{ fontSize: CMConstants.fontSize.large * fontScale, fontWeight: 'bold', color: textColor }}>
							Settings
						</Text>
					</View>
					<CMRipple
						containerStyle={{
							...CMCommonStyles.circle(CMConstants.height.iconBig),
							justifyContent: 'center',
							alignItems: 'center',
							borderWidth: 1.5,
							borderColor: CMConstants.color.green,
						}}
						onPress={toggleTheme}
					>
						<Ionicons
							name={isDarkMode ? "sunny-outline" : "moon-outline"}
							size={CMConstants.height.icon * 0.8}
							color={CMConstants.color.green}
						/>
					</CMRipple>
				</View>
			</View>

			<ScrollView
				style={{flex: 1, marginHorizontal: CMConstants.space.normal}}
				nestedScrollEnabled={true}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.optionsContainer}>
					<CMRipple
						containerStyle={[styles.optionCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}
						onPress={onBtnEditProfile}
						color={CMUtils.colorWithBlackWhite(themeMode)}
					>
						<View style={styles.optionContent}>
							<View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
								<Ionicons
									name={"person-outline"}
									size={16}
									color={CMConstants.color.green}
								/>
							</View>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
								Edit Profile
							</Text>
							<Ionicons
								name={"chevron-forward-outline"}
								size={16}
								color={chevronColor}
							/>
						</View>
					</CMRipple>
					
					{/* Only show Change Password option for regular Firebase auth users, not Apple Sign In users */}
					{(() => {
						const hasFirebaseSession = !!getAuth().currentUser;
						const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
						
						// Hide Change Password for Apple Sign In users
						if (isAppleSignInUser) {
							return null;
						}
						
						return (
							<CMRipple
								containerStyle={[styles.optionCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}
								onPress={onBtnChangePassword}
								color={CMUtils.colorWithBlackWhite(themeMode)}
							>
								<View style={styles.optionContent}>
									<View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
										<Ionicons
											name={"key-outline"}
											size={16}
											color={CMConstants.color.green}
										/>
									</View>
									<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
										Change Password
									</Text>
									<Ionicons
										name={"chevron-forward-outline"}
										size={16}
										color={chevronColor}
									/>
								</View>
							</CMRipple>
						);
					})()}
					
					<CMRipple
						containerStyle={[styles.optionCard, styles.logoutCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}
						onPress={onBtnLogout}
						color={CMUtils.colorWithBlackWhite(themeMode)}
					>
						<View style={styles.optionContent}>
							<View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
								<Ionicons
									name={"log-out-outline"}
									size={16}
									color={CMConstants.color.red}
								/>
							</View>
							<Text style={[styles.label, { color: CMConstants.color.red, fontSize: CMConstants.fontSize.small * fontScale }]}>
								Logout
							</Text>
							<Ionicons
								name={"chevron-forward-outline"}
								size={16}
								color={CMConstants.color.red}
							/>
						</View>
					</CMRipple>
				</View>
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = {
	optionsContainer: {
		marginTop: CMConstants.space.smallEx,
		gap: CMConstants.space.smallEx - 4,
	},
	optionCard: {
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.smallEx,
		paddingVertical: CMConstants.space.smallEx - 2,
		marginBottom: CMConstants.space.smallEx - 4,
		borderWidth: 1,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 3,
		elevation: 2,
	},
	logoutCard: {
		borderColor: CMConstants.color.darkGrey3,
		marginTop: CMConstants.space.smallEx - 2,
	},
	optionContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	iconContainer: {
		width: 28,
		height: 28,
		borderRadius: CMConstants.radius.normal - 2,
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: CMConstants.space.smallEx,
	},
	label: {
		flex: 1,
		fontFamily: CMConstants.font.semiBold,
	},
	cell: {
		height: 50,
		...CMCommonStyles.flexRowCenter
	},
	title: (themeMode: string) => ({
		...CMCommonStyles.textNormal(themeMode),
		marginHorizontal: CMConstants.space.smallEx
	} as TextStyle),
}

export default CMSettingsScreen

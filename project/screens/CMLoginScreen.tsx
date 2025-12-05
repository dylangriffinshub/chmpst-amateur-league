import React, {useState, useEffect, createRef} from 'react'
import {View, TouchableOpacity, SafeAreaView, Text, TextStyle, Keyboard, ViewStyle, Platform, Dimensions} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import CMRipple from '../components/CMRipple'
import CMConstants from '../CMConstants'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMUtils from '../utils/CMUtils'
import { TextInput } from 'react-native'
import CMUIHelper from '../helper/CMUIHelper'
import CMLocalStorageHelper from '../helper/CMLocalStorageHelper'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMGlobal from '../CMGlobal'
import { AppleButton } from '@invertase/react-native-apple-authentication'
import Ionicons from 'react-native-vector-icons/Ionicons'

const CMLoginScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')

	const passwordInputRef: any = createRef()

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Get screen dimensions for responsive design
	const screenWidth = Dimensions.get('window').width
	const screenHeight = Dimensions.get('window').height
	const isSmallDevice = screenWidth < 375 // iPhone SE and similar
	const isLargeDevice = screenWidth > 414 // iPhone Plus and larger devices/tablets
	
	// Calculate responsive scaling factors
	const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0
	const buttonHeightScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0
	const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0

	// Load saved theme mode on mount
	useEffect(() => {
		CMLocalStorageHelper.getThemeMode((isSuccess: boolean, savedTheme: string) => {
			if (isSuccess) {
				CMGlobal.themeMode = savedTheme;
				setThemeMode(savedTheme);
			} else {
				// Keep current theme or default to light
				const currentTheme = CMGlobal.themeMode || CMConstants.themeMode.light;
				CMGlobal.themeMode = currentTheme;
				setThemeMode(currentTheme);
			}
		});
	}, []);

	// Listen for theme changes
	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
		})
		return unsubscribe
	}, [navigation])

	// Dynamic colors based on theme
	const backgroundColor = isDarkMode ? CMConstants.color.black : CMConstants.color.white
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.black
	const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey2
	const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const registerButtonBackground = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white

	useEffect(() => {
		// Load saved theme mode on mount
		CMLocalStorageHelper.getThemeMode((isSuccess: boolean, savedTheme: string) => {
			if (isSuccess) {
				CMGlobal.themeMode = savedTheme;
				setThemeMode(savedTheme);
			} else {
				// Keep current theme or default to light
				const currentTheme = CMGlobal.themeMode || CMConstants.themeMode.light;
				CMGlobal.themeMode = currentTheme;
				setThemeMode(currentTheme);
			}
		});
	}, []);

	useEffect(() => {
		CMUIHelper.updateStatusBarStyle(themeMode)
		CMGlobal.navigation = navigation
		autoLogin()
	}, [themeMode])

	const autoLogin = () => {
		CMLocalStorageHelper.getUserCredentials((isSuccess: boolean, credentials: any) => {
			if (isSuccess) {
				// Check if this is Apple Sign In user
				if (credentials.isAppleSignIn) {
					// Restore Apple Sign In session
					restoreAppleSignInSession(credentials)
				} else {
					// Regular Firebase auth user
					login(credentials)
				}
			}
		})
	}

	const restoreAppleSignInSession = async (credentials: any) => {
		setLoading(true)
		try {
			// Load Apple Sign In auth tokens
			CMLocalStorageHelper.getAppleSignInAuth((authSuccess: boolean, authData: any) => {
				if (!authSuccess || !authData || !authData.idToken) {
					console.log('[Auto Login] No Apple Sign In auth data found');
					setLoading(false)
					return
				}

				// Restore auth data to CMGlobal
				(CMGlobal as any).restApiAuth = authData

				// Load user data from Firestore
				CMFirebaseHelper.getUser(credentials.userId || authData.userId, (response: {[name: string]: any}) => {
					setLoading(false)
					if (response.isSuccess) {
						// Restore user data to CMGlobal
						CMGlobal.user = response.value
						
						console.log('[Auto Login] Apple Sign In session restored successfully');
						
						// Navigate to main app
						setTimeout(() => {
							try {
								navigation.replace('CMCoachStackNavigatorRoutes')
								console.log('[Auto Login] Navigation successful');
							} catch (navError: any) {
								console.error('[Auto Login] Navigation error:', navError);
							}
						}, 100)
					} else {
						console.log('[Auto Login] Failed to load user data:', response.value);
						// Clear invalid credentials
						CMLocalStorageHelper.removeUserCredentials(() => {})
						CMLocalStorageHelper.removeAppleSignInAuth(() => {})
					}
				})
			})
		} catch (error: any) {
			console.error('[Auto Login] Error restoring Apple Sign In session:', error);
			setLoading(false)
		}
	}

	const login = (credentials: any) => {
		setLoading(true)
		try {
			CMFirebaseHelper.login(credentials.email, credentials.password, (response: {[name: string]: any}) => {
				setLoading(false)
				if (response.isSuccess) {
					CMLocalStorageHelper.setUserCredentials({email: credentials.email, password: credentials.password})
					try {
						navigation.replace('CMCoachStackNavigatorRoutes')
					} catch (navError) {
						console.error('Navigation error:', navError)
						CMAlertDlgHelper.showAlertWithOK('Failed to navigate. Please try again.')
					}
				} else {
					CMAlertDlgHelper.showAlertWithOK(response.value || 'Login failed. Please try again.')
				}
			})
		} catch (error) {
			console.error('Login error:', error)
			setLoading(false)
			CMAlertDlgHelper.showAlertWithOK('An unexpected error occurred. Please try again.')
		}
	}

	const onBtnLogin = () => {
		if (!CMUtils.isValidEmail(email)) {
			CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterValidEmail)
			return
		}

		if (password.length == 0) {
			CMAlertDlgHelper.showAlertWithOK('Please enter the password.')
			return
		}
		
		login({email: email, password: password})
	}

	const onBtnForgotPassword = () => {
		if (!CMUtils.isValidEmail(email)) {
			CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterValidEmail)
			return
		}

		setLoading(true)
		CMFirebaseHelper.forgotPassword(email, (response: {[name: string]: any}) => {
			setLoading(false)
			CMAlertDlgHelper.showAlertWithOK(response.value)
		})
	}

	const onBtnRegister = () => {
		navigation.navigate(CMConstants.screenName.register)
	}

	const onBtnAppleSignIn = async () => {
		setLoading(true)
		try {
			// Add a small delay to ensure button press is registered
			await new Promise(resolve => setTimeout(resolve, 50))
			
			CMFirebaseHelper.signInWithApple((response: {[name: string]: any}) => {
				setLoading(false)
				
				// Log to console for debugging
				console.log('[Login Screen] Apple Sign In callback received:', {
					isSuccess: response?.isSuccess,
					isNewUser: response?.isNewUser,
					hasValue: !!response?.value,
					hasWarning: !!response?.warning,
					userId: response?.value?.uid || 'N/A'
				});
				
				// Debug: Show response to see what we got
				if (!response || typeof response !== 'object') {
					console.error('[Login Screen] Invalid response:', response);
					CMAlertDlgHelper.showAlertWithOK(`Invalid response received:\n${JSON.stringify(response)}`)
					return
				}
				
				if (response.isSuccess) {
					console.log('[Login Screen] Sign in successful, navigating to main app...');
					// Successfully signed in - navigate to main app
					// Use setTimeout to ensure UI is ready for navigation
					setTimeout(() => {
						try {
							navigation.replace('CMCoachStackNavigatorRoutes')
							console.log('[Login Screen] Navigation successful');
						} catch (navError: any) {
							console.error('[Login Screen] Navigation error:', navError);
							CMAlertDlgHelper.showAlertWithOK(`Navigation Error:\n${navError.message || 'Unknown navigation error'}`)
						}
					}, 100)
				} else {
					console.error('[Login Screen] Sign in failed:', response.value);
					// Only show error if it wasn't cancelled (errors are already shown in helper)
					if (!response.value || !response.value.toLowerCase().includes('cancelled')) {
						// Don't show alert here - it's already shown in the helper
						// Just log to console
					}
				}
			})
		} catch (error: any) {
			setLoading(false)
			CMAlertDlgHelper.showAlertWithOK(`Unexpected Error:\n${error.message || 'Unknown error occurred'}\n\nStack: ${error.stack || 'No stack trace'}`)
		}
	}

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog
				visible={loading}
			/>
            <KeyboardAwareScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.container}
			>
				<View style={styles.content}>
					{/* Title */}
					<View style={styles.titleContainer}>
						<Text style={[styles.title, { 
							color: textColor,
							fontSize: (CMConstants.fontSize.largeEx * 1.2) * fontScale
						}]}>
							Login as coach
						</Text>
					</View>

					{/* Email Input */}
					<View style={styles.inputContainer}>
						<Text style={[styles.label, { 
							color: labelColor,
							fontSize: CMConstants.fontSize.small * fontScale
						}]}>EMAIL</Text>
						<View style={[styles.inputWrapper, { 
							backgroundColor: inputBackgroundColor, 
							borderColor: cardBorderColor,
							minHeight: 40 * buttonHeightScale,
							paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
						}]}>
							<Ionicons
								name="mail-outline"
								size={20 * iconScale}
								color={CMConstants.color.green}
								style={styles.inputIcon}
							/>
							<TextInput
								style={[styles.textInput, { 
									color: inputTextColor,
									fontSize: CMConstants.fontSize.normal * fontScale
								}]}
								onChangeText={text => setEmail(text)}
								value={email}
								placeholder="Enter your email"
								placeholderTextColor={placeholderColor}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="next"
						onSubmitEditing={() =>
							passwordInputRef.current && passwordInputRef.current.focus()
						}
								underlineColorAndroid="transparent"
						blurOnSubmit={false}
					/>
						</View>
					</View>

					{/* Password Input */}
					<View style={styles.inputContainer}>
						<Text style={[styles.label, { 
							color: labelColor,
							fontSize: CMConstants.fontSize.small * fontScale
						}]}>PASSWORD</Text>
						<View style={[styles.inputWrapper, { 
							backgroundColor: inputBackgroundColor, 
							borderColor: cardBorderColor,
							minHeight: 40 * buttonHeightScale,
							paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
						}]}>
							<Ionicons
								name="lock-closed-outline"
								size={20 * iconScale}
								color={CMConstants.color.green}
								style={styles.inputIcon}
							/>
							<TextInput
								style={[styles.textInput, { 
									color: inputTextColor,
									fontSize: CMConstants.fontSize.normal * fontScale
								}]}
								onChangeText={text => setPassword(text)}
								value={password}
								placeholder="Enter your password"
								placeholderTextColor={placeholderColor}
							keyboardType="default"
							ref={passwordInputRef}
							onSubmitEditing={Keyboard.dismiss}
							blurOnSubmit={false}
							secureTextEntry={true}
								underlineColorAndroid="transparent"
							returnKeyType="done"
						/>
						</View>
					</View>

					{/* Forgot Password Link */}
					<TouchableOpacity
						style={styles.forgotPassword}
						activeOpacity={0.7}
						onPress={onBtnForgotPassword}
					>
						<Text style={[styles.forgotPasswordText, {
							fontSize: CMConstants.fontSize.small * fontScale
						}]}>
							Forgot Password?
						</Text>
					</TouchableOpacity>

					{/* Login Button */}
					<CMRipple
						containerStyle={[styles.loginButton, {
							height: CMConstants.height.buttonNormal * buttonHeightScale
						}]}
						onPress={onBtnLogin}
						color={CMConstants.color.white}
					>
						<Text style={[styles.loginButtonText, {
							fontSize: CMConstants.fontSize.normal * fontScale
						}]}>Login</Text>
					</CMRipple>

					{/* Register Button */}
					<CMRipple
						containerStyle={[styles.registerButton, { 
							backgroundColor: registerButtonBackground, 
							borderColor: CMConstants.color.green,
							height: CMConstants.height.buttonNormal * buttonHeightScale
						}]}
						onPress={onBtnRegister}
						color={CMConstants.color.green}
					>
						<Text style={[styles.registerButtonText, {
							fontSize: CMConstants.fontSize.normal * fontScale
						}]}>Register</Text>
					</CMRipple>
					
					{/* Apple Sign In */}
					{Platform.OS === 'ios' && (
						<View style={styles.appleButtonContainer}>
							<AppleButton
								buttonStyle={isDarkMode ? AppleButton.Style.WHITE : AppleButton.Style.BLACK}
								buttonType={AppleButton.Type.CONTINUE}
								style={[styles.appleButtonNative, {
									height: CMConstants.height.buttonNormal * buttonHeightScale
								}]}
								onPress={onBtnAppleSignIn}
							/>
						</View>
					)}
				</View>
            </KeyboardAwareScrollView>
		</SafeAreaView>
	)
}

const styles = {
	container: {
		flexGrow: 1,
		paddingHorizontal: CMConstants.space.normal,
		paddingVertical: CMConstants.space.large,
	},
	content: {
		flex: 1,
		justifyContent: 'center' as const,
	},
	titleContainer: {
		marginBottom: CMConstants.space.large,
		alignItems: 'center' as const,
	},
	title: {
		// fontSize is now set dynamically in component
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.5,
	},
	inputContainer: {
		marginBottom: CMConstants.space.normal,
	},
	label: {
		// fontSize is now set dynamically in component
		fontFamily: CMConstants.font.semiBold,
		marginBottom: CMConstants.space.smallEx,
		textTransform: 'uppercase' as const,
		letterSpacing: 0.5,
	},
	inputWrapper: {
		flexDirection: 'row' as const,
		alignItems: 'center' as const,
		borderRadius: CMConstants.radius.normal,
		borderWidth: 1,
		paddingHorizontal: CMConstants.space.normal,
		// paddingVertical and minHeight are now set dynamically in component
	},
	inputIcon: {
		marginRight: CMConstants.space.smallEx,
		marginLeft: -6,
	},
	textInput: {
		flex: 1,
		// fontSize is now set dynamically in component
		fontFamily: CMConstants.font.regular,
		padding: 0,
	},
	forgotPassword: {
		alignSelf: 'flex-end' as const,
		marginTop: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.normal,
	},
	forgotPasswordText: {
		// fontSize is now set dynamically in component
		fontFamily: CMConstants.font.regular,
		color: CMConstants.color.green,
	},
	loginButton: {
		backgroundColor: CMConstants.color.green,
		// height is now set dynamically in component
		borderRadius: CMConstants.radius.normal,
		justifyContent: 'center' as const,
		alignItems: 'center' as const,
		marginTop: CMConstants.space.normal,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 6,
		width: '100%',
	},
	loginButtonText: {
		color: CMConstants.color.white,
		// fontSize is now set dynamically in component
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.5,
	},
	registerButton: {
		// height is now set dynamically in component
		borderRadius: CMConstants.radius.normal,
		justifyContent: 'center' as const,
		alignItems: 'center' as const,
		marginTop: CMConstants.space.normal,
		borderWidth: 2,
		width: '100%',
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	},
	registerButtonText: {
		color: CMConstants.color.green,
		// fontSize is now set dynamically in component
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.5,
	},
	appleButtonContainer: {
		marginTop: CMConstants.space.normal,
		width: '100%',
		alignItems: 'center' as const,
	} as ViewStyle,
	appleButtonNative: {
		width: '100%',
		// height is now set dynamically in component
		borderRadius: CMConstants.radius.normal,
		overflow: 'hidden' as const,
	} as ViewStyle
}

export default CMLoginScreen

import React, {useState, createRef, useEffect} from 'react'
import {View, SafeAreaView, Text, Keyboard, Dimensions} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import CMRipple from '../components/CMRipple'
import CMConstants from '../CMConstants'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import { TextInput } from 'react-native'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMLocalStorageHelper from '../helper/CMLocalStorageHelper'
import CMGlobal from '../CMGlobal'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getAuth } from '@react-native-firebase/auth'

const CMChangePwdScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const [curPassword, setCurPassword] = useState('')
	const [password, setPassword] = useState('')
	const [passwordConfirm, setPasswordConfirm] = useState('')
	const insets = useSafeAreaInsets()

	const passwordInputRef: any = createRef()
	const passwordConfirmInputRef: any = createRef()

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Get screen dimensions for responsive design
	const screenWidth = Dimensions.get('window').width
	const isSmallDevice = screenWidth < 375
	const isLargeDevice = screenWidth > 414
	
	// Calculate responsive scaling factors
	const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0
	const buttonHeightScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0
	const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0

	// Listen for theme changes
	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
		})
		return unsubscribe
	}, [navigation])

	// Check if user is Apple Sign In user and redirect if so
	useEffect(() => {
		const hasFirebaseSession = !!getAuth().currentUser;
		const isAppleSignInUser = CMGlobal.user?.id && !hasFirebaseSession;
		
		if (isAppleSignInUser) {
			// User is Apple Sign In user - show message and navigate back
			CMAlertDlgHelper.showAlertWithOK(
				'Password Change Not Available',
				'You signed in with Apple, so password changes are managed through your Apple ID settings. To change your password, please go to Settings > Apple ID > Password & Security on your device.',
				() => {
					navigation.goBack();
				}
			);
		}
	}, [navigation])

	// Dynamic colors based on theme
	const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey2
	const inputBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey

	useEffect(() => {
		navigation.setOptions({
			headerStyle: {
				backgroundColor: headerBackgroundColor,
			},
			headerTintColor: headerTextColor,
			headerTitleStyle: {
				color: headerTextColor,
				fontSize: CMConstants.fontSize.large * fontScale,
				fontWeight: 'bold',
				marginLeft: CMConstants.space.smallEx,
			},
		})
	}, [navigation, themeMode, headerBackgroundColor, headerTextColor, fontScale])

	const onBtnUpdate = () => {
		if (curPassword.length < 6) {
			CMAlertDlgHelper.showAlertWithOK('Password must be at least 6 characters long.')
			return
		}

		if (password.length < 6) {
			CMAlertDlgHelper.showAlertWithOK('Password must be at least 6 characters long.')
			return
		}

		if (password != passwordConfirm) {
			CMAlertDlgHelper.showAlertWithOK("Passwords don't match.")
			return
		}

		CMLocalStorageHelper.getUserCredentials((isSuccess: boolean, credentials: any) => {
			if (isSuccess) {
				if (curPassword != credentials.password) {
					CMAlertDlgHelper.showAlertWithOK('Current password is incorrect.')
					return
				}

				setLoading(true)
				CMFirebaseHelper.updateUserPassword(password, (response: {[name: string]: any}) => {
					setLoading(false)
					if (response.isSuccess) {
						credentials['password'] = password
						CMLocalStorageHelper.setUserCredentials(credentials)
						CMAlertDlgHelper.showAlertWithOK(response.value, () => {
							navigation.pop()
						})
					} else {
						CMAlertDlgHelper.showAlertWithOK(response.value)
					}
				})
			} else {
				CMAlertDlgHelper.showAlertWithOK('Failed to change password.')
			}
		})
	}

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog
				visible={loading}
			/>
			<KeyboardAwareScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={[CMCommonStyles.body, { paddingBottom: insets.bottom + CMConstants.space.normal }]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.container}>
					{/* Form Fields */}
					<View style={styles.formContainer}>
						{/* Current Password Field */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>Current Password</Text>
							<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
								<Ionicons
									name={"lock-closed-outline"}
									size={20 * iconScale}
									color={CMConstants.color.green}
									style={styles.inputIcon}
								/>
								<TextInput
									style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
									onChangeText={text => setCurPassword(text)}
									value={curPassword}
									placeholder="Enter current password"
									placeholderTextColor={placeholderColor}
									keyboardType="default"
									returnKeyType="next"
									onSubmitEditing={() =>
										passwordInputRef.current && passwordInputRef.current.focus()
									}
									blurOnSubmit={false}
									secureTextEntry={true}
									underlineColorAndroid="transparent"
								/>
							</View>
						</View>

						{/* New Password Field */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>Password</Text>
							<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
								<Ionicons
									name={"key-outline"}
									size={20 * iconScale}
									color={CMConstants.color.green}
									style={styles.inputIcon}
								/>
								<TextInput
									ref={passwordInputRef}
									style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
									onChangeText={text => setPassword(text)}
									value={password}
									placeholder="Enter new password"
									placeholderTextColor={placeholderColor}
									keyboardType="default"
									returnKeyType="next"
									onSubmitEditing={() =>
										passwordConfirmInputRef.current && passwordConfirmInputRef.current.focus()
									}
									blurOnSubmit={false}
									secureTextEntry={true}
									underlineColorAndroid="transparent"
								/>
							</View>
						</View>

						{/* Confirm Password Field */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>Confirm Password</Text>
							<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
								<Ionicons
									name={"checkmark-circle-outline"}
									size={20 * iconScale}
									color={CMConstants.color.green}
									style={styles.inputIcon}
								/>
								<TextInput
									ref={passwordConfirmInputRef}
									style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
									onChangeText={text => setPasswordConfirm(text)}
									value={passwordConfirm}
									placeholder="Confirm new password"
									placeholderTextColor={placeholderColor}
									keyboardType="default"
									returnKeyType="done"
									onSubmitEditing={Keyboard.dismiss}
									blurOnSubmit={false}
									secureTextEntry={true}
									underlineColorAndroid="transparent"
								/>
							</View>
						</View>
					</View>

					{/* Update Button */}
					<View style={styles.buttonContainer}>
						<CMRipple
							containerStyle={[styles.updateButton, { height: CMConstants.height.buttonNormal * buttonHeightScale }]}
							onPress={onBtnUpdate}
						>
							<Text style={[styles.updateButtonText, { fontSize: CMConstants.fontSize.normal * fontScale }]}>Update</Text>
						</CMRipple>
					</View>
				</View>
			</KeyboardAwareScrollView>
		</SafeAreaView>
	)
}

const styles = {
	container: {
		flex: 1,
		paddingHorizontal: CMConstants.space.smallEx,
		paddingTop: CMConstants.space.normal,
		paddingBottom: CMConstants.space.normal,
	},
	formContainer: {
		marginBottom: CMConstants.space.normal,
	},
	inputGroup: {
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
		paddingHorizontal: CMConstants.space.normal,
		borderWidth: 1,
	},
	inputIcon: {
		marginRight: CMConstants.space.smallEx,
		marginLeft: -4,
	},
	textInput: {
		flex: 1,
		fontFamily: CMConstants.font.regular,
		padding: 0,
		paddingVertical: 2,
	},
	buttonContainer: {
		marginTop: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.normal,
	},
	updateButton: {
		backgroundColor: CMConstants.color.green,
		borderRadius: CMConstants.radius.normal,
		justifyContent: 'center' as const,
		alignItems: 'center' as const,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	},
	updateButtonText: {
		color: CMConstants.color.white,
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.5,
	},
}

export default CMChangePwdScreen

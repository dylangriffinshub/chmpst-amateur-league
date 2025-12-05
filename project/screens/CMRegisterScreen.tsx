import React, {useState, useEffect, createRef} from 'react'
import {View, TouchableOpacity, SafeAreaView, Text, TextStyle, Keyboard, ViewStyle, Dimensions} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import CMRipple from '../components/CMRipple'
import CMConstants from '../CMConstants'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMUtils from '../utils/CMUtils'
import { TextInput } from 'react-native'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMUserRole from '../model/CMUserRole'
import CMLocalStorageHelper from '../helper/CMLocalStorageHelper'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMGlobal from '../CMGlobal'

const CMRegisterScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [passwordConfirm, setPasswordConfirm] = useState('')
	const [name, setName] = useState('')

	const passwordInputRef: any = createRef()
	const passwordConfirmInputRef: any = createRef()
	const nameInputRef: any = createRef()

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
	const headerBackgroundColor = isDarkMode ? CMConstants.color.black : CMConstants.color.white
	const headerIconColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black

	const onBtnRegister = () => {
		if (!CMUtils.isValidEmail(email)) {
			CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterValidEmail)
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

		if (name.trim().length == 0) {
			CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterYourName)
			return
		}

		setLoading(true)
		CMFirebaseHelper.register(email, password, (response: {[name: string]: any}) => {
			if (response.isSuccess) {
				CMFirebaseHelper.setUser({
					id: response.value.uid,
					email: email,
					name: name.trim(),
					role: CMUserRole.coach 
				}, (response: {[name: string]: any}) => {
					setLoading(false)
					if (response.isSuccess) {
						CMLocalStorageHelper.setUserCredentials({email: email, password: password})
						navigation.replace('CMCoachStackNavigatorRoutes')
					} else {
						CMAlertDlgHelper.showAlertWithOK(response.value)
					}
				})
			} else {
				setLoading(false)
				CMAlertDlgHelper.showAlertWithOK(response.value)
			}
		})
	}

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog
				visible={loading}
			/>
			
			{/* Custom Header */}
			<View style={[styles.header, { backgroundColor: headerBackgroundColor }]}>
				<CMRipple
					containerStyle={styles.backButton}
					onPress={() => navigation.goBack()}
					color={isDarkMode ? CMConstants.color.white : CMConstants.color.black}
				>
					<Ionicons
						name="arrow-back"
						size={CMConstants.height.iconBig}
						color={headerIconColor}
					/>
				</CMRipple>
				<Text style={[styles.headerTitle, { 
					color: textColor,
					fontSize: CMConstants.fontSize.largeEx * fontScale
				}]}>
					Register as coach
				</Text>
				<View style={{ width: CMConstants.height.iconBig }} />
			</View>

            <KeyboardAwareScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.container}
			>
				<View style={styles.content}>

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
								ref={passwordInputRef}
								style={[styles.textInput, { 
									color: inputTextColor,
									fontSize: CMConstants.fontSize.normal * fontScale
								}]}
								onChangeText={text => setPassword(text)}
								value={password}
								placeholder="Enter your password"
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

					{/* Confirm Password Input */}
					<View style={styles.inputContainer}>
						<Text style={[styles.label, { 
							color: labelColor,
							fontSize: CMConstants.fontSize.small * fontScale
						}]}>CONFIRM PASSWORD</Text>
						<View style={[styles.inputWrapper, { 
							backgroundColor: inputBackgroundColor, 
							borderColor: cardBorderColor,
							minHeight: 40 * buttonHeightScale,
							paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
						}]}>
							<Ionicons
								name="checkmark-circle-outline"
								size={20 * iconScale}
								color={CMConstants.color.green}
								style={styles.inputIcon}
							/>
							<TextInput
								ref={passwordConfirmInputRef}
								style={[styles.textInput, { 
									color: inputTextColor,
									fontSize: CMConstants.fontSize.normal * fontScale
								}]}
								onChangeText={text => setPasswordConfirm(text)}
								value={passwordConfirm}
								placeholder="Confirm your password"
								placeholderTextColor={placeholderColor}
								keyboardType="default"
								returnKeyType="next"
								onSubmitEditing={() =>
									nameInputRef.current && nameInputRef.current.focus()
								}
								blurOnSubmit={false}
								secureTextEntry={true}
								underlineColorAndroid="transparent"
							/>
						</View>
					</View>

					{/* Name Input */}
					<View style={styles.inputContainer}>
						<Text style={[styles.label, { 
							color: labelColor,
							fontSize: CMConstants.fontSize.small * fontScale
						}]}>NAME</Text>
						<View style={[styles.inputWrapper, { 
							backgroundColor: inputBackgroundColor, 
							borderColor: cardBorderColor,
							minHeight: 40 * buttonHeightScale,
							paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale
						}]}>
							<Ionicons
								name="person-outline"
								size={20 * iconScale}
								color={CMConstants.color.green}
								style={styles.inputIcon}
							/>
							<TextInput
								ref={nameInputRef}
								style={[styles.textInput, { 
									color: inputTextColor,
									fontSize: CMConstants.fontSize.normal * fontScale
								}]}
								onChangeText={text => setName(text)}
								value={name}
								placeholder="Enter your name"
								placeholderTextColor={placeholderColor}
								autoCapitalize="words"
								autoCorrect={false}
								returnKeyType="done"
								onSubmitEditing={Keyboard.dismiss}
								underlineColorAndroid="transparent"
								blurOnSubmit={false}
							/>
						</View>
					</View>

					{/* Register Button */}
					<CMRipple
						containerStyle={[styles.registerButton, {
							height: CMConstants.height.buttonNormal * buttonHeightScale
						}]}
						onPress={onBtnRegister}
						color={CMConstants.color.white}
					>
						<Text style={[styles.registerButtonText, {
							fontSize: CMConstants.fontSize.normal * fontScale
						}]}>Register</Text>
					</CMRipple>
				</View>
            </KeyboardAwareScrollView>
		</SafeAreaView>
	)
}

const styles = {
	header: {
		flexDirection: 'row' as const,
		alignItems: 'center' as const,
		justifyContent: 'space-between' as const,
		paddingHorizontal: CMConstants.space.normal,
		paddingTop: CMConstants.space.normal,
		paddingBottom: CMConstants.space.small,
	},
	backButton: {
		width: CMConstants.height.iconBig,
		height: CMConstants.height.iconBig,
		justifyContent: 'center' as const,
		alignItems: 'center' as const,
	},
	headerTitle: {
		// fontSize is now set dynamically in component
		fontFamily: CMConstants.font.bold,
		flex: 1,
		textAlign: 'center' as const,
	},
	container: {
		flexGrow: 1,
		paddingHorizontal: CMConstants.space.normal,
		paddingVertical: CMConstants.space.large,
	},
	content: {
		flex: 1,
		justifyContent: 'center' as const,
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
	registerButton: {
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
	registerButtonText: {
		color: CMConstants.color.white,
		// fontSize is now set dynamically in component
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.5,
	},
}

export default CMRegisterScreen

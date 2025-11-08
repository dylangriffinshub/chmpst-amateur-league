import React, {useState, useEffect} from 'react'
import { Text, StyleSheet, View, TextInput, Keyboard } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CMConstants from '../CMConstants'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMRipple from '../components/CMRipple'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMGlobal from '../CMGlobal'

const CMAddLeagueModalContent = (props: any) => {
	const [code, setCode] = useState('')

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Update theme when component mounts or theme changes
	useEffect(() => {
		setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
	}, [])

	// Dynamic colors based on theme
	const modalBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const modalBorderColor = CMConstants.color.green // Always green
	const titleColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const labelColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1
	const inputBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const orTextColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const createButtonBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const cancelButtonBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const cancelButtonBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const cancelButtonTextColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey

	const insets = useSafeAreaInsets()
	

	useEffect(() => {
	}, [])

	return (
		<View style={styles.modalContainer}>
			<KeyboardAwareScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.scrollContent}>
				<View style={[styles.modalContent, { backgroundColor: modalBackgroundColor, borderColor: modalBorderColor }]}>
					<Text style={[styles.title, { color: titleColor }]}>
						Enter code to join
					</Text>
					<Text style={[styles.label, { color: labelColor }]}>
						Code
					</Text>
					<TextInput
						style={[styles.textInput, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, color: inputTextColor }]}
						onChangeText={text => setCode(text)}
						value={code}
						placeholder="Enter league code"
						placeholderTextColor={placeholderColor}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="done"
						onSubmitEditing={Keyboard.dismiss}
						underlineColorAndroid="transparent"
						submitBehavior='submit'
					/>
					<CMRipple
						containerStyle={styles.joinButton}
						onPress={() => {
							if (code.trim().length == 0) {
								CMAlertDlgHelper.showAlertWithOK('Please enter the code.')
								return
							}
							props.callback(1, code)
						}}
					>
						<Text style={styles.joinButtonText}>Join</Text>
					</CMRipple>
					<Text style={[styles.orText, { color: orTextColor }]}>
						or
					</Text>
					<CMRipple
						containerStyle={[styles.createButton, { backgroundColor: createButtonBackgroundColor }]}
						onPress={() => {
							props.callback(2)
						}}
					>
						<Text style={styles.createButtonText}>Create League</Text>
					</CMRipple>
					{!props.isAdmin && CMConstants.featureFlags?.leagueCreationStage === 'subscription_required' ? (
						<CMRipple
							containerStyle={[styles.paywallButton, { backgroundColor: createButtonBackgroundColor }]}
							onPress={() => {
								props.callback(3)
							}}
						>
							<Text style={styles.paywallButtonText}>View League Plans</Text>
						</CMRipple>
					) : null}
					<CMRipple
						containerStyle={[styles.cancelButton, { backgroundColor: cancelButtonBackgroundColor, borderColor: cancelButtonBorderColor }]}
						onPress={() => {
							props.callback(0)
						}}
					>
						<Text style={[styles.cancelButtonText, { color: cancelButtonTextColor }]}>Cancel</Text>
					</CMRipple>
				</View>
			</KeyboardAwareScrollView>
		</View>
	)
}

export default CMAddLeagueModalContent

const styles = StyleSheet.create({
	modalContainer: {
		marginHorizontal: CMConstants.space.normal + CMConstants.space.small,
		maxWidth: 300,
		alignSelf: 'center',
		width: '100%',
	},
	scrollContent: {
		flexGrow: 1,
		justifyContent: 'center',
	},
	modalContent: {
		borderRadius: CMConstants.radius.normal,
		paddingHorizontal: CMConstants.space.normal,
		paddingVertical: CMConstants.space.normal,
		borderWidth: 1.5,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 6,
	},
	title: {
		fontSize: CMConstants.fontSize.large,
		fontFamily: CMConstants.font.bold,
		marginTop: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.smallEx,
		textAlign: 'center',
	},
	label: {
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.semiBold,
		marginTop: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.smallEx - 2,
	},
	textInput: {
		height: CMConstants.height.textInput * 0.9,
		paddingHorizontal: CMConstants.space.smallEx,
		borderWidth: 1.5,
		borderRadius: CMConstants.radius.smallEx,
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.regular,
		marginTop: 2,
	},
	joinButton: {
		backgroundColor: CMConstants.color.green,
		borderWidth: 0,
		height: CMConstants.height.buttonNormal * 0.9,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: CMConstants.radius.smallEx,
		marginTop: CMConstants.space.smallEx,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 3,
		elevation: 3,
	},
	joinButtonText: {
		color: CMConstants.color.white,
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.3,
	},
	orText: {
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.regular,
		alignSelf: 'center',
		marginTop: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.smallEx - 2,
	},
	createButton: {
		borderWidth: 1.5,
		borderColor: CMConstants.color.green,
		height: CMConstants.height.buttonNormal * 0.9,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: CMConstants.radius.smallEx,
		marginTop: CMConstants.space.smallEx - 2,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 3,
		elevation: 3,
	},
	createButtonText: {
		color: CMConstants.color.green,
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.2,
	},
	paywallButton: {
		borderWidth: 1.5,
		borderColor: CMConstants.color.darkCerulean,
		height: CMConstants.height.buttonNormal * 0.9,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: CMConstants.radius.smallEx,
		marginTop: CMConstants.space.smallEx - 2,
	},
	paywallButtonText: {
		color: CMConstants.color.darkCerulean,
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.2,
	},
	cancelButton: {
		borderWidth: 1.5,
		height: CMConstants.height.buttonNormal * 0.9,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: CMConstants.radius.smallEx,
		marginTop: CMConstants.space.smallEx - 2,
	},
	cancelButtonText: {
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.semiBold,
		letterSpacing: 0.2,
	},
})

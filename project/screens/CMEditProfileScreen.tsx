import React, {useState, useEffect, useRef} from 'react'
import {View, SafeAreaView, Text, Keyboard, Dimensions, ActivityIndicator} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Ionicons from 'react-native-vector-icons/Ionicons'
import DatePicker from 'react-native-neat-date-picker'
import CMRipple from '../components/CMRipple'
import CMConstants from '../CMConstants'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import { TextInput } from 'react-native'
import CMGlobal from '../CMGlobal'
import CMUtils from '../utils/CMUtils'
import CMImagePicker from '../helper/CMImagePicker'
import { getAuth } from '@react-native-firebase/auth'
import { Timestamp } from '@react-native-firebase/firestore'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMLocalStorageHelper from '../helper/CMLocalStorageHelper'
import CMProgressiveImage from '../components/CMProgressiveImage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CMDropDownPicker from '../components/CMDropDownPicker'
import {
	getCityOptions,
	getCountryLabel,
	getCountryOptions,
	getStateOptions,
	resolveInitialCountryCode,
	type CMLocationOption,
} from '../helper/CMLocationService'

const CMEditProfileScreen = ({navigation, route}: CMNavigationProps) => {
	const currentUser = route?.params?.user || CMGlobal.user || {}
	const [loading, setLoading] = useState(false)
	const insets = useSafeAreaInsets()

	const [profileImagePath, setProfileImagePath] = useState(currentUser.avatar ?? '')
	const [profileImageChanged, setProfileImageChanged] = useState(false)
	const [name, setName] = useState(currentUser.name ?? '')
	const [email, setEmail] = useState(currentUser.email ?? '')
	const [countryOpen, setCountryOpen] = useState(false)
	const [stateOpen, setStateOpen] = useState(false)
	const [cityOpen, setCityOpen] = useState(false)
	const [countryCode, setCountryCode] = useState(resolveInitialCountryCode(currentUser.countryCode, currentUser.country))
	const [stateCode, setStateCode] = useState((currentUser.stateCode ?? '').toUpperCase())
	const [city, setCity] = useState(currentUser.city ?? '')
	const [countryItems, setCountryItems] = useState<CMLocationOption[]>([])
	const [stateItems, setStateItems] = useState<CMLocationOption[]>([])
	const [cityItems, setCityItems] = useState<CMLocationOption[]>([])
	const [loadingCountries, setLoadingCountries] = useState(false)
	const [loadingStates, setLoadingStates] = useState(false)
	const [loadingCities, setLoadingCities] = useState(false)
	const hasShownLocationErrorRef = useRef(false)
	const initialStateNameRef = useRef(currentUser.state ?? '')
	const initialCityNameRef = useRef(currentUser.city ?? '')
	const didHydrateInitialStateRef = useRef(Boolean(currentUser.stateCode))
	const didHydrateInitialCityRef = useRef(false)
	
	// Helper function to safely convert birthDate to Date object
	// Handles Firestore Timestamp, JavaScript Date, string, or undefined/null
	const convertBirthDateToDate = (birthDateValue: any): Date | undefined => {
		if (!birthDateValue) {
			return undefined;
		}
		
		// If it's already a Date object, return it
		if (birthDateValue instanceof Date) {
			return birthDateValue;
		}
		
		// If it's a Firestore Timestamp (has toDate method), convert it
		if (birthDateValue && typeof birthDateValue.toDate === 'function') {
			return birthDateValue.toDate();
		}
		
		// If it's a string, try to parse it
		if (typeof birthDateValue === 'string') {
			const parsed = new Date(birthDateValue);
			if (!isNaN(parsed.getTime())) {
				return parsed;
			}
		}
		
		// If it's a number (timestamp), convert it
		if (typeof birthDateValue === 'number') {
			return new Date(birthDateValue);
		}
		
		return undefined;
	};
	
	const [birthDate, setBirthDate] = useState(convertBirthDateToDate(currentUser.birthDate))
	const [showDatePicker, setShowDatePicker] = useState(false)

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

	// Dynamic colors based on theme
	const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey2
	const inputBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const dateTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const chevronColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const deleteButtonBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const editImageButtonBorderColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const spinnerColor = CMConstants.color.green
	const isLocationLoading = loadingCountries || loadingStates || loadingCities

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

	useEffect(() => {
		let isMounted = true

		const loadCountries = async () => {
			setLoadingCountries(true)
			try {
				const options = await getCountryOptions()
				if (!isMounted) {
					return
				}
				setCountryItems(options)
				if (!countryCode && options.length > 0) {
					setCountryCode(options[0].value)
				}
			} catch (error: any) {
				if (!isMounted || hasShownLocationErrorRef.current) {
					return
				}
				hasShownLocationErrorRef.current = true
				CMAlertDlgHelper.showAlertWithOK(error?.message || 'Unable to load countries right now.')
			} finally {
				if (isMounted) {
					setLoadingCountries(false)
				}
			}
		}

		loadCountries()

		return () => {
			isMounted = false
		}
	}, [])

	useEffect(() => {
		let isMounted = true

		const loadStates = async () => {
			if (!countryCode) {
				setLoadingStates(false)
				setStateItems([])
				setStateCode('')
				setCityItems([])
				setCity('')
				return
			}

			setLoadingStates(true)
			try {
				const options = await getStateOptions(countryCode)
				if (!isMounted) {
					return
				}

				setStateItems(options)
				if (!didHydrateInitialStateRef.current && !stateCode && initialStateNameRef.current) {
					const matchedState = options.find(
						(option) => option.label.toLowerCase() === initialStateNameRef.current.toLowerCase(),
					)
					if (matchedState) {
						didHydrateInitialStateRef.current = true
						setStateCode(matchedState.value)
						return
					}
				}

				if (stateCode && !options.some((option) => option.value === stateCode)) {
					setStateCode('')
				}
			} catch (error: any) {
				if (!isMounted || hasShownLocationErrorRef.current) {
					return
				}
				hasShownLocationErrorRef.current = true
				CMAlertDlgHelper.showAlertWithOK(error?.message || 'Unable to load states right now.')
			} finally {
				if (isMounted) {
					setLoadingStates(false)
				}
			}
		}

		loadStates()

		return () => {
			isMounted = false
		}
	}, [countryCode])

	useEffect(() => {
		let isMounted = true

		const loadCities = async () => {
			if (!countryCode || !stateCode) {
				setLoadingCities(false)
				setCityItems([])
				if (didHydrateInitialStateRef.current) {
					setCity('')
				}
				return
			}

			setLoadingCities(true)
			try {
				const options = await getCityOptions(countryCode, stateCode)
				if (!isMounted) {
					return
				}

				const matchedInitialCity = options.find(
					(option) => option.label.toLowerCase() === initialCityNameRef.current.toLowerCase(),
				)

				const normalizedOptions = matchedInitialCity || !initialCityNameRef.current
					? options
					: [{ label: initialCityNameRef.current, value: initialCityNameRef.current }, ...options]

				setCityItems(normalizedOptions)

				if (!didHydrateInitialCityRef.current && !city && initialCityNameRef.current) {
					didHydrateInitialCityRef.current = true
					setCity(initialCityNameRef.current)
					return
				}

				if (city && !normalizedOptions.some((option) => option.value === city)) {
					setCity('')
				}
			} catch (error: any) {
				if (!isMounted || hasShownLocationErrorRef.current) {
					return
				}
				hasShownLocationErrorRef.current = true
				CMAlertDlgHelper.showAlertWithOK(error?.message || 'Unable to load cities right now.')
			} finally {
				if (isMounted) {
					setLoadingCities(false)
				}
			}
		}

		loadCities()

		return () => {
			isMounted = false
		}
	}, [countryCode, stateCode])

	const onBtnProfileImage = () => {
		CMImagePicker.showImagePicker(1, (isSuccess: boolean, response: any) => {
			if (!isSuccess) {
				return
			}

			const fileName = `${getAuth().currentUser?.uid}.jpg`
			const formData = new FormData()

			setProfileImageChanged(true)
			setProfileImagePath(response.path)
		})
	}

	const onBtnDeleteAccount = () => {
		CMAlertDlgHelper.showConfirmAlert(CMConstants.appName, 'You can not recover your account later. Are you sure you want to delete account?', (isYes: boolean) => {
			if (isYes) {
				setLoading(true)
				CMFirebaseHelper.deleteUser((response: {[name: string]: any}) => {
					setLoading(false)
					if (response.isSuccess) {
						CMLocalStorageHelper.removeUserCredentials((error: Error) => {
							CMGlobal.navigation.replace('Auth')
						})
					} else {
						CMAlertDlgHelper.showAlertWithOK(response.value)
					}
				})
			}
		})
	}

	const onBtnUpdateAccount = () => {
		if (name.trim().length == 0) {
			CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterYourName)
			return
		}
		if (!CMUtils.isValidEmail(email)) {
			CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterValidEmail)
			return
		}
		if (!countryCode) {
			CMAlertDlgHelper.showAlertWithOK('Please select your country.')
			return
		}
		if (!stateCode) {
			CMAlertDlgHelper.showAlertWithOK('Please select your state or province.')
			return
		}
		if (!city) {
			CMAlertDlgHelper.showAlertWithOK('Please select your city.')
			return
		}
	
		// Use route.params.user.id for Apple Sign In users, fallback to getAuth().currentUser?.uid
		const userId = currentUser.id || getAuth().currentUser?.uid;
		if (!userId) {
			setLoading(false)
			CMAlertDlgHelper.showAlertWithOK('User ID not found. Please sign in again.')
			return
		}
		
		const selectedCountry = countryItems.find((item) => item.value === countryCode)?.label || getCountryLabel(countryCode)
		const selectedState = stateItems.find((item) => item.value === stateCode)?.label || currentUser.state || ''

		// Preserve existing fields (id and role) from the current user data
		const updatedUser: {[name: string]: any} = {
			name: name,
			email: email,
			country: selectedCountry,
			countryCode: countryCode,
			state: selectedState,
			stateCode: stateCode,
			city: city.trim(),
			// Preserve id and role from existing user data
			id: currentUser.id || CMGlobal.user?.id || userId,
			role: currentUser.role || CMGlobal.user?.role || 'coach'
		}
		// Only include birthDate if it's provided (make it optional)
		if (birthDate) {
			updatedUser.birthDate = Timestamp.fromDate(birthDate)
		}
		
		const postUpdateUser = () => {
			CMFirebaseHelper.updateUser(userId, updatedUser, (response: {[name: string]: any}) => {
				setLoading(false)
				setProfileImageChanged(false)
				
				if (response.isSuccess) {
					CMGlobal.user = {
						...(CMGlobal.user || {}),
						...updatedUser,
					}

					setTimeout(() => {
						CMAlertDlgHelper.showAlertWithOK(response.value, () => {
							navigation.goBack()
						})
					}, 50)
				} else {
					setTimeout(() => {
						CMAlertDlgHelper.showAlertWithOK(response.value)
					}, 50)
				}
			})
		}

		const postUploadImage = () => {
			// Use route.params.user.email for Apple Sign In users, fallback to getAuth().currentUser?.email
			const currentEmail = currentUser.email || getAuth().currentUser?.email || '';
			if (currentEmail != email) {
				CMFirebaseHelper.updateUserEmail(email, (response: {[name: string]: any}) => {
					if (response.isSuccess) {
						CMLocalStorageHelper.getUserCredentials((isSuccess: boolean, credentials: any) => {
							if (isSuccess) {
								credentials['email'] = email
								CMLocalStorageHelper.setUserCredentials(credentials)
							}
						})
						postUpdateUser()
					} else {
						setLoading(false)
						CMAlertDlgHelper.showAlertWithOK('Failed to update.')
					}
				})
			} else {
				postUpdateUser()
			}
		}

		Keyboard.dismiss()
		setCountryOpen(false)
		setStateOpen(false)
		setCityOpen(false)
		setLoading(true)
		if (profileImageChanged) {
			CMFirebaseHelper.uploadImage(profileImagePath, `user_avatar/${currentUser.id || getAuth().currentUser?.uid}.jpg`)
			.then(response => {
				if (response.isSuccess) {
					updatedUser['avatar'] = response.value
				}
				postUploadImage()
			})
		} else {
			postUploadImage()
		}
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
									isUser={true}
								/>
							</CMRipple>
							<CMRipple
								containerStyle={[styles.editImageButton, { borderColor: editImageButtonBorderColor }]}
								onPress={onBtnProfileImage}
							>
								<Ionicons
									name={"camera"}
									size={18 * iconScale}
									color={CMConstants.color.white}
								/>
							</CMRipple>
						</View>
					</View>

					{/* Form Fields */}
					<View style={styles.formContainer}>
						{/* Name Field */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>Name</Text>
							<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
								<Ionicons
									name={"person-outline"}
									size={20 * iconScale}
									color={CMConstants.color.green}
									style={styles.inputIcon}
								/>
								<TextInput
									style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
									defaultValue={name}
									onChangeText={text => setName(text)}
									placeholder="Enter your name"
									placeholderTextColor={placeholderColor}
									autoCapitalize="words"
									autoCorrect={false}
									returnKeyType="done"
									onSubmitEditing={Keyboard.dismiss}
									underlineColorAndroid="transparent"
									submitBehavior='submit'
								/>
							</View>
						</View>

						{/* Date of Birth Field */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>Date of birth</Text>
							<CMRipple
								containerStyle={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}
								onPress={() => setShowDatePicker(true)}
							>
								<Ionicons
									name={"calendar-outline"}
									size={20 * iconScale}
									color={CMConstants.color.green}
									style={styles.inputIcon}
								/>
								<Text style={[styles.dateText, { color: dateTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}>
									{birthDate ? CMUtils.strDateOfBirthday(birthDate) : 'Select date'}
								</Text>
								<Ionicons
									name={"chevron-forward-outline"}
									size={16 * iconScale}
									color={chevronColor}
								/>
							</CMRipple>
						</View>

						{/* Email Field */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>Email</Text>
							<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: inputBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
								<Ionicons
									name={"mail-outline"}
									size={20 * iconScale}
									color={CMConstants.color.green}
									style={styles.inputIcon}
								/>
								<TextInput
									style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
									defaultValue={email}
									onChangeText={text => setEmail(text)}
									placeholder="Enter your email"
									placeholderTextColor={placeholderColor}
									autoCapitalize="none"
									autoCorrect={false}
									keyboardType="email-address"
									returnKeyType="done"
									onSubmitEditing={Keyboard.dismiss}
									underlineColorAndroid="transparent"
									blurOnSubmit={false}
								/>
							</View>
						</View>

						<View style={[styles.dropdownGroup, countryOpen ? styles.dropdownGroupOpenTop : styles.dropdownGroupClosed]}>
							<View style={styles.labelRow}>
								<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>Country</Text>
								{loadingCountries ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
							</View>
							<CMDropDownPicker
								isOpened={countryOpen}
								themeMode={themeMode}
								open={countryOpen}
								value={countryCode}
								items={countryItems}
								setOpen={(open: boolean) => {
									if (loadingCountries) {
										return
									}
									setCountryOpen(open)
									if (open) {
										setStateOpen(false)
										setCityOpen(false)
									}
								}}
								setValue={(callback: any) => {
									const nextCountryCode = callback(countryCode)
									setCountryCode(nextCountryCode)
									didHydrateInitialStateRef.current = true
									didHydrateInitialCityRef.current = true
									setStateCode('')
									setCity('')
								}}
								setItems={setCountryItems}
								placeholder={loadingCountries ? 'Loading countries...' : 'Select country'}
								defaultStyle={styles.dropdownStyle}
								defaultDropDownContainerStyle={styles.dropdownContainerStyle}
								defaultContainerStyle={styles.dropdownContainerTop}
								searchable={false}
								disabled={loadingCountries || loadingStates || loadingCities}
							/>
						</View>

						<View style={[styles.dropdownGroup, stateOpen ? styles.dropdownGroupOpenMiddle : styles.dropdownGroupClosed]}>
							<View style={styles.labelRow}>
								<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>State / Province</Text>
								{loadingStates ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
							</View>
							<CMDropDownPicker
								isOpened={stateOpen}
								themeMode={themeMode}
								open={stateOpen}
								value={stateCode}
								items={stateItems}
								setOpen={(open: boolean) => {
									if (loadingStates || isLocationLoading) {
										return
									}
									setStateOpen(open)
									if (open) {
										setCountryOpen(false)
										setCityOpen(false)
									}
								}}
								setValue={(callback: any) => {
									const nextStateCode = callback(stateCode)
									didHydrateInitialCityRef.current = true
									setStateCode(nextStateCode)
									setCity('')
								}}
								setItems={setStateItems}
								placeholder={loadingStates ? 'Loading states...' : 'Select state or province'}
								defaultStyle={styles.dropdownStyle}
								defaultDropDownContainerStyle={styles.dropdownContainerStyle}
								defaultContainerStyle={styles.dropdownContainerMiddle}
								searchable={true}
								disabled={!countryCode || loadingStates || loadingCountries || loadingCities}
							/>
						</View>

						<View style={[styles.dropdownGroup, cityOpen ? styles.dropdownGroupOpenBottom : styles.dropdownGroupClosed]}>
							<View style={styles.labelRow}>
								<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>City</Text>
								{loadingCities ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
							</View>
							<CMDropDownPicker
								isOpened={cityOpen}
								themeMode={themeMode}
								open={cityOpen}
								value={city}
								items={cityItems}
								setOpen={(open: boolean) => {
									if (loadingCities || isLocationLoading) {
										return
									}
									setCityOpen(open)
									if (open) {
										setCountryOpen(false)
										setStateOpen(false)
									}
								}}
								setValue={(callback: any) => {
									const nextCity = callback(city)
									setCity(nextCity)
								}}
								setItems={setCityItems}
								placeholder={loadingCities ? 'Loading cities...' : 'Select city'}
								defaultStyle={styles.dropdownStyle}
								defaultDropDownContainerStyle={styles.dropdownContainerStyle}
								defaultContainerStyle={styles.dropdownContainerBottom}
								listMode="MODAL"
								modalTitle="Select city"
								searchable={true}
								searchPlaceholder="Search city..."
								disabled={!stateCode || loadingCities || loadingCountries || loadingStates}
							/>
						</View>
					</View>

					{/* Action Buttons */}
					<View style={styles.buttonsContainer}>
						<CMRipple
							containerStyle={[styles.updateButton, { height: CMConstants.height.buttonNormal * buttonHeightScale }]}
							onPress={onBtnUpdateAccount}
						>
							<Text style={[styles.updateButtonText, { fontSize: CMConstants.fontSize.normal * fontScale }]}>Update</Text>
						</CMRipple>
						<CMRipple
							containerStyle={[styles.deleteButton, { backgroundColor: deleteButtonBackgroundColor, height: CMConstants.height.buttonNormal * buttonHeightScale }]}
							onPress={onBtnDeleteAccount}
						>
							<Text style={[styles.deleteButtonText, { fontSize: CMConstants.fontSize.normal * fontScale }]}>Delete Account</Text>
						</CMRipple>
					</View>
				</View>
			</KeyboardAwareScrollView>
			<DatePicker
				isVisible={showDatePicker}
				mode={'single'}
				minDate={new Date(CMConstants.string.minBirthDate)}
				initialDate={birthDate ? birthDate : new Date(CMConstants.string.initialBirthDate)}
				onCancel={()=>setShowDatePicker(false)}
				onConfirm={(output)=>{
					setShowDatePicker(false)
					setBirthDate(output.date!)
				}}
			/>
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
	profileImageSection: {
		alignItems: 'center',
		marginBottom: CMConstants.space.smallEx,
		marginTop: CMConstants.space.small,
	},
	profileImageWrapper: {
		width: 100,
		height: 100,
		position: 'relative',
	},
	profileImageContainer: {
		width: 100,
		height: 100,
		borderRadius: 50,
		overflow: 'hidden',
		borderWidth: 2,
		borderColor: CMConstants.color.green,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	},
	profileImage: {
		width: '100%',
		height: '100%',
		borderRadius: 50,
	},
	editImageButton: {
		position: 'absolute' as const,
		bottom: 2,
		right: 2,
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: CMConstants.color.green,
		justifyContent: 'center' as const,
		alignItems: 'center' as const,
		borderWidth: 2,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.4,
		shadowRadius: 4,
		elevation: 4,
		zIndex: 10,
	},
	formContainer: {
		marginBottom: CMConstants.space.normal,
	},
	inputGroup: {
		marginBottom: CMConstants.space.smallEx,
	},
	dropdownGroup: {
		position: 'relative' as const,
	},
	dropdownGroupClosed: {
		zIndex: 1,
		marginBottom: CMConstants.space.smallEx,
	},
	dropdownGroupOpenTop: {
		zIndex: 3000,
		marginBottom: 220,
	},
	dropdownGroupOpenMiddle: {
		zIndex: 2000,
		marginBottom: 220,
	},
	dropdownGroupOpenBottom: {
		zIndex: 1000,
		marginBottom: 220,
	},
	label: {
		fontFamily: CMConstants.font.semiBold,
		marginBottom: CMConstants.space.smallEx - 2,
		textTransform: 'uppercase' as const,
		letterSpacing: 0.5,
	},
	labelRow: {
		flexDirection: 'row' as const,
		alignItems: 'center' as const,
		justifyContent: 'space-between' as const,
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
	dateText: {
		flex: 1,
		fontFamily: CMConstants.font.regular,
		paddingVertical: 2,
	},
	dropdownStyle: {
		minHeight: CMConstants.height.textInput,
		borderRadius: CMConstants.radius.normal,
		paddingHorizontal: CMConstants.space.small,
	},
	dropdownContainerStyle: {
		borderRadius: CMConstants.radius.normal,
	},
	dropdownContainerTop: {
		zIndex: 3000,
	},
	dropdownContainerMiddle: {
		zIndex: 2000,
	},
	dropdownContainerBottom: {
		zIndex: 1000,
	},
	buttonsContainer: {
		marginTop: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.normal,
		gap: CMConstants.space.small,
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
	deleteButton: {
		borderRadius: CMConstants.radius.normal,
		justifyContent: 'center' as const,
		alignItems: 'center' as const,
		borderWidth: 2,
		borderColor: CMConstants.color.red,
	},
	deleteButtonText: {
		color: CMConstants.color.red,
		fontFamily: CMConstants.font.semiBold,
		letterSpacing: 0.3,
	},
}

export default CMEditProfileScreen

import React, {useState, useEffect, useRef} from 'react'
import {View, SafeAreaView, Text, Keyboard, ViewStyle, TextStyle, Dimensions, InteractionManager, ActivityIndicator} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DatePicker from 'react-native-neat-date-picker'
import CMRipple from '../components/CMRipple'
import CMConstants from '../CMConstants'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import { TextInput } from 'react-native'
import CMUtils from '../utils/CMUtils'
import CMImagePicker from '../helper/CMImagePicker'
import { Timestamp } from '@react-native-firebase/firestore'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMProgressiveImage from '../components/CMProgressiveImage'
import CMDropDownPicker from '../components/CMDropDownPicker'
import CMPermissionHelper from '../helper/CMPermissionHelper'
import CMGlobal from '../CMGlobal'
import {
	getCityOptions,
	getCountryLabel,
	getCountryOptions,
	getStateOptions,
	resolveInitialCountryCode,
	type CMLocationOption,
} from '../helper/CMLocationService'

const CMEditPlayerScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const [positionOpen, setPositionOpen] = useState(false)
	const [countryOpen, setCountryOpen] = useState(false)
	const [stateOpen, setStateOpen] = useState(false)
	const [cityOpen, setCityOpen] = useState(false)
	const [positionItems, setPositionItems] = useState([
		{label: CMConstants.playerPosition.pointGuard, value: CMConstants.playerPosition.pointGuard},
		{label: CMConstants.playerPosition.shootingGuard, value: CMConstants.playerPosition.shootingGuard},
		{label: CMConstants.playerPosition.smallForward, value: CMConstants.playerPosition.smallForward},
		{label: CMConstants.playerPosition.powerForward, value: CMConstants.playerPosition.powerForward},
		{label: CMConstants.playerPosition.center, value: CMConstants.playerPosition.center},
	])
	const isEdit = route.params.isEdit

	const [profileImagePath, setProfileImagePath] = useState(route.params.player.avatar ?? '')
	const [profileImageChanged, setProfileImageChanged] = useState(false)
	const [name, setName] = useState(route.params.player.name ?? '')
	const [birthDate, setBirthDate] = useState(route.params.player.birthDate ? route.params.player.birthDate.toDate() : undefined)
	const [jerseyNumber, setJerseyNumber] = useState(`${route.params.player.number ?? ''}`)
	const [position, setPosition] = useState(`${route.params.player.position ?? ''}`)
	const [height, setHeight] = useState(`${route.params.player.height ?? ''}`)
	const [weight, setWeight] = useState(`${route.params.player.weight ?? ''}`)
	const [countryCode, setCountryCode] = useState(resolveInitialCountryCode(route.params.player.countryCode, route.params.player.country))
	const [stateCode, setStateCode] = useState((route.params.player.stateCode ?? '').toUpperCase())
	const [city, setCity] = useState(`${route.params.player.city ?? ''}`)
	const [countryItems, setCountryItems] = useState<CMLocationOption[]>([])
	const [stateItems, setStateItems] = useState<CMLocationOption[]>([])
	const [cityItems, setCityItems] = useState<CMLocationOption[]>([])
	const [loadingCountries, setLoadingCountries] = useState(false)
	const [loadingStates, setLoadingStates] = useState(false)
	const [loadingCities, setLoadingCities] = useState(false)
	const [showDatePicker, setShowDatePicker] = useState(false)
	const initialStateNameRef = useRef(route.params.player.state ?? '')
	const initialCityNameRef = useRef(route.params.player.city ?? '')
	const didHydrateInitialStateRef = useRef(Boolean(route.params.player.stateCode))
	const didHydrateInitialCityRef = useRef(false)
	const hasShownLocationErrorRef = useRef(false)

	const insets = useSafeAreaInsets()

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Get screen dimensions for responsive design
	const screenWidth = Dimensions.get('window').width
	const isSmallDevice = screenWidth < 375
	const isLargeDevice = screenWidth > 414
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

	// Dynamic colors based on theme
	const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const labelColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const editImageButtonBorderColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const deleteButtonBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const spinnerColor = CMConstants.color.green

	const onBtnProfileImage = () => {
		CMImagePicker.showImagePicker(1, (isSuccess: boolean, response: any) => {
			if (!isSuccess) {
				return
			}

			setProfileImageChanged(true)
			setProfileImagePath(response.path)
		})
	}

	const onBtnSave = () => {
		if (name.trim().length == 0) {
			CMAlertDlgHelper.showAlertWithOK('Please enter name.')
			return
		}
		if (!birthDate) {
			CMAlertDlgHelper.showAlertWithOK('Please enter birthdate.')
			return
		}
		if (!CMUtils.isNumeric(parseInt(jerseyNumber))) {
			CMAlertDlgHelper.showAlertWithOK('Jersey number should be numeric.')
			return
		}
		if (!position) {
			CMAlertDlgHelper.showAlertWithOK('Please select position.')
			return
		}
		if (!CMUtils.isNumeric(parseInt(height))) {
			CMAlertDlgHelper.showAlertWithOK('Height should be numeric.')
			return
		}
		if (!CMUtils.isNumeric(parseInt(weight))) {
			CMAlertDlgHelper.showAlertWithOK('Weight should be numeric.')
			return
		}
		if (!countryCode) {
			CMAlertDlgHelper.showAlertWithOK('Please select country.')
			return
		}
		if (!stateCode) {
			CMAlertDlgHelper.showAlertWithOK('Please select state or province.')
			return
		}
		if (!city) {
			CMAlertDlgHelper.showAlertWithOK('Please select city.')
			return
		}

		const selectedCountry = countryItems.find((item) => item.value === countryCode)?.label || getCountryLabel(countryCode)
		const selectedState = stateItems.find((item) => item.value === stateCode)?.label || route.params.player.state || ''
		
		const data: {[name: string]: any} = {
			name: name,
			number: parseInt(jerseyNumber),
			position: position,
			height: parseInt(height),
			weight: parseInt(weight),
			country: selectedCountry,
			countryCode: countryCode,
			state: selectedState,
			stateCode: stateCode,
			city: city.trim(),
			birthDate: Timestamp.fromDate(birthDate)
		}

		const playerId = isEdit ? route.params.player.id : CMFirebaseHelper.getNewDocumentId(CMConstants.collectionName.players)

		const postUpdate = async () => {
			if (isEdit) {
				// Check permissions before updating
				const canEdit = await CMPermissionHelper.canEditPlayer(playerId, route.params.player);
				if (!canEdit) {
					setLoading(false);
					CMPermissionHelper.showPermissionDenied(navigation);
					return;
				}

				CMFirebaseHelper.updatePlayer(playerId, data, (response: {[name: string]: any}) => {
					// Clear loading state first
					setLoading(false)
					setProfileImageChanged(false)
					
					if (response.isSuccess) {
						// Use InteractionManager and setTimeout to ensure loading modal fully dismisses before showing alert
						InteractionManager.runAfterInteractions(() => {
							setTimeout(() => {
								CMAlertDlgHelper.showAlertWithOK(response.value, () => {
									// Navigate back after alert is dismissed
									InteractionManager.runAfterInteractions(() => {
										setTimeout(() => {
											navigation.pop()
										}, 100)
									})
								})
							}, 300) // Delay to ensure modal is fully dismissed
						})
					} else {
						// For errors, also wait for modal to dismiss
						InteractionManager.runAfterInteractions(() => {
							setTimeout(() => {
								CMAlertDlgHelper.showAlertWithOK(response.value)
							}, 300)
						})
					}
				})
		} else {
			data['id'] = playerId
			data['teamId'] = route.params.team.id
			data['createdBy'] = CMGlobal.user?.id || getAuth().currentUser?.uid || ''
			CMFirebaseHelper.createPlayer(playerId, data, (response: {[name: string]: any}) => {
					// Clear loading state first
					setLoading(false)
					setProfileImageChanged(false)
					
					if (response.isSuccess) {
						// Use InteractionManager and setTimeout to ensure loading modal fully dismisses before showing alert
						InteractionManager.runAfterInteractions(() => {
							setTimeout(() => {
								CMAlertDlgHelper.showAlertWithOK(response.value, () => {
									// Navigate back after alert is dismissed
									InteractionManager.runAfterInteractions(() => {
										setTimeout(() => {
											navigation.pop()
										}, 100)
									})
								})
							}, 300) // Delay to ensure modal is fully dismissed
						})
					} else {
						// For errors, also wait for modal to dismiss
						InteractionManager.runAfterInteractions(() => {
							setTimeout(() => {
								CMAlertDlgHelper.showAlertWithOK(response.value)
							}, 300)
						})
					}
				})
			}
		}

		setLoading(true)
		if (profileImageChanged) {
			CMFirebaseHelper.uploadImage(profileImagePath, `player_avatar/${playerId}.jpg`)
			.then(response => {
				if (response.isSuccess) {
					data['avatar'] = response.value
				}
				postUpdate()
			})
		} else {
			postUpdate()
		}
	}

	const onBtnDelete = async () => {
		// Check permissions before allowing delete
		const canEdit = await CMPermissionHelper.canEditPlayer(route.params.player.id, route.params.player);
		if (!canEdit) {
			CMPermissionHelper.showPermissionDenied(navigation);
			return;
		}

		CMAlertDlgHelper.showConfirmAlert(CMConstants.appName, `Are you sure you want to delete ${route.params.player.name}?`, (isYes: boolean) => {
			if (isYes) {
				setLoading(true)
				CMFirebaseHelper.updatePlayer(route.params.player.id, {deleted: true}, (response: {[name: string]: any}) => {
					// Clear loading state first
					setLoading(false)
					
					if (response.isSuccess) {
						// Use InteractionManager and setTimeout to ensure loading modal fully dismisses before navigation
						InteractionManager.runAfterInteractions(() => {
							setTimeout(() => {
								navigation.pop()
							}, 300)
						})
					} else {
						// For errors, also wait for modal to dismiss
						InteractionManager.runAfterInteractions(() => {
							setTimeout(() => {
								CMAlertDlgHelper.showAlertWithOK('Failed to delete.')
							}, 300)
						})
					}
				})
			}
		})
	}

		useEffect(() => {
		navigation.setOptions({
			title: isEdit ? 'Edit Player' : 'Add New Player',
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
		
		// Check permissions when editing
		if (isEdit && route.params.player?.id) {
			const checkPermissions = async () => {
				const canEdit = await CMPermissionHelper.canEditPlayer(route.params.player.id, route.params.player);
				if (!canEdit) {
					CMPermissionHelper.showPermissionDenied(navigation);
				}
			};
			checkPermissions();
		}
	}, [headerBackgroundColor, headerTextColor, fontScale, isEdit])

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
								containerStyle={[styles.cameraButton, { borderColor: editImageButtonBorderColor }]}
								onPress={onBtnProfileImage}
							>
								<Ionicons
									name="camera"
									size={18 * iconScale}
									color={CMConstants.color.white}
								/>
							</CMRipple>
						</View>
					</View>

					{/* Form Fields */}
					<View style={styles.formContainer}>
						{/* Player Name */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>NAME</Text>
						<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
							<Ionicons name="person-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
							<TextInput
								style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
								defaultValue={name}
								onChangeText={text => setName(text)}
								placeholder="Enter player name"
								placeholderTextColor={placeholderColor}
								autoCapitalize="words"
								autoCorrect={false}
								returnKeyType="next"
								onSubmitEditing={Keyboard.dismiss}
								underlineColorAndroid="transparent"
							/>
						</View>
					</View>
						{/* Date of Birth */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>DATE OF BIRTH</Text>
						<CMRipple
							containerStyle={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}
							onPress={() => setShowDatePicker(true)}
						>
							<Ionicons name="calendar-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
							<Text style={[styles.textInput, { color: birthDate ? inputTextColor : placeholderColor, fontSize: CMConstants.fontSize.normal * fontScale }]}>
								{birthDate ? CMUtils.strDateOfBirthday(birthDate) : 'Select date of birth'}
							</Text>
							<Ionicons
								name="chevron-forward-outline"
								size={16 * iconScale}
								color={placeholderColor}
							/>
						</CMRipple>
						</View>
						{/* Jersey Number */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>JERSEY NUMBER</Text>
						<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
							<Ionicons name="shirt-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
							<TextInput
								style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
								defaultValue={jerseyNumber}
								onChangeText={text => setJerseyNumber(text)}
								placeholder="Enter jersey number"
								placeholderTextColor={placeholderColor}
								autoCapitalize="none"
								autoCorrect={false}
								returnKeyType="next"
								onSubmitEditing={Keyboard.dismiss}
								underlineColorAndroid="transparent"
								keyboardType="number-pad"
							/>
						</View>
						</View>
						{/* Position */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>POSITION</Text>
						<CMDropDownPicker
							isOpened={positionOpen}
							themeMode={isDarkMode ? CMConstants.themeMode.dark : CMConstants.themeMode.light}
							defaultStyle={[styles.dropdownStyle, { height: 40 * buttonHeightScale }]}
							defaultDropDownContainerStyle={styles.dropdownContainerStyle}
							placeholder='Select Position'
							placeholderStyle={{ color: placeholderColor }}
							open={positionOpen}
							value={position ?? ''}
							items={positionItems}
							setOpen={(open: boolean) => {
								setPositionOpen(open)
								if (open) {
									setCountryOpen(false)
									setStateOpen(false)
									setCityOpen(false)
								}
							}}
							onSelectItem={(item: any)=>setPosition(item.value)}
							setItems={setPositionItems}
							onOpen={() => {}}
							textStyle={{ color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale }}
							labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
							fontSize={CMConstants.fontSize.normal * fontScale}
						/>
						</View>
						{/* Height */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>HEIGHT (CM)</Text>
						<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
							<Ionicons name="resize-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
							<TextInput
								style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
								defaultValue={height}
								onChangeText={text => setHeight(text)}
								placeholder="Enter height"
								placeholderTextColor={placeholderColor}
								autoCapitalize="none"
								autoCorrect={false}
								returnKeyType="next"
								onSubmitEditing={Keyboard.dismiss}
								underlineColorAndroid="transparent"
								keyboardType="number-pad"
							/>
						</View>
						</View>
						{/* Weight */}
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>WEIGHT (KG)</Text>
						<View style={[styles.inputWrapper, { backgroundColor: inputBackgroundColor, borderColor: cardBorderColor, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale }]}>
							<Ionicons name="barbell-outline" size={20 * iconScale} color={CMConstants.color.green} style={styles.inputIcon} />
							<TextInput
								style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
								defaultValue={weight}
								onChangeText={text => setWeight(text)}
								placeholder="Enter weight"
								placeholderTextColor={placeholderColor}
								autoCapitalize="none"
								autoCorrect={false}
								returnKeyType="done"
								onSubmitEditing={Keyboard.dismiss}
								underlineColorAndroid="transparent"
								keyboardType="number-pad"
							/>
						</View>
						</View>
						<View style={[styles.dropdownGroup, countryOpen ? styles.dropdownGroupOpenTop : styles.dropdownGroupClosed]}>
							<View style={styles.labelRow}>
								<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>COUNTRY</Text>
								{loadingCountries ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
							</View>
							<CMDropDownPicker
								isOpened={countryOpen}
								themeMode={isDarkMode ? CMConstants.themeMode.dark : CMConstants.themeMode.light}
								defaultStyle={[styles.dropdownStyle, { height: 40 * buttonHeightScale }]}
								defaultDropDownContainerStyle={styles.dropdownContainerStyle}
								defaultContainerStyle={styles.dropdownContainerTop}
								placeholder={loadingCountries ? 'Loading countries...' : 'Select country'}
								placeholderStyle={{ color: placeholderColor }}
								open={countryOpen}
								value={countryCode}
								items={countryItems}
								setOpen={(open: boolean) => {
									if (loadingCountries) {
										return
									}
									setCountryOpen(open)
									if (open) {
										setPositionOpen(false)
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
								searchable={false}
								disabled={loadingCountries || loadingStates || loadingCities}
								textStyle={{ color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale }}
								labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
								fontSize={CMConstants.fontSize.normal * fontScale}
							/>
						</View>
						<View style={[styles.dropdownGroup, stateOpen ? styles.dropdownGroupOpenMiddle : styles.dropdownGroupClosed]}>
							<View style={styles.labelRow}>
								<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>STATE / PROVINCE</Text>
								{loadingStates ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
							</View>
							<CMDropDownPicker
								isOpened={stateOpen}
								themeMode={isDarkMode ? CMConstants.themeMode.dark : CMConstants.themeMode.light}
								defaultStyle={[styles.dropdownStyle, { height: 40 * buttonHeightScale }]}
								defaultDropDownContainerStyle={styles.dropdownContainerStyle}
								defaultContainerStyle={styles.dropdownContainerMiddle}
								placeholder={loadingStates ? 'Loading states...' : 'Select state or province'}
								placeholderStyle={{ color: placeholderColor }}
								open={stateOpen}
								value={stateCode}
								items={stateItems}
								setOpen={(open: boolean) => {
									if (loadingStates || loadingCountries || loadingCities) {
										return
									}
									setStateOpen(open)
									if (open) {
										setPositionOpen(false)
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
								searchable={true}
								disabled={!countryCode || loadingCountries || loadingStates || loadingCities}
								textStyle={{ color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale }}
								labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
								fontSize={CMConstants.fontSize.normal * fontScale}
							/>
						</View>
						<View style={[styles.dropdownGroup, cityOpen ? styles.dropdownGroupOpenBottom : styles.dropdownGroupClosed]}>
							<View style={styles.labelRow}>
								<Text style={[styles.label, { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>CITY</Text>
								{loadingCities ? <ActivityIndicator size="small" color={spinnerColor} /> : null}
							</View>
							<CMDropDownPicker
								isOpened={cityOpen}
								themeMode={isDarkMode ? CMConstants.themeMode.dark : CMConstants.themeMode.light}
								defaultStyle={[styles.dropdownStyle, { height: 40 * buttonHeightScale }]}
								defaultDropDownContainerStyle={styles.dropdownContainerStyle}
								defaultContainerStyle={styles.dropdownContainerBottom}
								placeholder={loadingCities ? 'Loading cities...' : 'Select city'}
								placeholderStyle={{ color: placeholderColor }}
								open={cityOpen}
								value={city}
								items={cityItems}
								setOpen={(open: boolean) => {
									if (loadingCities || loadingCountries || loadingStates) {
										return
									}
									setCityOpen(open)
									if (open) {
										setPositionOpen(false)
										setCountryOpen(false)
										setStateOpen(false)
									}
								}}
								setValue={(callback: any) => {
									const nextCity = callback(city)
									setCity(nextCity)
								}}
								setItems={setCityItems}
								listMode="MODAL"
								modalTitle="Select city"
								searchable={true}
								searchPlaceholder="Search city..."
								disabled={!stateCode || loadingCountries || loadingStates || loadingCities}
								textStyle={{ color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale }}
								labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
								fontSize={CMConstants.fontSize.normal * fontScale}
							/>
						</View>
					</View>

					{/* Buttons */}
					<View style={styles.buttonsContainer}>
						<CMRipple
							containerStyle={[styles.saveButton, { height: CMConstants.height.buttonNormal * buttonHeightScale }]}
							onPress={onBtnSave}
						>
							<Text style={[styles.saveButtonText, { fontSize: CMConstants.fontSize.normal * fontScale }]}>{isEdit ? 'Save' : 'Add Player'}</Text>
						</CMRipple>
						{isEdit && (
							<CMRipple
								containerStyle={[styles.deleteButton, { backgroundColor: deleteButtonBackgroundColor, height: CMConstants.height.buttonNormal * buttonHeightScale }]}
								onPress={onBtnDelete}
							>
								<Text style={[styles.deleteButtonText, { fontSize: CMConstants.fontSize.normal * fontScale }]}>Delete</Text>
							</CMRipple>
						)}
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
		alignItems: 'center' as const,
		marginBottom: CMConstants.space.smallEx,
		marginTop: CMConstants.space.small,
	} as ViewStyle,
	profileImageWrapper: {
		width: 100,
		height: 100,
		position: 'relative' as const,
	} as ViewStyle,
	profileImageContainer: {
		width: 100,
		height: 100,
		borderRadius: 50,
		overflow: 'hidden' as const,
		borderWidth: 2,
		borderColor: CMConstants.color.green,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	} as ViewStyle,
	profileImage: {
		width: '100%',
		height: '100%',
		borderRadius: 50,
	} as ViewStyle,
	cameraButton: {
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
	} as ViewStyle,
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
		textTransform: 'uppercase' as const,
		letterSpacing: 0.5,
		marginBottom: CMConstants.space.smallEx - 2,
	} as TextStyle,
	labelRow: {
		flexDirection: 'row' as const,
		alignItems: 'center' as const,
		justifyContent: 'space-between' as const,
	} as ViewStyle,
	inputWrapper: {
		flexDirection: 'row' as const,
		alignItems: 'center' as const,
		borderRadius: CMConstants.radius.normal,
		paddingHorizontal: CMConstants.space.normal,
		borderWidth: 1,
	} as ViewStyle,
	inputIcon: {
		marginRight: CMConstants.space.smallEx,
		marginLeft: -4,
	},
	textInput: {
		flex: 1,
		fontFamily: CMConstants.font.regular,
		padding: 0,
		paddingVertical: 2,
	} as TextStyle,
	dropdownStyle: {
		backgroundColor: CMConstants.color.darkGrey2,
		borderColor: CMConstants.color.darkGrey3,
		borderRadius: CMConstants.radius.normal,
		borderWidth: 1,
	} as ViewStyle,
	dropdownContainerStyle: {
		backgroundColor: CMConstants.color.darkGrey2,
		borderColor: CMConstants.color.darkGrey3,
		borderWidth: 1,
	} as ViewStyle,
	dropdownContainerTop: {
		zIndex: 3000,
	} as ViewStyle,
	dropdownContainerMiddle: {
		zIndex: 2000,
	} as ViewStyle,
	dropdownContainerBottom: {
		zIndex: 1000,
	} as ViewStyle,
	buttonsContainer: {
		marginTop: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.normal,
		gap: CMConstants.space.small,
	},
	saveButton: {
		backgroundColor: CMConstants.color.green,
		borderRadius: CMConstants.radius.normal,
		justifyContent: 'center' as const,
		alignItems: 'center' as const,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	} as ViewStyle,
	saveButtonText: {
		color: CMConstants.color.white,
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.5,
	} as TextStyle,
	deleteButton: {
		borderRadius: CMConstants.radius.normal,
		justifyContent: 'center' as const,
		alignItems: 'center' as const,
		borderWidth: 2,
		borderColor: CMConstants.color.red,
	} as ViewStyle,
	deleteButtonText: {
		color: CMConstants.color.red,
		fontFamily: CMConstants.font.semiBold,
		letterSpacing: 0.3,
	} as TextStyle,
}

export default CMEditPlayerScreen

import React, {useState, useEffect} from 'react'
import {View, SafeAreaView, Text, Keyboard, Dimensions, TextInput} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMRipple from '../components/CMRipple'
import CMConstants from '../CMConstants'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMImagePicker from '../helper/CMImagePicker'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMProgressiveImage from '../components/CMProgressiveImage'
import { getAuth } from '@react-native-firebase/auth'
import CMGlobal from '../CMGlobal'
import CMPermissionHelper from '../helper/CMPermissionHelper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const CMEditTeamScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const insets = useSafeAreaInsets()

	const isEdit = route.params?.isEdit ?? true;
	const team = route.params?.team ?? {};
	const league = route.params?.league ?? null;

	const [profileImagePath, setProfileImagePath] = useState(team.avatar ?? '')
	const [profileImageChanged, setProfileImageChanged] = useState(false)
	const [name, setName] = useState(team.name ?? '')

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
	const editImageButtonBorderColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white

	useEffect(() => {
		navigation.setOptions({ 
			title: isEdit ? 'Edit Team' : 'Add Team',
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
		});
		
		// Check permissions when editing
		if (isEdit && team?.id) {
			const checkPermissions = async () => {
				const canEdit = await CMPermissionHelper.canEditTeam(team.id, team);
				if (!canEdit) {
					CMPermissionHelper.showPermissionDenied(navigation);
				}
			};
			checkPermissions();
		}
	}, [isEdit, fontScale, headerBackgroundColor, headerTextColor]);

	const onBtnProfileImage = () => {
		CMImagePicker.showImagePicker(1, (isSuccess: boolean, response: any) => {
			if (!isSuccess) {
				return
			}

			setProfileImageChanged(true)
			setProfileImagePath(response.path)
		})
	}

	const onBtnUpdateTeam = () => {
		if (name.trim().length == 0) {
			CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterTeamName)
			return
		}
	
		const teamId = isEdit ? team.id : CMFirebaseHelper.getNewDocumentId(CMConstants.collectionName.teams);
		const updatedTeam: {[name: string]: any} = {
			id: teamId,
			name: name,
			coachId: getAuth().currentUser?.uid
		}

		const postUpdateTeam = async () => {
			try {
				if (isEdit) {
					// Check permissions before updating
					const canEdit = await CMPermissionHelper.canEditTeam(teamId, team);
					if (!canEdit) {
						setLoading(false);
						CMPermissionHelper.showPermissionDenied(navigation);
						return;
					}

					CMFirebaseHelper.updateTeam(teamId, updatedTeam, (response: {[name: string]: any}) => {
						setLoading(false)
						setProfileImageChanged(false)
						if (response.isSuccess) {
							CMAlertDlgHelper.showAlertWithOK(response.value || 'Team updated successfully!', () => {
								navigation.pop();
							})
						} else {
							CMAlertDlgHelper.showAlertWithOK(response.value || 'Failed to update team. Please try again.')
						}
					})
				} else {
					CMFirebaseHelper.setTeam(teamId, updatedTeam, (response: {[name: string]: any}) => {
						if (response.isSuccess && league) {
							// Add team to league
							CMFirebaseHelper.addTeamToLeague(league.id, teamId, (leagueResponse: {[name: string]: any}) => {
								setLoading(false)
								setProfileImageChanged(false)
								if (leagueResponse.isSuccess) {
									CMAlertDlgHelper.showAlertWithOK('Team created and added to league successfully!', () => {
										navigation.pop();
									});
								} else {
									CMAlertDlgHelper.showAlertWithOK('Team created but failed to add to league: ' + (leagueResponse.value || 'Unknown error'));
								}
							});
						} else {
							setLoading(false)
							setProfileImageChanged(false)
							if (response.isSuccess) {
								CMAlertDlgHelper.showAlertWithOK('Team created successfully!', () => {
									navigation.pop();
								});
							} else {
								CMAlertDlgHelper.showAlertWithOK('Failed to create team: ' + (response.value || 'Unknown error'));
							}
						}
					})
				}
			} catch (error) {
				console.error('Error updating team:', error);
				setLoading(false);
				setProfileImageChanged(false);
				CMAlertDlgHelper.showAlertWithOK('An unexpected error occurred. Please try again.');
			}
		}

		setLoading(true)
		if (profileImageChanged && profileImagePath) {
			// Add timeout to prevent infinite loading
			const uploadTimeout = setTimeout(() => {
				setLoading(false);
				CMAlertDlgHelper.showAlertWithOK('Image upload timed out. Please try again.');
			}, 30000); // 30 second timeout

			CMFirebaseHelper.uploadImage(profileImagePath, `team_avatar/${teamId}.jpg`)
			.then(response => {
				clearTimeout(uploadTimeout);
				if (response.isSuccess) {
					updatedTeam['avatar'] = response.value
				} else {
					// Continue with update even if image upload fails, but log the error
					console.warn('Image upload failed:', response.value);
				}
				postUpdateTeam()
			})
			.catch(error => {
				clearTimeout(uploadTimeout);
				console.error('Image upload error:', error);
				setLoading(false);
				CMAlertDlgHelper.showAlertWithOK('Failed to upload image. Please try again or continue without image.', () => {
					// Allow user to retry without image
					setProfileImageChanged(false);
				});
			})
		} else {
			postUpdateTeam()
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
									name={"people-outline"}
									size={20 * iconScale}
									color={CMConstants.color.green}
									style={styles.inputIcon}
								/>
								<TextInput
									style={[styles.textInput, { color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }]}
									defaultValue={name}
									onChangeText={text => setName(text)}
									placeholder="Enter team name"
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
					</View>

					{/* Action Button */}
					<View style={styles.buttonContainer}>
						<CMRipple
							containerStyle={[styles.updateButton, { height: CMConstants.height.buttonNormal * buttonHeightScale }]}
							onPress={onBtnUpdateTeam}
						>
							<Text style={[styles.updateButtonText, { fontSize: CMConstants.fontSize.normal * fontScale }]}>{isEdit ? 'Update' : 'Create'}</Text>
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
	profileImageSection: {
		alignItems: 'center' as const,
		marginBottom: CMConstants.space.smallEx,
		marginTop: CMConstants.space.small,
	},
	profileImageWrapper: {
		width: 100,
		height: 100,
		position: 'relative' as const,
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

export default CMEditTeamScreen

import React, {useState, useEffect, useRef} from 'react'
import {SafeAreaView, TextStyle, View, Image, Dimensions, Text, useColorScheme} from 'react-native'
import { getAuth } from '@react-native-firebase/auth'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import ActionSheet from 'react-native-actionsheet'
import {useToast} from 'react-native-toast-notifications'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMUtils from '../utils/CMUtils'
import CMRipple from '../components/CMRipple'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMToast from '../components/CMToast'
import CMProfileImage from '../components/CMProfileImage'
import CMGlobal from '../CMGlobal'
import CMUserRole from '../model/CMUserRole'
import CMPermissionHelper from '../helper/CMPermissionHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'

const CMTeamManagementScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const [team, setTeam] = useState<{[name: string]: any}>()
	const [players, setPlayers] = useState<{[name: string]: any}[]>([])
	const [canEditTeam, setCanEditTeam] = useState(false)
	const insets = useSafeAreaInsets()

	const toast = useToast()
	const actionCreateRef = useRef<any>(null)

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

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
	const playerNameTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const courtBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const playerButtonBackgroundColor = (hasPlayer: boolean) => {
		if (hasPlayer) {
			return isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey1
		}
		return isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey2
	}

	const courtWidth = Dimensions.get('window').width - CMConstants.space.normal * 2
	const courtHeight = courtWidth * 1.65

	const addBtnWidth = 40
	
	const onBtnMore = async () => {
		// Check permission before showing action sheet
		if (team?.id) {
			const canEdit = await CMPermissionHelper.canEditTeam(team.id, team);
			if (!canEdit) {
				CMPermissionHelper.showPermissionDenied();
				return;
			}
		}
		actionCreateRef.current.show()
	}

	const AddPlayerButton = (props: any) => {
		const { style = {}, position = '' } = props

		const player = players.find(player => player.position == position) ?? {}

		const handlePress = async () => {
			if (player.id) {
				// View player details - always allowed
				navigation.navigate(CMConstants.screenName.playerDetails, {player: player})
			} else {
				// Add player - check permission first
				if (!canEditTeam) {
					CMPermissionHelper.showPermissionDenied();
					return;
				}
				// Double-check permission before navigating
				if (team?.id) {
					const canEdit = await CMPermissionHelper.canEditTeam(team.id, team);
					if (!canEdit) {
						CMPermissionHelper.showPermissionDenied();
						return;
					}
				}
				navigation.navigate(CMConstants.screenName.editPlayer, {isEdit: false, team: team, player: {position: position}})
			}
		}

		return (
			<View style={{...style, width: addBtnWidth, position: 'absolute', justifyContent: 'center', alignItems: 'center'}}>
				<CMRipple
					containerStyle={{
						...CMCommonStyles.circle(addBtnWidth),
						justifyContent: 'center',
						alignItems: 'center',
						backgroundColor: playerButtonBackgroundColor(!!player.id),
						borderWidth: 2,
						borderColor: canEditTeam || player.id ? CMConstants.color.green : CMConstants.color.semiLightGrey,
						shadowColor: canEditTeam || player.id ? CMConstants.color.green : CMConstants.color.semiLightGrey,
						shadowOffset: { width: 0, height: 2 },
						shadowOpacity: canEditTeam || player.id ? 0.3 : 0.1,
						shadowRadius: 4,
						elevation: 4,
						opacity: canEditTeam || player.id ? 1 : 0.5,
					}}
					onPress={handlePress}
					disabled={!canEditTeam && !player.id}
					color={CMConstants.color.green}
				>
					{player.avatar ? (
						<CMProfileImage
							radius={addBtnWidth - 4}
							imgURL={player.avatar}
							isUser={true}
						/>
					) : (
						<Ionicons
							name={"add-outline"}
							size={CMConstants.height.iconBig}
							color={canEditTeam ? CMConstants.color.green : CMConstants.color.semiLightGrey}
						/>
					)}
				</CMRipple>
				<Text style={[styles.playerNameText, { color: playerNameTextColor }]}>
					{player.name ?? ''}
				</Text>
			</View>
		)
	}

	// Update header when theme changes
	useEffect(() => {
		if (team) {
			navigation.setOptions({
				title: team.name || 'Team Management',
				headerStyle: {
					backgroundColor: headerBackgroundColor,
				},
				headerTintColor: headerTextColor,
				headerTitleStyle: {
					color: headerTextColor,
					fontSize: CMConstants.fontSize.largeEx,
					fontWeight: 'bold',
				},
				headerRight: () => (
					canEditTeam ? (
						<CMRipple
							containerStyle={{
								...CMCommonStyles.circle(CMConstants.height.iconBig),
								marginRight: CMConstants.space.normal,
								justifyContent: 'center',
								alignItems: 'center',
							}}
							onPress={onBtnMore}
						>
							<Ionicons
								name="ellipsis-horizontal"
								size={CMConstants.height.iconBig}
								color={headerTextColor}
							/>
						</CMRipple>
					) : null
				),
			})
		}
	}, [themeMode, team, navigation, headerBackgroundColor, headerTextColor, canEditTeam])

	// Check permission to edit team
	useEffect(() => {
		const checkPermission = async () => {
			if (team?.id) {
				const canEdit = await CMPermissionHelper.canEditTeam(team.id, team);
				setCanEditTeam(canEdit);
			} else {
				setCanEditTeam(false);
			}
		};
		checkPermission();
	}, [team])

	useEffect(() => {
		// Use team from props if available, otherwise fall back to current user's team
		const teamData = route.params?.team
		
		if (teamData) {
			// Use team data passed through props
			setTeam(teamData)
			CMFirebaseHelper.getPlayers([teamData.id], (response: {[name: string]: any}) => {
				if (response.isSuccess) {
					setPlayers(response.value)
				} else {
					CMToast.makeText(toast, response.value)
				}
			})
		} else {
			// Fall back to current user's team if no team data provided
			const userId = CMGlobal.user?.id || getAuth().currentUser?.uid;
			if (!userId) {
				CMAlertDlgHelper.showAlertWithOK('User ID not found. Please sign in again.')
				return
			}
			CMFirebaseHelper.getTeam(userId, (response: {[name: string]: any}) => {
				if (response.isSuccess) {
					setTeam(response.value)
					CMFirebaseHelper.getPlayers([response.value.id], (response: {[name: string]: any}) => {
						if (response.isSuccess) {
							setPlayers(response.value)
						} else {
							CMToast.makeText(toast, response.value)
						}
					})
				} else {
					CMToast.makeText(toast, response.value)
				}
			})
		}
	}, [route.params?.team])

	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			// Reload players when screen comes into focus
			if (team) {
				CMFirebaseHelper.getPlayers([team.id], (response: {[name: string]: any}) => {
					if (response.isSuccess) {
						setPlayers(response.value)
					} else {
						CMToast.makeText(toast, response.value)
					}
				})
			}
		})

		return unsubscribe
	}, [navigation, team, toast])

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog
				visible={loading}
			/>
			<View style={{...CMCommonStyles.body, flex: 1, backgroundColor: backgroundColor}}>
				<View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
					<View style={[styles.courtContainer, { backgroundColor: isDarkMode ? CMConstants.color.black : CMConstants.color.white, borderColor: courtBorderColor }]}>
						<View style={styles.courtBackground}>
							<Image
								style={[styles.courtImage, { opacity: isDarkMode ? 0.5 : 0.3 }]}
								source={require('../../assets/images/img_court.png')}
								resizeMode='stretch'
							/>
						</View>
						<AddPlayerButton
							style={{left: courtWidth * 0.25 - addBtnWidth * 0.5, top: courtHeight * 0.28 - addBtnWidth * 0.5}}
							position={CMConstants.playerPosition.pointGuard}
						/>
						<AddPlayerButton
							style={{left: courtWidth * 0.75 - addBtnWidth * 0.5, top: courtHeight * 0.28 - addBtnWidth * 0.5}}
							position={CMConstants.playerPosition.shootingGuard}
						/>
						<AddPlayerButton
							style={{left: courtWidth * 0.25 - addBtnWidth * 0.5, top: courtHeight * 0.54 - addBtnWidth * 0.5}}
							position={CMConstants.playerPosition.smallForward}
						/>
						<AddPlayerButton
							style={{left: courtWidth * 0.75 - addBtnWidth * 0.5, top: courtHeight * 0.54 - addBtnWidth * 0.5}}
							position={CMConstants.playerPosition.powerForward}
						/>
						<AddPlayerButton
							style={{left: courtWidth * 0.5 - addBtnWidth * 0.5, top: courtHeight * 0.7 - addBtnWidth * 0.5}}
							position={CMConstants.playerPosition.center}
						/>
					</View>
				</View>
			</View>
			<ActionSheet
				ref={actionCreateRef}
				title={''}
				options={['Edit Team', 'Edit Players', 'Add Player Stats', 'Cancel']}
				cancelButtonIndex={3}
				destructiveButtonIndex={3}
				onPress={async (index: number) => {
					// Check permission before navigating
					if (team?.id) {
						const canEdit = await CMPermissionHelper.canEditTeam(team.id, team);
						if (!canEdit) {
							CMPermissionHelper.showPermissionDenied();
							return;
						}
					}

					if (index === 0) {
						if (team) {
							navigation.navigate(CMConstants.screenName.editTeam, {team: team})
						}
					} else if (index === 1) {
						navigation.navigate(CMConstants.screenName.playersOfTeam, {team: team, players: players})
					} else if (index === 2) {
						navigation.navigate(CMConstants.screenName.editPlayerStats, {playerStat: {}, team: team, players: players})
					}
				}}
			/>
		</SafeAreaView>
	)
}

const styles = {
	courtContainer: {
		width: Dimensions.get('window').width - CMConstants.space.normal * 2,
		height: (Dimensions.get('window').width - CMConstants.space.normal * 2) * 1.65,
		position: 'relative' as const,
		borderRadius: CMConstants.radius.normal,
		overflow: 'hidden' as const,
		borderWidth: 2,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 6,
	},
	courtBackground: {
		width: '100%' as any,
		height: '100%' as any,
		position: 'absolute' as const,
		top: 0,
		left: 0,
	} as any,
	courtImage: {
		width: '100%' as any,
		height: '100%' as any,
		opacity: 0.3,
	} as any,
	playerNameText: {
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.regular,
		width: 80,
		textAlign: 'center' as const,
		marginTop: CMConstants.space.smallEx / 2,
	},
}

export default CMTeamManagementScreen

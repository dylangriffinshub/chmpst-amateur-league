import React, {useState, useEffect, useRef, useCallback} from 'react'
import {SafeAreaView, FlatList, View, Text} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ActionSheet from 'react-native-actionsheet'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMGlobal from '../CMGlobal'
import CMPlayerCell from '../components/CMPlayerCell'
import CMRipple from '../components/CMRipple'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMToast from '../components/CMToast'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import {useToast} from 'react-native-toast-notifications'
import CMPermissionHelper from '../helper/CMPermissionHelper'

const CMPlayersScreen = ({navigation, route}: CMNavigationProps) => {
	const insets = useSafeAreaInsets()

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Dynamic colors based on theme
	const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black

	// Listen for theme changes
	useEffect(() => {
		// Check theme on mount
		setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
		
		// Poll for theme changes (check every 200ms)
		const interval = setInterval(() => {
			const currentTheme = CMGlobal.themeMode || CMConstants.themeMode.light;
			if (currentTheme !== themeMode) {
				setThemeMode(currentTheme);
			}
		}, 200);
		
		// Also listen for navigation focus as fallback
		const unsubscribe = navigation.addListener('focus', () => {
			setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
		});
		
		return () => {
			clearInterval(interval);
			unsubscribe();
		};
	}, [navigation, themeMode])

	const [players, setPlayers] = useState(route.params.players || [])
	const [loading, setLoading] = useState(false)
	const [canAddPlayer, setCanAddPlayer] = useState(false)
	const toast = useToast()
	const team = route.params.team
	const actionSheetRef = useRef<any>(null)

	const loadPlayers = () => {
		CMFirebaseHelper.getPlayers([team.id], (response: {[name: string]: any}) => {
			if (response.isSuccess) {
				// Filter out deleted players
				const activePlayers = response.value ? response.value.filter((player: any) => !player.deleted) : []
				setPlayers(activePlayers)
			}
		})
	}

	// Check permission to add players
	useEffect(() => {
		const checkPermission = async () => {
			if (team?.id) {
				const canEdit = await CMPermissionHelper.canEditTeam(team.id, team);
				setCanAddPlayer(canEdit);
			}
		};
		checkPermission();
	}, [team])

	const onEditPlayer = useCallback((player: {[name: string]: any}) => {
		navigation.navigate(CMConstants.screenName.editPlayer, {
			isEdit: true,
			team: team,
			player: player
		})
	}, [navigation, team])

	const onDeletePlayer = useCallback(async (player: {[name: string]: any}) => {
		// Check permission before allowing delete (same as + button - only league creators can delete)
		const canDelete = await CMPermissionHelper.canEditPlayer(player.id, player);
		if (!canDelete) {
			CMPermissionHelper.showPermissionDenied();
			return;
		}

		CMAlertDlgHelper.showConfirmAlert(
			'Delete Player',
			`Are you sure you want to delete "${player.name}"? This will permanently delete the player and ALL associated data. This action cannot be undone.`,
			(confirmed: boolean) => {
				if (confirmed) {
					setLoading(true)
					CMFirebaseHelper.deletePlayerWithAssociatedData(player.id, (response: {[name: string]: any}) => {
						setLoading(false)
						if (response.isSuccess) {
							CMToast.makeText(toast, response.value)
							loadPlayers()
						} else {
							CMToast.makeText(toast, response.value)
						}
					})
				}
			}
		)
	}, [toast, team.id])

	const showActionSheet = useCallback(async () => {
		// Check permission before showing action sheet
		if (team?.id) {
			const canEdit = await CMPermissionHelper.canEditTeam(team.id, team);
			if (!canEdit) {
				CMPermissionHelper.showPermissionDenied();
				return;
			}
		}
		actionSheetRef.current?.show()
	}, [team])

	useEffect(() => {
		navigation.setOptions({
			title: team.name,
			headerStyle: {
				backgroundColor: headerBackgroundColor,
			},
			headerTintColor: headerTextColor,
			headerTitleStyle: {
				color: headerTextColor,
				fontSize: CMConstants.fontSize.large,
				fontWeight: 'bold',
			},
			headerRight: () => {
				// Only show add button if user can edit team (is league creator)
				if (!canAddPlayer) {
					return null;
				}
				return (
					<CMRipple
						containerStyle={{
							...CMCommonStyles.circle(CMConstants.height.iconBig),
							marginRight: CMConstants.space.normal,
							justifyContent: 'center',
							alignItems: 'center',
						}}
						onPress={showActionSheet}
					>
						<Ionicons
							name="add-outline"
							size={CMConstants.height.iconBig}
							color={isDarkMode ? CMConstants.color.white : CMConstants.color.black}
						/>
					</CMRipple>
				);
			},
		})
	}, [team.name, showActionSheet, headerBackgroundColor, headerTextColor, isDarkMode, themeMode, canAddPlayer])

	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			// Reload players when screen comes into focus (e.g., returning from add player screen)
			loadPlayers()
		})

		return unsubscribe
	}, [navigation, team.id])


	// Filter out deleted players
	const activePlayers = players ? players.filter((player: any) => !player.deleted) : []
	const hasPlayers = activePlayers.length > 0

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog visible={loading} />
			{hasPlayers ? (
				<FlatList
					style={{flex: 0, marginHorizontal: CMConstants.space.small, marginTop: CMConstants.space.small, marginBottom: insets.bottom, backgroundColor: backgroundColor}}
					initialNumToRender={activePlayers.length}
					data={activePlayers}
					renderItem={({ item, separators }) => (
						<CMPlayerCell
							player={item}
							themeMode={themeMode}
							onPress={() => {
								navigation.navigate(CMConstants.screenName.playerDetails, {player: item})
							}}
							onEdit={() => onEditPlayer(item)}
							onDelete={() => onDeletePlayer(item)}
						/>
					)}
					ItemSeparatorComponent={({ highlighted }) => (
						<View style={{height: CMConstants.space.smallEx}} />
					)}
					extraData={themeMode}
				/>
			) : (
				<View style={[styles.emptyStateContainer, { backgroundColor: backgroundColor }]}>
					<Ionicons
						name="people-outline"
						size={80}
						color={isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey}
					/>
					<Text style={[styles.emptyStateTitle, { color: isDarkMode ? CMConstants.color.white : CMConstants.color.black }]}>
						No Members
					</Text>
					<Text style={[styles.emptyStateMessage, { color: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey }]}>
						Add team members to get started
					</Text>
					{canAddPlayer && (
						<CMRipple
							containerStyle={[styles.addMemberButton, { backgroundColor: CMConstants.color.green }]}
							onPress={async () => {
								// Check permission before navigating
								if (team?.id) {
									const canEdit = await CMPermissionHelper.canEditTeam(team.id, team);
									if (!canEdit) {
										CMPermissionHelper.showPermissionDenied();
										return;
									}
								}
								navigation.navigate(CMConstants.screenName.editPlayer, {
									isEdit: false,
									team: team,
									player: {}
								})
							}}
						>
						<Ionicons
							name="add-outline"
							size={20}
							color={CMConstants.color.white}
						/>
						<Text style={styles.addMemberButtonText}>Add Member</Text>
					</CMRipple>
					)}
				</View>
			)}
			<ActionSheet
				ref={actionSheetRef}
				title={''}
				options={['Add Player', 'Add Player Stats', 'Cancel']}
				cancelButtonIndex={2}
				destructiveButtonIndex={2}
				onPress={(index: number) => {
					if (index === 0) {
						// Add Player
						navigation.navigate(CMConstants.screenName.editPlayer, {
							isEdit: false,
							team: team,
							player: {}
						})
					} else if (index === 1) {
						// Add Player Stats
						navigation.navigate(CMConstants.screenName.editPlayerStats, {
							playerStat: {},
							team: team,
							players: players
						})
					}
				}}
			/>
		</SafeAreaView>
	)
}

const styles = {
	emptyStateContainer: {
		flex: 1,
		alignItems: 'center' as const,
		justifyContent: 'center' as const,
		paddingHorizontal: CMConstants.space.normal,
	},
	emptyStateTitle: {
		fontSize: CMConstants.fontSize.large,
		fontFamily: CMConstants.font.bold,
		marginTop: CMConstants.space.normal,
		marginBottom: CMConstants.space.smallEx,
		textAlign: 'center' as const,
	},
	emptyStateMessage: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.regular,
		marginBottom: CMConstants.space.normal,
		textAlign: 'center' as const,
	},
	addMemberButton: {
		flexDirection: 'row' as const,
		alignItems: 'center' as const,
		justifyContent: 'center',
		paddingHorizontal: CMConstants.space.normal,
		paddingVertical: CMConstants.space.smallEx,
		borderRadius: CMConstants.radius.normal,
		marginTop: CMConstants.space.small,
		gap: CMConstants.space.smallEx,
	},
	addMemberButtonText: {
		color: CMConstants.color.white,
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.bold,
	},
}

export default CMPlayersScreen
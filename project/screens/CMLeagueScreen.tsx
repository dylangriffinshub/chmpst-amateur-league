import React, {useState, useEffect} from 'react'
import {SafeAreaView, FlatList, View, Text, ActivityIndicator, Dimensions, StyleSheet, InteractionManager} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMRipple from '../components/CMRipple'
import CMModal from '../dialog/CMModal'
import CMAddLeagueModalContent from '../dialog/CMAddLeagueModalContent'
import CMGlobal from '../CMGlobal'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMLeagueCell from '../components/CMLeagueCell'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMUtils from '../utils/CMUtils'
import CMPermissionHelper from '../helper/CMPermissionHelper'
import CMSubscriptionHelper from '../helper/CMSubscriptionHelper'
import { getAuth } from '@react-native-firebase/auth'
import CMStoreKitHelper from '../helper/CMStoreKitHelper'
import CMHamburgerMenu from '../components/CMHamburgerMenu'

const CMLeagueScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)

	const [leagues, setLeagues] = useState([])
	const [showAddModal, setShowAddModal] = useState(false)
	const [isNoLeague, setIsNoLeague] = useState(false)

	const insets = useSafeAreaInsets()

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Get screen dimensions for responsive design
	const screenWidth = Dimensions.get('window').width
	const isSmallDevice = screenWidth < 375
	const isLargeDevice = screenWidth > 414
	const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0

	// Listen for theme changes
	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
		})
		return unsubscribe
	}, [navigation])

	// Dynamic colors based on theme
	const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black

	const loadLeagues = async () => {
		setRefreshing(true)
		// Show loading dialog for initial load (not for refresh)
		if (!refreshing) {
			setLoading(true)
		}
		CMFirebaseHelper.getLeagues(async (response: {[name: string]: any}) => {
			if (response.isSuccess) {
				let filteredLeagues = response.value;
				
				// Filter leagues based on permissions
				// Admin users can see all leagues
				// Coach users can only see leagues they created
				if (CMGlobal.user?.role !== 'admin') {
					// Get user ID - works for both regular Firebase auth and Apple Sign In
					const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
					if (currentUserId) {
						// Filter to only show leagues where user is admin
						filteredLeagues = response.value.filter((league: any) => {
							// Only show leagues where the user is the admin
							return league.adminId && league.adminId === currentUserId;
						});
						console.log('Filtered leagues for non-admin user:', filteredLeagues.length, 'out of', response.value.length, 'userId:', currentUserId);
					} else {
						// If not authenticated, show no leagues
						console.log('No user ID found, showing no leagues');
						filteredLeagues = [];
					}
				}
				
				setRefreshing(false)
				setLoading(false)
				setIsNoLeague(filteredLeagues.length == 0)
				setLeagues(filteredLeagues)
			} else {
				setRefreshing(false)
				setLoading(false)
				setIsNoLeague(true)
				setLeagues([])
			}
		})
	}

	useEffect(() => {
		// Ensure user data is loaded when screen first mounts
		const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
		if (currentUserId && (!CMGlobal.user || !CMGlobal.user.id)) {
			CMFirebaseHelper.getUser(currentUserId, (response: {[name: string]: any}) => {
				if (response.isSuccess) {
					CMGlobal.user = response.value
					console.log('User loaded on screen focus:', CMGlobal.user)
				}
			})
		}

		const unsubscribe = navigation.addListener('focus', () => {
			loadLeagues()
			// Refresh user data on focus - works for both regular Firebase auth and Apple Sign In
			const userId = CMGlobal.user?.id || getAuth().currentUser?.uid;
			if (userId && (!CMGlobal.user || !CMGlobal.user.id)) {
				CMFirebaseHelper.getUser(userId, (response: {[name: string]: any}) => {
					if (response.isSuccess) {
						CMGlobal.user = response.value
						console.log('User refreshed on focus:', CMGlobal.user)
					}
				})
			}
		})

		return unsubscribe
	}, [navigation])


	const onBtnAddLeague = () => {
		// Always show the add modal (join/create dialog) regardless of admin or user status
		setShowAddModal(true)
	}

	// Test IAP - Load products and show in alert
	const testIAPProducts = async () => {
		if (!CMStoreKitHelper.isAvailable()) {
			CMAlertDlgHelper.showAlertWithOK('IAP is not available on this platform.')
			return
		}

		const testProductIds = [
			CMConstants.storeKit.productIds.core.monthly,
			CMConstants.storeKit.productIds.core.annual,
			CMConstants.storeKit.productIds.pro.monthly,
			CMConstants.storeKit.productIds.pro.annual,
			CMConstants.storeKit.productIds.elite.monthly,
			CMConstants.storeKit.productIds.elite.annual,
		]

		try {
			console.log('Testing IAP: Loading products...', testProductIds)
			const products = await CMStoreKitHelper.loadProducts(testProductIds)
			
			console.log('IAP Products loaded:', products)
			
			if (products.length === 0) {
				CMAlertDlgHelper.showAlertWithOK(
					'IAP Test Results:\n\nNo products found.\n\n' +
					'This could mean:\n' +
					'1. Testing on simulator (IAP requires real device)\n' +
					'2. Not signed in with sandbox test account\n' +
					'3. Products not yet synced to device\n' +
					'4. Network connectivity issues\n\n' +
					'Product IDs tested:\n' + testProductIds.join('\n') +
					'\n\nNote: IAP testing requires:\n' +
					'- Real iOS device (not simulator)\n' +
					'- Sandbox test account signed in\n' +
					'- Products approved in App Store Connect'
				)
				return
			}

			// Format products for display
			const productsList = products.map((product, index) => {
				return `${index + 1}. ${product.displayName}\n   ID: ${product.productId}\n   Price: ${product.price}\n   Subscription: ${product.subscription ? 'Yes' : 'No'}`
			}).join('\n\n')

			CMAlertDlgHelper.showAlertWithOK(
				`IAP Test Results:\n\n✅ Successfully loaded ${products.length} product(s):\n\n${productsList}\n\n` +
				`Products are ready for purchase testing!`
			)
		} catch (error: any) {
			console.error('IAP Test Error:', error)
			const errorMessage = error.message || 'Failed to load products'
			const errorCode = error.code || 'UNKNOWN'
			
			CMAlertDlgHelper.showAlertWithOK(
				`IAP Test Error:\n\n${errorMessage}\n\n` +
				`Error Code: ${errorCode}\n\n` +
				`Common causes:\n` +
				`1. Testing on simulator (IAP requires real device)\n` +
				`2. Not signed in with sandbox test account\n` +
				`3. Products not synced yet (wait a few minutes after approval)\n` +
				`4. Network connectivity issues\n\n` +
				`Product IDs tested:\n${testProductIds.join('\n')}`
			)
		}
	}

	const onEditLeague = (league: any) => {
		navigation.navigate(CMConstants.screenName.editLeague, {isEdit: true, league: league})
	}

	const onDeleteLeague = async (league: any) => {
		// Check permissions before allowing delete
		const canEdit = await CMPermissionHelper.canEditLeague(league.id, league);
		if (!canEdit) {
			CMPermissionHelper.showPermissionDenied();
			return;
		}

		CMAlertDlgHelper.showConfirmAlert(
			'Delete League',
			`Are you sure you want to delete "${league.name}"? This will permanently delete the league and ALL associated data. This action cannot be undone.`,
			(confirmed: boolean) => {
				if (confirmed) {
					setLoading(true)
					CMFirebaseHelper.deleteLeagueWithAssociatedData(league.id, (response: {[name: string]: any}) => {
						// Ensure loading is cleared first
						setLoading(false)
						
						// Small delay to ensure loading state is fully cleared before showing alert
						setTimeout(() => {
							// Show alert with callback to refresh league list after alert is dismissed
							CMAlertDlgHelper.showAlertWithOK(response.value || (response.isSuccess ? 'League deleted successfully!' : 'Failed to delete league.'), () => {
								// Use multiple animation frames and longer timeout to ensure UI is fully settled
								requestAnimationFrame(() => {
									requestAnimationFrame(() => {
										setTimeout(() => {
											if (response.isSuccess) {
												// Ensure loading and refreshing states are cleared before refreshing
												setLoading(false)
												setRefreshing(false)
												// Small delay before refreshing to ensure UI is ready
												setTimeout(() => {
													// Refresh the league list after successful deletion
													loadLeagues()
												}, 50)
											}
										}, 300) // Increased timeout to 300ms for better stability
									})
								})
							})
						}, 100) // Small delay before showing alert
					})
				}
			}
		)
	}

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog
				visible={loading}
			/>

			<View style={{ flex: 1 }}>
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
								currentRoute="League"
							/>
							<View style={{ width: CMConstants.space.small }} />
							<Text style={{ fontSize: CMConstants.fontSize.large * fontScale, fontWeight: 'bold', color: textColor }}>
								Leagues
							</Text>
						</View>
						<View style={{ flexDirection: 'row', gap: CMConstants.space.small }}>
							{/* <CMRipple
								containerStyle={{
									...CMCommonStyles.circle(CMConstants.height.iconBig),
									justifyContent: 'center',
									alignItems: 'center',
									borderWidth: 1.5,
									borderColor: CMConstants.color.orange,
								}}
								onPress={testIAPProducts}
							>
								<Ionicons
									name={"card-outline"}
									size={CMConstants.height.icon * 0.8}
									color={CMConstants.color.orange}
								/>
							</CMRipple> */}
							<CMRipple
								containerStyle={{
									...CMCommonStyles.circle(CMConstants.height.iconBig),
									justifyContent: 'center',
									alignItems: 'center',
									borderWidth: 1.5,
									borderColor: CMConstants.color.green,
								}}
								onPress={onBtnAddLeague}
							>
								<Ionicons
									name={"add-outline"}
									size={CMConstants.height.icon * 0.8}
									color={CMConstants.color.green}
								/>
							</CMRipple>
						</View>
					</View>
				</View>

				<View style={{flex: 1, marginHorizontal: CMConstants.space.normal}}>
					{isNoLeague ? (
						<View style={styles.emptyStateContainer}>
							<Ionicons
								name="trophy-outline"
								size={64}
								color={CMConstants.color.green}
								style={styles.emptyStateIcon}
							/>
							<Text style={[styles.emptyStateTitle, { color: textColor }]}>
								No league!
							</Text>
							<Text style={[styles.emptyStateText, { color: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey }]}>
								There is currently no league, create a league and become an admin of it or join an existing league with an invite code.
							</Text>
							<CMRipple
								containerStyle={styles.startButton}
								onPress={() => {setShowAddModal(true)}}
								color={CMConstants.color.white}
							>
								<Text style={styles.startButtonText}>Start</Text>
							</CMRipple>
						</View>
					) :(
						<FlatList
							style={{flex: 0, marginBottom: insets.bottom}}
							refreshing={refreshing}
							onRefresh={() => loadLeagues()}
							initialNumToRender={leagues.length}
							data={leagues}
							renderItem={({ item, separators }) => (
								<CMLeagueCell
									league={item}
									onPress={() => {
										navigation.navigate(CMConstants.screenName.leagueDetails, {league: item})
									}}
									onEdit={onEditLeague}
									onDelete={onDeleteLeague}
								/>
							)}
							ItemSeparatorComponent={({ highlighted }) => (
								<View style={{height: CMConstants.space.smallEx}} />
							)}
							ListHeaderComponent={
								loading && leagues.length > 0 ? (
									<View style={styles.loadingHeaderFooterContainer}>
										<ActivityIndicator size="small" color={CMConstants.color.green} />
                    <Text style={[styles.loadingText, { color: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey }]}>Loading...</Text>
									</View>
								) : null
							}
							ListFooterComponent={
								loading && leagues.length > 0 ? (
									<View style={styles.loadingHeaderFooterContainer}>
										<ActivityIndicator size="small" color={CMConstants.color.green} />
                    <Text style={[styles.loadingText, { color: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey }]}>Loading more...</Text>
									</View>
								) : null
							}
							ListEmptyComponent={
								!loading ? (
									<View style={styles.emptyContainer}>
										<Text style={[styles.emptyText, { color: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey }]}>No leagues available</Text>
									</View>
								) : (
									<View style={styles.emptyContainer}>
										<ActivityIndicator size="large" color={CMConstants.color.green} />
										<Text style={[styles.loadingText, { color: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey }]}>Loading leagues...</Text>
									</View>
								)
							}
						/>
					)}
				</View>
			</View>

			<CMModal
				isVisible={showAddModal}
				content={
					<CMAddLeagueModalContent
						isAdmin={CMGlobal.user?.role === 'admin'}
						callback={(action: number, code: string) => {
							if (action == 0) {
								setShowAddModal(false)
								return
							}
							// if (!CMGlobal.user.teamId) {
							// 	CMAlertDlgHelper.showAlertWithOK('Create your team first.')
							// 	return
							// }
							if (action == 1) {// join league
								setShowAddModal(false)
								setLoading(true)
								try {
									// Get current user ID - works for both regular Firebase auth and Apple Sign In
									const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
									if (!currentUserId) {
										setLoading(false)
										CMAlertDlgHelper.showAlertWithOK('Please log in to join a league.')
										return
									}
									
									// Check if teamId is available in CMGlobal.user
									let teamIdToUse = CMGlobal.user?.teamId;
									
									// If teamId is not available, try to get user's team(s) by coachId
									if (!teamIdToUse) {
										console.log('[Join League] teamId not found in CMGlobal.user, fetching user teams...');
										CMFirebaseHelper.getTeamsByCoach(currentUserId, (teamsResponse: {[name: string]: any}) => {
											// Use setTimeout to ensure callback is processed on next tick
											setTimeout(() => {
												if (teamsResponse.isSuccess && teamsResponse.value && teamsResponse.value.length > 0) {
													// Use the first team found
													teamIdToUse = teamsResponse.value[0].id;
													// Update CMGlobal.user.teamId for future use
													if (CMGlobal.user) {
														CMGlobal.user.teamId = teamIdToUse;
													}
													console.log('[Join League] Found team:', teamIdToUse);
													
													// Now join the league with the found team
													// Add a small delay to ensure previous operations complete
													setTimeout(() => {
														CMFirebaseHelper.joinLeagues(code, teamIdToUse, (response: {[name: string]: any}) => {
															// Clear loading state first
															setLoading(false)
															
															// Wait for all interactions and animations to complete before showing alert
															InteractionManager.runAfterInteractions(() => {
																// Additional delay to ensure loading modal is fully dismissed
																setTimeout(() => {
																	CMAlertDlgHelper.showAlertWithOK(response.value || 'Failed to join league. Please try again.')
																	if (response.isSuccess) {
																		// Reload leagues after a short delay to ensure alert is shown
																		setTimeout(() => {
																			loadLeagues()
																		}, 500)
																	}
																}, 300)
															})
														})
													}, 100)
												} else {
													setLoading(false)
													// Wait for interactions before showing alert
													InteractionManager.runAfterInteractions(() => {
														setTimeout(() => {
															CMAlertDlgHelper.showAlertWithOK('No team found. Please create a team first before joining a league.')
														}, 300)
													})
												}
											}, 0)
										})
										return; // Exit early, callback will handle the rest
									}
									
									// teamId is available, proceed with joining
									CMFirebaseHelper.joinLeagues(code, teamIdToUse, (response: {[name: string]: any}) => {
										// Clear loading state first
										setLoading(false)
										
										// Wait for all interactions and animations to complete before showing alert
										InteractionManager.runAfterInteractions(() => {
											// Additional delay to ensure loading modal is fully dismissed
											setTimeout(() => {
												CMAlertDlgHelper.showAlertWithOK(response.value || 'Failed to join league. Please try again.')
												if (response.isSuccess) {
													// Reload leagues after a short delay to ensure alert is shown
													setTimeout(() => {
														loadLeagues()
													}, 500)
												}
											}, 300)
										})
									})
								} catch (error) {
									console.error('Join league error:', error)
									setLoading(false)
									CMAlertDlgHelper.showAlertWithOK('An unexpected error occurred. Please try again.')
								}
							} else if (action == 2) {// create league
								// Check conditions when "Create League" is clicked
								// Check for both regular Firebase auth and Apple Sign In users
								const currentUser = getAuth().currentUser
								const appleSignInUser = CMGlobal.user?.id
								if (!currentUser && !appleSignInUser) {
									CMAlertDlgHelper.showAlertWithOK('Please log in to create a league.')
									return
								}

								// Check if user is admin first (use CMGlobal.user if available, otherwise fetch)
								if (CMGlobal.user?.role === 'admin') {
									// Close add modal and navigate directly
									setShowAddModal(false)
									setTimeout(() => {
										navigation.navigate(CMConstants.screenName.editLeague, {
											isEdit: false
										})
									}, 100)
									return
								}

								// Stage-based league creation gate.
								// Keep the paywall flow in place, but allow us to temporarily open league creation
								// until Apple subscription setup is finalized.
								const leagueCreationStage = CMConstants.featureFlags?.leagueCreationStage || 'open'
								setShowAddModal(false)
								setTimeout(() => {
									if (leagueCreationStage === 'subscription_required') {
										const subscriptionDecision = CMSubscriptionHelper.canCreateLeagueUnderSubscriptionPolicy()
										if (subscriptionDecision.allowed) {
											navigation.navigate(CMConstants.screenName.editLeague, {
												isEdit: false,
											})
											return
										}

										if (subscriptionDecision.message) {
											CMAlertDlgHelper.showAlertWithOK(subscriptionDecision.message)
										}
										navigation.navigate(CMConstants.screenName.paywall)
										return
									}

									navigation.navigate(CMConstants.screenName.editLeague, {
										isEdit: false,
									})
								}, 100)
							} else if (action == 3) { // view paywall
								setShowAddModal(false)
								setTimeout(() => {
									navigation.navigate(CMConstants.screenName.paywall)
								}, 100)
							}
						}}
					/>
				}
			/>

			{/* Paywall modal removed - all users can create leagues without payment */}
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	emptyStateContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: CMConstants.space.large,
		paddingVertical: CMConstants.space.large,
	},
	emptyStateIcon: {
		marginBottom: CMConstants.space.normal,
		opacity: 0.8,
	},
	emptyStateTitle: {
		fontSize: CMConstants.fontSize.largeEx,
		fontFamily: CMConstants.font.bold,
		marginBottom: CMConstants.space.normal,
		textAlign: 'center',
	},
	emptyStateText: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.regular,
		textAlign: 'center',
		marginBottom: CMConstants.space.large,
		lineHeight: CMConstants.fontSize.normal * 1.5,
	},
	startButton: {
		backgroundColor: CMConstants.color.green,
		height: CMConstants.height.buttonNormal,
		borderRadius: CMConstants.radius.normal,
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 6,
		width: '100%',
	},
	startButtonText: {
		color: CMConstants.color.white,
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.5,
	},
	loadingHeaderFooterContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: CMConstants.space.normal,
		gap: CMConstants.space.smallEx,
	},
	loadingText: {
		fontSize: CMConstants.fontSize.small,
		fontFamily: CMConstants.font.regular,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: CMConstants.space.large,
	},
	emptyText: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.regular,
		textAlign: 'center',
	},
})

export default CMLeagueScreen

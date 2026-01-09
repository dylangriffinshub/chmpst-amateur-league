import React, {useState, useEffect} from 'react'
import {Alert, Keyboard, SafeAreaView, View, ViewStyle, Text, ScrollView, TextStyle, Modal, TouchableOpacity, TextInput} from 'react-native'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {useToast} from 'react-native-toast-notifications'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMUtils from '../utils/CMUtils';
import CMProfileImage from '../components/CMProfileImage';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMGlobal from '../CMGlobal';
import CMRipple from '../components/CMRipple';
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper';
import { getAuth } from '@react-native-firebase/auth';
import firestore, { Timestamp } from '@react-native-firebase/firestore';
import CMLoadingDialog from '../dialog/CMLoadingDialog';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const logCodeClaimDebug = (stage: string, payload: { [name: string]: any }) => {
	try {
		console.log(`[CodeClaim][PlayerDetails][${stage}]`, JSON.stringify(payload, null, 2))
	} catch (error) {
		console.log(`[CodeClaim][PlayerDetails][${stage}]`, payload)
	}
}

const CMPlayerDetailsScreen = ({navigation, route}: CMNavigationProps) => {
	const insets = useSafeAreaInsets()
	const toast = useToast()

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark
	const Tab = createMaterialTopTabNavigator()

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
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const valueColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const statDotColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const emptyStateTextColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey

	const player = route.params.player
	const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid
	const [claimModalVisible, setClaimModalVisible] = useState(false)
	const [claimCodeModalVisible, setClaimCodeModalVisible] = useState(false)
	const [claimCode, setClaimCode] = useState('')
	const [league, setLeague] = useState<{ [name: string]: any }>({})
	const [claimOwnerId, setClaimOwnerId] = useState(player.claimedByUserId || '')
	const [hasPendingClaimRequest, setHasPendingClaimRequest] = useState(false)
	const [latestClaimStatus, setLatestClaimStatus] = useState<'pending' | 'approved' | 'denied' | ''>('')
	const [latestClaimReason, setLatestClaimReason] = useState('')
	const [isClaimSubmitting, setIsClaimSubmitting] = useState(false)
	const [latestOwnedInvite, setLatestOwnedInvite] = useState<{ [name: string]: any } | null>(null)

	const [team, setTeam] = useState<{ [name: string]: any }>({});
	const [lastThreeGames, setLastThreeGames] = useState<{ [name: string]: any }[]>([]);
	const [seasonStats, setSeasonStats] = useState<{ [name: string]: any }>({});
	const [gameMatches, setGameMatches] = useState<{ [matchId: string]: { match: any, teamA: any, teamB: any } }>({});
	const playerAddress = [player.city, player.state, player.country].filter(Boolean).join(', ')
	const isOwnPlayer =
		!!currentUserId &&
		(
			player?.createdBy === currentUserId ||
			player?.claimedByUserId === currentUserId ||
			team?.coachId === currentUserId
		)
	const playerBirthDate = player.birthDate?.toDate ? player.birthDate.toDate() : null
	const playerAge = playerBirthDate
		? (() => {
			const today = new Date()
			let age = today.getFullYear() - playerBirthDate.getFullYear()
			const hasNotHadBirthdayYet =
				today.getMonth() < playerBirthDate.getMonth() ||
				(today.getMonth() === playerBirthDate.getMonth() && today.getDate() < playerBirthDate.getDate())
			if (hasNotHadBirthdayYet) {
				age -= 1
			}
			return age >= 0 ? age : null
		})()
		: null

	const loadOwnedInviteState = () => {
		if (!player?.id || !currentUserId || !isOwnPlayer) {
			setLatestOwnedInvite(null)
			return
		}

		firestore()
			.collection(CMConstants.collectionName.playerInvites)
			.where('playerId', '==', player.id)
			.get()
			.then((snapshot) => {
				let latestInvite: { [name: string]: any } | null = null
				let latestCreatedAt = 0

				snapshot.forEach((documentSnapshot) => {
					const invite = documentSnapshot.data()
					const belongsToOwner =
						invite?.playerOwnerCoachId === currentUserId ||
						(!!player?.teamId && invite?.teamId === player.teamId)

					if (!belongsToOwner) {
						return
					}

					const createdAt = invite?.createdAt?.toDate?.()?.getTime?.() || 0
					if (createdAt >= latestCreatedAt) {
						latestCreatedAt = createdAt
						latestInvite = {
							id: documentSnapshot.id,
							...invite,
							status: `${invite?.status || ''}`.toLowerCase() === 'payment_requested'
								? 'pending'
								: invite?.status || 'pending',
						}
					}
				})

				setLatestOwnedInvite(latestInvite)
			})
			.catch((error) => {
				console.log('Failed to load player invite state:', error)
				setLatestOwnedInvite(null)
			})
	}

	const loadPendingClaimState = () => {
		if (!player?.id || !currentUserId) {
			setHasPendingClaimRequest(false)
			return
		}

		firestore()
			.collection('playerClaims')
			.where('playerId', '==', player.id)
			.where('requesterUserId', '==', currentUserId)
			.get()
			.then((snapshot) => {
				let latestStatus: 'pending' | 'approved' | 'denied' | '' = ''
				let latestReason = ''
				let latestCreatedAt = 0

				snapshot.forEach((documentSnapshot) => {
					const claim = documentSnapshot.data()
					const createdAt = claim?.createdAt?.toDate?.()?.getTime?.() || 0
					if (createdAt >= latestCreatedAt) {
						latestCreatedAt = createdAt
						latestStatus = `${claim?.status || ''}`.toLowerCase() as 'pending' | 'approved' | 'denied' | ''
						latestReason = claim?.denialReason || ''
					}
				})

				setLatestClaimStatus(latestStatus)
				setLatestClaimReason(latestReason)
				setHasPendingClaimRequest(latestStatus === 'pending')
			})
			.catch((error) => {
				console.log('Failed to load player claim request state:', error)
				setHasPendingClaimRequest(false)
				setLatestClaimStatus('')
				setLatestClaimReason('')
			})
	}

	useEffect(() => {
		navigation.setOptions({
			title: 'Player Details',
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
				if (isOwnPlayer) {
					return null
				}

				return (
					<CMRipple
						containerStyle={styles.claimHeaderButton}
						onPress={() => {
							if (hasPendingClaimRequest) {
								CMAlertDlgHelper.showAlertWithOK('Claim request already sent. Please wait for commissioner review.')
								return
							}
							setClaimModalVisible(true)
						}}
					>
						<Ionicons
							name={claimOwnerId === currentUserId ? 'checkmark-circle-outline' : hasPendingClaimRequest ? 'time-outline' : 'person-add-outline'}
							size={20}
							color={CMConstants.color.green}
						/>
					</CMRipple>
				)
			},
		})
		
		// Load team
		if (player.teamId) {
			CMFirebaseHelper.getTeams(
				[player.teamId],
				(response: { [name: string]: any }) => {
					if (response.isSuccess && response.value.length > 0) {
						const loadedTeam = response.value[0] || {};
						setTeam(loadedTeam);
					}
				},
			);

			CMFirebaseHelper.getAllLeagues((response: { [name: string]: any }) => {
				if (response.isSuccess) {
					const playerLeague = (response.value || []).find((item: any) =>
						Array.isArray(item?.teamsId) && item.teamsId.includes(player.teamId)
					) || {}
					setLeague(playerLeague)
				}
			})
		}

		// Load last 3 games stats
		if (player.id) {
			CMFirebaseHelper.getLastThreeGamesStats(
				player.id,
				(response: { [name: string]: any }) => {
					if (response.isSuccess) {
						const games = response.value || [];
						setLastThreeGames(games);
						
						// Load match data for each game
						games.forEach((game: { [name: string]: any }) => {
							if (game.matchId) {
								// Load match
								CMFirebaseHelper.getMatch(
									game.matchId,
									(matchResponse: { [name: string]: any }) => {
										if (matchResponse.isSuccess) {
											const match = matchResponse.value;
											const matchData: { match: any, teamA: any, teamB: any } = {
												match: match,
												teamA: {},
												teamB: {},
											};
											
											// Load teams
											if (match.teamAId && match.teamBId) {
												CMFirebaseHelper.getTeams(
													[match.teamAId, match.teamBId],
													(teamsResponse: { [name: string]: any }) => {
														if (teamsResponse.isSuccess) {
															matchData.teamA = teamsResponse.value[0] || {};
															matchData.teamB = teamsResponse.value[1] || {};
														}
														setGameMatches((prev) => ({
															...prev,
															[game.matchId]: matchData,
														}));
													},
												);
											} else {
												setGameMatches((prev) => ({
													...prev,
													[game.matchId]: matchData,
												}));
											}
										}
									},
								);
							}
						});
					}
				},
			);

			// Load season stats
			CMFirebaseHelper.getPlayerSeasonStats(
				player.id,
				(response: { [name: string]: any }) => {
					if (response.isSuccess) {
						setSeasonStats(response.value || {});
					}
				},
			);

			loadPendingClaimState()
			loadOwnedInviteState()
		}
	}, [player, claimOwnerId, currentUserId, headerBackgroundColor, headerTextColor, hasPendingClaimRequest, isOwnPlayer, team?.coachId])

	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
			loadPendingClaimState()
			loadOwnedInviteState()
		})
		return unsubscribe
	}, [navigation, player?.id, currentUserId, isOwnPlayer])

	const onAskToClaim = async () => {
		if (!currentUserId) {
			CMAlertDlgHelper.showAlertWithOK('Please sign in to claim this player.')
			return
		}

		if (claimOwnerId === currentUserId) {
			CMAlertDlgHelper.showAlertWithOK('You already claimed this player.')
			return
		}

		if (hasPendingClaimRequest) {
			CMAlertDlgHelper.showAlertWithOK('Claim request already sent. Please wait for commissioner review.')
			return
		}

		let resolvedTeam = team
		if ((!resolvedTeam?.coachId || !resolvedTeam?.name) && player?.teamId) {
			const teamResponse = await new Promise<{ isSuccess: boolean; value: any }>((resolve) => {
				CMFirebaseHelper.getTeamById(player.teamId, (response: { [name: string]: any }) => {
					resolve(response as { isSuccess: boolean; value: any })
				})
			})

			if (teamResponse.isSuccess && teamResponse.value) {
				resolvedTeam = { id: player.teamId, ...teamResponse.value }
				setTeam(resolvedTeam)
			}
		}

		const reviewOwnerId = resolvedTeam?.coachId || league?.adminId
		if (!reviewOwnerId) {
			CMAlertDlgHelper.showAlertWithOK('Coach or commissioner not found for this player.')
			return
		}

		try {
			setIsClaimSubmitting(true)
			const claimId = CMFirebaseHelper.getNewDocumentId('playerClaims')
			await firestore()
				.collection('playerClaims')
				.doc(claimId)
				.set({
					id: claimId,
					playerId: player.id,
					playerName: player.name || '',
					playerAvatar: player.avatar || '',
					requesterUserId: currentUserId,
					requesterName: CMGlobal.user?.name || getAuth().currentUser?.displayName || 'Unknown User',
					requesterEmail: CMGlobal.user?.email || getAuth().currentUser?.email || '',
					reviewOwnerId,
					commissionerId: league.adminId || reviewOwnerId,
					teamCoachId: resolvedTeam?.coachId || '',
					leagueId: league.id || '',
					leagueName: league.name || '',
					teamId: player.teamId || '',
					teamName: resolvedTeam?.name || '',
					status: 'pending',
					claimMethod: 'commissioner_request',
					createdAt: Timestamp.now(),
				})

			setClaimModalVisible(false)
			setHasPendingClaimRequest(true)
			setLatestClaimStatus('pending')
			setLatestClaimReason('')
			CMAlertDlgHelper.showAlertWithOK('Claim request sent to commissioner. You can only claim this player after approval.')
		} catch (error) {
			console.log('Failed to create player claim request:', error)
			CMAlertDlgHelper.showAlertWithOK('Failed to send claim request.')
		} finally {
			setIsClaimSubmitting(false)
		}
	}

	const onClaimByCode = () => {
		setClaimModalVisible(false)
		setClaimCode('')
		setTimeout(() => {
			setClaimCodeModalVisible(true)
		}, 150)
	}

	const closeClaimCodeModal = () => {
		Keyboard.dismiss()
		setClaimCodeModalVisible(false)
		setClaimCode('')
	}

	const validateClaimCodeWithFirebase = async (enteredCode: string) => {
		return new Promise<{ isSuccess: boolean; league?: { [name: string]: any }; message?: string }>((resolve) => {
			CMFirebaseHelper.getAllLeagues((response: { [name: string]: any }) => {
				if (!response?.isSuccess || !Array.isArray(response.value)) {
					resolve({
						isSuccess: false,
						message: response?.value || 'Failed to verify the league code.',
					})
					return
				}

				const normalizedCode = enteredCode.trim()
				const matchedLeague = response.value.find((item: { [name: string]: any }) => {
					const sameInviteId = `${item?.inviteId || ''}`.trim() === normalizedCode
					const sameLeague = !!league?.id && item?.id === league.id
					const containsTeam = Array.isArray(item?.teamsId) && !!player?.teamId && item.teamsId.includes(player.teamId)
					return sameInviteId && (sameLeague || containsTeam)
				})

				if (!matchedLeague) {
					resolve({
						isSuccess: false,
						message: 'Incorrect league code.',
					})
					return
				}

				resolve({
					isSuccess: true,
					league: matchedLeague,
				})
			})
		})
	}

	const finalizeCodeClaim = async () => {
		const now = Timestamp.now()
		logCodeClaimDebug('finalize:start', {
			playerId: player?.id || '',
			playerName: player?.name || '',
			requesterUserId: currentUserId || '',
			teamId: player?.teamId || '',
			teamName: team?.name || '',
			teamCoachId: team?.coachId || '',
			leagueId: league?.id || '',
			leagueName: league?.name || '',
			leagueAdminId: league?.adminId || '',
		})
		const existingClaimSnapshot = await firestore()
			.collection('playerClaims')
			.where('playerId', '==', player.id)
			.where('requesterUserId', '==', currentUserId)
			.get()

		const matchingClaimDoc = existingClaimSnapshot.docs.find((documentSnapshot) => {
			const data = documentSnapshot.data()
			return `${data?.claimMethod || ''}`.toLowerCase() === 'code'
		})

		const existingInviteSnapshot = await firestore()
			.collection(CMConstants.collectionName.playerInvites)
			.where('inviterUserId', '==', currentUserId)
			.where('playerId', '==', player.id)
			.get()

		const hasActiveInvite = existingInviteSnapshot.docs.some((documentSnapshot) => {
			const status = `${documentSnapshot.data()?.status || ''}`.toLowerCase()
			return status === 'pending' || status === 'payment_requested' || status === 'accepted' || status === 'sent'
		})
		logCodeClaimDebug('finalize:existing-records', {
			existingClaimCount: existingClaimSnapshot.size,
			matchingCodeClaimId: matchingClaimDoc?.id || '',
			existingInviteCount: existingInviteSnapshot.size,
			hasActiveInvite,
		})

		const batch = firestore().batch()
		const playerRef = firestore().collection(CMConstants.collectionName.players).doc(player.id)
		batch.update(playerRef, {
			claimedByUserId: currentUserId,
			claimedByUserName: CMGlobal.user?.name || getAuth().currentUser?.displayName || 'Unknown User',
			claimedAt: now,
			claimMethod: 'code',
		})

		if (matchingClaimDoc) {
			batch.update(matchingClaimDoc.ref, {
				status: 'approved',
				claimMethod: 'code',
				approvedAt: now,
				denialReason: '',
			})
		} else {
			const claimId = CMFirebaseHelper.getNewDocumentId('playerClaims')
			const claimRef = firestore().collection('playerClaims').doc(claimId)
			batch.set(claimRef, {
				id: claimId,
				playerId: player.id,
				playerName: player.name || '',
				playerAvatar: player.avatar || '',
				requesterUserId: currentUserId,
				requesterName: CMGlobal.user?.name || getAuth().currentUser?.displayName || 'Unknown User',
				requesterEmail: CMGlobal.user?.email || getAuth().currentUser?.email || '',
				reviewOwnerId: team.coachId || league.adminId || '',
				commissionerId: league.adminId || team.coachId || '',
				teamCoachId: team.coachId || '',
				leagueId: league.id || '',
				leagueName: league.name || '',
				teamId: player.teamId || '',
				teamName: team.name || '',
				status: 'approved',
				claimMethod: 'code',
				createdAt: now,
				approvedAt: now,
			})
		}

		let inviteCreated = false
		if (!hasActiveInvite) {
			inviteCreated = true
			const inviteId = CMFirebaseHelper.getNewDocumentId(CMConstants.collectionName.playerInvites)
			const inviteRef = firestore().collection(CMConstants.collectionName.playerInvites).doc(inviteId)
			batch.set(inviteRef, {
				id: inviteId,
				playerId: player.id,
				playerName: player.name || '',
				playerAvatar: player.avatar || '',
				inviterUserId: currentUserId,
				inviterName: CMGlobal.user?.name || getAuth().currentUser?.displayName || 'Unknown User',
				inviterEmail: CMGlobal.user?.email || getAuth().currentUser?.email || '',
				claimedUserId: currentUserId || '',
				playerOwnerCoachId: team.coachId || '',
				playerOwnerCoachName: team.name || '',
				teamId: player.teamId || '',
				teamName: team.name || '',
				leagueId: league.id || '',
				leagueName: league.name || '',
				durationType: 'claimed_by_code',
				durationLabel: 'Claimed by code',
				requesterMessage: '',
				status: 'pending',
				rejectionReason: '',
				createdAt: now,
			})
		}

		await batch.commit()
		logCodeClaimDebug('finalize:success', {
			playerId: player?.id || '',
			requesterUserId: currentUserId || '',
			inviteCreated,
			matchingCodeClaimId: matchingClaimDoc?.id || '',
		})
		return { inviteCreated }
	}

	const runWithRetry = async <T,>(operation: () => Promise<T>, retries = 1): Promise<T> => {
		let lastError: any
		for (let attempt = 0; attempt <= retries; attempt += 1) {
			try {
				return await operation()
			} catch (error) {
				lastError = error
				if (attempt < retries) {
					await wait(250)
				}
			}
		}
		throw lastError
	}

	const onSubmitClaimCode = async () => {
		if (!currentUserId) {
			Alert.alert(CMConstants.appName, 'Please sign in to claim this player.')
			return
		}

		if (claimOwnerId && claimOwnerId !== currentUserId) {
			Alert.alert(CMConstants.appName, 'This player has already been claimed by another user.')
			return
		}

		if (claimCode.trim().length === 0) {
			Alert.alert(CMConstants.appName, 'Please enter a league code.')
			return
		}

		Keyboard.dismiss()
		setIsClaimSubmitting(true)
		const codeValidationResult = await validateClaimCodeWithFirebase(claimCode)
		logCodeClaimDebug('validate:result', {
			playerId: player?.id || '',
			requesterUserId: currentUserId || '',
			enteredCode: claimCode.trim(),
			isSuccess: codeValidationResult.isSuccess,
			message: codeValidationResult.message || '',
			leagueId: codeValidationResult.league?.id || '',
			leagueName: codeValidationResult.league?.name || '',
			leagueInviteId: codeValidationResult.league?.inviteId || '',
		})
		if (!codeValidationResult.isSuccess) {
			setIsClaimSubmitting(false)
			Alert.alert(CMConstants.appName, codeValidationResult.message || 'Incorrect league code.')
			return
		}

		runWithRetry(() => finalizeCodeClaim())
			.then(({ inviteCreated }) => {
				setClaimOwnerId(currentUserId)
				setHasPendingClaimRequest(false)
				setLatestClaimStatus('approved')
				setLatestClaimReason('')
				setIsClaimSubmitting(false)
				closeClaimCodeModal()
				Alert.alert(
					CMConstants.appName,
					inviteCreated
						? 'Player claimed and invited successfully by code.'
						: 'Player claimed successfully by code.',
				)
			})
			.catch((error) => {
				logCodeClaimDebug('finalize:error', {
					playerId: player?.id || '',
					requesterUserId: currentUserId || '',
					errorMessage: error?.message || String(error),
					errorCode: error?.code || '',
					errorStack: error?.stack || '',
					teamId: player?.teamId || '',
					leagueId: league?.id || '',
				})
				setIsClaimSubmitting(false)
				CMAlertDlgHelper.showAlertWithOK('Failed to complete the code claim. Please try again.')
			})
	}

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog visible={isClaimSubmitting} />
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: insets.bottom + CMConstants.space.smallEx }}
				showsVerticalScrollIndicator={false}
			>
				{/* Profile Header */}
				<View style={styles.profileHeader}>
					<View style={styles.profileImageContainer}>
						<CMProfileImage
							radius={50}
							imgURL={player.avatar}
						/>
					</View>
					<View style={styles.playerInfoHeader}>
						<Text style={[styles.playerName, { color: textColor }]} numberOfLines={1}>
							{player.name}
						</Text>
						{player.position && (
							<View style={[styles.positionBadge, { backgroundColor: cardBackgroundColor, borderColor: CMConstants.color.green }]}>
								<Ionicons name="basketball-outline" size={12} color={CMConstants.color.green} />
								<Text style={styles.positionText}>{player.position}</Text>
							</View>
						)}
						{team.name && (
							<View style={styles.teamBadge}>
								<Ionicons name="people-outline" size={12} color={labelColor} />
								<Text style={[styles.teamText, { color: labelColor }]}>{team.name}</Text>
							</View>
						)}
					</View>
				</View>

				{/* Quick Stats */}
				<View style={styles.quickStatsContainer}>
					<View style={[styles.quickStatCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
						<View style={styles.quickStatIconContainer}>
							<Ionicons name="trophy-outline" size={16} color={CMConstants.color.green} />
						</View>
						<Text style={styles.quickStatValue}>{seasonStats.pointsPerGame || '0.0'}</Text>
						<Text style={[styles.quickStatLabel, { color: labelColor }]}>PPG</Text>
					</View>
					<View style={[styles.quickStatCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
						<View style={styles.quickStatIconContainer}>
							<Ionicons name="calendar-outline" size={16} color={CMConstants.color.green} />
						</View>
						<Text style={styles.quickStatValue}>{seasonStats.gamesPlayed || 0}</Text>
						<Text style={[styles.quickStatLabel, { color: labelColor }]}>Games</Text>
					</View>
					<View style={[styles.quickStatCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
						<View style={styles.quickStatIconContainer}>
							<Ionicons name="shirt-outline" size={16} color={CMConstants.color.green} />
						</View>
						<Text style={styles.quickStatValue}>{player.number || 'N/A'}</Text>
						<Text style={[styles.quickStatLabel, { color: labelColor }]}>Jersey</Text>
					</View>
				</View>

				{!!currentUserId && latestClaimStatus === 'denied' && (
					<View style={[styles.claimStatusCard, { backgroundColor: 'rgba(180, 75, 75, 0.12)', borderColor: '#B44B4B' }]}>
						<View style={styles.claimStatusHeader}>
							<Ionicons name="alert-circle-outline" size={18} color="#E57F7F" />
							<Text style={[styles.claimStatusTitle, { color: '#E57F7F' }]}>Previous claim denied</Text>
						</View>
						<Text style={[styles.claimStatusText, { color: labelColor }]}>
							{latestClaimReason || 'The commissioner denied your last claim request. You can try again or use a valid claim code.'}
						</Text>
					</View>
				)}

				{isOwnPlayer && !!latestOwnedInvite && (
					<View
						style={[
							styles.claimStatusCard,
							{
								backgroundColor:
									latestOwnedInvite.status === 'rejected'
										? 'rgba(180, 75, 75, 0.12)'
										: 'rgba(0, 217, 118, 0.12)',
								borderColor:
									latestOwnedInvite.status === 'rejected'
										? '#B44B4B'
										: CMConstants.color.green,
							},
						]}
					>
						<View style={styles.claimStatusHeader}>
							<Ionicons
								name="paper-plane-outline"
								size={18}
								color={
									latestOwnedInvite.status === 'rejected'
										? '#E57F7F'
										: CMConstants.color.green
								}
							/>
							<Text
								style={[
									styles.claimStatusTitle,
									{
										color:
											latestOwnedInvite.status === 'rejected'
												? '#E57F7F'
												: CMConstants.color.green,
									},
								]}
							>
								Player Invite
							</Text>
						</View>
						<Text style={[styles.claimStatusText, { color: labelColor }]}>
							Requested by: {latestOwnedInvite.inviterName || 'Unknown Coach'}
						</Text>
						{!!latestOwnedInvite.inviterTeamName && (
							<Text style={[styles.claimStatusText, { color: labelColor }]}>
								Using for: {latestOwnedInvite.inviterTeamName}
							</Text>
						)}
						{!!latestOwnedInvite.durationLabel && (
							<Text style={[styles.claimStatusText, { color: labelColor }]}>
								Duration: {latestOwnedInvite.durationLabel}
							</Text>
						)}
						<Text style={[styles.claimStatusText, { color: labelColor }]}>
							Status: {`${latestOwnedInvite.status || 'pending'}`.replace(/_/g, ' ')}
						</Text>
						{!!latestOwnedInvite.rejectionReason && (
							<Text style={[styles.claimStatusText, { color: labelColor }]}>
								Rejection Reason: {latestOwnedInvite.rejectionReason}
							</Text>
						)}
					</View>
				)}

				{/* Player Details */}
				<View style={[styles.infoCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
					<View style={styles.infoRow}>
						<View style={styles.infoItemWithIcon}>
							<Ionicons name="calendar" size={14} color={CMConstants.color.green} style={styles.infoIcon} />
							<View style={styles.infoItemContent}>
								<Text style={[styles.infoLabel, { color: labelColor }]}>Birthday</Text>
								<Text style={[styles.infoValue, { color: valueColor }]}>
									{playerBirthDate
										? `${CMUtils.strSimpleDate(playerBirthDate)}${playerAge !== null ? ` (${playerAge})` : ''}`
										: 'N/A'}
								</Text>
							</View>
						</View>
						<View style={styles.infoItemWithIcon}>
							<Ionicons name="resize-outline" size={14} color={CMConstants.color.green} style={styles.infoIcon} />
							<View style={styles.infoItemContent}>
								<Text style={[styles.infoLabel, { color: labelColor }]}>Height</Text>
								<Text style={[styles.infoValue, { color: valueColor }]}>{player.height || 'N/A'}</Text>
							</View>
						</View>
					</View>
					<View style={styles.infoRow}>
						<View style={styles.infoItemWithIcon}>
							<Ionicons name="barbell-outline" size={14} color={CMConstants.color.green} style={styles.infoIcon} />
							<View style={styles.infoItemContent}>
								<Text style={[styles.infoLabel, { color: labelColor }]}>Weight</Text>
								<Text style={[styles.infoValue, { color: valueColor }]}>{player.weight || 'N/A'}</Text>
							</View>
						</View>
						<View style={styles.infoItemWithIcon}>
							<Ionicons name="people" size={14} color={CMConstants.color.green} style={styles.infoIcon} />
							<View style={styles.infoItemContent}>
								<Text style={[styles.infoLabel, { color: labelColor }]}>Team</Text>
								<Text style={[styles.infoValue, { color: valueColor }]}>{team.name || 'N/A'}</Text>
							</View>
						</View>
					</View>
					<View style={styles.infoRow}>
						<View style={styles.infoItemFullWidth}>
							<Ionicons name="location-outline" size={14} color={CMConstants.color.green} style={styles.infoIcon} />
							<View style={styles.infoItemContent}>
								<Text style={[styles.infoLabel, { color: labelColor }]}>Address</Text>
								<Text style={[styles.infoValue, { color: valueColor }]}>{playerAddress || 'N/A'}</Text>
							</View>
						</View>
					</View>
				</View>
				{/* Last Three Games Stats */}
				<View style={styles.sectionContainer}>
					<View style={styles.sectionHeader}>
						<Ionicons name="time-outline" size={20} color={CMConstants.color.green} />
						<Text style={[styles.sectionTitle, { color: textColor }]}>Last three games</Text>
					</View>
					{lastThreeGames.length > 0 ? (
						<View>
							{lastThreeGames.map((game: { [name: string]: any }, index: number) => {
								const matchData = game.matchId ? gameMatches[game.matchId] : null;
								const teamA = matchData?.teamA || {};
								const teamB = matchData?.teamB || {};
								const matchName = matchData 
									? `${teamA.name || 'Team A'} vs ${teamB.name || 'Team B'}`
									: `Game ${index + 1}`;
								
								return (
								<View key={game.id || index} style={[styles.gameStatCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
									<View style={styles.gameStatHeader}>
										<View style={styles.gameStatHeaderLeft}>
											<Ionicons name="basketball" size={18} color={CMConstants.color.green} />
											<Text style={[styles.gameStatLabel, { color: textColor }]} numberOfLines={2}>
												{matchName}
											</Text>
										</View>
										{game.dayTime && (
											<View style={styles.gameStatDateContainer}>
												<Ionicons name="calendar-outline" size={14} color={labelColor} />
												<Text style={[styles.gameStatDate, { color: labelColor }]}>
													{CMUtils.strSimpleDate(game.dayTime.toDate())}
												</Text>
											</View>
										)}
									</View>
									<View style={styles.statsGrid}>
										<View style={styles.statItem}>
											<View style={styles.statItemHeader}>
												<View style={[styles.statDot, { backgroundColor: CMConstants.color.green }]} />
												<Text style={styles.statLabel}>P</Text>
											</View>
											<Text style={[styles.statValue, { color: valueColor }]}>
												{game.pointsPerGame || game.points || 0}
											</Text>
										</View>
										<View style={styles.statItem}>
											<View style={styles.statItemHeader}>
												<View style={[styles.statDot, { backgroundColor: statDotColor, opacity: 0.7 }]} />
												<Text style={styles.statLabel}>A</Text>
											</View>
											<Text style={[styles.statValue, { color: valueColor }]}>
												{game.assists || 0}
											</Text>
										</View>
										<View style={styles.statItem}>
											<View style={styles.statItemHeader}>
												<View style={[styles.statDot, { backgroundColor: statDotColor, opacity: 0.7 }]} />
												<Text style={styles.statLabel}>R</Text>
											</View>
											<Text style={[styles.statValue, { color: valueColor }]}>
												{game.rebounds || 0}
											</Text>
										</View>
										<View style={styles.statItem}>
											<View style={styles.statItemHeader}>
												<View style={[styles.statDot, { backgroundColor: statDotColor, opacity: 0.7 }]} />
												<Text style={styles.statLabel}>B</Text>
											</View>
											<Text style={[styles.statValue, { color: valueColor }]}>
												{game.blocks || 0}
											</Text>
										</View>
										<View style={styles.statItem}>
											<View style={styles.statItemHeader}>
												<View style={[styles.statDot, { backgroundColor: statDotColor, opacity: 0.7 }]} />
												<Text style={styles.statLabel}>S</Text>
											</View>
											<Text style={[styles.statValue, { color: valueColor }]}>
												{game.steals || 0}
											</Text>
										</View>
									</View>
								</View>
								);
							})}
						</View>
					) : (
						<View style={[styles.emptyStateCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
							<Ionicons name="stats-chart-outline" size={32} color={emptyStateTextColor} />
							<Text style={[styles.noDataText, { color: emptyStateTextColor }]}>
								No game statistics available.
							</Text>
						</View>
					)}
				</View>

				{/* Season Stats */}
				<View style={styles.sectionContainer}>
					<View style={styles.sectionHeader}>
						<Ionicons name="trophy" size={20} color={CMConstants.color.green} />
						<Text style={[styles.sectionTitle, { color: textColor }]}>Season Stats</Text>
					</View>
					{seasonStats.gamesPlayed > 0 ? (
						<View>
							<View style={[styles.seasonStatsCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
								<View style={styles.statsGrid}>
									<View style={styles.statItem}>
										<View style={styles.statItemHeader}>
											<View style={[styles.statDot, { backgroundColor: CMConstants.color.green }]} />
											<Text style={styles.statLabel}>P</Text>
										</View>
										<Text style={[styles.statValue, { color: valueColor }]}>
											{seasonStats.points || 0}
										</Text>
									</View>
									<View style={styles.statItem}>
										<View style={styles.statItemHeader}>
											<View style={[styles.statDot, { backgroundColor: statDotColor, opacity: 0.7 }]} />
											<Text style={styles.statLabel}>A</Text>
										</View>
										<Text style={[styles.statValue, { color: valueColor }]}>
											{seasonStats.assists || 0}
										</Text>
									</View>
									<View style={styles.statItem}>
										<View style={styles.statItemHeader}>
											<View style={[styles.statDot, { backgroundColor: statDotColor, opacity: 0.7 }]} />
											<Text style={styles.statLabel}>R</Text>
										</View>
										<Text style={[styles.statValue, { color: valueColor }]}>
											{seasonStats.rebounds || 0}
										</Text>
									</View>
									<View style={styles.statItem}>
										<View style={styles.statItemHeader}>
											<View style={[styles.statDot, { backgroundColor: statDotColor, opacity: 0.7 }]} />
											<Text style={styles.statLabel}>B</Text>
										</View>
										<Text style={[styles.statValue, { color: valueColor }]}>
											{seasonStats.blocks || 0}
										</Text>
									</View>
									<View style={styles.statItem}>
										<View style={styles.statItemHeader}>
											<View style={[styles.statDot, { backgroundColor: statDotColor, opacity: 0.7 }]} />
											<Text style={styles.statLabel}>S</Text>
										</View>
										<Text style={[styles.statValue, { color: valueColor }]}>
											{seasonStats.steals || 0}
										</Text>
									</View>
								</View>
							</View>
							<View style={styles.summaryGrid}>
								<View style={[styles.summaryCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
									<Ionicons name="calendar" size={24} color={CMConstants.color.green} />
									<Text style={[styles.summaryValue, { color: CMConstants.color.green }]}>
										{seasonStats.gamesPlayed || 0}
									</Text>
									<Text style={[styles.summaryLabel, { color: labelColor }]}>GAMES</Text>
								</View>
								<View style={[styles.summaryCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
									<Ionicons name="trophy" size={24} color={CMConstants.color.green} />
									<Text style={[styles.summaryValue, { color: CMConstants.color.green }]}>
										{seasonStats.pointsPerGame || '0.0'}
									</Text>
									<Text style={[styles.summaryLabel, { color: labelColor }]}>PPG</Text>
								</View>
								<View style={[styles.summaryCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
									<Ionicons name="hand-left-outline" size={24} color={CMConstants.color.green} />
									<Text style={[styles.summaryValue, { color: CMConstants.color.green }]}>
										{seasonStats.assistsPerGame || '0.0'}
									</Text>
									<Text style={[styles.summaryLabel, { color: labelColor }]}>APG</Text>
								</View>
								<View style={[styles.summaryCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
									<Ionicons name="basketball-outline" size={24} color={CMConstants.color.green} />
									<Text style={[styles.summaryValue, { color: CMConstants.color.green }]}>
										{seasonStats.reboundsPerGame || '0.0'}
									</Text>
									<Text style={[styles.summaryLabel, { color: labelColor }]}>RPG</Text>
								</View>
							</View>
						</View>
					) : (
						<View style={[styles.emptyStateCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
							<Ionicons name="stats-chart-outline" size={32} color={emptyStateTextColor} />
							<Text style={[styles.noDataText, { color: emptyStateTextColor }]}>
								No season statistics available.
							</Text>
						</View>
					)}
				</View>
			</ScrollView>

			<Modal
				visible={claimModalVisible}
				transparent
				animationType="fade"
				onRequestClose={() => setClaimModalVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={[styles.claimModalCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
						<Text style={[styles.claimModalTitle, { color: textColor }]}>Claim Player</Text>
						<Text style={[styles.claimModalSubtitle, { color: labelColor }]}>
							How would you like to claim this player?
						</Text>

						{hasPendingClaimRequest ? (
							<View style={[styles.claimOptionCard, styles.claimOptionRequestedCard, { borderColor: CMConstants.color.green, backgroundColor: 'rgba(0, 217, 118, 0.12)' }]}>
								<View style={styles.claimOptionLeft}>
									<Ionicons name="time-outline" size={22} color={CMConstants.color.green} />
									<Text style={[styles.claimOptionText, { color: CMConstants.color.green }]}>Request Sent</Text>
								</View>
							</View>
						) : (
							<TouchableOpacity activeOpacity={0.85} onPress={onAskToClaim} style={[styles.claimOptionCard, { borderColor: cardBorderColor }]}>
								<View style={styles.claimOptionLeft}>
									<Ionicons name="chatbubble-ellipses-outline" size={22} color={CMConstants.color.green} />
									<Text style={[styles.claimOptionText, { color: textColor }]}>Ask to Claim</Text>
								</View>
								<Ionicons name="chevron-forward-outline" size={18} color={labelColor} />
							</TouchableOpacity>
						)}

						<TouchableOpacity activeOpacity={0.85} onPress={onClaimByCode} style={[styles.claimOptionCard, { borderColor: cardBorderColor }]}>
							<View style={styles.claimOptionLeft}>
								<Ionicons name="key-outline" size={22} color={CMConstants.color.green} />
								<Text style={[styles.claimOptionText, { color: textColor }]}>Claim by Code</Text>
							</View>
							<Ionicons name="chevron-forward-outline" size={18} color={labelColor} />
						</TouchableOpacity>

						<TouchableOpacity activeOpacity={0.85} onPress={() => setClaimModalVisible(false)}>
							<Text style={[styles.claimCancelText, { color: labelColor }]}>Cancel</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			<Modal
				visible={claimCodeModalVisible}
				transparent
				animationType="fade"
				onRequestClose={closeClaimCodeModal}
			>
				<View style={styles.modalOverlay}>
					<View style={[styles.claimModalCard, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
						<Text style={[styles.claimModalTitle, { color: textColor }]}>Claim by Code</Text>
						<Text style={[styles.claimModalSubtitle, { color: labelColor }]}>
							Enter the league code to gain access to this player.
						</Text>

						<View style={[styles.codeInputWrapper, { borderColor: cardBorderColor, backgroundColor: isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white }]}>
							<Ionicons name="key-outline" size={18} color={CMConstants.color.green} style={{ marginRight: 8 }} />
							<TextInput
								value={claimCode}
								onChangeText={setClaimCode}
								placeholder="Enter league code"
								placeholderTextColor={labelColor}
								style={[styles.codeInput, { color: textColor }]}
								autoCapitalize="none"
								autoCorrect={false}
							/>
						</View>

						<TouchableOpacity activeOpacity={0.85} style={styles.submitClaimButton} onPress={onSubmitClaimCode}>
							<Text style={styles.submitClaimButtonText}>Submit Code</Text>
						</TouchableOpacity>

						<TouchableOpacity activeOpacity={0.85} onPress={closeClaimCodeModal}>
							<Text style={[styles.claimCancelText, { color: labelColor }]}>Cancel</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	)
}

const styles = {
	profileHeader: {
		flexDirection: 'row',
		paddingHorizontal: CMConstants.space.normal,
		paddingVertical: CMConstants.space.smallEx,
		paddingTop: CMConstants.space.smallEx,
		alignItems: 'center',
	} as ViewStyle,
	profileImageContainer: {
		borderWidth: 2,
		borderColor: CMConstants.color.green,
		borderRadius: 50,
		padding: 2,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 8,
	},
	playerInfoHeader: {
		flex: 1,
		marginLeft: CMConstants.space.smallEx,
	},
	playerName: {
		fontSize: CMConstants.fontSize.large,
		fontWeight: 'bold',
		color: CMConstants.color.white,
		fontFamily: CMConstants.font.bold,
		marginBottom: CMConstants.space.smallEx - 4,
	},
	positionBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: CMConstants.color.darkGrey2,
		paddingHorizontal: CMConstants.space.smallEx - 2,
		paddingVertical: 2,
		borderRadius: CMConstants.radius.smallEx - 1,
		alignSelf: 'flex-start',
		marginBottom: CMConstants.space.smallEx - 6,
		borderWidth: 1,
		borderColor: CMConstants.color.green,
	},
	positionText: {
		fontSize: CMConstants.fontSize.smallEx - 1,
		color: CMConstants.color.green,
		fontFamily: CMConstants.font.semiBold,
		marginLeft: 3,
	},
	teamBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'flex-start',
	},
	teamText: {
		fontSize: CMConstants.fontSize.smallEx - 1,
		color: CMConstants.color.semiLightGrey,
		fontFamily: CMConstants.font.regular,
		marginLeft: 3,
	},
	quickStatsContainer: {
		flexDirection: 'row',
		paddingHorizontal: CMConstants.space.normal,
		marginTop: CMConstants.space.smallEx - 2,
		gap: CMConstants.space.smallEx - 2,
	} as ViewStyle,
	claimStatusCard: {
		marginTop: CMConstants.space.smallEx,
		marginHorizontal: CMConstants.space.normal,
		borderWidth: 1,
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.small,
	} as ViewStyle,
	claimStatusHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
	} as ViewStyle,
	claimStatusTitle: {
		marginLeft: 6,
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.bold,
	} as TextStyle,
	claimStatusText: {
		fontSize: CMConstants.fontSize.small,
		fontFamily: CMConstants.font.regular,
		lineHeight: 18,
	} as TextStyle,
	quickStatCard: {
		flex: 1,
		backgroundColor: CMConstants.color.darkGrey2,
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.smallEx - 2,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: CMConstants.color.darkGrey3,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 3,
	} as ViewStyle,
	quickStatIconContainer: {
		marginBottom: CMConstants.space.smallEx - 6,
	},
	quickStatValue: {
		fontSize: CMConstants.fontSize.medium,
		fontWeight: 'bold',
		color: CMConstants.color.green,
		fontFamily: CMConstants.font.bold,
		marginBottom: 2,
	},
	quickStatLabel: {
		fontSize: CMConstants.fontSize.smallEx - 1,
		color: CMConstants.color.semiLightGrey,
		fontFamily: CMConstants.font.regular,
		textTransform: 'uppercase',
		letterSpacing: 0.3,
	},
	infoCard: {
		backgroundColor: CMConstants.color.darkGrey2,
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.smallEx,
		marginHorizontal: CMConstants.space.normal,
		marginTop: CMConstants.space.smallEx - 2,
		borderWidth: 1,
		borderColor: CMConstants.color.darkGrey3,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 3,
	} as ViewStyle,
	infoRow: {
		flexDirection: 'row',
		marginBottom: CMConstants.space.smallEx - 4,
		gap: CMConstants.space.smallEx - 2,
	} as ViewStyle,
	infoItemWithIcon: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	} as ViewStyle,
	infoItemFullWidth: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'flex-start',
	} as ViewStyle,
	infoIcon: {
		marginRight: CMConstants.space.smallEx - 2,
	},
	infoItemContent: {
		flex: 1,
	},
	infoLabel: {
		fontSize: CMConstants.fontSize.smallEx - 1,
		color: CMConstants.color.semiLightGrey,
		fontFamily: CMConstants.font.regular,
		marginBottom: 1,
		textTransform: 'uppercase',
		letterSpacing: 0.3,
	} as TextStyle,
	infoValue: {
		fontSize: CMConstants.fontSize.smallEx,
		color: CMConstants.color.white,
		fontFamily: CMConstants.font.semiBold,
	} as TextStyle,
	sectionContainer: {
		marginTop: CMConstants.space.smallEx - 2,
		paddingHorizontal: CMConstants.space.normal,
	} as ViewStyle,
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: CMConstants.space.smallEx - 4,
	},
	sectionTitle: {
		fontSize: CMConstants.fontSize.medium,
		fontWeight: 'bold',
		color: CMConstants.color.white,
		fontFamily: CMConstants.font.bold,
		marginLeft: CMConstants.space.smallEx - 2,
	} as TextStyle,
	gameStatCard: {
		backgroundColor: CMConstants.color.darkGrey2,
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.smallEx - 2,
		marginBottom: CMConstants.space.smallEx - 4,
		borderWidth: 1,
		borderColor: CMConstants.color.darkGrey3,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 3,
	} as ViewStyle,
	gameStatHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: CMConstants.space.smallEx - 6,
	} as ViewStyle,
	gameStatHeaderLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	gameStatLabel: {
		fontSize: CMConstants.fontSize.smallEx,
		fontWeight: '600',
		color: CMConstants.color.white,
		fontFamily: CMConstants.font.semiBold,
		marginLeft: CMConstants.space.smallEx - 2,
		flex: 1,
	} as TextStyle,
	gameStatDateContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	gameStatDate: {
		fontSize: CMConstants.fontSize.smallEx - 1,
		color: CMConstants.color.semiLightGrey,
		fontFamily: CMConstants.font.regular,
		marginLeft: 3,
	} as TextStyle,
	seasonStatsCard: {
		backgroundColor: CMConstants.color.darkGrey2,
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.smallEx - 2,
		marginBottom: CMConstants.space.smallEx - 4,
		borderWidth: 1,
		borderColor: CMConstants.color.darkGrey3,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 3,
	} as ViewStyle,
	statsGrid: {
		flexDirection: 'row',
		justifyContent: 'space-around',
	} as ViewStyle,
	statItem: {
		alignItems: 'center',
		minWidth: 40,
	} as ViewStyle,
	statItemHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 2,
	},
	statDot: {
		width: 3,
		height: 3,
		borderRadius: 1.5,
		marginRight: 3,
	},
	statLabel: {
		fontSize: CMConstants.fontSize.smallEx - 1,
		fontWeight: '700',
		color: CMConstants.color.green,
		fontFamily: CMConstants.font.bold,
	} as TextStyle,
	statValue: {
		fontSize: CMConstants.fontSize.smallEx,
		fontWeight: '600',
		color: CMConstants.color.white,
		fontFamily: CMConstants.font.semiBold,
	} as TextStyle,
	summaryGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		gap: CMConstants.space.smallEx - 2,
	} as ViewStyle,
	summaryCard: {
		backgroundColor: CMConstants.color.darkGrey2,
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.smallEx - 2,
		alignItems: 'center',
		justifyContent: 'center',
		width: '48%',
		marginBottom: CMConstants.space.smallEx - 4,
		minHeight: 70,
		borderWidth: 1,
		borderColor: CMConstants.color.darkGrey3,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 3,
		elevation: 2,
	} as ViewStyle,
		summaryLabel: {
		fontSize: CMConstants.fontSize.smallEx - 1,
		color: CMConstants.color.semiLightGrey,
		fontFamily: CMConstants.font.regular,
		marginTop: CMConstants.space.smallEx / 2 - 2,
		letterSpacing: 0.3,
		textTransform: 'uppercase',
	} as TextStyle,
	summaryValue: {
		fontSize: 16,
		fontWeight: 'bold',
		color: CMConstants.color.green,
		fontFamily: CMConstants.font.bold,
		marginTop: CMConstants.space.smallEx / 2 - 2,
	} as TextStyle,
	emptyStateCard: {
		backgroundColor: CMConstants.color.darkGrey2,
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.normal,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: CMConstants.color.darkGrey3,
	} as ViewStyle,
	noDataText: {
		fontSize: CMConstants.fontSize.smallEx,
		color: CMConstants.color.semiLightGrey,
		marginTop: CMConstants.space.smallEx - 2,
		textAlign: 'center',
		fontFamily: CMConstants.font.regular,
	} as TextStyle,
	claimHeaderButton: {
		...CMCommonStyles.circle(CMConstants.height.iconBig),
		marginRight: CMConstants.space.normal,
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: CMConstants.color.green,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.45)',
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: CMConstants.space.normal,
	} as ViewStyle,
	claimModalCard: {
		width: '100%',
		borderRadius: CMConstants.radius.normal,
		borderWidth: 1,
		padding: CMConstants.space.normal,
	} as ViewStyle,
	claimModalTitle: {
		fontSize: CMConstants.fontSize.large,
		fontFamily: CMConstants.font.bold,
		textAlign: 'center',
		marginBottom: 8,
	} as TextStyle,
	claimModalSubtitle: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.regular,
		textAlign: 'center',
		marginBottom: CMConstants.space.small,
	} as TextStyle,
	claimOptionCard: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderWidth: 1,
		borderRadius: CMConstants.radius.normal,
		paddingHorizontal: CMConstants.space.small,
		paddingVertical: CMConstants.space.smallEx + 2,
		marginBottom: CMConstants.space.smallEx,
	} as ViewStyle,
	claimOptionRequestedCard: {
		justifyContent: 'flex-start',
	} as ViewStyle,
	claimOptionLeft: {
		flexDirection: 'row',
		alignItems: 'center',
	} as ViewStyle,
	claimOptionText: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.semiBold,
		marginLeft: CMConstants.space.smallEx,
	} as TextStyle,
	claimCancelText: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.semiBold,
		textAlign: 'center',
		marginTop: CMConstants.space.smallEx,
	} as TextStyle,
	codeInputWrapper: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: CMConstants.radius.normal,
		paddingHorizontal: CMConstants.space.small,
		paddingVertical: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.small,
	} as ViewStyle,
	codeInput: {
		flex: 1,
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.regular,
		paddingVertical: 0,
	} as TextStyle,
	submitClaimButton: {
		backgroundColor: CMConstants.color.green,
		borderRadius: CMConstants.radius.normal,
		alignItems: 'center',
		paddingVertical: CMConstants.space.smallEx + 2,
	} as ViewStyle,
	submitClaimButtonText: {
		color: CMConstants.color.white,
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.bold,
	} as TextStyle,
};

export default CMPlayerDetailsScreen

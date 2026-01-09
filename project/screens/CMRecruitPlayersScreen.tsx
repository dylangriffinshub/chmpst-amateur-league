import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import firestore, { collection, getDocs, getFirestore, Timestamp } from '@react-native-firebase/firestore'
import DatePicker from 'react-native-neat-date-picker'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMGlobal from '../CMGlobal'
import CMProfileImage from '../components/CMProfileImage'
import CMRipple from '../components/CMRipple'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import { getAuth } from '@react-native-firebase/auth'

type RecruitPlayer = {
  id: string
  name: string
  avatar?: string
  sourcePlayer: { [name: string]: any }
  hasPendingClaimRequest: boolean
  latestClaimStatus?: 'pending' | 'approved' | 'denied' | ''
  latestClaimReason?: string
  heightValue: number | null
  heightLabel: string
  position: string
  city: string
  state: string
  country: string
  teamName: string
  teamId: string
  leagueName: string
  leagueId: string
  leagueAdminId: string
  teamCoachId: string
  leagueInviteId: string
  statsLine1: string
  statsLine2: string
  gamesPlayed: number
  hasPlayedSeasonMatch: boolean
  inviteStatus?: 'pending' | 'accepted' | 'rejected' | ''
  inviteRejectionReason?: string
}

type UserLocation = {
  city: string
  state: string
  country: string
}

const INITIAL_SECTION_COUNT = 4

const normalizeCity = (city?: string) => (city || '').trim().toLowerCase()
const normalizeValue = (value?: string) => (value || '').trim().toLowerCase()

const formatHeight = (heightValue: any) => {
  const numericHeight = Number(heightValue)
  if (!Number.isFinite(numericHeight) || numericHeight <= 0) {
    return { heightValue: null, heightLabel: 'Height N/A' }
  }

  if (numericHeight >= 48 && numericHeight <= 96) {
    const feet = Math.floor(numericHeight / 12)
    const inches = numericHeight % 12
    return {
      heightValue: numericHeight,
      heightLabel: `${feet}'${inches}"`,
    }
  }

  return {
    heightValue: numericHeight,
    heightLabel: `${numericHeight}`,
  }
}

const getHeightBucket = (heightValue: number | null) => {
  if (!heightValue) {
    return 'Unknown'
  }
  if (heightValue < 72) {
    return 'Under 6\''
  }
  if (heightValue <= 75) {
    return `6' - 6'3"`
  }
  return `6'4 & Up`
}

const formatInviteDate = (value?: Date | null) => {
  if (!value) {
    return 'Select date'
  }
  return value.toLocaleDateString()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const logCodeClaimDebug = (stage: string, payload: { [name: string]: any }) => {
  try {
    console.log(`[CodeClaim][RecruitPlayers][${stage}]`, JSON.stringify(payload, null, 2))
  } catch (error) {
    console.log(`[CodeClaim][RecruitPlayers][${stage}]`, payload)
  }
}

const CMRecruitPlayersScreen = ({ navigation }: CMNavigationProps) => {
  const insets = useSafeAreaInsets()
  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.dark)
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [players, setPlayers] = useState<RecruitPlayer[]>([])
  const [selectedPosition, setSelectedPosition] = useState('Any')
  const [selectedLocation, setSelectedLocation] = useState('Any')
  const [selectedHeight, setSelectedHeight] = useState('Any')
  const [invitablePlayersVisibleCount, setInvitablePlayersVisibleCount] = useState(INITIAL_SECTION_COUNT)
  const [requestedPlayersVisibleCount, setRequestedPlayersVisibleCount] = useState(INITIAL_SECTION_COUNT)
  const [deniedPlayersVisibleCount, setDeniedPlayersVisibleCount] = useState(INITIAL_SECTION_COUNT)
  const [topFreeAgentsVisibleCount, setTopFreeAgentsVisibleCount] = useState(INITIAL_SECTION_COUNT)
  const [nearYouVisibleCount, setNearYouVisibleCount] = useState(INITIAL_SECTION_COUNT)
  const [currentUserLocation, setCurrentUserLocation] = useState<UserLocation>({
    city: (CMGlobal.user?.city || '').trim(),
    state: (CMGlobal.user?.state || '').trim(),
    country: (CMGlobal.user?.country || '').trim(),
  })
  const [currentCoachTeamIds, setCurrentCoachTeamIds] = useState<string[]>([])
  const [currentCoachTeams, setCurrentCoachTeams] = useState<{ id: string; name: string }[]>([])
  const [claimModalVisible, setClaimModalVisible] = useState(false)
  const [claimCodeModalVisible, setClaimCodeModalVisible] = useState(false)
  const [claimCode, setClaimCode] = useState('')
  const [selectedClaimPlayer, setSelectedClaimPlayer] = useState<RecruitPlayer | null>(null)
  const [inviteModalVisible, setInviteModalVisible] = useState(false)
  const [selectedInvitePlayer, setSelectedInvitePlayer] = useState<RecruitPlayer | null>(null)
  const [inviteDurationType, setInviteDurationType] = useState<'single_game' | 'date_range' | 'full_season'>('single_game')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteStartDate, setInviteStartDate] = useState<Date | null>(null)
  const [inviteEndDate, setInviteEndDate] = useState<Date | null>(null)
  const [showInviteStartDatePicker, setShowInviteStartDatePicker] = useState(false)
  const [showInviteEndDatePicker, setShowInviteEndDatePicker] = useState(false)
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false)
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false)

  const isDarkMode = themeMode === CMConstants.themeMode.dark
  const currentUserCity = currentUserLocation.city
  const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid

  const refreshCurrentUserLocation = async () => {
    const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid
    if (!currentUserId) {
      setCurrentUserLocation({
        city: (CMGlobal.user?.city || '').trim(),
        state: (CMGlobal.user?.state || '').trim(),
        country: (CMGlobal.user?.country || '').trim(),
      })
      return
    }

    await new Promise<void>((resolve) => {
      CMFirebaseHelper.getUser(currentUserId, (response: { [name: string]: any }) => {
        if (response?.isSuccess && response.value) {
          CMGlobal.user = response.value
          setCurrentUserLocation({
            city: (response.value.city || '').trim(),
            state: (response.value.state || '').trim(),
            country: (response.value.country || '').trim(),
          })
        } else {
          setCurrentUserLocation({
            city: (CMGlobal.user?.city || '').trim(),
            state: (CMGlobal.user?.state || '').trim(),
            country: (CMGlobal.user?.country || '').trim(),
          })
        }
        resolve()
      })
    })
  }

  const refreshCurrentCoachTeams = async (): Promise<string[]> => {
    const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid
    if (!currentUserId) {
      setCurrentCoachTeamIds([])
      return []
    }

    return new Promise<string[]>((resolve) => {
      CMFirebaseHelper.getTeamsByCoach(currentUserId, (response: { [name: string]: any }) => {
        if (response?.isSuccess && Array.isArray(response.value)) {
          const teamIds = response.value
            .map((team: { [name: string]: any }) => team?.id)
            .filter((teamId: string | undefined) => !!teamId)
          setCurrentCoachTeams(
            response.value.map((team: { [name: string]: any }) => ({
              id: team?.id || '',
              name: team?.name || 'Unnamed Team',
            })),
          )
          setCurrentCoachTeamIds(teamIds)
          resolve(teamIds)
        } else {
          const fallbackTeamIds = CMGlobal.user?.teamId ? [CMGlobal.user.teamId] : []
          setCurrentCoachTeams(
            CMGlobal.user?.teamId
              ? [{ id: CMGlobal.user.teamId, name: CMGlobal.user?.teamName || 'My Team' }]
              : [],
          )
          setCurrentCoachTeamIds(fallbackTeamIds)
          resolve(fallbackTeamIds)
        }
      })
    })
  }

  const loadRecruitPlayers = async () => {
    setLoading(true)

    try {
      await refreshCurrentUserLocation()
      const coachTeamIds = await refreshCurrentCoachTeams()
      const db = getFirestore()
      const [playersSnapshot, teamsSnapshot, leaguesSnapshot, playerStatsSnapshot, playerClaimsSnapshot, playerInvitesSnapshot] = await Promise.all([
        getDocs(collection(db, 'players')),
        getDocs(collection(db, 'teams')),
        getDocs(collection(db, 'league')),
        getDocs(collection(db, 'playerStats')),
        getDocs(collection(db, 'playerClaims')),
        getDocs(collection(db, CMConstants.collectionName.playerInvites)),
      ])

      const teamsMap = new Map<string, any>()
      teamsSnapshot.forEach((documentSnapshot: any) => {
        teamsMap.set(documentSnapshot.id, { id: documentSnapshot.id, ...documentSnapshot.data() })
      })

      const teamLeagueMap = new Map<string, any>()
      leaguesSnapshot.forEach((documentSnapshot: any) => {
        const league = { id: documentSnapshot.id, ...documentSnapshot.data() }
        const teamsId = league?.teamsId || []
        teamsId.forEach((teamId: string) => {
          if (teamId) {
            teamLeagueMap.set(teamId, league)
          }
        })
      })

      const playerStatsMap = new Map<string, { gamesPlayed: number; totalPoints: number; totalAssists: number; totalRebounds: number }>()
      playerStatsSnapshot.forEach((documentSnapshot: any) => {
        const stat = documentSnapshot.data()
        const playerId = stat?.playerId
        if (!playerId) {
          return
        }

        const current = playerStatsMap.get(playerId) || {
          gamesPlayed: 0,
          totalPoints: 0,
          totalAssists: 0,
          totalRebounds: 0,
        }

        current.gamesPlayed += 1
        current.totalPoints += Number(stat?.pointsPerGame ?? stat?.points ?? 0)
        current.totalAssists += Number(stat?.assists ?? 0)
        current.totalRebounds += Number(stat?.rebounds ?? 0)
        playerStatsMap.set(playerId, current)
      })

      const pendingClaimPlayerIds = new Set<string>()
      const latestClaimByPlayerId = new Map<string, { status: 'pending' | 'approved' | 'denied' | ''; denialReason?: string; createdAtMs: number }>()
      playerClaimsSnapshot.forEach((documentSnapshot: any) => {
        const claim = documentSnapshot.data()
        if (claim?.playerId && claim?.requesterUserId === currentUserId) {
          const createdAtMs = claim?.createdAt?.toDate?.()?.getTime?.() || 0
          const existingClaim = latestClaimByPlayerId.get(claim.playerId)
          if (!existingClaim || createdAtMs >= existingClaim.createdAtMs) {
            latestClaimByPlayerId.set(claim.playerId, {
              status: `${claim?.status || ''}`.toLowerCase() as 'pending' | 'approved' | 'denied' | '',
              denialReason: claim?.denialReason || '',
              createdAtMs,
            })
          }
        }
        if (
          claim?.playerId &&
          claim?.requesterUserId === currentUserId &&
          `${claim?.status || ''}`.toLowerCase() === 'pending'
        ) {
          pendingClaimPlayerIds.add(claim.playerId)
        }
      })

      const latestInviteByPlayerId = new Map<string, { status: 'pending' | 'accepted' | 'rejected' | ''; rejectionReason?: string; createdAtMs: number }>()
      playerInvitesSnapshot.forEach((documentSnapshot: any) => {
        const invite = documentSnapshot.data()
        if (invite?.playerId && invite?.inviterUserId === currentUserId) {
          const createdAtMs = invite?.createdAt?.toDate?.()?.getTime?.() || 0
          const existingInvite = latestInviteByPlayerId.get(invite.playerId)
          const normalizedInviteStatus =
            `${invite?.status || ''}`.toLowerCase() === 'payment_requested'
              ? 'pending'
              : `${invite?.status || ''}`.toLowerCase()
          if (!existingInvite || createdAtMs >= existingInvite.createdAtMs) {
            latestInviteByPlayerId.set(invite.playerId, {
              status: normalizedInviteStatus as 'pending' | 'accepted' | 'rejected' | '',
              rejectionReason: invite?.rejectionReason || '',
              createdAtMs,
            })
          }
        }
      })

      const nextPlayers: RecruitPlayer[] = []
      playersSnapshot.forEach((documentSnapshot: any) => {
        const player = { id: documentSnapshot.id, ...documentSnapshot.data() }
        if (player?.deleted) {
          return
        }

        if (player.teamId && coachTeamIds.includes(player.teamId)) {
          return
        }

        const team = teamsMap.get(player.teamId)
        const league = teamLeagueMap.get(player.teamId)
        const statSummary = playerStatsMap.get(player.id)
        const { heightValue, heightLabel } = formatHeight(player.height)
        const city = (player.city || team?.city || league?.city || '').trim()
        const state = (player.state || team?.state || league?.state || '').trim()
        const country = (player.country || team?.country || league?.country || '').trim()
        const gamesPlayed = statSummary?.gamesPlayed || 0
        const ppg = gamesPlayed > 0 ? (statSummary!.totalPoints / gamesPlayed).toFixed(1) : '0.0'
        const apg = gamesPlayed > 0 ? (statSummary!.totalAssists / gamesPlayed).toFixed(1) : '0.0'
        const rpg = gamesPlayed > 0 ? (statSummary!.totalRebounds / gamesPlayed).toFixed(1) : '0.0'
        const latestClaim = latestClaimByPlayerId.get(player.id)
        const latestInvite = latestInviteByPlayerId.get(player.id)

        nextPlayers.push({
          id: player.id,
          name: player.name || 'Unnamed Player',
          avatar: player.avatar,
          sourcePlayer: player,
          hasPendingClaimRequest: pendingClaimPlayerIds.has(player.id),
          latestClaimStatus: latestClaim?.status || '',
          latestClaimReason: latestClaim?.denialReason || '',
          heightValue,
          heightLabel,
          position: player.position || 'Position N/A',
          city: city || 'Unknown City',
          state,
          country,
          teamName: team?.name || 'Unassigned Team',
          teamId: player.teamId || '',
          leagueName: league?.name || 'Unassigned League',
          leagueId: league?.id || '',
          leagueAdminId: league?.adminId || '',
          teamCoachId: team?.coachId || '',
          leagueInviteId: league?.inviteId || '',
          statsLine1: `${ppg} PPG | ${apg} APG`,
          statsLine2: `${rpg} RPG | ${gamesPlayed} GP`,
          gamesPlayed,
          hasPlayedSeasonMatch: gamesPlayed > 0,
          inviteStatus: latestInvite?.status || '',
          inviteRejectionReason: latestInvite?.rejectionReason || '',
        })
      })

      nextPlayers.sort((a, b) => {
        const cityCompare = a.city.localeCompare(b.city)
        if (cityCompare !== 0) {
          return cityCompare
        }
        return a.name.localeCompare(b.name)
      })

      setPlayers(nextPlayers)
      setInvitablePlayersVisibleCount(INITIAL_SECTION_COUNT)
      setRequestedPlayersVisibleCount(INITIAL_SECTION_COUNT)
      setDeniedPlayersVisibleCount(INITIAL_SECTION_COUNT)
      setTopFreeAgentsVisibleCount(INITIAL_SECTION_COUNT)
      setNearYouVisibleCount(INITIAL_SECTION_COUNT)
    } catch (error) {
      console.log('Failed to load recruit players:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to load registered players.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.dark)
      loadRecruitPlayers()
    })

    return unsubscribe
  }, [navigation])

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white,
      },
      headerTintColor: isDarkMode ? CMConstants.color.white : CMConstants.color.black,
      headerTitleStyle: {
        color: isDarkMode ? CMConstants.color.white : CMConstants.color.black,
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold',
      },
    })
  }, [isDarkMode, navigation])

  useEffect(() => {
    loadRecruitPlayers()
  }, [])

  const colors = useMemo(
    () => ({
      background: isDarkMode ? '#121116' : CMConstants.color.white,
      surface: isDarkMode ? '#19171F' : '#FAFAFA',
      border: isDarkMode ? '#2C2734' : CMConstants.color.lightGrey,
      text: isDarkMode ? CMConstants.color.white : CMConstants.color.black,
      muted: isDarkMode ? '#B8B1C5' : CMConstants.color.grey,
      accent: CMConstants.color.greenDark,
      accentSoft: 'rgba(0, 217, 118, 0.16)',
      overlay: 'rgba(0,0,0,0.55)',
    }),
    [isDarkMode]
  )

  const filteredPlayers = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    const normalizedUserCity = normalizeCity(currentUserCity)
    const normalizedUserState = normalizeValue(currentUserLocation.state)
    const normalizedUserCountry = normalizeValue(currentUserLocation.country)

    return players.filter((player) => {
      const matchesSearch =
        !query ||
        player.name.toLowerCase().includes(query) ||
        player.city.toLowerCase().includes(query) ||
        player.position.toLowerCase().includes(query) ||
        player.teamName.toLowerCase().includes(query) ||
        player.leagueName.toLowerCase().includes(query)

      const matchesPosition =
        selectedPosition === 'Any' ||
        player.position.toUpperCase().includes(selectedPosition)

      const matchesLocation =
        selectedLocation === 'Any' ||
        !normalizedUserCity ||
        (
          normalizeCity(player.city) === normalizedUserCity &&
          (!normalizedUserState || normalizeValue(player.state) === normalizedUserState) &&
          (!normalizedUserCountry || normalizeValue(player.country) === normalizedUserCountry)
        )

      const matchesHeight =
        selectedHeight === 'Any' ||
        getHeightBucket(player.heightValue) === selectedHeight

      return matchesSearch && matchesPosition && matchesLocation && matchesHeight
    })
  }, [players, searchText, selectedPosition, selectedLocation, selectedHeight, currentUserCity, currentUserLocation.state, currentUserLocation.country])

  const invitablePlayers = useMemo(
    () => filteredPlayers.filter((player) => !!player.sourcePlayer?.claimedByUserId),
    [filteredPlayers]
  )

  const requestedPlayers = useMemo(
    () => filteredPlayers.filter((player) => player.hasPendingClaimRequest),
    [filteredPlayers]
  )

  const deniedPlayers = useMemo(
    () => filteredPlayers.filter((player) => !player.hasPendingClaimRequest && !player.sourcePlayer?.claimedByUserId && player.latestClaimStatus === 'denied'),
    [filteredPlayers]
  )

  const topFreeAgents = useMemo(
    () => filteredPlayers.filter((player) => !player.sourcePlayer?.claimedByUserId && !player.hasPendingClaimRequest && player.latestClaimStatus !== 'denied' && !player.hasPlayedSeasonMatch),
    [filteredPlayers]
  )

  const nearYouPlayers = useMemo(() => {
    const normalizedUserCity = normalizeCity(currentUserCity)
    const normalizedUserState = normalizeValue(currentUserLocation.state)
    const normalizedUserCountry = normalizeValue(currentUserLocation.country)
    const sortedPlayers = filteredPlayers
      .filter((player) => !player.sourcePlayer?.claimedByUserId && !player.hasPendingClaimRequest && player.latestClaimStatus !== 'denied')
      .sort((a, b) => {
      const getLocationScore = (player: RecruitPlayer) => {
        let score = 0
        if (normalizedUserCountry && normalizeValue(player.country) === normalizedUserCountry) {
          score += 1
        }
        if (normalizedUserState && normalizeValue(player.state) === normalizedUserState) {
          score += 2
        }
        if (normalizedUserCity && normalizeCity(player.city) === normalizedUserCity) {
          score += 4
        }
        return score
      }

      const scoreDifference = getLocationScore(b) - getLocationScore(a)
      if (scoreDifference !== 0) {
        return scoreDifference
      }

      const cityCompare = a.city.localeCompare(b.city)
      if (cityCompare !== 0) {
        return cityCompare
      }

      return a.name.localeCompare(b.name)
    })

    return sortedPlayers
  }, [filteredPlayers, currentUserCity, currentUserLocation.state, currentUserLocation.country])

  const activeChips = useMemo(() => {
    const chips: string[] = []
    if (selectedLocation === 'Near Me') {
      chips.push(currentUserCity ? `Near ${currentUserCity}` : 'Near Me')
    }
    if (selectedPosition !== 'Any') {
      chips.push(selectedPosition)
    }
    if (selectedHeight !== 'Any') {
      chips.push(selectedHeight)
    }
    return chips
  }, [selectedHeight, selectedLocation, selectedPosition, currentUserCity])

  const renderChip = (
    label: string,
    active: boolean,
    onPress: () => void,
    compact = false
  ) => (
    <TouchableOpacity
      key={label}
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        paddingHorizontal: compact ? 12 : 16,
        paddingVertical: compact ? 6 : 10,
        borderRadius: compact ? 12 : 14,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentSoft : colors.surface,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          color: active ? CMConstants.color.green : colors.muted,
          fontSize: compact ? CMConstants.fontSize.smallEx : CMConstants.fontSize.small,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )

  const updateClaimedPlayerLocally = (playerId: string) => {
    setPlayers((previousPlayers) =>
      previousPlayers.map((item) =>
        item.id === playerId
          ? {
              ...item,
              hasPendingClaimRequest: false,
              latestClaimStatus: 'approved',
              latestClaimReason: '',
              sourcePlayer: {
                ...item.sourcePlayer,
                claimedByUserId: currentUserId,
                claimedByUserName: CMGlobal.user?.name || getAuth().currentUser?.displayName || 'Unknown User',
              },
            }
          : item,
      ),
    )
  }

  const updatePendingClaimLocally = (playerId: string) => {
    setPlayers((previousPlayers) =>
      previousPlayers.map((item) =>
        item.id === playerId
          ? {
              ...item,
              hasPendingClaimRequest: true,
              latestClaimStatus: 'pending',
              latestClaimReason: '',
            }
          : item,
      ),
    )
    setSelectedClaimPlayer((previousPlayer) =>
      previousPlayer && previousPlayer.id === playerId
        ? {
            ...previousPlayer,
            hasPendingClaimRequest: true,
            latestClaimStatus: 'pending',
            latestClaimReason: '',
          }
        : previousPlayer,
    )
  }

  const onOpenClaim = (player: RecruitPlayer) => {
    setSelectedClaimPlayer(player)
    setClaimCode('')
    setClaimModalVisible(true)
  }

  const closeInviteModal = () => {
    setInviteModalVisible(false)
    setSelectedInvitePlayer(null)
    setInviteDurationType('single_game')
    setInviteMessage('')
    setInviteStartDate(null)
    setInviteEndDate(null)
  }

  const reopenInviteModalAfterPicker = () => {
    setTimeout(() => {
      setInviteModalVisible(true)
    }, 150)
  }

  const openInviteStartDatePicker = () => {
    setInviteModalVisible(false)
    setTimeout(() => {
      setShowInviteStartDatePicker(true)
    }, 150)
  }

  const openInviteEndDatePicker = () => {
    setInviteModalVisible(false)
    setTimeout(() => {
      setShowInviteEndDatePicker(true)
    }, 150)
  }

  const openInviteModal = (player: RecruitPlayer) => {
    setSelectedInvitePlayer(player)
    setInviteDurationType('single_game')
    setInviteMessage('')
    setInviteStartDate(null)
    setInviteEndDate(null)
    setInviteModalVisible(true)
  }

  const closeClaimCodeModal = () => {
    Keyboard.dismiss()
    setClaimCodeModalVisible(false)
    setClaimCode('')
  }

  const validateClaimCodeWithFirebase = async (enteredCode: string, player: RecruitPlayer) => {
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
          const sameLeague = !!player.leagueId && item?.id === player.leagueId
          const containsTeam = Array.isArray(item?.teamsId) && !!player.teamId && item.teamsId.includes(player.teamId)
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

  const onAskToClaim = async () => {
    if (!selectedClaimPlayer) {
      return
    }

    if (!currentUserId) {
      CMAlertDlgHelper.showAlertWithOK('Please sign in to claim this player.')
      return
    }

    if (selectedClaimPlayer.sourcePlayer?.claimedByUserId === currentUserId) {
      CMAlertDlgHelper.showAlertWithOK('You already claimed this player.')
      return
    }

    if (selectedClaimPlayer.hasPendingClaimRequest) {
      CMAlertDlgHelper.showAlertWithOK('Claim request already sent. Please wait for commissioner review.')
      return
    }

    const reviewOwnerId = selectedClaimPlayer.teamCoachId || selectedClaimPlayer.leagueAdminId
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
          playerId: selectedClaimPlayer.id,
          playerName: selectedClaimPlayer.name || '',
          playerAvatar: selectedClaimPlayer.avatar || '',
          requesterUserId: currentUserId,
          requesterName: CMGlobal.user?.name || getAuth().currentUser?.displayName || 'Unknown User',
          requesterEmail: CMGlobal.user?.email || getAuth().currentUser?.email || '',
          reviewOwnerId,
          commissionerId: selectedClaimPlayer.leagueAdminId || reviewOwnerId,
          teamCoachId: selectedClaimPlayer.teamCoachId || '',
          leagueId: selectedClaimPlayer.leagueId || '',
          leagueName: selectedClaimPlayer.leagueName || '',
          teamId: selectedClaimPlayer.teamId || '',
          teamName: selectedClaimPlayer.teamName || '',
          status: 'pending',
          claimMethod: 'commissioner_request',
          createdAt: Timestamp.now(),
        })

      setClaimModalVisible(false)
      updatePendingClaimLocally(selectedClaimPlayer.id)
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

  const finalizeCodeClaim = async (player: RecruitPlayer, resolvedLeague?: { [name: string]: any }) => {
    const now = Timestamp.now()
    logCodeClaimDebug('finalize:start', {
      playerId: player?.id || '',
      playerName: player?.name || '',
      requesterUserId: currentUserId || '',
      teamId: player?.teamId || '',
      teamName: player?.teamName || '',
      teamCoachId: player?.teamCoachId || '',
      leagueId: resolvedLeague?.id || player?.leagueId || '',
      leagueName: resolvedLeague?.name || player?.leagueName || '',
      leagueAdminId: player?.leagueAdminId || '',
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
        reviewOwnerId: player.teamCoachId || player.leagueAdminId || '',
        commissionerId: player.leagueAdminId || player.teamCoachId || '',
        teamCoachId: player.teamCoachId || '',
        leagueId: resolvedLeague?.id || player.leagueId || '',
        leagueName: resolvedLeague?.name || player.leagueName || '',
        teamId: player.teamId || '',
        teamName: player.teamName || '',
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
      const inviterTeam = currentCoachTeams[0]
      const inviteRef = firestore().collection(CMConstants.collectionName.playerInvites).doc(inviteId)
      batch.set(inviteRef, {
        id: inviteId,
        playerId: player.id,
        playerName: player.name || '',
        playerAvatar: player.avatar || '',
        inviterUserId: currentUserId,
        inviterName: CMGlobal.user?.name || getAuth().currentUser?.displayName || 'Unknown User',
        inviterEmail: CMGlobal.user?.email || getAuth().currentUser?.email || '',
        inviterTeamId: inviterTeam?.id || '',
        inviterTeamName: inviterTeam?.name || '',
        claimedUserId: currentUserId || '',
        playerOwnerCoachId: player.teamCoachId || '',
        playerOwnerCoachName: player.teamName || '',
        teamId: player.teamId || '',
        teamName: player.teamName || '',
        leagueId: resolvedLeague?.id || player.leagueId || '',
        leagueName: resolvedLeague?.name || player.leagueName || '',
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

  const onSubmitClaimCode = async () => {
    if (!selectedClaimPlayer) {
      return
    }

    if (!currentUserId) {
      Alert.alert(CMConstants.appName, 'Please sign in to claim this player.')
      return
    }

    if (selectedClaimPlayer.sourcePlayer?.claimedByUserId && selectedClaimPlayer.sourcePlayer.claimedByUserId !== currentUserId) {
      Alert.alert(CMConstants.appName, 'This player has already been claimed by another user.')
      return
    }

    if (claimCode.trim().length === 0) {
      Alert.alert(CMConstants.appName, 'Please enter a league code.')
      return
    }

    Keyboard.dismiss()
    setIsClaimSubmitting(true)
    const codeValidationResult = await validateClaimCodeWithFirebase(claimCode, selectedClaimPlayer)
    logCodeClaimDebug('validate:result', {
      playerId: selectedClaimPlayer?.id || '',
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

    const claimedPlayer = {
      ...selectedClaimPlayer,
      leagueId: codeValidationResult.league?.id || selectedClaimPlayer.leagueId,
      leagueName: codeValidationResult.league?.name || selectedClaimPlayer.leagueName,
      leagueInviteId: codeValidationResult.league?.inviteId || selectedClaimPlayer.leagueInviteId,
      sourcePlayer: {
        ...selectedClaimPlayer.sourcePlayer,
        claimedByUserId: currentUserId,
      },
    }

    runWithRetry(() => finalizeCodeClaim(claimedPlayer, codeValidationResult.league))
      .then(({ inviteCreated }) => {
        updateClaimedPlayerLocally(selectedClaimPlayer.id)
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
          playerId: claimedPlayer?.id || '',
          requesterUserId: currentUserId || '',
          errorMessage: error?.message || String(error),
          errorCode: error?.code || '',
          errorStack: error?.stack || '',
          teamId: claimedPlayer?.teamId || '',
          leagueId: codeValidationResult.league?.id || claimedPlayer?.leagueId || '',
        })
        setIsClaimSubmitting(false)
        CMAlertDlgHelper.showAlertWithOK('Failed to complete the code claim. Please try again.')
      })
  }

  const onInvitePlayer = async (player: RecruitPlayer) => {
    if (!currentUserId) {
      CMAlertDlgHelper.showAlertWithOK('Please sign in to invite this player.')
      return
    }

    if (!inviteStartDate) {
      CMAlertDlgHelper.showAlertWithOK('Please select the invite start date.')
      return
    }

    const resolvedEndDate = inviteDurationType === 'single_game' ? (inviteEndDate || inviteStartDate) : inviteEndDate
    if (!resolvedEndDate) {
      CMAlertDlgHelper.showAlertWithOK('Please select the invite end date.')
      return
    }

    if (resolvedEndDate.getTime() < inviteStartDate.getTime()) {
      CMAlertDlgHelper.showAlertWithOK('End date must be after the start date.')
      return
    }

    try {
      setIsInviteSubmitting(true)
      const inviteCreated = await createInviteRecord(player)

      if (!inviteCreated) {
        CMAlertDlgHelper.showAlertWithOK(`You already invited ${player.name}.`)
        return
      }

      setPlayers((previousPlayers) =>
        previousPlayers.map((item) =>
          item.id === player.id
            ? {
                ...item,
                inviteStatus: 'pending',
                inviteRejectionReason: '',
              }
            : item,
        ),
      )
      closeInviteModal()
      CMAlertDlgHelper.showAlertWithOK(`Recruiting request sent to ${player.name}.`)
    } catch (error) {
      console.log('Failed to send recruiting invite:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to send recruiting request.')
    } finally {
      setIsInviteSubmitting(false)
    }
  }

  const createInviteRecord = async (player: RecruitPlayer) => {
    const existingInviteSnapshot = await firestore()
      .collection(CMConstants.collectionName.playerInvites)
      .where('inviterUserId', '==', currentUserId)
      .where('playerId', '==', player.id)
      .get()

    const hasActiveInvite = existingInviteSnapshot.docs.some((documentSnapshot) => {
      const status = `${documentSnapshot.data()?.status || ''}`.toLowerCase()
      return status === 'pending' || status === 'payment_requested' || status === 'accepted' || status === 'sent'
    })

    if (hasActiveInvite) {
      return false
    }

    const inviteId = CMFirebaseHelper.getNewDocumentId(CMConstants.collectionName.playerInvites)
    const inviterTeam = currentCoachTeams[0]
    const resolvedDurationType = inviteStartDate ? inviteDurationType : 'claimed_by_code'
    const resolvedStartDate = inviteStartDate || null
    const resolvedEndDate = inviteStartDate ? (inviteDurationType === 'single_game' ? (inviteEndDate || inviteStartDate) : inviteEndDate) : null
    const resolvedDurationLabel = resolvedStartDate && resolvedEndDate
      ? `${formatInviteDate(resolvedStartDate)} - ${formatInviteDate(resolvedEndDate)}`
      : 'Claimed by code'
    await firestore()
      .collection(CMConstants.collectionName.playerInvites)
      .doc(inviteId)
      .set({
        id: inviteId,
        playerId: player.id,
        playerName: player.name || '',
        playerAvatar: player.avatar || '',
        inviterUserId: currentUserId,
        inviterName: CMGlobal.user?.name || getAuth().currentUser?.displayName || 'Unknown User',
        inviterEmail: CMGlobal.user?.email || getAuth().currentUser?.email || '',
        inviterTeamId: inviterTeam?.id || '',
        inviterTeamName: inviterTeam?.name || '',
        claimedUserId: player.sourcePlayer?.claimedByUserId || currentUserId || '',
        playerOwnerCoachId: player.teamCoachId || '',
        playerOwnerCoachName: player.teamName || '',
        teamId: player.teamId || '',
        teamName: player.teamName || '',
        leagueId: player.leagueId || '',
        leagueName: player.leagueName || '',
        durationType: resolvedDurationType,
        durationLabel: resolvedDurationLabel,
        startDate: resolvedStartDate ? Timestamp.fromDate(resolvedStartDate) : null,
        endDate: resolvedEndDate ? Timestamp.fromDate(resolvedEndDate) : null,
        requesterMessage: inviteMessage.trim(),
        status: 'pending',
        rejectionReason: '',
        createdAt: Timestamp.now(),
      })

    return true
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

  const renderPlayerCard = (player: RecruitPlayer) => (
    <TouchableOpacity
      key={player.id}
      activeOpacity={0.9}
      onPress={() => navigation.navigate(CMConstants.screenName.playerDetails, { player: player.sourcePlayer })}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <CMProfileImage radius={38} imgURL={player.avatar} isUser />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontSize: CMConstants.fontSize.normal, fontWeight: '700' }}>
            {player.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: CMConstants.fontSize.small }}>
            {player.heightLabel} | {player.position} | {player.city}
          </Text>
          <Text style={{ color: colors.muted, fontSize: CMConstants.fontSize.smallEx, marginTop: 6 }}>
            {player.teamName} | {player.leagueName}
          </Text>
          {!player.hasPlayedSeasonMatch && (
            <Text style={{ color: CMConstants.color.green, fontSize: CMConstants.fontSize.smallEx, marginTop: 6 }}>
              No season matches played yet
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 12, maxWidth: 110 }}>
          <Text style={{ color: colors.text, fontSize: CMConstants.fontSize.small, fontWeight: '700', textAlign: 'right' }}>
            {player.statsLine1}
          </Text>
          <Text style={{ color: colors.muted, fontSize: CMConstants.fontSize.small, marginTop: 2, textAlign: 'right' }}>
            {player.statsLine2}
          </Text>
          {player.sourcePlayer?.claimedByUserId ? (
            player.inviteStatus === 'pending' || player.inviteStatus === 'accepted' ? (
              <View
                style={{
                  marginTop: 10,
                  backgroundColor: colors.accentSoft,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: colors.accent,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: CMConstants.color.green,
                    fontWeight: '700',
                    fontSize: CMConstants.fontSize.small,
                  }}
                >
                  {player.inviteStatus === 'accepted'
                      ? 'Accepted'
                      : 'Pending'}
                </Text>
              </View>
            ) : (
              <CMRipple
                containerStyle={{
                  marginTop: 10,
                  backgroundColor: colors.accent,
                  borderRadius: 10,
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                }}
                onPress={() => openInviteModal(player)}
              >
                <Text style={{ color: CMConstants.color.white, fontWeight: '700', fontSize: CMConstants.fontSize.small }}>
                  Invite
                </Text>
              </CMRipple>
            )
          ) : player.hasPendingClaimRequest ? (
            <View
              style={{
                marginTop: 10,
                backgroundColor: colors.accentSoft,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: colors.accent,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name="time-outline" size={14} color={CMConstants.color.green} style={{ marginRight: 6 }} />
              <Text style={{ color: CMConstants.color.green, fontWeight: '700', fontSize: CMConstants.fontSize.small }}>
                Requested
              </Text>
            </View>
          ) : (
            <CMRipple
              containerStyle={{
                marginTop: 10,
                backgroundColor: colors.surface,
                borderRadius: 10,
                paddingHorizontal: 18,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: CMConstants.color.green,
              }}
              onPress={() => onOpenClaim(player)}
            >
              <Text style={{ color: CMConstants.color.green, fontWeight: '700', fontSize: CMConstants.fontSize.small }}>
                Claim
              </Text>
            </CMRipple>
          )}
          {player.latestClaimStatus === 'denied' && (
            <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
              <Text style={{ color: '#E57F7F', fontSize: CMConstants.fontSize.smallEx, fontWeight: '700', textAlign: 'right' }}>
                Claim denied
              </Text>
              {!!player.latestClaimReason && (
                <Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={{ color: colors.muted, fontSize: CMConstants.fontSize.smallEx, textAlign: 'right', marginTop: 2, maxWidth: 120 }}
                >
                  {player.latestClaimReason}
                </Text>
              )}
            </View>
          )}
          {player.inviteStatus === 'rejected' && !!player.inviteRejectionReason && (
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={{ color: colors.muted, fontSize: CMConstants.fontSize.smallEx, textAlign: 'right', marginTop: 6, maxWidth: 120 }}
            >
              {player.inviteRejectionReason}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderSection = (
    title: string,
    playersInSection: RecruitPlayer[],
    visibleCount: number,
    onShowMore: () => void,
    onShowAll: () => void
  ) => {
    const visiblePlayers = playersInSection.slice(0, visibleCount)
    const canShowMore = visibleCount < playersInSection.length

    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          {playersInSection.length > 0 && (
            <Text style={{ color: colors.muted, fontSize: CMConstants.fontSize.small }}>
              {playersInSection.length} players
            </Text>
          )}
        </View>

        {visiblePlayers.map(renderPlayerCard)}

        {playersInSection.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>No players available in this section.</Text>
          </View>
        )}

        {canShowMore && (
          <View style={styles.sectionActions}>
            <TouchableOpacity activeOpacity={0.85} onPress={onShowMore}>
              <Text style={{ color: CMConstants.color.green, fontWeight: '700' }}>Show More</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={onShowAll}>
              <Text style={{ color: CMConstants.color.green, fontWeight: '700' }}>Show All</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    )
  }

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: colors.background }]}>
      <CMLoadingDialog visible={loading || isClaimSubmitting || isInviteSubmitting} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: Math.max(insets.bottom + 28, 40),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <Text style={[styles.title, { color: colors.text }]}>Player Recruitment</Text>
          <Text style={[styles.subtitle, { color: CMConstants.color.green }]}>FIND PLAYERS FOR YOUR TEAM</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 14,
              height: 50,
            }}
          >
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search for players..."
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                marginLeft: 10,
                color: colors.text,
                fontSize: CMConstants.fontSize.normal,
              }}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowFilterModal(true)}
            style={{
              marginLeft: 10,
              height: 50,
              paddingHorizontal: 18,
              borderRadius: 14,
              backgroundColor: colors.accent,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: CMConstants.color.white, fontWeight: '700', fontSize: CMConstants.fontSize.normal }}>
              Filter
            </Text>
            <Ionicons name="chevron-forward" size={18} color={CMConstants.color.white} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 10 }}
        >
          {activeChips.map((item) => renderChip(item, true, () => {}, true))}
          {activeChips.length === 0 && (
            <Text style={{ color: colors.muted, fontSize: CMConstants.fontSize.small, paddingVertical: 8 }}>
              Showing all registered players
            </Text>
          )}
        </ScrollView>

        {!currentUserCity && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="location-outline" size={18} color={CMConstants.color.green} />
            <Text style={{ color: colors.muted, flex: 1, marginLeft: 10 }}>
              Add your city in profile to center "Players Near You" around your location. For now, players are sorted by city.
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={CMConstants.color.green} />
          </View>
        ) : (
          <>
            {invitablePlayers.length > 0 && renderSection(
              'Ready to Invite',
              invitablePlayers,
              invitablePlayersVisibleCount,
              () => setInvitablePlayersVisibleCount((prev) => prev + INITIAL_SECTION_COUNT),
              () => setInvitablePlayersVisibleCount(invitablePlayers.length)
            )}

            {requestedPlayers.length > 0 && renderSection(
              'Requested Claims',
              requestedPlayers,
              requestedPlayersVisibleCount,
              () => setRequestedPlayersVisibleCount((prev) => prev + INITIAL_SECTION_COUNT),
              () => setRequestedPlayersVisibleCount(requestedPlayers.length)
            )}

            {deniedPlayers.length > 0 && renderSection(
              'Denied Claims',
              deniedPlayers,
              deniedPlayersVisibleCount,
              () => setDeniedPlayersVisibleCount((prev) => prev + INITIAL_SECTION_COUNT),
              () => setDeniedPlayersVisibleCount(deniedPlayers.length)
            )}

            {renderSection(
              'Top Free Agents',
              topFreeAgents,
              topFreeAgentsVisibleCount,
              () => setTopFreeAgentsVisibleCount((prev) => prev + INITIAL_SECTION_COUNT),
              () => setTopFreeAgentsVisibleCount(topFreeAgents.length)
            )}

            {renderSection(
              'Players Near You',
              nearYouPlayers,
              nearYouVisibleCount,
              () => setNearYouVisibleCount((prev) => prev + INITIAL_SECTION_COUNT),
              () => setNearYouVisibleCount(nearYouPlayers.length)
            )}
          </>
        )}

        {!loading && filteredPlayers.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={28} color={colors.muted} />
            <Text style={{ color: colors.text, marginTop: 12, fontSize: CMConstants.fontSize.normal, fontWeight: '700' }}>
              No players match this filter
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'center' }}>
              Try clearing filters or searching with a broader term.
            </Text>
          </View>
        )}

        <CMRipple
          containerStyle={{
            marginTop: 18,
            backgroundColor: colors.accent,
            borderRadius: 14,
            alignItems: 'center',
            paddingVertical: 14,
          }}
          onPress={() => CMAlertDlgHelper.showAlertWithOK('Recruiting request form is not connected yet.')}
        >
          <Text style={{ color: CMConstants.color.white, fontSize: CMConstants.fontSize.normal, fontWeight: '700' }}>
            Post a New Recruiting Request
          </Text>
        </CMRipple>
      </ScrollView>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View
            style={{
              width: '90%',
              maxHeight: '84%',
              backgroundColor: colors.background,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 20,
            }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close-outline" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontSize: CMConstants.fontSize.large, fontWeight: '700' }}>
                Set Filters
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedPosition('Any')
                  setSelectedLocation('Any')
                  setSelectedHeight('Any')
                }}
              >
                <Text style={{ color: CMConstants.color.green, fontSize: CMConstants.fontSize.normal, fontWeight: '700' }}>
                  Reset
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterTitle, { color: colors.text }]}>Position</Text>
              <View style={styles.filterWrap}>
                {['Any', 'PG', 'SG', 'SF', 'PF', 'C'].map((item) =>
                  renderChip(item, selectedPosition === item, () => setSelectedPosition(item))
                )}
              </View>

              <Text style={[styles.filterTitle, { color: colors.text }]}>Location</Text>
              <View style={styles.filterWrap}>
                {['Near Me', 'Any'].map((item) =>
                  renderChip(item, selectedLocation === item, () => setSelectedLocation(item))
                )}
              </View>

              <Text style={[styles.filterTitle, { color: colors.text }]}>Height</Text>
              <View style={styles.filterWrap}>
                {['Any', 'Under 6\'', `6' - 6'3"`, `6'4 & Up`].map((item) =>
                  renderChip(item, selectedHeight === item, () => setSelectedHeight(item))
                )}
              </View>
            </ScrollView>

            <CMRipple
              containerStyle={{
                marginTop: 16,
                backgroundColor: colors.accent,
                borderRadius: 14,
                alignItems: 'center',
                paddingVertical: 14,
              }}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={{ color: CMConstants.color.white, fontSize: CMConstants.fontSize.normal, fontWeight: '700' }}>
                Apply Filters
              </Text>
            </CMRipple>
          </View>
        </View>
      </Modal>

      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeInviteModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.claimModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.claimModalTitle, { color: colors.text }]}>Send Invite</Text>
            <Text style={[styles.claimModalSubtitle, { color: colors.muted }]}>
              Tell the owning coach how long you want to use this player.
            </Text>

            <View style={{ marginBottom: 10 }}>
              {[
                { key: 'single_game', label: 'Single Game' },
                { key: 'date_range', label: 'Date Range' },
                { key: 'full_season', label: 'Full Season' },
              ].map((option) => {
                const isActive = inviteDurationType === option.key
                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.85}
                    onPress={() => setInviteDurationType(option.key as 'single_game' | 'date_range' | 'full_season')}
                    style={{
                      borderWidth: 1,
                      borderColor: isActive ? colors.accent : colors.border,
                      backgroundColor: isActive ? colors.accentSoft : colors.background,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: isActive ? CMConstants.color.green : colors.text, fontWeight: '700' }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openInviteStartDatePicker}
              style={[styles.codeInputWrapper, { borderColor: colors.border, backgroundColor: isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white }]}
            >
              <Ionicons name="calendar-outline" size={18} color={CMConstants.color.green} style={{ marginRight: 8 }} />
              <Text style={[styles.codeInput, { color: inviteStartDate ? colors.text : colors.muted }]}>
                {inviteStartDate ? formatInviteDate(inviteStartDate) : 'Select start date'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openInviteEndDatePicker}
              style={[styles.codeInputWrapper, { borderColor: colors.border, backgroundColor: isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white, marginTop: 12 }]}
            >
              <Ionicons name="calendar-clear-outline" size={18} color={CMConstants.color.green} style={{ marginRight: 8 }} />
              <Text style={[styles.codeInput, { color: inviteEndDate ? colors.text : colors.muted }]}>
                {inviteEndDate ? formatInviteDate(inviteEndDate) : inviteDurationType === 'single_game' ? 'Select end date or use same day' : 'Select end date'}
              </Text>
            </TouchableOpacity>

            <TextInput
              value={inviteMessage}
              onChangeText={setInviteMessage}
              placeholder="Message to the owning coach (optional)"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                minHeight: 92,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                marginTop: 12,
                color: colors.text,
                backgroundColor: colors.background,
                textAlignVertical: 'top',
              }}
            />

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.submitClaimButton}
              onPress={() => {
                if (selectedInvitePlayer) {
                  onInvitePlayer(selectedInvitePlayer)
                }
              }}
            >
              <Text style={styles.submitClaimButtonText}>Send Invite Request</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.85} onPress={closeInviteModal}>
              <Text style={[styles.claimCancelText, { color: colors.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={claimModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClaimModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.claimModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.claimModalTitle, { color: colors.text }]}>Claim Player</Text>
            <Text style={[styles.claimModalSubtitle, { color: colors.muted }]}>
              How would you like to claim this player?
            </Text>

            <TouchableOpacity activeOpacity={0.85} onPress={onAskToClaim} style={[styles.claimOptionCard, { borderColor: colors.border }]}>
              <View style={styles.claimOptionLeft}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={CMConstants.color.green} />
                <Text style={[styles.claimOptionText, { color: colors.text }]}>Ask to Claim</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.85} onPress={onClaimByCode} style={[styles.claimOptionCard, { borderColor: colors.border }]}>
              <View style={styles.claimOptionLeft}>
                <Ionicons name="key-outline" size={22} color={CMConstants.color.green} />
                <Text style={[styles.claimOptionText, { color: colors.text }]}>Claim by Code</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.85} onPress={() => setClaimModalVisible(false)}>
              <Text style={[styles.claimCancelText, { color: colors.muted }]}>Cancel</Text>
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
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.claimModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.claimModalTitle, { color: colors.text }]}>Claim by Code</Text>
            <Text style={[styles.claimModalSubtitle, { color: colors.muted }]}>
              Enter the league code to gain access to this player.
            </Text>

            <View style={[styles.codeInputWrapper, { borderColor: colors.border, backgroundColor: isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white }]}>
              <Ionicons name="key-outline" size={18} color={CMConstants.color.green} style={{ marginRight: 8 }} />
              <TextInput
                value={claimCode}
                onChangeText={setClaimCode}
                placeholder="Enter league code"
                placeholderTextColor={colors.muted}
                style={[styles.codeInput, { color: colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.submitClaimButton}
              onPress={onSubmitClaimCode}
            >
              <Text style={styles.submitClaimButtonText}>Submit Code</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.85} onPress={closeClaimCodeModal}>
              <Text style={[styles.claimCancelText, { color: colors.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DatePicker
        isVisible={showInviteStartDatePicker}
        mode={'single'}
        initialDate={inviteStartDate || new Date()}
        onCancel={() => {
          setShowInviteStartDatePicker(false)
          reopenInviteModalAfterPicker()
        }}
        onConfirm={(output) => {
          setShowInviteStartDatePicker(false)
          setInviteStartDate(output.date || null)
          if (inviteDurationType === 'single_game' && output.date) {
            setInviteEndDate(output.date)
          }
          reopenInviteModalAfterPicker()
        }}
      />

      <DatePicker
        isVisible={showInviteEndDatePicker}
        mode={'single'}
        initialDate={inviteEndDate || inviteStartDate || new Date()}
        minDate={inviteStartDate || undefined}
        onCancel={() => {
          setShowInviteEndDatePicker(false)
          reopenInviteModalAfterPicker()
        }}
        onConfirm={(output) => {
          setShowInviteEndDatePicker(false)
          setInviteEndDate(output.date || null)
          reopenInviteModalAfterPicker()
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  headerBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  sectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 12,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    marginTop: 8,
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  claimModalCard: {
    width: '100%',
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    padding: CMConstants.space.normal,
  },
  claimModalTitle: {
    fontSize: CMConstants.fontSize.large,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  claimModalSubtitle: {
    fontSize: CMConstants.fontSize.normal,
    textAlign: 'center',
    marginBottom: CMConstants.space.small,
  },
  claimOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: CMConstants.radius.normal,
    paddingHorizontal: CMConstants.space.normal,
    paddingVertical: CMConstants.space.smallEx + 2,
    marginBottom: CMConstants.space.smallEx,
  },
  claimOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  claimOptionText: {
    marginLeft: CMConstants.space.smallEx,
    fontSize: CMConstants.fontSize.normal,
    fontWeight: '700',
  },
  claimCancelText: {
    marginTop: CMConstants.space.smallEx,
    textAlign: 'center',
    fontSize: CMConstants.fontSize.normal,
    fontWeight: '700',
  },
  codeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: CMConstants.radius.normal,
    paddingHorizontal: CMConstants.space.smallEx,
    paddingVertical: CMConstants.space.smallEx,
    marginBottom: CMConstants.space.small,
  },
  codeInput: {
    flex: 1,
    fontSize: CMConstants.fontSize.normal,
  },
  submitClaimButton: {
    backgroundColor: CMConstants.color.green,
    borderRadius: CMConstants.radius.normal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: CMConstants.space.smallEx + 2,
  },
  submitClaimButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.normal,
    fontWeight: '700',
  },
  filterTitle: {
    marginTop: 12,
    marginBottom: 10,
    fontSize: 22,
    fontWeight: '700',
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
})

export default CMRecruitPlayersScreen

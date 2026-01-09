import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import firestore, { collection, getDocs, getFirestore } from '@react-native-firebase/firestore'
import { getAuth } from '@react-native-firebase/auth'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMGlobal from '../CMGlobal'
import CMProfileImage from '../components/CMProfileImage'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'

type MyPlayerTab = 'created' | 'invited'

type MyPlayerItem = {
  id: string
  name: string
  avatar?: string
  position: string
  city: string
  state: string
  country: string
  heightLabel: string
  teamName: string
  leagueName: string
  inviteStatus?: string
  inviteDirection?: 'incoming' | 'outgoing'
  sourcePlayer: { [name: string]: any }
}

const TABS: { key: MyPlayerTab; label: string }[] = [
  { key: 'created', label: 'Created' },
  { key: 'invited', label: 'Invited' },
]

const formatHeight = (heightValue: any) => {
  const numericHeight = Number(heightValue)
  if (!Number.isFinite(numericHeight) || numericHeight <= 0) {
    return 'Height N/A'
  }

  if (numericHeight >= 48 && numericHeight <= 96) {
    const feet = Math.floor(numericHeight / 12)
    const inches = numericHeight % 12
    return `${feet}'${inches}"`
  }

  return `${numericHeight}`
}

const formatInviteStatus = (status?: string) => {
  switch (`${status || ''}`.toLowerCase()) {
    case 'accepted':
      return 'ACCEPTED'
    case 'rejected':
      return 'REJECTED'
    default:
      return 'PENDING'
  }
}

const formatCreatedInviteStatus = (status?: string) => {
  switch (`${status || ''}`.toLowerCase()) {
    case 'rejected':
      return 'REJECTED'
    case 'accepted':
    case 'pending':
      return 'INVITED'
    default:
      return 'INVITED'
  }
}

const CMMyPlayersScreen = ({ navigation }: CMNavigationProps) => {
  const insets = useSafeAreaInsets()
  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.dark)
  const [loading, setLoading] = useState(false)
  const [createdPlayers, setCreatedPlayers] = useState<MyPlayerItem[]>([])
  const [invitedPlayers, setInvitedPlayers] = useState<MyPlayerItem[]>([])
  const [selectedTab, setSelectedTab] = useState<MyPlayerTab>('created')
  const [searchText, setSearchText] = useState('')
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState('Any')
  const [selectedCity, setSelectedCity] = useState('Any')

  const currentUserIds = Array.from(
    new Set([CMGlobal.user?.id, getAuth().currentUser?.uid].filter((value): value is string => !!value)),
  )
  const isDarkMode = themeMode === CMConstants.themeMode.dark

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
    [isDarkMode],
  )

  const loadMyPlayers = async () => {
    if (currentUserIds.length === 0) {
      setCreatedPlayers([])
      setInvitedPlayers([])
      return
    }

    setLoading(true)
    try {
      const db = getFirestore()
      const [playersSnapshot, teamsSnapshots, leaguesSnapshot, invitesSnapshots] = await Promise.all([
        getDocs(collection(db, CMConstants.collectionName.players)),
        Promise.all(
          currentUserIds.map((userId) =>
            firestore().collection(CMConstants.collectionName.teams).where('coachId', '==', userId).get(),
          ),
        ),
        getDocs(collection(db, CMConstants.collectionName.league)),
        Promise.all(
          currentUserIds.map((userId) =>
            firestore().collection(CMConstants.collectionName.playerInvites).where('inviterUserId', '==', userId).get(),
          ),
        ),
      ])

      const teamsMap = new Map<string, any>()
      const coachTeamIds = new Set<string>()
      teamsSnapshots.forEach((snapshot) => {
        snapshot.forEach((documentSnapshot) => {
          coachTeamIds.add(documentSnapshot.id)
          teamsMap.set(documentSnapshot.id, { id: documentSnapshot.id, ...documentSnapshot.data() })
        })
      })

      const leaguesByTeamId = new Map<string, any>()
      leaguesSnapshot.forEach((documentSnapshot: any) => {
        const league = { id: documentSnapshot.id, ...documentSnapshot.data() }
        const teamsId = Array.isArray(league?.teamsId) ? league.teamsId : []
        teamsId.forEach((teamId: string) => {
          if (teamId) {
            leaguesByTeamId.set(teamId, league)
          }
        })
      })

      const playersMap = new Map<string, any>()
      playersSnapshot.forEach((documentSnapshot: any) => {
        playersMap.set(documentSnapshot.id, { id: documentSnapshot.id, ...documentSnapshot.data() })
      })

      const nextCreatedPlayers: MyPlayerItem[] = []
      playersMap.forEach((player) => {
        if (player?.deleted) {
          return
        }

        const isCreatedByUser = !!player?.createdBy && currentUserIds.includes(player.createdBy)
        const isOnCoachTeam = !!player?.teamId && coachTeamIds.has(player.teamId)
        if (!isCreatedByUser && !isOnCoachTeam) {
          return
        }

        const team = teamsMap.get(player.teamId)
        const league = leaguesByTeamId.get(player.teamId)
        nextCreatedPlayers.push({
          id: player.id,
          name: player.name || 'Unnamed Player',
          avatar: player.avatar,
          position: player.position || 'Position N/A',
          city: player.city || team?.city || league?.city || 'Unknown City',
          state: player.state || team?.state || league?.state || '',
          country: player.country || team?.country || league?.country || '',
          heightLabel: formatHeight(player.height),
          teamName: team?.name || 'Unassigned Team',
          leagueName: league?.name || 'Unassigned League',
          sourcePlayer: player,
        })
      })

      const inviteMap = new Map<string, MyPlayerItem>()
      const incomingInviteStatusByPlayerId = new Map<string, string>()
      invitesSnapshots.forEach((snapshot) => {
        snapshot.forEach((documentSnapshot) => {
          const invite = { id: documentSnapshot.id, ...documentSnapshot.data() }
          const player = playersMap.get(invite.playerId)
          if (!player || player?.deleted) {
            return
          }

          const team = teamsMap.get(player.teamId)
          const league = leaguesByTeamId.get(player.teamId)
          inviteMap.set(player.id, {
            id: player.id,
            name: player.name || invite.playerName || 'Unnamed Player',
            avatar: player.avatar || invite.playerAvatar,
            position: player.position || 'Position N/A',
            city: player.city || team?.city || league?.city || 'Unknown City',
            state: player.state || team?.state || league?.state || '',
            country: player.country || team?.country || league?.country || '',
            heightLabel: formatHeight(player.height),
            teamName: team?.name || invite.teamName || 'Unassigned Team',
            leagueName: league?.name || invite.leagueName || 'Unassigned League',
            inviteStatus: invite.status || 'sent',
            sourcePlayer: player,
          })
        })
      })

      const incomingInviteSnapshots = await Promise.all(
        currentUserIds.map((userId) =>
          firestore().collection(CMConstants.collectionName.playerInvites).where('playerOwnerCoachId', '==', userId).get(),
        ),
      )

      incomingInviteSnapshots.forEach((snapshot) => {
        snapshot.forEach((documentSnapshot) => {
          const invite = { id: documentSnapshot.id, ...documentSnapshot.data() }
          const playerId = invite.playerId
          const status = `${invite.status || ''}`.toLowerCase()
          const normalizedStatus = status === 'payment_requested' ? 'pending' : status
          if (!playerId || !status) {
            return
          }

          const existingPriority = incomingInviteStatusByPlayerId.get(playerId)
          const priority = normalizedStatus === 'pending' ? 4 : normalizedStatus === 'accepted' ? 2 : normalizedStatus === 'rejected' ? 1 : 0
          const existingScore =
            existingPriority === 'pending' ? 4 :
            existingPriority === 'accepted' ? 2 :
            existingPriority === 'rejected' ? 1 : 0

          if (priority >= existingScore) {
            incomingInviteStatusByPlayerId.set(playerId, normalizedStatus)
          }
        })
      })

      const sortPlayers = (items: MyPlayerItem[]) =>
        [...items].sort((a, b) => {
          const nameCompare = a.name.localeCompare(b.name)
          if (nameCompare !== 0) {
            return nameCompare
          }
          return a.teamName.localeCompare(b.teamName)
        })

      setCreatedPlayers(
        sortPlayers(
          nextCreatedPlayers.map((item) => ({
            ...item,
            inviteStatus: incomingInviteStatusByPlayerId.get(item.id) || '',
            inviteDirection: incomingInviteStatusByPlayerId.has(item.id) ? 'incoming' : undefined,
          })),
        ),
      )
      setInvitedPlayers(sortPlayers(Array.from(inviteMap.values())))
    } catch (error) {
      console.log('Failed to load my players:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to load your players.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.dark)
      loadMyPlayers()
    })
    return unsubscribe
  }, [navigation, currentUserIds.join('|')])

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

  const activeItems = selectedTab === 'created' ? createdPlayers : invitedPlayers

  const cityOptions = useMemo(() => {
    return ['Any'].concat(
      Array.from(new Set(activeItems.map((item) => item.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    )
  }, [activeItems])

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return activeItems.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.teamName.toLowerCase().includes(query) ||
        item.leagueName.toLowerCase().includes(query) ||
        item.city.toLowerCase().includes(query)

      const matchesPosition =
        selectedPosition === 'Any' ||
        item.position.toUpperCase().includes(selectedPosition)

      const matchesCity =
        selectedCity === 'Any' ||
        item.city === selectedCity

      return matchesSearch && matchesPosition && matchesCity
    })
  }, [activeItems, searchText, selectedPosition, selectedCity])

  const renderFilterChip = (label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentSoft : colors.surface,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? CMConstants.color.green : colors.muted, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  )

  const renderPlayerCard = (item: MyPlayerItem) => (
    <TouchableOpacity
      key={`${selectedTab}-${item.id}`}
      activeOpacity={0.9}
      onPress={() => navigation.navigate(CMConstants.screenName.playerDetails, { player: item.sourcePlayer })}
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
        <CMProfileImage radius={34} imgURL={item.avatar} isUser />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontSize: CMConstants.fontSize.normal, fontWeight: '700' }}>
            {item.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: CMConstants.fontSize.small }}>
            {item.heightLabel} | {item.position} | {item.city}
          </Text>
          <Text style={{ color: colors.muted, fontSize: CMConstants.fontSize.smallEx, marginTop: 6 }}>
            {item.teamName} | {item.leagueName}
          </Text>
        </View>
        {selectedTab === 'invited' && (
          <View style={{ marginLeft: 10 }}>
            <View
              style={{
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: colors.accentSoft,
                borderWidth: 1,
                borderColor: colors.accent,
              }}
            >
              <Text style={{ color: CMConstants.color.green, fontWeight: '700', fontSize: CMConstants.fontSize.small }}>
                {formatInviteStatus(item.inviteStatus)}
              </Text>
            </View>
          </View>
        )}
        {selectedTab === 'created' && !!item.inviteStatus && (
          <View style={{ marginLeft: 10 }}>
            <View
              style={{
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: item.inviteStatus === 'rejected' ? 'rgba(180, 75, 75, 0.16)' : colors.accentSoft,
                borderWidth: 1,
                borderColor: item.inviteStatus === 'rejected' ? '#B44B4B' : colors.accent,
              }}
            >
              <Text
                style={{
                  color: item.inviteStatus === 'rejected' ? '#E57F7F' : CMConstants.color.green,
                  fontWeight: '700',
                  fontSize: CMConstants.fontSize.small,
                }}
              >
                {formatCreatedInviteStatus(item.inviteStatus)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: colors.background }]}>
      <CMLoadingDialog visible={loading} />

      <View style={{ flex: 1, paddingHorizontal: CMConstants.space.small }}>
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = selectedTab === tab.key
            const count = tab.key === 'created' ? createdPlayers.length : invitedPlayers.length
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.85}
                onPress={() => setSelectedTab(tab.key)}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: isActive ? colors.accentSoft : colors.surface,
                    borderColor: isActive ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={{ color: isActive ? CMConstants.color.green : colors.muted, fontWeight: '700' }}>
                  {tab.label} {count}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
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
              placeholder={`Search ${selectedTab} players...`}
              placeholderTextColor={colors.muted}
              style={{ flex: 1, marginLeft: 10, color: colors.text, fontSize: CMConstants.fontSize.normal }}
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
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
            <Text style={{ color: CMConstants.color.white, fontWeight: '700' }}>Filter</Text>
            <Ionicons name="chevron-forward" size={18} color={CMConstants.color.white} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={CMConstants.color.green} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + CMConstants.space.normal }}
          >
            {filteredItems.map(renderPlayerCard)}
            {filteredItems.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="people-outline" size={28} color={colors.muted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No players in this category</Text>
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  Try a different search or filter, or send invites from Recruit Players to populate this list.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close-outline" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontSize: CMConstants.fontSize.large, fontWeight: '700' }}>Filters</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedPosition('Any')
                  setSelectedCity('Any')
                }}
              >
                <Text style={{ color: CMConstants.color.green, fontWeight: '700' }}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterTitle, { color: colors.text }]}>Position</Text>
              <View style={styles.filterWrap}>
                {['Any', 'PG', 'SG', 'SF', 'PF', 'C'].map((item) =>
                  renderFilterChip(item, selectedPosition === item, () => setSelectedPosition(item)),
                )}
              </View>

              <Text style={[styles.filterTitle, { color: colors.text }]}>City</Text>
              <View style={styles.filterWrap}>
                {cityOptions.map((item) =>
                  renderFilterChip(item, selectedCity === item, () => setSelectedCity(item)),
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowFilterModal(false)}
              style={[styles.applyButton, { backgroundColor: colors.accent }]}
            >
              <Text style={{ color: CMConstants.color.white, fontWeight: '700', fontSize: CMConstants.fontSize.normal }}>
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: CMConstants.space.small,
    marginBottom: CMConstants.space.smallEx,
  },
  tabButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: CMConstants.space.small,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.bold,
  },
  emptyText: {
    marginTop: 6,
    fontSize: CMConstants.fontSize.small,
    textAlign: 'center',
    fontFamily: CMConstants.font.regular,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: CMConstants.space.normal,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 20,
    maxHeight: '84%',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  filterTitle: {
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.bold,
    marginBottom: 10,
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  applyButton: {
    marginTop: 12,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
})

export default CMMyPlayersScreen

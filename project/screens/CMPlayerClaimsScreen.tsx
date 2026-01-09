import React, { useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { getAuth } from '@react-native-firebase/auth'
import firestore, { Timestamp } from '@react-native-firebase/firestore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMGlobal from '../CMGlobal'
import CMProfileImage from '../components/CMProfileImage'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'

type ClaimStatus = 'pending' | 'approved' | 'denied'

type PlayerClaim = {
  id: string
  playerId: string
  playerName: string
  playerAvatar?: string
  requesterUserId: string
  requesterName: string
  commissionerId: string
  reviewOwnerId?: string
  teamCoachId?: string
  leagueId?: string
  leagueName?: string
  teamName?: string
  status: ClaimStatus
  claimMethod?: string
  createdAt?: any
  approvedAt?: any
  deniedAt?: any
  denialReason?: string
}

const getClaimMethodLabel = (claimMethod?: string) => {
  switch (`${claimMethod || ''}`.toLowerCase()) {
    case 'code':
      return 'Claimed by Code'
    case 'commissioner_request':
      return 'Asked to Claim'
    default:
      return 'Claim Record'
  }
}

const TABS: { key: ClaimStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Player Claims' },
  { key: 'denied', label: 'Denied' },
]

const CMPlayerClaimsScreen = ({ navigation }: CMNavigationProps) => {
  const insets = useSafeAreaInsets()
  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.dark)
  const [loading, setLoading] = useState(false)
  const [claims, setClaims] = useState<PlayerClaim[]>([])
  const [selectedTab, setSelectedTab] = useState<ClaimStatus>('pending')
  const [searchText, setSearchText] = useState('')
  const [denyModalVisible, setDenyModalVisible] = useState(false)
  const [selectedClaimForDeny, setSelectedClaimForDeny] = useState<PlayerClaim | null>(null)
  const [denyReason, setDenyReason] = useState('')

  const isDarkMode = themeMode === CMConstants.themeMode.dark
  const currentUserIds = Array.from(
    new Set(
      [CMGlobal.user?.id, getAuth().currentUser?.uid].filter((value): value is string => !!value),
    ),
  )

  const colors = useMemo(
    () => ({
      background: isDarkMode ? '#121116' : CMConstants.color.white,
      surface: isDarkMode ? '#19171F' : '#FAFAFA',
      border: isDarkMode ? '#2C2734' : CMConstants.color.lightGrey,
      text: isDarkMode ? CMConstants.color.white : CMConstants.color.black,
      muted: isDarkMode ? '#B8B1C5' : CMConstants.color.grey,
      accent: CMConstants.color.greenDark,
      accentSoft: 'rgba(0, 217, 118, 0.16)',
      danger: '#B44B4B',
      dangerSoft: 'rgba(180, 75, 75, 0.16)',
    }),
    [isDarkMode]
  )

  const loadClaims = async () => {
    if (currentUserIds.length === 0) {
      setClaims([])
      return
    }

    setLoading(true)
    try {
      const teamSnapshots = await Promise.all(
        currentUserIds.map((userId) =>
          firestore()
            .collection('teams')
            .where('coachId', '==', userId)
            .get(),
        ),
      )

      const coachTeamIds = Array.from(
        new Set(
          teamSnapshots.flatMap((snapshot) =>
            snapshot.docs.map((documentSnapshot) => documentSnapshot.id),
          ),
        ),
      )

      const teamsById = new Map<string, { id: string; name?: string }>()
      teamSnapshots.forEach((snapshot) => {
        snapshot.docs.forEach((documentSnapshot) => {
          teamsById.set(documentSnapshot.id, {
            id: documentSnapshot.id,
            ...(documentSnapshot.data() as { name?: string }),
          })
        })
      })

      const snapshots = await Promise.all(
        [
          ...currentUserIds.flatMap((userId) => [
          firestore().collection('playerClaims').where('reviewOwnerId', '==', userId).get(),
          firestore().collection('playerClaims').where('teamCoachId', '==', userId).get(),
          firestore().collection('playerClaims').where('commissionerId', '==', userId).get(),
          ]),
          ...coachTeamIds
            .filter((_, index) => index < 10),
        ].flatMap((item) =>
          typeof item === 'string'
            ? [firestore().collection('playerClaims').where('teamId', '==', item).get()]
            : [item],
        ),
      )

      const codeClaimPlayerSnapshots = await Promise.all(
        coachTeamIds
          .filter((_, index) => index < 10)
          .map((teamId) =>
            firestore()
              .collection('players')
              .where('teamId', '==', teamId)
              .where('claimMethod', '==', 'code')
              .get(),
          ),
      )

      const claimsMap = new Map<string, PlayerClaim>()
      const nextClaims: PlayerClaim[] = []
      snapshots.forEach((snapshot) => {
        snapshot.forEach((doc) => {
          claimsMap.set(doc.id, { id: doc.id, ...doc.data() } as PlayerClaim)
        })
      })

      codeClaimPlayerSnapshots.forEach((snapshot) => {
        snapshot.forEach((documentSnapshot) => {
          const player = documentSnapshot.data() as { [name: string]: any }
          const syntheticClaimId = `code-claim-${documentSnapshot.id}-${player?.claimedByUserId || 'unknown'}`
          const alreadyTracked = Array.from(claimsMap.values()).some((claim) =>
            claim.playerId === documentSnapshot.id &&
            claim.status === 'approved' &&
            `${claim.claimMethod || ''}`.toLowerCase() === 'code',
          )

          if (alreadyTracked || !player?.claimedByUserId) {
            return
          }

          claimsMap.set(syntheticClaimId, {
            id: syntheticClaimId,
            playerId: documentSnapshot.id,
            playerName: player?.name || 'Unknown Player',
            playerAvatar: player?.avatar || '',
            requesterUserId: player?.claimedByUserId || '',
            requesterName: player?.claimedByUserName || 'Unknown User',
            commissionerId: '',
            reviewOwnerId: '',
            teamCoachId: '',
            leagueId: player?.leagueId || '',
            leagueName: player?.leagueName || '',
            teamName: teamsById.get(player?.teamId || '')?.name || '',
            status: 'approved',
            claimMethod: 'code',
            createdAt: player?.claimedAt,
            approvedAt: player?.claimedAt,
          })
        })
      })

      claimsMap.forEach((claim) => nextClaims.push(claim))

      nextClaims.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime?.() || 0
        const dateB = b.createdAt?.toDate?.()?.getTime?.() || 0
        return dateB - dateA
      })

      setClaims(nextClaims)
    } catch (error) {
      console.log('Failed to load player claims:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to load player claims.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.dark)
      loadClaims()
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

  const filteredClaims = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return claims.filter((claim) => {
      if (claim.status !== selectedTab) {
        return false
      }

      if (!query) {
        return true
      }

      return (
        (claim.playerName || '').toLowerCase().includes(query) ||
        (claim.requesterName || '').toLowerCase().includes(query) ||
        (claim.leagueName || '').toLowerCase().includes(query) ||
        (claim.teamName || '').toLowerCase().includes(query)
      )
    })
  }, [claims, searchText, selectedTab])

  const counts = useMemo(() => {
    return {
      pending: claims.filter((item) => item.status === 'pending').length,
      approved: claims.filter((item) => item.status === 'approved').length,
      denied: claims.filter((item) => item.status === 'denied').length,
    }
  }, [claims])

  const handleApprove = async (claim: PlayerClaim) => {
    try {
      setLoading(true)

      const playerDoc = await firestore().collection('players').doc(claim.playerId).get()
      const playerData = playerDoc.data() || {}
      const existingClaimOwner = playerData?.claimedByUserId

      if (existingClaimOwner && existingClaimOwner !== claim.requesterUserId) {
        CMAlertDlgHelper.showAlertWithOK('This player has already been claimed by another user.')
        return
      }

      await firestore().collection('players').doc(claim.playerId).update({
        claimedByUserId: claim.requesterUserId,
        claimedByUserName: claim.requesterName,
        claimedAt: Timestamp.now(),
        claimMethod: claim.claimMethod || 'commissioner_request',
      })

      const approvedAt = Timestamp.now()

      await firestore().collection('playerClaims').doc(claim.id).update({
        status: 'approved',
        approvedAt,
      })

      const competingClaimsSnapshot = await firestore()
        .collection('playerClaims')
        .where('playerId', '==', claim.playerId)
        .where('status', '==', 'pending')
        .get()

      const batch = firestore().batch()
      competingClaimsSnapshot.forEach((documentSnapshot) => {
        if (documentSnapshot.id !== claim.id) {
          batch.update(documentSnapshot.ref, {
            status: 'denied',
            deniedAt: approvedAt,
            denialReason: 'Another claim request was approved for this player.',
          })
        }
      })
      await batch.commit()

      setClaims((prev) =>
        prev.map((item) =>
          item.playerId === claim.playerId && item.status === 'pending'
            ? item.id === claim.id
              ? { ...item, status: 'approved', approvedAt }
              : {
                  ...item,
                  status: 'denied',
                  deniedAt: approvedAt,
                }
            : item
        )
      )
    } catch (error) {
      console.log('Failed to approve claim:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to approve claim.')
    } finally {
      setLoading(false)
    }
  }

  const openDenyModal = (claim: PlayerClaim) => {
    setSelectedClaimForDeny(claim)
    setDenyReason('')
    setDenyModalVisible(true)
  }

  const handleDeny = async () => {
    if (!selectedClaimForDeny) {
      return
    }

    const trimmedReason = denyReason.trim()
    if (!trimmedReason) {
      CMAlertDlgHelper.showAlertWithOK('Please enter a reason for denial.')
      return
    }

    try {
      setLoading(true)
      const deniedAt = Timestamp.now()
      await firestore().collection('playerClaims').doc(selectedClaimForDeny.id).update({
        status: 'denied',
        deniedAt,
        denialReason: trimmedReason,
      })

      setClaims((prev) =>
        prev.map((item) =>
          item.id === selectedClaimForDeny.id
            ? { ...item, status: 'denied', deniedAt, denialReason: trimmedReason }
            : item
        )
      )
      setDenyModalVisible(false)
      setSelectedClaimForDeny(null)
      setDenyReason('')
    } catch (error) {
      console.log('Failed to deny claim:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to deny claim.')
    } finally {
      setLoading(false)
    }
  }

  const renderClaimCard = ({ item }: { item: PlayerClaim }) => {
    const requestTime =
      item.createdAt?.toDate?.()
        ? item.createdAt.toDate().toLocaleString()
        : 'Unknown time'

    return (
      <View
        style={[
          styles.claimCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.claimCardRow}>
          <CMProfileImage radius={24} imgURL={item.playerAvatar} isUser />
          <View style={styles.claimInfo}>
            <Text style={[styles.claimName, { color: colors.text }]}>{item.playerName || 'Unknown Player'}</Text>
            <Text style={[styles.claimMeta, { color: colors.muted }]}>
              {item.leagueName || 'No League'} - {item.teamName || 'No Team'}
            </Text>
            <Text style={[styles.claimMeta, { color: colors.muted }]}>{item.requesterName || 'Unknown User'}</Text>
            <View
              style={[
                styles.methodPill,
                {
                  backgroundColor: item.claimMethod === 'code' ? colors.accentSoft : 'rgba(103, 80, 164, 0.16)',
                  borderColor: item.claimMethod === 'code' ? colors.accent : '#6750A4',
                },
              ]}
            >
              <Text
                style={[
                  styles.methodPillText,
                  { color: item.claimMethod === 'code' ? CMConstants.color.green : '#C7B8F5' },
                ]}
              >
                {getClaimMethodLabel(item.claimMethod)}
              </Text>
            </View>
            <Text style={[styles.claimTime, { color: colors.muted }]}>{requestTime}</Text>
          </View>

          {item.status === 'pending' ? (
            <View style={styles.actionsColumn}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleApprove(item)}
                style={[styles.approveButton, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openDenyModal(item)}
                style={[styles.denyButton, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
              >
                <Text style={[styles.actionButtonText, { color: '#E57F7F' }]}>Deny</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: item.status === 'approved' ? colors.accentSoft : colors.dangerSoft,
                  borderColor: item.status === 'approved' ? colors.accent : colors.danger,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: item.status === 'approved' ? CMConstants.color.green : '#E57F7F' },
                ]}
              >
                {item.status === 'approved' ? 'Approved' : 'Denied'}
              </Text>
            </View>
          )}
        </View>
        {item.status === 'denied' && !!item.denialReason && (
          <View style={[styles.reasonBox, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
            <Text style={[styles.reasonLabel, { color: '#E57F7F' }]}>Reason</Text>
            <Text style={[styles.reasonText, { color: colors.text }]}>{item.denialReason}</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: colors.background }]}>
      <CMLoadingDialog visible={loading} />

      <View style={{ flex: 1, paddingHorizontal: CMConstants.space.normal }}>
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = selectedTab === tab.key
            const count = tab.key === 'pending' ? counts.pending : tab.key === 'approved' ? counts.approved : counts.denied

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
                <Text style={[styles.tabLabel, { color: isActive ? CMConstants.color.green : colors.muted }]}>
                  {tab.label} {count}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search players"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <FlatList
          data={filteredClaims}
          keyExtractor={(item) => item.id}
          renderItem={renderClaimCard}
          contentContainerStyle={{ paddingBottom: insets.bottom + CMConstants.space.normal }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="checkbox-outline" size={28} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No claims in this tab</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Claim requests require commissioner approval before a player can be assigned to a user.
              </Text>
            </View>
          }
        />
      </View>

      <Modal
        visible={denyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDenyModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Deny Claim</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              Add a reason so the requester can understand why this claim was denied.
            </Text>
            <TextInput
              value={denyReason}
              onChangeText={setDenyReason}
              placeholder="Enter denial reason"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.reasonInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setDenyModalVisible(false)} style={[styles.modalSecondaryButton, { borderColor: colors.border }]}>
                <Text style={[styles.modalSecondaryButtonText, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} onPress={handleDeny} style={[styles.modalPrimaryButton, { backgroundColor: colors.danger }]}>
                <Text style={styles.actionButtonText}>Deny Claim</Text>
              </TouchableOpacity>
            </View>
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
  tabLabel: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.semiBold,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: CMConstants.space.small,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    height: 46,
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.regular,
  },
  claimCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  claimCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonBox: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 12,
    padding: 12,
  },
  reasonLabel: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.regular,
    lineHeight: 18,
  },
  claimInfo: {
    flex: 1,
    marginLeft: 12,
  },
  claimName: {
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.bold,
  },
  claimMeta: {
    marginTop: 2,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.regular,
  },
  claimTime: {
    marginTop: 4,
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.regular,
  },
  methodPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  methodPillText: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.semiBold,
  },
  actionsColumn: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  approveButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginBottom: 8,
  },
  denyButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 12,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
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
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    fontSize: CMConstants.fontSize.large,
    fontFamily: CMConstants.font.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.regular,
    textAlign: 'center',
    marginBottom: 14,
  },
  reasonInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.regular,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  modalSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  modalSecondaryButtonText: {
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.semiBold,
  },
  modalPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
})

export default CMPlayerClaimsScreen

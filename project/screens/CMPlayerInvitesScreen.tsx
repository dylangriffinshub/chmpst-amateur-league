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

type InviteTab = 'incoming' | 'outgoing' | 'history'
type InviteStatus = 'pending' | 'accepted' | 'rejected'

type PlayerInvite = {
  id: string
  playerId: string
  playerName: string
  playerAvatar?: string
  inviterUserId: string
  inviterName: string
  inviterTeamId?: string
  inviterTeamName?: string
  playerOwnerCoachId?: string
  playerOwnerCoachName?: string
  teamId?: string
  teamName?: string
  leagueId?: string
  leagueName?: string
  durationType?: string
  durationLabel?: string
  requesterMessage?: string
  status: InviteStatus
  rejectionReason?: string
  createdAt?: any
  respondedAt?: any
}

const TABS: { key: InviteTab; label: string }[] = [
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
  { key: 'history', label: 'History' },
]

const getStatusLabel = (status: InviteStatus) => {
  switch (status) {
    case 'accepted':
      return 'Accepted'
    case 'rejected':
      return 'Rejected'
    default:
      return 'Pending'
  }
}

const CMPlayerInvitesScreen = ({ navigation }: CMNavigationProps) => {
  const insets = useSafeAreaInsets()
  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.dark)
  const [loading, setLoading] = useState(false)
  const [selectedTab, setSelectedTab] = useState<InviteTab>('incoming')
  const [searchText, setSearchText] = useState('')
  const [invites, setInvites] = useState<PlayerInvite[]>([])
  const [acceptModalVisible, setAcceptModalVisible] = useState(false)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [selectedInvite, setSelectedInvite] = useState<PlayerInvite | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

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
      warning: '#E3A63A',
      warningSoft: 'rgba(227, 166, 58, 0.14)',
      danger: '#B44B4B',
      dangerSoft: 'rgba(180, 75, 75, 0.16)',
      overlay: 'rgba(0,0,0,0.55)',
    }),
    [isDarkMode],
  )

  const loadInvites = async () => {
    if (currentUserIds.length === 0) {
      setInvites([])
      return
    }

    setLoading(true)
    try {
      const snapshots = await Promise.all([
        ...currentUserIds.map((userId) =>
          firestore().collection(CMConstants.collectionName.playerInvites).where('playerOwnerCoachId', '==', userId).get(),
        ),
        ...currentUserIds.map((userId) =>
          firestore().collection(CMConstants.collectionName.playerInvites).where('inviterUserId', '==', userId).get(),
        ),
      ])

      const inviteMap = new Map<string, PlayerInvite>()
      snapshots.forEach((snapshot) => {
        snapshot.forEach((documentSnapshot) => {
          const inviteData = documentSnapshot.data() as PlayerInvite & { status?: string }
          const normalizedStatus =
            `${inviteData?.status || ''}`.toLowerCase() === 'payment_requested'
              ? 'pending'
              : inviteData?.status
          inviteMap.set(documentSnapshot.id, {
            id: documentSnapshot.id,
            ...inviteData,
            status: (normalizedStatus || 'pending') as InviteStatus,
          })
        })
      })

      const nextInvites = Array.from(inviteMap.values()).sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime?.() || 0
        const dateB = b.createdAt?.toDate?.()?.getTime?.() || 0
        return dateB - dateA
      })

      setInvites(nextInvites)
    } catch (error) {
      console.log('Failed to load player invites:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to load player invites.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.dark)
      loadInvites()
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

  const filteredInvites = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return invites.filter((invite) => {
      const isIncoming = currentUserIds.includes(invite.playerOwnerCoachId || '')
      const isOutgoing = currentUserIds.includes(invite.inviterUserId || '')
      const status = invite.status

      let tabMatch = false
      if (selectedTab === 'incoming') {
        tabMatch = isIncoming && status === 'pending'
      } else if (selectedTab === 'outgoing') {
        tabMatch = isOutgoing && status === 'pending'
      } else {
        tabMatch = (isIncoming || isOutgoing) && (status === 'accepted' || status === 'rejected')
      }

      if (!tabMatch) {
        return false
      }

      if (!query) {
        return true
      }

      return (
        (invite.playerName || '').toLowerCase().includes(query) ||
        (invite.inviterName || '').toLowerCase().includes(query) ||
        (invite.inviterTeamName || '').toLowerCase().includes(query) ||
        (invite.leagueName || '').toLowerCase().includes(query) ||
        (invite.durationLabel || '').toLowerCase().includes(query)
      )
    })
  }, [currentUserIds, invites, searchText, selectedTab])

  const counts = useMemo(() => ({
    incoming: invites.filter((invite) => currentUserIds.includes(invite.playerOwnerCoachId || '') && invite.status === 'pending').length,
    outgoing: invites.filter((invite) => currentUserIds.includes(invite.inviterUserId || '') && invite.status === 'pending').length,
    history: invites.filter((invite) => (currentUserIds.includes(invite.playerOwnerCoachId || '') || currentUserIds.includes(invite.inviterUserId || '')) && (invite.status === 'accepted' || invite.status === 'rejected')).length,
  }), [currentUserIds, invites])

  const openAcceptModal = (invite: PlayerInvite) => {
    setSelectedInvite(invite)
    setAcceptModalVisible(true)
  }

  const openRejectModal = (invite: PlayerInvite) => {
    setSelectedInvite(invite)
    setRejectionReason('')
    setRejectModalVisible(true)
  }

  const handleAccept = async () => {
    if (!selectedInvite) {
      return
    }

    try {
      setLoading(true)
      const nextStatus: InviteStatus = 'accepted'
      await firestore()
        .collection(CMConstants.collectionName.playerInvites)
        .doc(selectedInvite.id)
        .update({
          status: nextStatus,
          rejectionReason: '',
          respondedAt: Timestamp.now(),
        })

      setInvites((prev) =>
        prev.map((item) =>
          item.id === selectedInvite.id
            ? {
                ...item,
                status: nextStatus,
                rejectionReason: '',
                respondedAt: Timestamp.now(),
              }
            : item,
        ),
      )

      setAcceptModalVisible(false)
      setSelectedInvite(null)
      CMAlertDlgHelper.showAlertWithOK('Invite accepted.')
    } catch (error) {
      console.log('Failed to accept invite:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to update invite.')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedInvite) {
      return
    }

    if (!rejectionReason.trim()) {
      CMAlertDlgHelper.showAlertWithOK('Please enter a rejection reason.')
      return
    }

    try {
      setLoading(true)
      await firestore()
        .collection(CMConstants.collectionName.playerInvites)
        .doc(selectedInvite.id)
        .update({
          status: 'rejected',
          rejectionReason: rejectionReason.trim(),
          respondedAt: Timestamp.now(),
        })

      setInvites((prev) =>
        prev.map((item) =>
          item.id === selectedInvite.id
            ? {
                ...item,
                status: 'rejected',
                rejectionReason: rejectionReason.trim(),
                respondedAt: Timestamp.now(),
              }
            : item,
        ),
      )

      setRejectModalVisible(false)
      setSelectedInvite(null)
      setRejectionReason('')
      CMAlertDlgHelper.showAlertWithOK('Invite rejected.')
    } catch (error) {
      console.log('Failed to reject invite:', error)
      CMAlertDlgHelper.showAlertWithOK('Failed to reject invite.')
    } finally {
      setLoading(false)
    }
  }

  const renderStatusPill = (invite: PlayerInvite) => {
    const isRejected = invite.status === 'rejected'
    const borderColor = isRejected ? colors.danger : colors.accent
    const backgroundColor = isRejected ? colors.dangerSoft : colors.accentSoft
    const textColor = isRejected ? '#E57F7F' : CMConstants.color.green

    return (
      <View style={[styles.statusPill, { borderColor, backgroundColor }]}>
        <Text style={[styles.statusPillText, { color: textColor }]}>
          {getStatusLabel(invite.status)}
        </Text>
      </View>
    )
  }

  const renderInviteCard = ({ item }: { item: PlayerInvite }) => {
    const isIncoming = currentUserIds.includes(item.playerOwnerCoachId || '')
    const createdAtText = item.createdAt?.toDate?.() ? item.createdAt.toDate().toLocaleString() : 'Unknown time'

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardRow}>
          <CMProfileImage radius={24} imgURL={item.playerAvatar} isUser />
          <View style={styles.cardInfo}>
            <Text style={[styles.playerName, { color: colors.text }]}>{item.playerName || 'Unknown Player'}</Text>
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {item.leagueName || 'No League'} - {item.teamName || 'No Team'}
            </Text>
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {isIncoming ? `Requested by ${item.inviterName || 'Unknown Coach'}` : `Owner Team: ${item.teamName || 'Unknown Team'}`}
            </Text>
            {!!item.inviterTeamName && (
              <Text style={[styles.metaText, { color: colors.muted }]}>
                Using for {item.inviterTeamName}
              </Text>
            )}
            {!!item.durationLabel && (
              <Text style={[styles.metaText, { color: colors.muted }]}>
                Duration: {item.durationLabel}
              </Text>
            )}
            {!!item.requesterMessage && (
              <Text style={[styles.noteText, { color: colors.text }]}>
                {item.requesterMessage}
              </Text>
            )}
            <Text style={[styles.timeText, { color: colors.muted }]}>{createdAtText}</Text>
          </View>

          {selectedTab === 'incoming' && item.status === 'pending' ? (
            <View style={styles.actionColumn}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openAcceptModal(item)}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.primaryButtonText}>Review</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openRejectModal(item)}
                style={[styles.secondaryButton, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}
              >
                <Text style={[styles.secondaryButtonText, { color: '#E57F7F' }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
              {renderStatusPill(item)}
            </View>
          )}
        </View>

        {item.status === 'rejected' && !!item.rejectionReason && (
          <View style={[styles.detailBox, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
            <Text style={[styles.detailLabel, { color: '#E57F7F' }]}>Rejection Reason</Text>
            <Text style={[styles.detailText, { color: colors.text }]}>{item.rejectionReason}</Text>
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
            const count = tab.key === 'incoming' ? counts.incoming : tab.key === 'outgoing' ? counts.outgoing : counts.history
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
            placeholder="Search invites"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <FlatList
          data={filteredInvites}
          keyExtractor={(item) => item.id}
          renderItem={renderInviteCard}
          contentContainerStyle={{ paddingBottom: insets.bottom + CMConstants.space.normal }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="paper-plane-outline" size={28} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No invites in this section</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Send invites from Recruit Players, then manage incoming and outgoing decisions here.
              </Text>
            </View>
          }
        />
      </View>

      <Modal visible={acceptModalVisible} transparent animationType="fade" onRequestClose={() => setAcceptModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Accept Invite</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              Accept this player invite request.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setAcceptModalVisible(false)} style={[styles.modalSecondaryButton, { borderColor: colors.border }]}>
                <Text style={[styles.modalSecondaryButtonText, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} onPress={handleAccept} style={[styles.modalPrimaryButton, { backgroundColor: colors.accent }]}>
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Reject Invite</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              Add a reason so the other coach knows why this invite was rejected.
            </Text>
            <TextInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Enter rejection reason"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.multilineInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setRejectModalVisible(false)} style={[styles.modalSecondaryButton, { borderColor: colors.border }]}>
                <Text style={[styles.modalSecondaryButtonText, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} onPress={handleReject} style={[styles.modalPrimaryButton, { backgroundColor: colors.danger }]}>
                <Text style={styles.primaryButtonText}>Reject</Text>
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
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.bold,
  },
  metaText: {
    marginTop: 2,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.regular,
  },
  noteText: {
    marginTop: 8,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.regular,
    lineHeight: 18,
  },
  timeText: {
    marginTop: 6,
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.regular,
  },
  actionColumn: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  primaryButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginBottom: 8,
  },
  primaryButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
  },
  detailBox: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 12,
    padding: 12,
  },
  detailLabel: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
    marginBottom: 4,
  },
  detailText: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.regular,
    lineHeight: 18,
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
  choiceCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    fontSize: CMConstants.fontSize.normal,
    fontFamily: CMConstants.font.regular,
    marginBottom: 10,
  },
  multilineInput: {
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

export default CMPlayerInvitesScreen

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMConstants from '../CMConstants';
import CMRipple from './CMRipple';
import CMCommonStyles from '../styles/CMCommonStyles';

interface CMShotChartModalProps {
  visible: boolean;
  onClose: () => void;
  homeTeam: any;
  visitorTeam: any;
}

interface Shot {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  x: number;
  y: number;
  made: boolean;
  shotType: string;
  quarter: number;
}

const CMShotChartModal = ({
  visible,
  onClose,
  homeTeam,
  visitorTeam,
}: CMShotChartModalProps) => {
  const [shots, setShots] = useState<Shot[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('home');
  const [selectedQuarter, setSelectedQuarter] = useState<number>(0); // 0 = all quarters

  const screenWidth = Dimensions.get('window').width;
  const courtWidth = screenWidth * 0.8;
  const courtHeight = courtWidth * 1.65;

  // Mock shot data - in real app, this would come from Firebase
  const mockShots: Shot[] = [
    {
      id: '1',
      playerId: '1',
      playerName: 'Kevin',
      teamId: 'home',
      teamName: 'Home',
      x: 0.2,
      y: 0.3,
      made: true,
      shotType: '3pt',
      quarter: 1,
    },
    {
      id: '2',
      playerId: '2',
      playerName: 'Draymond',
      teamId: 'home',
      teamName: 'Home',
      x: 0.3,
      y: 0.4,
      made: true,
      shotType: '2pt',
      quarter: 1,
    },
    {
      id: '3',
      playerId: '3',
      playerName: 'Stephen',
      teamId: 'home',
      teamName: 'Home',
      x: 0.25,
      y: 0.35,
      made: true,
      shotType: '3pt',
      quarter: 2,
    },
    {
      id: '4',
      playerId: '4',
      playerName: 'Zaza',
      teamId: 'home',
      teamName: 'Home',
      x: 0.35,
      y: 0.45,
      made: false,
      shotType: '2pt',
      quarter: 2,
    },
    {
      id: '5',
      playerId: '5',
      playerName: 'Klay',
      teamId: 'home',
      teamName: 'Home',
      x: 0.15,
      y: 0.25,
      made: true,
      shotType: '3pt',
      quarter: 3,
    },
    {
      id: '6',
      playerId: '6',
      playerName: 'Kawhi',
      teamId: 'visitor',
      teamName: 'Visitor',
      x: 0.8,
      y: 0.3,
      made: true,
      shotType: '2pt',
      quarter: 1,
    },
    {
      id: '7',
      playerId: '7',
      playerName: 'Pascal',
      teamId: 'visitor',
      teamName: 'Visitor',
      x: 0.75,
      y: 0.4,
      made: true,
      shotType: '3pt',
      quarter: 2,
    },
    {
      id: '8',
      playerId: '8',
      playerName: 'Kyle',
      teamId: 'visitor',
      teamName: 'Visitor',
      x: 0.85,
      y: 0.35,
      made: false,
      shotType: '2pt',
      quarter: 3,
    },
  ];

  const filteredShots = mockShots.filter(shot => {
    if (selectedQuarter > 0 && shot.quarter !== selectedQuarter) return false;
    if (selectedTeam === 'home' && shot.teamId !== 'home') return false;
    if (selectedTeam === 'visitor' && shot.teamId !== 'visitor') return false;
    return true;
  });

  const ShotMarker = ({ shot }: { shot: Shot }) => {
    const isHomeTeam = shot.teamId === 'home';
    const markerColor = shot.made
      ? CMConstants.color.fireBrick
      : CMConstants.color.red;
    const markerSize = shot.shotType === '3pt' ? 12 : 8;

    return (
      <View
        style={{
          position: 'absolute',
          left: shot.x * courtWidth - markerSize / 2,
          top: shot.y * courtHeight - markerSize / 2,
          width: markerSize,
          height: markerSize,
          backgroundColor: markerColor,
          borderRadius: markerSize / 2,
          borderWidth: 1,
          borderColor: CMConstants.color.white,
          zIndex: 10,
        }}
      />
    );
  };

  const QuarterButton = ({
    quarter,
    isSelected,
  }: {
    quarter: number;
    isSelected: boolean;
  }) => (
    <CMRipple
      containerStyle={[
        styles.quarterButton,
        {
          backgroundColor: isSelected
            ? CMConstants.color.denim
            : CMConstants.color.lightGrey,
          borderColor: isSelected
            ? CMConstants.color.denim
            : CMConstants.color.lightGrey,
        },
      ]}
      onPress={() => setSelectedQuarter(quarter)}
    >
      <Text
        style={[
          styles.quarterButtonText,
          {
            color: isSelected
              ? CMConstants.color.white
              : CMConstants.color.black,
          },
        ]}
      >
        {quarter === 0 ? 'All' : `Q${quarter}`}
      </Text>
    </CMRipple>
  );

  const TeamButton = ({
    team,
    isSelected,
  }: {
    team: string;
    isSelected: boolean;
  }) => (
    <CMRipple
      containerStyle={[
        styles.teamButton,
        {
          backgroundColor: isSelected
            ? CMConstants.color.denim
            : CMConstants.color.lightGrey,
          borderColor: isSelected
            ? CMConstants.color.denim
            : CMConstants.color.lightGrey,
        },
      ]}
      onPress={() => setSelectedTeam(team)}
    >
      <Text
        style={[
          styles.teamButtonText,
          {
            color: isSelected
              ? CMConstants.color.white
              : CMConstants.color.black,
          },
        ]}
      >
        {team === 'home'
          ? homeTeam?.name || 'Home'
          : visitorTeam?.name || 'Visitor'}
      </Text>
    </CMRipple>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            CMCommonStyles.addModalContentViewStyle(
              CMConstants.themeMode.light,
            ),
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Shot Chart</Text>
            <CMRipple containerStyle={styles.closeButton} onPress={onClose}>
              <Ionicons
                name="close"
                size={CMConstants.height.icon}
                color={CMConstants.color.black}
              />
            </CMRipple>
          </View>

          {/* Filters */}
          <View style={styles.filters}>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Team:</Text>
              <View style={styles.filterButtons}>
                <TeamButton team="home" isSelected={selectedTeam === 'home'} />
                <TeamButton
                  team="visitor"
                  isSelected={selectedTeam === 'visitor'}
                />
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Quarter:</Text>
              <View style={styles.filterButtons}>
                <QuarterButton quarter={0} isSelected={selectedQuarter === 0} />
                <QuarterButton quarter={1} isSelected={selectedQuarter === 1} />
                <QuarterButton quarter={2} isSelected={selectedQuarter === 2} />
                <QuarterButton quarter={3} isSelected={selectedQuarter === 3} />
                <QuarterButton quarter={4} isSelected={selectedQuarter === 4} />
              </View>
            </View>
          </View>

          {/* Court with Shot Markers */}
          <View style={styles.courtContainer}>
            <View
              style={[styles.court, { width: courtWidth, height: courtHeight }]}
            >
              {/* Court outline */}
              <View style={styles.courtOutline} />

              {/* Three-point line */}
              <View style={styles.threePointLine} />

              {/* Key/Paint area */}
              <View style={styles.keyArea} />

              {/* Free throw line */}
              <View style={styles.freeThrowLine} />

              {/* Basket */}
              <View style={styles.basket} />

              {/* Half court line */}
              <View style={styles.halfCourtLine} />

              {/* Shot Markers */}
              {filteredShots.map(shot => (
                <ShotMarker key={shot.id} shot={shot} />
              ))}
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendMarker,
                  {
                    backgroundColor: CMConstants.color.fireBrick,
                    width: 12,
                    height: 12,
                  },
                ]}
              />
              <Text style={styles.legendText}>Made Shot</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendMarker,
                  {
                    backgroundColor: CMConstants.color.red,
                    width: 8,
                    height: 8,
                  },
                ]}
              />
              <Text style={styles.legendText}>Missed Shot</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendText}>Larger markers = 3PT shots</Text>
            </View>
          </View>

          {/* Stats Summary */}
          <View style={styles.statsSummary}>
            <Text style={styles.summaryTitle}>Shot Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Shots:</Text>
              <Text style={styles.summaryValue}>{filteredShots.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Made:</Text>
              <Text style={styles.summaryValue}>
                {filteredShots.filter(s => s.made).length}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Missed:</Text>
              <Text style={styles.summaryValue}>
                {filteredShots.filter(s => !s.made).length}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>3PT Attempts:</Text>
              <Text style={styles.summaryValue}>
                {filteredShots.filter(s => s.shotType === '3pt').length}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  modalOverlay: {
    flex: 1,
    backgroundColor: CMConstants.color.alphaModal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: CMConstants.color.white,
    borderRadius: CMConstants.radius.normal,
    padding: CMConstants.space.normal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: CMConstants.space.normal,
  },
  title: {
    fontSize: CMConstants.fontSize.large,
    fontFamily: CMConstants.font.bold,
    color: CMConstants.color.black,
    flex: 1,
  },
  closeButton: {
    ...CMCommonStyles.circle(CMConstants.height.iconBig),
    backgroundColor: CMConstants.color.lightGrey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filters: {
    marginBottom: CMConstants.space.normal,
  },
  filterSection: {
    marginBottom: CMConstants.space.small,
  },
  filterLabel: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.semiBold,
    color: CMConstants.color.black,
    marginBottom: CMConstants.space.smallEx,
  },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  teamButton: {
    height: CMConstants.height.buttonSmall,
    paddingHorizontal: CMConstants.space.small,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CMConstants.radius.smallEx,
    marginRight: CMConstants.space.smallEx,
    borderWidth: 1,
  },
  teamButtonText: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
    textAlign: 'center',
  },
  quarterButton: {
    height: CMConstants.height.buttonSmall,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CMConstants.radius.smallEx,
    marginRight: CMConstants.space.smallEx,
    borderWidth: 1,
  },
  quarterButtonText: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
    textAlign: 'center',
  },
  courtContainer: {
    alignItems: 'center',
    marginBottom: CMConstants.space.normal,
  },
  court: {
    position: 'relative',
    backgroundColor: CMConstants.color.lightGrey2,
    borderRadius: CMConstants.radius.normal,
    overflow: 'hidden',
  },
  courtOutline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: CMConstants.color.black,
    borderRadius: CMConstants.radius.normal,
  },
  threePointLine: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
    borderWidth: 2,
    borderColor: CMConstants.color.black,
    borderRadius: 1000,
    borderStyle: 'dashed',
  },
  keyArea: {
    position: 'absolute',
    top: '35%',
    left: '25%',
    right: '25%',
    bottom: '25%',
    backgroundColor: CMConstants.color.lightGrey1,
    borderWidth: 2,
    borderColor: CMConstants.color.black,
  },
  freeThrowLine: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: CMConstants.color.black,
  },
  basket: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    width: 8,
    height: 8,
    backgroundColor: CMConstants.color.fireBrick,
    borderRadius: 4,
    marginLeft: -4,
  },
  halfCourtLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: CMConstants.color.black,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: CMConstants.space.normal,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: CMConstants.space.smallEx,
  },
  legendMarker: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CMConstants.color.white,
    marginRight: CMConstants.space.smallEx,
  },
  legendText: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.regular,
    color: CMConstants.color.black,
  },
  statsSummary: {
    backgroundColor: CMConstants.color.lightGrey2,
    padding: CMConstants.space.small,
    borderRadius: CMConstants.radius.smallEx,
  },
  summaryTitle: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.semiBold,
    color: CMConstants.color.black,
    marginBottom: CMConstants.space.smallEx,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: CMConstants.space.smallEx,
  },
  summaryLabel: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.regular,
    color: CMConstants.color.black,
  },
  summaryValue: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
    color: CMConstants.color.black,
  },
};

export default CMShotChartModal;

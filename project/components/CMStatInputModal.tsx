import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Orientation from 'react-native-orientation-locker';
import CMConstants from '../CMConstants';
import CMRipple from './CMRipple';
import CMCommonStyles from '../styles/CMCommonStyles';

interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  avatar?: string;
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    fouls: number;
    blocks: number;
    turnovers: number;
    steals: number;
  };
}

interface CMStatInputModalProps {
  visible: boolean;
  onClose: () => void;
  onStatInput: (statType: string, value: any) => void;
  player: Player | null;
  teammates?: Player[];
}

const CMStatInputModal = ({
  visible,
  onClose,
  onStatInput,
  player,
  teammates = [],
}: CMStatInputModalProps) => {
  const [selectedShotType, setSelectedShotType] = useState<string>('');
  const [selectedShotResult, setSelectedShotResult] = useState<string>('');
  const [askAssist, setAskAssist] = useState<{shotType: string} | null>(null);
  const [assistModalVisible, setAssistModalVisible] = useState(false);
  const screenDimensions = Dimensions.get('window');

  // Lock orientation to landscape when modal opens
  useEffect(() => {
    if (visible) {
      Orientation.lockToLandscape();
      console.log('Stat input modal opened - orientation locked to landscape');
    } else {
      // Keep landscape locked since we're still in scoreboard screen
      // The scoreboard screen will handle unlocking when navigating away
      console.log('Stat input modal closed - keeping landscape orientation');
    }
  }, [visible]);

  const handleClose = () => {
    onClose();
  };

  const handleShotInput = (shotType: string, result: string) => {
    // For made 2PT/3PT, ask for assist selection
    if (
      (shotType === CMConstants.shotType.twoPoint || shotType === CMConstants.shotType.threePoint) &&
      result === CMConstants.shotResult.made && teammates.length > 0
    ) {
      setAskAssist({shotType});
      setAssistModalVisible(true);
      return;
    }
    onStatInput(CMConstants.statType.points, { shotType, result });
  };

  const handleStatInput = (statType: string) => {
    onStatInput(statType, {});
  };

  const StatButton = ({
    title,
    onPress,
    color = CMConstants.color.grey,
    textColor = CMConstants.color.white,
  }: {
    title: string;
    onPress: () => void;
    color?: string;
    textColor?: string;
  }) => (
    <CMRipple
      containerStyle={[styles.statButton, { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={[styles.statButtonText, { color: textColor }]}>{title}</Text>
    </CMRipple>
  );

  const ShotButton = ({
    title,
    onPress,
    isSelected,
    color = CMConstants.color.fireBrick,
  }: {
    title: string;
    onPress: () => void;
    isSelected: boolean;
    color?: string;
  }) => (
    <CMRipple
      containerStyle={[
        styles.shotButton,
        {
          backgroundColor: isSelected ? CMConstants.color.denim : color,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected
            ? CMConstants.color.white
            : CMConstants.color.black,
        },
      ]}
      onPress={onPress}
    >
      <Text style={styles.shotButtonText}>{title}</Text>
    </CMRipple>
  );

  if (!visible) return null;

  return (
    <View style={styles.modalContainer}>
      <StatusBar hidden={true} />
      <View style={styles.modalOverlay}>
        {!assistModalVisible && (
        <View style={styles.modalContent as any}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Input Stats for {player?.name}</Text>
            <CMRipple containerStyle={styles.closeButton} onPress={handleClose}>
              <Ionicons
                name="close"
                size={CMConstants.height.icon}
                color={CMConstants.color.black}
              />
            </CMRipple>
          </View>

          {/* Horizontal Layout for Stats - 4 Columns */}
          <View style={styles.horizontalLayout}>
            {/* Column 1 - Made Shots */}
            <View style={styles.column}>
              <View style={styles.shotButtons}>
                <ShotButton
                  title="2PT made"
                  onPress={() =>
                    handleShotInput(
                      CMConstants.shotType.twoPoint,
                      CMConstants.shotResult.made,
                    )
                  }
                  isSelected={
                    selectedShotType === CMConstants.shotType.twoPoint &&
                    selectedShotResult === CMConstants.shotResult.made
                  }
                  color={'#2ecc71'}
                />
                <ShotButton
                  title="3PT made"
                  onPress={() =>
                    handleShotInput(
                      CMConstants.shotType.threePoint,
                      CMConstants.shotResult.made,
                    )
                  }
                  isSelected={
                    selectedShotType === CMConstants.shotType.threePoint &&
                    selectedShotResult === CMConstants.shotResult.made
                  }
                  color={'#2ecc71'}
                />
                <ShotButton
                  title="FT made"
                  onPress={() =>
                    handleShotInput(
                      CMConstants.shotType.freeThrow,
                      CMConstants.shotResult.made,
                    )
                  }
                  isSelected={
                    selectedShotType === CMConstants.shotType.freeThrow &&
                    selectedShotResult === CMConstants.shotResult.made
                  }
                  color={'#2ecc71'}
                />
              </View>
            </View>

            {/* Column 2 - Missed Shots */}
            <View style={styles.column}>
              <View style={styles.shotButtons}>
                <ShotButton
                  title="2PT miss"
                  onPress={() =>
                    handleShotInput(
                      CMConstants.shotType.twoPoint,
                      CMConstants.shotResult.missed,
                    )
                  }
                  isSelected={
                    selectedShotType === CMConstants.shotType.twoPoint &&
                    selectedShotResult === CMConstants.shotResult.missed
                  }
                />
                <ShotButton
                  title="3PT miss"
                  onPress={() =>
                    handleShotInput(
                      CMConstants.shotType.threePoint,
                      CMConstants.shotResult.missed,
                    )
                  }
                  isSelected={
                    selectedShotType === CMConstants.shotType.threePoint &&
                    selectedShotResult === CMConstants.shotResult.missed
                  }
                />
                <ShotButton
                  title="FT miss"
                  onPress={() =>
                    handleShotInput(
                      CMConstants.shotType.freeThrow,
                      CMConstants.shotResult.missed,
                    )
                  }
                  isSelected={
                    selectedShotType === CMConstants.shotType.freeThrow &&
                    selectedShotResult === CMConstants.shotResult.missed
                  }
                />
              </View>
            </View>

            {/* Column 3 - Rebounds & Fouls */}
            <View style={styles.column}>
              <View style={styles.statGrid as any}>
                <StatButton
                  title="Offensive"
                  onPress={() => handleStatInput(CMConstants.statType.rebounds)}
                  color={CMConstants.color.darkGrey}
                />
                <StatButton
                  title="Defensive"
                  onPress={() => handleStatInput(CMConstants.statType.rebounds)}
                  color={CMConstants.color.darkGrey}
                />
                <StatButton
                  title="Committed"
                  onPress={() => handleStatInput(CMConstants.statType.fouls)}
                  color={CMConstants.color.darkGrey}
                />
                <StatButton
                  title="Forced"
                  onPress={() => handleStatInput(CMConstants.statType.fouls)}
                  color={CMConstants.color.darkGrey}
                />
              </View>
            </View>

            {/* Column 4 - Other Stats */}
            <View style={styles.column}>
              <View style={styles.statGrid as any}>
                <StatButton
                  title="Assist"
                  onPress={() => handleStatInput(CMConstants.statType.assists)}
                  color={CMConstants.color.darkGrey}
                />
                <StatButton
                  title="Block"
                  onPress={() => handleStatInput(CMConstants.statType.blocks)}
                  color={CMConstants.color.darkGrey}
                />
                <StatButton
                  title="Turnover"
                  onPress={() =>
                    handleStatInput(CMConstants.statType.turnovers)
                  }
                  color={CMConstants.color.darkGrey}
                />
                <StatButton
                  title="Steal"
                  onPress={() => handleStatInput(CMConstants.statType.steals)}
                  color={CMConstants.color.darkGrey}
                />
              </View>
            </View>
          </View>
        </View>
        )}
        {/* Assist prompt */}
        {assistModalVisible && askAssist && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent as any}>
              <View style={styles.header}>
                <Text style={styles.title}>Assisted by?</Text>
                <CMRipple
                  containerStyle={styles.closeButton}
                  onPress={() => { setAssistModalVisible(false); setAskAssist(null); }}
                >
                  <Ionicons name="close" size={CMConstants.height.icon} color={CMConstants.color.black} />
                </CMRipple>
              </View>
              <View style={styles.statGrid as any}>
                {teammates.slice(0,4).map(tm => (
                  <CMRipple
                    key={tm.id}
                    containerStyle={{...styles.statButton, backgroundColor: CMConstants.color.denim}}
                    onPress={() => {
                      onStatInput(CMConstants.statType.points, { shotType: askAssist.shotType, result: CMConstants.shotResult.made, assistedBy: tm.id });
                      setAssistModalVisible(false);
                      setAskAssist(null);
                    }}
                  >
                    <Text style={styles.statButtonText}>{tm.name}</Text>
                  </CMRipple>
                ))}
                <CMRipple
                  containerStyle={{...styles.statButton, backgroundColor: CMConstants.color.darkGrey}}
                  onPress={() => {
                    onStatInput(CMConstants.statType.points, { shotType: askAssist.shotType, result: CMConstants.shotResult.made });
                    setAssistModalVisible(false);
                    setAskAssist(null);
                  }}
                >
                  <Text style={styles.statButtonText}>No assist</Text>
                </CMRipple>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = {
  modalContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: CMConstants.color.alphaModal,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  modalContent: {
    width: '90%',
    height: '70%',
    backgroundColor: CMConstants.color.white,
    borderRadius: CMConstants.radius.normal,
    padding: CMConstants.space.normal,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: CMConstants.space.normal,
    height: 50,
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
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  horizontalLayout: {
    flex: 1,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  column: {
    flex: 1,
    marginHorizontal: CMConstants.space.smallEx,
    justifyContent: 'flex-start' as const,
    alignItems: 'center' as const,
  },
  shotButtons: {
    flexDirection: 'column' as const,
    justifyContent: 'flex-start' as const,
    alignItems: 'center' as const,
  },
  shotButton: {
    width: 85,
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: CMConstants.radius.smallEx,
    marginVertical: 3,
    paddingHorizontal: 4,
  },
  shotButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
    textAlign: 'center' as const,
    lineHeight: 14,
  },
  statGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    width: '100%',
  },
  statButton: {
    width: '48%',
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: CMConstants.radius.smallEx,
    marginVertical: 3,
    paddingHorizontal: 4,
  },
  statButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
    textAlign: 'center' as const,
    lineHeight: 14,
    flexWrap: 'wrap' as const,
  },
};

export default CMStatInputModal;

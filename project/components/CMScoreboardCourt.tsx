import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions } from 'react-native';
import CMRipple from './CMRipple';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMProfileImage from './CMProfileImage';
import Ionicons from 'react-native-vector-icons/Ionicons';

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

interface CMScoreboardCourtProps {
  homeTeam: any;
  visitorTeam: any;
  homePlayers: Player[];
  visitorPlayers: Player[];
  onPlayerPress: (player: Player) => void;
  onStatInput: (statType: string, value?: number) => void;
  selectedPlayer: Player | null;
}

const CMScoreboardCourt = ({
  homeTeam,
  visitorTeam,
  homePlayers,
  visitorPlayers,
  onPlayerPress,
  onStatInput,
  selectedPlayer,
}: CMScoreboardCourtProps) => {
  const [randomSeed, setRandomSeed] = useState(0);
  const screenWidth = Dimensions.get('window').width;
  const courtWidth = screenWidth - CMConstants.space.normal * 2;
  const courtHeight = courtWidth * 1.65;
  const playerSize = 40;

  // Generate new random positions every few seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRandomSeed(prev => prev + 1);
      console.log('Player positions updated! New seed:', randomSeed + 1);
    }, 1000); // Change positions every 1 second

    return () => clearInterval(interval);
  }, [randomSeed]);

  // Manual refresh function
  const refreshPositions = () => {
    setRandomSeed(prev => prev + 1);
    console.log('Manual refresh! New seed:', randomSeed + 1);
  };

  // Position players around the court in organized columns like the image
  const getPlayerPosition = (player: Player, isHomeTeam: boolean) => {
    // Fixed positions exactly matching the sample image layout
    const positions = isHomeTeam
      ? [
          // Home team (Blue Jerseys - Left Side) - arranged in vertical column
          {
            x: courtWidth * 0.12, // Left side
            y: courtHeight * 0.05, // Top
          }, // Draymond (#23) - Top-left
          {
            x: courtWidth * 0.25, // Left side, slightly right
            y: courtHeight * 0.12, // Upper-left
          }, // Kevin (#35) - Upper-left
          {
            x: courtWidth * 0.18, // Left side, center
            y: courtHeight * 0.5, // Middle
          }, // Stephen (#30) - Mid-left
          {
            x: courtWidth * 0.12, // Left side
            y: courtHeight * 0.85, // Bottom
          }, // Zaza (#27) - Bottom-left
          {
            x: courtWidth * 0.25, // Left side, slightly right
            y: courtHeight * 0.78, // Lower-left
          }, // Klay (#11) - Lower-left
        ]
      : [
          // Visitor team (Red Jerseys - Right Side) - arranged in vertical column
          {
            x: courtWidth * 0.88, // Right side
            y: courtHeight * 0.05, // Top
          }, // Kawhi (#2) - Top-right
          {
            x: courtWidth * 0.75, // Right side, slightly left
            y: courtHeight * 0.12, // Upper-right
          }, // Pascal (#43) - Upper-right
          {
            x: courtWidth * 0.82, // Right side, center
            y: courtHeight * 0.5, // Middle
          }, // Kyle (#7) - Mid-right
          {
            x: courtWidth * 0.88, // Right side
            y: courtHeight * 0.85, // Bottom
          }, // Serge (#9) - Bottom-right
          {
            x: courtWidth * 0.75, // Right side, slightly left
            y: courtHeight * 0.78, // Lower-right
          }, // Danny (#14) - Lower-right
        ];

    // Use player number to determine position, or fallback to position string
    let index = 0;
    if (player.number) {
      // Map jersey numbers to positions (adjust based on your team rosters)
      const numberMap: { [key: number]: number } = isHomeTeam
        ? { 23: 0, 35: 1, 30: 2, 27: 3, 11: 4 } // Home team numbers
        : { 2: 0, 43: 1, 7: 2, 9: 3, 14: 4 }; // Visitor team numbers
      index = numberMap[player.number] || 0;
    } else {
      // Fallback to position-based mapping
      const positionMap: { [key: string]: number } = {
        [CMConstants.playerPosition.pointGuard]: 0,
        [CMConstants.playerPosition.shootingGuard]: 2,
        [CMConstants.playerPosition.smallForward]: 2,
        [CMConstants.playerPosition.powerForward]: 3,
        [CMConstants.playerPosition.center]: 4,
      };
      index = positionMap[player.position] || 0;
    }

    // Ensure index is within bounds
    index = Math.min(index, positions.length - 1);

    return positions[index];
  };

  const PlayerButton = ({
    player,
    isHomeTeam,
  }: {
    player: Player;
    isHomeTeam: boolean;
  }) => {
    const position = getPlayerPosition(player, isHomeTeam);
    const profileSize = 50;

    return (
      <View
        style={{
          position: 'absolute',
          left: position.x - profileSize / 2,
          top: position.y - profileSize / 2,
          zIndex: 10,
          alignItems: 'center',
        }}
      >
        <CMRipple
          containerStyle={{
            marginBottom: CMConstants.space.smallEx,
          }}
          onPress={() => onPlayerPress(player)}
        >
          <View
            style={{
              ...CMCommonStyles.circle(profileSize),
              backgroundColor: isHomeTeam
                ? CMConstants.color.denim
                : CMConstants.color.fireBrick,
              borderWidth: 3,
              borderColor: CMConstants.color.white,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: CMConstants.color.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5,
            }}
          >
            {player.avatar ? (
              <CMProfileImage
                radius={profileSize - 6}
                imgURL={player.avatar}
                style={{
                  borderWidth: 2,
                  borderColor: CMConstants.color.white,
                }}
              />
            ) : (
              <Text
                style={{
                  color: CMConstants.color.white,
                  fontSize: CMConstants.fontSize.medium,
                  fontFamily: CMConstants.font.bold,
                }}
              >
                {player.number}
              </Text>
            )}
          </View>
        </CMRipple>
        <Text
          style={{
            textAlign: 'center',
            fontSize: CMConstants.fontSize.small,
            fontFamily: CMConstants.font.semiBold,
            color: CMConstants.color.white,
            marginBottom: 2,
            maxWidth: 80,
          }}
          numberOfLines={1}
        >
          {player.name}
        </Text>
        <View
          style={{
            backgroundColor: CMConstants.color.darkGrey2,
            borderRadius: CMConstants.radius.small,
            paddingHorizontal: 6,
            paddingVertical: 3,
            marginTop: 2,
            borderWidth: 1,
            borderColor: CMConstants.color.darkGrey3,
          }}
        >
          <Text
            style={{
              fontSize: CMConstants.fontSize.smallEx,
              color: CMConstants.color.white,
              textAlign: 'center',
            }}
          >
            {player.stats.points} pts
          </Text>
          <Text
            style={{
              fontSize: CMConstants.fontSize.smallEx,
              color: CMConstants.color.semiLightGrey,
              textAlign: 'center',
            }}
          >
            {player.stats.rebounds} Rbs • {player.stats.assists} Ast
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Basketball Court Background */}
      <View style={[styles.court, { width: courtWidth, height: courtHeight }]}>
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

        {/* Center circle */}
        <View style={styles.centerCircle} />

        {/* Half court line */}
        <View style={styles.halfCourtLine} />
      </View>

      {/* Home Team Players (Left Side) */}
      {homePlayers.map((player, index) => (
        <PlayerButton key={player.id} player={player} isHomeTeam={true} />
      ))}

      {/* Visitor Team Players (Right Side) */}
      {visitorPlayers.map((player, index) => (
        <PlayerButton key={player.id} player={player} isHomeTeam={false} />
      ))}

      {/* Interactive Stat Input Elements */}
      <View style={styles.statInputs}>
        {/* Points */}
        <View style={styles.pointsSection}>
          <Text style={styles.sectionLabel}>Points</Text>
          <View style={styles.pointsButtons}>
            <CMRipple
              containerStyle={[
                styles.statButton,
                styles.pointsButton,
                { backgroundColor: CMConstants.color.fireBrick },
              ]}
              onPress={() => onStatInput('points', 1)}
            >
              <Text style={styles.statButtonText}>1</Text>
            </CMRipple>
            <CMRipple
              containerStyle={[
                styles.statButton,
                styles.pointsButton,
                { backgroundColor: CMConstants.color.fireBrick },
              ]}
              onPress={() => onStatInput('points', 2)}
            >
              <Text style={styles.statButtonText}>2</Text>
            </CMRipple>
            <CMRipple
              containerStyle={[
                styles.statButton,
                styles.pointsButton,
                { backgroundColor: CMConstants.color.fireBrick },
              ]}
              onPress={() => onStatInput('points', 3)}
            >
              <Text style={styles.statButtonText}>3</Text>
            </CMRipple>
          </View>
        </View>

        {/* Other Stats */}
        <View style={styles.otherStatsSection}>
          <View style={styles.statRow}>
            <CMRipple
              containerStyle={[
                styles.statButton,
                { backgroundColor: CMConstants.color.grey },
              ]}
              onPress={() => onStatInput('rebounds')}
            >
              <Ionicons
                name="basketball-outline"
                size={CMConstants.height.icon}
                color={CMConstants.color.white}
              />
            </CMRipple>
            <CMRipple
              containerStyle={[
                styles.statButton,
                { backgroundColor: CMConstants.color.grey },
              ]}
              onPress={() => onStatInput('assists')}
            >
              <Ionicons
                name="megaphone-outline"
                size={CMConstants.height.icon}
                color={CMConstants.color.white}
              />
            </CMRipple>
          </View>
          <View style={styles.statRow}>
            <CMRipple
              containerStyle={[
                styles.statButton,
                { backgroundColor: CMConstants.color.grey },
              ]}
              onPress={() => onStatInput('blocks')}
            >
              <Ionicons
                name="shirt-outline"
                size={CMConstants.height.icon}
                color={CMConstants.color.white}
              />
            </CMRipple>
            <CMRipple
              containerStyle={[
                styles.statButton,
                { backgroundColor: CMConstants.color.grey },
              ]}
              onPress={() => onStatInput('fouls')}
            >
              <Ionicons
                name="hand-left-outline"
                size={CMConstants.height.icon}
                color={CMConstants.color.white}
              />
            </CMRipple>
          </View>
        </View>
      </View>

      {/* Team Names */}
      <View style={styles.teamNames}>
        <Text style={[styles.teamName, { textAlign: 'left' }]}>
          {homeTeam?.name || 'Home Team'}
        </Text>
        <Text style={[styles.teamName, { textAlign: 'right' }]}>
          {visitorTeam?.name || 'Visitor Team'}
        </Text>
      </View>
    </View>
  );
};

const styles = {
  container: {
    position: 'relative',
    alignItems: 'center',
  },
  court: {
    position: 'relative',
    backgroundColor: CMConstants.color.black,
    borderRadius: CMConstants.radius.normal,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: CMConstants.color.white,
  },
  courtOutline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: CMConstants.color.white,
    borderRadius: CMConstants.radius.normal,
  },
  threePointLine: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    right: '15%',
    bottom: '15%',
    borderWidth: 1.5,
    borderColor: CMConstants.color.white,
    borderRadius: 1000,
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  keyArea: {
    position: 'absolute',
    top: '35%',
    left: '25%',
    right: '25%',
    bottom: '25%',
    backgroundColor: CMConstants.color.darkGrey2,
    borderWidth: 1.5,
    borderColor: CMConstants.color.white,
    opacity: 0.3,
  },
  freeThrowLine: {
    position: 'absolute',
    top: '40%',
    left: '20%',
    right: '20%',
    height: 1.5,
    backgroundColor: CMConstants.color.white,
    opacity: 0.6,
  },
  basket: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    width: 8,
    height: 8,
    backgroundColor: CMConstants.color.green,
    borderRadius: 4,
    marginLeft: -4,
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: CMConstants.color.white,
    borderRadius: 10,
    marginLeft: -10,
    marginTop: -10,
    opacity: 0.6,
  },
  halfCourtLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: CMConstants.color.white,
    opacity: 0.6,
  },
  statInputs: {
    position: 'absolute',
    top: '60%',
    left: '50%',
    marginLeft: -60,
    alignItems: 'center',
  },
  pointsSection: {
    alignItems: 'center',
    marginBottom: CMConstants.space.small,
  },
  sectionLabel: {
    fontSize: CMConstants.fontSize.smallEx,
    fontFamily: CMConstants.font.semiBold,
    color: CMConstants.color.black,
    marginBottom: CMConstants.space.smallEx,
  },
  pointsButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  pointsButton: {
    marginHorizontal: 2,
  },
  otherStatsSection: {
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: CMConstants.space.smallEx,
  },
  statButton: {
    ...CMCommonStyles.circle(CMConstants.height.iconBig),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: CMConstants.color.black,
  },
  statButtonText: {
    color: CMConstants.color.white,
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.bold,
  },
  teamNames: {
    position: 'absolute',
    bottom: -CMConstants.space.normal,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  teamName: {
    fontSize: CMConstants.fontSize.small,
    fontFamily: CMConstants.font.semiBold,
    color: CMConstants.color.black,
    maxWidth: '40%',
  },
};

export default CMScoreboardCourt;

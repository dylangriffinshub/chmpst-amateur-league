import React, { useState, useEffect } from 'react';
import { View, Text, ViewStyle, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMConstants from '../CMConstants';
import CMRipple from './CMRipple';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMImageView from './CMImageView';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMUtils from '../utils/CMUtils';
import CMProfileImage from './CMProfileImage';
import CMGlobal from '../CMGlobal';

const CMActivityCell = (props: any) => {
	// Use themeMode from props if provided, otherwise use CMGlobal
	const themeMode = props.themeMode || CMGlobal.themeMode || CMConstants.themeMode.light;
	const isDarkMode = themeMode === CMConstants.themeMode.dark;

	// Get screen dimensions for responsive design
	const screenWidth = Dimensions.get('window').width;
	const isSmallDevice = screenWidth < 375;
	const isLargeDevice = screenWidth > 414;
	const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;

	// Dynamic colors based on theme
	const cellBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
	const cellBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey;
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
	const categoryBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1;
	const teamNameBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1;
	const scoreBackgroundColor = isDarkMode ? CMConstants.color.black : CMConstants.color.white;

	const { activity = {} } = props

	const [teamA, setTeamA] = useState<{[name: string]: any}>({})
	const [teamB, setTeamB] = useState<{[name: string]: any}>({})
	const [topScorePlayer, setTopScorePlayer] = useState<{[name: string]: any}>()
	const [league, setLeague] = useState<{[name: string]: any}>({})

	useEffect(() => {
		// Reset state when activity changes to prevent showing wrong data
		setTeamA({})
		setTeamB({})
		setTopScorePlayer(undefined)
		setLeague({})

		if (activity.type == CMConstants.activityType.match) {
			const match = activity.data
			if (!match || !match.id) {
				return; // Don't fetch if match data is invalid
			}

			// Use the new league-scoped team fetching method to prevent data mixing
			CMFirebaseHelper.getMatchTeams(match, (response: {[name: string]: any}) => {
				if (response.isSuccess) {
					setTeamA(response.value[0] || {})
					setTeamB(response.value[1] || {})
				} else {
					console.warn('Failed to fetch match teams:', response.value);
					// Fallback to old method if new method fails
					CMFirebaseHelper.getTeams([match.teamAId, match.teamBId], (fallbackResponse: {[name: string]: any}) => {
						if (fallbackResponse.isSuccess) {
							setTeamA(fallbackResponse.value[0] || {})
							setTeamB(fallbackResponse.value[1] || {})
						}
					})
				}
			})

			if (match.topScorePlayerId) {
				CMFirebaseHelper.getPlayer(match.topScorePlayerId, (response: {[name: string]: any}) => {
					if (response.isSuccess) {
						setTopScorePlayer(response.value)
					} else {
						setTopScorePlayer(undefined)
					}
				})
			} else {
				setTopScorePlayer(undefined)
			}

			// Fetch league data to get the league logo
			if (match.leagueId) {
				CMFirebaseHelper.getLeague(match.leagueId, (response: {[name: string]: any}) => {
					if (response.isSuccess) {
						setLeague(response.value)
					} else {
						setLeague({})
					}
				})
			} else {
				setLeague({})
			}
		}
	}, [activity?.data?.id, activity?.type]) // Re-run when activity ID or type changes

	const getDisplayImage = () => {
		// If match has an image, use it
		if (activity?.data?.image) {
			return activity.data.image;
		}
		// Otherwise, use league logo as default for matches
		// Only use league avatar if it matches the current match's leagueId
		if (activity.type == CMConstants.activityType.match && 
		    league.avatar && 
		    league.id === activity?.data?.leagueId) {
			return league.avatar;
		}
		// Return null if no image available
		return null;
	};

  return (
    <CMRipple
      containerStyle={[styles.cell, { backgroundColor: cellBackgroundColor, borderColor: cellBorderColor }]}
      onPress={() => {
        console.log('CMActivityCell onPress called');
        console.log('Activity type:', activity.type);
        console.log('Activity data:', activity.data);
        if (props.onPress) {
          props.onPress();
        } else {
          console.error('onPress function is not defined in CMActivityCell!');
        }
      }}
    >{console.log('league===========================', JSON.stringify(activity?.data))}
      <CMImageView style={styles.matchImage} imgURL={getDisplayImage()} />
      <View style={styles.content}>
        <View style={styles.categoryHeader}>
          {activity.type == CMConstants.activityType.match && league.avatar && (
            <CMProfileImage 
              radius={20} 
              imgURL={league.avatar} 
              style={styles.leagueLogo}
            />
          )}
          <View style={[styles.category, { backgroundColor: categoryBackgroundColor }]}>
            <Text
              style={{ ...CMCommonStyles.textSmallEx(themeMode), color: textColor, fontSize: 11 * fontScale }}
              numberOfLines={1}
            >
              {activity.type == CMConstants.activityType.event
                ? 'Event'
                : 'League Match'}
            </Text>
          </View>
        </View>
        <Text
          style={{
            ...CMCommonStyles.title(themeMode),
            textAlign: 'center',
            marginVertical: CMConstants.space.smallEx - 2,
            color: textColor,
            fontSize: (CMConstants.fontSize.medium + 4) * fontScale,
            fontWeight: 'bold' as const,
          }}
          numberOfLines={2}
        >
          {activity?.data?.name ?? '-'}
        </Text>
        {activity.type == CMConstants.activityType.match && (
          <View style={styles.matchResult}>
            <View
              style={[styles.teamName(
                activity?.data?.teamAScore ?? 0,
                activity?.data?.teamBScore ?? 0,
              ), { backgroundColor: teamNameBackgroundColor }]}
            >
              <Text
                style={{
                  ...CMCommonStyles.label(themeMode),
                  textAlign: 'center',
                  color: textColor,
                  fontWeight: '600' as const,
                  fontSize: 12 * fontScale,
                }}
                numberOfLines={1}
              >
                {teamA?.name ?? '-'}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={[styles.score, { backgroundColor: scoreBackgroundColor }]}>
                <Text
                  style={{
                    ...CMCommonStyles.textSmall(themeMode),
                    textAlign: 'center',
                    color: CMConstants.color.green,
                    fontSize: 16 * fontScale,
                    fontWeight: '700' as const,
                    letterSpacing: 0.5,
                  }}
                  numberOfLines={1}
                >
                  {`${activity?.data?.teamAScore ?? 0} : ${
                    activity?.data?.teamBScore ?? 0
                  }`}
                </Text>
              </View>
            </View>
            <View
              style={[styles.teamName(
                activity?.data?.teamBScore ?? 0,
                activity?.data?.teamAScore ?? 0,
              ), { backgroundColor: teamNameBackgroundColor }]}
            >
              <Text
                style={{
                  ...CMCommonStyles.label(themeMode),
                  textAlign: 'center',
                  color: textColor,
                  fontWeight: '600' as const,
                  fontSize: 12 * fontScale,
                }}
                numberOfLines={1}
              >
                {teamB?.name ?? '-'}
              </Text>
            </View>
          </View>
        )}
        {topScorePlayer && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: CMConstants.space.smallEx - 2,
            }}
          >
            <CMProfileImage radius={14} imgURL={topScorePlayer.avatar} />
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: CMConstants.space.smallEx,
              }}
            >
              <Text
                style={{...CMCommonStyles.textSmallBold(themeMode), color: textColor, fontSize: 10 * fontScale}}
                numberOfLines={1}
              >
                <Text style={{ fontWeight: '700', color: textColor }}>
                  {topScorePlayer.name}
                </Text>
                <Text style={{ fontSize: 9 * fontScale, color: CMConstants.color.green, fontWeight: '600' }}>
                  {' '}{activity?.data?.topScore ?? 0} pts
                </Text>
              </Text>
            </View>
          </View>
        )}
        <View style={styles.properties}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <Ionicons
                name={'time-outline'}
                size={CMConstants.height.icon * 0.75}
                color={CMConstants.color.green}
              />
              <Text
                style={{
                  ...CMCommonStyles.textSmall(themeMode),
                  marginLeft: 4,
                  color: textColor,
                  fontSize: 11 * fontScale,
                }}
                numberOfLines={1}
              >
                {activity?.data?.dateTime
                  ? CMUtils.strTimeFromDate(activity.data.dateTime.toDate())
                      : '-/-/-'}
              </Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <Ionicons
                name={'calendar-outline'}
                size={CMConstants.height.icon * 0.75}
                color={CMConstants.color.green}
              />
              <Text
                style={{
                  ...CMCommonStyles.textSmall(themeMode),
                  marginLeft: 4,
                  color: textColor,
                  fontSize: 11 * fontScale,
                }}
                numberOfLines={1}
              >
                {activity?.data?.dateTime
                  ? CMUtils.strDateFromDate(activity?.data?.dateTime?.toDate())
                      : '-/-/-'}
              </Text>
            </View>
          </View>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: CMConstants.space.smallEx - 2,
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <Ionicons
                name={'location-outline'}
                size={CMConstants.height.icon * 0.75}
                color={CMConstants.color.green}
              />
              <Text
                style={{
                  ...CMCommonStyles.textSmall(themeMode),
                  marginLeft: 4,
                  color: textColor,
                  fontSize: 11 * fontScale,
                }}
                numberOfLines={1}
              >
                {activity?.data?.location ?? '-'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </CMRipple>
  );
};

const styles = {
  cell: {
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1,
    overflow: 'hidden' as const,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: CMConstants.space.smallEx - 2,
  },
  matchImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover' as const,
  },
  content: {
    flex: 1,
    marginHorizontal: CMConstants.space.smallEx,
    marginBottom: CMConstants.space.smallEx,
    marginTop: CMConstants.space.smallEx - 2,
  },
  categoryHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: CMConstants.space.smallEx - 2,
  } as ViewStyle,
  category: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start' as const,
    alignItems: 'center' as const,
  } as ViewStyle,
  leagueLogo: {
    marginRight: 6,
  } as ViewStyle,
  matchResult: {
    flex: 1,
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    marginVertical: CMConstants.space.smallEx - 2,
  } as ViewStyle,
  teamName: (teamAScore: number, teamBScore: number): ViewStyle => ({
    flex: 1,
    padding: CMConstants.space.smallEx - 2,
    borderRadius: CMConstants.radius.normal,
  }),
  score: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CMConstants.radius.normal,
    borderWidth: 1.5,
    borderColor: CMConstants.color.green,
  },
  properties: {
    flex: 1,
    marginTop: CMConstants.space.smallEx - 2,
  } as ViewStyle,
};

export default CMActivityCell;

import React, { useState, useEffect } from 'react';
import { View, Text, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMConstants from '../CMConstants';
import CMRipple from './CMRipple';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMImageView from './CMImageView';
import CMUtils from '../utils/CMUtils';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';

const CMMatchThumbCell = (props: any) => {
  const themeMode = CMConstants.themeMode.light;

  const { match = {}, onPress } = props;

  const [teamA, setTeamA] = useState<{ [name: string]: any }>({});
  const [teamB, setTeamB] = useState<{ [name: string]: any }>({});

  useEffect(() => {
    CMFirebaseHelper.getTeams(
      [match.teamAId, match.teamBId],
      (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          setTeamA(response.value[0]);
          setTeamB(response.value[1]);
        }
      },
    );
  }, []);

  return (
    <CMRipple
      containerStyle={styles.cell}
      onPress={() => {
        console.log('CMMatchThumbCell onPress called');
        console.log('props.onPress:', props.onPress);
        if (props.onPress) {
          props.onPress();
        } else {
          console.error('onPress function is not defined!');
        }
      }}
    >
      <CMImageView style={styles.matchImage} imgURL={match.image} />
      <View style={styles.content}>
        <Text
          style={{
            ...CMCommonStyles.label(themeMode),
            textAlign: 'center',
            marginVertical: CMConstants.space.smallEx,
          }}
          numberOfLines={2}
        >
          {match.name}
        </Text>
        <View style={styles.matchResult}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...CMCommonStyles.textSmall(themeMode),
                textAlign: 'center',
              }}
            >
              {teamA.name ?? '-'}
            </Text>
          </View>
          <Text
            style={{
              ...CMCommonStyles.textSmallBold(themeMode),
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {' '}
            vs{' '}
          </Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...CMCommonStyles.textSmall(themeMode),
                textAlign: 'center',
              }}
            >
              {teamB.name ?? '-'}
            </Text>
          </View>
        </View>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row' }}>
              <Ionicons
                name={'time-outline'}
                size={CMConstants.height.icon}
                color={CMConstants.color.black}
              />
              <Text
                style={{
                  ...CMCommonStyles.textSmall(themeMode),
                  marginLeft: 4,
                }}
                numberOfLines={1}
              >
                {match.dateTime
                  ? CMUtils.strUpcomingDateFromDate(match.dateTime.toDate())
                  : '-:--'}
              </Text>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: CMConstants.space.smallEx,
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              <Ionicons
                name={'location-outline'}
                size={CMConstants.height.icon}
                color={CMConstants.color.black}
              />
              <Text
                style={{
                  ...CMCommonStyles.textSmall(themeMode),
                  marginLeft: 4,
                }}
                numberOfLines={1}
              >
                {match.location ?? '-'}
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
    width: 220,
    backgroundColor: CMConstants.color.lightGrey2,
    borderWidth: 1,
    borderRadius: CMConstants.radius.normal,
    borderColor: CMConstants.color.lightGrey,
    overflow: 'hidden',
  },
  matchImage: {
    width: '100%',
    height: 140,
  },
  content: {
    marginHorizontal: CMConstants.space.smallEx,
    marginBottom: CMConstants.space.small,
  },
  matchResult: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: CMConstants.space.smallEx,
  } as ViewStyle,
};

export default CMMatchThumbCell;

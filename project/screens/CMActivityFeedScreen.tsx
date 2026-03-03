import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TextInput,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMGlobal from '../CMGlobal';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMActivityCell from '../components/CMActivityCell';
import CMRipple from '../components/CMRipple';
import CMUtils from '../utils/CMUtils';

const CMActivityFeedScreen = ({ navigation, route }: CMNavigationProps) => {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [activities, setActivities] = useState<{ [name: string]: any }[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<
    { [name: string]: any }[]
  >([]);

  const themeMode = CMConstants.themeMode.light;

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadActivities();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    filterActivities();
  }, [searchText, activities, isSearching]);

  const filterActivities = () => {
    if (isSearching) {
      const word = searchText.toLowerCase();
      if (word.trim().length == 0) {
        setFilteredActivities(activities);
      } else {
        setFilteredActivities(
          activities.filter((item: { [name: string]: any }) => {
            return (
              item.data.name.toLowerCase().includes(word) ||
              item.data.location.toLowerCase().includes(word)
            );
          }),
        );
      }
    } else {
      setFilteredActivities(activities);
    }
  };

  const sortAndSetActivities = (activities: { [name: string]: any }[]) => {
    activities.sort(
      (item1: { [name: string]: any }, item2: { [name: string]: any }) => {
        return item1.data.dateTime.toDate() > item2.data.dateTime.toDate()
          ? -1
          : 1;
      },
    );
    setActivities(activities);
  };

  const loadActivities = () => {
    let activities: { [name: string]: any }[] = [];
    const loadMatches = () => {
      CMFirebaseHelper.getLeagues(
        (response: { [name: string]: any }) => {
          if (response.isSuccess) {
            let leagueIds = response.value.map(
              (league: { [name: string]: any }) => league.id,
            );
            CMFirebaseHelper.getMatchesOfLeagues(
              leagueIds,
              (response: { [name: string]: any }) => {
                setRefreshing(false);
                if (response.isSuccess) {
                  console.log('Matches loaded from leagues:', response.value);
                  response.value.forEach((item: { [name: string]: any }) => {
                    console.log('Processing match item:', item);
                    console.log('Match has teamAId:', !!item.teamAId);
                    console.log('Match has teamBId:', !!item.teamBId);
                    activities.push({
                      type: CMConstants.activityType.match,
                      data: item,
                    });
                  });
                } else {
                  console.log('Failed to load matches from leagues');
                }
                sortAndSetActivities(activities);
              },
            );
          } else {
            setRefreshing(false);
            sortAndSetActivities(activities);
          }
        },
      );
    };

    if (CMGlobal.user.teamId) {
      setRefreshing(true);
      CMFirebaseHelper.getEvents(
        CMGlobal.user.teamId,
        (response: { [name: string]: any }) => {
          if (response.isSuccess) {
            console.log('Events loaded:', response.value);
            response.value.forEach((item: { [name: string]: any }) => {
              console.log('Processing event item:', item);
              console.log('Event has teamAId:', !!item.teamAId);
              console.log('Event has teamBId:', !!item.teamBId);
              activities.push({
                type: CMConstants.activityType.event,
                data: item,
              });
            });
          } else {
            console.log('Failed to load events');
          }
          loadMatches();
        },
      );
    }
  };

  return (
    <SafeAreaView style={CMCommonStyles.bodyMain(themeMode)}>
      <View style={{ flex: 1, marginHorizontal: CMConstants.space.normal }}>
        <View
          style={{
            height: CMConstants.height.navBar,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            marginTop: CMUtils.isAndroid ? insets.top : 0,
          }}
        >
          {!isSearching ? (
            <>
              <Text style={CMCommonStyles.title(themeMode)}>Activity Feed</Text>
              <CMRipple
                containerStyle={{
                  ...CMCommonStyles.circle(CMConstants.height.iconBig),
                  position: 'absolute',
                  justifyContent: 'center',
                  alignItems: 'center',
                  right: 0,
                }}
                onPress={() => {
                  setIsSearching(true);
                }}
              >
                <Ionicons
                  name={'search-outline'}
                  size={CMConstants.height.icon}
                  color={CMConstants.color.black}
                />
              </CMRipple>
            </>
          ) : (
            <>
              <TextInput
                style={{
                  ...CMCommonStyles.textInput(themeMode),
                  borderRadius: CMConstants.height.textInput / 2,
                  paddingHorizontal: CMConstants.space.small,
                  flex: 1,
                }}
                defaultValue={searchText}
                onChangeText={text => setSearchText(text)}
                placeholder="Search"
                placeholderTextColor={CMConstants.color.grey}
                keyboardType="default"
                onSubmitEditing={Keyboard.dismiss}
                blurOnSubmit={false}
                underlineColorAndroid="#f000"
                returnKeyType="done"
              />
              <CMRipple
                containerStyle={{
                  ...CMCommonStyles.circle(CMConstants.height.iconBig),
                  position: 'absolute',
                  justifyContent: 'center',
                  alignItems: 'center',
                  right: CMConstants.space.smallEx,
                }}
                onPress={() => {
                  setIsSearching(false);
                }}
              >
                <Ionicons
                  name={'close-circle-outline'}
                  size={CMConstants.height.icon}
                  color={CMConstants.color.black}
                />
              </CMRipple>
            </>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <FlatList
            style={{ flex: 0, marginBottom: insets.bottom }}
            refreshing={refreshing}
            onRefresh={() => loadActivities()}
            initialNumToRender={filteredActivities.length}
            data={filteredActivities}
            renderItem={({ item, separators }) => {
              console.log('Rendering activity item:', item);
              console.log('Item type:', item.type);
              console.log('Item data keys:', Object.keys(item.data));
              console.log('Item data:', item.data);

              return (
                <CMActivityCell
                  activity={item}
                  onPress={() => {
                    console.log('Activity pressed:', item);
                    console.log(item.data);
                    // Check if this looks like a match (has teamAId and teamBId)
                    const hasMatchStructure =
                      item.data.teamAId && item.data.teamBId;

                    if (
                      item.type === CMConstants.activityType.match ||
                      hasMatchStructure
                    ) {
                      console.log(
                        'Navigating to scoreboard for match:',
                        item.data,
                      );
                      // All users can access scoreboard - subscription removed
                      navigation.navigate(CMConstants.screenName.scoreboard, {
                        match: item.data,
                      });
                    } else if (item.type === CMConstants.activityType.event) {
                      console.log(
                        "Event pressed - checking if it's actually a match...",
                      );

                      // If it's an event but has match structure, treat it as a match
                      if (hasMatchStructure) {
                        console.log(
                          'Event has match structure, navigating to scoreboard',
                        );
                        // All users can access scoreboard - subscription removed
                        navigation.navigate(CMConstants.screenName.scoreboard, {
                          match: item.data,
                        });
                      } else {
                        console.log(
                          'Event pressed - no navigation implemented yet',
                        );
                        // TODO: Implement event navigation
                      }
                    }
                  }}
                />
              );
            }}
            ItemSeparatorComponent={({ highlighted }) => (
              <View style={{ height: CMConstants.space.smallEx }} />
            )}
          />
        </View>

        <CMRipple
          containerStyle={{
            ...CMCommonStyles.circle(60),
            position: 'absolute',
            justifyContent: 'center',
            alignItems: 'center',
            right: CMConstants.space.smallEx,
            bottom: CMConstants.space.normal,
            backgroundColor: CMConstants.color.grey,
          }}
          onPress={() => {
            navigation.navigate(CMConstants.screenName.editEvent, {
              event: {},
              callback: () => {
                loadActivities();
              },
            });
          }}
        >
          <Ionicons
            name={'add-outline'}
            size={CMConstants.height.iconBigEx}
            color={CMConstants.color.white}
          />
        </CMRipple>
      </View>
    </SafeAreaView>
  );
};

const styles = {};

export default CMActivityFeedScreen;

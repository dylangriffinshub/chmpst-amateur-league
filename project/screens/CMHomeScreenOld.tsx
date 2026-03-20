import React, { useState, useEffect, createRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  ScrollView,
  Image,
  TextInput,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMUtils from '../utils/CMUtils';
import CMRipple from '../components/CMRipple';
import CMGlobal from '../CMGlobal';
import CMFirebaseHelper from '../helper/CMFirebaseHelper';
import CMEventThumbCell from '../components/CMEventThumbCell';
import CMMatchThumbCell from '../components/CMMatchThumbCell';

const CMHomeScreen = ({ navigation, route }: CMNavigationProps) => {
  const themeMode = CMConstants.themeMode.light;
  const insets = useSafeAreaInsets();

  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [events, setEvents] = useState<{ [name: string]: any }[]>([]);
  const [matches, setMatches] = useState<{ [name: string]: any }[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<
    { [name: string]: any }[]
  >([]);
  const [filteredMatches, setFilteredMatches] = useState<
    { [name: string]: any }[]
  >([]);

  useEffect(() => {
    loadEvents();
    loadMatches();
  }, []);

  useEffect(() => {
    filterEvents();
    filterMatches();
  }, [searchText, isSearching]);

  useEffect(() => {
    filterEvents();
  }, [events]);

  useEffect(() => {
    filterMatches();
  }, [matches]);

  const filterEvents = () => {
    if (isSearching) {
      const word = searchText.toLowerCase();
      if (word.trim().length == 0) {
        setFilteredEvents(events);
      } else {
        setFilteredEvents(
          events.filter((item: { [name: string]: any }) => {
            return (
              item.name.toLowerCase().includes(word) ||
              item.location.toLowerCase().includes(word)
            );
          }),
        );
      }
    } else {
      setFilteredEvents(events);
    }
  };

  const filterMatches = () => {
    if (isSearching) {
      const word = searchText.toLowerCase();
      if (word.trim().length == 0) {
        setFilteredMatches(matches);
      } else {
        setFilteredMatches(
          matches.filter((item: { [name: string]: any }) => {
            return (
              item.name.toLowerCase().includes(word) ||
              item.location.toLowerCase().includes(word)
            );
          }),
        );
      }
    } else {
      setFilteredMatches(matches);
    }
  };

  const loadEvents = () => {
    if (CMGlobal.user.teamId) {
      CMFirebaseHelper.getUpcomingEvents(
        CMGlobal.user.teamId,
        (response: { [name: string]: any }) => {
          if (response.isSuccess) {
            response.value.sort(
              (
                item1: { [name: string]: any },
                item2: { [name: string]: any },
              ) => {
                return item1.dateTime.toDate() > item2.dateTime.toDate()
                  ? -1
                  : 1;
              },
            );
            setEvents(response.value);
          }
        },
      );
    }
  };

  const loadMatches = () => {
      CMFirebaseHelper.getLeagues(
        (response: { [name: string]: any }) => {
          if (response.isSuccess) {
            let leagueIds = response.value.map(
              (league: { [name: string]: any }) => league.id,
            );
            CMFirebaseHelper.getUpcomingMatchesOfLeagues(
              leagueIds,
              (response: { [name: string]: any }) => {
                if (response.isSuccess) {
                  response.value.sort(
                    (
                      item1: { [name: string]: any },
                      item2: { [name: string]: any },
                    ) => {
                      return item1.data.dateTime.toDate() >
                        item2.data.dateTime.toDate()
                        ? -1
                        : 1;
                    },
                  );
                  setMatches(response.value);
                }
              },
            );
          }
        },
      );
    
  };

  return (
    <SafeAreaView style={CMCommonStyles.bodyMain(themeMode)}>
      <View
        style={{
          height: CMConstants.height.navBar,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          marginTop: CMUtils.isAndroid ? insets.top : 0,
          marginHorizontal: CMConstants.space.normal,
        }}
      >
        {!isSearching ? (
          <>
            <Image
              style={{
                width: '100%',
                height: 50,
              }}
              source={require('../../assets/images/logo.png')}
              resizeMode="contain"
            />
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
      <ScrollView
        style={{ flex: 1, marginHorizontal: CMConstants.space.normal }}
      >
        <View style={{ paddingBottom: CMConstants.space.smallEx }}>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              marginTop: CMConstants.space.small,
            }}
          >
            <Text style={CMCommonStyles.label(themeMode)}>Upcoming Events</Text>
            <CMRipple
              containerStyle={{
                ...CMCommonStyles.circle(CMConstants.height.iconBig),
                position: 'absolute',
                justifyContent: 'center',
                alignItems: 'center',
                right: 0,
              }}
              onPress={() => {
                navigation.navigate('Activity Feed');
              }}
            >
              <Ionicons
                name={'arrow-forward-outline'}
                size={CMConstants.height.icon}
                color={CMConstants.color.black}
              />
            </CMRipple>
          </View>
          {filteredEvents.length > 0 ? (
            <FlatList
              style={styles.upcomingEvents}
              initialNumToRender={events.length}
              horizontal={true}
              data={filteredEvents}
              renderItem={({ item, separators }) => (
                <CMEventThumbCell event={item} onPress={() => {}} />
              )}
              ItemSeparatorComponent={({ highlighted }) => (
                <View style={{ width: CMConstants.space.smallEx }} />
              )}
            />
          ) : (
            <Text
              style={{
                ...CMCommonStyles.textSmall(themeMode),
                marginTop: CMConstants.space.small,
              }}
            >
              It looks like there are no upcoming events for your team at the
              moment. Stay tuned!
            </Text>
          )}
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              marginTop: CMConstants.space.normal,
            }}
          >
            <Text style={CMCommonStyles.label(themeMode)}>
              Upcoming Matches
            </Text>
            <CMRipple
              containerStyle={{
                ...CMCommonStyles.circle(CMConstants.height.iconBig),
                position: 'absolute',
                justifyContent: 'center',
                alignItems: 'center',
                right: 0,
              }}
              onPress={() => {
                navigation.navigate('Activity Feed');
              }}
            >
              <Ionicons
                name={'arrow-forward-outline'}
                size={CMConstants.height.icon}
                color={CMConstants.color.black}
              />
            </CMRipple>
          </View>
          {filteredMatches.length > 0 ? (
            <FlatList
              style={styles.upcomingEvents}
              initialNumToRender={matches.length}
              horizontal={true}
              data={filteredMatches}
              renderItem={({ item, separators }) => {
                console.log('Rendering match item:', item);
                return (
                  <CMMatchThumbCell
                    match={item}
                    onPress={() => {
                      console.log('Match pressed:', item);
                      console.log('Navigating to scoreboard with match:', item);
                      // All users can access scoreboard - subscription removed
                      try {
                        navigation.navigate(CMConstants.screenName.scoreboard, {
                          match: item,
                        });
                        console.log('Navigation successful');
                      } catch (error) {
                        console.error('Navigation error:', error);
                      }
                    }}
                  />
                );
              }}
              ItemSeparatorComponent={({ highlighted }) => (
                <View style={{ width: CMConstants.space.smallEx }} />
              )}
            />
          ) : (
            <Text
              style={{
                ...CMCommonStyles.textSmall(themeMode),
                marginTop: CMConstants.space.small,
              }}
            >
              It looks like there are no upcoming matches for your team at the
              moment. Stay tuned!
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = {
  upcomingEvents: {
    flexGrow: 0,
    marginTop: CMConstants.space.smallEx,
  },
};

export default CMHomeScreen;

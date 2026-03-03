import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TextInput,
  Keyboard,
  Alert,
  ActivityIndicator,
  Dimensions,
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
import CMLoadingDialog from '../dialog/CMLoadingDialog';
import CMPermissionHelper from '../helper/CMPermissionHelper';
import { getAuth } from '@react-native-firebase/auth';
import CMHamburgerMenu from '../components/CMHamburgerMenu';

interface CMGenericFeedScreenProps extends CMNavigationProps {
  // Customizable properties
  title?: string;
  dataSource?: 'activities' | 'matches' | 'events' | 'custom';
  searchFields?: string[];
  onItemPress?: (item: any) => void;
  renderItem?: (item: any) => React.ReactElement;
  loadData?: () => Promise<any[]>;
  showAddButton?: boolean;
  addButtonAction?: () => void;
}

const CMGenericFeedScreen = ({ 
  navigation, 
  route,
  title = 'Matches',
  dataSource = 'matches',
  searchFields = ['name', 'location'],
  onItemPress,
  renderItem,
  loadData,
  showAddButton = true,
  addButtonAction
}: CMGenericFeedScreenProps) => {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [items, setItems] = useState<{ [name: string]: any }[]>([]);
  const [filteredItems, setFilteredItems] = useState<{ [name: string]: any }[]>([]);
  const [matchPermissions, setMatchPermissions] = useState<{ [matchId: string]: boolean }>({});

  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light);
  const isDarkMode = themeMode === CMConstants.themeMode.dark;

  // Get screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const isSmallDevice = screenWidth < 375;
  const isLargeDevice = screenWidth > 414;
  const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0;

  // Listen for theme changes
  useEffect(() => {
    // Check theme on mount
    setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
    
    // Poll for theme changes (check every 200ms)
    const interval = setInterval(() => {
      const currentTheme = CMGlobal.themeMode || CMConstants.themeMode.light;
      if (currentTheme !== themeMode) {
        setThemeMode(currentTheme);
      }
    }, 200);
    
    // Also listen for navigation focus as fallback
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
    });
    
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [navigation, themeMode]);

  // Dynamic colors based on theme
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white;
  const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;
  const closeButtonBackground = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1;
  const closeButtonIconColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;

  // Get props from route params if available
  const routeTitle = route?.params?.title || title;
  const routeDataSource = route?.params?.dataSource || dataSource;
  const routeSearchFields = route?.params?.searchFields || searchFields;
  const routeOnItemPress = route?.params?.onItemPress || onItemPress;
  const routeRenderItem = route?.params?.renderItem || renderItem;
  const routeLoadData = route?.params?.loadData || loadData;
  const routeShowAddButton = route?.params?.showAddButton !== undefined ? route?.params?.showAddButton : showAddButton;
  const routeAddButtonAction = route?.params?.addButtonAction || addButtonAction;
  

  useEffect(() => {
    // Ensure user data is loaded when screen focuses
    const currentUser = getAuth().currentUser;
    if (currentUser && (!CMGlobal.user || !CMGlobal.user.id)) {
      CMFirebaseHelper.getUser(currentUser.uid, (response: {[name: string]: any}) => {
        if (response.isSuccess) {
          CMGlobal.user = response.value;
          console.log('User loaded on screen focus:', CMGlobal.user);
        }
      });
    }

    // Load items on initial mount
    loadItems();
    
    // Also load when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      // Refresh user data on focus
      if (currentUser && (!CMGlobal.user || !CMGlobal.user.id)) {
        CMFirebaseHelper.getUser(currentUser.uid, (response: {[name: string]: any}) => {
          if (response.isSuccess) {
            CMGlobal.user = response.value;
            console.log('User refreshed on focus:', CMGlobal.user);
          }
        });
      }
      loadItems();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    filterItems();
  }, [searchText, items, isSearching]);

  const filterItems = () => {
    if (isSearching) {
      const word = searchText.toLowerCase();
      if (word.trim().length == 0) {
        setFilteredItems(items);
      } else {
        setFilteredItems(
          items.filter((item: { [name: string]: any }) => {
            return routeSearchFields.some((field: string) => {
              const fieldValue = item.data?.[field] || item[field];
              return fieldValue?.toLowerCase().includes(word);
            });
          }),
        );
      }
    } else {
      setFilteredItems(items);
    }
  };

  const sortAndSetItems = (items: { [name: string]: any }[]) => {
    items.sort(
      (item1: { [name: string]: any }, item2: { [name: string]: any }) => {
        const date1 = item1.data?.dateTime?.toDate?.() || item1.dateTime?.toDate?.() || new Date(0);
        const date2 = item2.data?.dateTime?.toDate?.() || item2.dateTime?.toDate?.() || new Date(0);
        return date1 > date2 ? -1 : 1;
      },
    );
    setItems(items);
  };

  const loadItems = async () => {
    if (routeLoadData) {
      // Use custom data loader
      setRefreshing(true);
      if (!refreshing) {
        setLoading(true);
      }
      try {
        const data = await routeLoadData();
        sortAndSetItems(data);
      } catch (error) {
        console.error('Error loading custom data:', error);
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
      return;
    }

    // Default data loading based on dataSource
    let items: { [name: string]: any }[] = [];
    
    // Show loading dialog for initial load (not for refresh)
    if (!refreshing) {
      setLoading(true);
    }
    
    switch (routeDataSource) {
      case 'activities':
        await loadActivities(items);
        break;
      case 'matches':
        await loadMatches(items);
        break;
      case 'events':
        await loadEvents(items);
        break;
      default:
        console.log('Unknown data source:', routeDataSource);
        setRefreshing(false);
        setLoading(false);
    }
  };

  const loadActivities = async (items: { [name: string]: any }[]) => {
    const loadMatches = async () => {
      CMFirebaseHelper.getLeagues(
        async (response: { [name: string]: any }) => {
          if (response.isSuccess) {
            let leagueIds = response.value.map(
              (league: { [name: string]: any }) => league.id,
            );
            CMFirebaseHelper.getMatchesOfLeagues(
              leagueIds,
              async (response: { [name: string]: any }) => {
                setRefreshing(false);
                setLoading(false);
                if (response.isSuccess) {
                  response.value.forEach((item: { [name: string]: any }) => {
                    items.push({
                      type: CMConstants.activityType.match,
                      data: item,
                    });
                  });
                  
                  // Check permissions for all matches
                  const permissions: { [matchId: string]: boolean } = {};
                  for (const match of response.value) {
                    if (match.id) {
                      permissions[match.id] = await CMPermissionHelper.canEditMatch(match.id, match);
                    }
                  }
                  setMatchPermissions(prev => ({ ...prev, ...permissions }));
                }
                sortAndSetItems(items);
              },
            );
          } else {
            setRefreshing(false);
            setLoading(false);
            sortAndSetItems(items);
          }
        },
      );
    };

    setRefreshing(true);
    CMFirebaseHelper.getEvents(
      (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          response.value.forEach((item: { [name: string]: any }) => {
            items.push({
              type: CMConstants.activityType.event,
              data: item,
            });
          });
        }
        loadMatches();
      },
    );
  };

  const loadMatches = async (items: { [name: string]: any }[]) => {
    setRefreshing(true);
    // Keep loading true until all data is loaded and processed
    setLoading(true);
    
    CMFirebaseHelper.getLeagues(
      async (response: { [name: string]: any }) => {
        if (response.isSuccess) {
          let leagueIds = response.value.map(
            (league: { [name: string]: any }) => league.id,
          );
          
          // Create a map of leagueId -> league for quick lookup
          const leagueMap: { [leagueId: string]: { [name: string]: any } } = {};
          response.value.forEach((league: { [name: string]: any }) => {
            leagueMap[league.id] = league;
          });
          
          CMFirebaseHelper.getMatchesOfLeagues(
            leagueIds,
            async (response: { [name: string]: any }) => {
              if (response.isSuccess) {
                response.value.forEach((item: { [name: string]: any }) => {
                  items.push({
                    type: CMConstants.activityType.match,
                    data: item,
                  });
                });
                
                // Show matches immediately (don't wait for permissions)
                sortAndSetItems(items);
                setRefreshing(false);
                setLoading(false);
                
                // Check permissions in parallel (background) - much faster
                // Use pre-fetched league data to avoid Firebase queries
                const currentUserId = CMGlobal.user?.id || getAuth().currentUser?.uid;
                const isAdmin = CMGlobal.user?.role === 'admin';
                
                // If admin, all matches are editable - no need to check
                if (isAdmin) {
                  const permissions: { [matchId: string]: boolean } = {};
                  response.value.forEach((match: { [name: string]: any }) => {
                    if (match.id) {
                      permissions[match.id] = true;
                    }
                  });
                  setMatchPermissions(permissions);
                  return;
                }
                
                // For non-admins, check permissions synchronously using pre-fetched league data
                // This is much faster than async Firebase queries
                const permissions: { [matchId: string]: boolean } = {};
                response.value.forEach((match: { [name: string]: any }) => {
                  if (!match.id || !match.leagueId) return;
                  
                  // Use the pre-fetched league data to check if user is admin
                  const league = leagueMap[match.leagueId];
                  if (league && currentUserId && league.adminId === currentUserId) {
                    permissions[match.id] = true;
                  } else {
                    permissions[match.id] = false;
                  }
                });
                setMatchPermissions(permissions);
              } else {
                sortAndSetItems(items);
                setRefreshing(false);
                setLoading(false);
              }
            },
          );
        } else {
          sortAndSetItems(items);
          setRefreshing(false);
          setLoading(false);
        }
      },
    );
  };

  const loadEvents = async (items: { [name: string]: any }[]) => {
    setRefreshing(true);
    CMFirebaseHelper.getEvents(
      (response: { [name: string]: any }) => {
        setRefreshing(false);
        setLoading(false);
        if (response.isSuccess) {
          response.value.forEach((item: { [name: string]: any }) => {
            items.push({
              type: CMConstants.activityType.event,
              data: item,
            });
          });
        }
        sortAndSetItems(items);
      },
    );
  };

  const handleItemPress = (item: any) => {
    if (routeOnItemPress) {
      routeOnItemPress(item);
    } else {
      // Default behavior similar to CMActivityFeedScreen
      console.log('Activity pressed:', item);
      console.log(item.data);
      
      // Check if this looks like a match (has teamAId and teamBId)
      const hasMatchStructure = item.data.teamAId && item.data.teamBId;

      if (
        item.type === CMConstants.activityType.match ||
        hasMatchStructure
      ) {
        console.log('Navigating to scoreboard for match:', item.data);
        // All users can access scoreboard - subscription removed
        navigation.navigate(CMConstants.screenName.scoreboard, {
          match: item.data,
        });
      } else if (item.type === CMConstants.activityType.event) {
        console.log("Event pressed - checking if it's actually a match...");

        // If it's an event but has match structure, treat it as a match
        if (hasMatchStructure) {
          console.log('Event has match structure, navigating to scoreboard');
          // All users can access scoreboard - subscription removed
          navigation.navigate(CMConstants.screenName.scoreboard, {
            match: item.data,
          });
        } else {
          console.log('Event pressed - no navigation implemented yet');
          // TODO: Implement event navigation
        }
      }
    }
  };

  const handleAddButtonPress = () => {
    if (routeAddButtonAction) {
      routeAddButtonAction();
    } else {
      // Default behavior - navigate to create match for matches feed
      if (routeDataSource === 'matches') {
        navigation.navigate(CMConstants.screenName.editMatch, {
          match: {},
          isEdit: false, // Create new match
          callback: () => {
            loadItems();
          },
        });
      } else {
        // Fallback to edit event for other data sources
        navigation.navigate(CMConstants.screenName.editEvent, {
          event: {},
          callback: () => {
            loadItems();
          },
        });
      }
    }
  };

  const handleEditMatch = (item: any) => {
    navigation.navigate(CMConstants.screenName.editMatch, {
      match: item.data,
      isEdit: true,
      callback: () => {
        loadItems();
      },
    });
  };

  const handleDeleteMatch = (item: any) => {
    const matchName = item.data?.name || 'this match';
    
    Alert.alert(
      'Delete Match',
      `Are you sure you want to delete "${matchName}"? This will permanently delete the match and ALL associated data. This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMatch(item);
          },
        },
      ]
    );
  };

  const deleteMatch = (item: any) => {
    const matchId = item.data?.id;
    
    if (!matchId) {
      Alert.alert('Error', 'Match ID not found');
      return;
    }

    setRefreshing(true);
    
    CMFirebaseHelper.deleteMatchWithAssociatedData(
      matchId,
      (response: { [name: string]: any }) => {
        setRefreshing(false);
        
        if (response.isSuccess) {
          Alert.alert('Success', 'Match and all associated data deleted successfully!', [
            {
              text: 'OK',
              onPress: () => {
                // Remove the deleted item from the local state
                const updatedItems = items.filter((matchItem: any) => matchItem.data.id !== matchId);
                setItems(updatedItems);
                setFilteredItems(updatedItems);
              },
            },
          ]);
        } else {
          Alert.alert('Error', response.value || 'Failed to delete match and associated data');
        }
      }
    );
  };

  const renderDefaultItem = ({ item }: { item: any }) => {
    if (routeRenderItem) {
      return routeRenderItem(item);
    }

    // Use CMActivityCell with edit/delete actions for matches
    if (routeDataSource === 'matches') {
      const matchId = item.data?.id || item.id;
      const canEdit = matchPermissions[matchId] ?? false;
      // Show edit/delete buttons if user is admin or has edit permission
      const isAdmin = CMGlobal.user?.role === 'admin';
      const showActions = isAdmin || canEdit;
      
      return (
        <View style={styles.matchItemContainer}>
          <CMActivityCell
            activity={item}
            themeMode={themeMode}
            onPress={() => handleItemPress(item)}
          />
          {showActions && (
            <View style={[styles.actionButtons, { backgroundColor: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1 }]}>
              <CMRipple
                containerStyle={[styles.actionButton, { backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white }]}
                onPress={() => handleEditMatch(item)}
                color={CMConstants.color.green}
              >
                <Ionicons
                  name={'create-outline'}
                  size={14}
                  color={CMConstants.color.green}
                />
              </CMRipple>
              <CMRipple
                containerStyle={[styles.actionButton, styles.deleteButton, { backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white }]}
                onPress={() => handleDeleteMatch(item)}
                color={CMConstants.color.red}
              >
                <Ionicons
                  name={'trash-outline'}
                  size={14}
                  color={CMConstants.color.red}
                />
              </CMRipple>
            </View>
          )}
        </View>
      );
    }

    // Default CMActivityCell for other data sources
    return (
      <CMActivityCell
        activity={item}
        themeMode={themeMode}
        onPress={() => handleItemPress(item)}
      />
    );
  };

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingTop: (CMUtils.isAndroid ? insets.top : 0) + CMConstants.space.normal,
            paddingHorizontal: CMConstants.space.normal,
            paddingBottom: CMConstants.space.smallEx,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
          }}
        >
          {!isSearching ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <CMHamburgerMenu
                  navigation={navigation}
                  themeMode={themeMode}
                  currentRoute="Matches"
                />
                <View style={{ width: CMConstants.space.small }} />
                <Text style={{ fontSize: CMConstants.fontSize.large * fontScale, fontWeight: 'bold', color: textColor }}>
                  {routeTitle}
                </Text>
              </View>
              <CMRipple
                containerStyle={{
                  ...CMCommonStyles.circle(CMConstants.height.iconBig),
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1.5,
                  borderColor: CMConstants.color.green,
                }}
                onPress={() => {
                  setIsSearching(true);
                }}
              >
                <Ionicons
                  name={'search-outline'}
                  size={CMConstants.height.icon * 0.8}
                  color={CMConstants.color.green}
                />
              </CMRipple>
            </View>
          ) : (
            <View style={{ width: '100%', position: 'relative', justifyContent: 'center' }}>
              <TextInput
                style={{
                  width: '100%',
                  height: CMConstants.height.textInput,
                  backgroundColor: inputBackgroundColor,
                  borderRadius: CMConstants.radius.normal,
                  paddingLeft: CMConstants.space.small,
                  paddingRight: CMConstants.height.iconBig + CMConstants.space.small + CMConstants.space.smallEx,
                  color: inputTextColor,
                  fontSize: CMConstants.fontSize.normal,
                  borderWidth: isDarkMode ? 0 : 1,
                  borderColor: isDarkMode ? 'transparent' : CMConstants.color.lightGrey,
                }}
                defaultValue={searchText}
                onChangeText={text => setSearchText(text)}
                placeholder="Search"
                placeholderTextColor={placeholderColor}
                keyboardType="default"
                onSubmitEditing={Keyboard.dismiss}
                blurOnSubmit={false}
                underlineColorAndroid="transparent"
                returnKeyType="done"
              />
              <View
                style={{
                  position: 'absolute',
                  right: CMConstants.space.smallEx,
                  width: CMConstants.height.iconBig,
                  height: CMConstants.height.iconBig,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 1000,
                }}
              >
                <CMRipple
                  containerStyle={{
                    ...CMCommonStyles.circle(CMConstants.height.iconBig),
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: closeButtonBackground,
                  }}
                  onPress={() => {
                    setIsSearching(false);
                  }}
                >
                  <Ionicons
                    name={'close'}
                    size={CMConstants.height.icon}
                    color={closeButtonIconColor}
                  />
                </CMRipple>
              </View>
            </View>
          )}
        </View>

        <View style={{ flex: 1, marginHorizontal: CMConstants.space.normal }}>
          {loading && filteredItems.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={CMConstants.color.green} />
              <Text style={[styles.loadingText, { color: placeholderColor }]}>Loading {routeTitle.toLowerCase()}...</Text>
            </View>
          ) : (
            <FlatList
              style={{ flex: 0, marginBottom: insets.bottom }}
              refreshing={refreshing}
              onRefresh={() => loadItems()}
              initialNumToRender={filteredItems.length}
              data={filteredItems}
              renderItem={renderDefaultItem}
              ItemSeparatorComponent={({ highlighted }) => (
                <View style={{ height: CMConstants.space.smallEx }} />
              )}
              keyExtractor={(item, index) => item.data?.id || item.id || `item-${index}`}
              extraData={themeMode}
              ListHeaderComponent={
                loading && filteredItems.length > 0 ? (
                  <View style={styles.loadingHeader}>
                    <ActivityIndicator size="small" color={CMConstants.color.green} />
                    <Text style={[styles.loadingHeaderText, { color: CMConstants.color.green }]}>Loading...</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                loading && filteredItems.length > 0 ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator size="small" color={CMConstants.color.green} />
                    <Text style={[styles.loadingFooterText, { color: CMConstants.color.green }]}>Loading more...</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: placeholderColor }]}>
                      {searchText.trim() ? 'No results found' : `No ${routeTitle.toLowerCase()} available`}
                    </Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {routeShowAddButton && (
          <CMRipple
            containerStyle={{
              ...CMCommonStyles.circle(45),
              position: 'absolute',
              justifyContent: 'center',
              alignItems: 'center',
              right: CMConstants.space.smallEx,
              bottom: CMConstants.space.normal,
              backgroundColor: CMConstants.color.green,
            }}
            onPress={handleAddButtonPress}
          >
            <Ionicons
              name={'add-outline'}
              size={CMConstants.height.icon}
              color={CMConstants.color.white}
            />
          </CMRipple>
        )}
      </View>
      
      <CMLoadingDialog visible={loading} />
    </SafeAreaView>
  );
};

const styles = {
  matchItemContainer: {
    position: 'relative' as const,
  },
  actionButtons: {
    position: 'absolute' as const,
    top: CMConstants.space.smallEx,
    right: CMConstants.space.smallEx,
    flexDirection: 'row' as const,
    borderRadius: CMConstants.radius.normal,
    padding: 4,
    shadowColor: CMConstants.color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButton: {
    marginHorizontal: 2,
    padding: 6,
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: CMConstants.radius.small,
    borderWidth: 1,
    borderColor: CMConstants.color.green,
  },
  deleteButton: {
    borderColor: CMConstants.color.red,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.normal * 2,
  },
  loadingText: {
    marginTop: CMConstants.space.normal,
    fontSize: CMConstants.fontSize.normal,
    fontWeight: '500' as const,
  },
  loadingHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.small,
  },
  loadingHeaderText: {
    marginLeft: CMConstants.space.smallEx,
    fontSize: CMConstants.fontSize.small,
    color: CMConstants.color.green,
    fontWeight: '500' as const,
  },
  loadingFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.small,
  },
  loadingFooterText: {
    marginLeft: CMConstants.space.smallEx,
    fontSize: CMConstants.fontSize.small,
    color: CMConstants.color.green,
    fontWeight: '500' as const,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: CMConstants.space.normal * 2,
  },
  emptyText: {
    fontSize: CMConstants.fontSize.normal,
    textAlign: 'center' as const,
  },
};

export default CMGenericFeedScreen;

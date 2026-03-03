import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CMNavigationProps from '../navigation/CMNavigationProps';
import CMCommonStyles from '../styles/CMCommonStyles';
import CMConstants from '../CMConstants';
import CMGlobal from '../CMGlobal';
import CMRipple from '../components/CMRipple';
import CMNewsGeneratorHelper from '../helper/CMNewsGeneratorHelper';

const CMNewsDetailScreen = ({ navigation, route }: CMNavigationProps) => {
  const insets = useSafeAreaInsets();
  const themeMode = CMGlobal.themeMode || CMConstants.themeMode.light;
  const isDarkMode = themeMode === CMConstants.themeMode.dark;

  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white;
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey;

  const highlightType = route.params?.highlightType as 'champion' | 'topScorer' | 'intenseMatch';
  const league = route.params?.league || {};
  const seasonName = league?.seasonName as string | undefined;
  const context = route.params?.context || {};
  const team = route.params?.team;
  const player = route.params?.player;
  const match = route.params?.match;

  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<{ title: string; subtitle?: string; body: string } | null>(null);

  useEffect(() => {
    const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black;
    navigation.setOptions({
      title: 'League News',
      headerTitleStyle: {
        fontSize: CMConstants.fontSize.large,
        fontWeight: 'bold' as const,
      },
      headerLeft: () => (
        <CMRipple
          containerStyle={{
            marginLeft: CMConstants.space.smallEx,
            padding: CMConstants.space.smallEx,
          }}
          onPress={() => navigation.goBack()}
          color={headerTextColor}
        >
          <Ionicons name="arrow-back" size={CMConstants.height.icon} color={headerTextColor} />
        </CMRipple>
      ),
    });
  }, [navigation, isDarkMode]);

  useEffect(() => {
    const loadArticle = async () => {
      try {
        const result = await CMNewsGeneratorHelper.generateHighlightArticle(
          highlightType,
          league?.name || 'League',
          seasonName,
          context,
        );
        if (result.value) {
          setArticle(result.value);
        }
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [highlightType, league?.name, seasonName, JSON.stringify(context)]);

  if (loading || !article) {
    return (
      <SafeAreaView
        style={[
          CMCommonStyles.bodyMain(themeMode),
          { backgroundColor, flex: 1, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={CMConstants.color.green} />
        <Text style={{ color: labelColor, marginTop: CMConstants.space.smallEx }}>Loading News...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor, flex: 1 }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: CMConstants.space.smallEx,
          paddingBottom: insets.bottom + CMConstants.space.normal,
          paddingHorizontal: CMConstants.space.normal,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: textColor,
            fontSize: CMConstants.fontSize.largeEx,
            fontWeight: '700',
            marginBottom: CMConstants.space.smallEx,
          }}
        >
          {article.title}
        </Text>

        {article.subtitle ? (
          <Text
            style={{
              color: CMConstants.color.green,
              fontSize: CMConstants.fontSize.normal,
              fontWeight: '600',
              marginBottom: CMConstants.space.normal,
            }}
          >
            {article.subtitle}
          </Text>
        ) : null}

        <Text
          style={{
            color: textColor,
            fontSize: CMConstants.fontSize.normal,
            lineHeight: 22,
          }}
        >
          {article.body}
        </Text>

        {(() => {
          // Determine button text and navigation based on highlight type
          let buttonText = 'Go to League';
          let onPressHandler = () => {
            if (league?.id) {
              navigation.navigate(CMConstants.screenName.leagueDetails, {
                league: league,
              });
            }
          };

          if (highlightType === 'champion' && team) {
            buttonText = 'Go to That Team';
            onPressHandler = () => {
              navigation.navigate(CMConstants.screenName.leagueDetails, {
                league: league,
                initialTab: 'Standings',
              });
            };
          } else if (highlightType === 'topScorer' && player) {
            buttonText = 'View That Player';
            onPressHandler = () => {
              navigation.navigate(CMConstants.screenName.playerDetails, {
                player: player,
                team: route.params?.team,
                league: league,
              });
            };
          } else if (highlightType === 'intenseMatch' && match) {
            buttonText = 'View That Game';
            onPressHandler = () => {
              // Navigate to scoreboard if match is finished, otherwise to edit match
              if (match.status === CMConstants.gameStatus.finished) {
                navigation.navigate(CMConstants.screenName.scoreboard, {
                  match: match,
                });
              } else {
                navigation.navigate(CMConstants.screenName.editMatch, {
                  match: match,
                  league: league,
                  isEdit: true,
                  seasonName: league?.seasonName || '',
                });
              }
            };
          }

          // Only show button if we have the necessary data
          const shouldShowButton = 
            (highlightType === 'champion' && team) ||
            (highlightType === 'topScorer' && player) ||
            (highlightType === 'intenseMatch' && match) ||
            (league?.id && highlightType !== 'champion' && highlightType !== 'topScorer' && highlightType !== 'intenseMatch');

          if (!shouldShowButton) return null;

          return (
            <CMRipple
              containerStyle={{
                marginTop: CMConstants.space.normal * 1.5,
                marginBottom: CMConstants.space.smallEx,
                backgroundColor: CMConstants.color.green,
                borderRadius: CMConstants.radius.normal,
                justifyContent: 'center',
                alignItems: 'center',
                paddingVertical: CMConstants.space.smallEx,
                shadowColor: CMConstants.color.green,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }}
              onPress={onPressHandler}
              color={CMConstants.color.green}
            >
              <Text
                style={{
                  color: CMConstants.color.white,
                  fontSize: CMConstants.fontSize.normal,
                  fontFamily: CMConstants.font.bold,
                  letterSpacing: 0.5,
                }}
              >
                {buttonText}
              </Text>
            </CMRipple>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CMNewsDetailScreen;


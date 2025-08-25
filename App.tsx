/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {NavigationContainer, DefaultTheme, DarkTheme} from '@react-navigation/native'
import {createStackNavigator} from '@react-navigation/stack'
import {ToastProvider} from 'react-native-toast-notifications'
import CMConstants from './project/CMConstants';
import CMSplashScreen from './project/screens/CMSplashScreen';
import CMLoginScreen from './project/screens/CMLoginScreen';
import CMCoachStackNavigatorRoutes from './project/navigation/CMCoachStackNavigatorRoutes';
import FlashMessage from 'react-native-flash-message';
import CMRegisterScreen from './project/screens/CMRegisterScreen';
import CMNavigationStyle from './project/navigation/CMNavigationStyle';
import CMUtils from './project/utils/CMUtils';
import CMAlertModal, { CMAlertModalRef } from './project/components/CMAlertModal';
import CMAlertManager from './project/helper/CMAlertManager';
import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import CMLocalStorageHelper from './project/helper/CMLocalStorageHelper';
import CMGlobal from './project/CMGlobal';
import Ionicons from 'react-native-vector-icons/Ionicons';

const Stack = createStackNavigator()

const Auth = () => {
	const themeMode = CMConstants.themeMode.light

	return (
		<Stack.Navigator initialRouteName={CMConstants.screenName.login}>
			<Stack.Screen
				name={CMConstants.screenName.login}
				component={CMLoginScreen}
				options={{
					headerShown: false
				}}
			/>
			<Stack.Screen
				name={CMConstants.screenName.register}
				component={CMRegisterScreen}
				options={{
					headerShown: false
				}}
			/>
		</Stack.Navigator>
	)
}

function App() {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<string>(CMGlobal.themeMode || CMConstants.themeMode.light);
  const [themeLoaded, setThemeLoaded] = useState(false);

  // Ensure vector icon fonts (including Ionicons) are loaded once at app startup
  useEffect(() => {
    Ionicons.loadFont().catch((error: unknown) => {
      console.warn('Failed to load Ionicons font:', error);
    });
  }, []);

  // Configure GPT API key (for news/article generation)
  useEffect(() => {
    // TODO: For production, load this from a secure config or environment,
    // not hardcoded. For now we read from an env-style global.
    if (!CMGlobal.gptApiKey) {
      // Set from a build-time env var if available
      // @ts-ignore - __GPT_API_KEY__ can be injected by your build tooling
      const injectedKey = typeof __GPT_API_KEY__ !== 'undefined' ? __GPT_API_KEY__ : undefined;
      if (injectedKey) {
        CMGlobal.gptApiKey = injectedKey;
      }
    }
  }, []);

  // Load saved theme mode on app start
  useEffect(() => {
    CMLocalStorageHelper.getThemeMode((isSuccess: boolean, savedTheme: string) => {
      if (isSuccess) {
        CMGlobal.themeMode = savedTheme;
        setThemeMode(savedTheme);
      } else {
        // Default to system preference if no saved theme
        const systemIsDark = systemColorScheme === 'dark';
        const defaultTheme = systemIsDark ? CMConstants.themeMode.dark : CMConstants.themeMode.light;
        CMGlobal.themeMode = defaultTheme;
        setThemeMode(defaultTheme);
      }
      setThemeLoaded(true);
    });
  }, []);

  const isDarkMode = themeMode === CMConstants.themeMode.dark;

  const handleAlertModalRef = (ref: CMAlertModalRef | null) => {
    CMAlertManager.setRef(ref);
  };

  // Don't render until theme is loaded
  if (!themeLoaded) {
    return null;
  }

  return (
    <ToastProvider>
		<NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
			<Stack.Navigator initialRouteName={'Auth'}>
				<Stack.Screen
					name={CMConstants.screenName.splash}
					component={CMSplashScreen}
					options={{headerShown: false}}
				/>
				<Stack.Screen
					name="Auth"
					component={Auth}
					options={{headerShown: false}}
				/>
				<Stack.Screen
					name="CMCoachStackNavigatorRoutes"
					component={CMCoachStackNavigatorRoutes}
					options={{headerShown: false}}
				/>
			</Stack.Navigator>
		</NavigationContainer>
		<FlashMessage position="top"/>
		<CMAlertModal ref={handleAlertModalRef} />
	</ToastProvider>

    // <View style={styles.container}>
    //   <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
    //   <NewAppScreen templateFileName="App.tsx" />
    // </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App

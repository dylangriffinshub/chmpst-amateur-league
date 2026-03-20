import React, {useEffect, useState} from 'react'
import {SafeAreaView} from 'react-native-safe-area-context'
import {useColorScheme} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import CMConstants from '../CMConstants'
import CMTabBar, { TabBarButton } from '../components/CMTabBar'
import CMHomeScreen from './CMHomeScreen'
import CMActivityFeedScreen from './CMActivityFeedScreen'
import CMTeamManagementScreen from './CMTeamManagement'
import CMLeagueScreen from './CMLeagueScreen'
import CMSettingsScreen from './CMSettingsScreen'
import CMTeamManagementTabScreen from './CMTeamManagementTabScreen'
import CMGenericFeedScreen from './CMGenericFeedScreen'
import CMGlobal from '../CMGlobal'
import CMLocalStorageHelper from '../helper/CMLocalStorageHelper'

const CMMainScreen = ({navigation, route}: CMNavigationProps) => {
	const systemColorScheme = useColorScheme()
	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)

	useEffect(() => {
		// Load saved theme mode on mount
		CMLocalStorageHelper.getThemeMode((isSuccess: boolean, savedTheme: string) => {
			if (isSuccess) {
				CMGlobal.themeMode = savedTheme
				setThemeMode(savedTheme)
			} else {
				// Default to system preference if no saved theme
				const systemIsDark = systemColorScheme === 'dark'
				const defaultTheme = systemIsDark ? CMConstants.themeMode.dark : CMConstants.themeMode.light
				CMGlobal.themeMode = defaultTheme
				setThemeMode(defaultTheme)
			}
		})
	}, [])

	// Listen for theme changes when navigating back to this screen
	useEffect(() => {
		const unsubscribe = navigation.addListener('focus', () => {
			setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
		})
		return unsubscribe
	}, [navigation])

	const Tab = createBottomTabNavigator(

	)

	return (
		<SafeAreaView
			style={CMCommonStyles.bodyMain(themeMode)}
			edges={['right', 'left']}
		>
			<CMTabBar Tab={Tab}>
				<Tab.Screen name="Home" component={CMHomeScreen} />
				{/* <Tab.Screen name="Activity Feed" component={CMActivityFeedScreen} /> */}
				<Tab.Screen name="Matches" component={CMGenericFeedScreen} />

				{/* <Tab.Screen name="Team Management" component={CMTeamManagementScreen} /> */}
				{/* <Tab.Screen name="Team Management" component={CMTeamManagementTabScreen} /> */}

				<Tab.Screen name="League" component={CMLeagueScreen} />
				<Tab.Screen name="Settings" component={CMSettingsScreen} />
			</CMTabBar>
		</SafeAreaView>
	)
}

const styles = {
    
}

export default CMMainScreen
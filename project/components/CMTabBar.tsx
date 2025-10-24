import React from 'react'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMConstants from '../CMConstants'
import CMUtils from '../utils/CMUtils'
import { Pressable, Text, View } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'

interface ScreenOptionsProps {
	route: any
}

interface TabBarIconProps {
	focused: boolean
	color: string
	size: number
}

const CMTabBar = (props: any) => {
	const {Tab} = props

    const themeMode = CMConstants.themeMode.light

	Ionicons.loadFont()
	const tabIconNames: {[name: string]: string} = {
		Home: 'home',
		Matches: 'document-text', //ios-albums
		// 'Team Management': 'people',
		// 'Team Management': 'people',
        League: 'basketball',
		Settings: 'settings'
	}

	return (
		<Tab.Navigator
			contentInsetAdjustmentBehavior="never"
			screenOptions={({route}: ScreenOptionsProps) => ({
				tabBarIcon: ({focused, color, size}: TabBarIconProps) => (
					<Ionicons
						name={tabIconNames[route.name]}
						size={size}
						color={focused ? CMConstants.color.white : color}
					/>
				),
				tabBarButton: (buttonProps: any) => <TabBarButton {...buttonProps} />,
				tabBarActiveTintColor: CMConstants.color.green,
				tabBarInactiveTintColor: CMConstants.color.semiLightGrey,
				tabBarActiveBackgroundColor: CMConstants.color.darkGrey,
				tabBarInactiveBackgroundColor: CMConstants.color.darkGrey,
				headerShown: false,
				tabBarStyle: {
					backgroundColor: CMConstants.color.darkGrey,
					borderTopColor: CMConstants.color.darkGrey3,
					borderTopWidth: 1,
				}
			})}
		>
			{props.children}
		</Tab.Navigator>

		
	)
}

export function TabBarButton(props: any) {
  const { accessibilityState, onPress, children, style } = props;
  const focused = props['aria-selected'];
console.log('TabBarButton - focused:', props);
  return (
    <Pressable onPress={onPress} style={[style, { flex: 1 }]}>
      {focused ? (
        <LinearGradient
          colors={[CMConstants.color.greenDark+'50',
								  
								  '#74f7bc',
								  CMConstants.color.greenDark+'50',]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
			width: '100%',
			justifyContent: 'center',
			alignItems: 'center',
            borderRadius: 12,
			paddingHorizontal:2,
			paddingVertical: 4,
          }}
        >
			<View style={{
				width: '100%',
				justifyContent: 'center',
				alignItems: 'center',
				borderRadius: 10,
				padding: 2,
				backgroundColor: props.style[1].backgroundColor+75
			}}>
			{children}
			</View>
		</LinearGradient>
      ) : (children)}
      
    </Pressable>
  );
}
export default CMTabBar

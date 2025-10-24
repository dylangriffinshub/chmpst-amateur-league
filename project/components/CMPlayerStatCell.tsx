import React, { useState, useEffect } from 'react'
import { View, ViewStyle, TextStyle, Text, Dimensions } from 'react-native'
import CMConstants from '../CMConstants'
import CMRipple from './CMRipple'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMProfileImage from './CMProfileImage'
import CMGlobal from '../CMGlobal'

const CMPlayerStatCell = (props: any) => {
	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Listen for theme changes
	useEffect(() => {
		setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
	}, [])

	// Dynamic colors based on theme
	const getCellBackgroundColor = (index: number) => {
		if (index <= 3) {
			return isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1
		}
		return isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	}
	const getCellBorderColor = (index: number) => {
		if (index <= 3) {
			return CMConstants.color.green
		}
		return isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	}
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const teamNameColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey

	const { playerStat = {}, index } = props

	// Get screen width for responsive design
	const screenWidth = Dimensions.get('window').width
	const isSmallDevice = screenWidth < 375 // iPhone SE and similar small devices

	return (
		<CMRipple
			containerStyle={[styles.cell(index), { backgroundColor: getCellBackgroundColor(index), borderColor: getCellBorderColor(index) }]}
			onPress={() => {props.onPress()}}
		>
			<CMProfileImage
				radius={32}
				style={{
					marginLeft: CMConstants.space.smallEx - 2
				}}
				imgURL={playerStat?.player?.avatar??""}
				isUser={true}
			/>
			<View
				style={{flex: 1, flexShrink: 1, marginLeft: CMConstants.space.smallEx - 2, minWidth: 70, maxWidth: 120}}
			>
				<Text
					style={[styles.playerName, { color: textColor, fontSize: 12 }]}
					numberOfLines={1}
					ellipsizeMode="tail"
				>
					{playerStat?.player?.name??""}
				</Text>
				<View style={{flexDirection: 'row', marginTop: 2, alignItems: 'center'}}>
					<CMProfileImage
						radius={14}
						imgURL={playerStat?.team?.avatar??""}
					/>
					<View
						style={{flex: 1, marginLeft: 4, justifyContent: 'center'}}
					>
						<Text
							style={[styles.teamName, { color: teamNameColor, fontSize: 10 }]}
							numberOfLines={1}
							ellipsizeMode="tail"
						>
							{playerStat?.team?.name??""}
						</Text>
					</View>
				</View>
			</View>
			<View style={{flexDirection: 'row', flexShrink: 0, marginLeft: CMConstants.space.smallEx - 2}}>
				<Text style={[styles.statValue, { color: CMConstants.color.green, width: 24 }]}>
					{playerStat?.points??""}
				</Text>
				<Text style={[styles.statValue, { color: textColor, width: 24 }]}>
					{playerStat?.assists??""}
				</Text>
				<Text style={[styles.statValue, { color: textColor, width: 24 }]}>
					{playerStat?.rebounds??""}
				</Text>
				<Text style={[styles.statValue, { color: textColor, width: 24 }]}>
					{playerStat?.blocks??""}
				</Text>
 				<Text style={[styles.statValue, { color: textColor, width: 24 }]}>
					{playerStat?.steals??""}
				</Text>
			</View>
        </CMRipple>
	)
}

const styles = {
	cell: (index: number): ViewStyle => ({
		paddingVertical: CMConstants.space.smallEx - 2,
		paddingHorizontal: CMConstants.space.smallEx - 2,
		alignItems: 'center',
		flexDirection: 'row',
		borderWidth: index <= 3 ? 2 : 1,
		borderRadius: CMConstants.radius.normal,
		overflow: 'visible',
		marginBottom: CMConstants.space.smallEx - 2,
		shadowColor: index <= 3 ? CMConstants.color.green : CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: index <= 3 ? 0.3 : 0.2,
		shadowRadius: 4,
		elevation: index <= 3 ? 5 : 3,
	}),
	playerName: {
		fontFamily: CMConstants.font.semiBold,
	},
	teamName: {
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.regular,
	},
	statValue: {
		fontSize: 11,
		fontFamily: CMConstants.font.semiBold,
		textAlign: 'center'
	} as TextStyle
}

export default CMPlayerStatCell
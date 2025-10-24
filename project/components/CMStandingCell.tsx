import React, { useState, useEffect } from 'react'
import { View, Text, TextStyle } from 'react-native'
import CMConstants from '../CMConstants'
import CMRipple from './CMRipple'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMProfileImage from './CMProfileImage'
import CMGlobal from '../CMGlobal'

const CMStandingCell = (props: any) => {
	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Listen for theme changes
	useEffect(() => {
		setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
	}, [])

	// Dynamic colors based on theme
	const cellBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const cellBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black

	const { standing = {} } = props

	return (
		<CMRipple
			containerStyle={[styles.cell, { backgroundColor: cellBackgroundColor, borderColor: cellBorderColor }]}
			onPress={() => {props.onPress()}}
		>
			<CMProfileImage
				radius={40}
				style={{marginLeft: CMConstants.space.smallEx}}
				imgURL={standing?.team?.avatar??""}
			/>
			<View
				style={{flex: 1, marginLeft: CMConstants.space.smallEx}}
			>
				<Text
					style={[styles.teamName, { color: textColor }]}
					numberOfLines={2}
				>
					{standing?.team?.name??""}
				</Text>
			</View>
			<Text style={[styles.statValue, { color: textColor }]}>
				{standing?.game??""}
			</Text>
			<Text style={[styles.statValue, { color: textColor }]}>
				{standing?.win??""}
			</Text>
			<Text style={[styles.statValue, { color: textColor }]}>
				{standing?.lose??""	}
			</Text>
		</CMRipple>
	)
}

const styles = {
	cell: {
		paddingVertical: CMConstants.space.smallEx,
		paddingHorizontal: CMConstants.space.smallEx,
		alignItems: 'center',
		flexDirection: 'row',
		borderWidth: 1,
		borderRadius: CMConstants.radius.normal,
		overflow: 'hidden',
		marginBottom: CMConstants.space.smallEx,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 3,
	},
	teamName: {
		fontSize: CMConstants.fontSize.small,
		fontFamily: CMConstants.font.semiBold,
	},
	statValue: {
		fontSize: CMConstants.fontSize.small,
		fontFamily: CMConstants.font.semiBold,
		width: 50,
		textAlign: 'center'
	} as TextStyle
}

export default CMStandingCell
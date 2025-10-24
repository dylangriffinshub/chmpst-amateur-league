import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Text, Dimensions } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMConstants from '../CMConstants'
import CMRipple from './CMRipple'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMProfileImage from './CMProfileImage'
import CMGlobal from '../CMGlobal'

const CMLeagueCell = (props: any) => {
	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Get screen dimensions for responsive design
	const screenWidth = Dimensions.get('window').width
	const isSmallDevice = screenWidth < 375
	const isLargeDevice = screenWidth > 414
	const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0

	// Update theme when component mounts or theme changes
	useEffect(() => {
		setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
	}, [])

	// Dynamic colors based on theme
	const cellBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const cellBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const locationTextColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const iconsContainerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1
	const iconButtonBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white

	const { league = {} } = props

	return (
		<View style={[styles.cell, { backgroundColor: cellBackgroundColor, borderColor: cellBorderColor }]}>
			<CMRipple
				containerStyle={styles.contentContainer}
				onPress={() => {props.onPress()}}
				color={CMConstants.color.green}
			>
				<View style={styles.profileImageContainer}>
					<CMProfileImage
						radius={40}
						imgURL={league.avatar}
					/>
				</View>
				<View
					style={styles.textContainer}
				>
					<Text
						style={[styles.leagueName, { color: textColor, fontSize: (CMConstants.fontSize.medium + 2) * fontScale }]}
						numberOfLines={2}
					>
						{league.name}
					</Text>
					<Text
						style={[styles.teamCount, { color: textColor, fontSize: CMConstants.fontSize.smallEx * fontScale }]}
						numberOfLines={1}
					>
						{league?.teamsId?.length ?? 0}{league?.teamsId?.length >= 2 ? ' Teams' : ' Team'}
					</Text>
					{(league.city || league.state || league.country) && (
						<View style={styles.locationContainer}>
							<Ionicons
								name="location-outline"
								size={12}
								color={locationTextColor}
							/>
							<Text
								style={[styles.locationText, { color: locationTextColor, fontSize: 10 * fontScale }]}
								numberOfLines={1}
							>
								{[league.city, league.state, league.country].filter(Boolean).join(', ')}
							</Text>
						</View>
					)}
				</View>
			</CMRipple>
			
			<View style={[styles.iconsContainer, { backgroundColor: iconsContainerBackgroundColor }]}>
				<CMRipple
					containerStyle={[styles.iconButton, { backgroundColor: iconButtonBackgroundColor }]}
					onPress={() => {
						if (props.onEdit) {
							props.onEdit(league)
						}
					}}
					color={CMConstants.color.green}
				>
					<Ionicons
						name="create-outline"
						size={14}
						color={CMConstants.color.green}
					/>
				</CMRipple>
				
				<CMRipple
					containerStyle={[styles.iconButton, styles.deleteButton, { backgroundColor: iconButtonBackgroundColor }]}
					onPress={() => {
						if (props.onDelete) {
							props.onDelete(league)
						}
					}}
					color={CMConstants.color.red}
				>
					<Ionicons
						name="trash-outline"
						size={14}
						color={CMConstants.color.red}
					/>
				</CMRipple>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	cell: {
		padding: CMConstants.space.smallEx,
		borderWidth: 1,
		borderRadius: CMConstants.radius.normal,
		overflow: 'hidden',
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 3,
		elevation: 2,
	},
	contentContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	profileImageContainer: {
		borderWidth: 2,
		borderColor: CMConstants.color.green,
		borderRadius: 40,
		padding: 2,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 3,
		elevation: 3,
	},
	textContainer: {
		flex: 1,
		marginLeft: CMConstants.space.smallEx,
		paddingRight: 90,
	},
	leagueName: {
		fontFamily: CMConstants.font.bold,
		marginBottom: CMConstants.space.smallEx / 2 - 1,
	},
	teamCount: {
		fontFamily: CMConstants.font.semiBold,
		marginTop: CMConstants.space.smallEx / 2 - 1,
		marginBottom: CMConstants.space.smallEx / 2 - 1,
	},
	locationContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: CMConstants.space.smallEx / 2 - 1,
	},
	locationText: {
		fontFamily: CMConstants.font.regular,
		marginLeft: CMConstants.space.smallEx / 2,
	},
	iconsContainer: {
		position: 'absolute',
		top: CMConstants.space.smallEx,
		right: CMConstants.space.smallEx,
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: CMConstants.radius.normal,
		padding: 4,
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	},
	iconButton: {
		marginHorizontal: 2,
		padding: 6,
		minWidth: 28,
		minHeight: 28,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: CMConstants.radius.small,
		borderWidth: 1,
		borderColor: CMConstants.color.green,
	},
	deleteButton: {
		borderColor: CMConstants.color.red,
	},
})

export default CMLeagueCell
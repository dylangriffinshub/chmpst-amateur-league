import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Text } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMConstants from '../CMConstants'
import CMRipple from './CMRipple'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMProfileImage from './CMProfileImage'
import CMGlobal from '../CMGlobal'

const CMTeamCell = (props: any) => {
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
	const iconButtonBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey1
	const chevronColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey

	const { team = {} } = props

	return (
		<View style={[styles.cell, { backgroundColor: cellBackgroundColor, borderColor: cellBorderColor }]}>
			{/* Team Details Section */}
			<CMRipple
				containerStyle={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
				onPress={() => {props.onPress()}}
			>
				<CMProfileImage
					radius={40}
					imgURL={team.avatar}
				/>
				<View
					style={{flex: 1, marginLeft: CMConstants.space.smallEx}}
				>
					<Text
						style={[styles.teamName, { color: textColor }]}
						numberOfLines={1}
					>
						{team.name}
					</Text>
				</View>
			</CMRipple>
			
			{/* Default chevron if no action buttons */}
			{!props.onView && !props.onEdit && !props.onDelete && (
				<Ionicons
					name={'chevron-forward-outline'}
					size={CMConstants.height.icon}
					color={chevronColor}
				/>
			)}
			
			{/* Action Icons - View, Edit and Delete (if callbacks provided) - Bottom Right */}
			{(props.onView || props.onEdit || props.onDelete) && (
				<View style={styles.iconsContainer}>
					{props.onView && (
						<CMRipple
							containerStyle={[styles.iconButton, { backgroundColor: iconButtonBackgroundColor }]}
							onPress={() => {
								if (props.onView) {
									props.onView(team)
								}
							}}
						>
							<Ionicons
								name="eye-outline"
								size={CMConstants.height.icon * 0.7}
								color={CMConstants.color.green}
							/>
						</CMRipple>
					)}
					
					{props.onEdit && (
						<CMRipple
							containerStyle={[styles.iconButton, {marginLeft: CMConstants.space.smallEx, backgroundColor: iconButtonBackgroundColor }]}
							onPress={() => {
								if (props.onEdit) {
									props.onEdit(team)
								}
							}}
						>
							<Ionicons
								name="create-outline"
								size={CMConstants.height.icon * 0.7}
								color={CMConstants.color.green}
							/>
						</CMRipple>
					)}
					
					{props.onDelete && (
						<CMRipple
							containerStyle={[styles.iconButton, {marginLeft: CMConstants.space.smallEx, backgroundColor: iconButtonBackgroundColor }]}
							onPress={() => {
								if (props.onDelete) {
									props.onDelete(team)
								}
							}}
						>
							<Ionicons
								name="trash-outline"
								size={CMConstants.height.icon * 0.7}
								color={CMConstants.color.red}
							/>
						</CMRipple>
					)}
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	cell: {
		padding: CMConstants.space.smallEx,
		alignItems: 'center',
		flexDirection: 'row',
		borderWidth: 1,
		borderRadius: CMConstants.radius.normal,
		overflow: 'hidden',
		position: 'relative',
		shadowColor: CMConstants.color.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 3,
	},
	teamName: {
		fontSize: CMConstants.fontSize.normal,
		fontWeight: '600',
		fontFamily: CMConstants.font.semiBold,
	},
	iconsContainer: {
		position: 'absolute',
		bottom: CMConstants.space.smallEx,
		right: CMConstants.space.smallEx,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end'
	},
	iconButton: {
		width: CMConstants.height.iconBig * 0.75,
		height: CMConstants.height.iconBig * 0.75,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: CMConstants.radius.small,
	}
})

export default CMTeamCell
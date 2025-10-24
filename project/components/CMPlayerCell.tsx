import React from 'react'
import { View, StyleSheet, Text } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMConstants from '../CMConstants'
import CMRipple from './CMRipple'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMProfileImage from './CMProfileImage'

const CMPlayerCell = (props: any) => {
	const { themeMode = CMConstants.themeMode.light, player = {} } = props
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Dynamic colors based on theme
	const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey1
	const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const iconButtonBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.white
	const chevronColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	
	// Debug logging
	console.log('CMPlayerCell props:', {
		hasOnEdit: !!props.onEdit,
		hasOnDelete: !!props.onDelete,
		playerName: player.name,
		onEditType: typeof props.onEdit,
		onDeleteType: typeof props.onDelete
	})

	return (
		<View style={[styles.cell, { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor }]}>
			{/* Player Details Row */}
			<CMRipple
				containerStyle={styles.playerDetailsRow}
				onPress={() => {props.onPress()}}
			>
				<CMProfileImage
					radius={50}
					imgURL={player.avatar}
				/>
				<View
					style={{flex: 1, marginLeft: CMConstants.space.smallEx}}
				>
					<Text
						style={[CMCommonStyles.title(themeMode), { color: textColor }]}
						numberOfLines={1}
					>
						{player.name}
					</Text>
				</View>
				
				{/* Default chevron if no action buttons */}
				{!props.onEdit && !props.onDelete && (
					<Ionicons
						name={'chevron-forward-outline'}
						size={CMConstants.height.icon}
						color={chevronColor}
					/>
				)}
			</CMRipple>
			
			{/* Action Icons - Edit and Delete (if callbacks provided) */}
			{(props.onEdit || props.onDelete) && (
			<View style={styles.iconsContainer}>
				<CMRipple
					containerStyle={[styles.iconButton, { backgroundColor: iconButtonBackgroundColor }]}
					onPress={() => {
						console.log('Edit button pressed for:', player.name)
						console.log('props.onEdit exists:', !!props.onEdit)
						console.log('props.onEdit type:', typeof props.onEdit)
						if (props.onEdit) {
							console.log('Calling props.onEdit (no parameters needed)')
							try {
								props.onEdit()
								console.log('props.onEdit called successfully')
							} catch (error) {
								console.log('Error calling props.onEdit:', error)
							}
						} else {
							console.log('props.onEdit is not available')
						}
					}}
					color={CMConstants.color.green}
				>
					<Ionicons
						name="create-outline"
						size={CMConstants.height.icon * 0.7}
						color={CMConstants.color.green}
					/>
				</CMRipple>
				
				<CMRipple
					containerStyle={[styles.iconButton, {marginLeft: CMConstants.space.smallEx, backgroundColor: iconButtonBackgroundColor}]}
					onPress={() => {
						console.log('Delete button pressed for:', player.name)
						console.log('props.onDelete exists:', !!props.onDelete)
						console.log('props.onDelete type:', typeof props.onDelete)
						if (props.onDelete) {
							console.log('Calling props.onDelete (no parameters needed)')
							try {
								props.onDelete()
								console.log('props.onDelete called successfully')
							} catch (error) {
								console.log('Error calling props.onDelete:', error)
							}
						} else {
							console.log('props.onDelete is not available')
						}
					}}
					color={CMConstants.color.red}
				>
					<Ionicons
						name="trash-outline"
						size={CMConstants.height.icon * 0.7}
						color={CMConstants.color.red}
					/>
				</CMRipple>
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
		position: 'relative'
	},
	playerDetailsRow: {
		flexDirection: 'row',
		alignItems: 'center'
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
		width: CMConstants.height.iconBig,
		height: CMConstants.height.iconBig,
		justifyContent: 'center',
		alignItems: 'center',
		borderRadius: CMConstants.radius.small
	}
})

export default CMPlayerCell
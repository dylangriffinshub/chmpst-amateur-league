import React, {useState, useEffect} from 'react'
import { View, Text, ViewStyle } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMConstants from '../CMConstants'
import CMRipple from './CMRipple'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMImageView from './CMImageView'
import CMUtils from '../utils/CMUtils'

const CMEventThumbCell = (props: any) => {
	const themeMode = CMConstants.themeMode.light

	const { event = {} } = props

	return (
		<CMRipple
			containerStyle={styles.cell}
			onPress={() => {props.onPress()}}
		>
			<CMImageView
				style={styles.matchImage}
				imgURL={event.image}
			/>
			<View
				style={styles.content}
			>
				<Text
					style={{...CMCommonStyles.label(themeMode), textAlign: 'center', marginVertical: CMConstants.space.smallEx}}
					numberOfLines={2}
				>
					{event.name}
				</Text>
				<View>
					<View
						style={{flexDirection: 'row', alignItems: 'center'}}
					>
						<View
							style={{flexDirection: 'row'}}
						>
							<Ionicons
								name={'time-outline'}
								size={CMConstants.height.icon}
								color={CMConstants.color.black}
							/>
							<Text
								style={{...CMCommonStyles.textSmall(themeMode), marginLeft: 4}}
								numberOfLines={1}
							>
								{event.dateTime ? CMUtils.strUpcomingDateFromDate(event.dateTime.toDate()) : '-:--'}
							</Text>
						</View>
					</View>
					<View
						style={{flexDirection: 'row', alignItems: 'center', marginTop: CMConstants.space.smallEx}}
					>
						<View
							style={{flexDirection: 'row'}}
						>
							<Ionicons
								name={'location-outline'}
								size={CMConstants.height.icon}
								color={CMConstants.color.black}
							/>
							<Text
								style={{...CMCommonStyles.textSmall(themeMode), marginLeft: 4}}
								numberOfLines={1}
							>
								{event.location ?? '-'}
							</Text>
						</View>
					</View>
				</View>
			</View>
		</CMRipple>
	)
}

const styles = {
	cell: {
        width: 220,
		backgroundColor: CMConstants.color.lightGrey2,
		borderWidth: 1,
		borderRadius: CMConstants.radius.normal,
		borderColor: CMConstants.color.lightGrey,
		overflow: 'hidden'
	},
	matchImage: {
		width: '100%',
		height: 140
	},
	content: {
		marginHorizontal: CMConstants.space.smallEx,
		marginBottom: CMConstants.space.small
	}
}

export default CMEventThumbCell
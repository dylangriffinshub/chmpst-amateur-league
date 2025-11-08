import React from 'react'
import {Modal, StyleSheet, View} from 'react-native'
import Spinner from 'react-native-spinkit'
import CMUtils from '../utils/CMUtils'
import CMConstants from '../CMConstants'

const CMLoadingDialog = (props: any) => {
	const {
		visible=false
	} = props

	return (
		<Modal
			animationType='fade'
			transparent={true}
			visible={visible}
		>
			<View style={styles.modalContentView}>
				<View
					style={{
						...styles.activityIndicatorWrapper,
						backgroundColor: CMUtils.colorWith(CMConstants.themeMode.light, CMConstants.color.white, CMConstants.color.semiDarkGrey)
					}}
				>
					<Spinner
						style={styles.spinner}
						type='Circle'
						size={40}
						color={CMUtils.colorWith(CMConstants.themeMode.light, CMConstants.color.black, CMConstants.color.white)}
					/>
				</View>
			</View>
		</Modal>
	)
}

export default CMLoadingDialog

const styles = StyleSheet.create({
	modalContentView: {
		flex: 1,
		backgroundColor: CMConstants.color.alphaModal,
		alignItems: 'center',
		justifyContent: 'space-around'
	},
	activityIndicatorWrapper: {
		height: 100,
		width: 100,
		borderRadius: 10,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-around'
	},
	spinner: {
		marginLeft: CMUtils.isIOS ? -10 : 0,
		marginTop: CMUtils.isIOS ? -10 : 0
	}
})

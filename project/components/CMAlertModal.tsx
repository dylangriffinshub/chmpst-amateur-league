import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect } from 'react'
import { Modal, View, Text, StyleSheet } from 'react-native'
import CMConstants from '../CMConstants'
import CMRipple from './CMRipple'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMGlobal from '../CMGlobal'

export type AlertType = 'success' | 'error' | 'warning' | 'info'

interface AlertConfig {
	title?: string
	message: string
	onPress?: () => void
	buttonText?: string
	type?: AlertType
}

export interface CMAlertModalRef {
	show: (config: AlertConfig) => void
}

const CMAlertModal = forwardRef<CMAlertModalRef>((props, ref) => {
	const [visible, setVisible] = useState(false)
	const [title, setTitle] = useState<string | undefined>(undefined)
	const [message, setMessage] = useState('')
	const [buttonText, setButtonText] = useState('OK')
	const [alertType, setAlertType] = useState<AlertType>('info')
	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const onPressCallbackRef = useRef<(() => void) | undefined>(undefined)

	// Update theme when modal becomes visible
	useEffect(() => {
		if (visible) {
			setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
		}
	}, [visible])

	useImperativeHandle(ref, () => ({
		show: (config: AlertConfig) => {
			setTitle(config.title)
			setMessage(config.message)
			setButtonText(config.buttonText || 'OK')
			setAlertType(config.type || 'info')
			onPressCallbackRef.current = config.onPress
			setVisible(true)
		}
	}))

	const handlePress = () => {
		setVisible(false)
		// Call callback after a brief delay to ensure modal animation starts
		if (onPressCallbackRef.current) {
			const callback = onPressCallbackRef.current
			setTimeout(() => {
				callback()
			}, 100)
		}
	}

	const getIconName = () => {
		switch (alertType) {
			case 'success':
				return 'checkmark-circle'
			case 'error':
				return 'close-circle'
			case 'warning':
				return 'warning'
			case 'info':
			default:
				return 'information-circle'
		}
	}

	const getIconColor = () => {
		switch (alertType) {
			case 'success':
				return CMConstants.color.green // Green for success
			case 'error':
				return CMConstants.color.red // Red for error
			case 'warning':
				return CMConstants.color.orange // Orange for warning
			case 'info':
			default:
				return CMConstants.color.denim // Blue for info
		}
	}

	const getBorderColor = () => {
		switch (alertType) {
			case 'success':
				return CMConstants.color.green // Green for success
			case 'error':
				return CMConstants.color.red // Red for error
			case 'warning':
				return CMConstants.color.orange // Orange for warning
			case 'info':
			default:
				return CMConstants.color.denim // Blue for info
		}
	}

	const getButtonColor = () => {
		switch (alertType) {
			case 'success':
				return CMConstants.color.green // Green for success
			case 'error':
				return CMConstants.color.red // Red for error
			case 'warning':
				return CMConstants.color.orange // Orange for warning
			case 'info':
			default:
				return CMConstants.color.denim // Blue for info
		}
	}

	const isDarkMode = themeMode === CMConstants.themeMode.dark
	const modalBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const titleColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const messageColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey

	return (
		<Modal
			animationType="fade"
			transparent={true}
			visible={visible}
			onRequestClose={handlePress}
		>
			<View style={styles.overlay}>
				<View style={[
					styles.modalContainer,
					{
						backgroundColor: modalBackgroundColor,
						borderColor: getBorderColor(),
						shadowColor: getBorderColor()
					}
				]}>
					{/* Icon */}
					<View style={styles.iconContainer}>
						<Ionicons
							name={getIconName()}
							size={40}
							color={getIconColor()}
						/>
					</View>

					{/* Title */}
					{title && (
						<Text style={[styles.title, { color: titleColor }]}>{title}</Text>
					)}

					{/* Message */}
					<Text style={[styles.message, { color: messageColor }]}>{message}</Text>

					{/* OK Button */}
					<CMRipple
						containerStyle={[styles.button, { backgroundColor: getButtonColor(), shadowColor: getButtonColor() }]}
						onPress={handlePress}
						color={CMConstants.color.white}
					>
						<Text style={styles.buttonText}>{buttonText}</Text>
					</CMRipple>
				</View>
			</View>
		</Modal>
	)
})

CMAlertModal.displayName = 'CMAlertModal'

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: CMConstants.color.alphaModal,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: CMConstants.space.normal,
	},
	modalContainer: {
		borderRadius: CMConstants.radius.normal + 8,
		paddingHorizontal: CMConstants.space.normal + 8,
		paddingVertical: CMConstants.space.normal,
		width: '100%',
		maxWidth: 500,
		borderWidth: 2,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 12,
		elevation: 10,
		alignItems: 'center',
	},
	iconContainer: {
		marginBottom: CMConstants.space.small,
	},
	title: {
		fontSize: CMConstants.fontSize.largeEx,
		fontFamily: CMConstants.font.bold,
		textAlign: 'center',
		marginBottom: CMConstants.space.smallEx,
	},
	message: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.regular,
		textAlign: 'center',
		marginBottom: CMConstants.space.normal,
		lineHeight: 22,
	},
	button: {
		paddingHorizontal: CMConstants.space.normal,
		paddingVertical: CMConstants.space.smallEx - 4,
		borderRadius: CMConstants.radius.normal,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
		minHeight: 36,
	},
	buttonText: {
		color: CMConstants.color.white,
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.bold,
		letterSpacing: 0.5,
	},
})

export default CMAlertModal


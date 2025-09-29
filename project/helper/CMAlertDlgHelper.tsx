import {Alert} from 'react-native'
import CMConstants from '../CMConstants'
import CMAlertManager from './CMAlertManager'
import { AlertType } from '../components/CMAlertModal'

export default {
	showAlertWithOK: (message: string, callback?: Function) => {
		// Detect error/warning messages and set type accordingly
		const errorKeywords = [
			'wrong', 'error', 'failed', 'invalid', 'incorrect', 'not found', 'cannot', 'unable', 'denied', 'permission',
			'should be', 'must be', 'required', 'numeric', 'minimum', 'maximum', 'at least', 'at most',
			'please enter', 'please provide', 'please select', 'missing', 'empty', 'not provided',
			'not valid', 'invalid format', 'format', 'not allowed', 'not permitted'
		]
		const successKeywords = ['success', 'successfully', 'created', 'updated', 'saved', 'deleted', 'added', 'completed']
		const lowerMessage = message.toLowerCase()
		const isError = errorKeywords.some(keyword => lowerMessage.includes(keyword))
		const isSuccess = successKeywords.some(keyword => lowerMessage.includes(keyword))
		
		let alertType: AlertType = 'info'
		if (isError) {
			alertType = 'error'
		} else if (isSuccess) {
			alertType = 'success'
		}
		
		CMAlertManager.show({
			title: CMConstants.appName,
			message: message,
			onPress: callback,
			buttonText: CMConstants.string.ok,
			type: alertType
		})
	},

	showConfirmAlert: (title: string, message: string, callback: Function, yesTitle?: string, noTitle?: string) => {
		// For confirm alerts, we'll still use native Alert for now
		// as it requires two buttons. Can be enhanced later if needed.
		Alert.alert(title, message, [
			{
				text: noTitle ?? CMConstants.string.cancel,
				onPress: () => {
					callback(false)
				}
			},
			{
				text: yesTitle ?? CMConstants.string.yes,
				onPress: () => {
					callback(true)
				}
			}
		])
	}
}
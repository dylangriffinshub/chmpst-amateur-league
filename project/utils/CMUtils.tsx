import {Platform} from 'react-native'
import Moment from 'moment'
import CMConstants from "../CMConstants"

const isLightMode = (themeMode: string) => {
	return themeMode === CMConstants.themeMode.light
}

export default {
	isIOS: Platform.OS === 'ios',
	isAndroid: Platform.OS === 'android',

	isLightMode: isLightMode,

	statusBarStyleWith: (themeMode: string) => {
		return isLightMode(themeMode) ? 'dark-content' : 'light-content'
	},
	
	colorWithBlackWhite: (themeMode: string) => {
		return isLightMode(themeMode) ? CMConstants.color.black : CMConstants.color.white
	},

	colorWithWhiteBlack: (themeMode: string) => {
		return isLightMode(themeMode) ? CMConstants.color.white : CMConstants.color.black
	},

	colorWith: (themeMode: string, colorForLight: string, colorForDark: string) => {
		return isLightMode(themeMode) ? colorForLight : colorForDark
	},

	isValidEmail: (email: string) => {
		const regexp = new RegExp(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)

        return regexp.test(email)
    },

	strDateOfBirthday: (date: Date) => {
		Moment.locale('en')
		return Moment(date).format('ddd, D MMM YYYY')
	},

	strSimpleDate: (date: Date) => {
		Moment.locale('en')
		return Moment(date).format('MM/DD/YYYY')
	},

	strTimeFromDate: (date: Date) => {
		Moment.locale('en')
		return Moment(date).format('h:mm a')
	},

	strDateFromDate: (date: Date) => {
		Moment.locale('en')
		return Moment(date).format('D MMM, YYYY')
	},

	strUpcomingDateFromDate: (date: Date) => {
		Moment.locale('en')
		return Moment(date).format('h:mm a | D MMM YYYY')
	},

	localFilePathByOS: (filePath: string) => {
		return Platform.OS === 'ios' ? filePath.replace('file://', '') : filePath
	},

	isNumeric: (num: number) => {
		return !isNaN(num)
	},
}
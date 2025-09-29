import AsyncStorage from '@react-native-async-storage/async-storage'
import CMConstants from '../CMConstants'

export default {
	setUserCredentials: (userData: {[name: string]: any}) => {
		AsyncStorage.setItem('credentials', JSON.stringify(userData))
	},
	getUserCredentials: (callback: Function) => {
		AsyncStorage.getItem('credentials').then(credentials => {
			if (credentials !== null) {
				callback(true, JSON.parse(credentials))
			} else {
				callback(false)
			}
		})
	},
	removeUserCredentials: (callback?: Function) => {
		AsyncStorage.removeItem('credentials').then(error => {
			callback && callback(true)
		})
	},
	setThemeMode: (themeMode: string) => {
		AsyncStorage.setItem('themeMode', themeMode)
	},
	getThemeMode: (callback: Function) => {
		AsyncStorage.getItem('themeMode').then(themeMode => {
			if (themeMode !== null) {
				callback(true, themeMode)
			} else {
				callback(false, CMConstants.themeMode.light)
			}
		})
	},
	setAppleSignInAuth: (authData: {idToken: string, refreshToken: string, userId: string, email: string}) => {
		AsyncStorage.setItem('appleSignInAuth', JSON.stringify(authData))
	},
	getAppleSignInAuth: (callback: Function) => {
		AsyncStorage.getItem('appleSignInAuth').then(authData => {
			if (authData !== null) {
				callback(true, JSON.parse(authData))
			} else {
				callback(false, null)
			}
		})
	},
	removeAppleSignInAuth: (callback?: Function) => {
		AsyncStorage.removeItem('appleSignInAuth').then(() => {
			callback && callback(true)
		})
	}
}

import {StatusBar} from 'react-native'
import CMUtils from '../utils/CMUtils'

export default {
	updateStatusBarStyle: (themeMode: string) => {
		StatusBar.setBarStyle(CMUtils.statusBarStyleWith(themeMode), true)
		if (CMUtils.isAndroid) {
			StatusBar.setBackgroundColor(CMUtils.colorWithWhiteBlack(themeMode))
		}
	}
}
import React, {useEffect} from 'react'
import {View, TextStyle} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMUtils from '../utils/CMUtils'
import { AutoSizeText, ResizeTextMode } from 'react-native-auto-size-text'

const CMSplashScreen = ({navigation}: CMNavigationProps) => {
	useEffect(() => {
		setTimeout(() => {
			navigation.replace('Auth')
		}, 2000)
	}, [])

	return (
		<View style={CMCommonStyles.bodyMain(CMConstants.themeMode.light)}>
			<AutoSizeText
				style={styles.title(CMConstants.themeMode.light)}
				fontSize={128}
				numberOfLines={1}
				mode={ResizeTextMode.max_lines}>
				CHMPST
			</AutoSizeText>
		</View>
	)
}

const styles = {
	title: (themeMode: string) => ({
		...CMCommonStyles.textLargeExBold(CMConstants.themeMode.light),
		color: CMUtils.colorWith(themeMode, CMConstants.color.black, CMConstants.color.white),
		alignSelf: 'center',
		bottom: '10%',
		marginHorizontal: '15%'
	} as TextStyle),
}

export default CMSplashScreen

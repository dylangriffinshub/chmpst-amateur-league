import {StyleSheet, Platform, ViewStyle, TextStyle, ImageStyle} from 'react-native'
import CMConstants from '../CMConstants'
import CMUtils from '../utils/CMUtils'

const styles = {
	dropDownStyle: {
		height: CMConstants.height.textInput,
		borderColor: CMConstants.color.lightGrey,
		borderRadius: CMConstants.radius.normal,
	},
	dropDownContainerStyle: {
		borderColor: CMConstants.color.lightGrey,
	}
}

const buttonMain = {
	backgroundColor: CMConstants.color.grey,
	borderWidth: 0,
	height: CMConstants.height.buttonNormal,
	alignItems: 'center',
	justifyContent: 'center',
	borderRadius: CMConstants.radius.smallEx
}

const buttonText = {
	color: CMConstants.color.white,
	fontSize: CMConstants.fontSize.normal,
	fontFamily: CMConstants.font.semiBold,
	marginHorizontal: CMConstants.space.smallEx,
	includeFontPadding: false
}

const buttonSecond = {
	backgroundColor: CMConstants.color.white,
	borderWidth: 1,
	height: CMConstants.height.buttonNormal,
	alignItems: 'center',
	justifyContent: 'center',
	borderRadius: CMConstants.radius.smallEx
}

const buttonSecondText = {
	color: CMConstants.color.black,
	fontSize: CMConstants.fontSize.normal,
	fontFamily: CMConstants.font.semiBold,
	marginHorizontal: CMConstants.space.smallEx,
	includeFontPadding: false
}

const textNormalRegular = (themeMode: string) => ({
	color: CMUtils.colorWithBlackWhite(themeMode),
	fontFamily: CMConstants.font.regular,
	fontSize: CMConstants.fontSize.normal,
	includeFontPadding: false
})

const textNormalSemiBold = (themeMode: string) => ({
	...textNormalRegular(themeMode),
	fontFamily: CMConstants.font.semiBold
})

const textLargeBold = (themeMode: string) => ({
	...textNormalRegular(themeMode),
	fontFamily: CMConstants.font.bold,
	fontSize: CMConstants.fontSize.large
})

const textLargeExBold = (themeMode: string) => ({
	color: CMUtils.colorWithBlackWhite(themeMode),
	fontFamily: CMConstants.font.bold,
	fontSize: CMConstants.fontSize.largeEx,
	includeFontPadding: false
})

const textSmall = (themeMode: string) => ({
	...textNormalRegular(themeMode),
	fontSize: CMConstants.fontSize.small
})

const textSmallBold = (themeMode: string) => ({
	...textNormalRegular(themeMode),
	fontSize: CMConstants.fontSize.small,
	fontFamily: CMConstants.font.bold
})

const textSmallEx = (themeMode: string) => ({
	...textNormalRegular(themeMode),
	fontSize: CMConstants.fontSize.smallEx
})

const circle = (radius: number) => ({
	borderRadius: radius,
	width: radius,
	height: radius
})

const roundedRectangle = (radius: number, width: number, height: number) => ({
	borderRadius: radius,
	width: width,
	height: height
})

const flexRowCenter = {
	flexDirection: 'row',
	alignItems: 'center'
} as ViewStyle

export default {
	body: {
		alignContent: 'center',
		marginHorizontal: CMConstants.space.normal
	} as ViewStyle,
	bodyMain: (themeMode: string): ViewStyle => ({
		flex: 1,
		justifyContent: 'center',
		alignContent: 'center',
		backgroundColor: CMUtils.colorWithWhiteBlack(themeMode)
	}),
	buttonMain: buttonMain,
	buttonMainText: {
		...buttonText,
		fontSize: CMConstants.fontSize.normal
	},
	buttonSecond: buttonSecond,
	buttonSecondText: {
		...buttonSecondText,
		fontSize: CMConstants.fontSize.normal
	},
	flexRowCenter: flexRowCenter,
	dropDownStyle: styles.dropDownStyle,
	dropDownContainerStyle: styles.dropDownContainerStyle,
	textInput: (themeMode: string) => ({
		...textNormalRegular(themeMode),
		height: CMConstants.height.textInput,
		backgroundColor: CMUtils.colorWith(themeMode, CMConstants.color.white, CMConstants.color.darkGrey),
		paddingHorizontal: CMConstants.space.smallEx,
		borderWidth: 1,
		borderRadius: CMConstants.radius.smallEx,
		borderColor: CMConstants.color.lightGrey
	}),

	textNormal: textNormalRegular,
	textLargeExBold: textLargeExBold,
	textNormalSemiBold: textNormalSemiBold,
	textLarge: (themeMode: string) => ({
		...textNormalRegular(themeMode),
		fontSize: CMConstants.fontSize.large
	}),
	textLargeBold: textLargeBold,
	textSmall: textSmall,
	textSmallBold: textSmallBold,
	textSmallEx: textSmallEx,

	circle: (radius: number) => circle(radius),

	title: (themeMode: string) => ({
		...textLargeBold(themeMode),
		color: CMUtils.colorWith(themeMode, CMConstants.color.semiDarkGrey, CMConstants.color.lightGrey),
	} as TextStyle),
	label: (themeMode: string) => ({
		...textNormalSemiBold(themeMode),
		color: CMUtils.colorWith(themeMode, CMConstants.color.semiDarkGrey, CMConstants.color.lightGrey),
	} as TextStyle),

	addModalContentViewStyle: (themeMode: string) => {
		return{
			paddingBottom: CMConstants.space.normal,
			paddingHorizontal: CMConstants.space.small,
			borderRadius: CMConstants.radius.normal, overflow: 'hidden',
			backgroundColor: CMUtils.isLightMode(themeMode) ? CMConstants.color.white : CMConstants.color.semiDarkGrey
		} as ViewStyle
	},

	profileImageContainer: (radius: number, border: boolean) => {
		return {
			...circle(radius),
			borderColor:  CMConstants.color.lightGrey,
			// backgroundColor: 'transparent',
			borderWidth: border ? 1 : 0,
			overflow: 'hidden'
		} as ViewStyle
	},
	profileImage: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover',
		position: 'absolute'
	} as ImageStyle
}
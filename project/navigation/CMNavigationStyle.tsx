import CMConstants from "../CMConstants";
import CMUtils from "../utils/CMUtils";

export default {
	header: (themeMode: string) => ({
		headerStyle: {
			backgroundColor: CMUtils.colorWithWhiteBlack(themeMode), //Set Header color
			borderBottomWidth: 1,
			borderBottomColor: CMUtils.colorWith(themeMode, CMConstants.color.lightGrey, CMConstants.color.grey),
			elevation: 0,
			shadowOpacity: 0
		},
		headerTintColor: CMUtils.colorWithBlackWhite(themeMode), //Set Header text color
		headerTitleStyle: {
			fontFamily: CMConstants.font.bold //Set Header text style
		}
	})
}
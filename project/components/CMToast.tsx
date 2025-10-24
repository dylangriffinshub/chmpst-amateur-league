import CMConstants from "../CMConstants"

export const CMToastType = {
	success: 'success',
	error: 'danger'
}

export const CMToastLength = {
	short: 3000,
	long: 5000
}

export default {
	makeText: (toast: any, text: string, type: string = CMToastType.success, length: number = 2000) => {
		toast.show(text, {
			type: type,
			successColor: CMConstants.color.darkCerulean,
			dangerColor: CMConstants.color.fireBrick,
			duration: length,
			textStyle: {
				fontSize: CMConstants.fontSize.normal,
				fontFamily: CMConstants.font.regular
			}
		})
	}
}

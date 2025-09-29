import ImagePicker from 'react-native-image-crop-picker'

export default {
	showImagePicker: (index: number, callback: Function, imageSize: {[name: string]: number} = {width: 400, height: 400}, cropping = true) => {
		if (index === 0) {
			ImagePicker.openCamera({
				width: imageSize.width,
				height: imageSize.height,
				cropping: cropping
			})
			.then(image => {
				callback(true, {
					path: image.path,
					width: image.width,
					height: image.height,
					mime: image.mime || 'image/jpeg' // Include mime type
				})
			})
			.catch(error => {
				callback(false, error)
			})
		} else if (index === 1) {
			ImagePicker.openPicker({
				width: imageSize.width,
				height: imageSize.height,
				cropping: cropping
			})
			.then(image => {
				callback(true, {
					path: image.path,
					width: image.width,
					height: image.height,
					mime: image.mime || 'image/jpeg' // Include mime type
				})
			})
			.catch(error => {
				callback(false, error)
			})
		}
	}
}

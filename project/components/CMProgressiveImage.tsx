import React, { useState } from 'react'
import { Image } from 'react-native'

const CMProgressiveImage = (props: any) => {
	const [showDefault, setShowDefault] = useState(true)
	const [error, setError] = useState(false)

	const { style, imgURL, isUser = false } = props

	const placeHolderImage = isUser ? require('../../assets/images/img_user_avatar.jpeg') : require('../../assets/images/img_photo_placeholder.jpeg')
	const image = showDefault ? placeHolderImage : (error ? placeHolderImage : (imgURL ? {uri: imgURL} : placeHolderImage))

	return (
		<Image
			style={style}
			source={image}
			onLoadEnd={() => setShowDefault(false)}
			onError={() => setError(true)}
			resizeMode='cover'
		/>
	)
}

export default CMProgressiveImage
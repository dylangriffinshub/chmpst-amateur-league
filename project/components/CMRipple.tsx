import React from 'react'
import Ripple from 'react-native-advanced-ripple'
import CMConstants from '../CMConstants'

const CMRipple = (props: any) => {
	const {
		containerStyle = {},
		onPress,
		color = CMConstants.color.black,
		delay = false
	} = props

	return (
		<Ripple
			containerStyle={[containerStyle, {overflow: 'hidden'}]}
			onPress={() => {
				if (onPress) {
					if (delay) {
						setTimeout(() => onPress(), 200)
					} else {
						onPress()
					}
				}
			}}
			color={color}
		>
			{props.children}
		</Ripple>
	)
}

export default CMRipple
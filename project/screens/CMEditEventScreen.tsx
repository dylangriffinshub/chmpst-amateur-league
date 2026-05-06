import React, {useState, useEffect} from 'react'
import {View, SafeAreaView, Text, Keyboard} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import { Timestamp } from '@react-native-firebase/firestore'
import CMRipple from '../components/CMRipple'
import CMConstants from '../CMConstants'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import { TextInput } from 'react-native'
import CMImagePicker from '../helper/CMImagePicker'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMProgressiveImage from '../components/CMProgressiveImage'
import CMUtils from '../utils/CMUtils'
import CMGlobal from '../CMGlobal'

const CMEditEventScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const insets = useSafeAreaInsets()
	const themeMode = CMConstants.themeMode.light
	const isEdit = route.params.isEdit

	const [profileImageChanged, setProfileImageChanged] = useState(false)
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [showTimePicker, setShowTimePicker] = useState(false)

	const [profileImagePath, setProfileImagePath] = useState(route.params.event.image ?? '')
	const [name, setName] = useState(route.params.event.name ?? '')
	const [location, setLocation] = useState(route.params.event.location ?? '')
	const [dateTime, setDateTime] = useState(route.params.event.dateTime ? route.params.event.dateTime.toDate() : new Date())

	useEffect(() => {
		navigation.setOptions({title: isEdit ? 'Edit Event' : 'Add Upcoming Event'})
	}, [])

	const onBtnProfileImage = () => {
		CMImagePicker.showImagePicker(1, (isSuccess: boolean, response: any) => {
			if (!isSuccess) {
				return
			}

			setProfileImageChanged(true)
			setProfileImagePath(response.path)
		})
	}

	const onBtnSave = () => {
		if (name.trim().length == 0) {
			CMAlertDlgHelper.showAlertWithOK(CMConstants.string.enterEventName)
			return
		}
	
		const data: {[name: string]: any} = {
			name: name,
			dateTime: Timestamp.fromDate(dateTime),
			location: location
		}
		
		const eventId = isEdit ? route.params.event.id : CMFirebaseHelper.getNewDocumentId(CMConstants.collectionName.events)

		const postUpdate = () => {
			if (isEdit) {
				CMFirebaseHelper.updateEvent(eventId, data, (response: {[name: string]: any}) => {
					setLoading(false)
					setProfileImageChanged(false)
					CMAlertDlgHelper.showAlertWithOK(response.value)
				})
			} else {
				data['id'] = eventId
				data['teamId'] = CMGlobal.user.teamId
				CMFirebaseHelper.setEvent(eventId, data, (response: {[name: string]: any}) => {
					setLoading(false)
					setProfileImageChanged(false)
					CMAlertDlgHelper.showAlertWithOK(response.value, () => {
						route.params.callback && route.params.callback()
						navigation.pop()
					})
				})
			}
		}

		setLoading(true)
		if (profileImageChanged) {
			CMFirebaseHelper.uploadImage(profileImagePath, `event_avatar/${eventId}.jpg`)
			.then(response => {
				if (response.isSuccess) {
					data['image'] = response.value
				}
				postUpdate()
			})
		} else {
			postUpdate()
		}
	}

	return (
		<SafeAreaView style={CMCommonStyles.bodyMain(themeMode)}>
			<CMLoadingDialog
				visible={loading}
			/>
			<KeyboardAwareScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={CMCommonStyles.body}
			>
				<View style={{paddingBottom: insets.bottom}}>
					<View style={{width: '100%', height: 150, alignSelf: 'center', marginVertical: CMConstants.space.normal}}>
						<CMRipple
							containerStyle={{...CMCommonStyles.profileImageContainer(CMConstants.radius.normal), width: '100%', height: '100%'}}
							onPress={onBtnProfileImage}
						>
							<CMProgressiveImage
								style={CMCommonStyles.profileImage}
								imgURL={profileImagePath}
							/>
						</CMRipple>
					</View>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx
					}}>
						<Text style={CMCommonStyles.label(themeMode)}>
							Event Name
						</Text>
					</View>
					<TextInput
						style={[CMCommonStyles.textInput(themeMode), {marginTop: 4}]}
						defaultValue={name}
						onChangeText={text => setName(text)}
						placeholder=""
						placeholderTextColor={CMConstants.color.grey}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="done"
						onSubmitEditing={Keyboard.dismiss}
						underlineColorAndroid="#f000"
						submitBehavior='submit'
					/>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx
					}}>
						<Text style={CMCommonStyles.label(themeMode)}>
							Event Date
						</Text>
					</View>
					<CMRipple
						containerStyle={[CMCommonStyles.textInput(themeMode), {flexDirection: 'row', alignItems: 'center', marginTop: 4}]}
						onPress={() => setShowDatePicker(true)}
					>
						<Text style={CMCommonStyles.textNormal(themeMode)}>
							{CMUtils.strDateOfBirthday(dateTime)}
						</Text>
						<View style={{flex: 1}}/>
						<Ionicons
							name={"calendar-outline"}
							size={CMConstants.height.icon}
							color={CMConstants.color.black}
						/>
					</CMRipple>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx
					}}>
						<Text style={CMCommonStyles.label(themeMode)}>
							Event Time
						</Text>
					</View>
					<CMRipple
						containerStyle={[CMCommonStyles.textInput(themeMode), {flexDirection: 'row', alignItems: 'center', marginTop: 4}]}
						onPress={() => setShowTimePicker(true)}
					>
						<Text style={CMCommonStyles.textNormal(themeMode)}>
							{CMUtils.strTimeFromDate(dateTime)}
						</Text>
						<View style={{flex: 1}}/>
						<Ionicons
							name={"time-outline"}
							size={CMConstants.height.icon}
							color={CMConstants.color.black}
						/>
					</CMRipple>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx
					}}>
						<Text style={CMCommonStyles.label(themeMode)}>
							Location
						</Text>
					</View>
					<TextInput
						style={[CMCommonStyles.textInput(themeMode), {marginTop: 4}]}
						defaultValue={location}
						onChangeText={text => setLocation(text)}
						placeholder=""
						placeholderTextColor={CMConstants.color.grey}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="done"
						onSubmitEditing={Keyboard.dismiss}
						underlineColorAndroid="#f000"
						submitBehavior='submit'
					/>
					<View style={{flexDirection: 'row', marginTop: CMConstants.space.normal}}>
						<CMRipple
							containerStyle={{...CMCommonStyles.buttonMain, flex: 1}}
							onPress={onBtnSave}
						>
							<Text style={CMCommonStyles.buttonMainText}>{isEdit ? 'Save' : 'Add Event'}</Text>
						</CMRipple>
					</View>
				</View>
			</KeyboardAwareScrollView>
			<DateTimePickerModal
				isVisible={showDatePicker}
				mode='date'
				date={dateTime}
				onCancel={()=>setShowDatePicker(false)}
				onConfirm={(date)=>{
					setShowDatePicker(false)
					setDateTime(date)
				}}
			/>
			<DateTimePickerModal
				isVisible={showTimePicker}
				mode='time'
				date={dateTime}
				onCancel={()=>setShowTimePicker(false)}
				onConfirm={(date)=>{
					setShowTimePicker(false)
					setDateTime(date)
				}}
			/>
		</SafeAreaView>
	)
}

const styles = {

}

export default CMEditEventScreen

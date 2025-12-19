import React, {useState, useEffect} from 'react'
import {SafeAreaView, TextStyle, View, Text, FlatList} from 'react-native'
import { getAuth } from '@react-native-firebase/auth'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import {useToast} from 'react-native-toast-notifications'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMUtils from '../utils/CMUtils'
import CMRipple from '../components/CMRipple'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMToast from '../components/CMToast'
import CMTeamCell from '../components/CMTeamCell'
import CMProfileImage from '../components/CMProfileImage'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'


const CMTeamManagementTabScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)
	const [teams, setTeams] = useState<{[name: string]: any}[]>([])
	const [refreshingTeams, setRefreshingTeams] = useState(false)
	const insets = useSafeAreaInsets()

	const toast = useToast()

	const themeMode = CMConstants.themeMode.light
	

	const loadTeams = () => {
		setRefreshingTeams(true)
		// Load all teams from the teams collection
		CMFirebaseHelper.getAllTeams((response: {[name: string]: any}) => {
			setRefreshingTeams(false)
			if (response.isSuccess) {
				setTeams(response.value)
			} else {
				CMToast.makeText(toast, response.value)
			}
		})
	}

	const onEditTeam = (team: {[name: string]: any}) => {
		navigation.navigate(CMConstants.screenName.editTeam, {
			isEdit: true,
			team: team
		})
	}

	const onDeleteTeam = (team: {[name: string]: any}) => {
		CMAlertDlgHelper.showConfirmAlert(
			'Delete Team',
			`Are you sure you want to delete "${team.name}"? This will permanently delete the team and ALL associated data. This action cannot be undone.`,
			() => {
				setLoading(true)
				CMFirebaseHelper.deleteTeamWithAssociatedData(team.id, (response: {[name: string]: any}) => {
					setLoading(false)
					if (response.isSuccess) {
						CMToast.makeText(toast, response.value)
						// Reload teams list after successful deletion
						loadTeams()
					} else {
						CMToast.makeText(toast, response.value)
					}
				})
			}
		)
	}

	const onViewTeam = (team: {[name: string]: any}) => {
		navigation.navigate(CMConstants.screenName.teamManagement, {
			team: team
		})
	}

	useEffect(() => {
		// Load data when screen comes into focus
		const unsubscribe = navigation.addListener('focus', loadTeams)
		
		// Load data initially
		loadTeams()

		return unsubscribe
	}, [navigation])

	return (
		<SafeAreaView style={CMCommonStyles.bodyMain(themeMode)}>
			<CMLoadingDialog
				visible={loading}
			/>
			<View style={{...CMCommonStyles.body, flex: 1}}>
				<View style={{backgroundColor: CMUtils.colorWithWhiteBlack(themeMode), height: CMConstants.height.navBar, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: CMUtils.isAndroid ? insets.top : 0, zIndex: 10}}>
					<Text style={CMCommonStyles.title(themeMode)}>
						{ "Team Management"}
					</Text>
					<CMRipple
						containerStyle={{...CMCommonStyles.circle(CMConstants.height.iconBig), position: 'absolute', justifyContent: 'center', alignItems: 'center', right: 0}}
						onPress={() => {
							// Create new team
							navigation.navigate(CMConstants.screenName.editTeam, {
								isEdit: false,
								team: {}
							})
						}}
					>
						<Ionicons
							name={"add-outline"}
							size={CMConstants.height.iconBig}
							color={CMConstants.color.black}
						/>
					</CMRipple>
				</View>
				<View style={{flex: 1, }}>
					<FlatList
						style={{flex: 1, marginTop: CMConstants.space.smallEx, marginBottom: insets.bottom}}
						refreshing={refreshingTeams}
						onRefresh={loadTeams}
						initialNumToRender={teams.length}
						data={teams}
						renderItem={({ item, separators }) => (
							<CMTeamCell
								team={item}
								onPress={() => onViewTeam(item)}
								onView={() => onViewTeam(item)}
								onEdit={() => onEditTeam(item)}
								onDelete={() => onDeleteTeam(item)}
							/>
						)}
						ItemSeparatorComponent={({ highlighted }) => (
							<View style={{ height: CMConstants.space.smallEx }} />
						)}
						showsVerticalScrollIndicator={false}
					/>
				</View>
			</View>
		</SafeAreaView>
	)
}

const styles = {
	title: (themeMode: string) => ({
		...CMCommonStyles.textLargeExBold(CMConstants.themeMode.light),
		color: CMUtils.colorWith(themeMode, CMConstants.color.black, CMConstants.color.white),
		alignSelf: 'center',
		bottom: '10%',
		marginHorizontal: '15%'
	} as TextStyle)
}

export default CMTeamManagementTabScreen

import React, {useState, useEffect, useLayoutEffect, useCallback} from 'react'
import {SafeAreaView, FlatList, View} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMPlayerCell from '../components/CMPlayerCell'
import CMRipple from '../components/CMRipple'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMToast from '../components/CMToast'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import {useToast} from 'react-native-toast-notifications'
import CMPermissionHelper from '../helper/CMPermissionHelper'

const CMPlayersOfTeamScreen = ({navigation, route}: CMNavigationProps) => {
	const [players, setPlayers] = useState<{[name: string]: any}[]>(route.params.players)
	const [loading, setLoading] = useState(false)

	const insets = useSafeAreaInsets()
	const toast = useToast()

	const themeMode = CMConstants.themeMode.light

	const team = route.params.team

	useEffect(() => {
		navigation.setOptions({title: team.name})

		const unsubscribe = navigation.addListener('focus', () => {
			CMFirebaseHelper.getPlayers([team.id], (response: {[name: string]: any}) => {
				if (response.isSuccess) {
					setPlayers(response.value)
				}
			})
		})

		return unsubscribe
	}, [navigation, team.id, team.name])

	const onEditPlayer = useCallback((player: {[name: string]: any}) => {
		console.log('onEditPlayer called with player:', player.name)
		navigation.navigate(CMConstants.screenName.editPlayer, {
			isEdit: true,
			team: team,
			player: player
		})
	}, [navigation, team])

	const onDeletePlayer = useCallback(async (player: {[name: string]: any}) => {
		console.log('onDeletePlayer called with player:', player.name)
		
		// Check permission before allowing delete (same as + button - only league creators can delete)
		const canDelete = await CMPermissionHelper.canEditPlayer(player.id, player);
		if (!canDelete) {
			CMPermissionHelper.showPermissionDenied();
			return;
		}

		CMAlertDlgHelper.showConfirmAlert(
			'Delete Player',
			`Are you sure you want to delete "${player.name}"? This action cannot be undone.`,
			(confirmed: boolean) => {
				console.log('Delete confirmation result:', confirmed)
				if (confirmed) {
					setLoading(true)
					CMFirebaseHelper.updatePlayer(player.id, { deleted: true }, (response: {[name: string]: any}) => {
						setLoading(false)
						if (response.isSuccess) {
							CMToast.makeText(toast, response.value)
							// Reload players list after successful deletion
							CMFirebaseHelper.getPlayers([team.id], (response: {[name: string]: any}) => {
								if (response.isSuccess) {
									setPlayers(response.value)
								}
							})
						} else {
							CMToast.makeText(toast, response.value)
						}
					})
				}
			}
		)
	}, [team, toast])

	useLayoutEffect(() => {
		navigation.setOptions({
			headerRight: () => (
				<View style={{flexDirection: 'row', marginRight: CMConstants.space.small}}>
					<CMRipple
						containerStyle={{...CMCommonStyles.circle(CMConstants.height.iconBig), justifyContent: 'center', alignItems: 'center'}}
						onPress={() => {
							navigation.navigate(CMConstants.screenName.editPlayer, {isEdit: false, team: team, player: {}})
						}}
					>
						<Ionicons
							name={"add-outline"}
							size={CMConstants.height.icon}
							color={CMConstants.color.black}
						/>
					</CMRipple>
				</View>
			),
		})
	}, [route, navigation])

	return (
		<SafeAreaView style={CMCommonStyles.bodyMain(themeMode)}>
			<CMLoadingDialog
				visible={loading}
			/>
			<FlatList
				style={{flex: 0, marginHorizontal: CMConstants.space.small, marginTop: CMConstants.space.small, marginBottom: insets.bottom}}
				initialNumToRender={players.length}
				data={players}
				renderItem={({ item, separators }) => {
					console.log('Rendering player:', item.name, 'with callbacks:', !!onEditPlayer, !!onDeletePlayer)
					console.log('onEditPlayer function:', onEditPlayer)
					console.log('onDeletePlayer function:', onDeletePlayer)
					
					return (
						<CMPlayerCell
							player={item}
							onPress={() => {
								navigation.navigate(CMConstants.screenName.editPlayer, {isEdit: true, team: team, player: item})
							}}
							onEdit={() => onEditPlayer(item)}
							onDelete={() => onDeletePlayer(item)}
						/>
					)
				}}
				ItemSeparatorComponent={({ highlighted }) => (
					<View style={{height: CMConstants.space.smallEx}} />
				)}
			/>
		</SafeAreaView>
	)
}

const styles = {

}

export default CMPlayersOfTeamScreen

import React, {useState, useEffect} from 'react'
import {View, SafeAreaView, Text, Keyboard, Dimensions} from 'react-native'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DatePicker from 'react-native-neat-date-picker'
import CMRipple from '../components/CMRipple'
import CMConstants from '../CMConstants'
import CMGlobal from '../CMGlobal'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import { TextInput } from 'react-native'
import CMUtils from '../utils/CMUtils'
import { Timestamp } from '@react-native-firebase/firestore'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMDropDownPicker from '../components/CMDropDownPicker'
import CMPermissionHelper from '../helper/CMPermissionHelper'

const CMEditPlayerStatsScreen = ({navigation, route}: CMNavigationProps) => {
	const [loading, setLoading] = useState(false)

	const [playerId, setPlayerId] = useState(route.params.playerStat.playerId ?? undefined)
	const [leagueId, setLeagueId] = useState(route.params.playerStat.leagueId ?? undefined)
	const [matchId, setMatchId] = useState(route.params.playerStat.matchId ?? undefined)
	const [dayTime, setDayTime] = useState(route.params.playerStat.dayTime ? route.params.playerStat.dayTime.toDate() : new Date())
	const [pointsPerGame, setPointsPerGame] = useState(`${route.params.playerStat.pointsPerGame ?? ''}`)
	const [assists, setAssists] = useState(`${route.params.playerStat.assists ?? ''}`)
	const [rebounds, setRebounds] = useState(`${route.params.playerStat.rebounds ?? ''}`)
	const [turnovers, setTurnovers] = useState(`${route.params.playerStat.turnovers ?? ''}`)
	const [steals, setSteals] = useState(`${route.params.playerStat.steals ?? ''}`)
	const [blocks, setBlocks] = useState(`${route.params.playerStat.blocks ?? ''}`)

	const isEdit = route.params.isEdit

	const [playerItems, setPlayerItems] = useState([])
	const [leagueItems, setLeagueItems] = useState([])
	const [matchItems, setMatchItems] = useState([])
	const [playerOpen, setPlayerOpen] = useState(false)
	const [leagueOpen, setLeagueOpen] = useState(false)
	const [matchOpen, setMatchOpen] = useState(false)
	const [showDatePicker, setShowDatePicker] = useState(false)

	const insets = useSafeAreaInsets()

	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Get screen dimensions for responsive design
	const screenWidth = Dimensions.get('window').width
	const isSmallDevice = screenWidth < 375
	const isLargeDevice = screenWidth > 414
	const fontScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.15 : 1.0
	const buttonHeightScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0
	const iconScale = isSmallDevice ? 0.9 : isLargeDevice ? 1.1 : 1.0

	// Dynamic colors based on theme
	const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
	const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white
	const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
	const labelColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
	const borderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
	const calendarIconColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black

	// Listen for theme changes
	useEffect(() => {
		// Check theme on mount
		setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
		
		// Poll for theme changes (check every 200ms)
		const interval = setInterval(() => {
			const currentTheme = CMGlobal.themeMode || CMConstants.themeMode.light;
			if (currentTheme !== themeMode) {
				setThemeMode(currentTheme);
			}
		}, 200);
		
		// Also listen for navigation focus as fallback
		const unsubscribe = navigation.addListener('focus', () => {
			setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light);
		});
		
		return () => {
			clearInterval(interval);
			unsubscribe();
		};
	}, [navigation, themeMode])

	const onBtnSave = async () => {
		if (!playerId) {
			CMAlertDlgHelper.showAlertWithOK('Please select player.')
			return
		}
		if (!leagueId) {
			CMAlertDlgHelper.showAlertWithOK('Please select league.')
			return
		}
		if (!matchId) {
			CMAlertDlgHelper.showAlertWithOK('Please select match.')
			return
		}

		// Check permissions before saving (for editing, check if user can edit the match)
		if (isEdit && route.params.playerStat?.matchId) {
			const canEdit = await CMPermissionHelper.canEditMatch(route.params.playerStat.matchId);
			if (!canEdit) {
				CMPermissionHelper.showPermissionDenied(navigation);
				return;
			}
		} else if (!isEdit && matchId) {
			// For new stats, check if user can edit the selected match
			const canEdit = await CMPermissionHelper.canEditMatch(matchId);
			if (!canEdit) {
				CMPermissionHelper.showPermissionDenied(navigation);
				return;
			}
		}
		if (!CMUtils.isNumeric(parseFloat(pointsPerGame))) {
			CMAlertDlgHelper.showAlertWithOK('Points per game should be numeric.')
			return
		}
		if (!CMUtils.isNumeric(parseFloat(assists))) {
			CMAlertDlgHelper.showAlertWithOK('Assists should be numeric.')
			return
		}
		if (!CMUtils.isNumeric(parseFloat(rebounds))) {
			CMAlertDlgHelper.showAlertWithOK('Rebounds should be numeric.')
			return
		}
		if (!CMUtils.isNumeric(parseFloat(turnovers))) {
			CMAlertDlgHelper.showAlertWithOK('Turnovers should be numeric.')
			return
		}
		if (!CMUtils.isNumeric(parseFloat(steals))) {
			CMAlertDlgHelper.showAlertWithOK('Steals should be numeric.')
			return
		}
		if (!CMUtils.isNumeric(parseFloat(blocks))) {
			CMAlertDlgHelper.showAlertWithOK('Blocks should be numeric.')
			return
		}

		const data: {[name: string]: any} = {
			playerId: playerId,
			leagueId: leagueId,
			matchId: matchId,
			dayTime: Timestamp.fromDate(dayTime),
			pointsPerGame: parseFloat(pointsPerGame),
			assists: parseFloat(assists),
			rebounds: parseFloat(rebounds),
			turnovers: parseFloat(turnovers),
			steals: parseFloat(steals),
			blocks: parseFloat(blocks)
		}

		setLoading(true)
		if (isEdit) {
			CMFirebaseHelper.updatePlayerStat(route.params.playerStat.id, data, (response: {[name: string]: any}) => {
				setLoading(false)
				CMAlertDlgHelper.showAlertWithOK(response.value)
			})
		} else {
			const playerStatId = CMFirebaseHelper.getNewDocumentId(CMConstants.collectionName.playerStats)
			data['id'] = playerStatId
			CMFirebaseHelper.addPlayerStat(playerStatId, data, (response: {[name: string]: any}) => {
				setLoading(false)
				CMAlertDlgHelper.showAlertWithOK(response.value, () => {
					navigation.pop()
				})
			})
		}
	}

	useEffect(() => {
		navigation.setOptions({
			title: isEdit ? 'Edit Player Stats' : 'Add Player Stats',
			headerStyle: {
				backgroundColor: headerBackgroundColor,
			},
			headerTintColor: headerTextColor,
			headerTitleStyle: {
				color: headerTextColor,
				fontSize: CMConstants.fontSize.large,
				fontWeight: 'bold',
			},
		})

		setPlayerItems(route.params.players.map((player: {[name: string]: any}) => ({
			label: player.name,
			value: player.id
		})))

		CMFirebaseHelper.getLeagues((response: {[name: string]: any}) => {
			if (response.isSuccess) {
		setLeagueItems(response.value.map((league: {[name: string]: any}) => ({
			label: league.name,
			value: league.id
		})))
		}
	})
	}, [headerBackgroundColor, headerTextColor, themeMode])

	useEffect(() => {
		if (!leagueId) {
			return
		}
		
		CMFirebaseHelper.getMatches(leagueId, (response: {[name: string]: any}) => {
			if (response.isSuccess) {
				setMatchItems(response.value.map((match: {[name: string]: any}) => ({
					label: match.name,
					value: match.id
				})))

				setMatchId(undefined)
			}
		})
	}, [leagueId])

	return (
		<SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
			<CMLoadingDialog
				visible={loading}
			/>
			<KeyboardAwareScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={[CMCommonStyles.body, { backgroundColor: backgroundColor }]}
			>
				<View style={{paddingBottom: insets.bottom, backgroundColor: backgroundColor}}>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.normal,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Player
						</Text>
					</View>
					<CMDropDownPicker
						isOpened={playerOpen}
						themeMode={themeMode}
						defaultStyle={[CMCommonStyles.dropDownStyle, { backgroundColor: inputBackgroundColor, borderColor: borderColor, height: 40 * buttonHeightScale }]}
						defaultDropDownContainerStyle={[CMCommonStyles.dropDownContainerStyle, { backgroundColor: inputBackgroundColor, borderColor: borderColor }]}
						placeholder='Select Player'
						placeholderStyle={{ color: placeholderColor }}
						open={playerOpen}
						value={playerId ?? ''}
						items={playerItems}
						setOpen={setPlayerOpen}
						onSelectItem={(item: any)=>setPlayerId(item.value)}
						setItems={setPlayerItems}
						onOpen={() => {
							setLeagueOpen(false)
							setMatchOpen(false)
						}}
						textStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
						labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
						fontSize={CMConstants.fontSize.normal * fontScale}
					/>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							League
						</Text>
					</View>
					<CMDropDownPicker
						isOpened={leagueOpen}
						themeMode={themeMode}
						defaultStyle={[CMCommonStyles.dropDownStyle, { backgroundColor: inputBackgroundColor, borderColor: borderColor, height: 40 * buttonHeightScale }]}
						defaultDropDownContainerStyle={[CMCommonStyles.dropDownContainerStyle, { backgroundColor: inputBackgroundColor, borderColor: borderColor }]}
						placeholder='Select League'
						placeholderStyle={{ color: placeholderColor }}
						open={leagueOpen}
						value={leagueId ?? ''}
						items={leagueItems}
						setOpen={setLeagueOpen}
						onSelectItem={(item: any)=>setLeagueId(item.value)}
						setItems={setLeagueItems}
						onOpen={() => {
							setPlayerOpen(false)
							setMatchOpen(false)
						}}
						textStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
						labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
						fontSize={CMConstants.fontSize.normal * fontScale}
					/>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Match
						</Text>
					</View>
					<CMDropDownPicker
						isOpened={matchOpen}
						themeMode={themeMode}
						defaultStyle={[CMCommonStyles.dropDownStyle, { backgroundColor: inputBackgroundColor, borderColor: borderColor, height: 40 * buttonHeightScale }]}
						defaultDropDownContainerStyle={[CMCommonStyles.dropDownContainerStyle, { backgroundColor: inputBackgroundColor, borderColor: borderColor }]}
						placeholder='Select Match'
						placeholderStyle={{ color: placeholderColor }}
						open={matchOpen}
						value={matchId ?? ''}
						items={matchItems}
						setOpen={setMatchOpen}
						onSelectItem={(item: any)=>setMatchId(item.value)}
						setItems={setMatchItems}
						onOpen={() => {
							setPlayerOpen(false)
							setLeagueOpen(false)
						}}
						textStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
						labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.normal * fontScale }}
						fontSize={CMConstants.fontSize.normal * fontScale}
					/>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Date
						</Text>
					</View>
					<CMRipple
						containerStyle={[{backgroundColor: inputBackgroundColor, borderColor: borderColor, borderRadius: CMConstants.radius.normal, borderWidth: 1, paddingHorizontal: CMConstants.space.normal, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale, flexDirection: 'row', alignItems: 'center', marginTop: 4}]}
						onPress={() => setShowDatePicker(true)}
					>
						<Ionicons name="calendar-outline" size={20 * iconScale} color={CMConstants.color.green} style={{marginRight: CMConstants.space.smallEx, marginLeft: -4}} />
						<Text style={{color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale, flex: 1}}>
							{CMUtils.strDateOfBirthday(dayTime)}
						</Text>
						<Ionicons
							name={"chevron-forward-outline"}
							size={16 * iconScale}
							color={placeholderColor}
						/>
					</CMRipple>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Points Per Game
						</Text>
					</View>
					<View style={[{backgroundColor: inputBackgroundColor, borderColor: borderColor, borderRadius: CMConstants.radius.normal, borderWidth: 1, paddingHorizontal: CMConstants.space.normal, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale, flexDirection: 'row', alignItems: 'center', marginTop: 4}]}>
						<Ionicons name="trophy-outline" size={20 * iconScale} color={CMConstants.color.green} style={{marginRight: CMConstants.space.smallEx, marginLeft: -4}} />
						<TextInput
							style={{flex: 1, color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale, padding: 0, paddingVertical: 2}}
							defaultValue={pointsPerGame}
							onChangeText={text => setPointsPerGame(text)}
							placeholder="Enter points per game"
							placeholderTextColor={placeholderColor}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="done"
							onSubmitEditing={Keyboard.dismiss}
							underlineColorAndroid="transparent"
							submitBehavior='submit'
							keyboardType="decimal-pad"
						/>
					</View>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Assists
						</Text>
					</View>
					<View style={[{backgroundColor: inputBackgroundColor, borderColor: borderColor, borderRadius: CMConstants.radius.normal, borderWidth: 1, paddingHorizontal: CMConstants.space.normal, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale, flexDirection: 'row', alignItems: 'center', marginTop: 4}]}>
						<Ionicons name="people-outline" size={20 * iconScale} color={CMConstants.color.green} style={{marginRight: CMConstants.space.smallEx, marginLeft: -4}} />
						<TextInput
							style={{flex: 1, color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale, padding: 0, paddingVertical: 2}}
							defaultValue={assists}
							onChangeText={text => setAssists(text)}
							placeholder="Enter assists"
							placeholderTextColor={placeholderColor}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="done"
							onSubmitEditing={Keyboard.dismiss}
							underlineColorAndroid="transparent"
							submitBehavior='submit'
							keyboardType="decimal-pad"
						/>
					</View>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Rebounds
						</Text>
					</View>
					<View style={[{backgroundColor: inputBackgroundColor, borderColor: borderColor, borderRadius: CMConstants.radius.normal, borderWidth: 1, paddingHorizontal: CMConstants.space.normal, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale, flexDirection: 'row', alignItems: 'center', marginTop: 4}]}>
						<Ionicons name="arrow-down-circle-outline" size={20 * iconScale} color={CMConstants.color.green} style={{marginRight: CMConstants.space.smallEx, marginLeft: -4}} />
						<TextInput
							style={{flex: 1, color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale, padding: 0, paddingVertical: 2}}
							defaultValue={rebounds}
							onChangeText={text => setRebounds(text)}
							placeholder="Enter rebounds"
							placeholderTextColor={placeholderColor}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="done"
							onSubmitEditing={Keyboard.dismiss}
							underlineColorAndroid="transparent"
							submitBehavior='submit'
							keyboardType="decimal-pad"
						/>
					</View>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Turnovers
						</Text>
					</View>
					<View style={[{backgroundColor: inputBackgroundColor, borderColor: borderColor, borderRadius: CMConstants.radius.normal, borderWidth: 1, paddingHorizontal: CMConstants.space.normal, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale, flexDirection: 'row', alignItems: 'center', marginTop: 4}]}>
						<Ionicons name="swap-horizontal-outline" size={20 * iconScale} color={CMConstants.color.green} style={{marginRight: CMConstants.space.smallEx, marginLeft: -4}} />
						<TextInput
							style={{flex: 1, color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale, padding: 0, paddingVertical: 2}}
							defaultValue={turnovers}
							onChangeText={text => setTurnovers(text)}
							placeholder="Enter turnovers"
							placeholderTextColor={placeholderColor}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="done"
							onSubmitEditing={Keyboard.dismiss}
							underlineColorAndroid="transparent"
							submitBehavior='submit'
							keyboardType="decimal-pad"
						/>
					</View>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Steals
						</Text>
					</View>
					<View style={[{backgroundColor: inputBackgroundColor, borderColor: borderColor, borderRadius: CMConstants.radius.normal, borderWidth: 1, paddingHorizontal: CMConstants.space.normal, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale, flexDirection: 'row', alignItems: 'center', marginTop: 4}]}>
						<Ionicons name="flash-outline" size={20 * iconScale} color={CMConstants.color.green} style={{marginRight: CMConstants.space.smallEx, marginLeft: -4}} />
						<TextInput
							style={{flex: 1, color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale, padding: 0, paddingVertical: 2}}
							defaultValue={steals}
							onChangeText={text => setSteals(text)}
							placeholder="Enter steals"
							placeholderTextColor={placeholderColor}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="done"
							onSubmitEditing={Keyboard.dismiss}
							underlineColorAndroid="transparent"
							submitBehavior='submit'
							keyboardType="decimal-pad"
						/>
					</View>
					<View style={{
						flexDirection: 'row',
						marginTop: CMConstants.space.smallEx,
						marginBottom: CMConstants.space.smallEx - 2
					}}>
						<Text style={[CMCommonStyles.label(themeMode), { color: labelColor, fontSize: CMConstants.fontSize.small * fontScale }]}>
							Blocks
						</Text>
					</View>
					<View style={[{backgroundColor: inputBackgroundColor, borderColor: borderColor, borderRadius: CMConstants.radius.normal, borderWidth: 1, paddingHorizontal: CMConstants.space.normal, minHeight: 40 * buttonHeightScale, paddingVertical: (CMConstants.space.smallEx - 2) * buttonHeightScale, flexDirection: 'row', alignItems: 'center', marginTop: 4}]}>
						<Ionicons name="stop-outline" size={20 * iconScale} color={CMConstants.color.green} style={{marginRight: CMConstants.space.smallEx, marginLeft: -4}} />
						<TextInput
							style={{flex: 1, color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.normal * fontScale, padding: 0, paddingVertical: 2}}
							defaultValue={blocks}
							onChangeText={text => setBlocks(text)}
							placeholder="Enter blocks"
							placeholderTextColor={placeholderColor}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="done"
							onSubmitEditing={Keyboard.dismiss}
							underlineColorAndroid="transparent"
							submitBehavior='submit'
							keyboardType="decimal-pad"
						/>
					</View>
					<View style={{flexDirection: 'row', marginTop: CMConstants.space.normal, marginBottom: CMConstants.space.normal}}>
						<CMRipple
							containerStyle={[{
								backgroundColor: CMConstants.color.green,
								height: CMConstants.height.buttonNormal * buttonHeightScale,
								borderRadius: CMConstants.radius.normal,
								justifyContent: 'center' as const,
								alignItems: 'center' as const,
								shadowColor: CMConstants.color.green,
								shadowOffset: { width: 0, height: 4 },
								shadowOpacity: 0.4,
								shadowRadius: 8,
								elevation: 6,
								width: '100%',
							}]}
							onPress={onBtnSave}
							color={CMConstants.color.white}
						>
							<Text style={{color: CMConstants.color.white, fontSize: CMConstants.fontSize.normal * fontScale, fontFamily: CMConstants.font.bold, letterSpacing: 0.5}}>{isEdit ? 'Save' : 'Add Player Stats'}</Text>
						</CMRipple>
					</View>
				</View>
			</KeyboardAwareScrollView>
			<DatePicker
				isVisible={showDatePicker}
				mode={'single'}
				minDate={new Date(CMConstants.string.minBirthDate)}
				initialDate={dayTime}
				onCancel={()=>setShowDatePicker(false)}
				onConfirm={(output)=>{
					setShowDatePicker(false)
					setDayTime(output.date!)
				}}
			/>
		</SafeAreaView>
	)
}

const styles = {

}

export default CMEditPlayerStatsScreen
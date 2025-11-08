import React, { useState, useEffect } from 'react'
import { Text, StyleSheet, View, ScrollView, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CMConstants from '../CMConstants'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMRipple from '../components/CMRipple'
import Ionicons from 'react-native-vector-icons/Ionicons'
import CMAlertDlgHelper from '../helper/CMAlertDlgHelper'
import CMGlobal from '../CMGlobal'

interface SubscriptionTier {
	id: string
	title: string
	teamRange: string
	price: string
	description: string
	features: string[]
}

const CMPaywallModalContent = (props: any) => {
	const [selectedTier, setSelectedTier] = useState<string | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)
	const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
	const insets = useSafeAreaInsets()

	const isDarkMode = themeMode === CMConstants.themeMode.dark

	// Update theme when component mounts or theme changes
	useEffect(() => {
		setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
	}, [])

	const tiers: SubscriptionTier[] = [
		{
			id: 'tier1',
			title: 'Starter',
			teamRange: 'Up to 4 teams',
			price: '$24.99',
			description: 'Perfect for small leagues getting started',
			features: ['Manual stats entry only']
		},
		{
			id: 'tier2',
			title: 'Professional',
			teamRange: 'Up to 9 teams',
			price: '$39.99',
			description: 'Ideal for growing leagues with more teams',
			features: ['Scoreboard', 'Manual entry']
		},
		{
			id: 'tier3',
			title: 'Enterprise',
			teamRange: 'Up to 13 teams',
			price: '$54.99',
			description: 'Best for large leagues and organizations',
			features: ['Scoreboard', 'Stat sheet scanner', 'Manual entry']
		},
		{
			id: 'tier4',
			title: 'Elite',
			teamRange: 'Up to 20 teams',
			price: '$79.99',
			description: 'Ultimate solution for professional leagues',
			features: ['Scoreboard', 'Stat sheet scanner', 'Manual entry']
		}
	]

	const handleSelectTier = (tierId: string) => {
		setSelectedTier(tierId)
	}

	const handleSubscribe = async () => {
		if (selectedTier) {
		const tier = tiers.find(t => t.id === selectedTier)
			if (tier) {
				// No payment required - just proceed with selected tier
				props.callback(selectedTier, tier)
				} else {
				// Tier not found - proceed anyway (all users can create leagues)
				props.callback(null, null)
			}
		} else {
			// No tier selected - just proceed anyway (all users can create leagues)
			props.callback(null, null)
		}
	}

	const handleCancel = () => {
		props.callback(null, null)
	}

	return (
		<View style={[CMCommonStyles.bodyMain(themeMode), { 
			marginHorizontal: CMConstants.space.normal, 
			overflow: 'hidden', 
			backgroundColor: 'transparent', 
			borderRadius: CMConstants.radius.normal,
			maxHeight: '87%'
		}]}>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: insets.bottom + 80 + CMConstants.space.normal }}
			>
				<View style={[styles.modalContent, { 
					marginTop: insets.top,
					backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white,
					borderColor: CMConstants.color.green,
				}]}>
					{/* Header */}
					<View style={styles.header}>
						<Text style={[styles.title, { color: isDarkMode ? CMConstants.color.white : CMConstants.color.black }]}>
							Choose Your Plan
						</Text>
						<Text style={[styles.subtitle, { color: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey }]}>
							Select a subscription plan to create your league
						</Text>
					</View>

					{/* Pricing Tiers */}
					<View style={styles.tiersContainer}>
						{tiers.map((tier, index) => {
							const isSelected = selectedTier === tier.id
							const isMiddle = index === 2 // Popular badge on tier 3 (index 2)
							const isDarkTier = isMiddle
							
							const isSelectedYellow = isSelected && !isMiddle
							
							// Dynamic colors for tier cards
							const tierCardBackgroundColor = isDarkMode 
								? (isDarkTier ? CMConstants.color.darkGrey2 : CMConstants.color.darkGrey3)
								: (isDarkTier ? CMConstants.color.black : CMConstants.color.lightGrey2)
							const tierCardBorderColor = isSelected 
								? CMConstants.color.green 
								: (isDarkTier ? CMConstants.color.green : (isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey))
							const tierTitleColor = isSelectedYellow 
								? CMConstants.color.black 
								: (isDarkTier ? CMConstants.color.white : (isDarkMode ? CMConstants.color.white : (isDarkTier && !isDarkMode ? CMConstants.color.white : CMConstants.color.black)))
							const priceColor = isSelectedYellow 
								? CMConstants.color.black 
								: (isDarkTier ? CMConstants.color.green : (isDarkMode ? CMConstants.color.white : CMConstants.color.black))
							const pricePeriodColor = isSelectedYellow 
								? CMConstants.color.black 
								: (isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey)
							const teamRangeColor = isSelectedYellow 
								? CMConstants.color.black 
								: (isDarkTier ? CMConstants.color.green : (isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey))
							const tierDescriptionColor = isSelectedYellow 
								? CMConstants.color.black 
								: (isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey)

							return (
								<CMRipple
									key={tier.id}
									containerStyle={[
										styles.tierCard,
										{
											backgroundColor: isSelectedYellow ? CMConstants.color.yellow : tierCardBackgroundColor,
											borderColor: isSelectedYellow ? CMConstants.color.black : tierCardBorderColor,
											borderWidth: isSelected || isDarkTier ? 2 : 1,
										},
										isSelectedYellow && styles.tierCardYellow,
										(isSelected || isDarkTier) && !isSelectedYellow && styles.tierCardSelected
									]}
									onPress={() => handleSelectTier(tier.id)}
								>
									{isMiddle && (
										<View style={styles.popularBadge}>
											<Text style={styles.popularBadgeText}>POPULAR</Text>
										</View>
									)}
									
									<View style={styles.tierHeader}>
										<Text style={[
											styles.tierTitle,
											{ color: tierTitleColor }
										]}>
											{tier.title}
										</Text>
										{isSelected && (
											<Ionicons
												name="checkmark-circle"
												size={24}
												color={isSelectedYellow ? CMConstants.color.black : CMConstants.color.green}
											/>
										)}
									</View>

									<View style={styles.priceContainer}>
										<Text style={[
											styles.price,
											{ color: priceColor }
										]}>
											{tier.price}
										</Text>
										<Text style={[
											styles.pricePeriod,
											{ color: pricePeriodColor }
										]}>
											/ month
										</Text>
									</View>

									<Text style={[
										styles.teamRange,
										{ color: teamRangeColor }
									]}>
										{tier.teamRange}
									</Text>

									<Text style={[
										styles.tierDescription,
										{ color: tierDescriptionColor }
									]}>
										{tier.description}
									</Text>

									{/* Features List */}
									<View style={styles.featuresContainer}>
										{tier.features.map((feature, featureIndex) => (
											<View key={featureIndex} style={styles.featureRow}>
												<Ionicons
													name="checkmark-circle"
													size={16}
													color={isSelectedYellow ? CMConstants.color.black : CMConstants.color.green}
													style={{ marginRight: CMConstants.space.smallEx - 2 }}
												/>
												<Text style={[
													styles.featureText,
													{ color: isSelectedYellow ? CMConstants.color.black : (isDarkTier ? CMConstants.color.white : tierDescriptionColor) }
												]}>
													{feature}
												</Text>
											</View>
										))}
									</View>
								</CMRipple>
							)
						})}
					</View>

					{/* Action Buttons */}
						<CMRipple
							containerStyle={[
								styles.subscribeButton,
								{ 
									marginTop: CMConstants.space.normal,
									opacity: selectedTier ? 1 : 0.5,
									backgroundColor: selectedTier 
										? CMConstants.color.green 
										: (isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey)
								}
							]}
							onPress={handleSubscribe}
							disabled={isProcessing || !selectedTier}
						>
							{isProcessing ? (
								<ActivityIndicator color={CMConstants.color.white} />
							) : (
								<Text style={[
									styles.subscribeButtonText,
									{ color: selectedTier ? CMConstants.color.white : (isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey) }
								]}>
									Subscribe
								</Text>
							)}
						</CMRipple>

					<CMRipple
						containerStyle={[
							styles.cancelButton,
							{ 
								marginTop: CMConstants.space.smallEx,
								backgroundColor: isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.white,
								borderColor: isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey,
							}
						]}
						onPress={handleCancel}
					>
						<Text style={[styles.cancelButtonText, { color: isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey }]}>Cancel</Text>
					</CMRipple>
				</View>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	modalContent: {
		borderRadius: CMConstants.radius.normal + 8,
		paddingHorizontal: CMConstants.space.normal + 4,
		paddingVertical: CMConstants.space.normal + 8,
		borderWidth: 2,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 12,
		elevation: 10,
	},
	header: {
		alignItems: 'center',
		marginBottom: CMConstants.space.normal,
	},
	title: {
		fontSize: CMConstants.fontSize.largeEx,
		fontFamily: CMConstants.font.bold,
		marginTop: CMConstants.space.small,
		textAlign: 'center',
	},
	subtitle: {
		fontSize: CMConstants.fontSize.small,
		fontFamily: CMConstants.font.regular,
		marginTop: CMConstants.space.smallEx,
		textAlign: 'center',
	},
	tiersContainer: {
		marginTop: CMConstants.space.normal,
		gap: CMConstants.space.smallEx,
	},
	tierCard: {
		borderRadius: CMConstants.radius.normal,
		padding: CMConstants.space.normal,
		position: 'relative',
		marginBottom: CMConstants.space.smallEx,
	},
	tierCardYellow: {
		backgroundColor: CMConstants.color.yellow,
		borderColor: CMConstants.color.black,
		borderWidth: 2,
		shadowColor: CMConstants.color.yellow,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 5,
	},
	tierCardSelected: {
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 5,
	},
	popularBadge: {
		position: 'absolute',
		top: 3,
		right: CMConstants.space.normal,
		backgroundColor: CMConstants.color.yellow,
		paddingHorizontal: CMConstants.space.smallEx,
		paddingVertical: 4,
		borderRadius: CMConstants.radius.smallEx,
		zIndex: 1,
	},
	popularBadgeText: {
		fontSize: 10,
		fontFamily: CMConstants.font.bold,
		color: CMConstants.color.black,
		letterSpacing: 0.5,
	},
	tierHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: CMConstants.space.smallEx,
	},
	tierTitle: {
		fontSize: CMConstants.fontSize.large,
		fontFamily: CMConstants.font.bold,
		includeFontPadding: false,
	},
	priceContainer: {
		flexDirection: 'row',
		alignItems: 'baseline',
		marginBottom: CMConstants.space.smallEx,
	},
	price: {
		fontSize: 28,
		fontFamily: CMConstants.font.bold,
		includeFontPadding: false,
	},
	pricePeriod: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.regular,
		marginLeft: 4,
		includeFontPadding: false,
	},
	teamRange: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.semiBold,
		marginBottom: CMConstants.space.smallEx,
		includeFontPadding: false,
	},
	tierDescription: {
		fontSize: CMConstants.fontSize.small,
		fontFamily: CMConstants.font.regular,
		lineHeight: 20,
		includeFontPadding: false,
	},
	subscribeButton: {
		height: CMConstants.height.buttonNormal,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: CMConstants.radius.smallEx,
		shadowColor: CMConstants.color.green,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 4,
	},
	subscribeButtonText: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.semiBold,
		includeFontPadding: false,
	},
	cancelButton: {
		borderWidth: 1.5,
		height: CMConstants.height.buttonNormal,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: CMConstants.radius.smallEx,
	},
	cancelButtonText: {
		fontSize: CMConstants.fontSize.normal,
		fontFamily: CMConstants.font.semiBold,
		letterSpacing: 0.3,
	},
	featuresContainer: {
		marginTop: CMConstants.space.smallEx,
		gap: CMConstants.space.smallEx - 2,
	},
	featureRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: CMConstants.space.smallEx - 4,
	},
	featureText: {
		fontSize: CMConstants.fontSize.smallEx,
		fontFamily: CMConstants.font.regular,
		includeFontPadding: false,
		flex: 1,
	},
})

export default CMPaywallModalContent


import React, {useEffect, useState, useCallback, useRef} from 'react'
import {SafeAreaView, View, Text, Platform, Alert, TextInput} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import CMNavigationProps from '../navigation/CMNavigationProps'
import CMCommonStyles from '../styles/CMCommonStyles'
import CMConstants from '../CMConstants'
import CMRipple from '../components/CMRipple'
import {ScrollView} from 'react-native-gesture-handler'
import CMFirebaseHelper from '../helper/CMFirebaseHelper'
import CMLoadingDialog from '../dialog/CMLoadingDialog'
import CMGlobal from '../CMGlobal'
import { getFirestore, collection, query, where, getDocs, doc, setDoc } from '@react-native-firebase/firestore'
import CMDropDownPicker from '../components/CMDropDownPicker'
import CMImagePicker from '../helper/CMImagePicker'
import ActionSheet from 'react-native-actionsheet'
import {getAuth} from '@react-native-firebase/auth'

// Screen to manage per-player stats for a given match
// route.params: { match: Match, leagueId: string, teamAPlayers: Player[], teamBPlayers: Player[] }

const CMMatchPlayersStatsScreen = ({navigation, route}: CMNavigationProps) => {
  const insets = useSafeAreaInsets()
  const [themeMode, setThemeMode] = useState(CMGlobal.themeMode || CMConstants.themeMode.light)
  const isDarkMode = themeMode === CMConstants.themeMode.dark

  const match = route.params.match
  const leagueId = route.params.leagueId || match.leagueId

  const [loading, setLoading] = useState(false)
  const [teamA, setTeamA] = useState<any | null>(null)
  const [teamB, setTeamB] = useState<any | null>(null)
  const [playersTeamA, setPlayersTeamA] = useState<any[]>([])
  const [playersTeamB, setPlayersTeamB] = useState<any[]>([])
  const [statByPlayerId, setStatByPlayerId] = useState<Record<string, {points: string; rebounds: string; assists: string; steals: string; blocks: string; turnovers: string}>>({})
  const [analysisDropdownOpen, setAnalysisDropdownOpen] = useState<Record<string, boolean>>({})
  const [analysisValue, setAnalysisValue] = useState<Record<string, string>>({})
  const [analysisItems] = useState([
    { label: 'Analysis by Image', value: 'image' },
    { label: 'Analysis by Website', value: 'website' },
  ])
  const actionSheetRef = useRef<any>(null)
  const teamAnalysisActionSheetRef = useRef<any>(null)
  const currentPlayerIdRef = useRef<string | null>(null)
  const currentPlayerRef = useRef<any | null>(null)

  // Dynamic colors based on theme
  const backgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
  const headerBackgroundColor = isDarkMode ? CMConstants.color.darkGrey : CMConstants.color.white
  const headerTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
  const textColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
  const cardBackgroundColor = isDarkMode ? CMConstants.color.darkGrey2 : CMConstants.color.lightGrey1
  const cardBorderColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.lightGrey
  const inputBackgroundColor = isDarkMode ? CMConstants.color.darkGrey3 : CMConstants.color.white
  const inputTextColor = isDarkMode ? CMConstants.color.white : CMConstants.color.black
  const placeholderColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.grey
  const labelColor = isDarkMode ? CMConstants.color.semiLightGrey : CMConstants.color.darkGrey

  // Listen for theme changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setThemeMode(CMGlobal.themeMode || CMConstants.themeMode.light)
    })
    return unsubscribe
  }, [navigation])

  useEffect(() => {
    navigation.setOptions({
      title: 'Match Player Stats',
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

    // Load both teams' players if not provided
    if (route.params?.teamAPlayers && route.params?.teamBPlayers) {
      setPlayersTeamA(route.params.teamAPlayers)
      setPlayersTeamB(route.params.teamBPlayers)
      initStats([...route.params.teamAPlayers, ...route.params.teamBPlayers])
    } else {
      setLoading(true)
      CMFirebaseHelper.getTeams([match.teamAId, match.teamBId], (respTeams: any) => {
        if (respTeams.isSuccess) {
          const ta = respTeams.value.find((t: any) => t.id === match.teamAId) || null
          const tb = respTeams.value.find((t: any) => t.id === match.teamBId) || null
          setTeamA(ta)
          setTeamB(tb)
          const teamIds = respTeams.value.map((t: any) => t.id)
          CMFirebaseHelper.getPlayers(teamIds, (respPlayers: any) => {
            setLoading(false)
            if (respPlayers.isSuccess) {
              const a = respPlayers.value.filter((p: any) => p.teamId === match.teamAId)
              const b = respPlayers.value.filter((p: any) => p.teamId === match.teamBId)
              setPlayersTeamA(a)
              setPlayersTeamB(b)
              initStats([...a, ...b])
              // Prefill stats for current match & league only and choose the most recent per player
              const playerStatsQuery = query(
                collection(getFirestore(), 'playerStats'),
                where('leagueId', '==', leagueId),
                where('matchId', '==', match.id)
              );
              getDocs(playerStatsQuery)
                .then(snapshot => {
                  if (!snapshot.empty) {
                    // Build latest-by-player map
                    const latestByPlayer: Record<string, any> = {}
                    snapshot.forEach(doc => {
                      const d: any = doc.data()
                      const pid = d.playerId
                      const existing = latestByPlayer[pid]
                      const deterministicId = `${match.id}_${pid}`
                      const ts = d.dayTime?.toDate?.() ? d.dayTime.toDate() : new Date(d.dayTime || 0)
                      const existingTs = existing?.dayTime?.toDate?.() ? existing.dayTime.toDate() : new Date(existing?.dayTime || 0)

                      const preferThis = doc.id === deterministicId || !existing || ts > existingTs
                      if (preferThis) latestByPlayer[pid] = { ...d, id: doc.id }
                    })

                    setStatByPlayerId(prev => {
                      const copy = { ...prev }
                      Object.values(latestByPlayer).forEach((s: any) => {
                        copy[s.playerId] = {
                          points: String(s.pointsPerGame ?? ''),
                          rebounds: String(s.rebounds ?? ''),
                          assists: String(s.assists ?? ''),
                          steals: String(s.steals ?? ''),
                          blocks: String(s.blocks ?? ''),
                          turnovers: String(s.turnovers ?? ''),
                        }
                      })
                      return copy
                    })
                  }
                })
                .catch(() => {})
            }
          })
        } else {
          setLoading(false)
        }
      })
    }
  }, [headerBackgroundColor, headerTextColor, navigation, themeMode])

  const initStats = (playersList: any[]) => {
    const map: Record<string, any> = {}
    playersList.forEach(p => {
      map[p.id] = {points: '', rebounds: '', assists: '', steals: '', blocks: '', turnovers: ''}
    })
    setStatByPlayerId(map)
  }

  const setField = useCallback((playerId: string, field: string, value: string) => {
    setStatByPlayerId(prev => ({...prev, [playerId]: {...prev[playerId], [field]: value}}))
  }, [])

  const showImagePickerOptions = useCallback((playerId: string, player: any) => {
    currentPlayerIdRef.current = playerId
    currentPlayerRef.current = player
    if (actionSheetRef.current) {
      actionSheetRef.current.show()
    }
  }, [])

  const showTeamAnalysisImagePicker = useCallback(() => {
    if (teamAnalysisActionSheetRef.current) {
      teamAnalysisActionSheetRef.current.show()
    }
  }, [])

  const handleImagePickerAction = useCallback((index: number) => {
    if (currentPlayerIdRef.current === null) return
    
    const playerId = currentPlayerIdRef.current
    const player = currentPlayerRef.current
    
    // index 0 = Camera, index 1 = Gallery, index 2 = Cancel
    if (index === 2) {
      currentPlayerIdRef.current = null
      currentPlayerRef.current = null
      return
    }

    setLoading(true)
    CMImagePicker.showImagePicker(index, (isSuccess: boolean, response: any) => {
      if (!isSuccess) {
        setLoading(false)
        currentPlayerIdRef.current = null
        currentPlayerRef.current = null
        return
      }

      // Send image to backend for analysis with player info
      analyzeImage(response.path, playerId, player, response.mime)
    }, {width: 1024, height: 1024}, false) // Don't crop, keep original quality
  }, [])

  const handleTeamAnalysisImagePicker = useCallback((index: number) => {
    // index 0 = Camera, index 1 = Gallery, index 2 = Cancel
    if (index === 2) {
      return
    }

    setLoading(true)
    CMImagePicker.showImagePicker(index, (isSuccess: boolean, response: any) => {
      if (!isSuccess) {
        setLoading(false)
        return
      }

      // Send image to backend for team-level analysis
      analyzeTeamImage(response.path, response.mime)
    }, {width: 1024, height: 1024}, false) // Don't crop, keep original quality
  }, [])

  const analyzeImage = async (imagePath: string, playerId: string, playerFromRef?: any, imageMime?: string) => {
    try {
      // Use player from ref if available, otherwise try to find it
      let player = playerFromRef
      
      if (!player) {
        // Get player information - check both state and route params
        let allPlayers = [...playersTeamA, ...playersTeamB]
        
        // Also check route params if players were passed that way
        if (route.params?.teamAPlayers && route.params?.teamBPlayers) {
          const routePlayers = [...route.params.teamAPlayers, ...route.params.teamBPlayers]
          // Merge with state players, avoiding duplicates
          routePlayers.forEach(rp => {
            if (!allPlayers.find(p => p.id === rp.id)) {
              allPlayers.push(rp)
            }
          })
        }
        
        player = allPlayers.find(p => p.id === playerId)
      }
      
      // Extract player information
      let playerName = ''
      let teamName = ''
      let playerNumber = ''
      let additionalContext = ''
      
      if (player) {
        playerName = player.name || ''
        // Get team information
        const playerTeam = player.teamId === match.teamAId ? teamA : teamB
        teamName = playerTeam?.name || ''
        if (player.number) {
          playerNumber = String(player.number)
        }
        if (player.position) {
          additionalContext = `Position: ${player.position}`
        }
      } else {
        // Player not found - still proceed but with minimal context
        // The AI will need to work harder to find the player, but it's better than failing
        console.warn('Player not found for ID:', playerId, 'Proceeding with limited context')
      }

      // Get Firebase auth token
      const user = getAuth().currentUser
      if (!user) {
        Alert.alert('Error', 'Please login to use this feature')
        setLoading(false)
        currentPlayerIdRef.current = null
        return
      }

      const token = await user.getIdToken()
      
      // Create FormData with image and player context
      const formData = new FormData()
      
      // Detect image format from mime type or file extension
      let mimeType = imageMime || 'image/jpeg'
      let fileExtension = 'jpg'
      
      if (imageMime) {
        // Use provided mime type
        mimeType = imageMime
        if (imageMime.includes('png')) {
          fileExtension = 'png'
        } else if (imageMime.includes('jpeg') || imageMime.includes('jpg')) {
          fileExtension = 'jpg'
        } else if (imageMime.includes('webp')) {
          fileExtension = 'webp'
        } else if (imageMime.includes('gif')) {
          fileExtension = 'gif'
        }
      } else {
        // Fallback: detect from file path extension
        const pathLower = imagePath.toLowerCase()
        if (pathLower.endsWith('.png')) {
          mimeType = 'image/png'
          fileExtension = 'png'
        } else if (pathLower.endsWith('.jpg') || pathLower.endsWith('.jpeg')) {
          mimeType = 'image/jpeg'
          fileExtension = 'jpg'
        } else if (pathLower.endsWith('.webp')) {
          mimeType = 'image/webp'
          fileExtension = 'webp'
        } else if (pathLower.endsWith('.gif')) {
          mimeType = 'image/gif'
          fileExtension = 'gif'
        }
      }
      
      // Fix image URI format for React Native
      let imageUri = imagePath
      if (Platform.OS === 'ios') {
        // iOS: remove file:// prefix if present
        imageUri = imagePath.replace('file://', '')
      } else {
        // Android: keep the path as is, but ensure it's a valid URI
        imageUri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`
      }
      
      // Append image file - React Native FormData format with correct mime type
      formData.append('image', {
        uri: imageUri,
        type: mimeType,
        name: `stats-image.${fileExtension}`,
      } as any)
      
      // Add player context to help AI identify the correct player
      formData.append('playerName', playerName)
      formData.append('teamName', teamName)
      if (playerNumber) {
        formData.append('playerNumber', playerNumber)
      }
      if (additionalContext) {
        formData.append('additionalContext', additionalContext)
      }

      // Get API base URL - use the configured URL from CMConstants
      const apiBaseUrl = CMConstants.api.baseUrl

      // Send to backend
      const apiUrl = `${apiBaseUrl}/api/${CMConstants.api.version}/analysis/image`
      
      // First, test connectivity with a simple GET request (no auth required)
      try {
        const testUrl = `${apiBaseUrl}/api/${CMConstants.api.version}/analysis/test`
        console.log('🔍 Testing connection to:', testUrl)
        
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          // No auth needed for test endpoint
        })
        
        console.log('✅ Test response status:', testResponse.status)
        
        if (!testResponse.ok) {
          const errorText = await testResponse.text()
          console.error('❌ Test failed:', errorText)
          throw new Error(`Server returned status: ${testResponse.status} - ${errorText}`)
        }
        
        const testResult = await testResponse.json()
        console.log('✅ Test successful:', testResult)
      } catch (testError: any) {
        console.error('❌ Connection test failed:', testError)
        const errorMsg = testError.message || 'Unknown error'
        const errorName = testError.name || 'Error'
        const errorStack = testError.stack || ''
        
        // More detailed error message
        let detailedError = `Error Type: ${errorName}\nError: ${errorMsg}`
        if (errorName === 'TypeError' && errorMsg.includes('Network request failed')) {
          detailedError += '\n\n⚠️ Network request failed - This usually means:\n' +
            '• Android is blocking HTTP traffic\n' +
            '• Network security config not applied (rebuild app!)\n' +
            '• No internet connection\n' +
            '• Firewall blocking the request'
        }
        
        Alert.alert(
          'Connection Failed',
          `Cannot connect to backend server.\n\n` +
          `URL: ${apiBaseUrl}\n` +
          `Test URL: ${apiBaseUrl}/api/${CMConstants.api.version}/analysis/test\n\n` +
          `${detailedError}\n\n` +
          `⚠️ IMPORTANT: If you just updated network_security_config.xml,\n` +
          `you MUST rebuild the Android app:\n\n` +
          `1. Stop the app completely\n` +
          `2. Run: npx react-native run-android\n` +
          `3. Or: cd android && ./gradlew clean && cd .. && npx react-native run-android`,
          [{ text: 'OK', onPress: () => {
            setLoading(false)
            currentPlayerIdRef.current = null
            currentPlayerRef.current = null
          }}]
        )
        return
      }
      
      // IMPORTANT: Do NOT set Content-Type header - React Native sets it automatically with boundary
      let response: Response
      try {
        // Add timeout to detect network issues faster
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // DO NOT set Content-Type - React Native will set it automatically with the correct boundary
          },
          body: formData,
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        // Request sent, waiting for response
      } catch (fetchError: any) {
        // Handle different types of errors with alerts
        if (fetchError.name === 'AbortError') {
          Alert.alert(
            'Request Timeout',
            `Server at ${apiBaseUrl} did not respond within 30 seconds.\n\n` +
            `The request may be too large or the server is not responding.\n\n` +
            `Please check if the backend is running and try again.`,
            [{ text: 'OK' }]
          )
          setLoading(false)
          currentPlayerIdRef.current = null
          currentPlayerRef.current = null
          return
        } else if (fetchError.message === 'Network request failed' || fetchError.message.includes('Network')) {
          Alert.alert(
            'Network Error',
            `Cannot reach server at ${apiBaseUrl}.\n\n` +
            `Troubleshooting:\n` +
            `1. Check internet connection\n` +
            `2. Verify backend server is running on AWS\n` +
            `3. Check CMConstants.tsx has correct API URL\n` +
            `4. Try again in a moment`,
            [{ text: 'OK' }]
          )
          setLoading(false)
          currentPlayerIdRef.current = null
          currentPlayerRef.current = null
          return
        }
        
        // Other errors
        Alert.alert('Upload Error', fetchError.message || 'Failed to upload image', [{ text: 'OK' }])
        setLoading(false)
        currentPlayerIdRef.current = null
        currentPlayerRef.current = null
        return
      }
      
      // Parse response
      let result: any
      try {
        const responseText = await response.text()
        result = JSON.parse(responseText)
      } catch (parseError) {
        Alert.alert('Parse Error', 'Failed to parse server response. Please try again.', [{ text: 'OK' }])
        setLoading(false)
        currentPlayerIdRef.current = null
        currentPlayerRef.current = null
        return
      }

      // Check for errors
      if (!response.ok || !result.success) {
        let errorMessage = result.message || 'Failed to analyze image'
        let errorDetails = ''
        
        // Add more details if available
        if (result.details) {
          if (result.details.error) {
            errorDetails = `\n\nError: ${result.details.error}`
          }
          if (result.details.aiService) {
            errorDetails += `\nAI Service: ${result.details.aiService}`
          }
        }
        
        Alert.alert(
          'Analysis Failed',
          `${errorMessage}${errorDetails}\n\nStatus: ${response.status}`,
          [{ text: 'OK' }]
        )
        setLoading(false)
        currentPlayerIdRef.current = null
        currentPlayerRef.current = null
        return
      }

      // Auto-fill the stats
      const stats = result.data
      setStatByPlayerId(prev => ({
        ...prev,
        [playerId]: {
          points: String(stats.points || ''),
          rebounds: String(stats.rebounds || ''),
          assists: String(stats.assists || ''),
          steals: String(stats.steals || ''),
          blocks: String(stats.blocks || ''),
          turnovers: String(stats.turnovers || ''),
        }
      }))

      // Reset analysis dropdown
      setAnalysisValue(prev => ({ ...prev, [playerId]: '' }))
      
      // Show success message with AI service info if available
      const aiService = result.aiService ? ` (using ${result.aiService.toUpperCase()})` : ''
      Alert.alert(
        'Success!',
        `Statistics extracted from image successfully!${aiService}\n\n` +
        `Points: ${stats.points}\n` +
        `Rebounds: ${stats.rebounds}\n` +
        `Assists: ${stats.assists}\n` +
        `Steals: ${stats.steals}\n` +
        `Blocks: ${stats.blocks}\n` +
        `Turnovers: ${stats.turnovers}`
      )
    } catch (error: any) {
      console.error('Image analysis error:', error)
      Alert.alert('Error', error.message || 'Failed to analyze image. Please try again.')
    } finally {
      setLoading(false)
      currentPlayerIdRef.current = null
      currentPlayerRef.current = null
    }
  }

  const analyzeTeamImage = async (imagePath: string, imageMime?: string) => {
    try {
      // Get Firebase auth token
      const user = getAuth().currentUser
      if (!user) {
        Alert.alert('Error', 'Please login to use this feature')
        setLoading(false)
        return
      }

      const token = await user.getIdToken()
      
      // Prepare teams data with all players
      // Check both state and route params
      const teamsData = []
      
      // Get players from state or route params
      let teamAPlayers = playersTeamA.length > 0 ? playersTeamA : (route.params?.teamAPlayers || [])
      let teamBPlayers = playersTeamB.length > 0 ? playersTeamB : (route.params?.teamBPlayers || [])
      
      // Get team names from state or try to get from route/match
      let teamAName = teamA?.name || 'Team A'
      let teamBName = teamB?.name || 'Team B'
      
      // If teams aren't loaded but we have players, try to get team names
      if (!teamA && teamAPlayers.length > 0 && match.teamAId) {
        // Try to get team name from first player's teamId or match
        teamAName = teamAPlayers[0]?.teamName || 'Team A'
      }
      if (!teamB && teamBPlayers.length > 0 && match.teamBId) {
        teamBName = teamBPlayers[0]?.teamName || 'Team B'
      }
      
      // Team A
      if (teamAPlayers.length > 0) {
        teamsData.push({
          name: teamAName,
          players: teamAPlayers.map(p => ({
            name: p.name || '',
            number: p.number ? String(p.number) : undefined,
            position: p.position || undefined
          }))
        })
      }
      
      // Team B
      if (teamBPlayers.length > 0) {
        teamsData.push({
          name: teamBName,
          players: teamBPlayers.map(p => ({
            name: p.name || '',
            number: p.number ? String(p.number) : undefined,
            position: p.position || undefined
          }))
        })
      }

      if (teamsData.length === 0) {
        Alert.alert(
          'Error', 
          'No teams or players found. Please ensure teams and players are loaded before analyzing.\n\n' +
          'If you just navigated to this screen, please wait a moment for data to load, then try again.'
        )
        setLoading(false)
        return
      }

      // Detect image format from mime type or file extension
      let mimeType = imageMime || 'image/jpeg'
      let fileExtension = 'jpg'
      
      if (imageMime) {
        if (imageMime.includes('png')) {
          fileExtension = 'png'
        } else if (imageMime.includes('jpeg') || imageMime.includes('jpg')) {
          fileExtension = 'jpg'
        } else if (imageMime.includes('webp')) {
          fileExtension = 'webp'
        } else if (imageMime.includes('gif')) {
          fileExtension = 'gif'
        }
      } else {
        const pathLower = imagePath.toLowerCase()
        if (pathLower.endsWith('.png')) {
          mimeType = 'image/png'
          fileExtension = 'png'
        } else if (pathLower.endsWith('.jpg') || pathLower.endsWith('.jpeg')) {
          mimeType = 'image/jpeg'
          fileExtension = 'jpg'
        } else if (pathLower.endsWith('.webp')) {
          mimeType = 'image/webp'
          fileExtension = 'webp'
        } else if (pathLower.endsWith('.gif')) {
          mimeType = 'image/gif'
          fileExtension = 'gif'
        }
      }
      
      // Fix image URI format for React Native
      let imageUri = imagePath
      if (Platform.OS === 'ios') {
        imageUri = imagePath.replace('file://', '')
      } else {
        imageUri = imagePath.startsWith('file://') ? imagePath : `file://${imagePath}`
      }
      
      // Create FormData with image and team data
      const formData = new FormData()
      formData.append('image', {
        uri: imageUri,
        type: mimeType,
        name: `team-stats-image.${fileExtension}`,
      } as any)
      
      // Add team analysis flag and teams data
      formData.append('isTeamAnalysis', 'true')
      formData.append('teamsData', JSON.stringify(teamsData))

      // Get API base URL
      const apiBaseUrl = CMConstants.api.baseUrl
      const apiUrl = `${apiBaseUrl}/api/${CMConstants.api.version}/analysis/image`
      
      // Test connectivity first
      try {
        const testUrl = `${apiBaseUrl}/api/${CMConstants.api.version}/analysis/test`
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        })
        
        if (!testResponse.ok) {
          throw new Error(`Server returned status: ${testResponse.status}`)
        }
      } catch (testError: any) {
        Alert.alert(
          'Connection Failed',
          `Cannot connect to backend server.\n\n${testError.message}`,
          [{ text: 'OK', onPress: () => setLoading(false) }]
        )
        return
      }
      
      // Send request with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout for team analysis
      
      let response: Response
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          Alert.alert(
            'Request Timeout',
            'Server did not respond within 60 seconds. The image may be too large or the server is processing many players.',
            [{ text: 'OK' }]
          )
        } else {
          Alert.alert('Network Error', `Cannot reach server.\n\n${fetchError.message}`, [{ text: 'OK' }])
        }
        setLoading(false)
        return
      }
      
      // Parse response
      let result: any
      try {
        const responseText = await response.text()
        result = JSON.parse(responseText)
      } catch (parseError) {
        Alert.alert('Parse Error', 'Failed to parse server response. Please try again.', [{ text: 'OK' }])
        setLoading(false)
        return
      }

      // Check for errors
      if (!response.ok || !result.success) {
        let errorMessage = result.message || 'Failed to analyze image'
        Alert.alert('Analysis Failed', `${errorMessage}\n\nStatus: ${response.status}`, [{ text: 'OK' }])
        setLoading(false)
        return
      }

      // Map team stats to individual players
      const teamStats = result.data // Object with player identifiers as keys
      let filledCount = 0
      let notFoundCount = 0
      
      setStatByPlayerId(prev => {
        const updated = { ...prev }
        
        // Get all players from state or route params
        const allPlayers = [
          ...(playersTeamA.length > 0 ? playersTeamA : (route.params?.teamAPlayers || [])),
          ...(playersTeamB.length > 0 ? playersTeamB : (route.params?.teamBPlayers || []))
        ]
        
        allPlayers.forEach(player => {
          // Try multiple matching strategies
          let matchedStats: any = null
          
          // Strategy 1: Match by exact player name
          if (player.name && teamStats[player.name]) {
            matchedStats = teamStats[player.name]
          }
          
          // Strategy 2: Match by player number
          if (!matchedStats && player.number) {
            const numberKey = String(player.number)
            if (teamStats[numberKey]) {
              matchedStats = teamStats[numberKey]
            }
          }
          
          // Strategy 3: Try case-insensitive name match
          if (!matchedStats && player.name) {
            const playerNameLower = player.name.toLowerCase()
            for (const key in teamStats) {
              if (key.toLowerCase() === playerNameLower) {
                matchedStats = teamStats[key]
                break
              }
            }
          }
          
          // Strategy 4: Try partial name match
          if (!matchedStats && player.name) {
            const playerNameParts = player.name.toLowerCase().split(' ')
            for (const key in teamStats) {
              const keyLower = key.toLowerCase()
              if (playerNameParts.some(part => keyLower.includes(part)) || 
                  keyLower.split(' ').some(part => playerNameParts.includes(part))) {
                matchedStats = teamStats[key]
                break
              }
            }
          }
          
          if (matchedStats) {
            updated[player.id] = {
              points: String(matchedStats.points || ''),
              rebounds: String(matchedStats.rebounds || ''),
              assists: String(matchedStats.assists || ''),
              steals: String(matchedStats.steals || ''),
              blocks: String(matchedStats.blocks || ''),
              turnovers: String(matchedStats.turnovers || ''),
            }
            filledCount++
          } else {
            notFoundCount++
          }
        })
        
        return updated
      })

      // Show success message
      const aiService = result.aiService ? ` (using ${result.aiService.toUpperCase()})` : ''
      Alert.alert(
        'Success!',
        `Team statistics extracted successfully!${aiService}\n\n` +
        `Players filled: ${filledCount}\n` +
        (notFoundCount > 0 ? `Players not found in image: ${notFoundCount}\n` : '') +
        `\nAll found players have been auto-filled.`
      )
    } catch (error: any) {
      console.error('Team image analysis error:', error)
      Alert.alert('Error', error.message || 'Failed to analyze team image. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const onSaveAll = async () => {
    setLoading(true)
    try {
      const ops: Promise<any>[] = []
      const affectedPlayerIds: Set<string> = new Set()
      ;[...playersTeamA, ...playersTeamB].forEach(p => {
        const s = statByPlayerId[p.id]
        if (!s) return
        affectedPlayerIds.add(p.id)
        const payload = {
          playerId: p.id,
          leagueId: leagueId,
          matchId: match.id,
          dayTime: new Date(),
          pointsPerGame: parseFloat(s.points || '0'),
          assists: parseFloat(s.assists || '0'),
          rebounds: parseFloat(s.rebounds || '0'),
          turnovers: parseFloat(s.turnovers || '0'),
          steals: parseFloat(s.steals || '0'),
          blocks: parseFloat(s.blocks || '0'),
        }
        // Use a deterministic document id per (match, player) so edits overwrite instead of creating duplicates
        const id = `${match.id}_${p.id}`
        ops.push(new Promise(resolve => {
          CMFirebaseHelper.addPlayerStat(id, {...payload, id}, () => resolve(null))
        }))
      })

      await Promise.all(ops)

      // Update top scorer for this match - await the update to ensure it completes before navigating
      await new Promise<void>((resolve) => {
        CMFirebaseHelper.updateMatchTopScorer(match.id, (response: {[name: string]: any}) => {
          if (response.isSuccess) {
            console.log('Top scorer updated for match after stats save:', response.data);
          } else {
            console.log('Failed to update top scorer after stats save:', response.value);
          }
          resolve();
        });
      });

      // Recompute averages for affected players
      const recomputeOps: Promise<any>[] = []
      affectedPlayerIds.forEach(playerId => {
        const recomputePromise = (async () => {
          const playerStatsQuery = query(
            collection(getFirestore(), 'playerStats'),
            where('leagueId', '==', leagueId),
            where('playerId', '==', playerId)
          );
          const snapshot = await getDocs(playerStatsQuery);
          let totalPts = 0, totalReb = 0, totalAst = 0, totalStl = 0, totalBlk = 0, totalTov = 0, count = 0
          snapshot.forEach((doc: any) => {
            const d: any = doc.data()
            totalPts += Number(d.pointsPerGame || 0)
            totalReb += Number(d.rebounds || 0)
            totalAst += Number(d.assists || 0)
            totalStl += Number(d.steals || 0)
            totalBlk += Number(d.blocks || 0)
            totalTov += Number(d.turnovers || 0)
            count += 1
          })
          const avg = (n: number) => (count === 0 ? 0 : n / count)
          const avgDocId = `${leagueId}${playerId}`
          const db = getFirestore();
          return setDoc(doc(collection(db, 'playerAverageStats'), avgDocId), {
            id: avgDocId,
            leagueId,
            playerId,
            matches: count,
            averagePoints: avg(totalPts),
            averageRebounds: avg(totalReb),
            averageAssists: avg(totalAst),
            averageSteals: avg(totalStl),
            averageBlocks: avg(totalBlk),
            averageTurnovers: avg(totalTov),
          }, { merge: true })
        })();
        recomputeOps.push(recomputePromise);
      })

      await Promise.all(recomputeOps)
      navigation.goBack()
    } finally {
      setLoading(false)
    }
  }

  const renderRow = (item: any) => {
    const s = statByPlayerId[item.id] || {}
    const playerId = item.id
    const isDropdownOpen = analysisDropdownOpen[playerId] || false
    const selectedAnalysis = analysisValue[playerId] || ''
    
    return (
      <View style={{padding: CMConstants.space.smallEx, backgroundColor: cardBackgroundColor, borderRadius: CMConstants.radius.normal}}>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: CMConstants.space.smallEx}}>
          <Text style={[CMCommonStyles.title(themeMode), { color: textColor, flex: 1 }]}>{item.name}</Text>
          <View style={{width: 180, marginLeft: CMConstants.space.smallEx}}>
            <CMDropDownPicker
              isOpened={isDropdownOpen}
              themeMode={themeMode}
              defaultStyle={{
                backgroundColor: inputBackgroundColor,
                borderColor: cardBorderColor,
                borderWidth: 1,
                borderRadius: CMConstants.radius.small,
                minHeight: 36,
                paddingHorizontal: CMConstants.space.smallEx,
              }}
              defaultDropDownContainerStyle={{
                backgroundColor: cardBackgroundColor,
                borderColor: cardBorderColor,
                borderWidth: 1,
                borderRadius: CMConstants.radius.small,
              }}
              placeholder="Analysis"
              placeholderStyle={{ color: placeholderColor }}
              open={isDropdownOpen}
              value={selectedAnalysis}
              items={analysisItems}
              setOpen={(open: boolean) => {
                setAnalysisDropdownOpen(prev => ({ ...prev, [playerId]: open }))
              }}
              onSelectItem={(dropdownItem: any) => {
                setAnalysisValue(prev => ({ ...prev, [playerId]: dropdownItem.value }))
                setAnalysisDropdownOpen(prev => ({ ...prev, [playerId]: false }))
                
                // Handle image analysis selection
                if (dropdownItem.value === 'image') {
                  // Pass the player object (item from renderRow) directly
                  showImagePickerOptions(playerId, item)
                } else if (dropdownItem.value === 'website') {
                  // TODO: Implement website analysis
                  Alert.alert('Coming Soon', 'Website analysis feature will be available soon.')
                }
              }}
              setItems={() => {}}
              onOpen={() => {
                // Close other dropdowns
                const newOpenState: Record<string, boolean> = {}
                Object.keys(analysisDropdownOpen).forEach(key => {
                  if (key !== playerId) {
                    newOpenState[key] = false
                  }
                })
                newOpenState[playerId] = true
                setAnalysisDropdownOpen(newOpenState)
              }}
              textStyle={{ color: inputTextColor, fontFamily: CMConstants.font.regular, fontSize: CMConstants.fontSize.smallEx }}
              labelStyle={{ color: inputTextColor, fontSize: CMConstants.fontSize.smallEx }}
              arrowIconStyle={{ tintColor: placeholderColor }}
              fontSize={CMConstants.fontSize.smallEx}
            />
          </View>
        </View>
        <View style={{flexDirection: 'row', marginTop: CMConstants.space.smallEx}}>
          <StatInput label="PTS" value={s.points} onChange={v => setField(item.id, 'points', v)} themeMode={themeMode} inputBackgroundColor={inputBackgroundColor} inputTextColor={inputTextColor} placeholderColor={placeholderColor} labelColor={labelColor} />
          <StatInput label="REB" value={s.rebounds} onChange={v => setField(item.id, 'rebounds', v)} themeMode={themeMode} inputBackgroundColor={inputBackgroundColor} inputTextColor={inputTextColor} placeholderColor={placeholderColor} labelColor={labelColor} />
          <StatInput label="AST" value={s.assists} onChange={v => setField(item.id, 'assists', v)} themeMode={themeMode} inputBackgroundColor={inputBackgroundColor} inputTextColor={inputTextColor} placeholderColor={placeholderColor} labelColor={labelColor} />
        </View>
        <View style={{flexDirection: 'row', marginTop: CMConstants.space.smallEx}}>
          <StatInput label="STL" value={s.steals} onChange={v => setField(item.id, 'steals', v)} themeMode={themeMode} inputBackgroundColor={inputBackgroundColor} inputTextColor={inputTextColor} placeholderColor={placeholderColor} labelColor={labelColor} />
          <StatInput label="BLK" value={s.blocks} onChange={v => setField(item.id, 'blocks', v)} themeMode={themeMode} inputBackgroundColor={inputBackgroundColor} inputTextColor={inputTextColor} placeholderColor={placeholderColor} labelColor={labelColor} />
          <StatInput label="TOV" value={s.turnovers} onChange={v => setField(item.id, 'turnovers', v)} themeMode={themeMode} inputBackgroundColor={inputBackgroundColor} inputTextColor={inputTextColor} placeholderColor={placeholderColor} labelColor={labelColor} />
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[CMCommonStyles.bodyMain(themeMode), { backgroundColor: backgroundColor }]}>
      <CMLoadingDialog visible={loading} />
      <ScrollView style={{flex: 1, margin: CMConstants.space.small, backgroundColor: backgroundColor}}
        contentContainerStyle={{paddingBottom: CMConstants.space.large}}
        keyboardShouldPersistTaps={'handled'}
      >
        {/* Team Analysis Button */}
        <CMRipple
          containerStyle={{
            backgroundColor: CMConstants.color.blue,
            borderWidth: 0,
            height: CMConstants.height.buttonNormal,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: CMConstants.radius.normal,
            marginBottom: CMConstants.space.normal,
            shadowColor: CMConstants.color.blue,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
          }}
          onPress={showTeamAnalysisImagePicker}
        >
          <Text style={[CMCommonStyles.buttonMainText, {color: CMConstants.color.white}]}>
            📸 Analyze Teams from Image
          </Text>
        </CMRipple>

        <Text style={[CMCommonStyles.title(themeMode), {marginBottom: CMConstants.space.smallEx, color: textColor}]}>{teamA?.name || 'Team A'}</Text>
        {playersTeamA.length === 0 ? (
          <Text style={[CMCommonStyles.textNormal(themeMode), { color: textColor }]}>No players</Text>
        ) : (
          playersTeamA.map((p, idx) => (
            <View key={p.id} style={{marginBottom: CMConstants.space.smallEx}}>
              {renderRow(p)}
            </View>
          ))
        )}
        <View style={{height: CMConstants.space.normal}} />
        <Text style={[CMCommonStyles.title(themeMode), {marginBottom: CMConstants.space.smallEx, color: textColor}]}>{teamB?.name || 'Team B'}</Text>
        {playersTeamB.length === 0 ? (
          <Text style={[CMCommonStyles.textNormal(themeMode), { color: textColor }]}>No players</Text>
        ) : (
          playersTeamB.map((p, idx) => (
            <View key={p.id} style={{marginBottom: CMConstants.space.smallEx}}>
              {renderRow(p)}
            </View>
          ))
        )}
      </ScrollView>
      <CMRipple
        containerStyle={{
          backgroundColor: CMConstants.color.green,
          borderWidth: 0,
          height: CMConstants.height.buttonNormal,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: CMConstants.radius.normal,
          position: 'absolute',
          left: CMConstants.space.small,
          right: CMConstants.space.small,
          bottom: insets.bottom + CMConstants.space.small,
          shadowColor: CMConstants.color.green,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 4,
        }}
        onPress={onSaveAll}
      >
        <Text style={CMCommonStyles.buttonMainText}>Save Stats</Text>
      </CMRipple>
      <ActionSheet
        ref={actionSheetRef}
        title="Select Image Source"
        options={['Camera', 'Gallery', 'Cancel']}
        cancelButtonIndex={2}
        onPress={handleImagePickerAction}
      />
      <ActionSheet
        ref={teamAnalysisActionSheetRef}
        title="Select Team Stats Image"
        options={['Camera', 'Gallery', 'Cancel']}
        cancelButtonIndex={2}
        onPress={handleTeamAnalysisImagePicker}
      />
    </SafeAreaView>
  )
}

const StatInput = ({label, value, onChange, themeMode, inputBackgroundColor, inputTextColor, placeholderColor, labelColor}: {label: string; value: string; onChange: (v: string) => void; themeMode: string; inputBackgroundColor: string; inputTextColor: string; placeholderColor: string; labelColor: string}) => {
  const removeLeadingZeros = (text: string): string => {
    if (text === '' || text === '0') {
      return text;
    }
    // Handle decimal numbers - preserve "0." at the start
    if (text.includes('.')) {
      const parts = text.split('.');
      // Remove leading zeros from the integer part, but keep at least one digit
      const integerPart = parts[0].replace(/^0+/, '') || '0';
      return integerPart + '.' + parts.slice(1).join('');
    }
    // For integers, remove leading zeros
    const cleaned = text.replace(/^0+/, '');
    return cleaned === '' ? '0' : cleaned;
  };

  const handleChange = (text: string) => {
    // Only allow numbers (including decimals and negative for edge cases, but typically just positive integers)
    // Remove any non-numeric characters except decimal point
    const numericValue = text.replace(/[^0-9.]/g, '')
    // Ensure only one decimal point
    const parts = numericValue.split('.')
    const filteredValue = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : numericValue
    // Remove leading zeros
    const cleaned = removeLeadingZeros(filteredValue)
    onChange(cleaned)
  }

  return (
    <View style={{flex: 1, marginRight: CMConstants.space.smallEx}}>
      <Text style={{color: labelColor, marginBottom: 4}}>{label}</Text>
      <TextInput
        style={{...CMCommonStyles.textInput(themeMode), height: CMConstants.height.textInput, backgroundColor: inputBackgroundColor, color: inputTextColor}}
        value={value}
        onChangeText={handleChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={placeholderColor}
        returnKeyType="done"
        underlineColorAndroid="transparent"
      />
    </View>
  )
}

export default CMMatchPlayersStatsScreen


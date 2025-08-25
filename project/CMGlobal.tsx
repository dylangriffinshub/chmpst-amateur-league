import CMConstants from './CMConstants'

let navigation: any
let user: any
let themeMode: string = CMConstants.themeMode.light
let gptApiKey: string | undefined

export default {
	navigation: navigation,
	user: user,
	themeMode: themeMode,
  gptApiKey: gptApiKey,
}
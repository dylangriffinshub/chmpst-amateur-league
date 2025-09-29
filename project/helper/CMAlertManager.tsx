import { CMAlertModalRef } from '../components/CMAlertModal'

interface AlertConfig {
	title?: string
	message: string
	onPress?: () => void
	buttonText?: string
}

class CMAlertManager {
	private alertRef: CMAlertModalRef | null = null

	setRef(ref: CMAlertModalRef | null) {
		this.alertRef = ref
	}

	show(config: AlertConfig) {
		if (this.alertRef) {
			this.alertRef.show(config)
		}
	}
}

export default new CMAlertManager()


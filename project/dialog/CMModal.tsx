import React from 'react'
import {Modal, View, ViewStyle} from 'react-native'
import CMConstants from '../CMConstants'

const CMModal = (props: any) => {
    const themeMode = CMConstants.themeMode.light

    const { isVisible, content } = props
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isVisible}
        >
            <View style={styles.modalContentView}>
                <View style={{width: '100%', height: '100%', justifyContent: 'space-around'}}>
                    {content}
                </View>
            </View>
        </Modal>
    )
}

const styles = {
    modalContentView: {
        flex: 1,
        backgroundColor: CMConstants.color.alphaModal,
        alignItems: 'center',
        justifyContent: 'space-around'
    } as ViewStyle
}

export default CMModal
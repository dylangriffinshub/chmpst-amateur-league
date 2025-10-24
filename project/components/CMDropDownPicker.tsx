import React from 'react'
import DropDownPicker from 'react-native-dropdown-picker'
import CMConstants from '../CMConstants'
import CMUtils from '../utils/CMUtils'

const CMDropDownPicker = (props: any) => {
    const {
        isOpened,
        themeMode,
        defaultStyle,
        defaultDropDownContainerStyle,
        defaultContainerStyle = {},
        fontSize = CMConstants.fontSize.normal,
        textStyle,
        labelStyle,
        itemStyle,
        selectedItemLabelStyle,
        selectedItemContainerStyle,
        listItemContainerStyle,
        listMode = 'SCROLLVIEW',
    } = props
    
    const isDark = !CMUtils.isLightMode(themeMode)
    const bgColor = isDark ? (defaultStyle?.backgroundColor || CMConstants.color.darkGrey2) : CMConstants.color.white
    const borderColor = isDark ? (defaultStyle?.borderColor || CMConstants.color.darkGrey3) : CMConstants.color.lightGrey
    const textColor = isDark ? CMConstants.color.white : CMConstants.color.black
    
    return (
        <DropDownPicker
            {...props}
            autoScroll={true}
            style={[defaultStyle, {zIndex: isOpened === true ? 10 : 0, backgroundColor: bgColor, borderColor: borderColor, minHeight: defaultStyle?.minHeight !== undefined ? defaultStyle.minHeight : undefined}]}
            dropDownContainerStyle={[defaultDropDownContainerStyle, {backgroundColor: isDark ? (defaultDropDownContainerStyle?.backgroundColor || CMConstants.color.darkGrey2) : CMConstants.color.white, borderColor: isDark ? (defaultDropDownContainerStyle?.borderColor || CMConstants.color.darkGrey3) : CMConstants.color.lightGrey}]}
            textStyle={[textStyle || {}, {color: textColor, fontFamily: CMConstants.font.regular, fontSize: fontSize}]}
            labelStyle={[labelStyle || {}, {color: textColor}]}
            arrowIconStyle={{tintColor: textColor}}
            tickIconStyle={props.tickIconStyle || {tintColor: textColor}}
            selectedItemLabelStyle={selectedItemLabelStyle || {color: textColor}}
            selectedItemContainerStyle={selectedItemContainerStyle}
            listItemContainerStyle={listItemContainerStyle}
            containerStyle={[defaultContainerStyle, CMUtils.isIOS ? {zIndex: isOpened === true ? 10000 : 0} : {}]}
            listMessageTextStyle={{color: isDark ? CMConstants.color.semiLightGrey : CMConstants.color.lightGrey}}
            listMode={listMode}
            scrollViewProps={{nestedScrollEnabled: true}}
            searchTextInputStyle={{color: textColor, borderColor: textColor, backgroundColor: bgColor}}
            modalContentContainerStyle={props.modalContentContainerStyle || { backgroundColor: isDark ? CMConstants.color.darkGrey : CMConstants.color.white }}
            modalTitleStyle={props.modalTitleStyle || { color: textColor, fontFamily: CMConstants.font.bold }}
            itemStyle={itemStyle || { paddingVertical: CMConstants.space.smallEx / 2 }}
        />
    )
}

export default CMDropDownPicker

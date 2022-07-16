import React, {useState} from 'react';
import {Dimensions, TextInput, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function CommentInput() {
  const [value, setValue] = useState('');
  const {width} = Dimensions.get('window');

  const handleChange = text => {
    setValue(text);
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'absolute',
        left: 0,
        bottom: 0,
        maxHeight: 100,
        padding: 5,
        width,
      }}>
      <View
        style={{
          backgroundColor: 'white',
          width: width - 60,
          borderRadius: 25,
          elevation: 2,
        }}>
        <TextInput
          value={value}
          onChangeText={handleChange}
          style={{height: '100%', paddingHorizontal: 10, fontSize: 18}}
          multiline
          placeholder="Enter message..."
        />
      </View>

      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 5,
          bottom: 5,
          justifyContent: 'center',
          alignItems: 'center',
          width: 45,
          height: 45,
          backgroundColor: 'green',
          borderRadius: 24,
          elevation: 2,
        }}>
        {value.trim() ? (
          <Ionicons size={25} name="md-send-sharp" color="white" />
        ) : (
          <Icon size={25} name="mic" color="white" />
        )}
      </TouchableOpacity>
    </View>
  );
}
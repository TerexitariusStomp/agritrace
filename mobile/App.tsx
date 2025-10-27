import React, { useState } from 'react'
import { SafeAreaView, View, Text, TextInput, Button, ScrollView, Image } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { Audio } from 'expo-av'

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000'

export default function App() {
  const [farmName, setFarmName] = useState('')
  const [farmId, setFarmId] = useState<string | null>(null)
  const [photo, setPhoto] = useState<any>(null)
  const [voiceUri, setVoiceUri] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<string>('')

  const createFarm = async () => {
    const res = await fetch(`${API}/farms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: 'demo-group', name: farmName }) })
    const data = await res.json()
    setFarmId(data.id)
  }

  const takePhoto = async (category: 'people'|'tools'|'plants'|'place_before'|'place_after') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return
    const img = await ImagePicker.launchCameraAsync({})
    if (img.canceled) return
    setPhoto(img.assets[0])
    const loc = await Location.getCurrentPositionAsync({})
    const form = new FormData()
    form.append('file', { uri: img.assets[0].uri, name: 'photo.jpg', type: 'image/jpeg' } as any)
    form.append('category', category)
    if (farmId) form.append('farmId', farmId)
    form.append('latitude', String(loc.coords.latitude))
    form.append('longitude', String(loc.coords.longitude))
    const res = await fetch(`${API}/photos`, { method: 'POST', body: form as any })
    const data = await res.json()
    console.log('uploaded photo', data)
  }

  const recordVoice = async () => {
    const { status } = await Audio.requestPermissionsAsync()
    if (status !== 'granted') return
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
    const rec = new Audio.Recording()
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
    await rec.startAsync()
    setTimeout(async () => {
      await rec.stopAndUnloadAsync()
      const uri = rec.getURI()!
      setVoiceUri(uri)
      const form = new FormData()
      form.append('file', { uri, name: 'note.m4a', type: 'audio/m4a' } as any)
      if (farmId) form.append('farmId', farmId)
      const res = await fetch(`${API}/voice-notes`, { method: 'POST', body: form as any })
      const data = await res.json()
      setTranscript(data.transcript)
    }, 4000)
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={{ padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>AgroTrace</Text>
        <View style={{ marginVertical: 12 }}>
          <Text>Farm Name</Text>
          <TextInput value={farmName} onChangeText={setFarmName} style={{ borderWidth: 1, padding: 8 }} />
          <Button title="Create Farm" onPress={createFarm} />
          {farmId && <Text>Farm ID: {farmId}</Text>}
        </View>
        <View style={{ marginVertical: 12 }}>
          <Text>Photos</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="People" onPress={() => takePhoto('people')} />
            <Button title="Tools" onPress={() => takePhoto('tools')} />
            <Button title="Plants" onPress={() => takePhoto('plants')} />
            <Button title="Before" onPress={() => takePhoto('place_before')} />
            <Button title="After" onPress={() => takePhoto('place_after')} />
          </View>
          {photo && <Image source={{ uri: photo.uri }} style={{ width: 200, height: 200 }} />}
        </View>
        <View style={{ marginVertical: 12 }}>
          <Text>Voice Note</Text>
          <Button title="Record 4s" onPress={recordVoice} />
          {!!voiceUri && <Text>Saved: {voiceUri}</Text>}
          {!!transcript && <Text>Transcript: {transcript}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

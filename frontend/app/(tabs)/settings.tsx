import { StyleSheet, ScrollView, Text, View, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userData = await AsyncStorage.getItem('user');
      const token = await AsyncStorage.getItem('token');
      
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Fetch user profile with photo
        if (token) {
          const response = await fetch(`${API_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.profile_photo) {
              setProfilePhoto(data.profile_photo);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error(error);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need camera access');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error(error);
    }
  };

  const uploadProfilePhoto = async (imageUri: string) => {
    try {
      setUploading(true);
      const token = await AsyncStorage.getItem('token');

      const formData = new FormData();
      const fileName = imageUri.split('/').pop() || 'profile.jpg';
      const fileType = 'image/jpeg';

      formData.append('photo', {
        uri: imageUri,
        name: fileName,
        type: fileType,
      } as any);

      const response = await fetch(`${API_URL}/user/profile-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfilePhoto(data.profile_photo);
        Alert.alert('Success', 'Profile photo updated');
      } else {
        Alert.alert('Error', 'Failed to upload photo');
      }
    } catch (error) {
      Alert.alert('Error', 'Upload failed');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('surveyCompleted');
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#6B9BA8" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Settings</ThemedText>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.photoContainer}>
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.profilePhoto}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <ThemedText style={styles.placeholderText}>No Photo</ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.userName}>{user?.name || 'User'}</ThemedText>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>

          <View style={styles.photoButtonsContainer}>
            <Pressable
              style={[styles.photoButton, { marginRight: 10 }]}
              onPress={pickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.photoButtonText}>📷 Choose Photo</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.photoButton}
              onPress={takePhoto}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.photoButtonText}>📸 Take Photo</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Account Settings Section */}
        <View style={styles.settingsSection}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          
          <Pressable style={styles.settingItem}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingValue}>{user?.email || ''}</Text>
          </Pressable>

          <Pressable style={styles.settingItem}>
            <Text style={styles.settingLabel}>Name</Text>
            <Text style={styles.settingValue}>{user?.name || ''}</Text>
          </Pressable>

          <Pressable style={styles.settingItem} onPress={() => router.push('/(tabs)/home')}>
            <Text style={styles.settingLabel}>Change Password</Text>
            <Text style={styles.settingValue}>→</Text>
          </Pressable>
        </View>

        {/* Logout Button */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09282eff',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 30,
    color: '#E8FBFF',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: 'rgba(107, 155, 168, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(107, 155, 168, 0.2)',
  },
  photoContainer: {
    marginBottom: 16,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#6B9BA8',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(107, 155, 168, 0.2)',
    borderWidth: 2,
    borderColor: '#6B9BA8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#6B9BA8',
    fontSize: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E8FBFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#A4CDD3',
    marginBottom: 20,
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  photoButton: {
    backgroundColor: '#6B9BA8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  photoButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  settingsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E8FBFF',
    marginBottom: 12,
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(107, 155, 168, 0.08)',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(107, 155, 168, 0.15)',
  },
  settingLabel: {
    fontSize: 14,
    color: '#A4CDD3',
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 14,
    color: '#E8FBFF',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

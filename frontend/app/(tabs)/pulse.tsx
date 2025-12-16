import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function Pulse() {
	const router = useRouter();
	const scaleAnim = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(scaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
				Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
			])
		).start();

		const timeout = setTimeout(() => {
			router.replace('(tabs)/index');
		}, 1500);

		return () => clearTimeout(timeout);
	}, []);

	return (
		<View style={styles.container}>
			<Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#12454E', justifyContent: 'center', alignItems: 'center' },
	circle: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#E6F4FE' },
});
// import React, { useEffect, useRef } from 'react';
// import { Animated, StyleSheet, View, Image } from 'react-native';
// import { useRouter } from 'expo-router';

// export default function SplashScreen() {
//   const router = useRouter();
//   const scaleAnim = useRef(new Animated.Value(1)).current;

//   useEffect(() => {
//     // Pulse animation
//     Animated.loop(
//       Animated.sequence([
//         Animated.timing(scaleAnim, {
//           toValue: 1.2,
//           duration: 500,
//           useNativeDriver: true,
//         }),
//         Animated.timing(scaleAnim, {
//           toValue: 1,
//           duration: 500,
//           useNativeDriver: true,
//         }),
//       ])
//     ).start();

//     // Navigate to main screen after 10 seconds
//     const timeout = setTimeout(() => {
//       router.replace('my-little-bean/app/(tabs)/index'); 
//     }, 8000);

//     return () => clearTimeout(timeout);
//   }, []);

//   return (
//     <View style={styles.container}>
//       <Animated.Image
//         source={require('@/assets/images/beandark.png')} // your logo
//         style={[styles.logo, { transform: [{ scale: scaleAnim }] }]}
//         resizeMode="contain"
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#12454E', // dark background for splash
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   logo: {
//     width: 280,
//     height: 280,
//   },
// });

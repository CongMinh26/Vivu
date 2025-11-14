# Vivu - Ứng dụng Theo dõi Nhóm Du lịch

Ứng dụng React Native (Expo) cho phép theo dõi vị trí thời gian thực của nhóm và gửi cảnh báo khẩn cấp.

## 🚀 Phase 1: Setup Project & Firebase Configuration - ✅ HOÀN THÀNH

### Đã hoàn thành:

#### 1.1. Khởi tạo Expo Project ✅
- ✅ Folder structure đã được tạo:
  - `src/screens/` - Các màn hình
  - `src/components/` - Components tái sử dụng
  - `src/services/` - Business logic và API calls
  - `src/contexts/` - React Contexts cho state management
  - `src/utils/` - Utility functions
  - `src/config/` - Configuration files
  - `src/navigation/` - Navigation setup

- ✅ Dependencies đã được cài đặt:
  - `@react-navigation/native` & `@react-navigation/bottom-tabs`
  - `react-native-screens` & `react-native-safe-area-context`
  - `expo-location` - Location tracking
  - `react-native-maps` - Maps display
  - `expo-notifications` - Push notifications
  - `expo-clipboard` & `expo-sharing` - Share features
  - `@react-native-async-storage/async-storage` - Local storage
  - `firebase` - Firebase SDK

#### 1.2. Cấu hình Firebase với Expo ✅
- ✅ Firebase config file: `src/config/firebase.ts`
  - Đã initialize Firebase app với Web config
  - Export `auth` và `firestore` instances
  - Sẵn sàng sử dụng trong toàn bộ app

- ✅ `app.json` đã được cấu hình:
  - Android package: `com.vivu.app`
  - iOS bundle identifier: `com.vivu.app`
  - Location permissions
  - Notification permissions
  - Expo plugins cho location và notifications

#### 1.3. Cấu hình Firestore Database ✅
- ✅ Security Rules đã được chuẩn bị trong `FIRESTORE_SECURITY_RULES.md`
- ⚠️ **Cần áp dụng:** Copy rules vào Firebase Console (xem file `FIRESTORE_SECURITY_RULES.md`)

#### 1.4. Setup Navigation Structure ✅
- ✅ `AppNavigator.tsx` với Tab Navigator
- ✅ 2 screens: `MapScreen` và `GroupsScreen`
- ✅ `App.tsx` đã được cập nhật với NavigationContainer

## 📋 Các bước tiếp theo:

### Phase 2: Anonymous Authentication & User Management
- Implement xác thực ẩn danh tự động
- Tạo AuthContext và UserContext
- Quản lý user state

### Phase 3: Group Management
- Tạo nhóm và mã mời
- Tham gia nhóm bằng mã mời

### Phase 4: Location Tracking & Map Display
- Request location permissions
- Track và hiển thị vị trí trên bản đồ

## 🛠️ Development

### Chạy ứng dụng:

```bash
# Development server
npm start

# Hoặc
expo start
```

Sau đó scan QR code với Expo Go app trên điện thoại.

### Cấu trúc project:

```
Vivu/
├── src/
│   ├── config/
│   │   └── firebase.ts          # Firebase configuration
│   ├── screens/
│   │   ├── MapScreen.tsx        # Màn hình bản đồ
│   │   └── GroupsScreen.tsx     # Màn hình quản lý nhóm
│   ├── navigation/
│   │   └── AppNavigator.tsx     # Tab Navigator
│   ├── services/                # Business logic
│   ├── contexts/                # React Contexts
│   ├── components/              # Reusable components
│   └── utils/                   # Utility functions
├── App.tsx                      # Entry point
├── app.json                     # Expo configuration
└── FIRESTORE_SECURITY_RULES.md  # Firestore rules guide
```

## ⚠️ Lưu ý quan trọng:

1. **Firestore Security Rules:** Cần copy rules từ `FIRESTORE_SECURITY_RULES.md` vào Firebase Console
2. **Development:** Sử dụng Expo Go app, không cần Android Studio/Xcode
3. **Firebase:** Đang sử dụng Firebase Web SDK, không cần native config files trong development

## 📚 Tài liệu tham khảo:

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Implementation Phases](../implementation-phases.md)


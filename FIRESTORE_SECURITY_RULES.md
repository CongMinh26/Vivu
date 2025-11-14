# Firestore Security Rules

Copy các rules sau vào Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cho phép đọc/ghi locations của chính mình
    match /locations/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Cho phép đọc groups nếu là thành viên
    match /groups/{groupId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.members;
    }
    
    // Cho phép đọc alerts của nhóm mình
    match /alerts/{groupId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Cho phép đọc/ghi user data của chính mình
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Hướng dẫn áp dụng:

1. Mở Firebase Console: https://console.firebase.google.com/
2. Chọn project: `vivu-d41cc`
3. Vào **Firestore Database** > **Rules**
4. Copy toàn bộ code trên vào editor
5. Click **Publish** để lưu rules

## Giải thích:

- **locations/{userId}**: Chỉ user đó mới đọc/ghi được vị trí của chính mình
- **groups/{groupId}**: Chỉ thành viên trong nhóm mới đọc được, chỉ thành viên mới update được
- **alerts/{groupId}**: Bất kỳ user đã authenticated đều có thể đọc/ghi alerts
- **users/{userId}**: Chỉ user đó mới đọc/ghi được thông tin của chính mình


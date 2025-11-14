# 🔒 Sửa lỗi "Missing or insufficient permissions" khi Join Group

## Vấn đề:
Lỗi "Missing or insufficient permissions" xảy ra khi join group vì Firestore Security Rules không cho phép user chưa là member update group document.

## Giải pháp:

### Bước 1: Mở Firebase Console
1. Truy cập: https://console.firebase.google.com/
2. Chọn project: **vivu-d41cc**
3. Vào **Firestore Database** > **Rules**

### Bước 2: Copy và Paste Security Rules mới

Copy toàn bộ code sau và paste vào Rules editor:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cho phép đọc/ghi locations của chính mình
    match /locations/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Cho phép đọc groups nếu là thành viên, hoặc để query (check membership, check invite code)
    match /groups/{groupId} {
      // Cho phép đọc:
      // - Khi query (list): luôn cho phép nếu authenticated (để check membership, invite code)
      // - Khi đọc document cụ thể: chỉ cho phép nếu là member
      allow list: if request.auth != null;
      allow get: if request.auth != null && 
        request.auth.uid in resource.data.members;
      // Cho phép tạo group nếu user authenticated và user đó phải trong members array
      allow create: if request.auth != null && 
        request.auth.uid in request.resource.data.members &&
        request.resource.data.members.size() == 1; // Chỉ có người tạo khi tạo mới
      // Cho phép update:
      // - Nếu là member: có thể update bất kỳ field nào
      // - Nếu chưa là member: chỉ được thêm chính mình vào members array (join group)
      allow update: if request.auth != null && (
        // Case 1: User đã là member - có thể update bất kỳ field nào
        request.auth.uid in resource.data.members ||
        // Case 2: User chưa là member - chỉ được thêm chính mình vào members
        (
          // Chỉ update members array
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members']) &&
          // Members array chỉ thêm user này vào (không xóa ai, không thêm ai khác)
          request.resource.data.members.size() == resource.data.members.size() + 1 &&
          request.auth.uid in request.resource.data.members &&
          !(request.auth.uid in resource.data.members) &&
          // Đảm bảo tất cả members cũ vẫn còn
          resource.data.members.toSet().hasAll(request.resource.data.members.toSet().remove(request.auth.uid))
        )
      );
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

### Bước 3: Publish Rules
1. Click nút **Publish** ở trên cùng
2. Đợi vài giây để rules được áp dụng

### Bước 4: Test lại app
1. Restart app hoặc reload
2. Thử join group bằng mã mời
3. Lỗi "Missing or insufficient permissions" sẽ biến mất

## Giải thích các thay đổi:

### Groups Update Rule:
Rule mới cho phép 2 trường hợp:

**Case 1: User đã là member**
- Có thể update bất kỳ field nào trong group
- Điều này cho phép members update group info, thêm/xóa members khác, etc.

**Case 2: User chưa là member (Join Group)**
- Chỉ được update `members` array
- Chỉ được thêm chính mình vào (size tăng 1)
- User phải có trong members array mới
- User không được có trong members array cũ
- Tất cả members cũ phải được giữ nguyên

### Ví dụ:
```
Group ban đầu: members = ["user1", "user2"]
User "user3" muốn join:
  ✅ members = ["user1", "user2", "user3"] → OK
  ❌ members = ["user3"] → Không OK (xóa members cũ)
  ❌ members = ["user1", "user2", "user3", "user4"] → Không OK (thêm user khác)
  ❌ members = ["user1", "user2"] → Không OK (không thêm user3)
```

## Lưu ý quan trọng:

⚠️ **Phải áp dụng rules này vào Firebase Console**, không chỉ copy vào file!

Sau khi publish rules, app sẽ hoạt động bình thường.


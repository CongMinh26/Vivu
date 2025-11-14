# Firebase Setup Guide

## Bước 1: Enable Anonymous Authentication

Lỗi `auth/configuration-not-found` thường xảy ra khi Anonymous Authentication chưa được enable trong Firebase Console.

### Cách enable:

1. Mở Firebase Console: https://console.firebase.google.com/
2. Chọn project: **vivu-d41cc**
3. Vào **Authentication** > **Sign-in method**
4. Tìm **Anonymous** trong danh sách providers
5. Click vào **Anonymous**
6. Bật **Enable** toggle
7. Click **Save**

## Bước 2: Kiểm tra Firestore Database

1. Vào **Firestore Database** trong Firebase Console
2. Nếu chưa có database, click **Create database**
3. Chọn **Start in test mode** (hoặc production mode nếu đã có Security Rules)
4. Chọn location (ví dụ: `asia-southeast1` cho Singapore)
5. Click **Enable**

## Bước 3: Áp dụng Security Rules

1. Vào **Firestore Database** > **Rules**
2. Copy rules từ file `FIRESTORE_SECURITY_RULES.md`
3. Paste vào Rules editor
4. Click **Publish**

## Kiểm tra lại:

Sau khi enable Anonymous Authentication, restart app và thử lại. Lỗi `auth/configuration-not-found` sẽ biến mất.


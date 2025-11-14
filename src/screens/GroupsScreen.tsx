import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useUser } from '../contexts/UserContext';
import {
  createGroup,
  getGroupById,
  joinGroupByInviteCode,
  subscribeToGroup,
  leaveGroup,
  Group,
  CreateGroupData,
} from '../services/GroupService';

export default function GroupsScreen() {
  const { isInGroup, currentGroupId, userId, setCurrentGroupId, clearGroup } = useUser();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentGroupInviteCode, setCurrentGroupInviteCode] = useState<string | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  
  // Form state for creating group
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [tripName, setTripName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [description, setDescription] = useState('');
  
  // Date picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Format date to YYYY-MM-DD string
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Subscribe to real-time group updates
  useEffect(() => {
    if (!currentGroupId) {
      setCurrentGroup(null);
      setCurrentGroupInviteCode(null);
      return;
    }

    // Subscribe to real-time updates
    const unsubscribe = subscribeToGroup(currentGroupId, (group) => {
      if (group) {
        setCurrentGroup(group);
        setCurrentGroupInviteCode(group.inviteCode);
      } else {
        // Group was deleted or doesn't exist
        setCurrentGroup(null);
        setCurrentGroupInviteCode(null);
        setError('Nhóm không tồn tại hoặc đã bị xóa.');
        // Clear groupId from user state
        setCurrentGroupId(null).catch(console.error);
      }
    });

    // Cleanup subscription on unmount or when groupId changes
    return () => unsubscribe();
  }, [currentGroupId, setCurrentGroupId]);

  const handleCreateGroup = async () => {
    if (!userId) {
      setError('Chưa đăng nhập. Vui lòng thử lại.');
      return;
    }

    // Validate form
    if (!tripName.trim()) {
      setError('Vui lòng nhập tên chuyến đi');
      return;
    }
    if (!destination.trim()) {
      setError('Vui lòng nhập địa điểm đến');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const tripData: CreateGroupData = {
        tripName: tripName.trim(),
        destination: destination.trim(),
        startDate: startDate ? formatDate(startDate) : undefined,
        endDate: endDate ? formatDate(endDate) : undefined,
        description: description.trim() || undefined,
      };

      const group = await createGroup(userId, tripData);
      await setCurrentGroupId(group.id);
      setCurrentGroupInviteCode(group.inviteCode);
      
      // Reset form
      setTripName('');
      setDestination('');
      setStartDate(null);
      setEndDate(null);
      setDescription('');
      setShowCreateForm(false);
      
      setSuccess(`Đã tạo nhóm thành công! Mã mời: ${group.inviteCode}`);
    } catch (err: any) {
      // Handle different error types
      let errorMessage = 'Không thể tạo nhóm. Vui lòng thử lại.';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.code === 'permission-denied') {
        errorMessage = 'Không có quyền tạo nhóm. Vui lòng kiểm tra cài đặt Firebase.';
      } else if (err.code === 'unavailable' || err.code === 'deadline-exceeded') {
        errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại.';
      } else if (err.code === 'unauthenticated') {
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng khởi động lại app.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (currentGroupInviteCode) {
      try {
        await Clipboard.setStringAsync(currentGroupInviteCode);
        setSuccess('Đã copy mã mời vào clipboard!');
      } catch (err) {
        setError('Không thể copy mã mời.');
      }
    }
  };

  const handleShareInviteCode = async () => {
    if (currentGroupInviteCode) {
      try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(`Mã mời nhóm Vivu: ${currentGroupInviteCode}\n\nTham gia nhóm của tôi bằng cách nhập mã mời này vào app!`);
        } else {
          // Fallback to copy if sharing is not available
          await handleCopyInviteCode();
        }
      } catch (err) {
        setError('Không thể chia sẻ mã mời.');
      }
    }
  };

  const handleLeaveGroup = async () => {
    if (!currentGroupId || !userId) {
      return;
    }

    Alert.alert(
      'Rời nhóm',
      'Bạn có chắc chắn muốn rời nhóm này?',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setError(null);
            setSuccess(null);

            try {
              await leaveGroup(currentGroupId, userId);
              await clearGroup();
              setSuccess('Đã rời nhóm thành công.');
            } catch (err: any) {
              // Handle different error types
              let errorMessage = 'Không thể rời nhóm. Vui lòng thử lại.';
              
              if (err.message) {
                errorMessage = err.message;
              } else if (err.code === 'permission-denied') {
                errorMessage = 'Không có quyền rời nhóm. Vui lòng kiểm tra cài đặt Firebase.';
              } else if (err.code === 'unavailable' || err.code === 'deadline-exceeded') {
                errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại.';
              } else if (err.code === 'unauthenticated') {
                errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng khởi động lại app.';
              }
              
              setError(errorMessage);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      setError('Vui lòng nhập mã mời');
      return;
    }

    if (!userId) {
      setError('Chưa đăng nhập. Vui lòng thử lại.');
      return;
    }

    // Normalize invite code (uppercase, remove spaces)
    const normalizedInviteCode = inviteCode.trim().toUpperCase();

    // Validate format: 6 alphanumeric characters
    if (!/^[A-Z0-9]{6}$/.test(normalizedInviteCode)) {
      setError('Mã mời không hợp lệ. Mã mời phải có đúng 6 ký tự chữ và số.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const group = await joinGroupByInviteCode(normalizedInviteCode, userId);
      await setCurrentGroupId(group.id);
      setCurrentGroupInviteCode(group.inviteCode);
      setInviteCode(''); // Clear input
      setSuccess(`Đã tham gia nhóm thành công! Mã mời: ${group.inviteCode}`);
    } catch (err: any) {
      // Handle different error types
      let errorMessage = 'Không thể tham gia nhóm. Vui lòng thử lại.';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.code === 'permission-denied' || err.code === 'unavailable') {
        errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại.';
      } else if (err.code === 'unauthenticated') {
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng khởi động lại app.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Clear messages after 3 seconds
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Quản lý Nhóm</Text>
        <Text style={styles.subtitle}>
          {isInGroup ? 'Bạn đang ở trong một nhóm' : 'Tạo hoặc tham gia nhóm để bắt đầu'}
        </Text>
      </View>

      {/* Current Group Info */}
      {isInGroup && currentGroup && (
        <View style={styles.currentGroupCard}>
          <Text style={styles.cardTitle}>Nhóm hiện tại</Text>
          
          {/* Trip Information */}
          {currentGroup.tripName && (
            <View style={styles.tripInfo}>
              <Text style={styles.tripName}>{currentGroup.tripName}</Text>
              {currentGroup.destination && (
                <Text style={styles.destination}>📍 {currentGroup.destination}</Text>
              )}
              {(currentGroup.startDate || currentGroup.endDate) && (
                <Text style={styles.dateRange}>
                  📅 {currentGroup.startDate || '?'} - {currentGroup.endDate || '?'}
                </Text>
              )}
              {currentGroup.description && (
                <Text style={styles.description}>{currentGroup.description}</Text>
              )}
            </View>
          )}
          
          <Text style={styles.groupId}>ID: {currentGroupId}</Text>
          {currentGroupInviteCode && (
            <View style={styles.inviteCodeContainer}>
              <Text style={styles.inviteCodeLabel}>Mã mời:</Text>
              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteCode}>{currentGroupInviteCode}</Text>
              </View>
              <View style={styles.inviteCodeActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.copyButton]}
                  onPress={handleCopyInviteCode}
                >
                  <Text style={styles.actionButtonText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.shareButton]}
                  onPress={handleShareInviteCode}
                >
                  <Text style={styles.actionButtonText}>Chia sẻ</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <Text style={styles.memberCount}>
            Thành viên: {currentGroup.members.length}
          </Text>
          
          {/* Leave Group Button */}
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveGroup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FF3B30" />
            ) : (
              <Text style={styles.leaveButtonText}>Rời nhóm</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.messageContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Success Message */}
      {success && (
        <View style={styles.messageContainer}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      {/* Create Group Section */}
      {!isInGroup && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tạo nhóm mới</Text>
          <Text style={styles.sectionDescription}>
            Tạo một nhóm mới và nhận mã mời để chia sẻ với bạn bè
          </Text>
          
          {!showCreateForm ? (
            <TouchableOpacity
              style={[styles.button, styles.createButton]}
              onPress={() => setShowCreateForm(true)}
            >
              <Text style={styles.buttonText}>Bắt đầu tạo nhóm</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.createForm}>
              <TextInput
                style={styles.input}
                placeholder="Tên chuyến đi *"
                placeholderTextColor="#999"
                value={tripName}
                onChangeText={setTripName}
              />
              <TextInput
                style={styles.input}
                placeholder="Địa điểm đến *"
                placeholderTextColor="#999"
                value={destination}
                onChangeText={setDestination}
              />
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[styles.input, styles.dateInput, styles.dateInputFirst]}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={[styles.dateInputText, !startDate && styles.dateInputPlaceholder]}>
                    {startDate ? formatDate(startDate) : 'Ngày bắt đầu'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, styles.dateInput]}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={[styles.dateInputText, !endDate && styles.dateInputPlaceholder]}>
                    {endDate ? formatDate(endDate) : 'Ngày kết thúc'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Date Pickers */}
              {showStartDatePicker && (
                <>
                  {Platform.OS === 'ios' && (
                    <View style={styles.datePickerActions}>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => setShowStartDatePicker(false)}
                      >
                        <Text style={styles.datePickerButtonText}>Xong</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <DateTimePicker
                    value={startDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowStartDatePicker(false);
                        if (event.type === 'set' && selectedDate) {
                          setStartDate(selectedDate);
                        }
                      } else {
                        // iOS: update date as user scrolls
                        if (selectedDate) {
                          setStartDate(selectedDate);
                        }
                      }
                    }}
                    minimumDate={new Date()}
                  />
                </>
              )}
              {showEndDatePicker && (
                <>
                  {Platform.OS === 'ios' && (
                    <View style={styles.datePickerActions}>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => setShowEndDatePicker(false)}
                      >
                        <Text style={styles.datePickerButtonText}>Xong</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <DateTimePicker
                    value={endDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setShowEndDatePicker(false);
                        if (event.type === 'set' && selectedDate) {
                          setEndDate(selectedDate);
                          // Validate: end date should be after start date
                          if (startDate && selectedDate < startDate) {
                            setError('Ngày kết thúc phải sau ngày bắt đầu');
                          }
                        }
                      } else {
                        // iOS: update date as user scrolls
                        if (selectedDate) {
                          setEndDate(selectedDate);
                          // Validate: end date should be after start date
                          if (startDate && selectedDate < startDate) {
                            setError('Ngày kết thúc phải sau ngày bắt đầu');
                          }
                        }
                      }
                    }}
                    minimumDate={startDate || new Date()}
                  />
                </>
              )}
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Mô tả (tùy chọn)"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => {
                    setShowCreateForm(false);
                    setTripName('');
                    setDestination('');
                    setStartDate(null);
                    setEndDate(null);
                    setDescription('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.createButton, loading && styles.buttonDisabled]}
                  onPress={handleCreateGroup}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Tạo nhóm</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Join Group Section */}
      {!isInGroup && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tham gia nhóm</Text>
          <Text style={styles.sectionDescription}>
            Nhập mã mời để tham gia nhóm của bạn bè
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập mã mời (ví dụ: A1B2C3)"
            placeholderTextColor="#999"
            value={inviteCode}
            onChangeText={(text) => {
              setInviteCode(text.toUpperCase().trim());
              setError(null);
            }}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, styles.joinButton, loading && styles.buttonDisabled]}
            onPress={handleJoinGroup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Tham gia nhóm</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Empty State */}
      {!isInGroup && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Chưa có nhóm nào{'\n'}
            Tạo nhóm mới hoặc tham gia nhóm bằng mã mời
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  currentGroupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  tripInfo: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tripName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  destination: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 4,
  },
  dateRange: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    lineHeight: 20,
  },
  groupId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  inviteCodeContainer: {
    marginTop: 8,
  },
  inviteCodeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  inviteCodeBox: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 4,
  },
  inviteCodeActions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  copyButton: {
    backgroundColor: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  messageContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  successText: {
    color: '#34C759',
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    width: '100%',
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  joinButton: {
    backgroundColor: '#34C759',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  createForm: {
    marginTop: 8,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 16,
    width: '100%',
    justifyContent: 'space-between',
  },
  dateInput: {
    flex: 1,
    marginLeft: 4,
    marginBottom: 0,
    justifyContent: 'center',
  },
  dateInputFirst: {
    marginLeft: 0,
  },
  dateInputText: {
    fontSize: 16,
    color: '#000',
  },
  dateInputPlaceholder: {
    color: '#999',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  datePickerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  datePickerButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
    flex: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  leaveButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});

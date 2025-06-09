import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  SafeAreaView,
  Platform,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { formatDateTime } from "@/utils/formatHelpers";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import viLocale from "date-fns/locale/vi";
import { Calendar } from 'react-native-calendars';
import { getStartOfWeek, getWeekDays } from '@/utils/dateFn';
import bloodDonationAPI from "@/apis/bloodDonation";

const { width: screenWidth } = Dimensions.get('window');

export default function DonationListScreen() {
  const [donations, setDonations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Định nghĩa các filter status cho trang này
  const FILTER_OPTIONS = [
    { label: "Tất cả", value: "all" },
    { label: "Đang hiến", value: "donating" },
    { label: "Hoàn thành", value: "completed" },
    { label: "Huỷ hiến", value: "cancelled" },
  ];

  const fetchDonations = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
      });

      // Nếu không phải "Tất cả", thêm status filter
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await bloodDonationAPI.HandleBloodDonation(
        `?${params.toString()}`,
        null,
        'get'
      );
      
      if (response.data && response.data.data) {
        // Transform data để phù hợp với UI
        const transformedData = response.data.data.map(donation => ({
          id: donation._id,
          registrationId: donation.bloodDonationRegistrationId?._id || donation.bloodDonationRegistrationId,
          donor: {
            name: donation.userId?.fullName || "N/A",
            avatar: donation.userId?.avatar || "https://via.placeholder.com/50",
            bloodType: donation.bloodGroupId?.name || "N/A",
            gender: donation.userId?.sex === 'male' ? 'Nam' : donation.userId?.sex === 'female' ? 'Nữ' : 'N/A',
            dob: donation.userId?.yob ? new Date(donation.userId.yob).toLocaleDateString('vi-VN') : 'N/A',
            phone: donation.userId?.phone || 'N/A',
          },
          nurse: {
            name: donation.createdBy?.userId?.fullName || "Chưa phân công",
          },
          facility: {
            name: donation.bloodDonationRegistrationId?.facilityId?.name || "N/A",
          },
          startTime: donation.donationDate || donation.createdAt,
          endTime: donation.status === 'completed' ? donation.updatedAt : null,
          status: donation.status === 'donating' ? 'in_progress' : 
                  donation.status === 'completed' ? 'completed' : 'pending',
          bloodVolume: donation.quantity || null,
         
          vitalSigns: {
            bloodPressure: "120/80", // Mock data - would come from health check
            pulse: 75,
            temperature: 36.5,
          },
          notes: donation.notes || "",
          giftDistributed: !!donation.giftPackageId, // Check if gift package has been distributed
          giftPackage: donation.giftPackageId ? {
            id: donation.giftPackageId._id,
            name: donation.giftPackageId.name,
            description: donation.giftPackageId.description
          } : null,
          originalData: donation, // Keep original data for updates
        }));

        // Nếu statusFilter là 'all', filter chỉ 2 status cho phép
        let filteredData = transformedData;
        if (statusFilter === 'all') {
          filteredData = transformedData.filter(donation => 
            donation.originalData.status === 'donating' || 
            donation.originalData.status === 'completed' ||
            donation.originalData.status === 'cancelled'
          );
        }
        
        setDonations(filteredData);
      } else {
        setDonations([]);
      }
    } catch (error) {
      console.error("Error fetching donations:", error);
      setDonations([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDonations();
    setRefreshing(false);
  };



  // Refresh when screen is focused (when returning from detail screen)
  useFocusEffect(
    React.useCallback(() => {
      fetchDonations();
    }, [statusFilter, searchText])
  );

  // Lọc donations theo ngày, trạng thái, tên
  const filteredDonations = donations.filter((donation) => {
    const donationDate = new Date(donation.startTime);
    const matchDate =
      donationDate.getFullYear() === selectedDate.getFullYear() &&
      donationDate.getMonth() === selectedDate.getMonth() &&
      donationDate.getDate() === selectedDate.getDate();
    
    const matchName = donation.donor.name.toLowerCase().includes(searchText.toLowerCase());
    return matchDate && matchName;
  });

  // Chuyển tuần
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
    setSelectedDate(prev);
  };
  
  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
    setSelectedDate(next);
  };

  const getStatusInfo = (donation) => {
    if (donation.originalData?.status === 'donating') {
      return { label: 'Đang hiến', color: '#FFA502', icon: 'heart-pulse' };
    } else if (donation.originalData?.status === 'completed') {
      return { label: 'Hoàn thành', color: '#2ED573', icon: 'check-circle' };
    } else if (donation.originalData?.status === 'cancelled') {
      return { label: 'Huỷ hiến', color: '#FF4040', icon: 'close-circle' };
    } else {
      return { label: 'Chưa xác định', color: '#95A5A6', icon: 'help-circle' };
    }
  };

  const renderDonationItem = ({ item }) => {
    const statusInfo = getStatusInfo(item);

    return (
      <TouchableOpacity
        style={styles.donationCard}
        onPress={() => {
          // Navigate to donation detail
          // navigation.navigate('DonationDetail', { donationId: item.id });
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.donorInfo}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: item.donor.avatar || "https://via.placeholder.com/50" }}
                style={styles.avatar}
              />
              <View style={styles.bloodTypeBadge}>
                <Text style={styles.bloodTypeText}>{item.donor.bloodType}</Text>
              </View>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.donorName}>{item.donor.name}</Text>
              <View style={styles.detailsRow}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#4A90E2" />
                <Text style={styles.details}>
                  {formatDateTime(new Date(item.startTime))}
                </Text>
              </View>
              <View style={styles.detailsRow}>
                <MaterialCommunityIcons name="hospital-building" size={16} color="#636E72" />
                <Text style={styles.details}>CS: {item.facility.name}</Text>
              </View>
              <View style={styles.detailsRow}>
                <MaterialCommunityIcons name="medical-bag" size={16} color="#636E72" />
                <Text style={styles.details}>YT: {item.nurse.name}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <MaterialCommunityIcons name={statusInfo.icon} size={14} color="#FFF" />
            <Text style={styles.statusText}>{statusInfo.label}</Text>
          </View>
        </View>    
        <View style={styles.cardFooter}>
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.primaryActionBtn]}
              onPress={() => {
                // Handle action based on status
                if (item.originalData?.status === 'donating') {
                  // Monitor/Update donation - Navigate to update form
                  navigation.navigate('DonationDetail', { 
                    donationId: item.id,
                    mode: 'update'
                  });
                } else if (item.originalData?.status === 'completed') {
                  // View donation details
                  navigation.navigate('DonationDetail', { 
                    donationId: item.id,
                    mode: 'view'
                  });
                } else {
                  // Default view mode for other statuses
                  navigation.navigate('DonationDetail', { 
                    donationId: item.id,
                    mode: 'view'
                  });
                }
              }}
            >
              <MaterialIcons 
                name={
                  item.originalData?.status === 'donating' ? 'edit' : 
                  item.originalData?.status === 'completed' ? 'visibility' : 
                  'info'
                } 
                size={16} 
                color="#FF6B6B" 
              />
              <Text style={styles.actionText}>
                {item.originalData?.status === 'donating' ? 'Cập nhật' : 
                 item.originalData?.status === 'completed' ? 'Chi tiết' : 
                 'Xem'}
              </Text>
            </TouchableOpacity>

            {/* Show gift distribution button for completed donations that haven't received gifts */}
            {item.originalData?.status === 'completed' && !item.giftDistributed && (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.giftActionBtn]}
                onPress={() => {
                  navigation.navigate('GiftDistribution', { 
                    donationId: item.id,
                    donorName: item.donor.name,
                    bloodType: item.donor.bloodType,
                    donationData: item.originalData
                  });
                }}
              >
                <MaterialCommunityIcons name="gift" size={16} color="#8B5CF6" />
                <Text style={[styles.actionText, styles.giftActionText]}>
                  Phát quà
                </Text>
              </TouchableOpacity>
            )}

            {/* Show gift status for completed donations that have received gifts */}
            {item.originalData?.status === 'completed' && item.giftDistributed && (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.giftCompletedBtn]}
                onPress={() => {
                  Alert.alert(
                    'Thông tin quà tặng',
                    `Đã phát gói quà: ${item.giftPackage?.name || 'Không xác định'}`,
                    [{ text: 'OK' }]
                  );
                }}
              >
                <MaterialCommunityIcons name="gift-outline" size={16} color="#2ED573" />
                <Text style={[styles.actionText, styles.giftCompletedText]}>
                  Đã phát
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Show post-donation care button for completed donations */}
            {item.originalData?.status === 'completed' && (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.secondaryActionBtn]}
                onPress={() => {
                  navigation.navigate('DonorStatus', { 
                    donationId: item.id,
                    mode: 'update'
                  });
                }}
              >
                <MaterialCommunityIcons name="medical-bag" size={16} color="#2ED573" />
                <Text style={[styles.actionText, styles.secondaryActionText]}>
                  Kiểm tra
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Custom Date Picker Component
  const CustomDatePicker = () => {
    const [tempDate, setTempDate] = useState(selectedDate);
    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 10}, (_, i) => currentYear - 5 + i);
    const months = Array.from({length: 12}, (_, i) => i + 1);
    const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();
    const days = Array.from({length: getDaysInMonth(tempDate.getFullYear(), tempDate.getMonth() + 1)}, (_, i) => i + 1);

    const handleConfirmDate = () => {
      setSelectedDate(tempDate);
      setCurrentWeekStart(getStartOfWeek(tempDate));
      setCalendarVisible(false);
    };

    return (
      <Modal
        transparent={true}
        animationType="slide"
        visible={calendarVisible}
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.dateModalOverlay}>
          <View style={styles.dateModalContent}>
            <View style={styles.dateModalHeader}>
              <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                <Text style={styles.dateModalCancel}>Hủy</Text>
              </TouchableOpacity>
              <Text style={styles.dateModalTitle}>Chọn ngày</Text>
              <TouchableOpacity onPress={handleConfirmDate}>
                <Text style={styles.dateModalDone}>Xong</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.datePickerBody}>
              <View style={styles.datePickerColumns}>
                {/* Day Column */}
                <View style={styles.dateColumn}>
                  <Text style={styles.columnTitle}>Ngày</Text>
                  <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                    {days.map(day => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dateItem,
                          tempDate.getDate() === day && styles.selectedDateItem
                        ]}
                        onPress={() => {
                          const newDate = new Date(tempDate);
                          newDate.setDate(day);
                          setTempDate(newDate);
                        }}
                      >
                        <Text style={[
                          styles.dateItemText,
                          tempDate.getDate() === day && styles.selectedDateText
                        ]}>
                          {day.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Month Column */}
                <View style={styles.dateColumn}>
                  <Text style={styles.columnTitle}>Tháng</Text>
                  <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                    {months.map(month => (
                      <TouchableOpacity
                        key={month}
                        style={[
                          styles.dateItem,
                          tempDate.getMonth() + 1 === month && styles.selectedDateItem
                        ]}
                        onPress={() => {
                          const newDate = new Date(tempDate);
                          newDate.setMonth(month - 1);
                          setTempDate(newDate);
                        }}
                      >
                        <Text style={[
                          styles.dateItemText,
                          tempDate.getMonth() + 1 === month && styles.selectedDateText
                        ]}>
                          {month.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Year Column */}
                <View style={styles.dateColumn}>
                  <Text style={styles.columnTitle}>Năm</Text>
                  <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                    {years.map(year => (
                      <TouchableOpacity
                        key={year}
                        style={[
                          styles.dateItem,
                          tempDate.getFullYear() === year && styles.selectedDateItem
                        ]}
                        onPress={() => {
                          const newDate = new Date(tempDate);
                          newDate.setFullYear(year);
                          setTempDate(newDate);
                        }}
                      >
                        <Text style={[
                          styles.dateItemText,
                          tempDate.getFullYear() === year && styles.selectedDateText
                        ]}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Danh Sách Hiến Máu</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerCount}>{filteredDonations.length}</Text>
        </View>
      </View>

      {/* Compact Filter & Search Section */}
      <View style={styles.compactFilterSection}>
        {/* Filter Chips Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.compactFilterChips}
          style={styles.compactFilterScrollView}
        >
          {FILTER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.compactFilterChip, statusFilter === option.value && styles.compactFilterChipActive]}
              onPress={() => setStatusFilter(option.value)}
            >
              <Text style={[styles.compactFilterChipText, statusFilter === option.value && styles.compactFilterChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Search Row */}
        <View style={styles.compactSearchRow}>
          <View style={styles.compactSearchContainer}>
            <MaterialCommunityIcons name="magnify" size={16} color="#A0AEC0" />
            <TextInput
              style={styles.compactSearchInput}
              placeholder="Tìm kiếm người hiến..."
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#A0AEC0"
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#A0AEC0" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <TouchableOpacity 
            style={styles.compactCalendarButton} 
            onPress={() => setCalendarVisible(true)}
          >
            <MaterialCommunityIcons name="calendar" size={18} color="#FF6B6B" />
          </TouchableOpacity>
          
          <Text style={styles.compactDateText}>
            {format(selectedDate, 'dd/MM/yyyy', { locale: viLocale })}
          </Text>
        </View>
      </View>

      {/* Enhanced Date Picker Modal */}
      <CustomDatePicker />

      {/* Calendar Bar */}
      <View style={styles.calendarBar}>
        <TouchableOpacity onPress={handlePrevWeek} style={styles.weekNavBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#FF6B6B" />
        </TouchableOpacity>
        {getWeekDays(currentWeekStart).map((day, idx) => {
          const isSelected =
            day.getFullYear() === selectedDate.getFullYear() &&
            day.getMonth() === selectedDate.getMonth() &&
            day.getDate() === selectedDate.getDate();
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.dayBtn, isSelected && styles.dayBtnSelected]}
              onPress={() => setSelectedDate(day)}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                {format(day, "EEE", { locale: viLocale })}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {format(day, "d")}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={handleNextWeek} style={styles.weekNavBtn}>
          <MaterialCommunityIcons name="chevron-right" size={28} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      {/* Danh sách hiến máu */}
      <FlatList
        data={filteredDonations}
        renderItem={renderDonationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={["#FF6B6B"]} 
            tintColor="#FF6B6B"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="water" size={64} color="#FF6B6B" />
            <Text style={styles.emptyText}>
              Không có lần hiến máu nào trong ngày này
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    backgroundColor: "#FF6B6B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 20 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  headerBadge: {
    width: 40,
    height: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCount: {
    color: "#FF6B6B",
    fontWeight: "bold",
    fontSize: 16,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  filterSubtitle: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  filterControls: {
    gap: 12,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
  },
  filterChip: {
    backgroundColor: '#F7FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  filterChipText: {
    color: '#4A5568',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#2D3748',
    marginLeft: 8,
    paddingVertical: 0,
  },
  calendarButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 4,
    flexShrink: 0,
  },
  weekNavBtn: {
    padding: 4,
    borderRadius: 8,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  dayBtn: {
    alignItems: "center",
    justifyContent: 'center',
    width: 44,
    height: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 8,
    marginHorizontal: 1,
    backgroundColor: '#fff',
  },
  dayBtnSelected: {
    backgroundColor: "#FF6B6B",
  },
  dayLabel: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "500",
  },
  dayLabelSelected: {
    color: "#fff",
    fontWeight: "bold",
  },
  dayNum: {
    fontSize: 16,
    color: "#2D3748",
    fontWeight: "600",
  },
  dayNumSelected: {
    color: "#fff",
    fontWeight: "bold",
  },
  listContainer: {
    padding: 16,
  },
  donationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    minHeight: 180,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  donorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#FF6B6B",
  },
  bloodTypeBadge: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: "#FF6B6B",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  bloodTypeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  donorName: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#2D3748",
    marginBottom: 6,
    lineHeight: 22,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingVertical: 1,
  },
  details: {
    fontSize: 14,
    color: "#4A5568",
    marginLeft: 6,
    lineHeight: 18,
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A90E2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    maxWidth: 120,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
    textAlign: 'center',
  },
  progressSection: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2D3748",
  },
  progressVolume: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FF6B6B",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FF6B6B",
    borderRadius: 4,
  },
  vitalSigns: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    justifyContent: "space-around",
  },
  vitalItem: {
    alignItems: "center",
  },
  vitalLabel: {
    fontSize: 12,
    color: "#636E72",
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2D3748",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEAEA",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 72,
    maxWidth: 90,
    justifyContent: 'center',
  },
  primaryActionBtn: {
    backgroundColor: "#FFEAEA",
  },
  actionText: {
    fontSize: 11,
    color: "#FF6B6B",
    fontWeight: "600",
    marginLeft: 3,
    textAlign: 'center',
    flexShrink: 1,
  },
  secondaryActionBtn: {
    backgroundColor: "#E8F7E8",
  },
  secondaryActionText: {
    color: "#2ED573",
    fontWeight: "600",
  },
  giftActionBtn: {
    backgroundColor: "#F3E8FF",
  },
  giftActionText: {
    color: "#8B5CF6",
    fontWeight: "600",
  },
  giftCompletedBtn: {
    backgroundColor: "#E8F7E8",
    borderWidth: 1,
    borderColor: "#2ED573",
  },
  giftCompletedText: {
    color: "#2ED573",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#718096",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 24,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dateModalCancel: {
    fontSize: 16,
    color: '#636E72',
    fontWeight: '600',
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  dateModalDone: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  datePickerBody: {
    padding: 20,
  },
  datePickerColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateColumn: {
    flex: 1,
    alignItems: 'center',
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateScrollView: {
    maxHeight: 200,
    width: '100%',
  },
  dateItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  selectedDateItem: {
    backgroundColor: '#FF6B6B',
  },
  dateItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    textAlign: 'center',
  },
  selectedDateText: {
    color: '#FFFFFF',
  },
  compactFilterSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  compactFilterScrollView: {
    marginBottom: 10,
  },
  compactFilterChips: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
  },
  compactFilterChip: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compactFilterChipActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  compactFilterChipText: {
    color: '#4A5568',
    fontSize: 13,
    fontWeight: '500',
  },
  compactFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  compactSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compactSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2D3748',
    marginLeft: 6,
    paddingVertical: 0,
  },
  compactCalendarButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  compactDateText: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
    minWidth: 70,
    textAlign: 'center',
  },
});
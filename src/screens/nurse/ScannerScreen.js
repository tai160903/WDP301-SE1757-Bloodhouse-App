import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import bloodDonationRegistrationAPI from '@/apis/bloodDonationRegistration';
import { toast } from 'sonner-native';
import { DONATION_STATUS } from '@/constants/donationStatus';

export default function ScannerScreen({ route, navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [flashMode, setFlashMode] = useState('off');
  const [processing, setProcessing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  
  const mode = route.params?.mode || 'smart';
  const giftId = route.params?.giftId;
  const giftName = route.params?.giftName;
  const registrationId = route.params?.registrationId;
  const fromTab = route.params?.fromTab || false;
  const userRole = route.params?.userRole || 'nurse'; // 'doctor' or 'nurse'

  // Request camera permission khi component mount
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        console.error('Camera permission error:', error);
        setHasPermission(false);
      }
    };

    requestPermission();
  }, []);

  // Handle screen focus/blur để reset camera states
  useFocusEffect(
    React.useCallback(() => {
      // Khi screen focus
      
      // Reset scanner states
      setScanned(false);
      setProcessing(false);
      
      // Delay nhỏ để đảm bảo camera được mount đúng cách
      const timer = setTimeout(() => {
        setIsFocused(true);
      }, 100);
      
      // Cleanup khi screen blur
      return () => {
        clearTimeout(timer);
        setIsFocused(false);
        setScanned(false);
        setProcessing(false);
      };
    }, [])
  );

  // Helper function để handle navigation sau khi hoàn thành
  const handleNavigationAfterSuccess = () => {
    if (fromTab) {
      if (userRole === 'doctor') {
        // Doctor: Navigate về HealthCheckListScreen
        navigation.navigate('HealthChecks', { refresh: true });
      } else {
        // Nurse: Navigate về DonorListScreen
      navigation.navigate('DonorList', { refresh: true });
      }
    } else {
      // Nếu từ screen khác, goBack
      navigation.goBack();
    }
  };

  // Retry camera permission
  const retryCameraPermission = async () => {
    try {
      setHasPermission(null); // Set loading state
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status === 'granted') {
        // Reset focus state để trigger camera remount
        setIsFocused(false);
        setTimeout(() => {
          setIsFocused(true);
        }, 100);
      }
    } catch (error) {
      console.error('Retry camera permission error:', error);
      setHasPermission(false);
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    if (processing) return; // Prevent multiple scans
    setScanned(true);
    
    // Use smart scanning with status check for main workflow
    if (mode === 'smart' || mode === 'checkin') {
      handleSmartScan(data);
    } else {
      // Legacy modes for specific purposes
    switch (mode) {
      case 'donor':
        handleDonorScan(data);
        break;
      case 'gift':
        handleGiftScan(data);
        break;
      case 'blood':
        handleBloodScan(data);
        break;
      default:
          handleSmartScan(data);
      }
    }
  };

  const handleSmartScan = async (qrData) => {
    try {
      setProcessing(true);
      
      // Parse QR code data
      let parsedData;
      try {
        parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
      } catch (error) {
        throw new Error('QR code không đúng định dạng');
      }

      // Validate QR data structure
      if (!parsedData.registrationId || !parsedData.userId) {
        throw new Error('QR code không chứa đầy đủ thông tin cần thiết');
      }

      if (userRole === 'doctor') {
        // Doctor: Use existing doctor QR scan endpoint based on status
        await handleDoctorQRScan(qrData);
      } else {
        // Nurse: Use new smart scan endpoint
        const response = await bloodDonationRegistrationAPI.HandleBloodDonationRegistration(
          '/nurse/smart-scan',
          { qrData: qrData },
          'post'
        );

        if (response.success || response.data) {
          // Pass original qrData along with response data
          await handleNurseSmartScanResponse(response.data, qrData);
        } else {
          throw new Error(response.message || 'Không thể xử lý QR code');
        }
      }

    } catch (error) {
      console.error('Smart scan error:', error);
      Alert.alert(
        'LỖI QUÉT QR CODE',
        `${error.response?.data?.message || 'Có lỗi xảy ra khi quét QR code'}\n\nVui lòng đảm bảo QR code rõ nét và đúng định dạng.`,
        [
          {
            text: 'QUAY LẠI',
            style: 'cancel',
            onPress: () => handleNavigationAfterSuccess(),
          },
          {
            text: 'QUÉT LẠI',
            style: 'default',
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            },
          },
        ]
      );
      
      toast.error(`${error.response?.data?.message || 'QR code không hợp lệ'}`);
    }
  };

  const handleDoctorQRScan = async (qrData) => {
              try {
          // Doctor uses existing doctor QR scan API
                const response = await bloodDonationRegistrationAPI.HandleBloodDonationRegistration(
      '/doctor/qr-scan',
                  { qrData: qrData },
                  'post'
                );

                if (response.success || response.data) {
      const healthCheckData = response.data;
      
      const patientName = healthCheckData.userId?.fullName || 'Không xác định';
      const doctorName = healthCheckData.doctorId?.userId?.fullName || 'Không xác định';
      const code = healthCheckData.code || 'Không có mã';
      
                  Alert.alert(
        'THÔNG TIN HEALTH CHECK',
        `Mã phiếu khám: ${code}\nBệnh nhân: ${patientName}\nBác sĩ phụ trách: ${doctorName}\n\nBạn có muốn xem chi tiết phiếu khám?`,
                    [
                      {
            text: 'ĐÓNG',
            style: 'cancel',
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            },
          },
          {
            text: 'XEM CHI TIẾT',
                        onPress: () => {
              navigation.navigate('HealthCheckUpdate', { 
                healthCheckId: healthCheckData._id,
                registrationId: healthCheckData.registrationId 
              });
                        },
                      },
                    ]
                  );
                } else {
      throw new Error('Không thể lấy thông tin health check');
    }
    } catch (error) {
      console.error('Doctor QR scan error:', error);
      Alert.alert(
        'LỖI QUÉT QR CODE',
        `${error.response?.data?.message || 'Có lỗi xảy ra khi quét QR code'}\n\nVui lòng đảm bảo QR code rõ nét và đúng định dạng.`,
        [{ text: 'ĐÓNG', style: 'cancel' }]
      );
    }

  };

  const handleNurseSmartScanResponse = async (data, originalQrData) => {
    const { action, status, code, data: responseData, actionData } = data;
    
    // Display action-specific UI
    setScanned(false);
    setProcessing(false); // Always stop processing when displaying response
    
    const statusText = getStatusDisplayText(status);
    const { registration, healthCheck, donation, donorStatusLog } = responseData;
    
    // Safe access to registration data
    const donorName = registration?.donor?.name || 'Không xác định';
    const bloodType = registration?.donor?.bloodType || 'Không xác định';
    const registrationCode = code || 'Không có mã';
    
    let baseMessage = `Mã đăng ký: ${registrationCode}\nNgười hiến: ${donorName}\nNhóm máu: ${bloodType}\nTrạng thái: ${statusText}`;
    
    // Add specific information based on action
    switch (action) {
      case 'check_in':
        Alert.alert(
          'THỰC HIỆN CHECK-IN',
          `${actionData?.message || 'Sẵn sàng check-in'}\n\n${baseMessage}`,
          [
            { 
              text: 'HỦY', 
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
                }
            },
            {
              text: actionData?.buttonText || 'CHECK-IN',
              onPress: () => {
                performCheckIn(originalQrData);
              }
            }
          ]
        );
        break;
        
      case 'view_registration':
        let registrationMessage = baseMessage;
        
        if (healthCheck) {
          const doctorName = healthCheck.doctor?.name || 'Không xác định';
          registrationMessage += `\n\nTình trạng: Đã có phiếu khám sức khỏe\nBác sĩ: ${doctorName}`;
        } else if (actionData?.canCreateHealthCheck) {
          registrationMessage += '\n\nTình trạng: Chưa có phiếu khám sức khỏe';
        }
        
        Alert.alert(
          'THÔNG TIN ĐĂNG KÝ',
          registrationMessage,
          [
            { 
              text: 'ĐÓNG', 
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              }
            },
            {
              text: actionData?.buttonText || 'XEM CHI TIẾT',
              onPress: () => {
                if (actionData?.navigateTo === 'HealthCheckDetail' && healthCheck) {
                  navigation.navigate('HealthCheckDetail', {
                    registrationId: registration.id
                  });
                } else if (actionData?.navigateTo === 'HealthCheckCreateFromDonor') {
                  navigation.navigate('HealthCheckCreateFromDonor', {
                    registrationId: registration.id
                  });
                }
              }
            }
          ]
        );
        break;
        
      case 'start_donation':
        let donationMessage = baseMessage;
        
        if (healthCheck) {
          const eligibilityText = healthCheck.isEligible ? 'Đủ điều kiện' : 'Không đủ điều kiện';
          const doctorName = healthCheck.doctor?.name || 'Không xác định';
          donationMessage += `\n\nKết quả khám: ${eligibilityText}\nBác sĩ: ${doctorName}`;
        }
        
                Alert.alert(
          'BẮT ĐẦU HIẾN MÁU',
          donationMessage,
                  [
                    {
              text: 'ĐÓNG', 
                      style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              }
            },
            {
              text: actionData?.buttonText || 'BẮT ĐẦU',
              onPress: () => {
                if (actionData?.canStartDonation) {
                  navigation.navigate('HealthCheckDetail', {
                    registrationId: registration.id
                  });
                } else {
                  Alert.alert(
                    'KHÔNG THỂ HIẾN MÁU', 
                    'Người hiến chưa đủ điều kiện hiến máu theo kết quả khám sức khỏe.',
                    [{ 
                      text: 'ĐÓNG', 
                      style: 'default',
                      onPress: () => {
                        setScanned(false);
                        setProcessing(false);
                      }
                    }]
                  );
                }
              }
            }
          ]
        );
        break;
        
      case 'manage_donation':
        let managementMessage = baseMessage;
        
        if (donation) {
          const donationCode = donation.code || 'Không có mã';
          const quantity = donation.quantity > 0 ? `${donation.quantity} ml` : 'Chưa cập nhật';
          const donationStatus = donation.status === 'donating' ? 'Đang hiến máu' : donation.status || 'Không xác định';
          managementMessage += `\n\nMã hiến máu: ${donationCode}\nThể tích: ${quantity}\nTrạng thái hiến: ${donationStatus}`;
        }
        
        Alert.alert(
          'QUẢN LÝ HIẾN MÁU',
          managementMessage,
          [
            { 
              text: 'ĐÓNG', 
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              }
            },
            {
              text: actionData?.buttonText || 'QUẢN LÝ',
              onPress: () => {
                if (donation?.id) {
                  navigation.navigate('DonationDetail', {
                    donationId: donation.id,
                    mode: actionData?.mode || 'update'
                  });
                }
              }
            }
                  ]
                );
        break;
        
      case 'view_completed':
        let completedMessage = baseMessage;
        
        if (donation) {
          const donationCode = donation.code || 'Không có mã';
          const quantity = donation.quantity || 0;
          const donationDate = donation.donationDate 
            ? new Date(donation.donationDate).toLocaleDateString('vi-VN')
            : 'Không xác định';
          
          completedMessage += `\n\nMã hiến máu: ${donationCode}\nThể tích: ${quantity} ml\nNgày hiến: ${donationDate}`;
          
          if (donorStatusLog) {
            const statusLogStatus = donorStatusLog.status || 'Không xác định';
            const followUpStatus = donorStatusLog.recordedAt ? 'Đã hoàn tất theo dõi' : 'Đang theo dõi';
            completedMessage += `\n\nTrạng thái sau hiến: ${statusLogStatus}\n${followUpStatus}`;
          }
        }
        
        Alert.alert(
          'KẾT QUẢ HIẾN MÁU',
          completedMessage,
          [
            { 
              text: 'ĐÓNG', 
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              }
            },
            {
              text: actionData?.buttonText || 'XEM CHI TIẾT',
              onPress: () => {
                if (actionData?.navigateTo === 'DonorStatus' && donation?.id) {
                  navigation.navigate('DonorStatus', {
                    donationId: donation.id
                  });
                } else if (actionData?.navigateTo === 'DonationDetail' && donation?.id) {
                  navigation.navigate('DonationDetail', {
                    donationId: donation.id,
                    mode: actionData?.mode || 'view'
                  });
                }
              }
            }
          ]
        );
        break;
        
      case 'view_rejection':
        let rejectionMessage = baseMessage;
        
        if (healthCheck?.deferralReason) {
          const reason = healthCheck.deferralReason;
          const doctorName = healthCheck.doctor?.name || 'Không xác định';
          rejectionMessage += `\n\nLý do từ chối: ${reason}\nBác sĩ: ${doctorName}`;
        }
        
        Alert.alert(
          'ĐĂNG KÝ BỊ TỪ CHỐI',
          rejectionMessage,
          [
            { 
              text: 'ĐÓNG', 
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              }
            },
            {
              text: actionData?.buttonText || 'XEM CHI TIẾT',
              onPress: () => {
                navigation.navigate('HealthCheckDetail', {
                  registrationId: registration.id
                });
              }
            }
          ]
        );
        break;
        
      case 'view_cancelled':
        Alert.alert(
          'ĐĂNG KÝ ĐÃ HỦY',
          `${actionData?.message || 'Đăng ký đã bị hủy'}\n\n${baseMessage}`,
          [
            { 
              text: 'ĐÓNG', 
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              }
            }
          ]
        );
        break;
        
      default:
        Alert.alert(
          'THÔNG TIN QR CODE',
          `${actionData?.message || 'Trạng thái không xác định'}\n\n${baseMessage}`,
          [
            { 
              text: 'ĐÓNG', 
              style: 'cancel',
              onPress: () => {
                setScanned(false);
                setProcessing(false);
              }
            }
          ]
        );
        break;
    }
  };

  const performCheckIn = async (qrData) => {
    try {
      setProcessing(true);
      
      // Use the original QR data from scan, don't create new one
      const response = await bloodDonationRegistrationAPI.HandleBloodDonationRegistration(
        '/check-in',
        { qrData: qrData },
        'post'
      );

      if (response.data) {
        Alert.alert(
          'CHECK-IN THÀNH CÔNG',
          'Đã hoàn tất check-in cho người hiến máu. Hệ thống đã cập nhật trạng thái và thông báo cho người hiến.',
          [
            {
              text: 'HOÀN TẤT',
              onPress: () => {
                handleNavigationAfterSuccess();
              }
            }
        ]
      );
      }
    } catch (error) {
      console.error('Check-in error:', error);
      const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi thực hiện check-in';
      
      Alert.alert(
        'LỖI CHECK-IN',
        errorMessage,
        [
          {
            text: 'ĐÓNG',
            onPress: () => {
              setScanned(false);
              setProcessing(false);
            }
          }
        ]
      );
    } finally {
      setProcessing(false);
    }
  };

  const getStatusDisplayText = (status) => {
    const statusMap = {
      [DONATION_STATUS.PENDING_APPROVAL]: 'Chờ phê duyệt',
      [DONATION_STATUS.REGISTERED]: 'Đã đăng ký', 
      [DONATION_STATUS.CHECKED_IN]: 'Đã check-in',
      [DONATION_STATUS.IN_CONSULT]: 'Đang tư vấn',
      [DONATION_STATUS.WAITING_DONATION]: 'Chờ hiến máu',
      [DONATION_STATUS.DONATING]: 'Đang hiến máu',
      [DONATION_STATUS.DONATED]: 'Đã hiến máu',
      [DONATION_STATUS.COMPLETED]: 'Hoàn thành',
      [DONATION_STATUS.REJECTED]: 'Bị từ chối',
    };
    return statusMap[status] || status;
  };

  const handleDonorScan = (data) => {
    // Validate and clean data
    const donorCode = data?.trim() || 'Không xác định';
    
    Alert.alert(
      'XÁC NHẬN MÃ NGƯỜI HIẾN',
      `Mã định danh: ${donorCode}\n\nBạn có muốn xử lý thông tin người hiến này?`,
      [
        {
          text: 'HỦY',
          style: 'cancel',
          onPress: () => setScanned(false),
        },
        {
          text: 'XÁC NHẬN',
          onPress: () => {
            // TODO: Navigate to donor details or update status
            handleNavigationAfterSuccess();
          },
        },
      ]
    );
  };

  const handleGiftScan = (data) => {
    if (!giftId || !giftName) {
      Alert.alert(
        'LỖI THÔNG TIN QUÀ TẶNG', 
        'Không có thông tin quà tặng hoặc thông tin không đầy đủ.',
        [{ text: 'ĐÓNG', style: 'default' }]
      );
      return;
    }

    const recipientCode = data?.trim() || 'Không xác định';
    const giftDisplayName = giftName?.trim() || 'Quà tặng';

    Alert.alert(
      'XÁC NHẬN PHÁT QUÀ',
      `Quà tặng: ${giftDisplayName}\nMã người nhận: ${recipientCode}\n\nBạn có muốn xác nhận phát quà cho người này?`,
      [
        {
          text: 'HỦY',
          style: 'cancel',
          onPress: () => setScanned(false),
        },
        {
          text: 'XÁC NHẬN PHÁT QUÀ',
          onPress: () => {
            // TODO: Update gift distribution record
            handleNavigationAfterSuccess();
          },
        },
      ]
    );
  };

  const handleBloodScan = (data) => {
    const bloodUnitCode = data?.trim() || 'Không xác định';
    
    Alert.alert(
      'XÁC NHẬN ĐƠN VỊ MÁU',
      `Mã đơn vị máu: ${bloodUnitCode}\n\nBạn có muốn xử lý thông tin đơn vị máu này?`,
      [
        {
          text: 'HỦY',
          style: 'cancel',
          onPress: () => setScanned(false),
        },
        {
          text: 'XÁC NHẬN',
          onPress: () => {
            // TODO: Update blood unit tracking
            handleNavigationAfterSuccess();
          },
        },
      ]
    );
  };

  const toggleFlash = () => {
    setFlashMode(
      flashMode === 'torch'
        ? 'off'
        : 'torch'
    );
  };

  // Get appropriate API endpoint based on user role
  const getSmartScanEndpoint = () => {
    return userRole === 'doctor' ? '/doctor/smart-scan' : '/nurse/smart-scan';
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="camera-alt" size={64} color="#FFFFFF" />
          <Text style={styles.loadingText}>Đang yêu cầu quyền truy cập camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialIcons name="camera-off" size={64} color="#FF6B6B" />
          <Text style={styles.errorText}>Không có quyền truy cập camera</Text>
          <Text style={styles.errorSubText}>Vui lòng cấp quyền camera để sử dụng tính năng quét QR</Text>
        <TouchableOpacity
          style={styles.button}
            onPress={retryCameraPermission}
          >
            <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Thử lại</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
          onPress={() => handleNavigationAfterSuccess()}
        >
            <MaterialIcons name="arrow-back" size={20} color="#FF6B6B" />
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Quay lại</Text>
        </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => handleNavigationAfterSuccess()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {fromTab 
            ? userRole === 'doctor' 
              ? 'QR Scan - Bác Sĩ' 
              : 'QR Scan - Y Tá'
            : mode === 'smart'
            ? userRole === 'doctor'
              ? 'Smart Scan - Bác Sĩ'
              : 'Smart Scan - Y Tá'
            : mode === 'donor'
            ? 'Quét Mã Người Hiến'
            : mode === 'gift'
            ? 'Quét Mã Phát Quà'
            : mode === 'blood'
            ? 'Quét Mã Đơn Vị Máu'
            : 'Quét Mã Check-in'}
        </Text>
        <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
          <MaterialIcons
            name={flashMode === 'torch' ? 'flash-on' : 'flash-off'}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.scannerContainer}>
        {hasPermission && isFocused ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              enableTorch={flashMode === 'torch'}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
            <View style={styles.overlay}>
              <View style={styles.scanArea} />
            </View>
          </>
        ) : (
          <View style={styles.cameraPlaceholder}>
            <MaterialIcons 
              name={hasPermission === false ? "camera-off" : "camera-alt"} 
              size={64} 
              color={hasPermission === false ? "#FF6B6B" : "#FFFFFF"} 
            />
            <Text style={styles.placeholderText}>
              {hasPermission === false 
                ? 'Không có quyền truy cập camera'
                : !isFocused 
                ? 'Đang khởi tạo camera...'
                : 'Đang tải camera...'}
            </Text>
            {hasPermission === false && (
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={retryCameraPermission}
              >
                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Thử lại</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        <View style={styles.guideContainer}>
          <Text style={styles.guideText}>
            {processing 
              ? 'Đang phân tích QR code...'
              : !hasPermission 
              ? 'Vui lòng cấp quyền truy cập camera'
              : !isFocused
              ? 'Đang khởi tạo camera...'
              : mode === 'smart'
              ? userRole === 'doctor'
                ? 'Đặt QR code vào khung - Hệ thống sẽ phân tích cho Bác Sĩ'
                : 'Đặt QR code vào khung - Hệ thống sẽ phân tích cho Y Tá'
              : mode === 'donor'
              ? 'Đặt mã định danh người hiến vào khung hình'
              : mode === 'gift'
              ? 'Đặt mã định danh người nhận quà vào khung hình'
              : mode === 'blood'
              ? 'Đặt mã đơn vị máu vào khung hình'
              : 'Đặt mã đăng ký vào khung hình'}
          </Text>
        </View>

        {scanned && !processing && hasPermission && isFocused && (
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
            <Text style={styles.rescanText}>QUÉT LẠI</Text>
          </TouchableOpacity>
        )}

        {processing && (
          <View style={styles.processingContainer}>
            <View style={styles.processingCard}>
              <MaterialIcons name="hourglass-empty" size={32} color="#FF6B6B" />
              <Text style={styles.processingText}>Đang phân tích QR code</Text>
              <Text style={styles.processingSubText}>Hệ thống đang kiểm tra trạng thái và định tuyến</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  flashButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  guideContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  guideText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    lineHeight: 22,
  },
  rescanButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  rescanText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  button: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginLeft: 8,
  },
  processingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  processingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  processingSubText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
  },
  errorSubText: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  secondaryButtonText: {
    color: '#FF6B6B',
  },
}); 
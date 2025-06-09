import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigatorNurse from "./TabNavigatorNurse";
import GiftDistributionFormScreen from "@/screens/nurse/GiftDistributionFormScreen";
import HealthCheckCreateFromDonorScreen from "@/screens/nurse/healthCheck/HealthCheckCreateFromDonorScreen";
import HealthCheckDetailScreen from "@/screens/nurse/healthCheck/HealthCheckDetailScreen";
import DonationCreateFormScreen from "@/screens/nurse/donation/donationCreateFormScreen";
import DonationDetailScreen from "@/screens/nurse/donation/donationDetailScreen";
import DonorStatusScreen from "@/screens/nurse/donation/DonorStatusScreen";
import ScannerScreen from "@/screens/nurse/ScannerScreen";
import GiftDistributionScreen from "@/screens/nurse/gift/GiftDistributionScreen";

const MainNavigatorNurse = () => {
  const Stack = createNativeStackNavigator();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "white" },
        animation: "fade_from_bottom",
      }}
    >
      <Stack.Screen name="TabNavigatorNurse" component={TabNavigatorNurse} />
      <Stack.Screen name="GiftDistributionForm" component={GiftDistributionFormScreen} />
      <Stack.Screen name="Scanner" component={ScannerScreen} />
      <Stack.Screen name="HealthCheckCreateFromDonor" component={HealthCheckCreateFromDonorScreen} />
      <Stack.Screen name="HealthCheckDetail" component={HealthCheckDetailScreen} />
      <Stack.Screen name="DonationCreateForm" component={DonationCreateFormScreen} />
      <Stack.Screen name="DonationDetail" component={DonationDetailScreen} />
      <Stack.Screen name="DonorStatus" component={DonorStatusScreen} />
      <Stack.Screen name="GiftDistribution" component={GiftDistributionScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigatorNurse;

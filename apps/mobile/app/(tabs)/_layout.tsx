import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** A tab icon: outlined, filled while its tab is selected. */
function tabIcon(name: IconName, selectedName: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons size={26} name={focused ? selectedName : name} color={color as string} />;
  };
}

const RoomsIcon = tabIcon('home-outline', 'home');
const ShopIcon = tabIcon('storefront-outline', 'storefront');
const InventoryIcon = tabIcon('cube-outline', 'cube');
const ProfileIcon = tabIcon('person-circle-outline', 'person-circle');

export default function TabLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: t.colors.tabIconSelected,
        tabBarInactiveTintColor: t.colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: t.colors.tabBar,
          borderTopColor: t.colors.border,
          borderTopWidth: t.borderWidth.thin,
        },
        tabBarLabelStyle: { ...t.type.caption, fontFamily: t.fontFamily.bodyBold },
      }}>
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="conversations"
        options={{ title: 'Rooms', tabBarIcon: RoomsIcon }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: 'Shop', tabBarIcon: ShopIcon }}
      />
      <Tabs.Screen
        name="inventory"
        options={{ title: 'Inventory', tabBarIcon: InventoryIcon }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ProfileIcon }}
      />
    </Tabs>
  );
}

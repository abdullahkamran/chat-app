import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import useCachedResources from './hooks/useCachedResources';
import useColorScheme from './hooks/useColorScheme';
import Navigation from './navigation';
import { createContext, useState } from 'react';
import { USER_ID1 } from './utils/config';

export interface User {
  userId: string;
}

export const UserContext = createContext<{ user: User | null, setUser: (user: User) => void }>({ user: null, setUser: () => {} });

export default function App() {
  const isLoadingComplete = useCachedResources();
  const colorScheme = useColorScheme();

  const [user, setUser] = useState<User | null>({
    userId: USER_ID1,
  });
  const userContext = { user, setUser };

  if (!isLoadingComplete) {
    return null;
  } else {
    return (
      <UserContext.Provider value={userContext}>
        <SafeAreaProvider>
          <Navigation colorScheme={colorScheme} />
          <StatusBar />
        </SafeAreaProvider>
      </UserContext.Provider>
    );
  }
}

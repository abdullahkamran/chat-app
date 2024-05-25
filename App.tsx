import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import useCachedResources from './hooks/useCachedResources';
import useColorScheme from './hooks/useColorScheme';
import Navigation from './navigation';
import { useState } from 'react';
import { USER_ID1 } from './utils/config';
import { User, UserContext } from './context/user.context';


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

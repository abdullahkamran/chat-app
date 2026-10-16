import Constants from 'expo-constants';

export let USER_ID1 = '699ae04b11234c3f2246838a';
export let USER_ID2 = '699ae07711234c3f2246838d';

const API_PORT = 1017;

// Metro's host (the dev machine's LAN IP) is exposed as hostUri, e.g. "192.168.0.106:8081".
const getDevOrigin = () => {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:${API_PORT}` : undefined;
};

export const SERVER_ORIGIN = process.env.EXPO_PUBLIC_API_URL || getDevOrigin();

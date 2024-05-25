import { createContext } from "react";

export interface User {
    userId: string;
}

export const UserContext = createContext<{ user: User | null, setUser: (user: User) => void }>({ user: null, setUser: () => { } });

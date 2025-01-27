import { create } from "zustand";

interface AuthStoreInterface {
  user: string | null; // an object that stores user information
  isAuth: boolean;
  signInStep: string;
  session: string;
  setUser: (user: string) => void; // a function to set user information
  setIsAuthenticated: (isAuth: boolean) => void;
  setSignInStep: (signInStep: string) => void;
  setSession: (session: string) => void;
}

export const useAuthStore = create<AuthStoreInterface>((set) => ({
  user: "", // initial value of user property
  isAuth: false,
  signInStep: "",
  session: "",
  setUser: (user: string | null) => set({ user }), // function to set user information
  setIsAuthenticated: (isAuth: boolean) => set({ isAuth }),
  setSignInStep: (signInStep: string) => set({ signInStep }),
  setSession: (session: string) => set({ session }),
}));

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authStore } from '../../stores/authStore';

interface RequireAuthProps {
  children: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  if (!authStore.authenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

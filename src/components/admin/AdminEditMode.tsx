'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AdminEditModeContextType {
  editMode: boolean;
  setEditMode: (mode: boolean) => void;
  toggleEditMode: () => void;
}

const AdminEditModeContext = createContext<AdminEditModeContextType | undefined>(undefined);

export function useAdminEditMode() {
  const context = useContext(AdminEditModeContext);
  if (!context) {
    throw new Error('useAdminEditMode must be used within AdminEditModeProvider');
  }
  return context;
}

interface AdminEditModeProviderProps {
  children: ReactNode;
}

/**
 * Admin Edit Mode Provider
 *
 * Provides global edit mode state for admin users.
 * When edit mode is enabled, inline edit overlays appear on recipe sections.
 *
 * Usage:
 * - Wrap the app or specific pages with this provider
 * - Use useAdminEditMode() hook to access edit mode state
 * - Toggle edit mode with toggleEditMode() or setEditMode(true/false)
 */
export function AdminEditModeProvider({ children }: AdminEditModeProviderProps) {
  const [editMode, setEditMode] = useState(false);

  const toggleEditMode = () => {
    setEditMode((prev) => !prev);
  };

  return (
    <AdminEditModeContext.Provider value={{ editMode, setEditMode, toggleEditMode }}>
      {children}
    </AdminEditModeContext.Provider>
  );
}

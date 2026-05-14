import React, { createContext, useContext, useState } from 'react';

type SoundSettingsContextType = {
  soundEnabled: boolean;
  toggleSound: () => void;
};

const SoundSettingsContext = createContext<SoundSettingsContextType | undefined>(
  undefined
);

export function SoundSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [soundEnabled, setSoundEnabled] = useState(true);

  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  return (
    <SoundSettingsContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </SoundSettingsContext.Provider>
  );
}

export function useSoundSettings() {
  const context = useContext(SoundSettingsContext);
  if (!context) {
    throw new Error(
      'useSoundSettings must be used inside SoundSettingsProvider'
    );
  }
  return context;
}

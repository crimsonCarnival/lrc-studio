import { createContext, useContext, useState } from 'react';

const SetupContext = createContext({ step: 1, setStep: () => {} });

export function SetupProvider({ children }) {
  const [step, setStep] = useState(1);
  return <SetupContext.Provider value={{ step, setStep }}>{children}</SetupContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSetupContext() {
  return useContext(SetupContext);
}

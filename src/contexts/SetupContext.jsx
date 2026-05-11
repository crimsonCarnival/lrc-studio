import { createContext, useContext, useState } from 'react';

const SetupContext = createContext({ step: 1, setStep: () => {} });

export function SetupProvider({ children }) {
  const [step, setStep] = useState(1);
  return <SetupContext.Provider value={{ step, setStep }}>{children}</SetupContext.Provider>;
}

export function useSetupContext() {
  return useContext(SetupContext);
}

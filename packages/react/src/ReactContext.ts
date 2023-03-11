import {ReactContext} from "shared/ReactTypes";
import {REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE} from "shared/ReactSymbols";

export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,

    Provider: null,
    Consumer: null,
  };

  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };
  return context;
}
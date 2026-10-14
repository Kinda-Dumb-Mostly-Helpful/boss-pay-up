import { createContext, useContext } from "react";

export const currencies = {
  CNY: "人民币", USD: "美元", KHR: "柬埔寨瑞尔", VND: "越南盾", INR: "印度卢比", EUR: "欧元", HKD: "港币", SGD: "新加坡元",
};
export type Currency = keyof typeof currencies;
export function isCurrency(value: string | null): value is Currency {
  return value !== null && Object.hasOwn(currencies, value);
}
export const CurrencyContext = createContext<Currency>("CNY");
export const useCurrency = () => useContext(CurrencyContext);

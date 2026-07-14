import "@testing-library/jest-dom";
import React from "react";

// --- Mocks de infra Next que os componentes de fluxo importam ---------------
// next/link -> <a>. Os fluxos criticos usam <Link> so pra navegacao; no teste
// vira uma ancora simples pra nao puxar o router do Next.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) =>
    React.createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children),
}));

// next/navigation -> useSearchParams controlavel por teste (checkout premium/boost).
const searchParamsRef = { current: new URLSearchParams() };
(globalThis as any).__setSearchParams = (init: string) => {
  searchParamsRef.current = new URLSearchParams(init);
};
jest.mock("next/navigation", () => ({
  __esModule: true,
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/",
}));

// scrollIntoView nao existe no jsdom; o chat chama em cada mensagem nova.
if (!(HTMLElement.prototype as any).scrollIntoView) {
  (HTMLElement.prototype as any).scrollIntoView = jest.fn();
}

beforeEach(() => {
  searchParamsRef.current = new URLSearchParams();
});

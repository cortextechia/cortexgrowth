export {};

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (callback: (response: any) => void, options?: { scope: string }) => void;
      api: (path: string, callback: (response: any) => void) => void;
      getLoginStatus: (callback: (response: any) => void) => void;
    };
  }
}
'use client'; // Aqui definimos que este componente roda no navegador

import Script from "next/script";

export default function FacebookSDK() {
  return (
    <Script
      strategy="afterInteractive"
      src="https://connect.facebook.net/pt_BR/sdk.js"
      onLoad={() => {
        window.fbAsyncInit = function() {
          window.FB.init({
            appId      : '919350704242779', // Troque pelo seu ID real da Meta
            cookie     : true,
            xfbml      : true,
            version    : 'v21.0'
          });
        };
      }}
    />
  );
}

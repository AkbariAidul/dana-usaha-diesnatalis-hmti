import type { Metadata } from "next";
import Script from "next/script";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { PublicVisitorTracker } from "@/components/public-visitor";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dana Usaha HMTI",
  description: "Sistem Pengelolaan Open Tenant Dana Usaha HMTI",
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable}>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <link rel="preconnect" href="https://challenges.cloudflare.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased">
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
        <ConfirmProvider>
          <PublicVisitorTracker />
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            expand
            visibleToasts={4}
            toastOptions={{
              duration: 4000,
              className: "rounded-xl border border-slate-200/70 shadow-lg shadow-slate-200/50 backdrop-blur-md",
            }}
          />
        </ConfirmProvider>
      </body>
    </html>
  );
}

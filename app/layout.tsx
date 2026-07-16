import type { Metadata } from "next";
import ManifestLink from "./components/ManifestLink";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yoga Studio - Sacred Breath Timer",
  description: "A WebGPU-powered breathing visualization for mindful practice",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ManifestLink />
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}

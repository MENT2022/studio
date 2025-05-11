
import type { Metadata } from 'next';
import { Geist } from 'next/font/google'; // Corrected import
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Added Toaster import

const geistSans = Geist({ // Corrected instantiation
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'], // Specify weights if needed or remove if default is fine
});

// Removed Geist_Mono as it wasn't explicitly used or requested, simplify.
// If needed, it can be added back:
// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

export const metadata: Metadata = {
  title: 'MQTT Data Visualizer', // Updated title
  description: 'Visualize real-time MQTT data with dynamic graphs.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark"> {/* Apply dark theme by default */}
      <body className={`${geistSans.variable} antialiased`}> {/* Simplified font class */}
        {children}
        <Toaster /> {/* Added Toaster component */}
      </body>
    </html>
  );
}

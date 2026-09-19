import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StudySync AI — Health-First Timetable Maker',
  description:
    'Upload your syllabus, answer a quick lifestyle questionnaire, and get a personalized health-first study timetable. Export as PDF.',
  keywords: ['study timetable', 'AI scheduler', 'health-first', 'syllabus planner'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#09090f] text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

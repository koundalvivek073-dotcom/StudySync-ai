import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import RouteMotion from './RouteMotion';
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
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <body className="bg-[#09090f] text-white antialiased min-h-screen">
        <div className="ambient-backdrop" aria-hidden="true">
          <span className="ambient-glow ambient-glow-indigo" />
          <span className="ambient-glow ambient-glow-violet" />
          <span className="ambient-glow ambient-glow-teal" />
          <span className="ambient-glow ambient-glow-sage" />
          <span className="ambient-grid" />
          <span className="ambient-fireflies">
            {Array.from({ length: 8 }, (_, index) => (
              <span key={index} />
            ))}
          </span>
        </div>
        <div className="app-content">
          <RouteMotion>{children}</RouteMotion>
        </div>
      </body>
    </html>
  );
}

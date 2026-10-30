'use client';

import { usePathname } from 'next/navigation';

export default function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="route-swipe-in">
      {children}
    </div>
  );
}

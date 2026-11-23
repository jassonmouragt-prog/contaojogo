import { Suspense } from "react";
import { SiteFooter } from "@/components/brand/site-footer";
import { FloatingSupport, MobileTabBar } from "@/components/brand/mobile-tab-bar";
import { SiteHeader } from "@/components/brand/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileTabBar />
        <FloatingSupport />
      </Suspense>
    </>
  );
}

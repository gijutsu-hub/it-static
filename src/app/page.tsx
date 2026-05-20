import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import UnpackingSection from "@/components/UnpackingSection";
import StaticFormats from "@/components/StaticFormats";
import GuessTheStatic from "@/components/GuessTheStatic";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col flex-1">
        <HeroSection />
        <UnpackingSection />
        <StaticFormats />
        <GuessTheStatic />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}

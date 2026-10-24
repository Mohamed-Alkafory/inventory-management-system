import CtaSection from "./components/CtaSection";
import FaqSection from "./components/FaqSection";
import FeaturesSection from "./components/FeaturesSection";
import HomeHero from "./components/HomeHero";
import HowItWorksSection from "./components/HowItWorksSection";
import InsightsSection from "./components/InsightsSection";
import StatsStrip from "./components/StatsStrip";

export default function Home() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#FDFDFC] font-sans text-ink">
      <HomeHero />
      <StatsStrip />
      <FeaturesSection />
      <HowItWorksSection />
      <InsightsSection />
      <FaqSection />
      <CtaSection />
    </main>
  );
}

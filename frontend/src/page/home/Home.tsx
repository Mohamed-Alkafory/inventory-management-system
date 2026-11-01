import ScrollProgress from "../../components/motion/ScrollProgress";
import CtaSection from "./components/CtaSection";
import FaqSection from "./components/FaqSection";
import FeaturesSection from "./components/FeaturesSection";
import HomeHero from "./components/HomeHero";
import HowItWorksSection from "./components/HowItWorksSection";
import InsightsSection from "./components/InsightsSection";
import RolesSection from "./components/RolesSection";

export default function Home() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#FDFDFC] font-sans text-ink">
      <ScrollProgress />
      <HomeHero />
      <FeaturesSection />
      <RolesSection />
      <HowItWorksSection />
      <InsightsSection />
      <FaqSection />
      <CtaSection />
    </main>
  );
}

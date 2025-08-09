import Header from "@/components/Header";
import Hero from "@/components/Hero";
import PredictionsSection from "@/components/PredictionsSection";
import StatsSection from "@/components/StatsSection";
import AnalysisSection from "@/components/AnalysisSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <PredictionsSection />
        <StatsSection />
        <AnalysisSection />
      </main>
    </div>
  );
};

export default Index;

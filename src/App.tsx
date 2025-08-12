import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ParlayProvider } from "@/state/parlay";
import ParlayDock from "@/components/ParlayDock";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SimpleDailyInsights from "./pages/SimpleDailyInsights";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ParlayProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/daily-betting-insights" element={<SimpleDailyInsights />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <ParlayDock />
        </TooltipProvider>
      </ParlayProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

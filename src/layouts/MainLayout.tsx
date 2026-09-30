import Footer from "../components/layout/Footer/Footer";
import { Header } from "./Header/Header";

export default function MainLayout({ children, timeStr, dateStr }: { children: React.ReactNode; timeStr?: string; dateStr?: string }) {
  return (
    <div className="...">
      <Header timeStr={timeStr} dateStr={dateStr} />

      <main>
        {children}
      </main>

      <Footer />
    </div>
  );
}
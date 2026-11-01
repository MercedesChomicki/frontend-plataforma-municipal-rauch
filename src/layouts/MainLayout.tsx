import Footer from "../components/layout/Footer/Footer";

export default function MainLayout({ children }: { children: React.ReactNode; timeStr?: string; dateStr?: string }) {
  return (
    <div className="...">
      <main>
        {children}
      </main>

      <Footer />
    </div>
  );
}
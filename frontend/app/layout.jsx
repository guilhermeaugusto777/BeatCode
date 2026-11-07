import "./globals.css";

export const metadata = {
  title: "BeatCode — Seu mapa musical",
  description: "Explore artistas, gêneros e comunidades em um mapa interativo da sua música.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-[#1DB954] selection:text-black">
        {children}
      </body>
    </html>
  );
}

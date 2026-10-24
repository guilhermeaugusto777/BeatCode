import "./globals.css";

export const metadata = {
  title: "Spotify Music Graph — Análise Topológica Musical",
  description: "Visualização interativa em grafo de artistas, gêneros e comunidades musicais.",
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

import type { Metadata } from "next";
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Geist, Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-mono", // Bind geist mono font
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans", // Standard font mapping
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-heading", // Heading font mapping
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consejos — Premium Communities",
  description: "Una plataforma premium para comunidades especializadas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="es"
        className={`${inter.variable} ${geistSans.variable} ${playfair.variable} h-full antialiased dark`}
      >
        <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 selection:bg-neutral-800 selection:text-white">
          {/* Header premium minimalista al estilo Notion / Apple */}
          <header className="sticky top-0 z-50 w-full border-b border-neutral-900 bg-neutral-950/70 backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
              {/* Logo / Branding */}
              <div className="flex items-center gap-2">
                <span className="font-heading text-lg font-semibold tracking-tight text-neutral-200">
                  Consejos
                </span>
                <span className="inline-flex items-center rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-neutral-400 border border-neutral-800">
                  Beta
                </span>
              </div>

              {/* Controles de Autenticación */}
              <div className="flex items-center gap-4">
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="text-sm font-medium text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer">
                      Iniciar Sesión
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition-colors cursor-pointer shadow-sm shadow-white/5">
                      Registrarse
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "h-8 w-8 rounded-full border border-neutral-800",
                      },
                    }}
                  />
                </Show>
              </div>
            </div>
          </header>

          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}

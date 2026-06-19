import { Show, SignUpButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 py-20 text-center bg-neutral-950">
      {/* Fondo con gradiente sutil al estilo Apple/Linear */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.08),rgba(255,255,255,0))]" />

      <main className="relative z-10 max-w-3xl flex flex-col items-center gap-8">
        {/* Badge superior premium */}
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-4 py-1.5 text-xs text-neutral-400 backdrop-blur-sm">
          <span>Presentamos la plataforma de comunidades del futuro</span>
        </div>

        {/* Encabezado elegante con Playfair y tipografía sans ajustada */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl sm:text-6xl font-heading font-semibold tracking-tight text-white leading-tight">
            Descubre comunidades <br className="hidden sm:inline" />
            <span className="text-neutral-400 font-sans italic font-normal">altamente especializadas</span>
          </h1>
          <p className="max-w-xl mx-auto text-base sm:text-lg text-neutral-400 font-light leading-relaxed">
            Un espacio libre de ruido, diseñado con la sobriedad de tus herramientas de software preferidas. Comparte conocimientos y archivos sin fricciones.
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
          <Show when="signed-out">
            <SignUpButton mode="modal">
              <button className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 transition-all cursor-pointer shadow-md shadow-white/5">
                Empezar Ahora
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <a
              href="/r"
              className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-200 px-6 py-3 text-sm font-semibold hover:bg-neutral-800 hover:text-white transition-all cursor-pointer"
            >
              Explorar Comunidades
            </a>
          </Show>
          <a
            href="#about"
            className="text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors py-2 px-4"
          >
            Saber más &rarr;
          </a>
        </div>

        {/* Grid de características minimalistas */}
        <div id="about" className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-24">
          <div className="flex flex-col items-start p-6 rounded-2xl border border-neutral-900 bg-neutral-950/50 backdrop-blur-sm text-left">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 text-xs font-mono text-white">01</div>
            <h3 className="text-sm font-semibold text-white mb-2">Diseño Focado</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">Sin elementos saturados ni sidebars pesados. Tu contenido es el verdadero protagonista.</p>
          </div>
          <div className="flex flex-col items-start p-6 rounded-2xl border border-neutral-900 bg-neutral-950/50 backdrop-blur-sm text-left">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 text-xs font-mono text-white">02</div>
            <h3 className="text-sm font-semibold text-white mb-2">Compartir Recursos</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">Soporte completo para subir código, PDFs, videos y audios sin límites de egress con Cloudflare R2.</p>
          </div>
          <div className="flex flex-col items-start p-6 rounded-2xl border border-neutral-900 bg-neutral-950/50 backdrop-blur-sm text-left">
            <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 text-xs font-mono text-white">03</div>
            <h3 className="text-sm font-semibold text-white mb-2">Moderación Avanzada</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">Control total por roles e historial de acciones para mantener la calidad y el respeto en la comunidad.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

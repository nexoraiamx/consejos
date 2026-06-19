"use client";

import React, { useState } from "react";
import { User, Shield, CheckCircle2, Globe, Save, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "expert" | "account">("profile");
  const [isExpertApplied, setIsExpertApplied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState("Adrián Silva");
  const [username, setUsername] = useState("adrian_ux");
  const [bio, setBio] = useState("Diseñador de producto enfocado en interfaces minimalistas e interacciones fluidas.");
  const [website, setWebsite] = useState("https://adriansilva.design");
  const [twitter, setTwitter] = useState("adriansilva_ux");
  const [github, setGithub] = useState("adrian-silva");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
    }, 1000);
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8 text-left">
      <div className="flex flex-col gap-2 border-b border-neutral-900 pb-5">
        <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
          Ajustes
        </h1>
        <p className="text-sm text-neutral-400 font-light leading-relaxed">
          Gestiona los detalles de tu perfil, reputación de experto y preferencias de cuenta.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-900 pb-px gap-6">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 text-xs font-semibold tracking-wide transition-all relative cursor-pointer ${
            activeTab === "profile" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Perfil Público
          {activeTab === "profile" && (
            <motion.div
              layoutId="activeSettingsTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab("expert")}
          className={`pb-3 text-xs font-semibold tracking-wide transition-all relative cursor-pointer flex items-center gap-1.5 ${
            activeTab === "expert" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Sparkles className="h-3 w-3 text-blue-400" />
          Sistema de Expertos
          {activeTab === "expert" && (
            <motion.div
              layoutId="activeSettingsTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab("account")}
          className={`pb-3 text-xs font-semibold tracking-wide transition-all relative cursor-pointer ${
            activeTab === "account" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Cuenta & Seguridad
          {activeTab === "account" && (
            <motion.div
              layoutId="activeSettingsTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"
            />
          )}
        </button>
      </div>

      {/* Content based on Tab */}
      <div className="mt-2">
        {activeTab === "profile" && (
          <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
            {/* Avatar Section */}
            <div className="flex items-center gap-6 p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md">
              <div className="h-16 w-16 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center text-xl font-semibold text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-neutral-200">Foto de Perfil</span>
                <span className="text-[11px] text-neutral-500">Se sincroniza automáticamente con tu cuenta de Clerk.</span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400">Nombre público</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400">Nombre de usuario (Slug)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-xs text-neutral-500">consejos.com/u/</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-[110px] pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-neutral-400">Biografía</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-neutral-500" />
                  Sitio web
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://tudominio.com"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <TwitterIcon className="h-3.5 w-3.5 text-neutral-500" />
                  Twitter / X
                </label>
                <input
                  type="text"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="username"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <GithubIcon className="h-3.5 w-3.5 text-neutral-500" />
                  GitHub
                </label>
                <input
                  type="text"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="username"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md shadow-white/5 disabled:opacity-55"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Guardando..." : "Guardar cambios"}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === "expert" && (
          <div className="space-y-6 max-w-2xl">
            {/* Reputation Info Banner */}
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-blue-400" />
                <h3 className="text-sm font-semibold text-neutral-200">Requisitos de Experto</h3>
              </div>
              <p className="text-xs text-neutral-400 font-light leading-relaxed">
                El estatus de experto te otorga un distintivo especial de verificación en tus respuestas y publicaciones, así como mayor visibilidad en las comunidades donde demuestres conocimiento.
              </p>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-800 px-3 py-1 text-[11px] font-semibold text-neutral-300">
                  Reputación &gt;= 100 puntos
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-800 px-3 py-1 text-[11px] font-semibold text-neutral-300">
                  1 respuesta aceptada
                </span>
              </div>
            </div>

            {/* Expertise Area Config */}
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h4 className="text-xs font-semibold text-neutral-300">Áreas de especialidad</h4>
                <p className="text-[11px] text-neutral-500 font-light">Selecciona los temas en los cuales consideras que puedes brindar asesoría.</p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {["Diseño UI/UX", "Next.js", "PostgreSQL", "Tailwind CSS", "Modelos LLM", "Seguridad Web"].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-neutral-900 border border-neutral-800/80 px-3 py-1 text-xs font-medium text-neutral-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="border-t border-neutral-900/60 pt-4 mt-2 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-neutral-200">Estatus actual</span>
                  <span className="text-[10px] text-neutral-500 mt-0.5">Pendiente de verificación</span>
                </div>

                <button
                  onClick={() => setIsExpertApplied(true)}
                  disabled={isExpertApplied}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    isExpertApplied
                      ? "bg-neutral-900 border border-neutral-800 text-neutral-500 cursor-default"
                      : "bg-white text-neutral-950 hover:bg-neutral-200"
                  }`}
                >
                  {isExpertApplied ? "Solicitud enviada" : "Solicitar Estatus"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "account" && (
          <div className="space-y-6 max-w-2xl">
            {/* Role Card */}
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-neutral-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-neutral-200">Rol Global</span>
                  <span className="text-[10px] text-neutral-500">Define tus permisos en la plataforma</span>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-blue-950/40 border border-blue-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400">
                Miembro Estándar
              </span>
            </div>

            {/* Security Config */}
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
              <h4 className="text-xs font-semibold text-neutral-300">Cuenta de Clerk conectada</h4>
              <div className="flex items-center justify-between text-xs font-light text-neutral-400">
                <span>Sesión activa</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Activa
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 font-light leading-relaxed">
                Para cambiar tu contraseña, configurar autenticación multifactor (MFA) o ver detalles de facturación, por favor utiliza la interfaz de cuenta de Clerk haciendo clic en tu avatar en el sidebar o navbar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

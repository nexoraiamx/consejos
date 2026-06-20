"use client";

import React, { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { 
  User, 
  Shield, 
  Check,
  CheckCircle2, 
  Globe, 
  Save, 
  Sparkles, 
  Loader2,
  Compass,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  getUserProfileAction, 
  updateProfileAction, 
  updateInterestsAction, 
  updateSocialLinksAction 
} from "@/app/actions/users";

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={{ width: '1.2em', height: '1.2em' }} {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={{ width: '1.2em', height: '1.2em' }} {...props}>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z" />
    <polygon points="10 15 15 12 10 9" fill="currentColor" />
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={{ width: '1.2em', height: '1.2em' }} {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={{ width: '1.2em', height: '1.2em' }} {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={{ width: '1.2em', height: '1.2em' }} {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const INTERESTS_OPTIONS = [
  "Diseño", "Desarrollo Web", "IA", "Marketing", "Negocios", 
  "Finanzas", "Legal", "Creatividad", "Productividad", "Educación", 
  "Salud", "Otro"
];

const SKILL_LEVELS = ["Principiante", "Intermedio", "Experto"];

const GOAL_OPTIONS = [
  { value: "aprender", label: "Aprender" },
  { value: "resolver dudas", label: "Resolver dudas" },
  { value: "compartir recursos", label: "Compartir recursos" },
  { value: "vender servicios", label: "Ofrecer servicios" },
  { value: "encontrar comunidad", label: "Encontrar comunidad" },
  { value: "networking", label: "Networking" }
];

const DISCOVERY_OPTIONS = [
  { value: "comunidades públicas", label: "Comunidades Públicas" },
  { value: "comunidades privadas", label: "Comunidades Privadas" },
  { value: "comunidades de expertos", label: "Comunidades de Expertos" },
  { value: "comunidades cerca de mis intereses", label: "Dominios Afines" }
];

export default function SettingsPage() {
  const { openUserProfile } = useClerk();
  const [activeTab, setActiveTab] = useState<"profile" | "interests" | "social" | "account">("profile");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Profile data from Neon DB
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [globalRole, setGlobalRole] = useState("MEMBER");

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  // Interests & Recommendations
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("Intermedio");
  const [discoveryGoals, setDiscoveryGoals] = useState<string[]>([]);

  // Social Links
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialGithub, setSocialGithub] = useState("");

  // Load Profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await getUserProfileAction();
      if (res) {
        setEmail(res.user.email);
        setGlobalRole(res.user.globalRole);
        
        if (res.profile) {
          setDisplayName(res.profile.displayName || "");
          setUsername(res.profile.username || "");
          setBio(res.profile.bio || "");
          setWebsite(res.profile.website || "");
          setAvatarUrl(res.profile.avatarUrl || "");

          setSelectedInterests(res.profile.interests || []);
          setSkillLevel(res.profile.skillLevel || "Intermedio");
          setDiscoveryGoals(res.profile.discoveryGoals || []);

          // Parse social links
          const links = res.profile.socialLinks || {};
          setSocialInstagram(links.instagram || "");
          setSocialTiktok(links.tiktok || "");
          setSocialYoutube(links.youtube || "");
          setSocialTwitter(links.twitter || "");
          setSocialLinkedin(links.linkedin || "");
          setSocialGithub(links.github || "");
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      showToast("Error al cargar los datos del perfil.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showToast("El nombre público es obligatorio.", "error");
      return;
    }
    if (!username.trim() || username.length < 3) {
      showToast("El nombre de usuario debe tener al menos 3 caracteres.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateProfileAction({
        displayName,
        username,
        bio,
        website
      });

      if (res.success) {
        showToast("Perfil actualizado correctamente.", "success");
      } else {
        showToast(res.error || "Error al actualizar perfil.", "error");
      }
    } catch (err) {
      showToast("Error de conexión al guardar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInterestsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await updateInterestsAction({
        interests: selectedInterests,
        skillLevel,
        discoveryGoals
      });

      if (res.success) {
        showToast("Preferencias y recomendaciones actualizadas.", "success");
      } else {
        showToast(res.error || "Error al actualizar intereses.", "error");
      }
    } catch (err) {
      showToast("Error de conexión al guardar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSocialSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const socialLinks: Record<string, string> = {};
      if (socialInstagram.trim()) socialLinks.instagram = socialInstagram.trim();
      if (socialTiktok.trim()) socialLinks.tiktok = socialTiktok.trim();
      if (socialYoutube.trim()) socialLinks.youtube = socialYoutube.trim();
      if (socialTwitter.trim()) socialLinks.twitter = socialTwitter.trim();
      if (socialLinkedin.trim()) socialLinks.linkedin = socialLinkedin.trim();
      if (socialGithub.trim()) socialLinks.github = socialGithub.trim();
      if (website.trim()) socialLinks.website = website.trim();

      const res = await updateSocialLinksAction(socialLinks);

      if (res.success) {
        showToast("Enlaces de redes sociales guardados.", "success");
      } else {
        showToast(res.error || "Error al actualizar redes sociales.", "error");
      }
    } catch (err) {
      showToast("Error de conexión al guardar.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest) 
        : [...prev, interest]
    );
  };

  const handleGoalToggle = (goal: string) => {
    setDiscoveryGoals(prev => 
      prev.includes(goal) 
        ? prev.filter(g => g !== goal) 
        : [...prev, goal]
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <span className="text-xs font-light">Cargando tus ajustes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8 text-left relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 p-4 rounded-2xl border backdrop-blur-md flex items-center gap-3 shadow-lg max-w-sm ${
              toast.type === "success" 
                ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" 
                : "bg-red-950/20 border-red-900/40 text-red-400"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="text-xs font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-2 border-b border-neutral-900 pb-5">
        <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
          Ajustes
        </h1>
        <p className="text-sm text-neutral-400 font-light leading-relaxed">
          Gestiona los detalles de tu perfil, reputación de experto y preferencias de cuenta.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-neutral-900 pb-px gap-6 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 text-xs font-semibold tracking-wide transition-all relative cursor-pointer shrink-0 ${
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
          onClick={() => setActiveTab("interests")}
          className={`pb-3 text-xs font-semibold tracking-wide transition-all relative cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === "interests" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Sparkles className="h-3 w-3 text-blue-400" />
          Intereses y Recomendaciones
          {activeTab === "interests" && (
            <motion.div
              layoutId="activeSettingsTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab("social")}
          className={`pb-3 text-xs font-semibold tracking-wide transition-all relative cursor-pointer shrink-0 ${
            activeTab === "social" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          Redes Sociales
          {activeTab === "social" && (
            <motion.div
              layoutId="activeSettingsTabLine"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab("account")}
          className={`pb-3 text-xs font-semibold tracking-wide transition-all relative cursor-pointer shrink-0 ${
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

      {/* Tab Panels */}
      <div className="mt-2">
        {activeTab === "profile" && (
          <form onSubmit={handleProfileSave} className="space-y-6 max-w-2xl">
            {/* Avatar Section */}
            <div className="flex items-center gap-6 p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={displayName} 
                  className="h-16 w-16 rounded-full border border-neutral-800 object-cover" 
                />
              ) : (
                <div className="h-16 w-16 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center text-xl font-semibold text-white">
                  {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                </div>
              )}
              <div className="flex flex-col gap-1 text-left">
                <span className="text-xs font-semibold text-neutral-200">Foto de Perfil</span>
                <span className="text-[11px] text-neutral-500">Se sincroniza de forma segura y automática desde Clerk.</span>
              </div>
            </div>

            {/* Public Profile Form fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400">Nombre público</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre real o público"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400">Nombre de usuario (Slug)</label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-xs text-neutral-500">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    placeholder="nombre_usuario"
                    className="w-full pl-8 pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-neutral-400">Biografía</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Escribe una breve biografía sobre ti..."
                rows={3}
                className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light resize-none leading-relaxed"
              />
            </div>

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

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md disabled:opacity-55"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{isSaving ? "Guardando..." : "Guardar cambios"}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === "interests" && (
          <form onSubmit={handleInterestsSave} className="space-y-6 max-w-2xl">
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 text-left">
                <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  Personaliza tu Feed y Recomendaciones
                </h3>
                <p className="text-xs text-neutral-400 font-light leading-relaxed">
                  Las comunidades en la pestaña **Explorar** se ordenarán priorizando aquellas que coincidan con los temas y objetivos que selecciones a continuación.
                </p>
              </div>

              {/* Interests Chips */}
              <div className="flex flex-col gap-3 text-left border-t border-neutral-900/60 pt-4">
                <label className="text-xs font-semibold text-neutral-400">Temas de interés</label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS_OPTIONS.map(interest => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => handleInterestToggle(interest)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-white text-black border-white" 
                            : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Skill Level Selection */}
              <div className="flex flex-col gap-3 text-left border-t border-neutral-900/60 pt-4">
                <label className="text-xs font-semibold text-neutral-400">Tu Nivel de Habilidad</label>
                <div className="grid grid-cols-3 gap-3">
                  {SKILL_LEVELS.map(level => {
                    const isSelected = skillLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSkillLevel(level)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          isSelected 
                            ? "bg-white/5 border-white text-white" 
                            : "bg-neutral-900 border-neutral-850 text-neutral-400 hover:border-neutral-800"
                        }`}
                      >
                        <span className="text-xs font-semibold">{level}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Goals / Objectives & Discovery */}
              <div className="flex flex-col gap-3 text-left border-t border-neutral-900/60 pt-4">
                <label className="text-xs font-semibold text-neutral-400">Tus objetivos y preferencias de descubrimiento</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...GOAL_OPTIONS, ...DISCOVERY_OPTIONS].map(goal => {
                    const isSelected = discoveryGoals.includes(goal.value);
                    return (
                      <button
                        key={goal.value}
                        type="button"
                        onClick={() => handleGoalToggle(goal.value)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected 
                            ? "bg-blue-950/10 border-blue-800/80 text-white" 
                            : "bg-neutral-900 border-neutral-850 text-neutral-400 hover:border-neutral-800"
                        }`}
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "border-blue-500 bg-blue-500 text-black" : "border-neutral-700"
                        }`}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-black stroke-[3px]" />}
                        </div>
                        <span className="text-xs text-neutral-200 font-medium">{goal.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md disabled:opacity-55"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>{isSaving ? "Actualizando..." : "Actualizar recomendaciones"}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === "social" && (
          <form onSubmit={handleSocialSave} className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <InstagramIcon className="h-3.5 w-3.5" /> Instagram
                </label>
                <input
                  type="text"
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  placeholder="username"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" /> TikTok
                </label>
                <input
                  type="text"
                  value={socialTiktok}
                  onChange={(e) => setSocialTiktok(e.target.value)}
                  placeholder="username"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <YoutubeIcon className="h-3.5 w-3.5" /> YouTube
                </label>
                <input
                  type="text"
                  value={socialYoutube}
                  onChange={(e) => setSocialYoutube(e.target.value)}
                  placeholder="canal o username"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <TwitterIcon className="h-3.5 w-3.5" /> X / Twitter
                </label>
                <input
                  type="text"
                  value={socialTwitter}
                  onChange={(e) => setSocialTwitter(e.target.value)}
                  placeholder="username"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <LinkedinIcon className="h-3.5 w-3.5" /> LinkedIn
                </label>
                <input
                  type="text"
                  value={socialLinkedin}
                  onChange={(e) => setSocialLinkedin(e.target.value)}
                  placeholder="username-perfil"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <GithubIcon className="h-3.5 w-3.5" /> GitHub
                </label>
                <input
                  type="text"
                  value={socialGithub}
                  onChange={(e) => setSocialGithub(e.target.value)}
                  placeholder="username"
                  className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md disabled:opacity-55"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{isSaving ? "Guardando..." : "Guardar redes sociales"}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === "account" && (
          <div className="space-y-6 max-w-2xl text-left">
            {/* Global Role */}
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-neutral-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-neutral-200">Rol Global de Consejos</span>
                  <span className="text-[10px] text-neutral-500">Define tus permisos en la plataforma</span>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-blue-950/40 border border-blue-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400">
                {globalRole === "GLOBAL_ADMIN" ? "Administrador Global" : "Miembro Estándar"}
              </span>
            </div>

            {/* Clerk Account */}
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <h4 className="text-xs font-semibold text-neutral-300">Cuenta de Seguridad (Clerk)</h4>
                <p className="text-[11px] text-neutral-500 font-light leading-relaxed">
                  Tu correo electrónico, contraseña, métodos de inicio de sesión de redes sociales (Google, Apple, etc.) y la autenticación multifactor se gestionan de forma segura a través de nuestro proveedor de identidad, Clerk.
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-900/60 pt-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Correo Vinculado</span>
                  <span className="text-xs text-neutral-300 font-light mt-0.5">{email || "No vinculado"}</span>
                </div>

                <button
                  type="button"
                  onClick={() => openUserProfile()}
                  className="rounded-full bg-white text-neutral-950 px-5 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md"
                >
                  Gestionar cuenta con Clerk
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

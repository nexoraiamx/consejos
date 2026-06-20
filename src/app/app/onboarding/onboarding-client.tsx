"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Sparkles, 
  Compass, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Loader2, 
  Globe
} from "lucide-react";
import { submitOnboardingAction } from "@/app/actions/users";

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

interface OnboardingClientProps {
  initialEmail: string;
  initialDisplayName: string;
  initialUsername: string;
}

const INTERESTS_OPTIONS = [
  "Diseño", "Desarrollo Web", "IA", "Marketing", "Negocios", 
  "Finanzas", "Legal", "Creatividad", "Productividad", "Educación", 
  "Salud", "Otro"
];

const SKILL_LEVELS = [
  { value: "Principiante", label: "Principiante", desc: "Estoy empezando a aprender sobre estos temas" },
  { value: "Intermedio", label: "Intermedio", desc: "Tengo conocimientos prácticos y experiencia previa" },
  { value: "Experto", label: "Experto", desc: "Tengo amplia experiencia y puedo dar mentoría a otros" }
];

const MAIN_GOALS = [
  { value: "aprender", label: "Aprender", desc: "Adquirir nuevos conocimientos de la comunidad" },
  { value: "resolver dudas", label: "Resolver dudas", desc: "Preguntar a expertos sobre problemas específicos" },
  { value: "compartir recursos", label: "Compartir recursos", desc: "Subir tutoriales, guías y herramientas útiles" },
  { value: "vender servicios", label: "Ofrecer servicios", desc: "Networking para encontrar clientes o proyectos" },
  { value: "encontrar comunidad", label: "Encontrar comunidad", desc: "Conectar con personas con mis mismos gustos" },
  { value: "networking", label: "Networking", desc: "Hacer relaciones profesionales a largo plazo" }
];

const DISCOVERY_PREFS = [
  { value: "comunidades públicas", label: "Comunidades Públicas", desc: "Abiertas para todos" },
  { value: "comunidades privadas", label: "Comunidades Privadas", desc: "Acceso exclusivo" },
  { value: "comunidades de expertos", label: "Comunidades de Expertos", desc: "Guiadas por profesionales verificados" },
  { value: "comunidades cerca de mis intereses", label: "Dominios Afines", desc: "Recomendaciones personalizadas" }
];

export function OnboardingClient({
  initialEmail,
  initialDisplayName,
  initialUsername
}: OnboardingClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState("");
  
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedSkillLevel, setSelectedSkillLevel] = useState("Intermedio");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedDiscovery, setSelectedDiscovery] = useState<string[]>([]);

  // Social Links
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialGithub, setSocialGithub] = useState("");
  const [socialWebsite, setSocialWebsite] = useState("");

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest) 
        : [...prev, interest]
    );
  };

  const handleGoalToggle = (goal: string) => {
    setSelectedGoals(prev => 
      prev.includes(goal) 
        ? prev.filter(g => g !== goal) 
        : [...prev, goal]
    );
  };

  const handleDiscoveryToggle = (pref: string) => {
    setSelectedDiscovery(prev => 
      prev.includes(pref) 
        ? prev.filter(p => p !== pref) 
        : [...prev, pref]
    );
  };

  const nextStep = () => {
    setError(null);
    if (step === 1) {
      if (!displayName.trim()) {
        setError("El nombre público es obligatorio.");
        return;
      }
      if (!username.trim() || username.trim().length < 3) {
        setError("El nombre de usuario es obligatorio y debe tener al menos 3 caracteres.");
        return;
      }
    }
    if (step === 2) {
      if (selectedInterests.length === 0) {
        setError("Selecciona al menos un tema de interés para recomendarte comunidades.");
        return;
      }
      if (selectedGoals.length === 0) {
        setError("Selecciona al menos un objetivo principal.");
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError(null);
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    const socialLinks: Record<string, string> = {};
    if (socialInstagram.trim()) socialLinks.instagram = socialInstagram.trim();
    if (socialTiktok.trim()) socialLinks.tiktok = socialTiktok.trim();
    if (socialYoutube.trim()) socialLinks.youtube = socialYoutube.trim();
    if (socialTwitter.trim()) socialLinks.twitter = socialTwitter.trim();
    if (socialLinkedin.trim()) socialLinks.linkedin = socialLinkedin.trim();
    if (socialGithub.trim()) socialLinks.github = socialGithub.trim();
    if (socialWebsite.trim()) socialLinks.website = socialWebsite.trim();

    // Combina discovery y goals en discovery_goals
    const combinedDiscoveryGoals = [...selectedGoals, ...selectedDiscovery];

    const result = await submitOnboardingAction({
      displayName,
      username,
      bio,
      interests: selectedInterests,
      skillLevel: selectedSkillLevel,
      discoveryGoals: combinedDiscoveryGoals,
      socialLinks
    });

    if (result.success) {
      // Force clean browser load to guarantee Server Layout catches the updated database state instantly
      window.location.href = "/app/explore";
    } else {
      setError(result.error || "Ocurrió un error al procesar el onboarding.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-xl flex flex-col gap-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-blue-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-heading font-semibold tracking-tight">Bienvenido a Consejos</h1>
            <p className="text-xs text-neutral-400 font-light max-w-xs">Completa tu perfil para personalizar tu experiencia e intereses.</p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div 
              key={s} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step 
                  ? "w-8 bg-white" 
                  : s < step 
                    ? "w-1.5 bg-blue-500" 
                    : "w-1.5 bg-neutral-800"
              }`}
            />
          ))}
        </div>

        {/* Step Container */}
        <div className="p-8 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-xl flex flex-col gap-6 shadow-xl">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 text-xs font-medium text-left">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5 text-left"
              >
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-neutral-200">Paso 1: Tu Perfil Público</h3>
                  <p className="text-[11px] text-neutral-500 font-light">Cuéntale a la comunidad quién eres.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-neutral-400">Nombre público</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder=""
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-neutral-400">Nombre de usuario (Slug único)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-xs text-neutral-500">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder=""
                      className="w-full pl-8 pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-neutral-400 font-medium">Biografía corta (Opcional)</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Desarrollador de software interesado en IA y UI/UX..."
                    rows={3}
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light resize-none leading-relaxed"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-left"
              >
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-neutral-200">Paso 2: Intereses y Nivel</h3>
                  <p className="text-[11px] text-neutral-500 font-light">Ayúdanos a personalizar tus recomendaciones.</p>
                </div>

                {/* Interests Chips */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-xs font-semibold text-neutral-400">Temas de interés (Selecciona todos los que apliquen)</label>
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

                {/* Skill Level */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-xs font-semibold text-neutral-400">Tu nivel general</label>
                  <div className="grid grid-cols-3 gap-3">
                    {SKILL_LEVELS.map(level => {
                      const isSelected = selectedSkillLevel === level.value;
                      return (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => setSelectedSkillLevel(level.value)}
                          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            isSelected 
                              ? "bg-white/5 border-white text-white" 
                              : "bg-neutral-900 border-neutral-850 text-neutral-400 hover:border-neutral-800"
                          }`}
                        >
                          <span className="text-xs font-semibold">{level.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Goals */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-xs font-semibold text-neutral-400">Tu objetivo principal</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {MAIN_GOALS.map(goal => {
                      const isSelected = selectedGoals.includes(goal.value);
                      return (
                        <button
                          key={goal.value}
                          type="button"
                          onClick={() => handleGoalToggle(goal.value)}
                          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                            isSelected 
                              ? "bg-blue-950/10 border-blue-800/80 text-white" 
                              : "bg-neutral-900 border-neutral-850 text-neutral-400 hover:border-neutral-800"
                          }`}
                        >
                          <div className={`mt-0.5 h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                            isSelected ? "border-blue-500 bg-blue-500 text-black" : "border-neutral-700"
                          }`}>
                            {isSelected && <Check className="h-2 w-2 text-black stroke-[3px]" />}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-neutral-200">{goal.label}</span>
                            <span className="text-[9px] text-neutral-500 font-light leading-snug">{goal.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 text-left"
              >
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-neutral-200">Paso 3: Redes Sociales (Opcional)</h3>
                  <p className="text-[11px] text-neutral-500 font-light">Comparte tus perfiles externos con la comunidad.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                      <InstagramIcon className="h-3.5 w-3.5" /> Instagram
                    </label>
                    <input
                      type="text"
                      value={socialInstagram}
                      onChange={(e) => setSocialInstagram(e.target.value)}
                      placeholder="username"
                      className="px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5" /> TikTok
                    </label>
                    <input
                      type="text"
                      value={socialTiktok}
                      onChange={(e) => setSocialTiktok(e.target.value)}
                      placeholder="username"
                      className="px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                      <YoutubeIcon className="h-3.5 w-3.5" /> YouTube
                    </label>
                    <input
                      type="text"
                      value={socialYoutube}
                      onChange={(e) => setSocialYoutube(e.target.value)}
                      placeholder="canal o username"
                      className="px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                      <TwitterIcon className="h-3.5 w-3.5" /> X / Twitter
                    </label>
                    <input
                      type="text"
                      value={socialTwitter}
                      onChange={(e) => setSocialTwitter(e.target.value)}
                      placeholder="username"
                      className="px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                      <LinkedinIcon className="h-3.5 w-3.5" /> LinkedIn
                    </label>
                    <input
                      type="text"
                      value={socialLinkedin}
                      onChange={(e) => setSocialLinkedin(e.target.value)}
                      placeholder="username-perfil"
                      className="px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                      <GithubIcon className="h-3.5 w-3.5" /> GitHub
                    </label>
                    <input
                      type="text"
                      value={socialGithub}
                      onChange={(e) => setSocialGithub(e.target.value)}
                      placeholder="username"
                      className="px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Sitio Web
                  </label>
                  <input
                    type="url"
                    value={socialWebsite}
                    onChange={(e) => setSocialWebsite(e.target.value)}
                    placeholder="https://tuweb.com"
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
                  />
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-left"
              >
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-neutral-200">Paso 4: Preferencias de Descubrimiento</h3>
                  <p className="text-[11px] text-neutral-500 font-light">¿Qué tipo de comunidades prefieres encontrar?</p>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-neutral-400">Preferencias de visualización</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {DISCOVERY_PREFS.map(pref => {
                      const isSelected = selectedDiscovery.includes(pref.value);
                      return (
                        <button
                          key={pref.value}
                          type="button"
                          onClick={() => handleDiscoveryToggle(pref.value)}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                            isSelected 
                              ? "bg-purple-950/10 border-purple-800/80 text-white" 
                              : "bg-neutral-900 border-neutral-850 text-neutral-400 hover:border-neutral-800"
                          }`}
                        >
                          <div className={`mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center ${
                            isSelected ? "border-purple-500 bg-purple-500 text-black" : "border-neutral-700"
                          }`}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-black stroke-[3px]" />}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-neutral-200">{pref.label}</span>
                            <span className="text-[9px] text-neutral-500 font-light leading-snug">{pref.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-850 flex items-start gap-3">
                  <Compass className="h-5 w-5 text-blue-400 shrink-0" />
                  <p className="text-[10px] text-neutral-400 leading-relaxed font-light">
                    Al finalizar el onboarding, guardaremos tus preferencias y te redirigiremos a la sección de **Explorar**, donde verás las comunidades ordenadas y recomendadas de acuerdo a tus intereses.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-neutral-900 pt-5 mt-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Atrás</span>
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-neutral-950 px-5 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md"
              >
                <span>Siguiente</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span>Finalizar</span>
                    <Check className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper client-safe con las reglas de negocio para niveles de reputación.
 */

export function getUserLevel(points: number): string {
  if (points < 100) return "Nuevo";
  if (points < 500) return "Colaborador";
  if (points < 1500) return "Experto";
  if (points < 5000) return "Mentor";
  return "Referente";
}

export function getLevelBadge(points: number): string {
  if (points < 100) return "🌱";
  if (points < 500) return "🤝";
  if (points < 1500) return "👨‍💻";
  if (points < 5000) return "👑";
  return "🏆";
}

export function getLevelColor(points: number): string {
  if (points < 100) return "text-neutral-400";
  if (points < 500) return "text-blue-400";
  if (points < 1500) return "text-emerald-450";
  if (points < 5000) return "text-purple-400";
  return "text-amber-450";
}

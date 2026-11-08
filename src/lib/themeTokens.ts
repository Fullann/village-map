import type { Variants, Transition } from "framer-motion";
import type { SeasonMode } from "@/types";

export interface SeasonTheme {
  id: SeasonMode;
  label: string;
  badgeLabel: string;
  title: string;
  subtitle: string;
  // Couleurs d'extrusion 3D MapLibre (style architectural pierre & terre cuite / sapin)
  buildingDefaultColor: string;
  buildingActiveColor: string;
  buildingSpecialColor: string;
  buildingVisitedColor: string;
  buildingFootprintHalo: string;
  // Couleurs UI éditoriales
  accentHex: string;
  accentSecondaryHex: string;
  accentBgClass: string;
  accentTextClass: string;
  accentBorderClass: string;
  accentSoftBgClass: string;
}

export const SEASON_THEMES: Record<"halloween" | "advent", SeasonTheme> = {
  halloween: {
    id: "halloween",
    label: "Édition d'Automne · 31 octobre",
    badgeLabel: "31 OCT.",
    title: "Soirée d'Halloween",
    subtitle: "Parcours des maisons accueillantes à Vufflens-la-Ville",
    buildingDefaultColor: "#d9d4ca", // Pierre calcaire douce
    buildingActiveColor: "#c2410c",  // Terre de Sienne brûlée lumineuse
    buildingSpecialColor: "#9a3412", // Ocre brique profond (libre-service)
    buildingVisitedColor: "#78716c", // Ardoise chaude (visité)
    buildingFootprintHalo: "#fb923c",
    accentHex: "#c2410c",
    accentSecondaryHex: "#ea580c",
    accentBgClass: "bg-[#c2410c]",
    accentTextClass: "text-[#c2410c]",
    accentBorderClass: "border-[#c2410c]",
    accentSoftBgClass: "bg-[#c2410c]/10",
  },
  advent: {
    id: "advent",
    label: "Édition d'Hiver · 1 au 24 décembre",
    badgeLabel: "1–24 DÉC.",
    title: "Fenêtres de l'Avent",
    subtitle: "Parcours lumineux et verrées villageoises",
    buildingDefaultColor: "#d9d4ca", // Pierre calcaire douce
    buildingActiveColor: "#14532d",  // Vert sapin profond (fenêtre illuminée)
    buildingSpecialColor: "#991b1b", // Rouge bordeaux (accueil & verrée)
    buildingVisitedColor: "#78716c", // Ardoise chaude (visité)
    buildingFootprintHalo: "#34d399",
    accentHex: "#14532d",
    accentSecondaryHex: "#991b1b",
    accentBgClass: "bg-[#14532d]",
    accentTextClass: "text-[#14532d]",
    accentBorderClass: "border-[#14532d]",
    accentSoftBgClass: "bg-[#14532d]/10",
  },
};

export const levitationVariants: Variants = {
  animate: {
    y: [0, -5, 0],
    transition: {
      duration: 2.8,
      ease: "easeInOut",
      repeat: Infinity,
    },
  },
};

export const groundShadowVariants: Variants = {
  animate: {
    scale: [1, 0.75, 1],
    opacity: [0.4, 0.16, 0.4],
    transition: {
      duration: 2.8,
      ease: "easeInOut",
      repeat: Infinity,
    },
  },
};

export const pulseRingVariants: Variants = {
  animate: {
    scale: [0.85, 2.1],
    opacity: [0.55, 0],
    transition: {
      duration: 2.4,
      ease: "easeOut",
      repeat: Infinity,
    },
  },
};

export const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.03,
    },
  },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 420,
      damping: 30,
    },
  },
};

export const springBounceTransition: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 28,
};

export function triggerHaptic(pattern: number | number[] = 12) {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* Ignoré si non supporté */
    }
  }
}

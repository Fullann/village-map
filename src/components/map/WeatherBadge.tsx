"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WeatherData {
  temperature: number | null;
  icon: string;
  description: string;
  tip: string;
}

export default function WeatherBadge() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/weather")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: WeatherData | null) => {
        if (isMounted && data) setWeather(data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  if (!weather || weather.temperature === null) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowTip((v) => !v)}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className="flex items-center gap-1.5 rounded-full border border-stone-200/80 bg-white/85 dark:bg-stone-900/85 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-stone-800 dark:text-stone-200 shadow-sm hover:bg-white transition cursor-pointer"
        title="Météo en direct à Vufflens-la-Ville"
      >
        <span className="text-sm">{weather.icon}</span>
        <span className="font-mono-tabular">{weather.temperature}°C</span>
        <span className="hidden sm:inline text-stone-500 font-normal text-[11px]">
          · {weather.description}
        </span>
      </button>

      <AnimatePresence>
        {showTip && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            className="absolute top-full left-0 mt-1.5 z-50 w-56 rounded-xl border border-stone-200/90 bg-white/95 p-2.5 text-[11px] text-stone-700 shadow-xl backdrop-blur-md"
          >
            <div className="font-bold text-stone-900 flex items-center gap-1">
              <span>{weather.icon}</span>
              <span>Météo Vufflens-la-Ville</span>
            </div>
            <p className="mt-1 text-stone-600 leading-snug">{weather.tip}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

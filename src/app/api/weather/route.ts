import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getWeatherInfo(code: number, temp: number): { icon: string; description: string; tip: string } {
  if (code === 0) {
    return {
      icon: "☀️",
      description: "Ciel dégagé",
      tip: temp <= 5 ? "Soirée fraîche, pensez aux gants !" : "Idéal pour se promener dans le village !",
    };
  }
  if (code >= 1 && code <= 3) {
    return {
      icon: "⛅",
      description: "Éclaircies & nuages",
      tip: "Belle soirée pour la tournée des fenêtres.",
    };
  }
  if (code >= 45 && code <= 48) {
    return {
      icon: "🌫️",
      description: "Brume / Brouillard",
      tip: "Ambiance mystérieuse, soyez prudents sur la route !",
    };
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return {
      icon: "🌧️",
      description: "Pluie",
      tip: "Prévoyez un parapluie et des bottes pour la tournée !",
    };
  }
  if (code >= 71 && code <= 77) {
    return {
      icon: "❄️",
      description: "Chutes de neige",
      tip: "Magie de l'hiver ! Couvrez-vous bien et attention au verglas.",
    };
  }
  if (code >= 95) {
    return {
      icon: "⛈️",
      description: "Orage",
      tip: "Prudence lors de vos déplacements.",
    };
  }
  return {
    icon: "🌡️",
    description: "Temps calme",
    tip: "Bonne découverte du village !",
  };
}

export async function GET() {
  try {
    // Coordonnées de Vufflens-la-Ville (Vaud) : 46.5822° N, 6.5364° E
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=46.5822&longitude=6.5364&current=temperature_2m,weather_code,precipitation&timezone=Europe%2FZurich";

    const res = await fetch(url, {
      next: { revalidate: 900 }, // Mise en cache 15 minutes
      headers: { "User-Agent": "VillageEnFete/1.0" },
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo status ${res.status}`);
    }

    const data = await res.json();
    const temp = Math.round(data.current?.temperature_2m ?? 8);
    const code = Number(data.current?.weather_code ?? 0);
    const info = getWeatherInfo(code, temp);

    return NextResponse.json({
      temperature: temp,
      icon: info.icon,
      description: info.description,
      tip: info.tip,
    });
  } catch (err) {
    return NextResponse.json(
      {
        temperature: null,
        icon: "✨",
        description: "Vufflens-la-Ville",
        tip: "Bonne balade dans le village !",
      },
      { status: 200 }
    );
  }
}

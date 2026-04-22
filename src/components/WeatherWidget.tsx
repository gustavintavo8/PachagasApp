"use client";

import { useState, useEffect } from "react";

interface WeatherWidgetProps {
    date: string;
}

const WEATHER_CODES: Record<number, string> = {
    0: "☀️", // Clear sky
    1: "🌤️", // Mainly clear
    2: "⛅", // Partly cloudy
    3: "☁️", // Overcast
    45: "🌫️", // Fog
    48: "🌫️", // Depositing rime fog
    51: "🌧️", // Drizzle: Light
    53: "🌧️", // Drizzle: Moderate
    55: "🌧️", // Drizzle: Dense intensity
    61: "🌧️", // Rain: Slight
    63: "🌧️", // Rain: Moderate
    65: "🌧️", // Rain: Heavy intensity
    71: "❄️", // Snow fall: Slight
    73: "❄️", // Snow fall: Moderate
    75: "❄️", // Snow fall: Heavy intensity
    80: "🌧️", // Rain showers: Slight
    81: "🌧️", // Rain showers: Moderate
    82: "⛈️", // Rain showers: Violent
    95: "⛈️", // Thunderstorm: Slight or moderate
    96: "⛈️", // Thunderstorm with slight and heavy hail
    99: "⛈️", // Thunderstorm with slight and heavy hail
};
export function WeatherWidget({ date }: { date: string }) {
    const [state, setState] = useState<{ loading: boolean; weather: { emoji: string; text: string } | null }>({ loading: true, weather: null });

    useEffect(() => {
        async function fetchWeather() {
            try {
                // Mieres, Asturias
                const latitude = 43.25;
                const longitude = -5.7667;

                // 2. Fetch forecast
                const weatherRes = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,precipitation_probability_max,weathercode&timezone=auto`
                );
                const weatherData = await weatherRes.json();

                if (!weatherData.daily) {
                    setState(prev => ({ ...prev, loading: false }));
                    return;
                }

                // Match the match date with the forecast dates
                const matchDateStr = new Date(date).toISOString().split('T')[0];
                const dateIndex = weatherData.daily.time.indexOf(matchDateStr);

                if (dateIndex !== -1) {
                    const temp = Math.round(weatherData.daily.temperature_2m_max[dateIndex]);
                    const prob = weatherData.daily.precipitation_probability_max[dateIndex];

                    setState({
                        loading: false,
                        weather: {
                            emoji: WEATHER_CODES[weatherData.daily.weathercode[dateIndex]] || "🌤️",
                            text: `${temp}º · 💧${prob}%`
                        }
                    });
                } else {
                    setState(prev => ({ ...prev, loading: false }));
                }
            } catch (error) {
                console.error("Failed to fetch weather:", error);
                setState(prev => ({ ...prev, loading: false }));
            }
        }

        fetchWeather();
    }, [date]);

    if (state.loading) {
        return <div className="skeleton h-6 w-24 rounded-full" />;
    }

    if (!state.weather) return null;

    return (
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-foreground">
            <span className="text-sm">{state.weather.emoji}</span>
            <span>{state.weather.text}</span>
        </span>
    );
}

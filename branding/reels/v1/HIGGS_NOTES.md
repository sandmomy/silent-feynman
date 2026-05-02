# Higgs script audit · v1 piloto

Análisis de cada script frente a las particularidades conocidas del modelo Higgs (3B base, perfil Eugene `09b98354-...`, config seed=12345 temp=0.3 pause=450ms chunk=72w). Basado en logs reales de generación de audiobook + Biozar VO.

## Tiempos estimados (165 wpm voz Higgs + 450ms por punto)

| Reel | Palabras | Períodos | Speech | Pauses | Total | ≤30s? |
|------|----------|----------|--------|--------|-------|-------|
| 1 — authority | 48 | 6 | 17.5s | 2.7s | **~20s** | ✅ |
| 2 — unity (recortado) | 50 | 8 | 18.2s | 3.6s | **~22s** | ✅ |
| 3 — essay (tempo lento) | 33 | 5 | 13s base · 25s lento | 2.3s | **~22-25s** | ✅ |

Los 3 caben con margen. Reel 2 pasó de 73→50 palabras: cortado MOCAF (acrónimo problemático), eliminada la cadena "workshop became startup became supply chain", reescrito el opener para impacto.

## Puntos de riesgo de pronunciación Higgs

### Reel 1
| Token | Riesgo | Mitigación |
|-------|--------|------------|
| "United Nations" | bajo | conocido, suena natural |
| "Page forty" | bajo | número escrito en letra ✓ |
| **"SBDI Center"** | **medio** | acrónimo de 4 letras. Higgs puede leerlo como "S-B-D-I" o intentar pronunciarlo "sbdi". Probar primero. Si suena raro: cambiar a `"S B D I Center"` (con espacios fuerza letras) o reformular a `"the Center I direct"` |
| "Indonesian", "African" | bajo | gentilicios estándar |

### Reel 2
| Token | Riesgo | Mitigación |
|-------|--------|------------|
| "Cassava" | bajo | palabra clara, dos sílabas, sin riesgo |
| "Indonesia, Nigeria, Liberia, Mali, Zambia, and Ghana" | bajo | nombres de país estándar; el `and` antes de Ghana ayuda a entonación |
| "modified flour" | bajo | inglés simple |
| "One hundred trainers · Two weeks · One root crop" | medio | la cadena de 3 frases cortas crea tres períodos seguidos → 3×450ms = 1.35s de pausas. Da ritmo cinemático pero asegúrate que no suene robótico. Si quieres compactar: convertir a coma → `"One hundred trainers, two weeks, one root crop."` (queda 1 pausa larga sólo al final) |

### Reel 3
| Token | Riesgo | Mitigación |
|-------|--------|------------|
| "carries one" (×3) | bajo | repetición intencional, fluida |
| "frequencies align" | bajo | natural |

## Recomendaciones generales

1. **Empezar por Reel 3** — el más corto y poético. Si la voz Higgs suena fluida ahí, los otros dos heredan calidad.
2. **Probar Reel 1 con "SBDI Center" tal cual primero.** Si Higgs lo destroza, swap a "the Center" o letras espaciadas.
3. **Ningún script tiene**: comillas, paréntesis, símbolos, números arábigos, dashes em, abreviaturas (Mr., Dr., etc.), URLs. Todo limpio.
4. **Si una toma sale mal**: regenerar con seed alternativa (probar 2026 — la fallback que usaron en chapter 1 problem blocks).

## Si Higgs vuelve a crashear
La instalación está bien (audiobook 8 capítulos generados). El segfault de 21:40 probablemente fue contención de VRAM con Antigravity/Chrome. Cerrar, reiniciar Higgs en cmd nueva, retry.

# Design System Document: Cinematic Data Command

## 1. Overview & Creative North Star
**Creative North Star: The Orbiting Observatory**
This design system moves away from traditional "flat" SaaS dashboards toward a high-fidelity, cinematic command center. It is designed to feel like a high-end mission control interface—technical, immersive, and authoritative. By blending the brutalist impact of ultra-wide typography with the ethereal depth of glassmorphism and atmospheric light, we create a "Technical Editorial" aesthetic. 

The system breaks the "template" look through **intentional atmospheric depth**: using aurora-inspired gradients and scan-line textures to suggest a living, breathing digital environment rather than a static grid of boxes.

---

## 2. Colors & Atmospheric Depth
The palette is rooted in the "Deep Void" (#05060F). All other colors function as luminous light sources within this dark space.

### The Color Palette (Material Naming Convention)
- **Primary (Electric Violet):** `#7C3AED` (The focus of action)
- **Secondary (Cyan):** `#06B6D4` (Technical data and secondary actions)
- **Tertiary (Cobalt):** `#2563EB` (Informational depth)
- **Surface:** `rgba(255, 255, 255, 0.03)`
- **Background:** `#05060F`

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning content. To define boundaries, designers must use **Tonal Transitions**. A section is defined by moving from `surface-container-low` to `surface-container-highest`.
- **Exception (The Ghost Border):** If a container requires a hard edge for visual focus, use a "Ghost Border": `rgba(255, 255, 255, 0.07)` with a 1px width. It should feel like a reflection on glass, not a structural line.

### Glassmorphism & Aurora Gradients
To create the "NASA" cinematic feel, the UI must exist on a Z-axis:
1.  **Background Layer:** Deep `#05060F` with a subtle noise texture (2-3% opacity).
2.  **Atmospheric Layer:** Two large, blurred "Aurora" blobs—Electric Violet at Top-Left, Cyan at Bottom-Right. Opacity should hover between 10-15%.
3.  **Glass Layer:** All main panels use the `surface` token with a `backdrop-blur` of 20px to 40px.

---

## 3. Typography: The Editorial Edge
The typography strategy creates a tension between high-impact editorial headings and clinical, technical data.

- **Display & Headings (Syne, 800 weight):** Use an aggressive `-0.03em` letter-spacing. This creates a dense, "heavy-duty" feel suitable for mission titles and high-level metrics.
- **Technical Labels (Syne, 500-600 weight):** Used for UI actions and navigation to maintain brand character.
- **Data & Readouts (JetBrains Mono):** All dynamic data, timestamps, and system logs must use JetBrains Mono. This provides the "Mission Control" technical accuracy.
- **Body Content (Inter):** Reserved for long-form reading to ensure maximum legibility against the dark, textured background.

---

## 4. Elevation & Depth
In this system, "Up" means "Brighter and Bluer," not "Shadowed."

- **The Layering Principle:** Use the surface-container tiers to stack importance. 
    - `surface-container-lowest`: The base layout areas.
    - `surface-container-high`: Interactive cards or modals.
- **Ambient Shadows:** Shadows are never black or grey. Use a tinted shadow based on the primary or secondary color (e.g., `rgba(124, 58, 237, 0.08)`) with a massive blur (40px+) to simulate a glowing object reflecting off a surface.
- **Animated Shimmers:** Interactive elements should feature a "scan-line shimmer"—a subtle, diagonal light gradient that moves across the surface on hover to indicate "System Active" status.

---

## 5. Components

### Buttons (Kinetic Triggers)
- **Primary:** Gradient from `primary` (#7C3AED) to `tertiary` (#2563EB) at 135 degrees. No border. Text is `on-primary` (Deep Violet/White).
- **Secondary:** Transparent background with a `Ghost Border` (#FFFFFF at 0.07 opacity). On hover, increase border opacity to 0.2 and add a subtle Cyan outer glow.
- **Monospaced Labels:** All button text should be uppercase with slightly increased tracking (0.05em) for a "Command" feel.

### Cards & Lists (Data Clusters)
- **The Divider Ban:** Lists must never use horizontal lines. Separate items using `16px` of vertical whitespace or by alternating background subtle shifts (e.g., `surface-container-low` to `surface-container-lowest`).
- **Corner Radii:** Use `12-14px` for large containers (Panels) and `8-10px` for nested elements (Cards).

### Input Fields (Telemetry Input)
- **Visuals:** Background uses `surface-container-lowest`. The bottom border is a 2px `primary` (Violet) line that only appears on `:focus`.
- **Typography:** Input text uses `JetBrains Mono` to reinforce the data-entry nature of the platform.

### Mission Status Chips
- **Style:** Small, pill-shaped elements with a 10% opacity background of their status color (Success/Danger/Warning) and a 100% opacity text label. This creates a "light-emissive" effect.

---

## 6. Do's and Don'ts

### Do:
- **Do** use negative space to let the "Aurora" gradients breathe.
- **Do** use `JetBrains Mono` for any value that changes (numbers, dates, IDs).
- **Do** lean into asymmetry. A large heading on the left balanced by a small technical readout on the far right creates a cinematic composition.
- **Do** apply a 2px "scan-line" overlay pattern at 5% opacity across the entire viewport to unify the atmosphere.

### Don't:
- **Don't** use pure black (#000000) or pure grey. Use the deep navy/violet tones of the background token.
- **Don't** use standard drop shadows with 0 blur. Shadows must be "Ambient Glows."
- **Don't** use "Light Mode" defaults. If a high-contrast area is needed, use `surface-bright` with 80% opacity.
- **Don't** crowd the interface. The "Mission Control" look fails if it becomes "Excel." Every data point needs room to feel critical.
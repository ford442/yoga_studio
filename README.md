# 🧘 Yoga Studio - Sacred Breath Timer

A modern web application that combines **precision breath timing**, **chakra-aware visualization**, and **posture guidance** into a comprehensive pranayama practice tool. Built with Next.js, React, and WebGPU for immersive, hardware-accelerated graphics.

<div align="center">

**[Live Demo](#) • [Features](#features) • [Getting Started](#getting-started) • [Architecture](#architecture) • [Contributing](#contributing)**

</div>

## Overview

Yoga Studio is designed to support serious pranayama practitioners through a scientifically-timed breathing application synchronized with:
- 🫁 **4-phase breathing cycles** - Inhale, hold, exhale, empty
- 🎨 **Chakra visualization** - GPU-rendered energy channel awareness
- 🧍 **Posture guidance** - Real-time form feedback with SVG animations
- 📚 **Educational content** - Sanskrit terminology, techniques, and benefits

The app is perfect for practitioners of **Kundalini yoga**, **Hatha yoga**, and traditional **pranayama** techniques.

## Features

### 🫁 Intelligent Breath Timer
- **4-phase pranayama cycles** - Each phase tied to a specific chakra
- **Three difficulty levels** - Light (5s), Medium (7s), Strong (7-10s)
- **Progressive timing** - Durations increase after key cycle milestones
- **Automatic progression** - Seamless phase transitions with visual/audio cues
- **Manual controls** - Pause, resume, and reset at any time
- **Cycle tracking** - Monitor your practice progress

### 🎨 WebGPU Chakra Visualization
- **Hardware-accelerated graphics** - Smooth 60fps animations on GPU
- **7 chakra system** - Complete energy channel visualization
  - Muladhara (Root) - Red
  - Svadhisthana (Sacral) - Orange
  - Manipura (Solar Plexus) - Yellow
  - Anahata (Heart) - Green
  - Vishuddha (Throat) - Cyan
  - Ajna (Third Eye) - Indigo
  - Sahasrara (Crown) - Violet
- **Phase-synchronized colors** - Chakra glows shift with breath phases
- **Kaleidoscope pattern** - Mesmerizing animated raymarched geometry
- **Breath ring indicator** - Visual feedback of breath progress

### 🧍 Posture Guidance
- **Animated stick figures** - Visual form cues for each breath phase
- **Chakra spine visualization** - 7 glowing points along the energy channel
- **Real-time instructions** - Context-aware guidance for each phase
- **Bandha information** - Learn proper energy locks:
  - Mula Bandha (root lock)
  - Uddiyana Bandha (abdominal lock)
  - Jalandhara Bandha (throat lock)
- **Drishti guidance** - Eye gaze recommendations for each phase
- **Pranayama wisdom** - Educational context about:
  - Kumbhaka (breath retention)
  - Nadis (energy channels: Ida, Pingala, Sushumna)
  - Prana flow and energy cultivation

### 📱 Responsive Design
- **Mobile-friendly** - Optimized layouts for all screen sizes
- **Touch controls** - Easy tap buttons for start/pause/reset
- **Landscape mode** - Full-screen visualization support
- **Accessibility** - Semantic HTML, screen reader friendly

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Next.js | 16.1.6 |
| **UI Library** | React | 19.2.3 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Graphics** | WebGPU / WGSL | Latest |
| **Build Output** | Static Export | - |

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome/Chromium | 113+ | ✅ Full support |
| Edge | 113+ | ✅ Full support |
| Opera | 99+ | ✅ Full support |
| Safari | Technology Preview | ✅ Full support |
| Firefox | Current | ❌ No WebGPU yet |

The app detects unsupported browsers and displays a helpful fallback message.

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** or yarn package manager
- A **WebGPU-compatible browser** (Chrome/Edge 113+)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd yoga_studio

# Install dependencies
npm install
```

### Development

Start the development server with hot-reload:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The page will auto-update as you edit files.

### Building for Production

Create an optimized production build:

```bash
npm run build
```

The build outputs a static site in the `out/` directory, ready for deployment to any static hosting provider.

### Starting Production Server

```bash
npm start
```

This runs the Next.js production server (useful for testing before deployment).

### Linting & Code Quality

Check code quality with ESLint:

```bash
npm run lint
```

Auto-fix issues:

```bash
npm run lint -- --fix
```

## Project Structure

```
yoga_studio/
├── app/
│   ├── components/
│   │   ├── WebGPUShader.tsx        # WebGPU canvas & shader rendering
│   │   ├── PostureGuide.tsx        # Posture guidance with animated SVG
│   │   └── BreathTimer.tsx         # Timer UI (legacy)
│   ├── hooks/
│   │   └── useSacredBreathTimer.ts # Core breathing logic + chakra mapping
│   ├── globals.css                 # Tailwind CSS imports
│   ├── layout.tsx                  # Root layout component
│   └── page.tsx                    # Main page
├── public/
│   ├── yoga.glsl                   # Reference GLSL shader (legacy)
│   ├── yoga-regular.wgsl           # WGSL reference implementation
│   └── yoga-fixed.wgsl             # WGSL reference (fixed version)
├── deploy.py                       # SFTP deployment script
├── webgpu.d.ts                     # WebGPU type definitions
├── next.config.ts                  # Next.js configuration
├── tsconfig.json                   # TypeScript configuration
├── eslint.config.mjs               # ESLint flat config
├── postcss.config.mjs              # PostCSS + Tailwind
├── package.json                    # Dependencies & scripts
├── README.md                       # This file
├── AGENTS.md                       # Detailed architecture guide
└── claude.md                       # Claude Code development guide
```

## Core Architecture

### Breath Timing System

The app implements a scientifically-designed 4-phase breathing cycle:

```
Cycle Duration: 24 seconds (Light level)

┌─────────┬─────────┬─────────┬─────────┐
│ Inhale  │ Hold-in │ Exhale  │ Hold-out│
│  6 sec  │  6 sec  │  6 sec  │  6 sec  │
├─────────┼─────────┼─────────┼─────────┤
│ 0-25%   │ 25-50%  │ 50-75%  │ 75-100% │
└─────────┴─────────┴─────────┴─────────┘
```

**Strength Levels:**
- **Light (Level 0):** 5 seconds per phase → 20 second cycle
- **Medium (Level 1):** 7 seconds per phase → 28 second cycle
- **Strong (Level 2):** 7-10 seconds per phase (increases with cycle count)

### Chakra System

Each breath phase activates specific chakras:

| Phase | Primary Chakra | Secondary | Significance |
|-------|---|---|---|
| **Inhale** | Anahata (Heart) | Vishuddha (Throat) | Opening to receive prana |
| **Hold-in** | Manipura (Solar Plexus) | - | Building internal fire |
| **Exhale** | Muladhara (Root) | - | Grounding and releasing |
| **Hold-out** | Sahasrara (Crown) | - | Cosmic consciousness connection |

### WebGPU Visualization

The shader system provides real-time visualization of:

- **Kaleidoscope animation** - Raymarched geometric patterns
- **Chakra glow** - Active chakra pulses, inactive ones show subtle base glow
- **Breath synchronization** - Patterns scale/breathe with breath progress
- **Phase colors** - Dynamic color shifts based on breath phase
- **Breath ring** - Expanding/contracting ring showing breath state

### Component Communication

```
useSacredBreathTimer (Hook)
├── Tracks breath phase & timing
├── Calculates chakra states
└── Returns unified data object
    │
    ├→ WebGPUShader (Visualization)
    │   └── Receives uniform data → renders GPU graphics
    │
    ├→ PostureGuide (Instruction)
    │   └── Receives phase → displays posture & text
    │
    └→ page.tsx (Main)
        └── Displays countdown, controls, cycle count
```

## Advanced Customization

### Adjusting Breath Timing

Edit `app/hooks/useSacredBreathTimer.ts`:

```typescript
const STRENGTH_LEVELS = [
  { label: 'Light', baseDuration: 5 },    // 20 sec cycle
  { label: 'Medium', baseDuration: 7 },   // 28 sec cycle
  { label: 'Strong', baseDuration: 7 },   // 28-40 sec cycle
];
```

### Changing Chakra Colors

Update the chakra color array in `useSacredBreathTimer.ts`:

```typescript
const CHAKRA_COLORS = [
  { name: 'Muladhara', color: '#ef4444' },    // Red
  { name: 'Svadhisthana', color: '#f97316' }, // Orange
  // ... etc
];
```

Also update shader colors in `WebGPUShader.tsx` to keep them in sync.

### Adding New Pranayama Practices

The foundation is in place to add new breathing techniques:
1. Create new phase definitions in `useSacredBreathTimer.ts`
2. Add corresponding postures in `PostureGuide.tsx`
3. Update shader colors in `WebGPUShader.tsx`
4. Add educational content to instruction sections

## Deployment

### Deploy to Vercel (Recommended)

```bash
# Build the app
npm run build

# Deploy using Vercel CLI
vercel deploy
```

The app is configured for static export, making it ideal for edge deployment.

### Deploy via SFTP

Using the included deployment script:

```bash
python deploy.py
```

This requires SFTP credentials configured in `deploy.py`.

### Deploy to Any Static Host

The `out/` directory contains a complete static site. Upload it to:
- **Netlify** - Drag and drop or git sync
- **GitHub Pages** - Push `out/` contents
- **AWS S3 + CloudFront** - Static hosting with CDN
- **Traditional hosting** - FTP/SFTP upload

## Practices Supported

### Primary Pranayama
- **Box Breathing** - Equal timing: inhale, hold, exhale, hold
- **Nadi Shodhana Foundation** - Channel awareness during breathing
- **Kundalini Activation** - Chakra visualization during practice

### Skill Levels
- **Beginner** - Light level, 5 second phases
- **Intermediate** - Medium level, 7 second phases
- **Advanced** - Strong level with progressive increases

## Usage Tips

1. **Choose your level** - Start with Light if new to pranayama
2. **Sit comfortably** - Use a meditation cushion (zafu)
3. **Maintain posture** - Keep spine straight (Tadasana foundation)
4. **Focus on breath** - Match your breath to timer precision
5. **Chakra awareness** - Visualize energy moving through the channel
6. **Daily practice** - Consistency is key; start with 5-10 cycles

## Troubleshooting

### WebGPU canvas appears black
- Verify your browser supports WebGPU (Chrome/Edge 113+)
- Check browser console for shader compilation errors
- Try reloading the page

### Timer doesn't start
- Ensure JavaScript is enabled
- Check for browser console errors
- Try a different browser

### Styling looks broken
- Clear browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
- Rebuild the app: `npm run build`

### Performance issues
- Close unnecessary browser tabs
- Try the app in a different browser
- Check for hardware acceleration in browser settings

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes with clear commit messages
4. Test thoroughly
5. Push to your fork and submit a Pull Request

### Development Guidelines

- Use TypeScript for type safety
- Follow ESLint rules (run `npm run lint -- --fix`)
- Keep components focused and reusable
- Test on multiple browsers and devices
- Document complex logic with comments

## Learning Resources

### Yoga & Pranayama
- **The Yoga Sutras of Patanjali** - Foundation of yoga philosophy
- **Hatha Yoga Pradipika** - Classical pranayama techniques
- **The Kundalini Meditation Sourcebook** - Modern chakra practices

### Web Technologies
- [Next.js Documentation](https://nextjs.org/docs)
- [WebGPU Specification](https://gpuweb.github.io/gpuweb/)
- [WGSL Reference](https://www.w3.org/TR/WGSL/)
- [Tailwind CSS](https://tailwindcss.com)

## Architecture Deep Dive

For detailed architecture information, chakra system explanation, and shader internals, see [AGENTS.md](./AGENTS.md).

For Claude Code development guidance and common tasks, see [claude.md](./claude.md).

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with love for the yoga community
- Inspired by traditional pranayama teachings
- WebGPU visualization powered by modern browser APIs

---

## Quick Links

- **Report a Bug** - [GitHub Issues](https://github.com/ford442/yoga_studio/issues)
- **Request a Feature** - [GitHub Discussions](https://github.com/ford442/yoga_studio/discussions)
- **Documentation** - [AGENTS.md](./AGENTS.md) | [claude.md](./claude.md)
- **Live Demo** - Coming soon

---

<div align="center">

🧘 **May your practice bring peace and awareness** 🧘

Made with ❤️ for conscious practitioners

</div>

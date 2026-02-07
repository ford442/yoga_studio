# Yoga Studio - Sacred Breath Timer

A Next.js React application that demonstrates WebGPU capabilities through an immersive breathing visualization powered by WGSL shaders.

## Description

This app features a WGSL (WebGPU Shading Language) shader that creates an animated, pulsing circle with color gradients - perfect for mindful breathing exercises.

## Features

- **WebGPU-powered visualization**: Utilizes modern WebGPU API for hardware-accelerated graphics
- **WGSL shader**: Custom shader written in WebGPU Shading Language
- **Breathing animation**: Smooth, rhythmic pulsing effect synchronized to a calming breathing cycle
- **Responsive design**: Built with Tailwind CSS for a beautiful, responsive UI
- **TypeScript**: Fully typed for better development experience

## Requirements

- Node.js (v18 or higher recommended)
- npm
- A browser with WebGPU support (Chrome 113+, Edge 113+, or other Chromium-based browsers)

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Building

Build the application for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Linting

Run ESLint to check code quality:

```bash
npm run lint
```

## Technologies Used

- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **WebGPU**: Modern graphics API
- **WGSL**: WebGPU Shading Language

## WebGPU Support

WebGPU is currently supported in:
- Chrome/Edge 113+ (stable)
- Opera 99+
- Safari Technology Preview

If your browser doesn't support WebGPU, the app will display a helpful message.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

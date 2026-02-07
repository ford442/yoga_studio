import WebGPUShader from './components/WebGPUShader';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <main className="flex flex-col items-center justify-center p-8 gap-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
            Yoga Studio
          </h1>
          <p className="text-xl text-purple-200 mb-2">
            A Sacred Breath Timer
          </p>
          <p className="text-sm text-purple-300">
            WebGPU-powered WGSL shader visualization
          </p>
        </div>
        
        <WebGPUShader />
        
        <div className="text-center text-white max-w-2xl">
          <p className="text-sm text-purple-300">
            Watch the breathing circle expand and contract. Follow its rhythm for a mindful breathing practice.
          </p>
        </div>
      </main>
    </div>
  );
}

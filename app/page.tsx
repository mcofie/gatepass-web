export const revalidate = 0

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white flex flex-col relative overflow-hidden">
      {/* Minimal Header - Centered Logo */}
      <header className="absolute top-0 left-0 right-0 z-50 py-8 flex justify-center items-center pointer-events-none mix-blend-difference text-white">
        <div className="text-xl font-bold tracking-tighter cursor-default pointer-events-auto">GatePass.</div>
      </header>

      {/* Main Content - Vertically Centered */}
      <main className="flex-grow flex flex-col justify-center px-6 md:px-12 max-w-screen-2xl mx-auto w-full z-10">
        {/* Minimal Hero Text */}
        <div>
          <h1 className="text-[14vw] md:text-[12vw] leading-[0.8] font-bold tracking-tighter mb-8 animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
            Experience<br />
            Curated<br />
            Events.
          </h1>
          <p className="max-w-md text-lg md:text-xl text-gray-500 font-medium leading-relaxed pl-1 animate-slide-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
            Seamless reservations. Exclusive access.
            <br />The premium platform for modern experiences.
          </p>
        </div>
      </main>

      {/* Minimal Footer - Empty/Clean */}
      <footer className="px-6 py-8 flex justify-between items-end">
        {/* Removed Copyright */}
      </footer>
    </div>
  )
}

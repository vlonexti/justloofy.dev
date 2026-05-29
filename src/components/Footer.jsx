export default function Footer() {
  return (
    <footer className="bg-mc-dark border-t-4 border-black py-8 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <img src="/logo.png" alt="JustLoofy Logo" className="w-10 h-10 object-contain" />
          <span className="font-minecraft text-xl text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
            JustLoofy
          </span>
        </div>
        
        <div className="text-gray-400 text-sm text-center md:text-right">
          <p>Not an official Minecraft product.</p>
          <p>Not approved by or associated with Mojang or Microsoft.</p>
          <p className="mt-2 text-gray-500">© {new Date().getFullYear()} JustLoofy Network. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

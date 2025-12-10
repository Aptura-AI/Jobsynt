export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row">
        <span>© {new Date().getFullYear()} JobSynth. All rights reserved.</span>
        <div className="flex gap-4">
          <a href="/privacy-policy">Privacy</a>
          <a href="/terms-and-conditions">Terms</a>
          <a href="/contact-us">Contact</a>
        </div>
      </div>
    </footer>
  );
}


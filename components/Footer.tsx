import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row">
        <span>© {new Date().getFullYear()} Jobsynt. All rights reserved.</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-primary">Privacy</Link>
          <a href="/terms-and-conditions" className="hover:text-primary">Terms</a>
          <a href="/contact-us" className="hover:text-primary">Contact</a>
        </div>
      </div>
    </footer>
  );
}


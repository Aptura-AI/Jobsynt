import FeatureList from '@/components/FeatureList';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import TestimonialStrip from '@/components/TestimonialStrip';
import Link from 'next/link';
import Button from '@/components/Button';

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureList />
      <HowItWorks />
      <TestimonialStrip />
      <section className="bg-gradient-to-r from-blue-600 to-primary">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-12 text-center text-white">
          <h3 className="text-2xl font-bold">Ready to see vetted ERP & Cloud talent?</h3>
          <p className="max-w-2xl text-blue-50">
            Start with a curated talent pool or post your ERP/Cloud requirement. Jobsynt makes matching fast and transparent.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/talent-pool">
              <Button variant="ghost" className="bg-white text-primary hover:bg-slate-100">
                Browse Talent
              </Button>
            </Link>
            <Link href="/jobs">
              <Button className="bg-black/30 text-white hover:bg-black/40">View Jobs</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}


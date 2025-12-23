/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack, isServer }) => {
    // Exclude Supabase Edge Functions from Next.js build
    // Edge Functions are Deno-based and should not be compiled by Next.js
    
    // Ignore Supabase functions directory
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/supabase\/functions\/.*$/,
      })
    );
    
    // Ignore Deno imports
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['https://deno.land/std@0.168.0/http/server.ts'] = false;
    
    return config;
  },
};

export default nextConfig;


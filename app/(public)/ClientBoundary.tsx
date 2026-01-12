'use client';

export default function ClientBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

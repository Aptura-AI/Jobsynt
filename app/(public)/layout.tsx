import ClientBoundary from './ClientBoundary';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientBoundary>{children}</ClientBoundary>;
}

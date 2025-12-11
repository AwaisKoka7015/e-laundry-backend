import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'E-Laundry API',
  description: 'E-Laundry Backend API for Pakistani Users',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
}

export default function PageContainer({ children }: PageContainerProps) {
  return (
    <div style={{ padding: '32px 32px 56px', maxWidth: 1360, margin: '0 auto' }}>
      {children}
    </div>
  );
}

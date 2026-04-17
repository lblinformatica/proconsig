'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function BorderoDetails(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/borderos/${params.id}/editar`);
  }, [params.id, router]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      Redirecionando...
    </div>
  );
}

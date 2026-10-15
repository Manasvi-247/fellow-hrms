import { CompassIcon, HouseIcon } from '@phosphor-icons/react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../state.jsx';
import { EmptyState } from '../components/common.jsx';

export default function NotFound() {
  const { go } = useApp();
  const { pathname } = useLocation();
  return (
    <EmptyState
      Icon={CompassIcon}
      title="Page not found"
      body={`There's nothing at ${pathname}. It may have moved, or the link has a typo.`}
      cta="Go to dashboard"
      CtaIcon={HouseIcon}
      onCta={() => go('/')}
    />
  );
}

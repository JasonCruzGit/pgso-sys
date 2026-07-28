import { LOGO_PATH, BRANDING } from '../constants/branding';

interface AppLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
};

export default function AppLogo({ size = 'sm', className = '' }: AppLogoProps) {
  return (
    <img
      src={LOGO_PATH}
      alt={`${BRANDING.province} — ${BRANDING.officeName}`}
      className={`rounded-full object-contain shadow-sm ${sizes[size]} ${className}`}
    />
  );
}

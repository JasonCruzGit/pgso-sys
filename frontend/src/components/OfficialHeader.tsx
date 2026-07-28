import { BRANDING, LOGO_PATH } from '../constants/branding';

interface OfficialHeaderProps {
  title?: string;
  subtitle?: string;
}

export default function OfficialHeader({
  title = BRANDING.systemTitle,
  subtitle,
}: OfficialHeaderProps) {
  return (
    <div className="official-header">
      <img src={LOGO_PATH} alt={BRANDING.province} className="mx-auto mb-2 h-16 w-16 rounded-full object-contain" />
      <p className="republic">{BRANDING.republic}</p>
      <p className="province">{BRANDING.lguName}</p>
      <p className="office">{BRANDING.officeName}</p>
      <hr className="official-divider" />
      <p className="system">{title}</p>
      {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

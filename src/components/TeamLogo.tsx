import { Team } from '@/lib/types';

interface TeamLogoProps {
  team: Team;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = { sm: 28, md: 40, lg: 64, xl: 96 };

export default function TeamLogo({ team, size = 'md' }: TeamLogoProps) {
  const px = SIZES[size];

  // If team has a real logo image, show it without the container box
  if (team.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt={team.name}
        title={team.name}
        style={{
          width: px,
          height: px,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
    );
  }

  // Fallback: colored badge with shortName
  const sizeClass = size === 'md' ? '' : size;
  const isOutlined = team.logoStyle === 'outlined';

  return (
    <div
      className={`team-logo ${sizeClass}`}
      style={
        isOutlined
          ? {
              background: '#fff',
              border: `2px solid ${team.primaryColor}`,
              color: team.primaryColor,
            }
          : {
              background: `linear-gradient(135deg, ${team.primaryColor}, ${team.secondaryColor})`,
            }
      }
      title={team.name}
    >
      {team.shortName}
    </div>
  );
}

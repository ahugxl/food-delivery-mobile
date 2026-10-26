import { ProfileAvatar } from './ProfileAvatar';

type DriverAvatarProps = {
  size: number;
  path?: string | null;
};

export function DriverAvatar({
  size,
  path,
}: DriverAvatarProps) {
  return <ProfileAvatar path={path} size={size} />;
}

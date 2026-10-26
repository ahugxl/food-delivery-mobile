import type { Coordinates } from '../../features/location/coordinates';
export type MapPanelProps = {
  coordinate: Coordinates;
  onSelect?: (coordinate: Coordinates) => void;
  origin?: Coordinates;
  driver?: Coordinates | null;
  simulation?: boolean;
};

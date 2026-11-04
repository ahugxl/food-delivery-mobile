import CampaignScreen from "../features/offers/CampaignScreen";
import { useLocalSearchParams } from "expo-router";
export default function CampaignRoute() {
  const { bannerId } = useLocalSearchParams<{ bannerId?: string | string[] }>();
  return (
    <CampaignScreen
      bannerId={Array.isArray(bannerId) ? bannerId[0] : bannerId}
    />
  );
}

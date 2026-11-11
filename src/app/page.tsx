import { Dashboard } from "@/components/home/dashboard";
import { MediaExchange } from "@/components/exchange/media-exchange";
import { exchangeUnavailable } from "@/lib/media-share";
import { exchangeState } from "@/lib/media-share-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let state = exchangeUnavailable("The media exchange couldn't be loaded.");
  try {
    state = await exchangeState();
  } catch (error) {
    console.error("[home] media exchange", error);
  }

  return (
    <Dashboard
      exchange={<MediaExchange state={state} now={state.now} />}
    />
  );
}

import AmplifierConnectionClient from "./amplifier-connection-client";

export const revalidate = 0;

export default function AmplifierConnectionPage() {
  const connected = !!process.env.AMPLIFIER_API_KEY;

  return <AmplifierConnectionClient initialConnected={connected} />;
}

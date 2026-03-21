import AmazonConnectionClient from "./amazon-connection-client";

export const revalidate = 0;

export default function AmazonConnectionPage() {
  const connected = !!process.env.AMAZON_SP_CLIENT_ID;

  return <AmazonConnectionClient initialConnected={connected} />;
}

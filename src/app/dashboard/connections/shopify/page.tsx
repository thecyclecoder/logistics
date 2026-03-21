import ShopifyConnectionClient from "./shopify-connection-client";

export const revalidate = 0;

export default function ShopifyConnectionPage() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN ?? null;
  const connected = !!storeDomain;

  return (
    <ShopifyConnectionClient
      initialConnected={connected}
      storeDomain={storeDomain}
    />
  );
}

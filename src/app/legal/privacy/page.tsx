export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8">
          Privacy Policy
        </h1>
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <p className="text-gray-500">Last updated: March 20, 2026</p>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">1. Introduction</h2>
            <p>
              Superfoods Company (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the Logistics inventory
              management application. This Privacy Policy explains how we collect, use, and
              protect information when you use our Application.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Account Information:</strong> Email address and name via Google OAuth
                sign-in
              </li>
              <li>
                <strong>Business Data:</strong> Inventory levels, product information, sales
                records, and order data from connected third-party services (QuickBooks,
                Amazon, Shopify, 3PL providers)
              </li>
              <li>
                <strong>Usage Data:</strong> Application access logs and sync operation records
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">3. How We Use Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide inventory management and analytics functionality</li>
              <li>Synchronize data between connected business platforms</li>
              <li>Generate reports and dashboards for authorized users</li>
              <li>Monitor and improve Application performance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">4. Data Storage</h2>
            <p>
              Data is stored securely using Supabase (PostgreSQL) with row-level security
              policies. The Application is hosted on Vercel. All data transmission is encrypted
              via TLS/SSL.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">5. Third-Party Services</h2>
            <p>
              The Application connects to the following third-party services to retrieve and
              synchronize business data:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Intuit QuickBooks Online</li>
              <li>Amazon Selling Partner API</li>
              <li>Shopify Admin API</li>
              <li>Amplifier Fulfillment (3PL)</li>
              <li>Google (authentication)</li>
            </ul>
            <p className="mt-2">
              Each service&apos;s own privacy policy governs their handling of your data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">6. Data Sharing</h2>
            <p>
              We do not sell, trade, or share your data with third parties except as necessary
              to operate the Application through the integrated services listed above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">7. Data Retention</h2>
            <p>
              Business data is retained for as long as your account is active. You may request
              deletion of your data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">8. Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your
              data, including encrypted connections, role-based access control, and regular
              security reviews.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">9. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Access the data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Revoke access to connected third-party services at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">10. Contact</h2>
            <p>
              For questions about this Privacy Policy, contact us at{" "}
              <a href="mailto:dylan@superfoodscompany.com" className="text-brand-600 hover:underline">
                dylan@superfoodscompany.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

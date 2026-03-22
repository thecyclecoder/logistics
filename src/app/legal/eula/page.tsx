export default function EULAPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8">
          End-User License Agreement
        </h1>
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
          <p className="text-gray-500">Last updated: March 20, 2026</p>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Shoptics inventory management application
              (&quot;Application&quot;) operated by Superfoods Company, you agree to be bound by
              this End-User License Agreement (&quot;EULA&quot;). If you do not agree, do not use the
              Application.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">2. License Grant</h2>
            <p>
              Superfoods Company grants you a limited, non-exclusive, non-transferable,
              revocable license to use the Application for internal business purposes related to
              inventory management, order tracking, and sales analytics.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">3. Restrictions</h2>
            <p>You may not:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Copy, modify, or distribute the Application</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Application</li>
              <li>Use the Application for any unlawful purpose</li>
              <li>Share access credentials with unauthorized users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">4. Third-Party Integrations</h2>
            <p>
              The Application integrates with third-party services including QuickBooks Online,
              Amazon Seller Central, Shopify, and third-party logistics providers. Your use of
              these integrations is subject to the respective terms of service of each provider.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">5. Data Handling</h2>
            <p>
              The Application accesses and stores business data including inventory levels,
              sales records, and product information from connected services. This data is used
              solely for the purpose of providing inventory management and analytics
              functionality.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">6. Disclaimer of Warranties</h2>
            <p>
              The Application is provided &quot;as is&quot; without warranty of any kind. Superfoods
              Company makes no warranties, express or implied, regarding the Application&apos;s
              reliability, availability, or fitness for a particular purpose.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">7. Limitation of Liability</h2>
            <p>
              In no event shall Superfoods Company be liable for any indirect, incidental,
              special, or consequential damages arising from use of the Application.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">8. Termination</h2>
            <p>
              This license is effective until terminated. Superfoods Company may terminate this
              license at any time without notice. Upon termination, you must cease all use of
              the Application.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">9. Contact</h2>
            <p>
              For questions about this EULA, contact us at{" "}
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

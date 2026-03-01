export default function WelcomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        color: "#f8fafc",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "640px" }}>
        <div
          style={{
            fontSize: "3rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
            background: "linear-gradient(90deg, #38bdf8, #818cf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Courgae Stocks
        </div>

        <p
          style={{
            fontSize: "1.125rem",
            color: "#94a3b8",
            marginBottom: "2.5rem",
            lineHeight: 1.6,
          }}
        >
          AI-powered trading signals and portfolio management.
          <br />
          Smart decisions, backed by data.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="/dashboard"
            style={{
              padding: "0.75rem 2rem",
              background: "linear-gradient(90deg, #38bdf8, #818cf8)",
              color: "#0f172a",
              borderRadius: "0.5rem",
              fontWeight: "600",
              textDecoration: "none",
              fontSize: "0.95rem",
            }}
          >
            Get Started
          </a>
          <a
            href="/about"
            style={{
              padding: "0.75rem 2rem",
              border: "1px solid #334155",
              color: "#94a3b8",
              borderRadius: "0.5rem",
              fontWeight: "500",
              textDecoration: "none",
              fontSize: "0.95rem",
            }}
          >
            Learn More
          </a>
        </div>

        <div
          style={{
            marginTop: "4rem",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1.5rem",
          }}
        >
          {[
            { icon: "📈", title: "AI Signals", desc: "Real-time buy/sell recommendations" },
            { icon: "🛡️", title: "Risk Controls", desc: "Confidence thresholds & stop-loss" },
            { icon: "⚡", title: "Multi-Broker", desc: "Alpaca, IBKR, and Schwab support" },
          ].map((feature) => (
            <div
              key={feature.title}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "0.75rem",
                padding: "1.25rem",
              }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{feature.icon}</div>
              <div style={{ fontWeight: "600", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                {feature.title}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

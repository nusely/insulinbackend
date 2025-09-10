module.exports = function (app) {
  // Pretty JSON helper
  function sendPrettyJson(res, data) {
    const accept = res.req.headers["accept"] || "";
    if (accept.includes("text/html")) {
      res.setHeader("Content-Type", "text/html");
      res.send(
        '<pre style="font-size:1.1em;background:#222;color:#fff;padding:1em;border-radius:8px;">' +
          JSON.stringify(data, null, 2) +
          "</pre>"
      );
    } else {
      res.json(data);
    }
  }

  app.get("/health", (req, res) => {
    sendPrettyJson(res, {
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/metrics", (req, res) => {
    sendPrettyJson(res, {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/dashboard", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monitoring Dashboard</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { background: #f5f7fa; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
          .container { max-width: 700px; margin: 40px auto; padding: 24px; background: #fff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
          h1 { color: #2d3a4a; margin-bottom: 0.5em; }
          .card { background: #f0f4f8; border-radius: 8px; padding: 18px 24px; margin-bottom: 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
          .card h2 { margin: 0 0 0.5em 0; font-size: 1.2em; color: #1a2330; }
          .json { font-family: 'Fira Mono', 'Consolas', monospace; background: #222; color: #fff; padding: 12px; border-radius: 6px; font-size: 1em; }
          .footer { text-align: center; color: #888; margin-top: 2em; font-size: 0.95em; }
          a { color: #0078d7; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .chart-container { background: #fff; border-radius: 8px; padding: 18px 24px; margin-bottom: 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚦 Monitoring Dashboard</h1>
          <div class="card">
            <h2>Health</h2>
            <div id="health" class="json">Loading...</div>
          </div>
          <div class="card">
            <h2>Metrics</h2>
            <div id="metrics" class="json">Loading...</div>
          </div>
          <div class="chart-container">
            <h2>Uptime (seconds)</h2>
            <canvas id="uptimeChart" height="80"></canvas>
          </div>
          <div class="footer">
            <a href="/health" target="_blank">Raw Health JSON</a> &middot; <a href="/metrics" target="_blank">Raw Metrics JSON</a>
          </div>
        </div>
        <script>
          async function fetchAndShow(url, el) {
            try {
              const res = await fetch(url);
              const data = await res.json();
              document.getElementById(el).textContent = JSON.stringify(data, null, 2);
            } catch (e) {
              document.getElementById(el).textContent = 'Error loading data';
            }
          }
          fetchAndShow('/health', 'health');
          fetchAndShow('/metrics', 'metrics');

          // Chart.js Uptime Chart
          const ctx = document.getElementById('uptimeChart').getContext('2d');
          const uptimeData = {
            labels: [],
            datasets: [{
              label: 'Uptime (s)',
              data: [],
              fill: true,
              backgroundColor: 'rgba(0,120,215,0.08)',
              borderColor: '#0078d7',
              tension: 0.2,
              pointRadius: 2
            }]
          };
          const uptimeChart = new Chart(ctx, {
            type: 'line',
            data: uptimeData,
            options: {
              scales: {
                x: { display: false },
                y: { beginAtZero: true }
              },
              plugins: {
                legend: { display: false }
              }
            }
          });
          async function pollUptime() {
            try {
              const res = await fetch('/metrics');
              const data = await res.json();
              const now = new Date();
              uptimeData.labels.push(now.toLocaleTimeString());
              uptimeData.datasets[0].data.push(Number(data.uptime.toFixed(1)));
              if (uptimeData.labels.length > 30) {
                uptimeData.labels.shift();
                uptimeData.datasets[0].data.shift();
              }
              uptimeChart.update();
            } catch (e) {}
            setTimeout(pollUptime, 2000);
          }
          pollUptime();
        </script>
      </body>
      </html>
    `);
  });
};

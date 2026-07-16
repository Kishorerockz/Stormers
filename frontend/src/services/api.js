// src/services/api.js

const DEFAULT_API_URL = "http://localhost:8000";

// Helpers for settings
export const getApiMode = () => localStorage.getItem("aegis_api_mode") || "mock";
export const setApiMode = (mode) => localStorage.setItem("aegis_api_mode", mode);
export const getLiveUrl = () => localStorage.getItem("aegis_live_url") || DEFAULT_API_URL;
export const setLiveUrl = (url) => localStorage.setItem("aegis_live_url", url);

// Helper to write to audit log
const addMockAuditLog = (userEmail, action, targetType, targetId) => {
  const logs = JSON.parse(localStorage.getItem("aegis_audit_logs") || "[]");
  const newLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    user_email: userEmail || "system",
    action,
    target_type: targetType,
    target_id: targetId,
    timestamp: new Date().toISOString()
  };
  logs.unshift(newLog);
  localStorage.setItem("aegis_audit_logs", JSON.stringify(logs));
};

// Seed initial mock data if not present
const seedMockData = () => {
  // Sanity check: reset stuck checking statuses to clean from previous crashed runs
  try {
    const assets = JSON.parse(localStorage.getItem("aegis_assets") || "[]");
    if (Array.isArray(assets) && assets.length > 0) {
      let changed = false;
      const updated = assets.map(a => {
        if (a.status === 'checking') {
          a.status = 'clean';
          changed = true;
        }
        return a;
      });
      if (changed) {
        localStorage.setItem("aegis_assets", JSON.stringify(updated));
      }
    }
  } catch (e) {}

  if (!localStorage.getItem("aegis_users")) {
    const defaultUsers = [
      { email: "admin@aegis.io", password: "password", role: "admin" },
      { email: "viewer@aegis.io", password: "password", role: "viewer" }
    ];
    localStorage.setItem("aegis_users", JSON.stringify(defaultUsers));
  }

  if (!localStorage.getItem("aegis_assets")) {
    const defaultAssets = [
      {
        id: "asset_1",
        url: "https://securebank-portal.com",
        label: "SecureBank Customer Portal",
        owner_id: "admin@aegis.io",
        status: "clean",
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
        last_snapshot_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      {
        id: "asset_2",
        url: "https://shop-admin.org",
        label: "E-Commerce Backoffice",
        owner_id: "admin@aegis.io",
        status: "flagged",
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
        last_snapshot_at: new Date(Date.now() - 1800000).toISOString() // 30 mins ago
      },
      {
        id: "asset_3",
        url: "https://corp-landing.net",
        label: "Corporate Landing Homepage",
        owner_id: "admin@aegis.io",
        status: "clean",
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        last_snapshot_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }
    ];
    localStorage.setItem("aegis_assets", JSON.stringify(defaultAssets));
  }

  // Check if alerts exist and have the proper format, otherwise re-seed
  let isAlertsValid = false;
  try {
    const existing = JSON.parse(localStorage.getItem("aegis_alerts"));
    if (Array.isArray(existing) && existing.length > 0 && existing[0].diff_text) {
      isAlertsValid = true;
    }
  } catch (e) {}

  if (!localStorage.getItem("aegis_alerts") || !isAlertsValid) {
    const defaultAlerts = [
      {
        id: "alert_1",
        asset_id: "asset_2",
        asset_label: "E-Commerce Backoffice",
        asset_url: "https://shop-admin.org",
        diff_score: 14.8,
        severity: "high",
        status: "open",
        created_at: new Date(Date.now() - 1800000).toISOString(),
        ai_explanation: "Critical defacement detected on home directory. The primary banner header was modified and the main text contains extortion messages claiming database compromise. The visual layout has shifted by 14.8% due to style overrides.",
        ai_recommended_action: "Isolate web node immediately. Rotate database credentials and revoke any active administrator CMS sessions. Audit recent user creation logs in CMS database.",
        diff_text: {
          added_lines: 4,
          removed_lines: 2,
          added_sample: [
            "+ <h1 style=\"color: #ef4444; text-shadow: 0 0 10px red;\">HACKED BY SYSTEM SIEGE</h1>",
            "+ <p>WE ARE LEGION. EXPECT US. ALL DATABASES EXPORTED AND ENCRYPTED.</p>",
            "+ <p>To restore your catalog, contact: siege@onion-mail.net</p>",
            "+ <div class=\"ransom-timer\">TIME REMAINING: 48:00:00</div>"
          ],
          removed_sample: [
            "- <h1 class=\"text-primary\">Shop Admin Dashboard</h1>",
            "- <p>Use the panels below to manage orders, inventory, and invoices.</p>"
          ]
        }
      },
      {
        id: "alert_2",
        asset_id: "asset_3",
        asset_label: "Corporate Landing Homepage",
        asset_url: "https://corp-landing.net",
        diff_score: 6.2,
        severity: "medium",
        status: "open",
        created_at: new Date(Date.now() - 300000).toISOString(),
        ai_explanation: "Unauthorized structural modifications detected. Standard navigation footer links have been replaced with redirects to malicious domains. High-risk script injection is suspected in the footer DOM element.",
        ai_recommended_action: "Review footer layout scripts and delete unverified <script> elements. Validate CMS editor access logs.",
        diff_text: {
          added_lines: 2,
          removed_lines: 1,
          added_sample: [
            "+ <script src=\"https://suspicious-malware-cdn.ru/payload.js\"></script>",
            "+ <a href=\"https://malicious-spam-target.com/pay\">Get Rich Quick</a>"
          ],
          removed_sample: [
            "- <a href=\"/terms\">Terms & Conditions</a>"
          ]
        }
      }
    ];
    localStorage.setItem("aegis_alerts", JSON.stringify(defaultAlerts));
  }

  if (!localStorage.getItem("aegis_audit_logs")) {
    const defaultLogs = [
      {
        id: "log_1",
        user_email: "admin@aegis.io",
        action: "Logged In Successfully",
        target_type: "auth",
        target_id: "admin@aegis.io",
        timestamp: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: "log_2",
        user_email: "admin@aegis.io",
        action: "Registered monitored asset: https://shop-admin.org",
        target_type: "asset",
        target_id: "asset_2",
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: "log_3",
        user_email: "system",
        action: "Defacement check: Asset https://shop-admin.org status set to FLAGGED",
        target_type: "alert",
        target_id: "alert_1",
        timestamp: new Date(Date.now() - 1800000).toISOString()
      }
    ];
    localStorage.setItem("aegis_audit_logs", JSON.stringify(defaultLogs));
  }
};

// Seed immediately on import
seedMockData();

// HTTP fetch helper for live API mode
async function apiFetch(endpoint, options = {}) {
  const url = `${getLiveUrl()}${endpoint}`;
  const token = localStorage.getItem("aegis_token");
  
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Unified API Service
export const api = {
  // --- AUTHENTICATION ---
  login: async (email, password) => {
    if (getApiMode() === "mock") {
      const users = JSON.parse(localStorage.getItem("aegis_users") || "[]");
      const user = users.find(u => u.email === email && u.password === password);
      
      if (!user) {
        throw new Error("Invalid email or password.");
      }
      
      addMockAuditLog(email, "Logged In Successfully", "auth", email);
      return { token: `mock_jwt_token_${user.role}`, role: user.role, email: user.email };
    } else {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      return res; // Should contain { token, role, email }
    }
  },

  register: async (email, password, role = "viewer") => {
    if (getApiMode() === "mock") {
      const users = JSON.parse(localStorage.getItem("aegis_users") || "[]");
      if (users.some(u => u.email === email)) {
        throw new Error("User already exists.");
      }
      
      const newUser = { email, password, role };
      users.push(newUser);
      localStorage.setItem("aegis_users", JSON.stringify(users));
      
      addMockAuditLog(email, `Registered user as ${role.toUpperCase()}`, "auth", email);
      return { email, role };
    } else {
      return await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role })
      });
    }
  },

  // --- ASSETS ---
  getAssets: async () => {
    try {
      if (getApiMode() === "mock") {
        const data = JSON.parse(localStorage.getItem("aegis_assets") || "[]");
        return Array.isArray(data) ? data : [];
      } else {
        const data = await apiFetch("/assets");
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.error("Failed to get assets:", e);
      return [];
    }
  },

  addAsset: async (url, label, userEmail) => {
    if (getApiMode() === "mock") {
      const assets = JSON.parse(localStorage.getItem("aegis_assets") || "[]");
      const newAsset = {
        id: `asset_${Date.now()}`,
        url,
        label,
        owner_id: userEmail,
        status: "clean",
        created_at: new Date().toISOString(),
        last_snapshot_at: null
      };
      
      assets.push(newAsset);
      localStorage.setItem("aegis_assets", JSON.stringify(assets));
      
      addMockAuditLog(userEmail, `Added monitored website: ${url} (${label})`, "asset", newAsset.id);
      return newAsset;
    } else {
      return await apiFetch("/assets", {
        method: "POST",
        body: JSON.stringify({ url, label })
      });
    }
  },

  deleteAsset: async (id, userEmail) => {
    if (getApiMode() === "mock") {
      let assets = JSON.parse(localStorage.getItem("aegis_assets") || "[]");
      const assetToDelete = assets.find(a => a.id === id);
      if (!assetToDelete) throw new Error("Asset not found");
      
      assets = assets.filter(a => a.id !== id);
      localStorage.setItem("aegis_assets", JSON.stringify(assets));
      
      // Also delete related alerts
      let alerts = JSON.parse(localStorage.getItem("aegis_alerts") || "[]");
      alerts = alerts.filter(a => a.asset_id !== id);
      localStorage.setItem("aegis_alerts", JSON.stringify(alerts));
      
      addMockAuditLog(userEmail, `Deleted asset: ${assetToDelete.url}`, "asset", id);
      return true;
    } else {
      return await apiFetch(`/assets/${id}`, {
        method: "DELETE"
      });
    }
  },

  triggerSnapshot: async (assetId, userEmail) => {
    if (getApiMode() === "mock") {
      const assets = JSON.parse(localStorage.getItem("aegis_assets") || "[]");
      const assetIndex = assets.findIndex(a => a.id === assetId);
      
      if (assetIndex === -1) throw new Error("Asset not found");
      
      // Set to checking
      assets[assetIndex].status = "checking";
      assets[assetIndex].last_snapshot_at = new Date().toISOString();
      localStorage.setItem("aegis_assets", JSON.stringify(assets));
      
      addMockAuditLog(userEmail, `Triggered manual scan for asset: ${assets[assetIndex].url}`, "asset", assetId);
      
      // Simulate scan delay and trigger result
      return new Promise((resolve) => {
        setTimeout(() => {
          const updatedAssets = JSON.parse(localStorage.getItem("aegis_assets") || "[]");
          const currAsset = updatedAssets.find(a => a.id === assetId);
          if (!currAsset) return resolve(null);

          // 30% chance of flagging an alert on trigger (for interactive demo purposes!)
          const shouldFlag = Math.random() < 0.4;
          
          if (shouldFlag) {
            currAsset.status = "flagged";
            
            // Create a mock alert
            const alerts = JSON.parse(localStorage.getItem("aegis_alerts") || "[]");
            const newAlert = {
              id: `alert_${Date.now()}`,
              asset_id: assetId,
              asset_label: currAsset.label,
              asset_url: currAsset.url,
              diff_score: parseFloat((Math.random() * 15 + 5).toFixed(1)),
              severity: Math.random() > 0.5 ? "high" : "medium",
              status: "open",
              created_at: new Date().toISOString(),
              ai_explanation: "Automated scan detected unauthorized changes. The index HTML contains an unfamiliar inline style altering display properties. Script headers have been appended with unauthenticated sources.",
              ai_recommended_action: "Roll back CMS layout page, review the audit logs for editor account 'editor_node_3', and check backend database integrity.",
              diff_text: {
                added_lines: 2,
                removed_lines: 1,
                added_sample: [
                  "+ <div id=\"banner\" style=\"background: red;\">Under Maintenance - Contact Cyber Threat Response</div>",
                  "+ <script src=\"http://c2-server.evil.com/logger.js\"></script>"
                ],
                removed_sample: [
                  "- <div id=\"banner\">Welcome to our service hub.</div>"
                ]
              }
            };
            
            alerts.unshift(newAlert);
            localStorage.setItem("aegis_alerts", JSON.stringify(alerts));
            localStorage.setItem("aegis_assets", JSON.stringify(updatedAssets));
            
            addMockAuditLog("system", `Defacement check flagged asset: ${currAsset.url} with Severity: ${newAlert.severity.toUpperCase()}`, "alert", newAlert.id);
            resolve({ asset: currAsset, alert: newAlert });
          } else {
            currAsset.status = "clean";
            localStorage.setItem("aegis_assets", JSON.stringify(updatedAssets));
            addMockAuditLog("system", `Defacement check finished: Asset ${currAsset.url} is CLEAN`, "asset", assetId);
            resolve({ asset: currAsset, alert: null });
          }
        }, 1500); // 1.5s simulated scan
      });
    } else {
      return await apiFetch(`/assets/${assetId}/snapshot`, {
        method: "POST"
      });
    }
  },

  // --- ALERTS ---
  getAlerts: async () => {
    try {
      if (getApiMode() === "mock") {
        const data = JSON.parse(localStorage.getItem("aegis_alerts") || "[]");
        return Array.isArray(data) ? data : [];
      } else {
        const data = await apiFetch("/alerts");
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.error("Failed to get alerts:", e);
      return [];
    }
  },

  dismissAlert: async (id, userEmail) => {
    if (getApiMode() === "mock") {
      const alerts = JSON.parse(localStorage.getItem("aegis_alerts") || "[]");
      const alertIndex = alerts.findIndex(a => a.id === id);
      if (alertIndex === -1) throw new Error("Alert not found");
      
      alerts[alertIndex].status = "dismissed";
      localStorage.setItem("aegis_alerts", JSON.stringify(alerts));
      
      // Check if we should revert asset status
      const assetId = alerts[alertIndex].asset_id;
      const remainingOpenAlerts = alerts.filter(a => a.asset_id === assetId && a.status === "open");
      if (remainingOpenAlerts.length === 0) {
        const assets = JSON.parse(localStorage.getItem("aegis_assets") || "[]");
        const assetIndex = assets.findIndex(a => a.id === assetId);
        if (assetIndex !== -1 && assets[assetIndex].status === "flagged") {
          assets[assetIndex].status = "clean";
          localStorage.setItem("aegis_assets", JSON.stringify(assets));
        }
      }
      
      addMockAuditLog(userEmail, `Dismissed alert for ${alerts[alertIndex].asset_url}`, "alert", id);
      return alerts[alertIndex];
    } else {
      return await apiFetch(`/alerts/${id}/dismiss`, {
        method: "POST"
      });
    }
  },

  reviewAlert: async (id, userEmail) => {
    if (getApiMode() === "mock") {
      const alerts = JSON.parse(localStorage.getItem("aegis_alerts") || "[]");
      const alertIndex = alerts.findIndex(a => a.id === id);
      if (alertIndex === -1) throw new Error("Alert not found");
      
      alerts[alertIndex].status = "reviewed";
      localStorage.setItem("aegis_alerts", JSON.stringify(alerts));
      
      // Revert asset status if no other open alerts
      const assetId = alerts[alertIndex].asset_id;
      const remainingOpenAlerts = alerts.filter(a => a.asset_id === assetId && a.status === "open");
      if (remainingOpenAlerts.length === 0) {
        const assets = JSON.parse(localStorage.getItem("aegis_assets") || "[]");
        const assetIndex = assets.findIndex(a => a.id === assetId);
        if (assetIndex !== -1 && assets[assetIndex].status === "flagged") {
          assets[assetIndex].status = "clean";
          localStorage.setItem("aegis_assets", JSON.stringify(assets));
        }
      }
      
      addMockAuditLog(userEmail, `Marked alert for ${alerts[alertIndex].asset_url} as Reviewed`, "alert", id);
      return alerts[alertIndex];
    } else {
      return await apiFetch(`/alerts/${id}/review`, {
        method: "POST"
      });
    }
  },

  // --- AUDIT LOGS ---
  getAuditLogs: async () => {
    try {
      if (getApiMode() === "mock") {
        const data = JSON.parse(localStorage.getItem("aegis_audit_logs") || "[]");
        return Array.isArray(data) ? data : [];
      } else {
        const data = await apiFetch("/audit-logs");
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.error("Failed to get audit logs:", e);
      return [];
    }
  }
};
export default api;

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data }
}

async function request(path, { method = "GET", body } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method, credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data)
  return data
}

const qs = (o) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""))
  return p.toString() ? `?${p}` : ""
}

export const api = {
  me: () => request("/auth/me"),
  login: (b) => request("/auth/login", { method: "POST", body: b }),
  register: (b) => request("/auth/register", { method: "POST", body: b }),
  logout: () => request("/auth/logout", { method: "POST" }),
  setPreferences: (b) => request("/auth/preferences", { method: "PATCH", body: b }),
  accounts: () => request("/accounts"),
  createAccount: () => request("/accounts", { method: "POST" }),
  lookup: (n) => request(`/accounts/lookup/${n}`),
  recents: () => request("/accounts/recipients/recent"),
  ledger: (id, o = {}) => request(`/accounts/${id}/ledger${qs({ limit: 20, ...o })}`),
  history: (id, days = 30) => request(`/accounts/${id}/history${qs({ days })}`),
  csvUrl: (id, from, to) => `/api/accounts/${id}/statement.csv${qs({ from, to })}`,
  emailStatement: (id, b) => request(`/accounts/${id}/statement/email`, { method: "POST", body: b }),
  transfer: (b) => request("/transactions", { method: "POST", body: b }),
  demoFunds: (b) => request("/transactions/demo-funds", { method: "POST", body: b }),
  admin: {
    stats: () => request("/admin/stats"),
    accounts: () => request("/admin/accounts"),
    setStatus: (id, status) => request(`/admin/accounts/${id}/status`, { method: "PATCH", body: { status } }),
    transactions: () => request("/admin/transactions"),
    reverse: (id) => request(`/admin/transactions/${id}/reverse`, { method: "POST" }),
    reconcile: () => request("/admin/reconcile")
  }
}

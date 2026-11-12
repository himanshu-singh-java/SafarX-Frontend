# SafarX — Ride Hailing Platform Frontend

SafarX is an enterprise-grade ride-hailing web application built with React 19, Vite, Tailwind CSS, Leaflet, and STOMP WebSocket. It provides live dispatch, multi-driver wave matching, real-time vehicle radar, and role-based consoles for **Riders**, **Driver Partners**, and **Fleet Administrators**.

---

## 🚀 Key Features

- **Rider Console**:
  - Interactive OpenStreetMap route visualizer with live driver location tracking.
  - Multi-tier product selection: SafarX AC, Sedan Premier (Car), SafarX Moto (Bike), and City Auto.
  - Atomic booking with minimum 0.5 km route distance validation.
  - Razorpay online payment integration & cash-to-driver payment modes.
  - RBAC-isolated ride history & itemized digital receipts.

- **Driver Partner Console**:
  - Live radar listening on `/topic/driver/{driverId}` with audio/visual ride request alerts.
  - Accept, Start Trip, and Complete Trip lifecycle controls.
  - Real-time GPS location streaming via native WebSocket to `/app/update-location`.
  - Single-toggle Online/Offline availability sync with Spring Boot backend.
  - In-app vehicle management updating the backend database fleet.

- **Admin Telemetry Console**:
  - Complete visibility of all active and completed trips via `/api/rides/all`.
  - Vehicle-level trip completion via `/api/vehicles/complete-ride/{vehicleId}`.
  - Real-time fleet status breakdown across Cars, Autos, and Bikes.
  - Full trip audit modal with reverse-geocoded pickup/drop telemetry.

- **Multi-Tab Isolation**:
  - Strict tab-scoped credentials using `sessionStorage` with safe fallback to `localStorage`.
  - Run Rider, Driver 1, Driver 2, and Admin consoles simultaneously in the same browser without session cross-contamination.

---

## 🛠️ Architecture & Configuration

Configuration is centralized in `src/config.js`:
- **API Base URL**: Configured via `VITE_API_URL` (defaults to `http://localhost:8080`).
- **WebSocket URL**: Automatically derived (`http` -> `ws`, `https` -> `wss`, appending `/ws-ride/websocket`).
- **HTTP Client**: Shared Axios instance in `src/utils/apiClient.js` attaching JWT Bearer tokens automatically with 401 response handling.
- **WebSocket Protocol**: Native STOMP over WebSocket with automatic resubscription and auth failure backoff.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Spring Boot backend base URL |
| `VITE_RAZORPAY_KEY_ID` | `""` | Razorpay Key ID for rider checkout |
| `VITE_DEMO_MODE` | `true` | `true` collocates test drivers at Hyderabad Hub for local multi-tab wave testing; `false` uses device GPS |

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:5173`.

### 3. Production Build
```bash
npm run build
```

---

## 🧪 Testing Multi-Driver Dispatch Waves

1. Open **Tab 1**: Log in as Rider (or register a rider).
2. Open **Tab 2**: Log in as Driver 1 (e.g. Vishal, Car) and click **Online**.
3. Open **Tab 3**: Log in as Driver 2 (e.g. Sheru, Car) and click **Online**.
4. In **Tab 1**, select **SafarX AC (Car)** and click **Book SafarX Ride**.
5. Both Driver tabs will receive the incoming ride request pop-up simultaneously in Wave 1.
6. When one driver clicks **Accept Ride Now**, the other driver's pop-up closes with *"Ride was accepted by another driver"*.

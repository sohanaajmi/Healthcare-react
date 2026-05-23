import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dashboardRoutes from "./routes/dashboard.routes.js";
import { testDatabaseConnection } from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import healthcareRoutes from "./routes/healthcare.routes.js";
import bloodbankRoutes from "./routes/bloodbank.routes.js";
import pharmacyRoutes from "./routes/pharmacy.routes.js";
import ambulanceRoutes from "./routes/ambulance.routes.js";
import drugRoutes from "./routes/drug.routes.js";
import telemedicineRoutes from "./routes/telemedicine.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/dashboard", dashboardRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/healthcare", healthcareRoutes);
app.use("/api/bloodbank", bloodbankRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/ambulance", ambulanceRoutes);
app.use("/api/drug-interactions", drugRoutes);
app.use("/api/telemedicine", telemedicineRoutes);
app.use("/api/appointments", appointmentRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "HealthCare Service API is running",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await testDatabaseConnection();

    res.json({
      success: true,
      message: "Backend and MySQL are working",
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  try {
    await testDatabaseConnection();
  } catch (error) {
    console.error("Initial database connection failed:", error.message);
  }
});
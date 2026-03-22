require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { randomUUID } = require("node:crypto");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-jwt-secret";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-admin";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "videos.json");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const DIST_DIR = path.join(__dirname, "..", "dist");

const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || "eu-west-1";
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL;

const useS3 = Boolean(S3_BUCKET);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

const s3Client = useS3
  ? new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
            }
          : undefined
    })
  : null;

const storage = useS3
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination(req, file, cb) {
        cb(null, UPLOADS_DIR);
      },
      filename(req, file, cb) {
        const ext = path.extname(file.originalname || ".mp4");
        cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
      }
    });

const upload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const ok = ["video/mp4", "video/webm", "video/quicktime"].includes(file.mimetype);
    cb(ok ? null : new Error("Formato video non supportato"), ok);
  }
});

app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
    credentials: false
  })
);
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

function readVideos() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

function writeVideos(videos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(videos, null, 2), "utf8");
}

function createToken() {
  return jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Token mancante" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ error: "Permessi insufficienti" });
    }
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Token non valido o scaduto" });
  }
}

async function storeVideoFile(file) {
  if (!useS3) {
    return {
      url: `/uploads/${file.filename}`
    };
  }

  const ext = path.extname(file.originalname || ".mp4");
  const key = `videos/${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    })
  );

  const baseUrl = S3_PUBLIC_BASE_URL
    ? S3_PUBLIC_BASE_URL.replace(/\/$/, "")
    : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

  return {
    url: `${baseUrl}/${key}`
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, storage: useS3 ? "s3" : "local" });
});

app.post("/api/admin/login", (req, res) => {
  const username = (req.body?.username || "").trim();
  const password = req.body?.password || "";

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Credenziali non valide" });
  }

  return res.json({ token: createToken() });
});

app.get("/api/admin/me", requireAdminAuth, (req, res) => {
  return res.json({ ok: true, role: "admin" });
});

app.get("/api/videos", (req, res) => {
  const videos = readVideos().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ videos });
});

app.post("/api/videos/upload", requireAdminAuth, upload.single("video"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File video mancante" });
    }

    const stored = await storeVideoFile(req.file);
    const videos = readVideos();

    const newVideo = {
      id: randomUUID(),
      title: (req.body.title || "Video motivazionale").trim(),
      description: (req.body.description || "Selezionato dall'admin").trim(),
      url: stored.url,
      createdAt: new Date().toISOString()
    };

    videos.push(newVideo);
    writeVideos(videos);

    return res.status(201).json({ video: newVideo });
  } catch (err) {
    return next(err);
  }
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    return res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || "Errore server" });
  }
  return next();
});

app.listen(PORT, () => {
  console.log(`SplitSecond API on http://localhost:${PORT}`);
});

# Edu Assist Backend

Backend API untuk platform asisten pendidikan, dibangun dengan **Express 5** dan **TypeScript 6**.

## Tech Stack

| Kategori | Teknologi |
|---|---|
| Runtime | Node.js 22, TypeScript 6 |
| Framework | Express 5 |
| ORM | Drizzle ORM → PostgreSQL |
| Autentikasi | Google OAuth 2.0 + JWT (Passport.js) |
| Validasi | Zod v4 |
| Cache / Rate Limit | Redis / Upstash Redis |
| Penyimpanan File | S3-compatible (MinIO) |
| Dokumentasi API | Scalar (auto-generated OpenAPI 3.1) |
| Testing | Jest + Supertest |
| Package Manager | pnpm 10.33.0 |

## Persyaratan

- Node.js 22+
- pnpm 10.33.0+
- PostgreSQL 16.2+
- Redis 7.2+
- MinIO (opsional, untuk penyimpanan file)

## Instalasi

```bash
# Install dependencies
pnpm install

# Salin file environment dan sesuaikan konfigurasi
cp .env.example .env
```

## Menjalankan Aplikasi

```bash
# Development mode (dengan auto-reload)
pnpm dev

# Build untuk production
pnpm build

# Linting
pnpm lint

# Linting dengan auto-fix
pnpm lint:fix

# Testing
pnpm test
```

## Database

```bash
# Generate migration baru
pnpm db:generate

# Jalankan migrasi
pnpm db:migrate

# Buka Drizzle Studio (database GUI)
pnpm db:studio

# Hapus semua tabel
pnpm db:drop
```

## Docker Compose

```bash
# Jalankan PostgreSQL, Redis, dan MinIO
docker compose up -d
```

## Environment Variables

Lihat `.env.example` untuk daftar lengkap variabel lingkungan yang diperlukan.

**Variabel wajib:**
- `POSTGRES_URL` — Koneksi database PostgreSQL
- `GOOGLE_CLIENT_ID` — Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth Client Secret
- `JWT_SECRET` — Rahasia untuk menandatangani JWT
- `REFRESH_TOKEN_SECRET` — Rahasia untuk refresh token
- `DATA_ENCRYPTION_KEY` — Kunci enkripsi AES-256-GCM

## Endpoints API

Semua endpoint berada di bawah `/api/v1`.

### Autentikasi

| Metode | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/auth/google` | — | Memulai alur Google OAuth |
| GET | `/auth/google/callback` | — | Menyelesaikan Google OAuth, menerbitkan JWT + refresh cookie |
| POST | `/auth/refresh` | — (cookie) | Memutar refresh token, menghasilkan access token baru |
| GET | `/auth/failure` | — | Mengembalikan 401 pada kegagalan Google OAuth |
| POST | `/auth/logout` | JWT | Mencabut sesi refresh token, menghapus cookie |
| GET | `/auth/me` | JWT | Mengembalikan pengguna yang sedang terautentikasi |

### Profil

| Metode | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/profiles/me` | JWT | Mengembalikan profil siswa |
| PATCH | `/profiles/me` | JWT | Memperbarui profil siswa secara parsial |

### Chat

| Metode | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/chat/sessions` | JWT | Membuat sesi percakapan baru |
| GET | `/chat/sessions` | JWT | Daftar sesi chat |
| GET | `/chat/sessions/:sessionId` | JWT | Melanjutkan sesi (mengembalikan riwayat) |
| GET | `/chat/sessions/:sessionId/messages` | JWT | Daftar pesan dalam sesi |
| POST | `/chat/sessions/:sessionId/messages` | JWT | Mengirim pesan (mendukung SSE streaming) |
| DELETE | `/chat/sessions/:sessionId` | JWT | Menghapus sesi chat |

### Dokumen

| Metode | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/documents` | JWT | Daftar dokumen pengguna |
| POST | `/documents` | JWT | Unggah satu dokumen |
| POST | `/documents/batch` | JWT | Unggah batch hingga 10 dokumen |
| DELETE | `/documents` | JWT | Hapus dokumen berdasarkan file key S3 |

### Lainnya

| Metode | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/` | — | Health check |
| GET | `/openapi.json` | — | Spesifikasi OpenAPI 3.1 yang di-generate otomatis |
| GET | `/docs` | — | Scalar API Reference UI |

## Skema Database

### `users` — Akun pengguna
- `id` (UUID, PK), `email` (unik), `name`, `avatarUrl`, `provider`, `providerId`
- `isActive`, `role` (enum: student/guest)
- Bidang personalisasi: `educationLevel`, `difficultyPreference`, `favouriteSubjects`, `pace`, `explanationStyle`
- Timestamps: `createdAt`, `updatedAt`

### `sessions` — Sesi refresh token
- `id` (UUID, PK), `userId` (FK → users, cascade delete)
- `refreshTokenHash` (unik, HMAC-SHA256), `expiresAt`
- `ipAddress`, `userAgent`
- Timestamps: `createdAt`, `updatedAt`

### `student_profiles` — Personalisasi siswa (1:1 dengan users)
- `userId` (PK, FK → users, cascade delete)
- `educationLevel`, `difficultyPreference`, `favouriteSubjects`, `pace`, `explanationStyle`
- Timestamps: `createdAt`, `updatedAt`

### `chat_sessions` — Sesi percakapan
- `id` (UUID, PK), `userId` (FK → users, set null)
- `title`, `status` (enum: active/archived)
- `rollingSummary`, `lastMessageAt`, `guestContext` (JSONB)
- Timestamps: `createdAt`, `updatedAt`

### `chat_messages` — Pesan dalam sesi
- `id` (UUID, PK), `chatSessionId` (FK → chat_sessions, cascade)
- `role` (enum: user/assistant), `content`
- `thinkingProcess`, `modelName`, `modelMetadata`
- `citations` (JSONB)
- Penggunaan token: `promptTokens`, `completionTokens`, `totalTokens`, `retrievalChunks`
- Timestamps: `createdAt`, `updatedAt`

### `courses` — Kursus yang direkomendasikan
- `id` (UUID, PK), `title`, `tags` (array teks), `rating`, `level`, `url` (unik), `hybridMatch`
- Timestamps: `createdAt`, `updatedAt`

### `chat_message_courses` — Junction M:N (chat_messages ↔ courses)
- Composite PK: `chatMessageId` (FK), `courseId` (FK), keduanya cascade delete

## Fitur Utama

### Chat AI dengan RAG
Mengirimkan respons dari API inferensi Python eksternal dengan konteks RAG yang mencakup profil siswa, dokumen yang dilampirkan, dan riwayat percakapan.

### Streaming SSE
Respons chat dapat dialirkan secara real-time menggunakan Server-Sent Events (SSE).

### Rekomendasi Kursus
Respons asisten dapat merekomendasikan kursus yang akan disimpan ke tabel `courses` dan `chat_message_courses`.

### Manajemen Dokumen
Unggah file (PDF, DOCX, TXT, MD, maks 25MB) ke S3 dengan pelacakan status (processing → ready/failed). Mendukung unggah batch hingga 10 dokumen sekaligus.

### Autentikasi
- **Google OAuth 2.0** via Passport.js — alur redirect standar Google
- **JWT** — token akses dari `Authorization` header, refresh token dalam HTTP-only cookie
- **Rotasi refresh token** — sesi baru dibuat saat refresh, sesi lama dicabut
- **Token di-hash** menggunakan HMAC-SHA256 dan disimpan di tabel `sessions`

### Pembatasan Kecepatan (Rate Limiting)
Implementasi rate limiting per endpoint:
- Google login: 5 per 15 menit
- Google callback: 10 per 15 menit
- Refresh: 30 per 15 menit
- Logout: 30 per 15 menit

Menggunakan Upstash Redis di production, Redis lokal di development, dan fallback memori.

## Pipeline Middleware

1. Header keamanan (X-Content-Type-Options, HSTS di production)
2. CORS (sumber terpercaya dari env)
3. Parsing JSON/URL-encoded (batas 100kb)
4. Cookie parser
5. Inisialisasi Passport
6. Rate limiting per-rute
7. Autentikasi JWT (jika diterapkan)
8. Penangan error global (menangkap ZodError, MulterError, AppError, error umum)

## CI/CD

**CI** — Pada PR ke `main` atau push ke `main`:
1. `pnpm install`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm test`

**CD** — Pada push ke `main`:
1. Jalankan migrasi database
2. Picu hook deploy Render

## Struktur Proyek

```
├── src/
│   ├── server.ts              # Entry point — memulai Express
│   ├── app.ts                 # Setup Express, middleware, route mounting
│   ├── auth/
│   │   └── passport.ts        # Strategi Google OAuth + JWT Passport
│   ├── config/
│   │   └── env.ts             # Parsing env var dengan validasi
│   ├── controllers/           # Handler permintaan
│   ├── db/
│   │   ├── db.ts              # Instance Drizzle ORM
│   │   ├── migrate.ts         # Runner migrasi
│   │   └── migrations/        # Migrasi SQL
│   ├── dtos/                  # Skema Zod untuk bentuk request/response
│   ├── errors/
│   │   └── app-error.ts       # Custom AppError
│   ├── lib/
│   │   ├── openapi.ts         # Generator dokumen OpenAPI
│   │   ├── object-storage.ts  # Helper upload/hapus S3
│   │   └── redis.ts           # Singleton klien Redis
│   ├── middlewares/           # Middleware (auth, error handler, dll.)
│   ├── models/                # Definisi skema Drizzle
│   ├── routes/                # Definisi rute Express
│   ├── services/              # Logika bisnis
│   ├── types/                 # Tipe TypeScript bersama
│   └── utils/                 # Utility (crypto, validasi)
├── .github/workflows/         # CI/CD workflows
├── docker-compose.yml         # Docker services (PostgreSQL, Redis, MinIO)
├── Dockerfile                 # Multi-stage build untuk production
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

## Lisensi

ISC

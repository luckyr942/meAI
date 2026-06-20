# MeAI — The AI That Actually Knows You

A neuromorphic AI companion with persistent episodic memory. Built with **TypeScript everywhere** — Express backend + React Native (Expo) mobile app + Google Gemini API (free!).

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- [Gemini API Key](https://aistudio.google.com/apikey) (free!)

### 1. Set up environment
```bash
cp .env.example .env

### 2. Start the backend
```bash
cd backend
npm install
npm run dev
```

### 3. Start the mobile app
```bash
cd mobile
npm install
npx expo start
```

## 📁 Project Structure
```
meai/
├── backend/                 # Express + TypeScript
│   ├── src/
│   │   ├── engine/          # Gemini conversation engine
│   │   │   ├── conversation.ts
│   │   │   └── prompts.ts
│   │   ├── routes/          # API endpoints
│   │   │   └── chat.ts
│   │   ├── config.ts        # Environment config
│   │   ├── types.ts         # TypeScript interfaces
│   │   └── index.ts         # App entry point
│   ├── package.json
│   └── tsconfig.json
├── mobile/                  # React Native (Expo)
│   ├── src/
│   │   ├── screens/         # App screens
│   │   ├── services/        # API client
│   │   ├── hooks/           # Custom hooks
│   │   └── theme.ts         # Design system
│   └── App.tsx
├── docker-compose.yml
└── .env.example
```

## 🧠 Architecture (Phase-wise)
- **Phase 1**: Chat with AI companion (current) ✅
- **Phase 2**: Memory extraction (entities, emotions, facts)
- **Phase 3**: Dual memory retrieval (Neo4j + vector DB)
- **Phase 4**: Nightly consolidation + mood tracking
- **Phase 5**: Auth, privacy, subscriptions

## 💡 Tech Stack
- **Backend**: Express + TypeScript + Google Gemini API
- **Mobile**: React Native + Expo + TypeScript
- **AI**: Gemini 2.0 Flash (free tier)

## 📝 License
MIT
